import { collection, getDocs, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Acessa as variáveis globais definidas no index.html
const db = window.db;
let GLOBAL_RUNS = []; // Armazena os dados para não precisar recarregar toda hora

// ======================================================
// 1. CONFIGURAÇÃO COMPLETA DAS FASES E ESTRELAS
// ======================================================
const COURSES = [
    {
        id: "bob", name: "1. Bob-omb Battlefield", color: "bg-bob",
        stars: ["Big Bob-omb on the Summit", "Footrace with Koopa the Quick", "Shoot to the Island in the Sky", "Find the 8 Red Coins", "Mario Wings to the Sky", "Behind Chain Chomp's Gate", "Bob-omb Battlefield 100 Coins"]
    },
    {
        id: "wf", name: "2. Whomp's Fortress", color: "bg-wf",
        stars: ["Chip off Whomp's Block", "To the Top of the Fortress", "Shoot into the Wild Blue", "Red Coins on the Floating Isle", "Fall onto the Caged Island", "Blast Away the Wall", "Whomp's Fortress 100 Coins"]
    },
    {
        id: "jrb", name: "3. Jolly Roger Bay", color: "bg-jrb",
        stars: ["Plunder in the Sunken Ship", "Can the Eel Come out to Play?", "Treasure of the Ocean Cave", "Red Coins on the Ship Afloat", "Blast to the Stone Pillar", "Through the Jet Stream", "Jolly Roger Bay 100 Coins"]
    },
    {
        id: "ccm", name: "4. Cool, Cool Mountain", color: "bg-ccm",
        stars: ["Slip Slidin' Away", "Li'l Penguin Lost", "Big Penguin Race", "Frosty Slide for 8 Red Coins", "Snowman's Lost His Head", "Wall Kicks Will Work", "Cool, Cool Mountain 100 Coins"]
    },
    {
        id: "bbh", name: "5. Big Boo's Haunt", color: "bg-bbh",
        stars: ["Go on a Ghost Hunt", "Ride Big Boo's Merry-Go-Round", "Secret of the Haunted Books", "Seek the 8 Red Coins", "Big Boo's Balcony", "Eye to Eye in the Secret Room", "Big Boo's Haunt 100 Coins"]
    },
    {
        id: "hmc", name: "6. Hazy Maze Cave", color: "bg-hmc",
        stars: ["Swimming Beast in the Cavern", "Elevate for 8 Red Coins", "Metal-Head Mario Can Move!", "Navigating the Toxic Maze", "A-Maze-Ing Emergency Exit", "Watch for Rolling Rocks", "Hazy Maze Cave 100 Coins"]
    },
    {
        id: "lll", name: "7. Lethal Lava Land", color: "bg-lll",
        stars: ["Boil the Big Bully", "Bully the Bullies", "8-Coin Puzzle with 15 Pieces", "Red-Hot Log Rolling", "Hot-Foot-It into the Volcano", "Elevator Tour in the Volcano", "Lethal Lava Land 100 Coins"]
    },
    {
        id: "ssl", name: "8. Shifting Sand Land", color: "bg-ssl",
        stars: ["In the Talons of the Big Bird", "Shining Atop the Pyramid", "Inside the Ancient Pyramid", "Stand Tall on the Four Pillars", "Free Flying for 8 Red Coins", "Pyramid Puzzle", "Shifting Sand Land 100 Coins"]
    },
    {
        id: "ddd", name: "9. Dire, Dire Docks", color: "bg-ddd",
        stars: ["Board Bowser's Sub", "Chests in the Current", "Pole-Jumping for Red Coins", "Through the Jet Stream", "The Manta Ray's Reward", "Collect the Caps...", "Dire, Dire Docks 100 Coins"]
    },
    {
        id: "sl", name: "10. Snowman's Land", color: "bg-sl",
        stars: ["Snowman's Big Head", "Chill with the Bully", "In the Deep Freeze", "Whirl from the Freezing Pond", "Shell Shreddin' for Red Coins", "Into the Igloo", "Snowman's Land 100 Coins"]
    },
    {
        id: "wdw", name: "11. Wet-Dry World", color: "bg-wdw",
        stars: ["Shocking Arrow Lifts!", "Top o' the Town", "Secrets in the Shallows & Sky", "Express Elevator--Hurry Up!", "Go to Town for Red Coins", "Quick Race Through Downtown!", "Wet-Dry World 100 Coins"]
    },
    {
        id: "ttm", name: "12. Tall, Tall Mountain", color: "bg-ttm",
        stars: ["Scale the Mountain", "Mystery of the Monkey Cage", "Scary 'Shrooms, Red Coins", "Mysterious Mountainside", "Breathtaking View from Bridge", "Blast to the Lonely Mushroom", "Tall, Tall Mountain 100 Coins"]
    },
    {
        id: "thi", name: "13. Tiny-Huge Island", color: "bg-thi",
        stars: ["Pluck the Piranha Flower", "The Tip Top of the Huge Island", "Rematch with Koopa the Quick", "Five Itty Bitty Secrets", "Wiggler's Red Coins", "Make Wiggler Squirm", "Tiny-Huge Island 100 Coins"]
    },
    {
        id: "ttc", name: "14. Tick Tock Clock", color: "bg-ttc",
        stars: ["Roll into the Cage", "The Pit and the Pendulums", "Get a Hand", "Stomp on the Thwomp", "Timed Jumps on Moving Bars", "Stop Time for Red Coins", "Tick Tock Clock 100 Coins"]
    },
    {
        id: "rr", name: "15. Rainbow Ride", color: "bg-rr",
        stars: ["Cruiser Crossing the Rainbow", "The Big House in the Sky", "Coins Amassed in a Maze", "Swingin' in the Breeze", "Tricky Triangles!", "Somewhere over the Rainbow", "Rainbow Ride 100 Coins"]
    },
    {
        id: "secret", name: "Castle Secret Stars", color: "bg-secret",
        stars: ["The Princess's Secret Slide", "The Princess's Secret Slide Under 21", "The Secret Aquarium", "Tower of the Wing Cap", "Cavern of the Metal Cap", "Vanish Cap under the Moat", "Wing Mario over the Rainbow"]
    },
    {
        id: "bowser", name: "Bowser Courses", color: "bg-bowser",
        stars: ["Bowser in the Dark World Course", "Bowser in the Dark World Red Coins", "Bowser in the Dark World Battle", "Bowser in the Fire Sea Course", "Bowser in the Fire Sea Red Coins", "Bowser in the Fire Sea Battle", "Bowser in the Sky Course", "Bowser in the Sky Red Coins", "Bowser in the Sky Battle"]
    }
];

// ======================================================
// 2. INICIALIZAÇÃO
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupModal();
    loadData(); // Começa carregando os dados
});

