// Legge il database dal LocalStorage
let fileSystem = JSON.parse(localStorage.getItem('myPuzzelCloneFS')) || { 'root': [] };

// Teniamo traccia del percorso attuale (Es: Home > Matematica)
let currentPath = JSON.parse(localStorage.getItem('puzzelFoldersState')) || [{ id: 'root', name: '🏠 Home' }];

// Elementi DOM (Directories)
const gridEl = document.getElementById('foldersGrid');
const breadcrumbsEl = document.getElementById('breadcrumbs');

// SVG dell'ingranaggio
const gearSVG = `
    <svg fill="#000000" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
    </svg>
`;

// --- FUNZIONI PRINCIPALI ---
function saveState() {
    localStorage.setItem('myPuzzelCloneFS', JSON.stringify(fileSystem));
}

function renderGrid() {
    gridEl.innerHTML = ''; 
    const currentFolderId = currentPath[currentPath.length - 1].id;
    const itemsToRender = fileSystem[currentFolderId] || [];

    if (itemsToRender.length === 0) {
        gridEl.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: #888; padding: 20px;">Questa directory è vuota. Crea qualcosa dalla Dashboard o un nuovo folder!</p>';
        return;
    }

    const folders = itemsToRender.filter(item => item.type === 'folder');
    const activities = itemsToRender.filter(item => item.type === 'activity');

    folders.forEach(folder => createFolderCard(folder));
    activities.forEach(activity => createActivityCard(activity));
}

// Crea l'HTML per una CARTELLA
function createFolderCard(folder) {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.setAttribute('draggable', 'true');
    card.dataset.id = folder.id; 
    
    const iconColor = (folder.color === '#000000' || folder.color === '#854d0e') ? '#ffffff' : '#000000';
    const folderSVG = `<svg fill="${iconColor}" width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;

    const itemsInThisFolder = fileSystem[folder.id] || [];
    const activityCount = itemsInThisFolder.filter(item => item.type === 'activity').length;

    card.innerHTML = `
        <div class="folder-visual" style="background-color: ${folder.color};">
            <button class="btn-settings" title="Impostazioni">${gearSVG}</button>
            ${folderSVG}
        </div>
        <span class="folder-name" title="${folder.name}">${folder.name}</span>
        <span class="folder-stats">${activityCount} activities</span>
    `;

    card.addEventListener('dblclick', () => enterFolder(folder.id, folder.name));
    
    // Evento ingranaggio
    card.querySelector('.btn-settings').addEventListener('click', (e) => {
        e.stopPropagation(); 
        apriModaleModifica(folder);
    });

    // Eventi Drag&Drop
    card.addEventListener('dragstart', (e) => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', folder.id); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('dragenter', () => { if (!card.classList.contains('dragging')) card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const draggedItemId = e.dataTransfer.getData('text/plain');
        if (draggedItemId && draggedItemId !== folder.id) moveItem(draggedItemId, folder.id);
    });

    gridEl.appendChild(card);
}

// Crea l'HTML per un'ATTIVITA' nella directory
function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'folder-card activity-card'; 
    card.setAttribute('draggable', 'true');
    card.dataset.id = activity.id; 

    let activitySVG = '';
    if (activity.activityType === 'Crucitomo') {
        activitySVG = `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/><path d="M7 7h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm-8 4h2v2H7zm4 0h6v2h-6zm-4 4h6v2H7zm8 0h2v2h-2z"/></svg>`;
    } else if (activity.activityType === 'Il tempo è tiranno') {
        activitySVG = `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h8v2H8v14h10v-5h2v7H6V3z"/><circle cx="14" cy="7.5" r="1.5"/><path d="M14 10v4h-1v-4h1zm-1 1h-2V9h2v2zm2 0h2V9h-2v2zm-1 4l-1.5 3h1.2l1-2 1 2h1.2L14 15z"/><path d="M13 3v2h2V3h-2z"/></svg>`;
    } else {
        activitySVG = `<svg fill="#000000" width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>`;
    }

    card.innerHTML = `
        <div class="folder-visual activity-visual" style="background-color: #f3f4f6;">
            <button class="btn-settings" title="Impostazioni">${gearSVG}</button>
            ${activitySVG}
        </div>
        <span class="folder-name" title="${activity.name}">${activity.name}</span>
        <span class="folder-stats">${activity.activityType}</span>
    `;

    card.addEventListener('dblclick', () => window.location.href = `game.html?id=${activity.id}`);
    
    // Evento ingranaggio
    card.querySelector('.btn-settings').addEventListener('click', (e) => {
        e.stopPropagation(); 
        apriModaleModifica(activity);
    });

    card.addEventListener('dragstart', (e) => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', activity.id); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('dragenter', (e) => e.preventDefault());
    card.addEventListener('dragleave', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => e.preventDefault());

    gridEl.appendChild(card);
}

