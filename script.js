import { collection, getDocs, addDoc, query, orderBy, where, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const db = window.db;
const auth = window.auth;

// Variáveis Globais
let GLOBAL_RUNS = []; 
let IS_MOD = false;

// --- CONFIGURAÇÃO DAS FASES ---
const COURSES = [
    { id: "bob", name: "1. Bob-omb Battlefield", color: "bg-bob", stars: ["Big Bob-omb on the Summit", "Footrace with Koopa the Quick", "Shoot to the Island in the Sky", "Find the 8 Red Coins", "Mario Wings to the Sky", "Behind Chain Chomp's Gate", "Bob-omb Battlefield 100 Coins"] },
    { id: "wf", name: "2. Whomp's Fortress", color: "bg-wf", stars: ["Chip off Whomp's Block", "To the Top of the Fortress", "Shoot into the Wild Blue", "Red Coins on the Floating Isle", "Fall onto the Caged Island", "Blast Away the Wall", "Whomp's Fortress 100 Coins"] },
    { id: "jrb", name: "3. Jolly Roger Bay", color: "bg-jrb", stars: ["Plunder in the Sunken Ship", "Can the Eel Come out to Play?", "Treasure of the Ocean Cave", "Red Coins on the Ship Afloat", "Blast to the Stone Pillar", "Through the Jet Stream", "Jolly Roger Bay 100 Coins"] },
    { id: "ccm", name: "4. Cool, Cool Mountain", color: "bg-ccm", stars: ["Slip Slidin' Away", "Li'l Penguin Lost", "Big Penguin Race", "Frosty Slide for 8 Red Coins", "Snowman's Lost His Head", "Wall Kicks Will Work", "Cool, Cool Mountain 100 Coins"] },
    { id: "bbh", name: "5. Big Boo's Haunt", color: "bg-bbh", stars: ["Go on a Ghost Hunt", "Ride Big Boo's Merry-Go-Round", "Secret of the Haunted Books", "Seek the 8 Red Coins", "Big Boo's Balcony", "Eye to Eye in the Secret Room", "Big Boo's Haunt 100 Coins"] },
    { id: "hmc", name: "6. Hazy Maze Cave", color: "bg-hmc", stars: ["Swimming Beast in the Cavern", "Elevate for 8 Red Coins", "Metal-Head Mario Can Move!", "Navigating the Toxic Maze", "A-Maze-Ing Emergency Exit", "Watch for Rolling Rocks", "Hazy Maze Cave 100 Coins"] },
    { id: "lll", name: "7. Lethal Lava Land", color: "bg-lll", stars: ["Boil the Big Bully", "Bully the Bullies", "8-Coin Puzzle with 15 Pieces", "Red-Hot Log Rolling", "Hot-Foot-It into the Volcano", "Elevator Tour in the Volcano", "Lethal Lava Land 100 Coins"] },
    { id: "ssl", name: "8. Shifting Sand Land", color: "bg-ssl", stars: ["In the Talons of the Big Bird", "Shining Atop the Pyramid", "Inside the Ancient Pyramid", "Stand Tall on the Four Pillars", "Free Flying for 8 Red Coins", "Pyramid Puzzle", "Shifting Sand Land 100 Coins"] },
    { id: "ddd", name: "9. Dire, Dire Docks", color: "bg-ddd", stars: ["Board Bowser's Sub", "Chests in the Current", "Pole-Jumping for Red Coins", "Through the Jet Stream", "The Manta Ray's Reward", "Collect the Caps...", "Dire, Dire Docks 100 Coins"] },
    { id: "sl", name: "10. Snowman's Land", color: "bg-sl", stars: ["Snowman's Big Head", "Chill with the Bully", "In the Deep Freeze", "Whirl from the Freezing Pond", "Shell Shreddin' for Red Coins", "Into the Igloo", "Snowman's Land 100 Coins"] },
    { id: "wdw", name: "11. Wet-Dry World", color: "bg-wdw", stars: ["Shocking Arrow Lifts!", "Top o' the Town", "Secrets in the Shallows & Sky", "Express Elevator--Hurry Up!", "Go to Town for Red Coins", "Quick Race Through Downtown!", "Wet-Dry World 100 Coins"] },
    { id: "ttm", name: "12. Tall, Tall Mountain", color: "bg-ttm", stars: ["Scale the Mountain", "Mystery of the Monkey Cage", "Scary 'Shrooms, Red Coins", "Mysterious Mountainside", "Breathtaking View from Bridge", "Blast to the Lonely Mushroom", "Tall, Tall Mountain 100 Coins"] },
    { id: "thi", name: "13. Tiny-Huge Island", color: "bg-thi", stars: ["Pluck the Piranha Flower", "The Tip Top of the Huge Island", "Rematch with Koopa the Quick", "Five Itty Bitty Secrets", "Wiggler's Red Coins", "Make Wiggler Squirm", "Tiny-Huge Island 100 Coins"] },
    { id: "ttc", name: "14. Tick Tock Clock", color: "bg-ttc", stars: ["Roll into the Cage", "The Pit and the Pendulums", "Get a Hand", "Stomp on the Thwomp", "Timed Jumps on Moving Bars", "Stop Time for Red Coins", "Tick Tock Clock 100 Coins"] },
    { id: "rr", name: "15. Rainbow Ride", color: "bg-rr", stars: ["Cruiser Crossing the Rainbow", "The Big House in the Sky", "Coins Amassed in a Maze", "Swingin' in the Breeze", "Tricky Triangles!", "Somewhere over the Rainbow", "Rainbow Ride 100 Coins"] },
    { id: "secret", name: "Castle Secret Stars", color: "bg-secret", stars: ["The Princess's Secret Slide", "The Princess's Secret Slide Under 21", "The Secret Aquarium", "Tower of the Wing Cap", "Cavern of the Metal Cap", "Vanish Cap under the Moat", "Wing Mario over the Rainbow"] },
    { id: "bowser", name: "Bowser Courses", color: "bg-bowser", stars: ["Bowser in the Dark World Course", "Bowser in the Dark World Red Coins", "Bowser in the Dark World Battle", "Bowser in the Fire Sea Course", "Bowser in the Fire Sea Red Coins", "Bowser in the Fire Sea Battle", "Bowser in the Sky Course", "Bowser in the Sky Red Coins", "Bowser in the Sky Battle"] }
];

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupModal();
    setupAuth();
    loadData(); 
});