// ======================================================
// 3. CARREGAMENTO DE DADOS (FIREBASE)
// ======================================================
async function loadData() {
    const container = document.getElementById('courses-container');
    // Mostra mensagem de carregando
    container.innerHTML = '<div class="loading-msg">Loading World Records from Database...</div>';

    try {
        // Puxa TUDO da coleção 'runs', ordenado por data (mais recente primeiro)
        // Isso facilita montar a Timeline
        const q = query(collection(db, "runs"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        
        GLOBAL_RUNS = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Normalização de dados (Trata campos que podem ter nomes diferentes)
            GLOBAL_RUNS.push({
                id: doc.id,
                courseId: data.courseId,
                star: data.star,
                runner: data.runner,
                // Tenta pegar IGT formatado, se não tiver, pega o IGT puro
                igt: data.igt_str || data.igt || "-", 
                rta: data.rta_str || data.rta || "-",
                date: data.date,
                video: data.videoLink || data.video || "",
                version: data.version || "1.0"
            });
        });

        // Se tudo der certo, renderiza a tela inicial (Courses)
        renderCoursesTable();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        container.innerHTML = '<div class="loading-msg" style="color:#ff6b6b">Error loading data. Please refresh. <br>Check console for details.</div>';
    }
}

// ======================================================
// 4. NAVEGAÇÃO (SISTEMA DE ABAS)
// ======================================================
window.switchView = (viewName) => {
    // 1. Esconde todas as telas
    document.getElementById('view-courses').style.display = 'none';
    document.getElementById('view-timeline').style.display = 'none';
    document.getElementById('view-star-detail').style.display = 'none';
    
    // 2. Remove classe 'active' dos botões do menu
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    // 3. Mostra a tela escolhida e ativa o menu correspondente
    if (viewName === 'courses') {
        document.getElementById('view-courses').style.display = 'block';
        // Assume que o primeiro link é 'Courses'
        const navLink = document.querySelector('nav a[onclick="switchView(\'courses\')"]');
        if(navLink) navLink.classList.add('active');
        renderCoursesTable();
    } 
    else if (viewName === 'timeline') {
        document.getElementById('view-timeline').style.display = 'block';
        const navLink = document.querySelector('nav a[onclick="switchView(\'timeline\')"]');
        if(navLink) navLink.classList.add('active');
        renderTimeline();
    }
};

