// Image box with variable zoom, used by the grid games to show the picture of the
// selected word. Zoom with the +/− buttons, the mouse wheel, a two-finger pinch or a
// double tap; when zoomed in, drag to move around. With { floating: true } it is a
// window that can be dragged by its title bar, resized from its corner and closed;
// it reopens on the next show(). Plain ES2020 so it also runs on the Samsung Tizen
// browsers (Chromium 85).
function createImageViewer(host, opts = {}) {
    host.classList.add('img-viewer');
    if (opts.floating) host.classList.add('img-viewer-floating');
    host.innerHTML = `
        <div class="img-viewer-head">
            <span class="img-viewer-label"></span>
            <div class="img-viewer-tools">
                <button type="button" data-zoom="out" title="Riduci">−</button>
                <span class="img-viewer-level">100%</span>
                <button type="button" data-zoom="in" title="Ingrandisci">+</button>
                <button type="button" data-zoom="fit" title="Adatta alla casella">⤢</button>
                ${opts.floating ? '<button type="button" data-zoom="close" title="Chiudi">×</button>' : ''}
            </div>
        </div>
        <div class="img-viewer-stage">
            <img alt="">
            <p class="img-viewer-empty"></p>
        </div>
    `;
    const stage = host.querySelector('.img-viewer-stage');
    const img   = stage.querySelector('img');
    const empty = stage.querySelector('.img-viewer-empty');
    const label = host.querySelector('.img-viewer-label');
    const level = host.querySelector('.img-viewer-level');

    const MIN = 1, MAX = 6;
    let scale = 1, tx = 0, ty = 0;
    let currentSrc = null;

    const apply = () => {
        // keep the picture inside the box: panning is limited to the zoomed overflow
        const r = stage.getBoundingClientRect();
        const maxX = r.width * (scale - 1) / 2, maxY = r.height * (scale - 1) / 2;
        tx = Math.max(-maxX, Math.min(maxX, tx));
        ty = Math.max(-maxY, Math.min(maxY, ty));
        img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
        level.textContent = Math.round(scale * 100) + '%';
        stage.classList.toggle('zoomed', scale > 1);
    };

    // zoom keeping the point (cx, cy), relative to the box centre, still under the finger
    const zoomTo = (next, cx = 0, cy = 0) => {
        next = Math.max(MIN, Math.min(MAX, next));
        tx = cx - (cx - tx) * (next / scale);
        ty = cy - (cy - ty) * (next / scale);
        scale = next;
        apply();
    };
    const fit = () => { scale = 1; tx = 0; ty = 0; apply(); };
    const centred = (clientX, clientY) => {
        const r = stage.getBoundingClientRect();
        return [clientX - r.left - r.width / 2, clientY - r.top - r.height / 2];
    };

    host.querySelector('.img-viewer-tools').addEventListener('click', e => {
        const action = e.target.closest('[data-zoom]')?.dataset.zoom;
        if (action === 'in')  zoomTo(scale * 1.4);
        if (action === 'out') zoomTo(scale / 1.4);
        if (action === 'fit') fit();
        if (action === 'close') host.style.display = 'none';
    });
    // buttons must not steal the focus from the grid cell being typed in
    host.querySelector('.img-viewer-tools').addEventListener('pointerdown', e => e.preventDefault());

    stage.addEventListener('wheel', e => {
        if (!currentSrc) return;
        e.preventDefault();
        zoomTo(scale * Math.exp(-e.deltaY * 0.0015), ...centred(e.clientX, e.clientY));
    }, { passive: false });

    stage.addEventListener('dblclick', e => {
        if (!currentSrc) return;
        if (scale > 1) fit();
        else zoomTo(2.5, ...centred(e.clientX, e.clientY));
    });

    // one pointer drags, two pointers pinch
    const pointers = new Map();
    let pinchStart = null;
    stage.addEventListener('pointerdown', e => {
        if (!currentSrc) return;
        e.preventDefault(); // keep the focus on the grid
        // capture is only a nicety (keeps tracking outside the box): never let it stop the gesture
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
        }
    });
    stage.addEventListener('pointermove', e => {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2 && pinchStart) {
            const [a, b] = [...pointers.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            zoomTo(pinchStart.scale * dist / pinchStart.dist, ...centred((a.x + b.x) / 2, (a.y + b.y) / 2));
        } else if (pointers.size === 1 && scale > 1) {
            tx += e.clientX - prev.x;
            ty += e.clientY - prev.y;
            apply();
        }
    });
    const release = e => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchStart = null;
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    window.addEventListener('resize', apply);

    // floating window: drag it by the title bar, kept inside the screen
    if (opts.floating) {
        const head = host.querySelector('.img-viewer-head');
        let drag = null;
        head.addEventListener('pointerdown', e => {
            if (e.target.closest('button')) return;
            e.preventDefault();
            try { head.setPointerCapture(e.pointerId); } catch (_) {}
            const r = host.getBoundingClientRect();
            drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
        });
        head.addEventListener('pointermove', e => {
            if (!drag || e.pointerId !== drag.id) return;
            const maxX = window.innerWidth - host.offsetWidth, maxY = window.innerHeight - host.offsetHeight;
            host.style.left  = Math.max(0, Math.min(maxX, e.clientX - drag.dx)) + 'px';
            host.style.top   = Math.max(0, Math.min(maxY, e.clientY - drag.dy)) + 'px';
            host.style.right = 'auto';
        });
        const endDrag = () => { drag = null; };
        head.addEventListener('pointerup', endDrag);
        head.addEventListener('pointercancel', endDrag);
        // resizing (CSS resize on the window) changes the stage size: re-clamp the pan
        if (window.ResizeObserver) new ResizeObserver(apply).observe(stage);
    }

    return {
        // a new picture always starts fitted to the box
        show(src, text) {
            host.style.display = '';
            label.textContent = text || '';
            if (!src || src === 'null') {
                currentSrc = null;
                img.removeAttribute('src');
                img.style.display = 'none';
                empty.textContent = 'Nessuna immagine per questa parola';
                fit();
                return;
            }
            empty.textContent = '';
            img.style.display = '';
            if (src !== currentSrc) { currentSrc = src; img.src = src; fit(); }
        }
    };
}