// --- AUTH & MOD CHECK ---
function setupAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            IS_MOD = true;
            document.getElementById('mod-link').style.display = 'inline-block'; // Mostra aba mod
            document.getElementById('login-btn-text').innerText = 'Logout';
            document.querySelector('.login-btn').onclick = handleLogout;
            loadModQueue(); // Carrega fila
        } else {
            IS_MOD = false;
            document.getElementById('mod-link').style.display = 'none';
            document.getElementById('login-btn-text').innerText = 'Mod Login';
            document.querySelector('.login-btn').onclick = window.openLoginModal;
            switchView('courses'); // Se deslogar na aba mod, volta pra home
        }
    });
}

// --- CARREGAR DADOS (Somente Verificados) ---
async function loadData() {
    const container = document.getElementById('courses-container');
    container.innerHTML = '<div style="color:white;text-align:center;padding:20px">Loading Records...</div>';

    try {
        // Só carrega runs que foram aprovadas (status == 'verified')
        const q = query(collection(db, "runs"), where("status", "==", "verified"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        
        GLOBAL_RUNS = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            GLOBAL_RUNS.push({ ...d, id: doc.id });
        });

        renderCoursesTable();

    } catch (err) {
        console.error("Erro:", err);
        container.innerHTML = '<div style="color:red;text-align:center">Error loading data. <br>Make sure you deleted the old database collections.</div>';
    }
}

