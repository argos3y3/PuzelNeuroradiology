// --- INIZIALIZZAZIONE E STATO ---
let fileSystem = JSON.parse(localStorage.getItem('myPuzzelCloneFS')) || { 'root': [] };
let currentViewingFolderId = localStorage.getItem('puzzelDashboardState') || 'root'; 

// --- ELEMENTI DOM ---
const tbody = document.getElementById('activitiesTableBody');
const btnCreateActivityTop = document.getElementById('btnCreateActivityTop');
const btnCreateActivityBody = document.getElementById('btnCreateActivityBody');
const btnSelectFolder = document.getElementById('btnSelectFolder');
const dashboardSearch = document.getElementById('dashboardSearch');

const selectFolderModal = document.getElementById('selectFolderModal');
const btnCancelSelectFolder = document.getElementById('btnCancelSelectFolder');
const btnShowAllActivities = document.getElementById('btnShowAllActivities');
const folderListEl = document.getElementById('folderList');

const createActivityModal = document.getElementById('createActivityModal');
const btnCloseCreateActivity = document.getElementById('btnCloseCreateActivity');
const activitySearch = document.getElementById('activitySearch');
const activityOptionsGrid = document.getElementById('activityOptions');
const optionCrucitomo = document.getElementById('optionCrucitomo');
const optionImpiccato = document.getElementById('optionImpiccato');
const activityDetailView = document.getElementById('activityDetailView');
const detailTitle = document.getElementById('detailTitle');
const detailDesc = document.getElementById('detailDesc');
const btnStartBuilding = document.getElementById('btnStartBuilding');

const activityActionsModal = document.getElementById('activityActionsModal');
const btnCloseActivityActions = document.getElementById('btnCloseActivityActions');
const btnCopyActivity = document.getElementById('btnCopyActivity');
const btnDeleteActivity = document.getElementById('btnDeleteActivity');

const btnExportData = document.getElementById('btnExportData');
const btnImportData = document.getElementById('btnImportData');
const importFileInput = document.getElementById('importFileInput');

let selectedActivityTemplate = null;
let targetActivityId = null;
let targetFolderId = null;

// --- FUNZIONI DI SUPPORTO ---
function saveState() {
    localStorage.setItem('myPuzzelCloneFS', JSON.stringify(fileSystem));
}

function formattaData(date) {
    const d = new Date(date);
    const giorno = String(d.getDate()).padStart(2, '0');
    const mese = String(d.getMonth() + 1).padStart(2, '0');
    const anno = d.getFullYear();
    const ore = String(d.getHours()).padStart(2, '0');
    const minuti = String(d.getMinutes()).padStart(2, '0');
    return `${giorno}-${mese}-${anno} ${ore}:${minuti}`;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

// --- MODALE "CREATE ACTIVITY" ---
function openCreateActivityModal() {
    createActivityModal.style.display = 'flex';
    selectedActivityTemplate = null;
    activityDetailView.style.display = 'none';
    activityOptionsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)'; 
    if (optionCrucitomo) optionCrucitomo.classList.remove('selected');
    if (optionImpiccato) optionImpiccato.classList.remove('selected');
    activitySearch.value = '';
    activitySearch.focus();
    filterActivityOptions();
}

function closeCreateActivityModal() {
    createActivityModal.style.display = 'none';
}

function selectActivityOption(optionElement, title, desc, templateKey) {
    if (optionCrucitomo) optionCrucitomo.classList.remove('selected');
    if (optionImpiccato) optionImpiccato.classList.remove('selected');
    optionElement.classList.add('selected');
    selectedActivityTemplate = { key: templateKey, title: title };
    activityDetailView.style.display = 'flex';
    detailTitle.textContent = title;
    detailDesc.textContent = desc;
}

function createNewActivity() {
    if (!selectedActivityTemplate) return;
    const directoryDestinazione = currentViewingFolderId;
    window.location.href = `editor.html?type=${selectedActivityTemplate.key}&folder=${directoryDestinazione}`;
}

function filterActivityOptions() {
    const searchText = activitySearch.value.toLowerCase().trim();
    const options = [optionCrucitomo, optionImpiccato];
    options.forEach(option => {
        if (!option) return;
        const name = option.querySelector('.option-name').textContent.toLowerCase();
        if (name.includes(searchText) || searchText === '') {
            option.style.display = 'flex';
        } else {
            option.style.display = 'none';
        }
    });
}

// --- MODALE "SELECT FOLDER" ---
function openSelectFolderModal() {
    renderFolderListForSelection();
    selectFolderModal.style.display = 'flex';
}

function closeSelectFolderModal() {
    selectFolderModal.style.display = 'none';
}

function showAllActivities() {
    currentViewingFolderId = 'root'; 
    localStorage.setItem('puzzelDashboardState', 'root');
    closeSelectFolderModal();
    renderTable(); 
}