// --- AZIONI DI NAVIGAZIONE ---
function renderBreadcrumbs() {
    breadcrumbsEl.innerHTML = '';
    currentPath.forEach((step, index) => {
        const isLast = index === currentPath.length - 1;
        const span = document.createElement('span');
        span.className = `breadcrumb-item ${isLast ? 'active' : ''}`;
        span.textContent = step.name;
        if (!isLast) span.addEventListener('click', () => navigateToBreadcrumb(index));
        breadcrumbsEl.appendChild(span);
    });
}

function enterFolder(id, name) { 
    currentPath.push({ id, name }); 
    localStorage.setItem('puzzelFoldersState', JSON.stringify(currentPath)); // Salva stato
    renderBreadcrumbs(); 
    renderGrid(); 
}

function navigateToBreadcrumb(index) { 
    currentPath = currentPath.slice(0, index + 1); 
    localStorage.setItem('puzzelFoldersState', JSON.stringify(currentPath)); // Salva stato
    renderBreadcrumbs(); 
    renderGrid(); 
}
function moveItem(draggedId, targetId) {
    const currentFolderId = currentPath[currentPath.length - 1].id;
    const itemIndex = fileSystem[currentFolderId].findIndex(f => f.id === draggedId);
    if (itemIndex > -1) {
        const [itemToMove] = fileSystem[currentFolderId].splice(itemIndex, 1);
        if (!fileSystem[targetId]) fileSystem[targetId] = [];
        fileSystem[targetId].push(itemToMove);
        saveState();
        renderGrid();
    }
}

// --- CREAZIONE NUOVA CARTELLA ---
const newFolderModal = document.getElementById('newFolderModal');
const folderNameInput = document.getElementById('folderNameInput');
const folderColorInput = document.getElementById('folderColorInput');
const btnConfirmNewFolder = document.getElementById('btnConfirmFolder');
const btnCancelNewFolder = document.getElementById('btnCancelFolder');
const btnNewFolder = document.getElementById('btnNewFolder');

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
        const folderName = folderNameInput.value.trim();
        if (folderName) {
            const currentFolderId = currentPath[currentPath.length - 1].id;
            if (!fileSystem[currentFolderId]) fileSystem[currentFolderId] = [];
            const newId = 'f_' + Date.now(); 
            const newFolder = { id: newId, type: 'folder', name: folderName, color: folderColorInput.value };
            fileSystem[currentFolderId].push(newFolder);
            fileSystem[newId] = [];
            saveState(); 
            renderGrid(); 
            newFolderModal.style.display = 'none';
        }
    });
}

// --- MODIFICA E CANCELLAZIONE (Cartella o Attività) ---
const editModal = document.getElementById('editFolderModal');
const editNameInput = document.getElementById('editFolderNameInput');
const editColorInput = document.getElementById('editFolderColorInput');
const btnConfirmEdit = document.getElementById('btnConfirmEdit');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnDeleteFolder = document.getElementById('btnDeleteFolder');

let itemToEdit = null;

function apriModaleModifica(item) {
    itemToEdit = item;
    editNameInput.value = item.name;
    
    const colorGroup = editColorInput.parentElement;
    const modalTitle = editModal.querySelector('h2');

    // Adatta la modale in base a se stiamo modificando un'attività o una cartella
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

if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => editModal.style.display = 'none');

if (btnConfirmEdit) {
    btnConfirmEdit.addEventListener('click', () => {
        if (itemToEdit && editNameInput.value.trim() !== "") {
            itemToEdit.name = editNameInput.value.trim();
            if (itemToEdit.type === 'folder') {
                itemToEdit.color = editColorInput.value;
            }
            saveState(); 
            renderGrid(); 
            editModal.style.display = 'none'; 
        }
    });
}

if (btnDeleteFolder) {
    btnDeleteFolder.addEventListener('click', () => {
        const typeName = itemToEdit.type === 'activity' ? "l'attività" : "la cartella";
        const confirmed = confirm(`Sei sicuro di voler eliminare ${typeName} "${itemToEdit.name}"?`);
        
        if (confirmed && itemToEdit) {
            const currentFolderId = currentPath[currentPath.length - 1].id;
            fileSystem[currentFolderId] = fileSystem[currentFolderId].filter(f => f.id !== itemToEdit.id);
            
            if (itemToEdit.type === 'folder') {
                delete fileSystem[itemToEdit.id];
            }

            saveState(); 
            renderGrid(); 
            editModal.style.display = 'none'; 
        }
    });
}

// --- AVVIO INIZIALE ---
renderBreadcrumbs();
renderGrid();