import { getFirestore, collection, getDocs, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// Instâncias globais (já definidas no index.html, mas garantindo acesso)
const db = window.db;
const auth = window.auth;

// --- LISTA COMPLETA DE FASES E ESTRELAS ---
const COURSES_DATA = [
    {
        id: "bob", name: "1. Bob-omb Battlefield", colorClass: "bg-bob",
        stars: ["Big Bob-omb on the Summit", "Footrace with Koopa the Quick", "Shoot to the Island in the Sky", "Find the 8 Red Coins", "Mario Wings to the Sky", "Behind Chain Chomp's Gate", "Bob-omb Battlefield 100 Coins"]
    },
    {
        id: "wf", name: "2. Whomp's Fortress", colorClass: "bg-wf",
        stars: ["Chip off Whomp's Block", "To the Top of the Fortress", "Shoot into the Wild Blue", "Red Coins on the Floating Isle", "Fall onto the Caged Island", "Blast Away the Wall", "Whomp's Fortress 100 Coins"]
    },
    {
        id: "jrb", name: "3. Jolly Roger Bay", colorClass: "bg-jrb",
        stars: ["Plunder in the Sunken Ship", "Can the Eel Come out to Play?", "Treasure of the Ocean Cave", "Red Coins on the Ship Afloat", "Blast to the Stone Pillar", "Through the Jet Stream", "Jolly Roger Bay 100 Coins"]
    },
    {
        id: "ccm", name: "4. Cool, Cool Mountain", colorClass: "bg-ccm",
        stars: ["Slip Slidin' Away", "Li'l Penguin Lost", "Big Penguin Race", "Frosty Slide for 8 Red Coins", "Snowman's Lost His Head", "Wall Kicks Will Work", "Cool, Cool Mountain 100 Coins"]
    },
    {
        id: "bbh", name: "5. Big Boo's Haunt", colorClass: "bg-bbh",
        stars: ["Go on a Ghost Hunt", "Ride Big Boo's Merry-Go-Round", "Secret of the Haunted Books", "Seek the 8 Red Coins", "Big Boo's Balcony", "Eye to Eye in the Secret Room", "Big Boo's Haunt 100 Coins"]
    },
    {
        id: "hmc", name: "6. Hazy Maze Cave", colorClass: "bg-hmc",
        stars: ["Swimming Beast in the Cavern", "Elevate for 8 Red Coins", "Metal-Head Mario Can Move!", "Navigating the Toxic Maze", "A-Maze-Ing Emergency Exit", "Watch for Rolling Rocks", "Hazy Maze Cave 100 Coins"]
    },
    {
        id: "lll", name: "7. Lethal Lava Land", colorClass: "bg-lll",
        stars: ["Boil the Big Bully", "Bully the Bullies", "8-Coin Puzzle with 15 Pieces", "Red-Hot Log Rolling", "Hot-Foot-It into the Volcano", "Elevator Tour in the Volcano", "Lethal Lava Land 100 Coins"]
    },
    {
        id: "ssl", name: "8. Shifting Sand Land", colorClass: "bg-ssl",
        stars: ["In the Talons of the Big Bird", "Shining Atop the Pyramid", "Inside the Ancient Pyramid", "Stand Tall on the Four Pillars", "Free Flying for 8 Red Coins", "Pyramid Puzzle", "Shifting Sand Land 100 Coins"]
    },
    {
        id: "ddd", name: "9. Dire, Dire Docks", colorClass: "bg-ddd",
        stars: ["Board Bowser's Sub", "Chests in the Current", "Pole-Jumping for Red Coins", "Through the Jet Stream", "The Manta Ray's Reward", "Collect the Caps...", "Dire, Dire Docks 100 Coins"]
    },
    {
        id: "sl", name: "10. Snowman's Land", colorClass: "bg-sl",
        stars: ["Snowman's Big Head", "Chill with the Bully", "In the Deep Freeze", "Whirl from the Freezing Pond", "Shell Shreddin' for Red Coins", "Into the Igloo", "Snowman's Land 100 Coins"]
    },
    {
        id: "wdw", name: "11. Wet-Dry World", colorClass: "bg-wdw",
        stars: ["Shocking Arrow Lifts!", "Top o' the Town", "Secrets in the Shallows & Sky", "Express Elevator--Hurry Up!", "Go to Town for Red Coins", "Quick Race Through Downtown!", "Wet-Dry World 100 Coins"]
    },
    {
        id: "ttm", name: "12. Tall, Tall Mountain", colorClass: "bg-ttm",
        stars: ["Scale the Mountain", "Mystery of the Monkey Cage", "Scary 'Shrooms, Red Coins", "Mysterious Mountainside", "Breathtaking View from Bridge", "Blast to the Lonely Mushroom", "Tall, Tall Mountain 100 Coins"]
    },
    {
        id: "thi", name: "13. Tiny-Huge Island", colorClass: "bg-thi",
        stars: ["Pluck the Piranha Flower", "The Tip Top of the Huge Island", "Rematch with Koopa the Quick", "Five Itty Bitty Secrets", "Wiggler's Red Coins", "Make Wiggler Squirm", "Tiny-Huge Island 100 Coins"]
    },
    {
        id: "ttc", name: "14. Tick Tock Clock", colorClass: "bg-ttc",
        stars: ["Roll into the Cage", "The Pit and the Pendulums", "Get a Hand", "Stomp on the Thwomp", "Timed Jumps on Moving Bars", "Stop Time for Red Coins", "Tick Tock Clock 100 Coins"]
    },
    {
        id: "rr", name: "15. Rainbow Ride", colorClass: "bg-rr",
        stars: ["Cruiser Crossing the Rainbow", "The Big House in the Sky", "Coins Amassed in a Maze", "Swingin' in the Breeze", "Tricky Triangles!", "Somewhere over the Rainbow", "Rainbow Ride 100 Coins"]
    },
    {
        id: "css", name: "Castle Secret Stars", colorClass: "bg-secret",
        stars: ["The Princess's Secret Slide", "The Princess's Secret Slide Under 21", "The Secret Aquarium", "Tower of the Wing Cap", "Cavern of the Metal Cap", "Vanish Cap under the Moat", "Wing Mario over the Rainbow"]
    },
    {
        id: "bowser", name: "Bowser Courses", colorClass: "bg-bowser",
        stars: ["Bowser in the Dark World Course", "Bowser in the Dark World Red Coins", "Bowser in the Dark World Battle", "Bowser in the Fire Sea Course", "Bowser in the Fire Sea Red Coins", "Bowser in the Fire Sea Battle", "Bowser in the Sky Course", "Bowser in the Sky Red Coins", "Bowser in the Sky Battle"]
    }
];

// --- INÍCIO ---
document.addEventListener('DOMContentLoaded', () => {
    loadWorldRecords();
    setupModalListeners();
});

// --- CARREGAR DADOS ---
async function loadWorldRecords() {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = '<div style="color:white; text-align:center; padding:20px;">Loading Data...</div>';

    try {
        const q = query(collection(db, "runs"), orderBy("igt", "asc"));
        const querySnapshot = await getDocs(q);
        
        const allRuns = {};
        
        querySnapshot.forEach((doc) => {
            const run = doc.data();
            const key = `${run.courseId}-${run.star}`;
            
            // Como está ordenado por IGT asc, o primeiro é o WR.
            // Se já existe um WR salvo para essa estrela, ignoramos os próximos (que são piores).
            if (!allRuns[key]) {
                allRuns[key] = run;
            }
        });

        renderApp(allRuns);

    } catch (error) {
        console.error("Error loading runs:", error);
        appContainer.innerHTML = '<div style="color:red; text-align:center;">Error loading data from Firebase. Check console.</div>';
    }
}

// --- RENDERIZAR NA TELA ---
function renderApp(recordsMap) {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = '';

    COURSES_DATA.forEach(course => {
        let rowsHTML = '';

        course.stars.forEach(starName => {
            const key = `${course.id}-${starName}`;
            const wr = recordsMap[key];

            if (wr) {
                rowsHTML += `
                    <tr>
                        <td>${starName}</td>
                        <td>${wr.runner}</td>
                        <td>${wr.rta || '-'}</td>
                        <td>${wr.igt}</td>
                        <td>${wr.version || 'US 1.0'}</td>
                        <td>${formatDate(wr.date)}</td>
                    </tr>
                `;
            } else {
                // Linha Vazia
                rowsHTML += `
                    <tr>
                        <td>${starName}</td>
                        <td colspan="5" style="color: #666;">-</td>
                    </tr>
                `;
            }
        });

        const sectionHTML = `
            <div class="course-section">
                <div class="course-header ${course.colorClass}">
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
        
        appContainer.innerHTML += sectionHTML;
    });
}

// --- FORMATAR DATA ---
function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-'); // Assume YYYY-MM-DD
    if(parts.length === 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY
    }
    return dateStr;
}

// --- MODAIS E FORMULÁRIOS ---
function setupModalListeners() {
    window.openSubmissionModal = () => {
        document.getElementById('submission-modal').style.display = 'flex';
        populateCourseSelect();
    };

    window.closeModal = (id) => {
        document.getElementById(id).style.display = 'none';
    };

    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    };
}

function populateCourseSelect() {
    const select = document.getElementById('course-select');
    select.innerHTML = '<option value="">Select Course</option>';
    
    COURSES_DATA.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
    });

    select.onchange = (e) => {
        const cid = e.target.value;
        const starSelect = document.getElementById('star-select');
        starSelect.innerHTML = '<option value="">Select Star</option>';
        starSelect.disabled = true;

        const course = COURSES_DATA.find(c => c.id === cid);
        if (course) {
            starSelect.disabled = false;
            course.stars.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                starSelect.appendChild(opt);
            });
        }
    };
}

// --- ENVIAR RUN ---
window.handleRunSubmission = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-run-button');
    btn.disabled = true;
    btn.innerText = "Sending...";

    const data = {
        courseId: document.getElementById('course-select').value,
        star: document.getElementById('star-select').value,
        runner: document.getElementById('runner').value,
        igt: document.getElementById('igt').value,
        rta: document.getElementById('rta').value,
        date: document.getElementById('date').value,
        videoLink: document.getElementById('videoLink').value,
        submittedAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "runs"), data);
        alert("Run Submitted!");
        window.closeModal('submission-modal');
        document.getElementById('submission-form').reset();
        loadWorldRecords(); // Recarrega a página
    } catch (err) {
        console.error(err);
        alert("Error submitting run.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Run";
    }
};
