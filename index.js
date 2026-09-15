import { db } from './firebase-init.js';
import {
    collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// --- STATO ---
let fileSystem = { root: [] };
let currentViewingFolderId = localStorage.getItem('puzzelDashboardState') || 'root';

// --- ELEMENTI DOM ---
const tbody                = document.getElementById('activitiesTableBody');
const btnCreateActivityBody = document.getElementById('btnCreateActivityBody');
const btnSelectFolder       = document.getElementById('btnSelectFolder');
const dashboardSearch       = document.getElementById('dashboardSearch');

const selectFolderModal     = document.getElementById('selectFolderModal');
const btnCancelSelectFolder = document.getElementById('btnCancelSelectFolder');
const btnShowAllActivities  = document.getElementById('btnShowAllActivities');
const folderListEl          = document.getElementById('folderList');

const createActivityModal   = document.getElementById('createActivityModal');
const btnCloseCreateActivity = document.getElementById('btnCloseCreateActivity');
const activitySearch        = document.getElementById('activitySearch');
const activityOptionsGrid   = document.getElementById('activityOptions');
const optionCrucitomo       = document.getElementById('optionCrucitomo');
const optionImpiccato       = document.getElementById('optionImpiccato');
const activityDetailView    = document.getElementById('activityDetailView');
const detailTitle           = document.getElementById('detailTitle');
const detailDesc            = document.getElementById('detailDesc');
const btnStartBuilding      = document.getElementById('btnStartBuilding');

const optionTrovaIntruso    = document.getElementById('optionTrovaIntruso');
const optionRadiazione      = document.getElementById('optionRadiazione');
const optionSeConosci       = document.getElementById('optionSeConosci');
const optionPassaESpassa    = document.getElementById('optionPassaESpassa');
const optionGuessWhat       = document.getElementById('optionGuessWhat');
const activityActionsModal  = document.getElementById('activityActionsModal');
const btnCloseActivityActions = document.getElementById('btnCloseActivityActions');
const btnCopyActivity       = document.getElementById('btnCopyActivity');
const btnEditActivity       = document.getElementById('btnEditActivity');
const btnDeleteActivity     = document.getElementById('btnDeleteActivity');

const btnExportData         = document.getElementById('btnExportData');
const btnImportData         = document.getElementById('btnImportData');
const importFileInput       = document.getElementById('importFileInput');

let selectedActivityTemplate = null;
let targetActivityId = null;
let targetFolderId   = null;

// --- FIRESTORE ---
async function loadFileSystem() {
    const snap = await getDocs(collection(db, 'filesystem'));
    const fs = {};
    snap.forEach(d => { fs[d.id] = d.data().items || []; });
    if (!fs.root) fs.root = [];
    return fs;
}

async function saveState() {
    const batch = writeBatch(db);
    for (const fid in fileSystem) {
        batch.set(doc(db, 'filesystem', fid), { items: fileSystem[fid] || [] });
    }
    await batch.commit();
}

// --- UTILITIES ---
function formattaData(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    [optionCrucitomo, optionImpiccato, optionTrovaIntruso, optionRadiazione, optionSeConosci, optionPassaESpassa, optionGuessWhat]
        .forEach(o => o?.classList.remove('selected'));
    activitySearch.value = '';
    activitySearch.focus();
    filterActivityOptions();
}

function closeCreateActivityModal() {
    createActivityModal.style.display = 'none';
}

function selectActivityOption(optionElement, title, desc, templateKey) {
    [optionCrucitomo, optionImpiccato, optionTrovaIntruso, optionRadiazione, optionSeConosci, optionPassaESpassa, optionGuessWhat]
        .forEach(o => o?.classList.remove('selected'));
    optionElement.classList.add('selected');
    selectedActivityTemplate = { key: templateKey, title };
    activityDetailView.style.display = 'flex';
    detailTitle.textContent = title;
    detailDesc.textContent  = desc;
}

function createNewActivity() {
    if (!selectedActivityTemplate) return;
    window.location.href = `editor.html?type=${selectedActivityTemplate.key}&folder=${currentViewingFolderId}`;
}

function filterActivityOptions() {
    const searchText = activitySearch.value.toLowerCase().trim();
    [optionCrucitomo, optionImpiccato, optionTrovaIntruso, optionRadiazione, optionSeConosci, optionPassaESpassa, optionGuessWhat]
        .forEach(option => {
            if (!option) return;
            const name = option.querySelector('.option-name').textContent.toLowerCase();
            option.style.display = (name.includes(searchText) || searchText === '') ? 'flex' : 'none';
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
    const allFolders = [];
    for (const folderId in fileSystem) {
        (fileSystem[folderId] || []).forEach(item => {
            if (item.type === 'folder') allFolders.push(item);
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
function getFolderName(searchFolderId) {
    if (searchFolderId === 'root') return "Home";
    for (const parentId in fileSystem) {
        const folderObj = (fileSystem[parentId] || []).find(f => f.type === 'folder' && f.id === searchFolderId);
        if (folderObj) return folderObj.name;
    }
    return "Sconosciuta";
}

function collectActivitiesRecursive(folderId, out) {
    (fileSystem[folderId] || []).forEach(item => {
        if (item.type === 'activity') {
            out.push({ ...item, parentFolderName: getFolderName(folderId) });
        } else if (item.type === 'folder') {
            collectActivitiesRecursive(item.id, out);
        }
    });
}

function getActivitiesToRender() {
    let activities = [];
    if (currentViewingFolderId === 'root') {
        for (const folderId in fileSystem) {
            (fileSystem[folderId] || []).filter(item => item.type === 'activity').forEach(act => {
                act.parentFolderName = getFolderName(folderId);
                activities.push(act);
            });
        }
    } else {
        collectActivitiesRecursive(currentViewingFolderId, activities);
    }
    return activities;
}

function getViewingContextName() {
    if (currentViewingFolderId === 'root') return "Tutte le attività";
    for (const folderId in fileSystem) {
        const folder = (fileSystem[folderId] || []).find(item => item.type === 'folder' && item.id === currentViewingFolderId);
        if (folder) return folder.name;
    }
    return "Cartella";
}

function renderTable() {
    tbody.innerHTML = '';
    const activities    = getActivitiesToRender();
    const contextName   = getViewingContextName();

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
                <img src="https://img.icons8.com/material-outlined/18/22c55e/play.png" alt="play" title="Gioca" onclick="window.location.href='game.html?id=${act.id}'"/>
                <img src="https://img.icons8.com/material-outlined/18/aaaaaa/pencil.png" alt="edit" title="Modifica" onclick="window.location.href='editor.html?id=${act.id}'"/>
                <img src="https://img.icons8.com/material-outlined/18/aaaaaa/more.png" alt="more" title="Altro" onclick="openActivityActionsModal('${act.id}')"/>
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
    tbody.querySelectorAll('tr:not(.empty-message)').forEach(row => {
        const name = row.cells[1]?.textContent.toLowerCase() || '';
        const type = row.cells[2]?.textContent.toLowerCase() || '';
        row.style.display = (name.includes(searchText) || type.includes(searchText) || searchText === '') ? 'table-row' : 'none';
    });
}

// --- MODALE AZIONI ---
function findActivityLocation(actId) {
    for (const folderId in fileSystem) {
        const act = fileSystem[folderId].find(item => item.id === actId);
        if (act) return { folderId, activity: act };
    }
    return null;
}

window.openActivityActionsModal = function(actId) {
    const loc = findActivityLocation(actId);
    if (!loc) return;
    targetActivityId = actId;
    targetFolderId   = loc.folderId;
    activityActionsModal.style.display = 'flex';
};

function closeActivityActionsModal() {
    activityActionsModal.style.display = 'none';
    targetActivityId = null;
    targetFolderId   = null;
}

// --- EVENT LISTENERS ---
if (btnCreateActivityBody) btnCreateActivityBody.addEventListener('click', openCreateActivityModal);
if (btnCloseCreateActivity) btnCloseCreateActivity.addEventListener('click', closeCreateActivityModal);

[
    [optionCrucitomo,    "Crucitomo",              "Crea un cruciverba classico.",                                          "crossword"],
    [optionImpiccato,    "Il tempo è tiranno",      "Il classico gioco dell'impiccato.",                                    "hangman"],
    [optionTrovaIntruso, "Trova l'Intruso",          "Carica le immagini e contrassegna quelle 'intruse'.",                  "trova-intruso"],
    [optionRadiazione,   "Radiazione a Catena",      "Quiz a scelta multipla.",                                              "radiazione-a-catena"],
    [optionSeConosci,    "Se Conosci...Riconosci",   "Cruciverba con immagini come indizi.",                                 "se-conosci-riconosci"],
    [optionPassaESpassa, "Passa e Spassa",            "Completa le frasi inserendo le parole mancanti.",                     "passa-e-spassa"],
    [optionGuessWhat,    "Guess What",               "Carica un'immagine e posiziona etichette numerate.",                  "guess-what"],
].forEach(([el, title, desc, key]) => {
    el?.addEventListener('click', () => selectActivityOption(el, title, desc, key));
});

if (activitySearch)         activitySearch.addEventListener('input', filterActivityOptions);
if (btnStartBuilding)       btnStartBuilding.addEventListener('click', createNewActivity);
if (btnSelectFolder)        btnSelectFolder.addEventListener('click', openSelectFolderModal);
if (btnCancelSelectFolder)  btnCancelSelectFolder.addEventListener('click', closeSelectFolderModal);
if (btnShowAllActivities)   btnShowAllActivities.addEventListener('click', showAllActivities);
if (dashboardSearch)        dashboardSearch.addEventListener('input', filterDashboardTable);
if (btnCloseActivityActions) btnCloseActivityActions.addEventListener('click', closeActivityActionsModal);

if (btnCopyActivity) {
    btnCopyActivity.addEventListener('click', async () => {
        const loc = findActivityLocation(targetActivityId);
        if (!loc) return;

        // Carica dati completi dall'activities collection se l'elemento è solo metadata
        let sourceData = JSON.parse(JSON.stringify(loc.activity));
        const hasContent = sourceData.words || sourceData.images || sourceData.questions ||
                           sourceData.phrases || sourceData.image;
        if (!hasContent) {
            const snap = await getDoc(doc(db, 'activities', targetActivityId)).catch(() => null);
            if (snap?.exists()) sourceData = { ...snap.data(), id: snap.id };
        }

        const newId = 'a_' + Date.now();
        const coreName = sourceData.name.match(/^(.*?)(?:\s\((\d+)\))?$/)[1];
        let maxIndex = 0;
        (fileSystem[targetFolderId] || []).forEach(item => {
            if (item.type === 'activity') {
                if (item.name === coreName && maxIndex < 1) maxIndex = 1;
                const match = item.name.match(new RegExp(`^${escapeRegExp(coreName)}\\s\\((\\d+)\\)$`));
                if (match && parseInt(match[1]) >= maxIndex) maxIndex = parseInt(match[1]);
            }
        });
        const newName = `${coreName} (${maxIndex > 0 ? maxIndex + 1 : 1})`;
        const newDate = formattaData(new Date());

        // Scrivi copia completa nella activities collection
        const fullCopy = { ...sourceData, id: newId, name: newName, date: newDate, folderId: targetFolderId };
        await setDoc(doc(db, 'activities', newId), fullCopy).catch(console.error);

        // Aggiungi solo metadati al filesystem in memoria
        const metaCopy = { id: newId, type: 'activity', name: newName,
                           activityType: sourceData.activityType, templateKey: sourceData.templateKey,
                           date: newDate, timerMinutes: sourceData.timerMinutes };
        fileSystem[targetFolderId].push(metaCopy);
        saveState();
        renderTable();
        closeActivityActionsModal();
    });
}

if (btnEditActivity) {
    btnEditActivity.addEventListener('click', () => {
        if (!targetActivityId) return;
        closeActivityActionsModal();
        window.location.href = `editor.html?id=${targetActivityId}`;
    });
}

if (btnDeleteActivity) {
    btnDeleteActivity.addEventListener('click', async () => {
        if (!targetFolderId || !targetActivityId) return;
        fileSystem[targetFolderId] = fileSystem[targetFolderId].filter(item => item.id !== targetActivityId);
        await Promise.all([
            saveState(),
            deleteDoc(doc(db, 'activities', targetActivityId)).catch(() => {})
        ]);
        renderTable();
        closeActivityActionsModal();
    });
}

window.addEventListener('click', e => {
    if (e.target === createActivityModal)    closeCreateActivityModal();
    if (e.target === selectFolderModal)      closeSelectFolderModal();
    if (e.target === activityActionsModal)   closeActivityActionsModal();
});

// --- BACKUP & RESTORE ---
if (btnExportData) {
    btnExportData.addEventListener('click', async () => {
        const backupData = {
            fs:    JSON.stringify(fileSystem),
            stats: '[]'
        };
        const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'il_mio_database_puzzel.json';
        a.click();
        URL.revokeObjectURL(url);
    });
}

if (btnImportData) {
    btnImportData.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async event => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.fs) {
                    const fs = JSON.parse(data.fs);
                    const batch = writeBatch(db);
                    for (const fid in fs) {
                        batch.set(doc(db, 'filesystem', fid), { items: fs[fid] || [] });
                    }
                    await batch.commit();
                }
                alert('Database ripristinato con successo!');
                location.reload();
            } catch(err) {
                alert('Errore: Il file selezionato non è valido o è corrotto.');
            }
        };
        reader.readAsText(file);
    });
}

// --- AVVIO ---
async function init() {
    fileSystem = await loadFileSystem();
    renderTable();
}
init();
