// --- CARICAMENTO DATI ---
let fileSystem = JSON.parse(localStorage.getItem('myPuzzelCloneFS')) || { 'root': [] };
let rawGameStats = JSON.parse(localStorage.getItem('myPuzzelCloneStats')) || [];

// PULIZIA DATI FINTI: Rimuoviamo in automatico tutti i finti salvataggi del 2025
rawGameStats = rawGameStats.filter(stat => !stat.timestamp.startsWith('2025'));

const chartPink = '#eb71b5';

// --- PULIZIA FORZATA DEL DATABASE ---
let fsChanged = false;
for (let folder in fileSystem) {
    let originalLength = fileSystem[folder].length;
    fileSystem[folder] = fileSystem[folder].filter(item => {
        if (item.type === 'activity' && item.name === 'no name given') return false;
        return true;
    });
    if (fileSystem[folder].length !== originalLength) {
        fsChanged = true;
    }
}
if (fsChanged) {
    localStorage.setItem('myPuzzelCloneFS', JSON.stringify(fileSystem));
}

// 1. Esplora il fileSystem partendo SOLO dalla Root per ignorare cartelle eliminate
function getValidActivities() {
    let activities = [];
    let foldersToVisit = ['root'];
    let visited = new Set(['root']);

    while(foldersToVisit.length > 0) {
        let currentFolder = foldersToVisit.pop();
        let items = fileSystem[currentFolder] || [];
        
        items.forEach(item => {
            if (item.type === 'activity') {
                activities.push(item);
            } else if (item.type === 'folder') {
                if (!visited.has(item.id)) {
                    visited.add(item.id);
                    foldersToVisit.push(item.id);
                }
            }
        });
    }
    return activities;
}

const allActivities = getValidActivities();
const validActivityIds = allActivities.map(a => a.id);

// PULIZIA STATISTICHE REALI: Rimuove i salvataggi appartenenti ad attività eliminate
let gameStats = rawGameStats.filter(stat => validActivityIds.includes(stat.activityId));
localStorage.setItem('myPuzzelCloneStats', JSON.stringify(gameStats));


// --- FUNZIONI DI SUPPORTO PER I DATI ---
function getMonthLabel(isoString) {
    const d = new Date(isoString);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const sortKey = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { label: `${month} ${year}`, sortKey: sortKey };
}

function aggregateDataByMonth(statsArray) {
    let countsMap = {}; 

    statsArray.forEach(stat => {
        const dateInfo = getMonthLabel(stat.timestamp);
        if (!countsMap[dateInfo.sortKey]) {
            countsMap[dateInfo.sortKey] = { count: 0, label: dateInfo.label };
        }
        countsMap[dateInfo.sortKey].count += 1;
    });

    const sortedKeys = Object.keys(countsMap).sort();
    
    return {
        labels: sortedKeys.map(k => countsMap[k].label),
        data: sortedKeys.map(k => countsMap[k].count)
    };
}

// --- CONFIGURAZIONE E DISEGNO GRAFICI (Chart.js) ---
let globalChartInstance = null;
let specificChartInstance = null;

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 40 } }
    },
    scales: {
        y: { 
            beginAtZero: true, 
            grid: { color: '#f0f0f0' },
            ticks: { stepSize: 1 } // Niente più decimali
        },
        x: { grid: { display: false } }
    }
};

function renderGlobalChart() {
    const aggregated = aggregateDataByMonth(gameStats);
    const ctx = document.getElementById('globalChart').getContext('2d');

    if (globalChartInstance) globalChartInstance.destroy();

    globalChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: aggregated.labels.length > 0 ? aggregated.labels : ['Nessun dato'],
            datasets: [{
                label: 'sessions',
                data: aggregated.data.length > 0 ? aggregated.data : [0],
                backgroundColor: chartPink,
                barPercentage: 0.6 
            }]
        },
        options: commonChartOptions
    });
}

function renderSpecificChart(activityId, activityName) {
    const filteredStats = gameStats.filter(stat => String(stat.activityId) === String(activityId));
    const aggregated = aggregateDataByMonth(filteredStats);

    document.getElementById('specificChartTitle').innerText = activityName;

    if (specificChartInstance) {
        specificChartInstance.destroy();
    }

    const ctx = document.getElementById('specificChart').getContext('2d');
    specificChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: aggregated.labels.length > 0 ? aggregated.labels : ['Nessun dato'],
            datasets: [{
                label: 'sessions',
                data: aggregated.data.length > 0 ? aggregated.data : [0],
                backgroundColor: chartPink,
                barPercentage: 0.6
            }]
        },
        options: commonChartOptions
    });
}

// --- POPOLAMENTO LISTA LATERALE ---
function renderActivityList() {
    const listEl = document.getElementById('activitiesList');
    listEl.innerHTML = '';

    if (allActivities.length === 0) {
        listEl.innerHTML = '<div style="padding: 20px; color: #888;">Nessuna attività creata.</div>';
        return;
    }

    allActivities.forEach((act, index) => {
        const item = document.createElement('div');
        item.className = 'stats-list-item';
        item.innerHTML = `<strong>${act.name}</strong> <br><span style="color:#666; font-size:12px;">(${act.activityType})</span>`;
        
        item.addEventListener('click', () => {
            document.querySelectorAll('.stats-list-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            renderSpecificChart(act.id, act.name);
        });

        listEl.appendChild(item);

        if (index === 0) {
            item.click();
        }
    });
}

// --- AVVIO INIZIALE ---
renderGlobalChart();
renderActivityList();