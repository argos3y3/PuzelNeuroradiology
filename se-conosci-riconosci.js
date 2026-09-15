class SeConosci {
    constructor(container, words, callbacks = {}) {
        this.container    = container;
        this.words        = words;
        this.hiddenSolution = (callbacks.hiddenSolution || '').toUpperCase().replace(/\s/g, '');
        this.onWin              = callbacks.onWin              || (() => {});
        this.onLose             = callbacks.onLose             || (() => {});
        this.onStartTimer       = callbacks.onStartTimer       || (() => {});
        this.onRegisterSolution = callbacks.onRegisterSolution || null;
        this.init();
    }

    init() {
        const hiddenSol = this.hiddenSolution;

        const placements = this.words.map((w, i) => {
            const text       = w.word.toUpperCase().replace(/\s/g, '');
            const targetChar = hiddenSol[i] || '';
            let hiddenPos    = 0;
            if (targetChar) {
                const found = text.indexOf(targetChar);
                if (found >= 0) hiddenPos = found;
            }
            return {
                text,
                image:       w.image,
                row:         i,
                wordNum:     i + 1,
                hiddenPos,
                hiddenLetter: targetChar || text[0] || ''
            };
        });

        // Randomize the on-screen row order of the horizontal words each time the
        // game is presented, so the vertical intersection letters no longer read
        // top-to-bottom in solution order (as in a real "filippino" schema).
        // wordNum stays tied to each word's position in the hidden solution.
        const rowOrder = placements.map((_, i) => i);
        for (let i = rowOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rowOrder[i], rowOrder[j]] = [rowOrder[j], rowOrder[i]];
        }
        placements.forEach((p, i) => { p.row = rowOrder[i]; });

        const hiddenCol = Math.max(...placements.map(p => p.hiddenPos), 0);
        placements.forEach(p => { p.startX = hiddenCol - p.hiddenPos; });

        const totalCols = Math.max(...placements.map(p => p.startX + p.text.length));
        const totalRows = placements.length;

        // ── Cell size ─────────────────────────────────────────────────────
        const calcCellSize = () => {
            const pW    = this.container.clientWidth;
            const pH    = this.container.clientHeight;
            const gridW = Math.floor(pW * 0.62) - 40;
            const gridH = pH - 40;
            const byW   = Math.floor((gridW - (totalCols - 1) * 2) / totalCols);
            const byH   = Math.floor((gridH - (totalRows - 1) * 2) / totalRows);
            return Math.max(14, Math.min(38, byW, byH));
        };

        // ── HTML ──────────────────────────────────────────────────────────
        this.container.innerHTML = `
            <div class="scr-layout">
                <div class="scr-grid-area">
                    <div class="crossword-grid" id="cwGrid"></div>
                </div>
                <div class="scr-panel">
                    <div class="scr-images" id="scrImages"></div>
                </div>
                <div class="cw-zoom-popup" id="cwZoomPopup">
                    <button type="button" class="cw-zoom-close" id="cwZoomClose">×</button>
                    <img class="cw-zoom-img" id="cwZoomImg" src="" alt="">
                </div>
            </div>
        `;

        const cwGrid      = document.getElementById('cwGrid');
        const scrImages   = document.getElementById('scrImages');
        const cwZoomPopup = document.getElementById('cwZoomPopup');
        const cwZoomImg   = document.getElementById('cwZoomImg');

        const applyGridSize = (cs) => {
            cwGrid.style.setProperty('--cw-cell-size', cs + 'px');
            cwGrid.style.gridTemplateColumns = `repeat(${totalCols}, ${cs}px)`;
            cwGrid.style.gridTemplateRows    = `repeat(${totalRows}, ${cs}px)`;
        };
        applyGridSize(calcCellSize());
        window.addEventListener('resize', () => applyGridSize(calcCellSize()));

        // ── Grid cells ────────────────────────────────────────────────────
        const rowInputs = placements.map(() => []);
        const keyToCell = {};

        placements.forEach(p => {
            for (let k = 0; k < p.text.length; k++) {
                const absCol       = p.startX + k;
                const key          = `${p.row},${absCol}`;
                const char         = p.text[k];
                const isHiddenCell = absCol === hiddenCol;

                const cell = document.createElement('div');
                cell.className = 'cw-cell';
                if (k === 0)       cell.classList.add('start-cell');
                if (isHiddenCell)  cell.classList.add('scr-hidden-cell');
                cell.style.gridColumn = absCol + 1;
                cell.style.gridRow    = p.row + 1;
                keyToCell[key] = cell;

                if (k === 0) {
                    const numSpan = document.createElement('span');
                    numSpan.className   = 'cw-number';
                    numSpan.textContent = p.wordNum;
                    cell.appendChild(numSpan);
                }

                const input = document.createElement('input');
                input.maxLength       = 1;
                input.dataset.correct = char;
                input.dataset.row     = p.row;
                input.dataset.col     = absCol;
                rowInputs[p.row].push(input);

                cell.appendChild(input);
                cwGrid.appendChild(cell);
            }
        });

        // ── Input event handling ──────────────────────────────────────────
        rowInputs.forEach((rowArr, rowIdx) => {
            rowArr.forEach((input, colIdx) => {
                input.addEventListener('input', () => {
                    input.value = input.value.toUpperCase();
                    if (input.value !== '') {
                        if (colIdx < rowArr.length - 1) {
                            rowArr[colIdx + 1].focus();
                        } else if (rowIdx < rowInputs.length - 1) {
                            rowInputs[rowIdx + 1][0].focus();
                        }
                    }
                    this.checkCompletion();
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace') {
                        e.preventDefault(); input.value = '';
                        if (colIdx > 0) rowArr[colIdx - 1].focus();
                        else if (rowIdx > 0) rowInputs[rowIdx - 1][rowInputs[rowIdx - 1].length - 1].focus();
                    } else if (e.key === 'ArrowLeft' && colIdx > 0) {
                        e.preventDefault(); rowArr[colIdx - 1].focus();
                    } else if (e.key === 'ArrowRight' && colIdx < rowArr.length - 1) {
                        e.preventDefault(); rowArr[colIdx + 1].focus();
                    } else if (e.key === 'ArrowUp' && rowIdx > 0) {
                        e.preventDefault();
                        const prev = rowInputs[rowIdx - 1];
                        prev[Math.min(colIdx, prev.length - 1)].focus();
                    } else if (e.key === 'ArrowDown' && rowIdx < rowInputs.length - 1) {
                        e.preventDefault();
                        const next = rowInputs[rowIdx + 1];
                        next[Math.min(colIdx, next.length - 1)].focus();
                    } else if (e.key === 'Enter' && rowIdx < rowInputs.length - 1) {
                        e.preventDefault(); rowInputs[rowIdx + 1][0].focus();
                    }
                });
            });
        });

        if (rowInputs.length > 0) setTimeout(() => rowInputs[0][0]?.focus(), 100);

        // ── Row highlight ─────────────────────────────────────────────────
        let activeWordNum = null;

        const highlightRow = (wordNum) => {
            cwGrid.querySelectorAll('.cw-cell.highlighted').forEach(c => c.classList.remove('highlighted'));
            if (wordNum === null) return;
            const p = placements.find(pl => pl.wordNum === wordNum);
            if (!p) return;
            for (let k = 0; k < p.text.length; k++) {
                const cell = keyToCell[`${p.row},${p.startX + k}`];
                if (cell) cell.classList.add('highlighted');
            }
        };

        // ── Zoom ──────────────────────────────────────────────────────────
        // ── Draggable zoom popup ──────────────────────────────────────────
        {
            let dx = 0, dy = 0, ox = 0, oy = 0, dragging = false;
            cwZoomPopup.addEventListener('pointerdown', e => {
                if (e.target.closest('.cw-zoom-close')) return;
                dragging = true;
                dx = e.clientX; dy = e.clientY;
                const r = cwZoomPopup.getBoundingClientRect();
                ox = r.left; oy = r.top;
                cwZoomPopup.setPointerCapture(e.pointerId);
                e.preventDefault();
            });
            cwZoomPopup.addEventListener('pointermove', e => {
                if (!dragging) return;
                cwZoomPopup.style.left      = ox + e.clientX - dx + 'px';
                cwZoomPopup.style.top       = oy + e.clientY - dy + 'px';
                cwZoomPopup.style.right     = 'auto';
                cwZoomPopup.style.transform = 'none';
            });
            cwZoomPopup.addEventListener('pointerup',     () => { dragging = false; });
            cwZoomPopup.addEventListener('pointercancel', () => { dragging = false; });
        }

        const showZoom = (src) => { if (!src || src === 'null') return; cwZoomImg.src = src; cwZoomPopup.style.display = 'block'; };
        const hideZoom = () => { cwZoomPopup.style.display = 'none'; };

        document.getElementById('cwZoomClose').addEventListener('click', (e) => {
            e.stopPropagation(); hideZoom();
            activeWordNum = null; highlightRow(null);
            scrImages.querySelectorAll('.scr-image-card.active').forEach(c => c.classList.remove('active'));
        });

        cwGrid.addEventListener('click', (e) => {
            const cell = e.target.closest('.cw-cell');
            if (!cell) return;
            const input = cell.querySelector('input');
            if (!input) return;
            const clickedRow = parseInt(input.dataset.row);
            const p = placements.find(pl => pl.row === clickedRow);
            if (!p) return;
            scrImages.querySelectorAll('.scr-image-card.active').forEach(c => c.classList.remove('active'));
            const card = scrImages.querySelector(`.scr-image-card[data-word-num="${p.wordNum}"]`);
            if (card) card.classList.add('active');
            activeWordNum = p.wordNum;
            highlightRow(p.wordNum);
        });

        // ── Image clue panel ──────────────────────────────────────────────
        placements.forEach(p => {
            const card = document.createElement('div');
            card.className       = 'scr-image-card';
            card.dataset.wordNum = p.wordNum;

            const num = document.createElement('span');
            num.className   = 'scr-image-num';
            num.textContent = p.wordNum;
            card.appendChild(num);

            if (p.image && p.image !== 'null') {
                const wrap = document.createElement('div');
                wrap.className = 'scr-img-wrapper';
                const img = document.createElement('img');
                img.src = p.image; img.alt = `Indizio ${p.wordNum}`;
                wrap.appendChild(img);
                const zBtn = document.createElement('button');
                zBtn.type = 'button'; zBtn.className = 'clue-zoom-btn'; zBtn.textContent = '🔍';
                zBtn.addEventListener('click', (e) => { e.stopPropagation(); showZoom(p.image); });
                wrap.appendChild(zBtn);
                card.appendChild(wrap);
            }

            card.addEventListener('mouseenter', () => highlightRow(p.wordNum));
            card.addEventListener('mouseleave', () => highlightRow(activeWordNum));
            card.addEventListener('click', () => {
                scrImages.querySelectorAll('.scr-image-card.active').forEach(c => c.classList.remove('active'));
                if (activeWordNum === p.wordNum) {
                    activeWordNum = null; highlightRow(null); hideZoom();
                } else {
                    activeWordNum = p.wordNum;
                    card.classList.add('active');
                    highlightRow(p.wordNum);
                    if (p.image && p.image !== 'null') showZoom(p.image);
                    setTimeout(() => rowInputs[p.row]?.[0]?.focus(), 50);
                }
            });

            scrImages.appendChild(card);
        });

        this.onRegisterSolution?.(() => {
            document.querySelectorAll('#cwGrid .cw-cell input').forEach(inp => {
                inp.value    = inp.dataset.correct;
                inp.readOnly = true;
            });
        });

        this.onStartTimer();
    }

    checkCompletion() {
        const allInputs  = [...document.querySelectorAll('.cw-cell input')];
        const allFilled  = allInputs.every(inp => inp.value !== '');
        if (!allFilled) return;
        const allCorrect = allInputs.every(inp => inp.value === inp.dataset.correct);
        if (allCorrect) this.onWin('Cruciverba completato perfettamente!');
        else this.onLose('Attenzione: alcune lettere sono sbagliate!');
    }
}