// --- CARREGAR FILA DE MODERAÇÃO (Somente Pendentes) ---
async function loadModQueue() {
    if (!IS_MOD) return;
    const qList = document.getElementById('mod-queue-list');
    qList.innerHTML = 'Loading pending runs...';

    try {
        const q = query(collection(db, "runs"), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            qList.innerHTML = '<p style="text-align:center;color:#777">No pending runs.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const r = doc.data();
            html += `
                <div class="mod-card" id="card-${doc.id}">
                    <div class="mod-info">
                        <h4 style="margin:0;color:#87CEEB">${r.courseId} - ${r.star}</h4>
                        <p style="margin:5px 0;color:#ccc">
                            Player: <b>${r.runner}</b> | IGT: <b>${r.igt}</b> | RTA: ${r.rta}<br>
                            Date: ${r.date} | Ver: ${r.version}<br>
                            Video: <a href="${r.videoLink}" target="_blank" style="color:#2ecc71">Link</a>
                        </p>
                    </div>
                    <div class="mod-actions">
                        <button class="btn-approve" onclick="verifyRun('${doc.id}')">Approve</button>
                        <button class="btn-reject" onclick="rejectRun('${doc.id}')">Reject</button>
                    </div>
                </div>
            `;
        });
        qList.innerHTML = html;
    } catch (e) {
        console.error(e);
        qList.innerHTML = 'Error loading queue.';
    }
}

// --- AÇÕES DE MODERAÇÃO ---
window.verifyRun = async (id) => {
    if(!confirm("Approve this run?")) return;
    try {
        await updateDoc(doc(db, "runs", id), { status: "verified" });
        document.getElementById(`card-${id}`).remove();
        loadData(); // Atualiza a tabela principal
    } catch (e) { alert("Error approving."); }
};

window.rejectRun = async (id) => {
    if(!confirm("Reject (DELETE) this run?")) return;
    try {
        await deleteDoc(doc(db, "runs", id)); // Deleta para não poluir
        document.getElementById(`card-${id}`).remove();
    } catch (e) { alert("Error rejecting."); }
};

// --- NAVEGAÇÃO ---
window.switchView = (viewName) => {
    document.querySelectorAll('main > div').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    if(viewName === 'courses') {
        document.getElementById('view-courses').style.display = 'block';
        renderCoursesTable();
    } else if (viewName === 'timeline') {
        document.getElementById('view-timeline').style.display = 'block';
        renderTimeline();
    } else if (viewName === 'mod') {
        document.getElementById('view-mod').style.display = 'block';
        loadModQueue();
    }
    
    // Ativa link
    const link = document.querySelector(`a[onclick="switchView('${viewName}')"]`);
    if(link) link.classList.add('active');
};

function setupNavigation() { switchView('courses'); }

