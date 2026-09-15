import { db } from './firebase-init.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

const chartPink = '#eb71b5';

// --- CARICAMENTO DATI DA FIRESTORE ---
async function loadData() {
    // Filesystem (per recuperare i nomi delle attività)
    const fsSnap = await getDocs(collection(db, 'filesystem'));
    const fileSystem = {};
    fsSnap.forEach(d => { fileSystem[d.id] = d.data().items || []; });

    // Stats di gioco
    const statsSnap = await getDocs(collection(db, 'gameStats'));
    const rawStats  = [];
    statsSnap.forEach(d => rawStats.push(d.data()));

    return { fileSystem, rawStats };
}

// Raccoglie ricorsivamente tutte le attività valide partendo dalla root
function getValidActivities(fileSystem) {
    const activities = [];
    const visited    = new Set(['root']);
    const queue      = ['root'];
    while (queue.length > 0) {
        const fid   = queue.shift();
        const items = fileSystem[fid] || [];
        items.forEach(item => {
            if (item.type === 'activity' && item.name !== 'no name given') {
                activities.push(item);
            } else if (item.type === 'folder' && !visited.has(item.id)) {
                visited.add(item.id);
                queue.push(item.id);
            }
        });
    }
    return activities;
}

// --- SUPPORTO ---
function getMonthLabel(isoString) {
    const d          = new Date(isoString);
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const sortKey    = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return { label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, sortKey };
}

function aggregateDataByMonth(statsArray) {
    const countsMap = {};
    statsArray.forEach(stat => {
        const { label, sortKey } = getMonthLabel(stat.timestamp);
        if (!countsMap[sortKey]) countsMap[sortKey] = { count: 0, label };
        countsMap[sortKey].count += 1;
    });
    const keys = Object.keys(countsMap).sort();
    return { labels: keys.map(k => countsMap[k].label), data: keys.map(k => countsMap[k].count) };
}

// --- GRAFICI ---
let globalChartInstance   = null;
let specificChartInstance = null;

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 40 } } },
    scales: {
        y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { stepSize: 1 } },
        x: { grid: { display: false } }
    }
};

function renderGlobalChart(gameStats) {
    const { labels, data } = aggregateDataByMonth(gameStats);
    const ctx = document.getElementById('globalChart').getContext('2d');
    if (globalChartInstance) globalChartInstance.destroy();
    globalChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['Nessun dato'],
            datasets: [{ label: 'sessions', data: data.length > 0 ? data : [0], backgroundColor: chartPink, barPercentage: 0.6 }]
        },
        options: commonChartOptions
    });
}

function renderSpecificChart(gameStats, activityId, activityName) {
    const filtered = gameStats.filter(s => String(s.activityId) === String(activityId));
    const { labels, data } = aggregateDataByMonth(filtered);
    document.getElementById('specificChartTitle').innerText = activityName;
    if (specificChartInstance) specificChartInstance.destroy();
    const ctx = document.getElementById('specificChart').getContext('2d');
    specificChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['Nessun dato'],
            datasets: [{ label: 'sessions', data: data.length > 0 ? data : [0], backgroundColor: chartPink, barPercentage: 0.6 }]
        },
        options: commonChartOptions
    });
}

function renderActivityList(gameStats, allActivities) {
    const listEl = document.getElementById('activitiesList');
    listEl.innerHTML = '';
    if (allActivities.length === 0) {
        listEl.innerHTML = '<div style="padding: 20px; color: #888;">Nessuna attività creata.</div>';
        return;
    }
    allActivities.forEach((act, index) => {
        const item = document.createElement('div');
        item.className = 'stats-list-item';
        item.innerHTML = `<strong>${act.name}</strong><br><span style="color:#666;font-size:12px;">(${act.activityType})</span>`;
        item.addEventListener('click', () => {
            document.querySelectorAll('.stats-list-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            renderSpecificChart(gameStats, act.id, act.name);
        });
        listEl.appendChild(item);
        if (index === 0) item.click();
    });
}

// --- AVVIO ---
async function init() {
    const { fileSystem, rawStats } = await loadData();
    const allActivities  = getValidActivities(fileSystem);
    const validIds       = new Set(allActivities.map(a => a.id));
    const gameStats      = rawStats.filter(s => validIds.has(s.activityId));

    renderGlobalChart(gameStats);
    renderActivityList(gameStats, allActivities);
}
init();
