function initTrovaIntruso(container, images, callbacks) {
    container.innerHTML = `
        <div class="ti-layout">
            <div class="ti-instruction">Seleziona le strutture appartenenti alla stessa categoria!</div>
            <div class="ti-grid" id="tiGrid"></div>
            <div class="ti-footer">
                <button type="button" class="ti-unlock-btn" id="tiUnlock">🔒 UNLOCK</button>
                <div class="ti-error" id="tiError">La risposta fornita non è corretta.</div>
            </div>
        </div>
        <div class="ti-zoom-popup" id="tiZoomPopup">
            <button type="button" class="ti-zoom-close" id="tiZoomClose">×</button>
            <img class="ti-zoom-img" id="tiZoomImg" src="" alt="">
        </div>
    `;

    const tiGrid    = document.getElementById('tiGrid');
    const tiUnlock  = document.getElementById('tiUnlock');
    const tiError   = document.getElementById('tiError');
    const zoomPopup = document.getElementById('tiZoomPopup');
    const zoomImg   = document.getElementById('tiZoomImg');

    const openZoom  = (src) => { zoomImg.src = src; zoomPopup.style.display = 'flex'; };
    const closeZoom = () => { zoomPopup.style.display = 'none'; };

    document.getElementById('tiZoomClose').addEventListener('click', closeZoom);
    zoomPopup.addEventListener('click', (e) => { if (e.target === zoomPopup) closeZoom(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && zoomPopup.style.display === 'flex') closeZoom();
    });

    const selected = new Set();

    images.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'ti-img-card';

        const img = document.createElement('img');
        img.src = item.image;
        img.alt = `Immagine ${idx + 1}`;
        card.appendChild(img);

        const zoomBtn = document.createElement('button');
        zoomBtn.type      = 'button';
        zoomBtn.className = 'ti-zoom-btn';
        zoomBtn.textContent = '🔍';
        zoomBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openZoom(item.image);
        });
        card.appendChild(zoomBtn);

        card.addEventListener('click', () => {
            if (selected.has(idx)) {
                selected.delete(idx);
                card.classList.remove('selected');
            } else {
                selected.add(idx);
                card.classList.add('selected');
            }
            tiError.style.display = 'none';
        });

        tiGrid.appendChild(card);
    });

    tiUnlock.addEventListener('click', () => {
        const intrusoIndices = new Set(
            images.map((item, idx) => item.isIntruso ? idx : -1).filter(i => i >= 0)
        );

        const correct = selected.size === intrusoIndices.size &&
                        [...selected].every(i => intrusoIndices.has(i));

        if (correct) {
            callbacks.onWin('Hai trovato tutti gli intrusi!');
        } else {
            tiError.style.display = 'block';
        }
    });

    callbacks.onRegisterSolution?.(() => {
        const cards = [...document.querySelectorAll('.ti-img-card')];
        images.forEach((item, idx) => {
            cards[idx]?.classList.toggle('selected', !!item.isIntruso);
        });
        tiError.style.display = 'none';
    });

    callbacks.onStartTimer();
}