// --- RENDERIZADORES (Home, Timeline, Detail) ---
function renderCoursesTable() {
    const container = document.getElementById('courses-container');
    container.innerHTML = '';

    COURSES.forEach(course => {
        let rows = '';
        course.stars.forEach(starName => {
            const starRuns = GLOBAL_RUNS.filter(r => r.courseId === course.id && r.star === starName);
            // Ordena por IGT (String compare simples)
            starRuns.sort((a, b) => a.igt.localeCompare(b.igt));
            const wr = starRuns[0];

            if (wr) {
                rows += `
                <tr onclick="openStarDetail('${course.id}', '${starName}')">
                    <td>${starName}</td>
                    <td>${wr.runner}</td>
                    <td>${wr.rta}</td>
                    <td>${wr.igt}</td>
                    <td>${wr.version}</td>
                    <td>${formatDate(wr.date)}</td>
                </tr>`;
            } else {
                rows += `<tr><td>${starName}</td><td colspan="5" style="color:#555">-</td></tr>`;
            }
        });

        container.innerHTML += `
            <div class="course-section">
                <div class="course-header ${course.color}">${course.name}</div>
                <div class="table-responsive">
                    <table class="records-table">
                        <thead><tr><th>Star</th><th>Player</th><th>RT</th><th>IGT</th><th>Ver</th><th>Date</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    });
}

function renderTimeline() {
    const feed = document.getElementById('timeline-feed');
    feed.innerHTML = '';
    const recent = GLOBAL_RUNS.slice(0, 50); // Já está ordenado por data no loadData
    
    if(recent.length === 0) { feed.innerHTML = '<p style="text-align:center">No verified runs yet.</p>'; return; }

    recent.forEach(r => {
        const cName = COURSES.find(c => c.id === r.courseId)?.name || r.courseId;
        feed.innerHTML += `
            <div class="timeline-card">
                <div class="timeline-icon"><i class="fas fa-trophy"></i></div>
                <div class="timeline-content">
                    <h4>[New WR] ${cName}</h4>
                    <p><span class="highlight">${r.runner}</span> - ${r.star}<br>Time: <b>${r.igt}</b> (RT: ${r.rta})</p>
                    <div class="timeline-date">${formatDate(r.date)}</div>
                </div>
            </div>`;
    });
}

window.openStarDetail = (cId, sName) => {
    window.switchView('detail'); // Hack simples, ou use display none manuais
    document.getElementById('view-courses').style.display = 'none';
    document.getElementById('view-timeline').style.display = 'none';
    document.getElementById('view-mod').style.display = 'none';
    document.getElementById('view-star-detail').style.display = 'block';

    const content = document.getElementById('star-detail-content');
    const runs = GLOBAL_RUNS.filter(r => r.courseId === cId && r.star === sName);
    
    // WR para vídeo (menor tempo)
    const wr = [...runs].sort((a,b) => a.igt.localeCompare(b.igt))[0];
    // Histórico (data decrescente)
    const history = [...runs].sort((a,b) => b.date.localeCompare(a.date));
    
    const cColor = COURSES.find(c => c.id === cId)?.color || 'bg-bob';
    
    let vidHtml = '<p style="text-align:center;padding:20px">No video</p>';
    if(wr && wr.videoLink) {
        const yId = wr.videoLink.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/)([^#&?]*))/)?.[1];
        if(yId) vidHtml = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${yId}" frameborder="0" allowfullscreen></iframe></div>`;
    }

    let rows = '';
    history.forEach(r => {
        rows += `<tr><td>${formatDate(r.date)}</td><td>${r.runner}</td><td>${r.rta}</td><td>${r.igt}</td><td>${r.version}</td></tr>`;
    });

    content.innerHTML = `
        <div class="course-section" style="background:none;border:none;box-shadow:none">
            <div class="detail-header ${cColor}">${sName}</div>
            ${vidHtml}
            <div class="history-header">History</div>
            <div class="table-responsive">
                <table class="records-table">
                    <thead><tr><th>Date</th><th>Player</th><th>RT</th><th>IGT</th><th>Ver</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="5">No records</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;
};

// --- MODAL, LOGIN & SUBMIT ---
function setupModal() {
    window.openSubmissionModal = () => {
        const sel = document.getElementById('course-select');
        sel.innerHTML = '<option value="">Select Course</option>';
        COURSES.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id; opt.textContent = c.name;
            sel.appendChild(opt);
        });
        document.getElementById('submission-modal').style.display = 'flex';
    };
    document.getElementById('course-select').addEventListener('change', (e) => {
        const sSel = document.getElementById('star-select');
        sSel.innerHTML = '<option value="">Select Star</option>'; sSel.disabled = true;
        const c = COURSES.find(x => x.id === e.target.value);
        if(c) { sSel.disabled = false; c.stars.forEach(s => sSel.appendChild(new Option(s, s))); }
    });
    window.closeModal = (id) => document.getElementById(id).style.display = 'none';
    window.openLoginModal = () => document.getElementById('login-modal').style.display = 'flex';
}

window.handleLogin = async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        window.closeModal('login-modal');
    } catch (err) { alert("Login failed: " + err.message); }
};

const handleLogout = () => signOut(auth);

window.handleRunSubmission = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-run-button');
    btn.innerText = "Sending..."; btn.disabled = true;
    
    const data = {
        courseId: document.getElementById('course-select').value,
        star: document.getElementById('star-select').value,
        runner: document.getElementById('runner').value,
        igt: document.getElementById('igt').value,
        rta: document.getElementById('rta').value || "-",
        version: document.getElementById('version').value || "1.0",
        date: document.getElementById('date').value,
        videoLink: document.getElementById('videoLink').value,
        status: "pending", // IMPORTANTE: Começa como pendente
        submittedAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "runs"), data);
        alert("Run submitted for moderation!");
        window.closeModal('submission-modal');
        document.getElementById('submission-form').reset();
    } catch(err) { alert("Error."); console.error(err); }
    btn.innerText = "Submit Run"; btn.disabled = false;
};

function formatDate(d) { if(!d)return""; const p=d.split('-'); return p.length===3?`${p[1]}/${p[2]}/${p[0]}`:d; }
