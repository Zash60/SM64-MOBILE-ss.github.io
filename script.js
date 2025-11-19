// ==============================================================================
// 1. IMPORTAÇÕES (Módulos do Firebase)
// ==============================================================================
import {
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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// ==============================================================================
// 2. VARIÁVEIS GLOBAIS E ESTADO
// ==============================================================================
// Recupera as instâncias iniciadas no index.html
const { db, auth } = window;

const appContainer = document.getElementById('app-container');

// Estado da aplicação para gerenciamento de cache e UI
const appState = {
    currentUser: null,
    isModerator: false,
    coursesCache: [], 
    starsCache: {},   
    currentListener: null 
};

// ==============================================================================
// 3. ROTEAMENTO (NAVEGAÇÃO)
// ==============================================================================

function router() {
    // Limpa listeners de tempo real ao trocar de tela
    if (appState.currentListener) {
        appState.currentListener();
        appState.currentListener = null;
    }

    const hash = window.location.hash || '#home';

    if (hash === '#home') {
        showCoursesList();
    } 
    else if (hash.startsWith('#course/')) {
        const courseId = hash.substring('#course/'.length);
        showCourseLeaderboard(courseId);
    } 
    else if (hash.startsWith('#star/')) {
        const parts = hash.substring('#star/'.length).split('/');
        if(parts.length >= 2) {
            showStarHistory(parts[0], parts[1]);
        } else {
            window.location.hash = '#home';
        }
    } 
    else if (hash === '#modqueue') {
        showModQueuePage();
    } 
    else {
        window.location.hash = '#home';
    }
}

// ==============================================================================
// 4. VIEW: HOME (LISTA DE CURSOS)
// ==============================================================================

async function showCoursesList() {
    appContainer.innerHTML = '<div class="loader">Loading Courses...</div>';
    
    try {
        const courses = await loadCourses();
        
        if (courses.length === 0) {
            appContainer.innerHTML = `
                <div style="text-align:center; padding:20px; color:white;">
                    <h2>Database Empty</h2>
                    <p>Please run the Seed function to create the levels.</p>
                    <button class="action-button" onclick="window.seedDatabase()">Seed Database Now</button>
                </div>
            `;
            return;
        }

        let html = `<div class="grid-container">`;
        courses.forEach(course => {
            html += `
                <div class="course-btn" onclick="window.location.hash='#course/${course.id}'">
                    ${course.name}
                </div>
            `;
        });
        html += `</div>`;
        appContainer.innerHTML = html;

    } catch (error) {
        console.error(error);
        appContainer.innerHTML = `<p class="error-message">Error loading courses: ${error.message}</p>`;
    }
}

// ==============================================================================
// 5. VIEW: TABELA DE RECORDES DO CURSO
// ==============================================================================

async function showCourseLeaderboard(courseId) {
    appContainer.innerHTML = '<div class="loader">Loading Course Data...</div>';

    try {
        await loadCourses(); 
        const course = appState.coursesCache.find(c => c.id === courseId);
        
        if (!course) {
            appContainer.innerHTML = '<p class="error-message">Course not found.</p>';
            return;
        }

        const stars = await loadStarsForCourse(courseId);

        // Cabeçalho Verde + Navegação
        let html = `
            <div class="breadcrumb" style="margin-bottom:10px;">
                <a onclick="window.location.hash='#home'" style="color:#aaa; cursor:pointer; text-decoration:none;">
                    &larr; Back to Courses
                </a>
            </div>
            
            <div class="course-header-bar">
                ${course.name}
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Star</th>
                            <th style="text-align:center;">Player</th>
                            <th style="text-align:center;">Real Time</th>
                            <th style="text-align:center;">IGT</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Carrega o melhor tempo (WR) de cada estrela
        const wrPromises = stars.map(star => getBestRunForStar(courseId, star.id));
        const wrResults = await Promise.all(wrPromises);

        stars.forEach((star, index) => {
            const bestRun = wrResults[index];
            
            const playerDisplay = bestRun ? bestRun.runner : "-";
            const igtDisplay = bestRun ? bestRun.igt_str : "-";
            const rtaDisplay = bestRun ? (bestRun.rta_str || "-") : "-";
            
            html += `
                <tr onclick="window.location.hash='#star/${courseId}/${star.id}'" style="cursor:pointer;">
                    <td>${star.name}</td>
                    <td style="color: #fff; text-align:center;">${playerDisplay}</td>
                    <td style="text-align:center;">${rtaDisplay}</td>
                    <td style="color: #ffff00; text-align:center; font-weight:bold;">${igtDisplay}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        appContainer.innerHTML = html;

    } catch (error) {
        console.error("Error rendering course:", error);
        appContainer.innerHTML = `<p class="error-message">Error loading course data.</p>`;
    }
}

// ==============================================================================
// 6. VIEW: DETALHES DA ESTRELA E HISTÓRICO
// ==============================================================================

async function showStarHistory(courseId, starId) {
    appContainer.innerHTML = '<div class="loader">Loading History...</div>';

    try {
        await loadCourses();
        const course = appState.coursesCache.find(c => c.id === courseId);
        const stars = await loadStarsForCourse(courseId);
        const star = stars.find(s => s.id === starId);

        if (!course || !star) {
            appContainer.innerHTML = '<p class="error-message">Star not found.</p>';
            return;
        }

        // Busca histórico (verificado ou obsoleto)
        const q = query(
            collection(db, 'courses', courseId, 'stars', starId, 'runs'),
            where('status', 'in', ['verified', 'obsolete']),
            orderBy('igt_numeric', 'asc')
        );

        const snapshot = await getDocs(q);
        let allRuns = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const currentWR = allRuns.length > 0 ? allRuns[0] : null;

        let html = `
            <div class="breadcrumb" style="margin-bottom:10px;">
                <a onclick="window.location.hash='#course/${courseId}'" style="color:#aaa; cursor:pointer; text-decoration:none;">
                    &larr; Back to ${course.name}
                </a>
            </div>
            
            <div class="course-header-bar">
                ${star.name}
            </div>
        `;

        // Embed do Vídeo
        if (currentWR && currentWR.videoLink) {
            const embedUrl = parseYouTubeEmbed(currentWR.videoLink);
            if (embedUrl) {
                html += `
                <div class="video-container">
                    <div class="video-wrapper">
                        <iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    </div>
                    <div style="padding:10px; background:#050a19; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #333;">
                        <div style="font-size:0.9em; color:#aaa;">${currentWR.date}</div>
                        <div style="font-weight:bold; color:#fff; font-size:1.1em;">${currentWR.runner}</div>
                        <div style="color:#ffff00; font-weight:bold; font-size:1.2em;">${currentWR.igt_str}</div>
                    </div>
                </div>`;
            } else {
                html += `
                <div style="background:#050a19; padding:20px; text-align:center; margin-bottom:20px; border:1px solid #333;">
                    <p>Current WR: <strong>${currentWR.igt_str}</strong> by ${currentWR.runner}</p>
                    <a href="${currentWR.videoLink}" target="_blank" class="action-button">Watch on External Site</a>
                </div>`;
            }
        } else {
            html += `<div style="padding:20px; text-align:center; color:#aaa;">No verified runs yet.</div>`;
        }

        // Tabela de Leaderboard Completa
        html += `
            <div class="course-header-bar" style="margin-top:20px; background: linear-gradient(to bottom, #333, #222); border-color:#444;">
                Leaderboard
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">Rank</th>
                            <th>Player</th>
                            <th>Date</th>
                            <th>Real Time</th>
                            <th>IGT</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (allRuns.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center; padding:20px;">No records found.</td></tr>`;
        } else {
            allRuns.forEach((run, index) => {
                html += `
                    <tr>
                        <td style="text-align:center; color:#aaa;">${index + 1}</td>
                        <td style="font-weight:bold; color:#fff;">${run.runner}</td>
                        <td style="text-align:center; font-size:0.9em; color:#aaa;">${run.date}</td>
                        <td style="text-align:center;">${run.rta_str || "-"}</td>
                        <td style="color: #ffff00; text-align:center; font-weight:bold;">${run.igt_str}</td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table></div>`;
        appContainer.innerHTML = html;

    } catch (error) {
        console.error("Error loading history:", error);
        appContainer.innerHTML = `<p class="error-message">Error loading history details.</p>`;
    }
}

// ==============================================================================
// 7. VIEW: MODERAÇÃO (QUEUE)
// ==============================================================================

async function showModQueuePage() {
    if (!appState.isModerator) { 
        window.location.hash = '#home'; 
        return; 
    }

    appContainer.innerHTML = '<div class="loader">Loading Queue...</div>';

    try {
        const q = query(collectionGroup(db, 'runs'), where('status', '==', 'pending'));
        
        appState.currentListener = onSnapshot(q, (snapshot) => {
            let html = `
                <h2 style="color:var(--accent-green); text-align:center;">Moderation Queue</h2>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Runner</th>
                                <th>Info</th>
                                <th>Time (IGT)</th>
                                <th>Link</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            if (snapshot.empty) {
                html += `<tr><td colspan="5" style="text-align:center; padding:20px;">No pending submissions.</td></tr>`;
            } else {
                snapshot.forEach(docSnap => {
                    const run = docSnap.data();
                    const pathSegments = docSnap.ref.path.split('/');
                    const courseId = pathSegments[1];
                    const starId = pathSegments[3];

                    html += `
                        <tr>
                            <td style="font-weight:bold;">${run.runner}</td>
                            <td>
                                <span style="color:#aaa; font-size:0.8em;">${courseId}</span><br>
                                ${starId}
                            </td>
                            <td style="color:yellow;">${run.igt_str}</td>
                            <td><a href="${run.videoLink}" target="_blank">Video</a></td>
                            <td>
                                <div style="display:flex; gap:5px; justify-content:center;">
                                    <button onclick="window.updateRunStatus('${courseId}','${starId}','${docSnap.id}','verified')" style="background:none; border:1px solid green; color:green; cursor:pointer;">✔</button>
                                    <button onclick="window.deleteRun('${courseId}','${starId}','${docSnap.id}')" style="background:none; border:1px solid red; color:red; cursor:pointer;">✖</button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }

            html += `</tbody></table></div>`;
            appContainer.innerHTML = html;
        });

    } catch (error) {
        console.error(error);
        appContainer.innerHTML = `<p class="error-message">Error loading moderation queue.</p>`;
    }
}

// ==============================================================================
// 8. HELPERS DE DADOS E UTILS
// ==============================================================================

async function loadCourses() {
    if (appState.coursesCache.length > 0) return appState.coursesCache;

    const q = query(collection(db, 'courses'), orderBy('order'));
    const snapshot = await getDocs(q);
    
    appState.coursesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return appState.coursesCache;
}

async function loadStarsForCourse(courseId) {
    if (appState.starsCache[courseId]) return appState.starsCache[courseId];

    const q = query(collection(db, 'courses', courseId, 'stars'), orderBy('order'));
    const snapshot = await getDocs(q);
    
    const stars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    appState.starsCache[courseId] = stars;
    return stars;
}

async function getBestRunForStar(courseId, starId) {
    try {
        const q = query(
            collection(db, 'courses', courseId, 'stars', starId, 'runs'),
            where('status', '==', 'verified'),
            orderBy('igt_numeric', 'asc'),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return snapshot.docs[0].data();
    } catch (e) {
        return null;
    }
}

function parseTimeInput(timeStr) {
    if (!timeStr) return 999999;
    let cleanStr = timeStr.trim().replace(/'/g, ':').replace(/"/g, '.');
    const parts = cleanStr.split(':');
    let seconds = 0;

    if (parts.length === 2) {
        seconds = (parseFloat(parts[0]) * 60) + parseFloat(parts[1]);
    } else if (parts.length === 1) {
        seconds = parseFloat(parts[0]);
    } else {
        return 999999;
    }
    return isNaN(seconds) ? 999999 : seconds;
}

function parseYouTubeEmbed(url) {
    if (!url) return null;
    let videoId = null;
    if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url).search);
        videoId = urlParams.get('v');
    } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('/embed/')) {
        videoId = url.split('/embed/')[1]?.split('?')[0];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

// ==============================================================================
// 9. FUNÇÕES GLOBAIS (EVENT HANDLERS)
// ==============================================================================

window.openSubmissionModal = async function() {
    const courses = await loadCourses();
    const select = document.getElementById('course-select');
    select.innerHTML = '<option value="">Select Course</option>';
    courses.forEach(c => select.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    
    document.getElementById('star-select').innerHTML = '<option value="">Select Star</option>';
    document.getElementById('star-select').disabled = true;
    document.getElementById('submission-form').reset();
    
    document.getElementById('submission-modal').style.display = 'flex';
}

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

window.openLoginModal = function() {
    document.getElementById('login-modal').style.display = 'flex';
}

document.getElementById('course-select')?.addEventListener('change', async (e) => {
    const courseId = e.target.value;
    const starSelect = document.getElementById('star-select');
    if (!courseId) { starSelect.disabled = true; return; }
    
    starSelect.disabled = true; 
    starSelect.innerHTML = '<option>Loading...</option>';
    
    const stars = await loadStarsForCourse(courseId);
    starSelect.innerHTML = '<option value="">Select Star</option>';
    stars.forEach(s => starSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    starSelect.disabled = false;
});

window.handleRunSubmission = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('submit-run-button');
    btn.disabled = true; btn.innerText = "Sending...";

    const courseId = document.getElementById('course-select').value;
    const starId = document.getElementById('star-select').value;
    
    const runData = {
        runner: document.getElementById('runner').value,
        runner_norm: document.getElementById('runner').value.toLowerCase().trim(),
        igt_str: document.getElementById('igt').value,
        rta_str: document.getElementById('rta').value,
        igt_numeric: parseTimeInput(document.getElementById('igt').value),
        date: document.getElementById('date').value,
        videoLink: document.getElementById('videoLink').value,
        status: 'pending',
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'courses', courseId, 'stars', starId, 'runs'), runData);
        alert("Run submitted successfully!");
        window.closeModal('submission-modal');
    } catch (error) {
        alert("Error submitting run: " + error.message);
    } finally {
        btn.disabled = false; btn.innerText = "Submit Run";
    }
}

window.handleLogin = async function(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.closeModal('login-modal');
        document.getElementById('login-error').style.display = 'none';
    } catch (error) {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-error').innerText = "Login failed";
    }
}

