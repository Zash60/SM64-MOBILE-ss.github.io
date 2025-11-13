import {
    collection, collectionGroup, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
    onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const { db, auth } = window;
const appContainer = document.getElementById('app-container');
const userActionsContainer = document.getElementById('user-actions-container');

let appState = {
    isModerator: false,
    coursesCache: [],
    minigamesCache: [],
    specialStarsCache: null
};

// --- ROTEADOR ---
function router() {
    const hash = window.location.hash || '#singlestar';
    
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`.main-nav a[href="${hash}"]`) || document.querySelector('.main-nav a[href="#singlestar"]');
    if (activeLink) activeLink.classList.add('active');

    if (hash === '#singlestar') showSinglestarPage();
    else if (hash === '#timeline') showTimelinePage();
    else if (hash === '#minigames') showMinigamesPage();
    else if (hash === '#minigame-wr-counter') showMinigameWRCounterPage();
    else showSinglestarPage();
}

// --- FUNÇÕES DE RENDERIZAÇÃO DE PÁGINA ---
function renderLoader(message = "Loading...") { appContainer.innerHTML = `<div class="loader">${message}</div>`; }

function renderControls(showTimelineButton = true) {
    const timelineBtn = showTimelineButton ? `<a href="#timeline" class="button">Timeline 🕒</a>` : '';
    return `
        <div class="controls-bar">
            <div>
                <input type="date" value="${new Date().toISOString().substring(0, 10)}">
                <button class="button">Rules 📋</button>
            </div>
            <div>
                ${timelineBtn}
                <button class="button submission" onclick="openSubmissionModal()">Submission ✚</button>
            </div>
        </div>
    `;
}