function getAllFolders() {
    let allFolders = [];
    for (const folderId in fileSystem) {
        const items = fileSystem[folderId] || [];
        items.forEach(item => {
            if (item.type === 'folder') {
                allFolders.push(item);
            }
        });
    }
    return allFolders;
}

function renderFolderListForSelection() {
    folderListEl.innerHTML = '';
    const folders = getAllFolders();
    if (folders.length === 0) { 
        folderListEl.innerHTML = '<li style="padding: 10px; color: #888;">Nessun folder creato.</li>';
        return;
    }
    folders.forEach(folder => {
        const li = document.createElement('li');
        li.className = 'folder-list-item';
        const color = folder.color || '#e5e7eb';
        li.innerHTML = `<div style="width: 16px; height: 16px; background-color: ${color}; border-radius: 4px;"></div> ${folder.name}`;
        li.addEventListener('click', () => {
            currentViewingFolderId = folder.id;
            localStorage.setItem('puzzelDashboardState', folder.id);
            renderTable(); 
            closeSelectFolderModal();
        });
        folderListEl.appendChild(li);
    });
}

// --- TABELLA PRINCIPALE ---
function getActivitiesToRender() {
    let activities = [];
    function getFolderName(searchFolderId) {
        if (searchFolderId === 'root') return "Home";
        for (const parentId in fileSystem) {
            const folderObj = (fileSystem[parentId] || []).find(f => f.type === 'folder' && f.id === searchFolderId);
            if (folderObj) return folderObj.name;
        }
        return "Sconosciuta";
    }

    if (currentViewingFolderId === 'root') {
        for (const folderId in fileSystem) {
            const items = fileSystem[folderId] || [];
            const actsInFolder = items.filter(item => item.type === 'activity');
            const folderName = getFolderName(folderId);
            actsInFolder.forEach(act => {
                act.parentFolderName = folderName; 
                activities.push(act);
            });
        }
    } else {
        const items = fileSystem[currentViewingFolderId] || [];
        const actsInFolder = items.filter(item => item.type === 'activity');
        const folderName = getFolderName(currentViewingFolderId);
        actsInFolder.forEach(act => {
            act.parentFolderName = folderName;
            activities.push(act);
        });
    }
    return activities;
}

function getViewingContextName() {
    if (currentViewingFolderId === 'root') return "Tutte le attività";
    for (const folderId in fileSystem) {
        const items = fileSystem[folderId] || [];
        const folder = items.find(item => item.type === 'folder' && item.id === currentViewingFolderId);
        if (folder) return folder.name;
    }
    return "Cartella";
}

