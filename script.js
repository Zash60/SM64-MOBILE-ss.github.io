// ==========================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO
// ==========================================
import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    serverTimestamp,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ==========================================
// 2. DADOS ESTÁTICOS (Fases e Estrelas)
// ==========================================
const SM64_DATA = [
    { id: "bob", name: "Bob-omb Battlefield", stars: ["Big Bob-omb on the Summit", "Footrace with Koopa the Quick", "Shoot to the Island in the Sky", "Find the 8 Red Coins", "Mario Wings to the Sky", "Behind Chain Chomp's Gate"] },
    { id: "wf", name: "Whomp's Fortress", stars: ["Chip Off Whomp's Block", "To the Top of the Fortress", "Shoot into the Wild Blue", "Red Coins on the Floating Isle", "Fall onto the Caged Island", "Blast Away the Wall"] },
    { id: "jrb", name: "Jolly Roger Bay", stars: ["Plunder in the Sunken Ship", "Can the Eel Come Out to Play?", "Treasure of the Ocean Cave", "Red Coins on the Ship Afloat", "Blast to the Stone Pillar", "Through the Jet Stream"] },
    { id: "ccm", name: "Cool, Cool Mountain", stars: ["Slip Slidin' Away", "Li'l Penguin Lost", "Big Penguin Race", "Frosty Slide for 8 Red Coins", "Snowman's Lost His Head", "Wall Kicks Will Work"] },
    { id: "bbh", name: "Big Boo's Haunt", stars: ["Go on a Ghost Hunt", "Ride Big Boo's Merry-Go-Round", "Secret of the Haunted Books", "Seek the 8 Red Coins", "Big Boo's Balcony", "Eye to Eye in the Secret Room"] },
    { id: "hmc", name: "Hazy Maze Cave", stars: ["Swimming Beast in the Cavern", "Elevate for 8 Red Coins", "Metal-Head Mario Can Move!", "Navigating the Toxic Maze", "A-Maze-Ing Emergency Exit", "Watch for Rolling Rocks"] },
    { id: "lll", name: "Lethal Lava Land", stars: ["Boil the Big Bully", "Bully the Bullies", "8-Coin Puzzle with 15 Pieces", "Red-Hot Log Rolling", "Hot-Foot-It into the Volcano", "Elevator Tour in the Volcano"] },
    { id: "ssl", name: "Shifting Sand Land", stars: ["In the Talons of the Big Bird", "Shining Atop the Pyramid", "Inside the Ancient Pyramid", "Stand Tall on the Four Pillars", "Free Flying for 8 Red Coins", "Pyramid Puzzle"] },
    { id: "ddd", name: "Dire, Dire Docks", stars: ["Board Bowser's Sub", "Chests in the Current", "Pole-Jumping for Red Coins", "Through the Jet Stream", "The Manta Ray's Reward", "Collect the Caps..."] },
    { id: "sl", name: "Snowman's Land", stars: ["Snowman's Big Head", "Chill with the Bully", "In the Deep Freeze", "Whirl from the Freezing Pond", "Shell Shreddin' for Red Coins", "Into the Igloo"] },
    { id: "wdw", name: "Wet-Dry World", stars: ["Shocking Arrow Lifts!", "Top O' the Town", "Secrets in the Shallows & Sky", "Express Elevator--Hurry Up!", "Go to Town for Red Coins", "Quick Race Through Downtown!"] },
    { id: "ttm", name: "Tall, Tall Mountain", stars: ["Scale the Mountain", "Mystery of the Monkey Cage", "Scary 'Shrooms, Red Coins", "Mysterious Mountainside", "Breathtaking View from Bridge", "Blast to the Lonely Mushroom"] },
    { id: "thi", name: "Tiny-Huge Island", stars: ["Pluck the Piranha Flower", "The Tip Top of the Huge Island", "Rematch with Koopa the Quick", "Five Itty Bitty Secrets", "Wiggler's Red Coins", "Make Wiggler Squirm"] },
    { id: "ttc", name: "Tick Tock Clock", stars: ["Roll into the Cage", "The Pit and the Pendulum", "Get a Hand", "Stomp on the Thwomp", "Timed Jumps on Moving Bars", "Stop Time for Red Coins"] },
    { id: "rr", name: "Rainbow Ride", stars: ["Cruiser Crossing the Rainbow", "The Big House in the Sky", "Coins Amassed in a Maze", "Swingin' in the Breeze", "Tricky Triangles!", "Somewhere Over the Rainbow"] },
    { id: "bowser", name: "Bowser Stages", stars: ["Bowser in the Dark World", "Bowser in the Fire Sea", "Bowser in the Sky"] }
];

// ==========================================
// 3. EXPOR FUNÇÕES PARA O HTML (GLOBAL SCOPE)
// ==========================================
// Necessário porque o type="module" isola o escopo