async function showSinglestarPage() {
    renderLoader();
    if (appState.coursesCache.length === 0) {
        const q = query(collection(db, 'courses'), orderBy('order'));
        const snapshot = await getDocs(q);
        appState.coursesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    let coursesHTML = "";
    for (const course of appState.coursesCache) {
        const starsSnapshot = await getDocs(query(collection(db, 'courses', course.id, 'stars'), orderBy('order')));
        let starRows = "";

        for (const starDoc of starsSnapshot.docs) {
            const star = { id: starDoc.id, ...starDoc.data() };
            const q = query(collection(starDoc.ref, 'runs'), where('status', '==', 'verified'), orderBy('igt_numeric'), limit(1));
            const wrSnapshot = await getDocs(q);
            const wr = wrSnapshot.docs[0]?.data();
            
            starRows += `
                <tr>
                    <td>${star.name}</td>
                    <td>${wr?.runner || '-'}</td>
                    <td class="time-format">${formatTime(wr?.rta_str)}</td>
                    <td class="time-format">${formatTime(wr?.igt_str)}</td>
                </tr>
            `;
        }
        
        coursesHTML += `
            <section class="course-section">
                <h2 class="course-header">${course.order}. ${course.name}</h2>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Star</th><th>Player</th><th>Real Time</th><th>IGT</th></tr></thead>
                        <tbody>${starRows}</tbody>
                    </table>
                </div>
            </section>
        `;
    }
    appContainer.innerHTML = renderControls(true) + coursesHTML;
}

async function showMinigamesPage() {
    renderLoader();
    if (appState.minigamesCache.length === 0) {
        const q = query(collection(db, 'minigames'), orderBy('order'));
        const snapshot = await getDocs(q);
        appState.minigamesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const specialStars = await getSpecialStarsWithCategories();
    
    let pageHTML = `
        <div class="controls-bar">
            <a href="#minigame-wr-counter" class="button">Minigame WR Counter</a>
            <button class="button submission" onclick="openSubmissionModal()">Submission ✚</button>
        </div>
    `;

    // Renderiza a seção de Minigames
    for (const course of appState.minigamesCache) {
        pageHTML += await renderCategorizedCourse(course, 'minigames');
    }

    // Renderiza as estrelas especiais de Singlestar
    for (const specialStar of specialStars) {
        pageHTML += await renderCategorizedCourse(specialStar.course, 'courses', specialStar.star);
    }
    
    appContainer.innerHTML = pageHTML;
}

async function renderCategorizedCourse(course, collectionName, singleStar = null) {
    const stars = singleStar ? [singleStar] : (await getDocs(collection(db, collectionName, course.id, 'stars'))).docs;
    let starRows = "";

    for (const starDoc of stars) {
        const starData = starDoc.data();
        const categoriesSnapshot = await getDocs(collection(starDoc.ref, 'categories'));
        for (const categoryDoc of categoriesSnapshot.docs) {
            const category = { id: categoryDoc.id, ...categoryDoc.data() };
            const q = query(collection(categoryDoc.ref, 'runs'), where('status', '==', 'verified'), orderBy('igt_numeric'), limit(1));
            const wrSnapshot = await getDocs(q);
            const wr = wrSnapshot.docs[0]?.data();
            
            starRows += `
                <tr>
                    <td>${starData.name} (${category.name})</td>
                    <td>${wr?.runner || '-'}</td>
                    <td class="time-format">${formatTime(wr?.rta_str)}</td>
                    <td class="time-format">${formatTime(wr?.igt_str)}</td>
                </tr>
            `;
        }
    }
    
    return `
        <section class="course-section">
            <h2 class="course-header">${course.name}</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>Star</th><th>Player</th><th>Real Time</th><th>IGT</th></tr></thead>
                    <tbody>${starRows}</tbody>
                </table>
            </div>
        </section>
    `;
}

async function getSpecialStarsWithCategories() {
    if (appState.specialStarsCache) return appState.specialStarsCache;

    const specialStarIds = [
        { courseId: "bob", starId: "footrace_with_koopa_the_quick" },
        { courseId: "thi", starId: "rematch_with_koopa_the_quick" }
    ];

    const result = [];
    for (const item of specialStarIds) {
        const courseDoc = await getDoc(doc(db, 'courses', item.courseId));
        const starDoc = await getDoc(doc(db, 'courses', item.courseId, 'stars', item.starId));
        if (courseDoc.exists() && starDoc.exists()) {
            result.push({ 
                course: { id: courseDoc.id, ...courseDoc.data() },
                star: starDoc
            });
        }
    }
    appState.specialStarsCache = result;
    return result;
}

async function showTimelinePage() {
    renderLoader("Loading Timeline...");
    const q = query(collectionGroup(db, 'runs'), where('status', '==', 'verified'), orderBy('date', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    
    const runs = snapshot.docs.map(doc => ({ ...doc.data(), path: doc.ref.path }));
    
    let timelineHTML = `<div class="timeline-container">`;
    for(const run of runs) {
        const pathParts = run.path.split('/');
        const courseId = pathParts[1];
        const starId = pathParts[3];

        timelineHTML += `
            <div class="timeline-card">
                <img src="https://via.placeholder.com/60" alt="Star Image">
                <div class="timeline-content">
                    <h3>[RT / IGT] ${courseId.toUpperCase()} - ${starId.replace(/_/g, ' ')}</h3>
                    <p><span class="player">@${run.runner}</span> got a new record with ${formatTime(run.igt_str)}!</p>
                    <p>(Achieved on ${run.date})</p>
                </div>
            </div>
        `;
    }
    timelineHTML += `</div>`;
    appContainer.innerHTML = timelineHTML;
}

async function showMinigameWRCounterPage() {
    renderLoader("Calculating Minigame WRs...");
    const wrsByPlayer = {};
    
    const collectionsToCount = ['minigames'];
    const specialStars = await getSpecialStarsWithCategories();

    // Contador para a coleção 'minigames'
    const minigameCourses = await getDocs(query(collection(db, 'minigames')));
    for (const courseDoc of minigameCourses.docs) {
        const stars = await getDocs(collection(courseDoc.ref, 'stars'));
        for (const starDoc of stars.docs) {
            const categories = await getDocs(collection(starDoc.ref, 'categories'));
            for (const categoryDoc of categories.docs) {
                const q = query(collection(categoryDoc.ref, 'runs'), where('status', '==', 'verified'), orderBy('igt_numeric'), limit(1));
                const wrSnapshot = await getDocs(q);
                if (!wrSnapshot.empty) {
                    const runner = wrSnapshot.docs[0].data().runner;
                    wrsByPlayer[runner] = (wrsByPlayer[runner] || 0) + 1;
                }
            }
        }
    }

    // Contador para as estrelas especiais de singlestar
    for (const special of specialStars) {
        const categories = await getDocs(collection(special.star.ref, 'categories'));
        for (const categoryDoc of categories.docs) {
            const q = query(collection(categoryDoc.ref, 'runs'), where('status', '==', 'verified'), orderBy('igt_numeric'), limit(1));
            const wrSnapshot = await getDocs(q);
            if (!wrSnapshot.empty) {
                const runner = wrSnapshot.docs[0].data().runner;
                wrsByPlayer[runner] = (wrsByPlayer[runner] || 0) + 1;
            }
        }
    }
    
    const sortedPlayers = Object.entries(wrsByPlayer).sort(([, a], [, b]) => b - a);

    let tableRows = sortedPlayers.map(([player, count]) => `
        <tr><td>${player}</td><td>${count}</td></tr>
    `).join('');

    appContainer.innerHTML = `
        <h2>Minigame WR Counter</h2>
        <section class="course-section">
            <div class="table-container">
                <table>
                    <thead><tr><th>Player</th><th>WRs</th></tr></thead>
                    <tbody>${tableRows || '<tr><td colspan="2">No records found.</td></tr>'}</tbody>
                </table>
            </div>
        </section>
    `;
}


// --- FUNÇÕES AUXILIARES, MODAIS E AUTENTICAÇÃO ---

function formatTime(timeStr) {
    if (!timeStr || timeStr.trim() === '') return '-';
    return timeStr.replace(':', "'").replace('.', '"');
}

function updateUserUI(user) {
    appState.isModerator = !!user;
    if (user) {
        userActionsContainer.innerHTML = `
            Logged in as <strong>${user.email}</strong> | <a href="#" onclick="logoutModerator()">Logout</a>
        `;
    } else {
        userActionsContainer.innerHTML = `
            <a href="#" onclick="openLoginModal()">Moderator Login</a>
        `;
    }
}

function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
function openLoginModal() { openModal('login-modal'); }

async function openSubmissionModal() {
    // Lógica para preencher o formulário de submissão
    // Esta parte precisa ser expandida para lidar com a seleção de categorias
    const form = document.getElementById('submission-form');
    form.innerHTML = `
        <label>Runner</label><input type="text" id="runner" required>
        <label>IGT</label><input type="text" id="igt" required>
        <p>Please select a course and star on the main page first.</p>
        <button type="submit">Submit</button>
    `;
    openModal('submission-modal');
}

async function handleLogin(event) {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('login-modal');
    } catch (error) {
        document.getElementById('login-error').textContent = error.message;
        document.getElementById('login-error').style.display = 'block';
    }
}

async function logoutModerator() { await signOut(auth); }


// --- SEED DATABASE ---
async function seedDatabase() {
    console.log("This will seed the Minigame categories.");
    if (!confirm("This will add the Minigame structure. Your existing Singlestar data will not be touched. Are you sure?")) return;

    const seedData = {
        minigames: [
            { 
                courseId: "minigames", courseName: "Minigames", order: 18, 
                stars: [
                    { 
                        starId: "pss", starName: "The Princess's Secret Slide", 
                        categories: [
                            { id: "no_restrictions", name: "No Restrictions" },
                            { id: "no_shortcuts", name: "No Shortcuts" },
                            { id: "80_coins", name: "80 Coins" }
                        ]
                    }
                ]
            }
        ],
        singlestar_special: [
            {
                courseId: "bob", starId: "footrace_with_koopa_the_quick",
                categories: [
                    { id: "no_restrictions", name: "No Restrictions" }, { id: "no_blj", name: "No BLJ" }, { id: "no_blj_or_wing_cap", name: "No BLJ or Wing Cap" }
                ]
            },
            {
                courseId: "thi", starId: "rematch_with_koopa_the_quick",
                categories: [
                    { id: "no_restrictions", name: "No Restrictions" }, { id: "no_shell_glitch", name: "No Shell Glitch" }, { id: "no_blj_or_shell_glitch", name: "No BLJ or Shell Glitch" }
                ]
            }
        ]
    };

    try {
        console.log("Starting Minigame seeding...");
        const batch = writeBatch(db);
        
        for (const course of seedData.minigames) {
            const courseRef = doc(db, 'minigames', course.courseId);
            batch.set(courseRef, { name: course.courseName, order: course.order }, { merge: true });

            for (const star of course.stars) {
                const starRef = doc(collection(courseRef, 'stars'), star.starId);
                batch.set(starRef, { name: star.starName }, { merge: true });

                for (const category of star.categories) {
                    const categoryRef = doc(collection(starRef, 'categories'), category.id);
                    batch.set(categoryRef, { name: category.name }, { merge: true });
                }
            }
        }
        
        for (const starWithCategories of seedData.singlestar_special) {
            const { courseId, starId, categories } = starWithCategories;
            const starRef = doc(db, 'courses', courseId, 'stars', starId);
            for (const category of categories) {
                const categoryRef = doc(collection(starRef, 'categories'), category.id);
                batch.set(categoryRef, { name: category.name }, { merge: true });
            }
        }

        await batch.commit();
        console.log("DATABASE SEEDING COMPLETE!");
        alert("Minigame and special rule categories have been seeded successfully!");
        window.location.reload();
    } catch (error) {
        console.error("SEEDING FAILED:", error);
        alert("Seeding failed. Check the console for details.");
    }
}


// --- INICIALIZAÇÃO E FUNÇÕES GLOBAIS ---
window.closeModal = closeModal;
window.openLoginModal = openLoginModal;
window.handleLogin = handleLogin;
window.logoutModerator = logoutModerator;
window.openSubmissionModal = openSubmissionModal;
window.seedDatabase = seedDatabase; // Para ser chamada pelo console

onAuthStateChanged(auth, updateUserUI);
window.addEventListener('hashchange', router);
router(); // Chama na primeira carga