function setupNavigation() {
    // Garante que começa na Home
    switchView('courses');
}

// ======================================================
// 5. RENDERIZAR TELA: COURSES (HOME)
// ======================================================
function renderCoursesTable() {
    const container = document.getElementById('courses-container');
    container.innerHTML = '';

    COURSES.forEach(course => {
        let rowsHTML = '';
        
        course.stars.forEach(starName => {
            // Filtra todas as runs dessa estrela
            const starRuns = GLOBAL_RUNS.filter(r => r.courseId === course.id && r.star === starName);
            
            // Ordena para achar o WR (Melhor tempo primeiro)
            // Obs: Comparação de string simples ("1:10" vs "1:20") funciona para formatos fixos.
            starRuns.sort((a, b) => a.igt.localeCompare(b.igt));
            
            const wr = starRuns[0]; // O primeiro da lista é o WR

            if (wr) {
                // Cria linha clicável que leva aos detalhes
                rowsHTML += `
                <tr onclick="openStarDetail('${course.id}', '${starName}')" style="cursor: pointer;">
                    <td>${starName}</td>
                    <td>${wr.runner}</td>
                    <td>${wr.rta}</td>
                    <td>${wr.igt}</td>
                    <td>${wr.version}</td>
                    <td>${formatDate(wr.date)}</td>
                </tr>`;
            } else {
                rowsHTML += `
                <tr>
                    <td>${starName}</td>
                    <td colspan="5" style="color:#555">-</td>
                </tr>`;
            }
        });

        // Monta o card da fase
        const sectionHTML = `
            <div class="course-section">
                <div class="course-header ${course.color}">
                    ${course.name}
                </div>
                <div class="table-responsive">
                    <table class="records-table">
                        <thead>
                            <tr>
                                <th>Star</th>
                                <th>Player</th>
                                <th>Real Time</th>
                                <th>IGT</th>
                                <th>Version</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML += sectionHTML;
    });
}

// ======================================================
// 6. RENDERIZAR TELA: TIMELINE (FEED)
// ======================================================
function renderTimeline() {
    const feedContainer = document.getElementById('timeline-feed');
    feedContainer.innerHTML = '';

    // Como GLOBAL_RUNS já veio ordenado por data do Firebase, pegamos os primeiros 50
    const recentRuns = GLOBAL_RUNS.slice(0, 50);

    if (recentRuns.length === 0) {
        feedContainer.innerHTML = '<p style="text-align:center; color:#777;">No recent activity.</p>';
        return;
    }

    recentRuns.forEach(run => {
        // Acha o nome bonito da fase
        const courseObj = COURSES.find(c => c.id === run.courseId);
        const courseName = courseObj ? courseObj.name : run.courseId;

        const cardHTML = `
            <div class="timeline-card">
                <div class="timeline-icon">
                    <i class="fas fa-trophy"></i> <!-- Ícone de troféu -->
                </div>
                <div class="timeline-content">
                    <h4>[Run] ${courseName}</h4>
                    <p>
                        <span class="highlight">@${run.runner}</span> completed 
                        <span class="highlight">${run.star}</span><br>
                        Time: <b>${run.igt}</b> (RT: ${run.rta}) - Version ${run.version}
                    </p>
                    <div class="timeline-date">
                        ${formatDate(run.date)}
                    </div>
                </div>
            </div>
        `;
        feedContainer.innerHTML += cardHTML;
    });
}

// ======================================================
// 7. RENDERIZAR TELA: DETALHES DA ESTRELA
// ======================================================
window.openStarDetail = (courseId, starName) => {
    // Troca a visualização
    document.getElementById('view-courses').style.display = 'none';
    document.getElementById('view-timeline').style.display = 'none';
    document.getElementById('view-star-detail').style.display = 'block';

    const contentDiv = document.getElementById('star-detail-content');
    
    // 1. Pega dados dessa estrela
    const starRuns = GLOBAL_RUNS.filter(r => r.courseId === courseId && r.star === starName);
    
    // 2. Separa o WR (Melhor Tempo) para mostrar o vídeo
    // Ordena por tempo (Ascendente)
    const sortedByTime = [...starRuns].sort((a, b) => a.igt.localeCompare(b.igt));
    const currentWR = sortedByTime[0]; // Melhor tempo

    // 3. Ordena por Data (Descendente) para a tabela de histórico
    const historyRuns = [...starRuns].sort((a, b) => b.date.localeCompare(a.date));

    // 4. Configura Cabeçalho
    const courseObj = COURSES.find(c => c.id === courseId);
    const bgClass = courseObj ? courseObj.color : 'bg-bob';

    // 5. Monta Embed do YouTube (se tiver WR e link)
    let videoHTML = '<div style="text-align:center; padding:20px; color:#666;">No video available</div>';
    if (currentWR && currentWR.video) {
        const ytId = getYoutubeId(currentWR.video);
        if (ytId) {
            videoHTML = `
                <div class="video-container">
                    <iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen></iframe>
                </div>
                <div style="text-align:center; margin-bottom:20px; font-size:1.1rem;">
                     WR by <b>${currentWR.runner}</b> in <b>${currentWR.igt}</b>
                </div>
            `;
        }
    }

    // 6. Monta Tabela de Histórico
    let historyRows = '';
    historyRuns.forEach(run => {
        historyRows += `
            <tr>
                <td>${formatDate(run.date)}</td>
                <td>${run.runner}</td>
                <td>${run.rta}</td>
                <td>${run.igt}</td>
                <td>${run.version}</td>
            </tr>
        `;
    });

    // Renderiza tudo
    contentDiv.innerHTML = `
        <div class="course-section" style="border:none; box-shadow:none; background:transparent;">
            <div class="detail-header ${bgClass}">
                ${starName}
            </div>
            
            ${videoHTML}

            <div class="history-header">History Log</div>
            <div class="table-responsive">
                <table class="records-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Player</th>
                            <th>Real Time</th>
                            <th>IGT</th>
                            <th>Version</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${historyRows || '<tr><td colspan="5">No records found for this star.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

// ======================================================
// 8. UTILITÁRIOS
// ======================================================
function formatDate(dateString) {
    if (!dateString) return "";
    // Converte YYYY-MM-DD para MM/DD/YYYY ou DD/MM/YYYY conforme preferir
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`; // Formato US: MM/DD/YYYY
    }
    return dateString;
}

function getYoutubeId(url) {
    if (!url) return null;
    // Regex para pegar ID do Youtube (suporta youtu.be, watch?v=, embed, etc)
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// ======================================================
// 9. MODAL E SUBMISSÃO
// ======================================================
function setupModal() {
    // Abrir Modal
    window.openSubmissionModal = () => {
        const modal = document.getElementById('submission-modal');
        modal.style.display = 'flex';
        
        // Preencher Select de Cursos
        const select = document.getElementById('course-select');
        select.innerHTML = '<option value="">Select Course</option>';
        COURSES.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            select.appendChild(opt);
        });
    };

    // Lógica do Select (Habilitar Estrelas quando escolher Curso)
    document.getElementById('course-select').addEventListener('change', (e) => {
        const courseId = e.target.value;
        const starSelect = document.getElementById('star-select');
        
        starSelect.innerHTML = '<option value="">Select Star</option>';
        starSelect.disabled = true;

        const course = COURSES.find(c => c.id === courseId);
        if (course) {
            starSelect.disabled = false;
            course.stars.forEach(star => {
                const opt = document.createElement('option');
                opt.value = star;
                opt.textContent = star;
                starSelect.appendChild(opt);
            });
        }
    });

    // Fechar Modal
    window.closeModal = (id) => {
        document.getElementById(id).style.display = 'none';
    };

    // Clicar fora fecha modal
    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    };
}

// Enviar Run para o Firebase
window.handleRunSubmission = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-run-button');
    const originalText = btn.innerText;
    
    btn.disabled = true;
    btn.innerText = "Sending...";

    // Captura dados do form
    const newRun = {
        courseId: document.getElementById('course-select').value,
        star: document.getElementById('star-select').value,
        runner: document.getElementById('runner').value,
        igt: document.getElementById('igt').value,       // In-Game Time
        rta: document.getElementById('rta').value,       // Real Time
        version: document.getElementById('version').value || "1.0",
        date: document.getElementById('date').value,
        videoLink: document.getElementById('videoLink').value,
        submittedAt: new Date().toISOString()
    };

    try {
        // Salva no Firestore
        await addDoc(collection(db, "runs"), newRun);
        
        alert("Run submitted successfully!");
        window.closeModal('submission-modal');
        document.getElementById('submission-form').reset();
        
        // Recarrega os dados para aparecer na tela
        loadData(); 

    } catch (err) {
        console.error("Error submitting:", err);
        alert("Error submitting run. Check console.");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
