import { db } from './firebase-init.js';
import {
    collection, doc, getDocs, setDoc, deleteDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// --- STATO ---
const auth = JSON.parse(sessionStorage.getItem('puzAuth') || 'null');
const isAgente = auth?.role === 'agente';
const AGENTE_FOLDER_ID = 'agente_selezione';

let fileSystem  = { root: [] };
let currentPath = isAgente
    ? [{ id: AGENTE_FOLDER_ID, name: '🎯 Selezione Agente' }]
    : (JSON.parse(localStorage.getItem('puzzelFoldersState')) || [{ id: 'root', name: '🏠 Home' }]);

// --- ELEMENTI DOM ---
const gridEl       = document.getElementById('foldersGrid');
const breadcrumbsEl = document.getElementById('breadcrumbs');

const gearSVG = `
    <svg fill="#000000" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
    </svg>
`;

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

// --- RENDER ---
function renderGrid() {
    gridEl.innerHTML = '';
    const currentFolderId = currentPath[currentPath.length - 1].id;
    const itemsToRender   = fileSystem[currentFolderId] || [];

    if (itemsToRender.length === 0) {
        const emptyMsg = isAgente
            ? 'Nessuna attività disponibile al momento.'
            : 'Questa directory è vuota. Crea qualcosa dalla Dashboard o un nuovo folder!';
        gridEl.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: #888; padding: 20px;">${emptyMsg}</p>`;
        return;
    }

    itemsToRender.filter(i => i.type === 'folder').forEach(createFolderCard);
    itemsToRender.filter(i => i.type === 'activity').forEach(createActivityCard);
}

function createFolderCard(folder) {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.setAttribute('draggable', 'true');
    card.dataset.id = folder.id;

    const iconColor = (folder.color === '#000000' || folder.color === '#854d0e') ? '#ffffff' : '#000000';
    const folderSVG = `<svg fill="${iconColor}" width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
    const actCount  = (fileSystem[folder.id] || []).filter(i => i.type === 'activity').length;

    card.innerHTML = `
        <div class="folder-visual" style="background-color: ${folder.color};">
            <button class="btn-settings" title="Impostazioni">${gearSVG}</button>
            ${folderSVG}
        </div>
        <span class="folder-name" title="${folder.name}">${folder.name}</span>
        <span class="folder-stats">${actCount} activities</span>
    `;

    card.addEventListener('dblclick', () => enterFolder(folder.id, folder.name));
    card.querySelector('.btn-settings').addEventListener('click', e => { e.stopPropagation(); apriModaleModifica(folder); });

    card.addEventListener('dragstart', e => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', folder.id); });
    card.addEventListener('dragend',   () => card.classList.remove('dragging'));
    card.addEventListener('dragover',  e => e.preventDefault());
    card.addEventListener('dragenter', () => { if (!card.classList.contains('dragging')) card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
        e.preventDefault(); card.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (id && id !== folder.id) moveItem(id, folder.id);
    });

    gridEl.appendChild(card);
}

function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'folder-card activity-card';
    if (!isAgente) card.setAttribute('draggable', 'true');
    card.dataset.id = activity.id;

    const ACTIVITY_SVGS = {
        'Crucitomo':              `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24"><path d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/><path d="M7 7h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm-8 4h2v2H7zm4 0h6v2h-6zm-4 4h6v2H7zm8 0h2v2h-2z"/></svg>`,
        'Il tempo è tiranno':     `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>`,
        "Trova l'Intruso":        `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
        'Radiazione a Catena':    `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>`,
        'Se Conosci...Riconosci': `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
        'Passa e Spassa':         `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"/></svg>`,
        'Guess What':             `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
    };
    const activitySVG = ACTIVITY_SVGS[activity.activityType] ||
        `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>`;

    card.innerHTML = `
        <div class="folder-visual activity-visual" style="background-color: #f3f4f6;">
            <button class="btn-settings" title="Impostazioni">${gearSVG}</button>
            ${activitySVG}
        </div>
        <span class="folder-name" title="${activity.name}">${activity.name}</span>
        <span class="folder-stats">${activity.activityType}</span>
    `;

    card.addEventListener('dblclick', () => window.location.href = `game.html?id=${activity.id}`);
    card.querySelector('.btn-settings').addEventListener('click', e => {
        e.stopPropagation();
        showActivityPopup(activity, card.querySelector('.btn-settings'));
    });

    if (!isAgente) {
        card.addEventListener('dragstart', e => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', activity.id); });
        card.addEventListener('dragend',   () => card.classList.remove('dragging'));
        ['dragover', 'dragenter', 'dragleave', 'drop'].forEach(ev => card.addEventListener(ev, e => e.preventDefault()));
    }

    gridEl.appendChild(card);
}

// --- NAVIGAZIONE ---
function renderBreadcrumbs() {
    breadcrumbsEl.innerHTML = '';
    currentPath.forEach((step, index) => {
        const isLast = index === currentPath.length - 1;
        const span = document.createElement('span');
        span.className = `breadcrumb-item ${isLast ? 'active' : ''}`;
        span.textContent = step.name;
        if (!isLast) {
            span.addEventListener('click', () => navigateToBreadcrumb(index));
            span.addEventListener('dragover',  e => { e.preventDefault(); span.classList.add('breadcrumb-drop-over'); });
            span.addEventListener('dragleave', () => span.classList.remove('breadcrumb-drop-over'));
            span.addEventListener('drop', e => {
                e.preventDefault(); span.classList.remove('breadcrumb-drop-over');
                const id = e.dataTransfer.getData('text/plain');
                if (id) moveItem(id, step.id);
            });
        }
        breadcrumbsEl.appendChild(span);
    });
}

function enterFolder(id, name) {
    if (isAgente) return;
    currentPath.push({ id, name });
    localStorage.setItem('puzzelFoldersState', JSON.stringify(currentPath));
    renderBreadcrumbs();
    renderGrid();
}

function navigateToBreadcrumb(index) {
    if (isAgente) return;
    currentPath = currentPath.slice(0, index + 1);
    localStorage.setItem('puzzelFoldersState', JSON.stringify(currentPath));
    renderBreadcrumbs();
    renderGrid();
}

function moveItem(draggedId, targetId) {
    const currentFolderId = currentPath[currentPath.length - 1].id;
    const idx = fileSystem[currentFolderId].findIndex(f => f.id === draggedId);
    if (idx > -1) {
        const [item] = fileSystem[currentFolderId].splice(idx, 1);
        if (!fileSystem[targetId]) fileSystem[targetId] = [];
        fileSystem[targetId].push(item);
        saveState();
        renderGrid();
    }
}

// --- CREA CARTELLA ---
const newFolderModal    = document.getElementById('newFolderModal');
const folderNameInput   = document.getElementById('folderNameInput');
const folderColorInput  = document.getElementById('folderColorInput');
const btnConfirmNewFolder = document.getElementById('btnConfirmFolder');
const btnCancelNewFolder  = document.getElementById('btnCancelFolder');
const btnNewFolder        = document.getElementById('btnNewFolder');

if (btnNewFolder) {
    btnNewFolder.addEventListener('click', () => {
        newFolderModal.style.display = 'flex';
        folderNameInput.value = '';
        folderNameInput.focus();
    });
}
if (btnCancelNewFolder) btnCancelNewFolder.addEventListener('click', () => newFolderModal.style.display = 'none');
if (btnConfirmNewFolder) {
    btnConfirmNewFolder.addEventListener('click', () => {
        const name = folderNameInput.value.trim();
        if (!name) return;
        const currentFolderId = currentPath[currentPath.length - 1].id;
        const newId = 'f_' + Date.now();
        if (!fileSystem[currentFolderId]) fileSystem[currentFolderId] = [];
        fileSystem[currentFolderId].push({ id: newId, type: 'folder', name, color: folderColorInput.value });
        fileSystem[newId] = [];
        saveState();
        renderGrid();
        newFolderModal.style.display = 'none';
    });
}

// --- POPUP AZIONI ATTIVITÀ ---
let activePopup = null;

function showActivityPopup(activity, anchorEl) {
    if (activePopup) { activePopup.remove(); activePopup = null; }
    const popup = document.createElement('div');
    popup.innerHTML = isAgente
        ? `<button type="button" class="popup-btn" data-action="play">▶ Gioca</button>`
        : `
        <button type="button" class="popup-btn" data-action="play">▶ Gioca</button>
        <button type="button" class="popup-btn" data-action="edit">✏ Modifica</button>
        <button type="button" class="popup-btn popup-btn-danger" data-action="delete">🗑 Elimina</button>
    `;
    const rect = anchorEl.getBoundingClientRect();
    popup.style.cssText = `position:fixed;top:${rect.bottom+4}px;left:${rect.left}px;z-index:9999;background:white;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);padding:4px;min-width:130px;`;
    popup.addEventListener('click', e => {
        e.stopPropagation();
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        popup.remove(); activePopup = null;
        if (action === 'play')   window.location.href = `game.html?id=${activity.id}`;
        if (action === 'edit')   window.location.href = `editor.html?id=${activity.id}`;
        if (action === 'delete') {
            if (confirm(`Eliminare "${activity.name}"?`)) {
                const cid = currentPath[currentPath.length - 1].id;
                fileSystem[cid] = fileSystem[cid].filter(f => f.id !== activity.id);
                saveState();
                renderGrid();
            }
        }
    });
    document.body.appendChild(popup);
    activePopup = popup;
    setTimeout(() => {
        document.addEventListener('click', function close() {
            if (activePopup) { activePopup.remove(); activePopup = null; }
            document.removeEventListener('click', close);
        });
    }, 0);
}

// Inject popup styles
const _style = document.createElement('style');
_style.textContent = `.popup-btn{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:none;text-align:left;cursor:pointer;font-size:13px;font-family:'Poppins',sans-serif;color:#374151;border-radius:6px;} .popup-btn:hover{background:#f3f4f6;} .popup-btn-danger{color:#dc2626;} .popup-btn-danger:hover{background:#fef2f2;}`;
document.head.appendChild(_style);

// --- MODIFICA / CANCELLAZIONE ---
const editModal      = document.getElementById('editFolderModal');
const editNameInput  = document.getElementById('editFolderNameInput');
const editColorInput = document.getElementById('editFolderColorInput');
const btnConfirmEdit = document.getElementById('btnConfirmEdit');
const btnCancelEdit  = document.getElementById('btnCancelEdit');
const btnDeleteFolder = document.getElementById('btnDeleteFolder');
let itemToEdit = null;

function apriModaleModifica(item) {
    itemToEdit = item;
    editNameInput.value = item.name;
    const colorGroup = editColorInput.parentElement;
    const modalTitle = editModal.querySelector('h2');
    if (item.type === 'activity') {
        colorGroup.style.display = 'none';
        modalTitle.textContent = 'Impostazioni Attività';
    } else {
        colorGroup.style.display = 'flex';
        editColorInput.value = item.color || '#000000';
        modalTitle.textContent = 'Impostazioni Cartella';
    }
    editModal.style.display = 'flex';
}

if (btnCancelEdit)  btnCancelEdit.addEventListener('click',  () => editModal.style.display = 'none');
if (btnConfirmEdit) btnConfirmEdit.addEventListener('click', () => {
    if (itemToEdit && editNameInput.value.trim()) {
        itemToEdit.name = editNameInput.value.trim();
        if (itemToEdit.type === 'folder') itemToEdit.color = editColorInput.value;
        saveState();
        renderGrid();
        editModal.style.display = 'none';
    }
});
if (btnDeleteFolder) btnDeleteFolder.addEventListener('click', () => {
    const typeName  = itemToEdit.type === 'activity' ? "l'attività" : "la cartella";
    if (!confirm(`Eliminare ${typeName} "${itemToEdit.name}"?`)) return;
    const cid = currentPath[currentPath.length - 1].id;
    fileSystem[cid] = fileSystem[cid].filter(f => f.id !== itemToEdit.id);
    if (itemToEdit.type === 'folder') {
        delete fileSystem[itemToEdit.id];
        deleteDoc(doc(db, 'filesystem', itemToEdit.id)).catch(console.error);
    }
    saveState();
    renderGrid();
    editModal.style.display = 'none';
});

// --- RESTRIZIONI RUOLO AGENTE ---
function applyAgenteRestrictions() {
    if (!isAgente) return;
    document.getElementById('btnNewFolder')?.style.setProperty('display', 'none');
    document.querySelector('.info-banner')?.style.setProperty('display', 'none');
    document.querySelectorAll('.nav-links li').forEach(li => {
        if (!li.querySelector('a[href="folders.html"]')) li.style.display = 'none';
    });
}

// --- AVVIO ---
async function init() {
    applyAgenteRestrictions();
    fileSystem = await loadFileSystem();
    renderBreadcrumbs();
    renderGrid();
}
init();