function renderTable() {
    tbody.innerHTML = ''; 
    const activities = getActivitiesToRender();
    const contextName = getViewingContextName();
    
    if (activities.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Nessuna attività è stata creata in "${contextName}".</td></tr>`;
        return;
    }

    activities.sort((a, b) => {
        const dateA = new Date(a.date.split(' ').reverse().join(' ')); 
        const dateB = new Date(b.date.split(' ').reverse().join(' '));
        return dateB - dateA;
    });

    activities.forEach(act => {
        const tr = document.createElement('tr');
        const actionIcons = `
            <div class="action-icons">
                <img src="https://img.icons8.com/material-outlined/18/22c55e/play.png" alt="play icon" title="Gioca" onclick="window.location.href='game.html?id=${act.id}'"/>
                <img src="https://img.icons8.com/material-outlined/18/aaaaaa/share.png" alt="share icon" title="Condividi"/>
                <img src="https://img.icons8.com/material-outlined/18/aaaaaa/more.png" alt="more icon" title="Altro" onclick="openActivityActionsModal('${act.id}')"/>
            </div>
        `;
        tr.innerHTML = `
            <td>${act.date}</td>
            <td>${act.name}</td>
            <td class="activity-type">${act.activityType}</td>
            <td style="color: #888; font-size: 13px;">${act.parentFolderName}</td> 
            <td>${actionIcons}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterDashboardTable() {
    const searchText = dashboardSearch.value.toLowerCase().trim();
    const rows = tbody.querySelectorAll('tr:not(.empty-message)');
    rows.forEach(row => {
        const name = row.cells[1].textContent.toLowerCase();
        const type = row.cells[2].textContent.toLowerCase();
        if (name.includes(searchText) || type.includes(searchText) || searchText === '') {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

// --- MODALE AZIONI (COPY / DELETE) ---
function findActivityLocation(actId) {
    for (const folderId in fileSystem) {
        const act = fileSystem[folderId].find(item => item.id === actId);
        if (act) return { folderId, activity: act };
    }
    return null;
}

window.openActivityActionsModal = function(actId) {
    const location = findActivityLocation(actId);
    if (!location) return;
    targetActivityId = actId;
    targetFolderId = location.folderId;
    activityActionsModal.style.display = 'flex';
};

function closeActivityActionsModal() {
    activityActionsModal.style.display = 'none';
    targetActivityId = null;
    targetFolderId = null;
}

// --- EVENT LISTENERS (CLICK E INPUT) ---
if (btnCreateActivityTop) btnCreateActivityTop.addEventListener('click', openCreateActivityModal);
if (btnCreateActivityBody) btnCreateActivityBody.addEventListener('click', openCreateActivityModal);
if (btnCloseCreateActivity) btnCloseCreateActivity.addEventListener('click', closeCreateActivityModal);

if (optionCrucitomo) {
    optionCrucitomo.addEventListener('click', () => selectActivityOption(optionCrucitomo, "Crucitomo", "Crea un cruciverba classico. Inserisci le definizioni e le parole per generare automaticamente la griglia.", "crossword"));
}
if (optionImpiccato) { 
    optionImpiccato.addEventListener('click', () => {
        if (optionCrucitomo) optionCrucitomo.classList.remove('selected');
        optionImpiccato.classList.add('selected');
        selectActivityOption(optionImpiccato, "Il tempo è tiranno", "Il classico gioco dell'impiccato. Inserisci la parola misteriosa da far indovinare.", "hangman");
    });
}

if (activitySearch) activitySearch.addEventListener('input', filterActivityOptions);
if (btnStartBuilding) btnStartBuilding.addEventListener('click', createNewActivity);

if (btnSelectFolder) btnSelectFolder.addEventListener('click', openSelectFolderModal);
if (btnCancelSelectFolder) btnCancelSelectFolder.addEventListener('click', closeSelectFolderModal);
if (btnShowAllActivities) btnShowAllActivities.addEventListener('click', showAllActivities);
if (dashboardSearch) dashboardSearch.addEventListener('input', filterDashboardTable);

if (btnCloseActivityActions) btnCloseActivityActions.addEventListener('click', closeActivityActionsModal);

if (btnCopyActivity) {
    btnCopyActivity.addEventListener('click', () => {
        const location = findActivityLocation(targetActivityId);
        if (!location) return;
        const newActivity = JSON.parse(JSON.stringify(location.activity));
        newActivity.id = 'a_' + Date.now();
        newActivity.date = formattaData(new Date());
        
        const baseNameMatch = newActivity.name.match(/^(.*?)(?:\s\((\d+)\))?$/);
        const coreName = baseNameMatch[1];
        let maxIndex = 0;
        
        const folderItems = fileSystem[targetFolderId] || [];
        folderItems.forEach(item => {
            if (item.type === 'activity') {
                if (item.name === coreName && maxIndex < 1) maxIndex = 1;
                const match = item.name.match(new RegExp(`^${escapeRegExp(coreName)}\\s\\((\\d+)\\)$`));
                if (match) {
                    const idx = parseInt(match[1]);
                    if (idx >= maxIndex) maxIndex = idx;
                }
            }
        });
        
        newActivity.name = `${coreName} (${maxIndex > 0 ? maxIndex + 1 : 1})`;
        fileSystem[targetFolderId].push(newActivity);
        saveState();
        renderTable();
        closeActivityActionsModal();
    });
}

if (btnDeleteActivity) {
    btnDeleteActivity.addEventListener('click', () => {
        if (!targetFolderId || !targetActivityId) return;
        fileSystem[targetFolderId] = fileSystem[targetFolderId].filter(item => item.id !== targetActivityId);
        saveState();
        renderTable();
        closeActivityActionsModal();
    });
}

window.addEventListener('click', (e) => {
    if (e.target === createActivityModal) closeCreateActivityModal();
    if (e.target === selectFolderModal) closeSelectFolderModal();
    if (e.target === activityActionsModal) closeActivityActionsModal();
});

// BACKUP & RESTORE
if (btnExportData) {
    btnExportData.addEventListener('click', () => {
        const backupData = {
            fs: localStorage.getItem('myPuzzelCloneFS'),
            stats: localStorage.getItem('myPuzzelCloneStats')
        };
        const blob = new Blob([JSON.stringify(backupData)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'il_mio_database_puzzel.json'; 
        a.click();
        URL.revokeObjectURL(url);
    });
}

if (btnImportData) {
    btnImportData.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if(data.fs) localStorage.setItem('myPuzzelCloneFS', data.fs);
                if(data.stats) localStorage.setItem('myPuzzelCloneStats', data.stats);
                alert('Database ripristinato con successo!');
                location.reload(); 
            } catch(err) {
                alert('Errore: Il file selezionato non è valido o è corrotto.');
            }
        };
        reader.readAsText(file);
    });
}

// --- AVVIO INIZIALE ---
renderTable();