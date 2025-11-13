// ==============================================================================
// --- 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
// ==============================================================================

// Importa as funções necessárias dos pacotes corretos do Firebase
import {
    initializeApp // Apenas esta função vem do firebase-app
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";

import {
    getFirestore, // Todas as funções do Firestore vêm daqui
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    writeBatch,
    setDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import {
    getAuth, // Todas as funções de Autenticação vêm daqui
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";


// O 'db' e o 'auth' são inicializados no index.html e colocados no objeto 'window'
// para que este script possa acessá-los.
const { db, auth } = window;

const appContainer = document.getElementById('app-container');
const appState = {
    isModerator: false,
    coursesCache: [],
    starsCache: {},
    currentListener: null, // Para cancelar a escuta de dados em tempo real ao mudar de página
};

// ==============================================================================
// --- 2. ROTEADOR E NAVEGAÇÃO ---
// ==============================================================================

function router() {
    // Se estivermos ouvindo uma leaderboard em tempo real, cancelamos antes de mudar de página
    if (appState.currentListener) {
        appState.currentListener();
        appState.currentListener = null;
    }

    const hash = window.location.hash || '#home';
    if (hash === '#home') {
        showCoursesPage();
    } else if (hash.startsWith('#course/')) {
        const courseId = hash.substring('#course/'.length);
        showStarsPage(courseId);
    } else if (hash.startsWith('#star/')) {
        const [courseId, starId] = hash.substring('#star/'.length).split('/');
        showLeaderboard(courseId, starId);
    } else if (hash === '#modqueue') {
        showModQueuePage();
    } else if (hash === '#worldrecords') {
        showWorldRecordsPage();
    } else if (hash.startsWith('#wrhistory')) {
        const pathParts = hash.split('/');
        if (pathParts.length === 1) showWRHistoryCoursesPage();
        else if (pathParts.length === 2) showWRHistoryStarsPage(pathParts[1]);
        else if (pathParts.length === 3) showWRHistoryLeaderboard(pathParts[1], pathParts[2]);
    } else {
        window.location.hash = '#home';
    }
}

// ==============================================================================
// --- 3. FUNÇÕES DE RENDERIZAÇÃO DE PÁGINA ---
// ==============================================================================

function renderLoader(message) { appContainer.innerHTML = `<div class="loader">${message}</div>`; }
function renderError(message) { appContainer.innerHTML = `<h2>${message}</h2>`; }

async function loadCourses() {
    if (appState.coursesCache.length > 0) return appState.coursesCache;
    try {
        const q = query(collection(db, 'courses'), orderBy('order'));
        const snapshot = await getDocs(q);
        appState.coursesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return appState.coursesCache;
    } catch (error) { console.error(error); renderError("Error connecting to the database."); return []; }
}

async function loadStarsForCourse(courseId) {
    if (appState.starsCache[courseId]) return appState.starsCache[courseId];
     try {
        const q = query(collection(db, 'courses', courseId, 'stars'), orderBy('order'));
        const snapshot = await getDocs(q);
        const stars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        appState.starsCache[courseId] = stars;
        return stars;
    } catch (error) { console.error(error); renderError("Could not load stars for this course."); return []; }
}

async function showCoursesPage() {
    renderLoader("Loading Courses...");
    const courses = await loadCourses();
    if (courses.length === 0) {
        renderError('No courses found. Run `seedDatabase()` in the console (F12) to populate.');
        return;
    }
    appContainer.innerHTML = `
        <h2>Select a Course</h2>
        <div class="grid-container">
            ${courses.map(course => `
                <div class="card" onclick="window.location.hash='#course/${course.id}'">
                    <h3>${course.name}</h3>
                </div>
            `).join('')}
        </div>`;
}

async function showStarsPage(courseId) {
    renderLoader("Loading Stars...");
    await loadCourses();
    const course = appState.coursesCache.find(c => c.id === courseId);
    if (!course) { window.location.hash = '#home'; return; }

    const stars = await loadStarsForCourse(courseId);
    appContainer.innerHTML = `
        <div class="breadcrumb"><a href="#home">Courses</a> / <span>${course.name}</span></div>
        <h2>Select a Star</h2>
        <div class="grid-container">
            ${stars.map(star => `
                <div class="card" onclick="window.location.hash='#star/${course.id}/${star.id}'">
                    <h3>${star.name}</h3>
                </div>
            `).join('')}
        </div>`;
}

async function showLeaderboard(courseId, starId) {
    renderLoader("Loading Leaderboard...");
    await loadCourses();
    await loadStarsForCourse(courseId);
    const course = appState.coursesCache.find(c => c.id === courseId);
    const star = appState.starsCache[courseId]?.find(s => s.id === starId);

    if (!course || !star) { window.location.hash = '#home'; return; }

    const runsQuery = query(
        collection(db, 'courses', courseId, 'stars', starId, 'runs'),
        where('status', '==', 'verified'),
        orderBy('igt_numeric')
    );

    appState.currentListener = onSnapshot(runsQuery, (snapshot) => {
        const runs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        appContainer.innerHTML = `
            <div class="breadcrumb">
                <a href="#home">Courses</a> / <a href="#course/${course.id}">${course.name}</a> / <span>${star.name}</span>
            </div>
            <h2>${star.name} Leaderboard</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>#</th><th>Runner</th><th>IGT</th><th>RTA</th><th>Date</th><th>Video</th>${appState.isModerator ? '<th>Actions</th>' : ''}</tr></thead>
                    <tbody>
                    ${runs.map((run, index) => {
                        const runDate = run.date ? new Date(run.date.replace(/-/g, '\/')).toLocaleDateString() : 'N/A';
                        return `<tr>
                            <td>${index + 1}</td>
                            <td>${run.runner}</td>
                            <td>${run.igt_str || 'N/A'}</td>
                            <td>${run.rta_str || 'N/A'}</td>
                            <td>${runDate}</td>
                            <td><a href="${run.videoLink}" target="_blank" rel="noopener noreferrer">Link</a></td>
                            ${appState.isModerator ? `
                                <td><div class="mod-actions">
                                    <button onclick="openEditModal('${courseId}', '${starId}', '${run.id}')" title="Edit">✏️</button>
                                    <button onclick="deleteRun('${courseId}', '${starId}', '${run.id}')" title="Delete">🗑️</button>
                                </div></td>` : ''}
                        </tr>`;
                    }).join('') || '<tr><td colspan="7">No verified runs submitted yet.</td></tr>'}
                    </tbody>
                </table>
            </div>`;
    }, error => {
        console.error("Error fetching leaderboard:", error);
        renderError("Failed to load leaderboard.");
    });
}

async function showModQueuePage() {
    if (!appState.isModerator) { window.location.hash = '#home'; return; }
    renderLoader("Loading Moderation Queue...");
    await loadCourses();

    try {
        const q = query(collectionGroup(db, 'runs'), where('status', '==', 'pending'));
        const pendingRunsSnapshot = await getDocs(q);
        const pendingRuns = pendingRunsSnapshot.docs.map(doc => {
            const path = doc.ref.path.split('/');
            return { id: doc.id, courseId: path[1], starId: path[3], ...doc.data() };
        });

        for (const run of pendingRuns) {
            if (!appState.starsCache[run.courseId]) { await loadStarsForCourse(run.courseId); }
        }

        appContainer.innerHTML = `
            <h2>Moderation Queue</h2>
            <div id="mod-queue-container" class="table-container">
                <table>
                    <thead><tr><th>Runner</th><th>Course / Star</th><th>IGT</th><th>RTA</th><th>Video</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${pendingRuns.map(run => {
                            const course = appState.coursesCache.find(c => c.id === run.courseId);
                            const star = appState.starsCache[run.courseId]?.find(s => s.id === run.starId);
                            return `
                                <tr>
                                    <td>${run.runner}</td>
                                    <td>${course?.name || run.courseId} /<br>${star?.name || run.starId}</td>
                                    <td>${run.igt_str}</td>
                                    <td>${run.rta_str || 'N/A'}</td>
                                    <td><a href="${run.videoLink}" target="_blank">Link</a></td>
                                    <td><div class="mod-actions">
                                        <button onclick="updateRunStatus('${run.courseId}', '${run.starId}', '${run.id}', 'verified')" title="Verify">✅</button>
                                        <button onclick="updateRunStatus('${run.courseId}', '${run.starId}', '${run.id}', 'rejected')" title="Reject">❌</button>
                                        <button onclick="openEditModal('${run.courseId}', '${run.starId}', '${run.id}')" title="Edit">✏️</button>
                                        <button onclick="deleteRun('${run.courseId}', '${run.starId}', '${run.id}')" title="Delete">🗑️</button>
                                    </div></td>
                                </tr>`;
                        }).join('') || '<tr><td colspan="6">The moderation queue is empty.</td></tr>'}
                    </tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error("Error loading mod queue:", error);
        renderError("Failed to load moderation queue. Check console (F12) for a Firestore index creation link.");
    }
}

async function showWorldRecordsPage() {
    renderLoader("Calculating World Records...");
    try {
        await loadCourses();
        const q = query(collectionGroup(db, 'runs'), where('status', '==', 'verified'));
        const allRunsSnapshot = await getDocs(q);
        
        const stars = {};
        allRunsSnapshot.forEach(doc => {
            const run = doc.data();
            const path = doc.ref.path.split('/');
            const key = `${path[1]}/${path[3]}`;
            if (!stars[key]) stars[key] = { runs: [], courseId: path[1], starId: path[3] };
            stars[key].runs.push(run);
        });

        const wrData = {};
        for (const key in stars) {
            const starInfo = stars[key];
            if (starInfo.runs.length > 0) {
                starInfo.runs.sort((a, b) => a.igt_numeric - b.igt_numeric);
                const originalRunnerName = starInfo.runs[0].runner;
                const normalizedKey = originalRunnerName.toLowerCase().trim();

                if (!appState.starsCache[starInfo.courseId]) { await loadStarsForCourse(starInfo.courseId); }
                const starName = appState.starsCache[starInfo.courseId]?.find(s => s.id === starInfo.starId)?.name || starInfo.starId;

                if (!wrData[normalizedKey]) {
                    wrData[normalizedKey] = { displayName: originalRunnerName, count: 0, stars: [] };
                }
                wrData[normalizedKey].count++;
                wrData[normalizedKey].stars.push(starName);
            }
        }

        const sortedWRs = Object.values(wrData).sort((a, b) => b.count - a.count);

        appContainer.innerHTML = `
            <h2>World Records Tally</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>#</th><th>Runner</th><th>WRs</th><th>Stars</th></tr></thead>
                    <tbody>
                        ${sortedWRs.map((data, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${data.displayName}</td>
                                <td>${data.count}</td>
                                <td><ul class="wr-list">${data.stars.sort().map(s => `<li>${s}</li>`).join('')}</ul></td>
                            </tr>
                        `).join('') || '<tr><td colspan="4">No world records found.</td></tr>'}
                    </tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error("Error calculating world records:", error);
        renderError("Failed to calculate world records. Check console (F12) for an index creation link.");
    }
}

async function showWRHistoryCoursesPage() {
    renderLoader("Loading Courses for WR History...");
    const courses = await loadCourses();
    appContainer.innerHTML = `
        <h2>WR History - Select a Course</h2>
        <div class="grid-container">
            ${courses.map(course => `
                <div class="card" onclick="window.location.hash='#wrhistory/${course.id}'">
                    <h3>${course.name}</h3>
                </div>
            `).join('')}
        </div>`;
}

async function showWRHistoryStarsPage(courseId) {
    renderLoader("Loading Stars for WR History...");
    await loadCourses();
    const course = appState.coursesCache.find(c => c.id === courseId);
    if (!course) { window.location.hash = '#wrhistory'; return; }

    const stars = await loadStarsForCourse(courseId);
    appContainer.innerHTML = `
        <div class="breadcrumb"><a href="#wrhistory">WR History</a> / <span>${course.name}</span></div>
        <h2>Select a Star to View History</h2>
        <div class="grid-container">
            ${stars.map(star => `
                <div class="card" onclick="window.location.hash='#wrhistory/${course.id}/${star.id}'">
                    <h3>${star.name}</h3>
                </div>
            `).join('')}
        </div>`;
}

async function showWRHistoryLeaderboard(courseId, starId) {
    renderLoader("Loading WR History...");
    await loadCourses();
    await loadStarsForCourse(courseId);
    const course = appState.coursesCache.find(c => c.id === courseId);
    const star = appState.starsCache[courseId]?.find(s => s.id === starId);

    if (!course || !star) { window.location.hash = '#wrhistory'; return; }

    try {
        const q = query(
            collection(db, 'courses', courseId, 'stars', starId, 'runs'),
            where('status', 'in', ['verified', 'obsolete'])
        );
        const runsSnapshot = await getDocs(q);

        const allRuns = runsSnapshot.docs.map(doc => doc.data());

        const sortedHistory = allRuns.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA - dateB !== 0) return dateA - dateB;
            return a.igt_numeric - b.igt_numeric;
        });
        
        let currentWR = Infinity;
        const progression = [];
        sortedHistory.forEach(run => {
            if (run.igt_numeric < currentWR) {
                progression.push(run);
                currentWR = run.igt_numeric;
            }
        });
        
        appContainer.innerHTML = `
            <div class="breadcrumb">
                <a href="#wrhistory">WR History</a> / <a href="#wrhistory/${courseId}">${course.name}</a> / <span>${star.name}</span>
            </div>
            <h2>${star.name} - WR History</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>Player</th><th>Time</th><th>Date</th><th>Video</th></tr></thead>
                    <tbody>
                        ${progression.reverse().map(entry => `
                            <tr>
                                <td>${entry.runner}</td>
                                <td>${entry.igt_str}</td>
                                <td>${entry.date}</td>
                                <td><a href="${entry.videoLink}" target="_blank" rel="noopener noreferrer">Link</a></td>
                            </tr>
                        `).join('') || `<tr><td colspan="4">No history found for this star.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error("Error loading WR History:", error);
        renderError("Failed to load WR History. Check console (F12) for an index creation link.");
    }
}

// ==============================================================================
// --- 4. AÇÕES, MODAIS E MODERAÇÃO ---
// ==============================================================================

function updateModeratorUI(user) {
    appState.isModerator = !!user;
    const modSection = document.getElementById('moderator-auth-section');
    const modQueueLink = document.getElementById('mod-queue-link-container');

    if (user) {
        modSection.innerHTML = `<a class="action-button" onclick="logoutModerator()">Logout (${user.email})</a>`;
        modQueueLink.innerHTML = `<a href="#modqueue">Moderation Queue</a>`;
    } else {
        modSection.innerHTML = `<a class="action-button" onclick="openLoginModal()">Moderator Login</a>`;
        modQueueLink.innerHTML = '';
    }
    router(); // Re-render a página atual para mostrar/ocultar botões de mod
}

async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;
    const errorElement = document.getElementById('login-error');
    errorElement.style.display = 'none';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('login-modal');
    } catch (error) {
        console.error("Login failed:", error.message);
        errorElement.textContent = "Login failed. Please check your email and password.";
        errorElement.style.display = 'block';
    }
}

async function logoutModerator() {
    await signOut(auth);
}

function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
function openLoginModal() { openModal('login-modal'); }

async function openSubmissionModal() {
    const courses = await loadCourses();
    const courseSelect = document.getElementById('course-select');
    const starSelect = document.getElementById('star-select');
    
    courseSelect.innerHTML = '<option value="">Select a Course</option>' + courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    starSelect.innerHTML = '<option value="">Select a Star</option>';
    starSelect.disabled = true;

    courseSelect.onchange = async () => {
        const courseId = courseSelect.value;
        if (!courseId) {
            starSelect.innerHTML = '<option value="">Select a Star</option>';
            starSelect.disabled = true;
            return;
        }
        const stars = await loadStarsForCourse(courseId);
        starSelect.innerHTML = '<option value="">Select a Star</option>' + stars.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        starSelect.disabled = false;
    };
    
    openModal('submission-modal');
}

async function openEditModal(courseId, starId, runId) {
    if (!appState.isModerator) return;
    try {
        const runRef = doc(db, 'courses', courseId, 'stars', starId, 'runs', runId);
        const runDoc = await getDoc(runRef);
        if (!runDoc.exists()) { alert("Run not found!"); return; }
        const runData = runDoc.data();
        
        document.getElementById('edit-run-id').value = runId;
        document.getElementById('edit-course-id').value = courseId;
        document.getElementById('edit-star-id').value = starId;
        document.getElementById('edit-runner').value = runData.runner;
        document.getElementById('edit-igt').value = runData.igt_str || '';
        document.getElementById('edit-rta').value = runData.rta_str || '';
        document.getElementById('edit-date').value = runData.date;
        document.getElementById('edit-videoLink').value = runData.videoLink;
        
        openModal('edit-run-modal');
    } catch(error) {
        console.error("Error opening edit modal:", error);
        alert("Could not load run data for editing.");
    }
}

function parseTimeToNumeric(timeStr) {
    if (!timeStr) return Infinity;
    if (String(timeStr).includes(':')) {
        const parts = String(timeStr).split(':').map(Number);
        if (parts.length === 2) return (parts[0] * 60) + parts[1];
        if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return parseFloat(timeStr) || Infinity;
}

async function handleRunSubmission(event) {
    event.preventDefault();
    const form = document.getElementById('submission-form');
    const submitButton = document.getElementById('submit-run-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    const courseId = form['course-select'].value;
    const starId = form['star-select'].value;
    const runnerName = form.runner.value.trim();
    
    const runData = {
        runner: runnerName,
        runner_normalized: runnerName.toLowerCase().trim(),
        igt_str: form.igt.value,
        rta_str: form.rta.value || '',
        igt_numeric: parseTimeToNumeric(form.igt.value),
        date: form.date.value,
        videoLink: form.videoLink.value,
        status: 'pending'
    };

    const runsRef = collection(db, 'courses', courseId, 'stars', starId, 'runs');
    
    try {
        const q = query(runsRef, where('runner_normalized', '==', runData.runner_normalized), where('status', '==', 'verified'), limit(1));
        const existingRunSnapshot = await getDocs(q);

        if (!existingRunSnapshot.empty) {
            const existingTime = existingRunSnapshot.docs[0].data().igt_numeric;
            if (runData.igt_numeric >= existingTime) {
                alert("Submission failed: Your new IGT is not faster than your currently verified record.");
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Run';
                return;
            }
        }
        
        await addDoc(runsRef, runData);
        alert("Run submitted for moderation!");
        closeModal('submission-modal');
        form.reset();
    } catch (error) {
        alert("An error occurred during submission.");
        console.error("Run submission error:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Run';
    }
}

async function handleRunUpdate(event) {
    event.preventDefault();
    if (!appState.isModerator) return;
    const form = event.target;
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Updating...';

    const runId = form['edit-run-id'].value;
    const courseId = form['edit-course-id'].value;
    const starId = form['edit-star-id'].value;
    const runnerName = form['edit-runner'].value;
    
    const updatedData = {
        runner: runnerName,
        runner_normalized: runnerName.toLowerCase().trim(),
        igt_str: form['edit-igt'].value,
        rta_str: form['edit-rta'].value || '',
        igt_numeric: parseTimeToNumeric(form['edit-igt'].value),
        date: form['edit-date'].value,
        videoLink: form['edit-videoLink'].value
    };

    try {
        const runRef = doc(db, 'courses', courseId, 'stars', starId, 'runs', runId);
        await updateDoc(runRef, updatedData);
        alert("Run updated successfully!");
        closeModal('edit-run-modal');
        router();
    } catch(error) {
        console.error("Run update error:", error);
        alert("Failed to update run.");
    } finally {
        button.disabled = false;
        button.textContent = 'Update Run';
    }
}

async function updateRunStatus(courseId, starId, runId, newStatus) {
    if (!appState.isModerator) return;
    if (!confirm(`Are you sure you want to ${newStatus} this run?`)) return;

    const runRef = doc(db, 'courses', courseId, 'stars', starId, 'runs', runId);

    try {
        if (newStatus === 'verified') {
            const runDoc = await getDoc(runRef);
            if (!runDoc.exists) throw new Error("Run not found");
            const runData = runDoc.data();

            const q = query(
                collection(db, 'courses', courseId, 'stars', starId, 'runs'),
                where('runner_normalized', '==', runData.runner_normalized),
                where('status', '==', 'verified')
            );
            
            const oldRunsSnapshot = await getDocs(q);
            
            const batch = writeBatch(db);
            oldRunsSnapshot.forEach(doc => {
                console.log(`Marking old run ${doc.id} as obsolete for runner ${runData.runner}`);
                batch.update(doc.ref, { status: 'obsolete' });
            });
            
            batch.update(runRef, { status: 'verified' });
            await batch.commit();

        } else {
            await updateDoc(runRef, { status: newStatus });
        }

        alert(`Run has been ${newStatus}.`);
        router();
    } catch (error) {
        console.error(`Failed to ${newStatus} run:`, error);
        alert(`An error occurred.`);
    }
}

async function deleteRun(courseId, starId, runId) {
    if (!appState.isModerator) return;
    if (!confirm("Are you sure you want to permanently delete this run? This cannot be undone.")) return;

    try {
        const runRef = doc(db, 'courses', courseId, 'stars', starId, 'runs', runId);
        await deleteDoc(runRef);
        alert("Run deleted successfully.");
        router();
    } catch (error) {
        console.error("Failed to delete run:", error);
        alert("An error occurred while deleting the run.");
    }
}

// ==============================================================================
// --- 5. FUNÇÃO DE SEED (PARA PREENCHER DADOS INICIAIS) ---
// ==============================================================================
async function seedDatabase() {
    console.log("This will add/update course/star data. It will NOT delete user-submitted runs.");
    if (!confirm("This will add base data if it's missing. Are you sure?")) return;

    const seedData = {
        courses: [
            { id: "bob", name: "Bob-omb Battlefield", order: 1, stars: [ { id: "big_bob_omb_on_the_summit", name: "Big Bob-Omb on the Summit", order: 1 }, { id: "footrace_with_koopa_the_quick", name: "Footrace with Koopa the Quick", order: 2 }, { id: "shoot_to_the_island_in_the_sky", name: "Shoot to the Island in the Sky", order: 3 }, { id: "find_the_8_red_coins", name: "Find the 8 Red Coins", order: 4 }, { id: "mario_wings_to_the_sky", name: "Mario Wings to the Sky", order: 5 }, { id: "behind_chain_chomps_gate", name: "Behind Chain Chomp's Gate", order: 6 }, { id: "bob_100_coins", name: "BoB 100 Coins", order: 7 } ]},
            { id: "wf", name: "Whomp's Fortress", order: 2, stars: [ { id: "chip_off_whomps_block", name: "Chip off Whomp's Block", order: 1 }, { id: "to_the_top_of_the_fortress", name: "To the Top of the Fortress", order: 2 }, { id: "shoot_into_the_wild_blue", name: "Shoot into the Wild Blue", order: 3 }, { id: "red_coins_on_the_floating_isle", name: "Red Coins on the Floating Isle", order: 4 }, { id: "fall_onto_the_caged_island", name: "Fall onto the Caged Island", order: 5 }, { id: "blast_away_the_wall", name: "Blast Away the Wall", order: 6 }, { id: "wf_100_coins", name: "WF 100 Coins", order: 7 } ]},
            { id: "jrb", name: "Jolly Roger Bay", order: 3, stars: [ { id: "plunder_in_the_sunken_ship", name: "Plunder in the Sunken Ship", order: 1 }, { id: "can_the_eel_come_out_to_play", name: "Can the Eel Come out to Play?", order: 2 }, { id: "treasure_of_the_ocean_cave", name: "Treasure of the Ocean Cave", order: 3 }, { id: "red_coins_on_the_ship_afloat", name: "Red Coins on the Ship Afloat", order: 4 }, { id: "blast_to_the_stone_pillar", name: "Blast to the Stone Pillar", order: 5 }, { id: "through_the_jet_stream", name: "Through the Jet Stream", order: 6 }, { id: "jrb_100_coins", name: "JRB 100 Coins", order: 7 } ]},
            { id: "ccm", name: "Cool, Cool Mountain", order: 4, stars: [ { id: "slip_slidin_away", name: "Slip Slidin' Away", order: 1 }, { id: "lil_penguin_lost", name: "Li'l Penguin Lost", order: 2 }, { id: "big_penguin_race", name: "Big Penguin Race", order: 3 }, { id: "frosty_slide_for_8_red_coins", name: "Frosty Slide for 8 Red Coins", order: 4 }, { id: "snowmans_lost_his_head", name: "Snowman's Lost his Head", order: 5 }, { id: "wall_kicks_will_work", name: "Wall Kicks will Work", order: 6 }, { id: "ccm_100_coins", name: "CCM 100 Coins", order: 7 } ]},
            { id: "bbh", name: "Big Boo's Haunt", order: 5, stars: [ { id: "go_on_a_ghost_hunt", name: "Go on a Ghost Hunt", order: 1 }, { id: "ride_big_boos_merry_go_round", name: "Ride Big Boo's Merry-Go-Round", order: 2 }, { id: "secret_of_the_haunted_books", name: "Secret of the Haunted Books", order: 3 }, { id: "seek_the_8_red_coins", name: "Seek the 8 Red Coins", order: 4 }, { id: "big_boos_balcony", name: "Big Boo's Balcony", order: 5 }, { id: "eye_to_eye_in_the_secret_room", name: "Eye to Eye in the Secret Room", order: 6 }, { id: "bbh_100_coins", name: "BBH 100 Coins", order: 7 } ]},
            { id: "hmc", name: "Hazy Maze Cave", order: 6, stars: [ { id: "swimming_beast_in_the_cavern", name: "Swimming Beast in the Cavern", order: 1 }, { id: "elevate_for_8_red_coins", name: "Elevate for 8 Red Coins", order: 2 }, { id: "metal_head_mario_can_move", name: "Metal-Head Mario Can Move!", order: 3 }, { id: "navigating_the_toxic_maze", name: "Navigating the Toxic Maze", order: 4 }, { id: "a_maze_ing_emergency_exit", name: "A-Maze-ing Emergency Exit", order: 5 }, { id: "watch_for_rolling_rocks", name: "Watch for Rolling Rocks", order: 6 }, { id: "hmc_100_coins", name: "HMC 100 Coins", order: 7 } ]},
            { id: "lll", name: "Lethal Lava Land", order: 7, stars: [ { id: "boil_the_big_bully", name: "Boil the Big Bully", order: 1 }, { id: "bully_the_bullies", name: "Bully the Bullies", order: 2 }, { id: "8_coin_puzzle_with_15_pieces", name: "8-Coin Puzzle with 15 Pieces", order: 3 }, { id: "red_hot_log_rolling", name: "Red-Hot Log Rolling", order: 4 }, { id: "hot_foot_it_into_the_volcano", name: "Hot-Foot-It into the Volcano", order: 5 }, { id: "elevator_tour_in_the_volcano", name: "Elevator Tour in the Volcano", order: 6 }, { id: "lll_100_coins", name: "LLL 100 Coins", order: 7 } ]},
            { id: "ssl", name: "Shifting Sand Land", order: 8, stars: [ { id: "in_the_talons_of_the_big_bird", name: "In the Talons of the Big Bird", order: 1 }, { id: "shining_atop_the_pyramid", name: "Shining Atop the Pyramid", order: 2 }, { id: "inside_the_ancient_pyramid", name: "Inside the Ancient Pyramid", order: 3 }, { id: "stand_tall_on_the_four_pillars", name: "Stand Tall on the Four Pillars", order: 4 }, { id: "free_flying_for_8_red_coins", name: "Free Flying for 8 Red Coins", order: 5 }, { id: "pyramid_puzzle", name: "Pyramid Puzzle", order: 6 }, { id: "ssl_100_coins", name: "SSL 100 Coins", order: 7 } ]},
            { id: "ddd", name: "Dire, Dire Docks", order: 9, stars: [ { id: "board_bowsers_sub", name: "Board Bowser's Sub", order: 1 }, { id: "chests_in_the_current", name: "Chests in the Current", order: 2 }, { id: "pole_jumping_for_red_coins", name: "Pole-Jumping for Red Coins", order: 3 }, { id: "through_the_jet_stream_ddd", name: "Through the Jet Stream", order: 4 }, { id: "the_manta_rays_reward", name: "The Manta Ray's Reward", order: 5 }, { id: "collect_the_caps", name: "Collect the Caps", order: 6 }, { id: "ddd_100_coins", name: "DDD 100 Coins", order: 7 } ]},
            { id: "sl", name: "Snowman's Land", order: 10, stars: [ { id: "snowmans_big_head", name: "Snowman's Big Head", order: 1 }, { id: "chill_with_the_bully", name: "Chill with the Bully", order: 2 }, { id: "in_the_deep_freeze", name: "In the Deep Freeze", order: 3 }, { id: "whirl_from_the_freezing_pond", name: "Whirl from the Freezing Pond", order: 4 }, { id: "shell_shreddin_for_8_red_coins", name: "Shell Shreddin' for 8 Red Coins", order: 5 }, { id: "into_the_igloo", name: "Into the Igloo", order: 6 }, { id: "sl_100_coins", name: "SL 100 Coins", order: 7 } ]},
            { id: "wdw", name: "Wet-Dry World", order: 11, stars: [ { id: "shocking_arrow_lifts", name: "Shocking Arrow Lifts!", order: 1 }, { id: "top_o_the_town", name: "Top O' The Town", order: 2 }, { id: "secrets_in_the_shallows_and_sky", name: "Secrets in the Shallows & Sky", order: 3 }, { id: "express_elevators_hurry_up", name: "Express Elevators--Hurry Up!", order: 4 }, { id: "go_to_town_for_red_coins", name: "Go to Town for Red Coins", order: 5 }, { id: "quick_race_through_downtown", name: "Quick Race through Downtown", order: 6 }, { id: "wdw_100_coins", name: "WDW 100 Coins", order: 7 } ]},
            { id: "ttm", name: "Tall, Tall Mountain", order: 12, stars: [ { id: "scale_the_mountain", name: "Scale the Mountain", order: 1 }, { id: "mystery_of_the_monkey_cage", name: "Mystery of the Monkey Cage", order: 2 }, { id: "scary_shrooms_red_coins", name: "Scary 'Shrooms, Red Coins", order: 3 }, { id: "mysterious_mountainside", name: "Mysterious Mountainside", order: 4 }, { id: "breathtaking_view_from_bridge", name: "Breathtaking View from Bridge", order: 5 }, { id: "blast_to_the_lonely_mushroom", name: "Blast to the Lonely Mushroom", order: 6 }, { id: "ttm_100_coins", name: "TTM 100 Coins", order: 7 } ]},
            { id: "thi", name: "Tiny-Huge Island", order: 13, stars: [ { id: "pluck_the_piranha_flower", name: "Pluck the Piranha Flower", order: 1 }, { id: "the_tip_top_of_the_huge_island", name: "The Tip Top of the Huge Island", order: 2 }, { id: "rematch_with_koopa_the_quick", name: "Rematch with Koopa the Quick", order: 3 }, { id: "five_itty_bitty_secrets", name: "Five Itty Bitty Secrets", order: 4 }, { id: "wigglers_red_coins", name: "Wiggler's Red Coins", order: 5 }, { id: "make_wiggler_squirm", name: "Make Wiggler Squirm", order: 6 }, { id: "thi_100_coins", name: "THI 100 Coins", order: 7 } ]},
            { id: "ttc", name: "Tick Tock Clock", order: 14, stars: [ { id: "roll_into_the_cage", name: "Roll into the Cage", order: 1 }, { id: "the_pit_and_the_pendulums", name: "The Pit and the Pendulums", order: 2 }, { id: "get_a_hand", name: "Get a Hand", order: 3 }, { id: "stomp_on_the_thwomp", name: "Stomp on the Thwomp", order: 4 }, { id: "timed_jumps_on_moving_bars", name: "Timed Jumps on Moving Bars", order: 5 }, { id: "stop_time_for_red_coins", name: "Stop Time for Red Coins", order: 6 }, { id: "ttc_100_coins", name: "TTC 100 Coins", order: 7 } ]},
            { id: "rr", name: "Rainbow Ride", order: 15, stars: [ { id: "cruiser_crossing_the_rainbow", name: "Cruiser Crossing the Rainbow", order: 1 }, { id: "the_big_house_in_the_sky", name: "The Big House in the Sky", order: 2 }, { id: "coins_amassed_in_a_maze", name: "Coins Amassed in a Maze", order: 3 }, { id: "swingin_in_the_breeze", name: "Swingin' in the Breeze", order: 4 }, { id: "tricky_triangles", name: "Tricky Triangles!", order: 5 }, { id: "somewhere_over_the_rainbow", name: "Somewhere over the Rainbow", order: 6 }, { id: "rr_100_coins", name: "RR 100 Coins", order: 7 } ]},
            { id: "bowser_stages", name: "Bowser Stages", order: 16, stars: [ { id: "bowser_in_the_dark_world_no_reds", name: "Bowser in the Dark World No Reds", order: 1 }, { id: "bowser_in_the_dark_world_reds", name: "Bowser in the Dark World Reds", order: 2 }, { id: "bowser_in_the_fire_sea_no_reds", name: "Bowser in the Fire Sea No Reds", order: 3 }, { id: "bowser_in_the_fire_sea_reds", name: "Bowser in the Fire Sea Reds", order: 4 }, { id: "bowser_in_the_sky_no_reds", name: "Bowser in the Sky No Reds", order: 5 }, { id: "bowser_in_the_sky_reds", name: "Bowser in the Sky Reds", order: 6 } ]},
            { id: "secret_stars", name: "Castle Secret Stars", order: 17, stars: [ { id: "the_princesss_secret_slide", name: "The Princess's Secret Slide", order: 1 }, { id: "the_princesss_secret_slide_u21", name: "The Princess's Secret Slide U21", order: 2 }, { id: "the_secret_aquarium", name: "The Secret Aquarium", order: 3 }, { id: "tower_of_the_wing_cap", name: "Tower of the Wing Cap", order: 4 }, { id: "cavern_of_the_metal_cap", name: "Cavern of the Metal Cap", order: 5 }, { id: "vanish_cap_under_the_moat", name: "Vanish Cap Under the Moat", order: 6 }, { id: "wing_mario_over_the_rainbow", name: "Wing Mario Over the Rainbow", order: 7 } ]}
        ],
    };
    
    try {
        console.log("Starting database seed/update...");
        const batch = writeBatch(db);
        
        for (const course of seedData.courses) {
            const courseRef = doc(db, 'courses', course.id);
            batch.set(courseRef, { name: course.name, order: course.order }, { merge: true });
            for (const star of course.stars) {
                // Usar a referência do curso para criar a subcoleção 'stars'
                const starRef = doc(collection(courseRef, 'stars'), star.id);
                batch.set(starRef, { name: star.name, order: star.order }, { merge: true });
            }
        }

        await batch.commit();
        console.log("DATABASE SEEDING/UPDATE COMPLETE!");
        alert("New data has been added/updated successfully!");
        window.location.reload();
    } catch (error) {
        console.error("SEEDING FAILED:", error);
        alert("Seeding failed. Check the console for details.");
    }
}


// ==============================================================================
// --- 6. INICIALIZAÇÃO E EXPOSIÇÃO DE FUNÇÕES GLOBAIS ---
// ==============================================================================

// Inicia o roteador quando o DOM está pronto e escuta por mudanças na hash (URL)
window.addEventListener('hashchange', router);
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        updateModeratorUI(user);
    });
    // A primeira chamada ao router acontece dentro de updateModeratorUI
});

// As funções abaixo são chamadas por 'onclick' no HTML. Para que funcionem
// em um script do tipo 'module', precisamos anexá-las explicitamente ao objeto 'window'.
window.openModal = openModal;
window.closeModal = closeModal;
window.openLoginModal = openLoginModal;
window.openSubmissionModal = openSubmissionModal;
window.handleLogin = handleLogin;
window.logoutModerator = logoutModerator;
window.handleRunSubmission = handleRunSubmission;
window.handleRunUpdate = handleRunUpdate;
window.openEditModal = openEditModal;
window.updateRunStatus = updateRunStatus;
window.deleteRun = deleteRun;
window.seedDatabase = seedDatabase; // Para ser chamada pelo console