window.renderCourses = renderCourses;
window.renderStars = renderStars;
window.renderLeaderboard = renderLeaderboard;
window.openSubmissionModal = openSubmissionModal;
window.closeModal = closeModal;
window.handleRunSubmission = handleRunSubmission;
window.handleCourseSelectChange = handleCourseSelectChange;
window.openLoginModal = openLoginModal;
window.handleLogin = handleLogin;
window.logout = logout;
window.renderModQueue = renderModQueue;
window.approveRun = approveRun;
window.rejectRun = rejectRun;

// ==========================================
// 4. LÓGICA DE UI E INICIALIZAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    renderCourses();
    setupAuthListener();
});

function setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
        const authSection = document.getElementById('moderator-auth-section');
        const queueLink = document.getElementById('mod-queue-link-container');
        
        if (user) {
            // Usuário Logado (Moderador)
            authSection.innerHTML = `<span style="margin-right:10px; font-size:0.9em;">Mod: ${user.email}</span><a class="action-button" onclick="logout()">Logout</a>`;
            queueLink.innerHTML = `<a onclick="renderModQueue()" style="color:var(--pending-color);">Mod Queue</a>`;
        } else {
            // Usuário Deslogado
            authSection.innerHTML = `<a class="action-button" onclick="openLoginModal()">Mod Login</a>`;
            queueLink.innerHTML = ``;
        }
    });
}

// --- RENDERIZAÇÃO ---