window.logout = async function() {
    if(confirm("Log out?")) await signOut(auth);
}

window.updateRunStatus = async function(courseId, starId, runId, status) {
    if (!confirm(`Change status to ${status}?`)) return;
    try {
        const runRef = doc(db, 'courses', courseId, 'stars', starId, 'runs', runId);
        await updateDoc(runRef, { status: status });
    } catch (e) { alert("Error: " + e.message); }
}

window.deleteRun = async function(courseId, starId, runId) {
    if (!confirm("DELETE this run permanently?")) return;
    try {
        const runRef = doc(db, 'courses', courseId, 'stars', starId, 'runs', runId);
        await deleteDoc(runRef);
    } catch (e) { alert("Error: " + e.message); }
}

// ==============================================================================
// 10. SEED DATABASE (TODAS AS FASES E ESTRELAS DO SM64)
// ==============================================================================
window.seedDatabase = async function() {
    if (!confirm("This will create/overwrite ALL SM64 Courses and Stars. Continue?")) return;
    
    console.log("Seeding...");
    const batch = writeBatch(db);

    // ARRAY COMPLETO DE FASES E ESTRELAS
    const coursesData = [
        { 
            id: "bob", name: "Bob-omb Battlefield", order: 1, 
            stars: ["Big Bob-omb on the Summit", "Footrace with Koopa the Quick", "Shoot to the Island in the Sky", "Find the 8 Red Coins", "Mario Wings to the Sky", "Behind Chain Chomp's Gate", "Bob-omb Battlefield 100 Coins"] 
        },
        { 
            id: "wf", name: "Whomp's Fortress", order: 2, 
            stars: ["Chip Off Whomp's Block", "To the Top of the Fortress", "Shoot into the Wild Blue", "Red Coins on the Floating Isle", "Fall onto the Caged Island", "Blast Away the Wall", "Whomp's Fortress 100 Coins"] 
        },
        { 
            id: "jrb", name: "Jolly Roger Bay", order: 3, 
            stars: ["Plunder in the Sunken Ship", "Can the Eel Come Out to Play?", "Treasure of the Ocean Cave", "Red Coins on the Ship Afloat", "Blast to the Stone Pillar", "Through the Jet Stream", "Jolly Roger Bay 100 Coins"] 
        },
        { 
            id: "ccm", name: "Cool, Cool Mountain", order: 4, 
            stars: ["Slip Slidin' Away", "Li'l Penguin Lost", "Big Penguin Race", "Frosty Slide for 8 Red Coins", "Snowman's Lost His Head", "Wall Kicks Will Work", "Cool, Cool Mountain 100 Coins"] 
        },
        { 
            id: "bbh", name: "Big Boo's Haunt", order: 5, 
            stars: ["Go on a Ghost Hunt", "Ride Big Boo's Merry-Go-Round", "Secret of the Haunted Books", "Seek the 8 Red Coins", "Big Boo's Balcony", "Eye to Eye in the Secret Room", "Big Boo's Haunt 100 Coins"] 
        },
        { 
            id: "hmc", name: "Hazy Maze Cave", order: 6, 
            stars: ["Swimming Beast in the Cavern", "Elevate for 8 Red Coins", "Metal-Head Mario Can Move!", "Navigating the Toxic Maze", "A-Maze-Ing Emergency Exit", "Watch for Rolling Rocks", "Hazy Maze Cave 100 Coins"] 
        },
        { 
            id: "lll", name: "Lethal Lava Land", order: 7, 
            stars: ["Boil the Big Bully", "Bully the Bullies", "8-Coin Puzzle with 15 Pieces", "Red-Hot Log Rolling", "Hot-Foot-It into the Volcano", "Elevator Tour in the Volcano", "Lethal Lava Land 100 Coins"] 
        },
        { 
            id: "ssl", name: "Shifting Sand Land", order: 8, 
            stars: ["In the Talons of the Big Bird", "Shining Atop the Pyramid", "Inside the Ancient Pyramid", "Stand Tall on the Four Pillars", "Free Flying for 8 Red Coins", "Pyramid Puzzle", "Shifting Sand Land 100 Coins"] 
        },
        { 
            id: "ddd", name: "Dire, Dire Docks", order: 9, 
            stars: ["Board Bowser's Sub", "Chests in the Current", "Pole-Jumping for Red Coins", "Through the Jet Stream", "The Manta Ray's Reward", "Collect the Caps...", "Dire, Dire Docks 100 Coins"] 
        },
        { 
            id: "sl", name: "Snowman's Land", order: 10, 
            stars: ["Snowman's Big Head", "Chill with the Bully", "In the Deep Freeze", "Whirl from the Freezing Pond", "Shell Shreddin' for Red Coins", "Into the Igloo", "Snowman's Land 100 Coins"] 
        },
        { 
            id: "wdw", name: "Wet-Dry World", order: 11, 
            stars: ["Shocking Arrow Lifts!", "Top O' the Town", "Secrets in the Shallows & Sky", "Express Elevator--Hurry Up!", "Go to Town for Red Coins", "Quick Race Through Downtown!", "Wet-Dry World 100 Coins"] 
        },
        { 
            id: "ttm", name: "Tall, Tall Mountain", order: 12, 
            stars: ["Scale the Mountain", "Mystery of the Monkey Cage", "Scary 'Shrooms, Red Coins", "Mysterious Mountainside", "Breathtaking View from Bridge", "Blast to the Lonely Mushroom", "Tall, Tall Mountain 100 Coins"] 
        },
        { 
            id: "thi", name: "Tiny-Huge Island", order: 13, 
            stars: ["Pluck the Piranha Flower", "The Tip Top of the Huge Island", "Rematch with Koopa the Quick", "Five Itty Bitty Secrets", "Wiggler's Red Coins", "Make Wiggler Squirm", "Tiny-Huge Island 100 Coins"] 
        },
        { 
            id: "ttc", name: "Tick Tock Clock", order: 14, 
            stars: ["Roll into the Cage", "The Pit and the Pendulum", "Get a Hand", "Stomp on the Thwomp", "Timed Jumps on Moving Bars", "Stop Time for Red Coins", "Tick Tock Clock 100 Coins"] 
        },
        { 
            id: "rr", name: "Rainbow Ride", order: 15, 
            stars: ["Cruiser Crossing the Rainbow", "The Big House in the Sky", "Coins Amassed in a Maze", "Swingin' in the Breeze", "Tricky Triangles!", "Somewhere Over the Rainbow", "Rainbow Ride 100 Coins"] 
        },
        { 
            id: "bowser", name: "Bowser Stages", order: 16, 
            stars: ["Bowser in the Dark World", "Bowser in the Fire Sea", "Bowser in the Sky", "Bowser in the Dark World Red Coins", "Bowser in the Fire Sea Red Coins", "Bowser in the Sky Red Coins"] 
        },
        {
            id: "secret", name: "Secret Stages", order: 17,
            stars: ["The Princess's Secret Slide", "The Princess's Secret Slide (under 21s)", "The Secret Aquarium", "Wing Mario over the Rainbow", "Tower of the Wing Cap", "Cavern of the Metal Cap", "Vanish Cap Under the Moat"]
        }
    ];

    try {
        for (const c of coursesData) {
            const courseRef = doc(db, 'courses', c.id);
            batch.set(courseRef, { name: c.name, order: c.order }, { merge: true });
            
            c.stars.forEach((sName, idx) => {
                // Cria ID da estrela seguro (sem caracteres especiais)
                const sId = sName.toLowerCase().replace(/[^a-z0-9]/g, '_');
                const starRef = doc(collection(courseRef, 'stars'), sId);
                batch.set(starRef, { name: sName, order: idx + 1 }, { merge: true });
            });
        }

        await batch.commit();
        alert("Database seeded successfully! Reloading page...");
        window.location.reload();
    } catch (e) {
        console.error(e);
        alert("Seed failed: " + e.message);
    }
}

// ==============================================================================
// 11. INICIALIZAÇÃO
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        appState.currentUser = user;
        appState.isModerator = !!user;
        
        const authSection = document.getElementById('moderator-auth-section');
        
        if (user) {
            authSection.innerHTML = `
                <span style="color:#aaa; font-size:0.8rem; margin-right:5px;">${user.email}</span>
                <a class="action-button" onclick="window.logout()" style="background-color:#d32f2f; color:white;">Logout</a>
            `;
            const nav = document.querySelector('nav');
            if (!nav.innerHTML.includes('Mod Queue')) {
                nav.innerHTML += ` | <a onclick="window.location.hash='#modqueue'" style="color:var(--accent-green); cursor:pointer;">Mod Queue</a>`;
            }
        } else {
            authSection.innerHTML = `
                <a onclick="window.openLoginModal()" style="color:#666; cursor:pointer; font-size:0.8rem; text-decoration:underline;">Mod Login</a>
            `;
        }
        
        if (!user && window.location.hash === '#modqueue') {
            window.location.hash = '#home';
        }
    });

    router();
});

window.addEventListener('hashchange', router);