function renderCourses() {
    const container = document.getElementById('app-container');
    let html = `<h2>Select a Course</h2><div class="grid-container">`;
    
    SM64_DATA.forEach(course => {
        html += `
        <div class="card" onclick="renderStars('${course.id}')">
            <h3>${course.name}</h3>
            <p style="color: var(--secondary-color);">${course.stars.length} Stars</p>
        </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

function renderStars(courseId) {
    const course = SM64_DATA.find(c => c.id === courseId);
    if (!course) return;

    const container = document.getElementById('app-container');
    let html = `
        <div class="breadcrumb">
            <a onclick="renderCourses()">Courses</a> > <span>${course.name}</span>
        </div>
        <h2>${course.name} Stars</h2>
        <div class="grid-container">
    `;

    course.stars.forEach((starName, index) => {
        html += `
        <div class="card" onclick="renderLeaderboard('${course.id}', '${index}')">
            <h3>Star ${index + 1}</h3>
            <p>${starName}</p>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

async function renderLeaderboard(courseId, starIndex) {
    const container = document.getElementById('app-container');
    const course = SM64_DATA.find(c => c.id === courseId);
    const starName = course.stars[starIndex];

    container.innerHTML = `<div class="loader">Loading runs for ${starName}...</div>`;

    try {
        // Busca apenas corridas VERIFICADAS
        const q = query(
            collection(db, "runs"), 
            where("courseId", "==", courseId),
            where("starIndex", "==", starIndex.toString()),
            where("verified", "==", true),
            orderBy("igt", "asc")
        );
        
        const querySnapshot = await getDocs(q);
        
        let html = `
            <div class="breadcrumb">
                <a onclick="renderCourses()">Courses</a> > 
                <a onclick="renderStars('${courseId}')">${course.name}</a> > 
                <span>Star ${parseInt(starIndex) + 1}</span>
            </div>
            <h2>${starName}</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">Rank</th>
                            <th>Runner</th>
                            <th>Time (IGT)</th>
                            <th>Platform</th>
                            <th>Date</th>
                            <th>Video</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (querySnapshot.empty) {
            html += `<tr><td colspan="6" style="text-align:center; padding: 2rem;">No verified runs yet. Be the first!</td></tr>`;
        } else {
            let rank = 1;
            querySnapshot.forEach((doc) => {
                const run = doc.data();
                // Ícone da plataforma (Mobile/PC) se existir
                const platform = run.platform ? run.platform : "Mobile";
                
                html += `
                    <tr>
                        <td>${rank++}</td>
                        <td style="font-weight:bold; color: var(--primary-color);">${run.runner}</td>
                        <td>${run.igt}</td>
                        <td>${platform}</td>
                        <td>${run.date}</td>
                        <td><a href="${run.videoLink}" target="_blank" style="color: var(--accent-color);">Watch</a></td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table></div>`;
        container.innerHTML = html;

    } catch (error) {
        console.error("Error fetching runs:", error);
        container.innerHTML = `<p class="error-message" style="display:block;">Error loading runs: ${error.message}</p>`;
    }
}

// --- MOD QUEUE (Área do Moderador) ---

async function renderModQueue() {
    // Verifica se está logado
    if (!auth.currentUser) {
        alert("You must be logged in as a moderator.");
        return;
    }

    const container = document.getElementById('app-container');
    container.innerHTML = `<div class="loader">Loading submission queue...</div>`;

    try {
        // Busca corridas NÃO VERIFICADAS
        const q = query(
            collection(db, "runs"), 
            where("verified", "==", false),
            orderBy("timestamp", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        
        let html = `
            <div class="breadcrumb"><a onclick="renderCourses()">Back to Home</a></div>
            <h2 style="color: var(--pending-color);">Moderation Queue</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Course / Star</th>
                            <th>Runner</th>
                            <th>Time</th>
                            <th>Video</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (querySnapshot.empty) {
            html += `<tr><td colspan="5" style="text-align:center;">No pending submissions.</td></tr>`;
        } else {
            querySnapshot.forEach((docSnap) => {
                const run = docSnap.data();
                const runId = docSnap.id;
                
                // Encontra nomes legíveis
                const course = SM64_DATA.find(c => c.id === run.courseId);
                const courseName = course ? course.name : run.courseId;
                const starName = course ? `Star ${parseInt(run.starIndex) + 1}` : "";

                html += `
                    <tr id="row-${runId}">
                        <td>
                            <div style="font-weight:bold;">${courseName}</div>
                            <div style="font-size:0.8em; color:var(--secondary-color);">${starName}</div>
                        </td>
                        <td>${run.runner}</td>
                        <td>${run.igt}</td>
                        <td><a href="${run.videoLink}" target="_blank">Link</a></td>
                        <td>
                            <div class="mod-actions">
                                <button onclick="approveRun('${runId}')" style="color: #4caf50; border-color: #4caf50;">✔</button>
                                <button onclick="rejectRun('${runId}')" style="color: #f44336; border-color: #f44336;">✖</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        html += `</tbody></table></div>`;
        container.innerHTML = html;

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p class="error-message">Error loading queue.</p>`;
    }
}

async function approveRun(runId) {
    if(!confirm("Confirm approval?")) return;
    try {
        const runRef = doc(db, "runs", runId);
        await updateDoc(runRef, { verified: true });
        // Remove a linha da tabela visualmente
        document.getElementById(`row-${runId}`).remove();
    } catch (e) {
        alert("Error approving: " + e.message);
    }
}

async function rejectRun(runId) {
    if(!confirm("Confirm rejection? This cannot be undone.")) return;
    try {
        const runRef = doc(db, "runs", runId);
        // Opcional: Delete o documento ou marque como rejected
        await updateDoc(runRef, { verified: "rejected" });
        document.getElementById(`row-${runId}`).remove();
    } catch (e) {
        alert("Error rejecting: " + e.message);
    }
}


// ==========================================
// 5. LÓGICA DE SUBMISSÃO (MODAL)
// ==========================================

function openSubmissionModal() {
    const modal = document.getElementById('submission-modal');
    const courseSelect = document.getElementById('course-select');
    
    // Limpa e popula apenas se necessário
    if (courseSelect.options.length <= 1) {
        SM64_DATA.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = course.name;
            courseSelect.appendChild(option);
        });
    }
    
    modal.style.display = "flex";
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

function handleCourseSelectChange(courseId) {
    const starSelect = document.getElementById('star-select');
    starSelect.innerHTML = '<option value="">Select a Star</option>';
    
    if (!courseId) {
        starSelect.disabled = true;
        return;
    }

    const course = SM64_DATA.find(c => c.id === courseId);
    if(course) {
        course.stars.forEach((star, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Star ${index + 1}: ${star}`;
            starSelect.appendChild(option);
        });
        starSelect.disabled = false;
    }
}

async function handleRunSubmission(event) {
    event.preventDefault();
    const btn = document.getElementById('submit-run-button');
    
    // Prevenção de clique duplo
    btn.disabled = true;
    btn.innerText = "Submitting...";

    const courseId = document.getElementById('course-select').value;
    const starIndex = document.getElementById('star-select').value;
    const runner = document.getElementById('runner').value;
    const igt = document.getElementById('igt').value;
    const rta = document.getElementById('rta').value;
    const date = document.getElementById('date').value;
    const videoLink = document.getElementById('videoLink').value;

    try {
        await addDoc(collection(db, "runs"), {
            courseId,
            starIndex: starIndex.toString(), // Salva como string para consistência
            runner,
            igt,
            rta,
            date,
            videoLink,
            verified: false, // Padrão: pendente de moderação
            platform: "Mobile", // Padrão
            timestamp: serverTimestamp()
        });

        alert("Run submitted successfully! It will appear on the leaderboard after moderator verification.");
        closeModal('submission-modal');
        event.target.reset();
        
        // Resetar selects
        document.getElementById('star-select').innerHTML = '<option value="">Select a Star</option>';
        document.getElementById('star-select').disabled = true;

    } catch (error) {
        console.error("Error adding run: ", error);
        alert("Error submitting run: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Run";
    }
}


// ==========================================
// 6. LÓGICA DE LOGIN (MODERADOR)
// ==========================================

function openLoginModal() {
    document.getElementById('login-modal').style.display = "flex";
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    
    errorMsg.style.display = "none";

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('login-modal');
        // A UI será atualizada automaticamente pelo onAuthStateChanged
        document.getElementById('login-form').reset();
    } catch (error) {
        console.error("Login error:", error);
        errorMsg.textContent = "Invalid email or password.";
        errorMsg.style.display = "block";
    }
}

function logout() {
    signOut(auth).then(() => {
        // Se estiver na fila de moderação, volta pra home
        renderCourses();
    }).catch((error) => {
        console.error(error);
    });
                                    }
