class Crossword {
    constructor(container, words, callbacks = {}) {
        this.container    = container;
        this.words        = words;
        this.onWin              = callbacks.onWin              || (() => {});
        this.onLose             = callbacks.onLose             || (() => {});
        this.onStartTimer       = callbacks.onStartTimer       || (() => {});
        this.onRegisterSolution = callbacks.onRegisterSolution || null;
        this.init();
    }

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    init() {
        // ── Placement algorithm (unchanged) ───────────────────────────────
        let wordsList = this.shuffle(this.words.map((item, index) => ({
            originalIndex: index + 1,
            text:  item.word.replace(/\s/g, '').toUpperCase(),
            image: item.image
        }))).sort((a, b) => b.text.length - a.text.length);

        let gridInfo = new Map(), wordPlacements = [];

        const canPlace = (wordStr, startX, startY, dirX, dirY) => {
            for (let i = 0; i < wordStr.length; i++) {
                const x = startX + i * dirX, y = startY + i * dirY, key = `${x},${y}`;
                if (gridInfo.has(key)) {
                    if (gridInfo.get(key) !== wordStr[i]) return false;
                } else {
                    const pX = dirY, pY = dirX;
                    if (gridInfo.has(`${x+pX},${y+pY}`) || gridInfo.has(`${x-pX},${y-pY}`)) return false;
                }
            }
            if (gridInfo.has(`${startX - dirX},${startY - dirY}`)) return false;
            if (gridInfo.has(`${startX + wordStr.length * dirX},${startY + wordStr.length * dirY}`)) return false;
            return true;
        };

        for (let w of wordsList) {
            const wordStr = w.text;
            if (gridInfo.size === 0) {
                const dirX = Math.random() < 0.5 ? 1 : 0, dirY = dirX === 1 ? 0 : 1;
                for (let i = 0; i < wordStr.length; i++) gridInfo.set(`${i*dirX},${i*dirY}`, wordStr[i]);
                wordPlacements.push({ ...w, x: 0, y: 0, dirX, dirY });
                continue;
            }
            const valid = [];
            for (let p of wordPlacements) {
                for (let i = 0; i < wordStr.length; i++) {
                    for (let j = 0; j < p.text.length; j++) {
                        if (p.text[j] === wordStr[i]) {
                            const ix = p.x + j * p.dirX, iy = p.y + j * p.dirY;
                            const dirX = p.dirY === 0 ? 0 : 1, dirY = p.dirX === 0 ? 0 : 1;
                            const sx = ix - i * dirX, sy = iy - i * dirY;
                            if (canPlace(wordStr, sx, sy, dirX, dirY)) valid.push({ sx, sy, dirX, dirY });
                        }
                    }
                }
            }
            if (valid.length > 0) {
                const { sx, sy, dirX, dirY } = valid[Math.floor(Math.random() * valid.length)];
                for (let k = 0; k < wordStr.length; k++) gridInfo.set(`${sx + k*dirX},${sy + k*dirY}`, wordStr[k]);
                wordPlacements.push({ ...w, x: sx, y: sy, dirX, dirY });
            } else {
                let maxY = -100;
                for (const key of gridInfo.keys()) { const y = parseInt(key.split(',')[1]); if (y > maxY) maxY = y; }
                const sy = maxY + 2;
                for (let k = 0; k < wordStr.length; k++) gridInfo.set(`${k},${sy}`, wordStr[k]);
                wordPlacements.push({ ...w, x: 0, y: sy, dirX: 1, dirY: 0 });
            }
        }

        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        gridInfo.forEach((_, key) => {
            const [x, y] = key.split(',').map(Number);
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        });
        const cols = maxX - minX + 1, rows = maxY - minY + 1;

        const calcCellSize = () => {
            const pW = this.container.clientWidth, pH = this.container.clientHeight;
            const layoutW = Math.min(pW, 1200);
            const gridAvailW = Math.floor((layoutW - 20) * 2 / 3) - 44;
            const gridAvailH = pH - 44;
            const byW = Math.floor((gridAvailW - (cols-1)*2) / cols);
            const byH = Math.floor((gridAvailH - (rows-1)*2) / rows);
            return Math.max(15, Math.min(34, byW, byH));
        };

        // ── DOM ───────────────────────────────────────────────────────────
        this.container.innerHTML = `
            <div class="crossword-layout">
                <div class="cw-grid-wrapper">
                    <div class="crossword-grid" id="cwGrid"></div>
                </div>
                <div class="crossword-clues" id="cwClues"></div>
                <div class="cw-zoom-popup" id="cwZoomPopup">
                    <button class="cw-zoom-close" id="cwZoomClose">×</button>
                    <img class="cw-zoom-img" id="cwZoomImg" src="" alt="">
                </div>
            </div>
        `;

        const cwGrid      = document.getElementById('cwGrid');
        const cwClues     = document.getElementById('cwClues');
        const cwZoomPopup = document.getElementById('cwZoomPopup');
        const cwZoomImg   = document.getElementById('cwZoomImg');

        const applyGridSize = cs => {
            cwGrid.style.setProperty('--cw-cell-size', cs + 'px');
            cwGrid.style.gridTemplateColumns = `repeat(${cols}, ${cs}px)`;
            cwGrid.style.gridTemplateRows    = `repeat(${rows}, ${cs}px)`;
        };
        applyGridSize(calcCellSize());
        window.addEventListener('resize', () => applyGridSize(calcCellSize()));

        // ── Maps ──────────────────────────────────────────────────────────
        const keyToCell  = {};
        const keyToInput = {};
        // cellWords[key] = [{wp, letterIdx}]  (one per word through that cell)
        const cellWords  = {};

        const startCellsMap = {};
        wordPlacements.forEach(w => { startCellsMap[`${w.x},${w.y}`] = w.originalIndex; });

        wordPlacements.forEach(wp => {
            for (let k = 0; k < wp.text.length; k++) {
                const key = `${wp.x + k*wp.dirX},${wp.y + k*wp.dirY}`;
                if (!cellWords[key]) cellWords[key] = [];
                cellWords[key].push({ wp, letterIdx: k });
            }
        });

        const wordCellKeys = {};
        wordPlacements.forEach(wp => {
            wordCellKeys[wp.originalIndex] = [];
            for (let k = 0; k < wp.text.length; k++)
                wordCellKeys[wp.originalIndex].push(`${wp.x + k*wp.dirX},${wp.y + k*wp.dirY}`);
        });

        const dirOf = wp => wp.dirX === 1 ? 'H' : 'V';

        // ── State ─────────────────────────────────────────────────────────
        let activeKey      = null;
        let activeDir      = 'H';
        let activeWordIdx  = null;   // clue panel selection
        const correctWords  = new Set();
        // key → original correct value: celle temporaneamente sbloccate per
        // permettere la scrittura dell'altra direzione
        const tempUnlocked  = new Map();

        const getEntry = (key, dir) =>
            (cellWords[key] || []).find(e => dirOf(e.wp) === dir);

        const isIntersection = key => (cellWords[key] || []).length > 1;

        // ── Direction indicator ───────────────────────────────────────────
        const updateIndicator = key => {
            cwGrid.querySelectorAll('.cw-dir-indicator').forEach(el => el.remove());
            const cell = keyToCell[key];
            if (!cell) return;
            const ind = document.createElement('div');
            ind.className = 'cw-dir-indicator';
            if (isIntersection(key)) {
                ['H','V'].forEach(d => {
                    const s = document.createElement('span');
                    s.className   = d === activeDir ? 'cw-dir-active' : 'cw-dir-inactive';
                    s.textContent = d === 'H' ? '→' : '↓';
                    ind.appendChild(s);
                });
            } else {
                const s = document.createElement('span');
                s.className   = 'cw-dir-active';
                s.textContent = activeDir === 'H' ? '→' : '↓';
                ind.appendChild(s);
            }
            cell.appendChild(ind);
        };

        // ── Word highlight ────────────────────────────────────────────────
        const highlightWord = idx => {
            cwGrid.querySelectorAll('.cw-cell.highlighted').forEach(c => c.classList.remove('highlighted'));
            if (idx != null)
                (wordCellKeys[idx] || []).forEach(k => keyToCell[k]?.classList.add('highlighted'));
        };

        // ── setActive: single source of truth for focus state ─────────────
        const setActive = (key, dir) => {
            activeKey = key;
            const words = cellWords[key] || [];
            if (dir) {
                activeDir = dir;
            } else if (words.length === 1) {
                activeDir = dirOf(words[0].wp);
            } else {
                // Intersezione: preferisci la direzione con parola non ancora corretta
                const currentDirEntry = words.find(e => dirOf(e.wp) === activeDir);
                if (currentDirEntry && !correctWords.has(currentDirEntry.wp.originalIndex)) {
                    // La direzione attuale è ancora valida (parola non corretta) → tienila
                } else {
                    const nonCorrect = words.find(e => !correctWords.has(e.wp.originalIndex));
                    if (nonCorrect) activeDir = dirOf(nonCorrect.wp);
                    else if (!currentDirEntry) activeDir = dirOf(words[0].wp);
                }
            }
            updateIndicator(key);
            const entry = getEntry(key, activeDir);
            highlightWord(entry ? entry.wp.originalIndex : null);
        };

        // ── Temporary unlock helpers ──────────────────────────────────────
        const tempUnlock = key => {
            if (tempUnlocked.has(key)) return; // already unlocked
            const inp  = keyToInput[key];
            const cell = keyToCell[key];
            if (!inp || !inp.readOnly) return;
            tempUnlocked.set(key, inp.value);
            inp.readOnly = false;
            cell?.classList.remove('cw-cell-correct');
        };

        const restoreLocked = key => {
            if (!tempUnlocked.has(key)) return;
            const inp  = keyToInput[key];
            const cell = keyToCell[key];
            inp.value    = tempUnlocked.get(key);
            inp.readOnly = true;
            cell?.classList.add('cw-cell-correct');
            tempUnlocked.delete(key);
        };

        // ── Word correct / wrong ──────────────────────────────────────────
        const markWordCorrect = wp => {
            if (correctWords.has(wp.originalIndex)) return;
            correctWords.add(wp.originalIndex);
            for (let k = 0; k < wp.text.length; k++) {
                const key = `${wp.x + k*wp.dirX},${wp.y + k*wp.dirY}`;
                tempUnlocked.delete(key); // ora è definitivamente corretto
                keyToCell[key]?.classList.add('cw-cell-correct');
                if (keyToInput[key]) keyToInput[key].readOnly = true;
            }
            if (correctWords.size === wordPlacements.length)
                this.onWin('Cruciverba completato perfettamente!');
        };

        const flashAndClear = (wp, triggerDir) => {
            const keys = wordCellKeys[wp.originalIndex];
            keys.forEach(k => keyToCell[k]?.classList.add('cw-cell-wrong'));
            setTimeout(() => {
                keys.forEach(k => {
                    keyToCell[k]?.classList.remove('cw-cell-wrong');
                    if (tempUnlocked.has(k)) {
                        restoreLocked(k); // ripristina la cella di intersezione
                    } else if (keyToInput[k] && !keyToInput[k].readOnly) {
                        keyToInput[k].value = '';
                    }
                });
                // Rimetti il focus alla prima cella libera della parola
                for (const k of keys) {
                    if (keyToInput[k] && !keyToInput[k].readOnly) {
                        setActive(k, triggerDir || dirOf(wp));
                        keyToInput[k].focus();
                        break;
                    }
                }
            }, 700);
        };

        const checkWordCompletion = (key, triggerDir) => {
            (cellWords[key] || []).forEach(({ wp }) => {
                if (correctWords.has(wp.originalIndex)) return;
                const inputs = wordCellKeys[wp.originalIndex].map(k => keyToInput[k]);
                if (!inputs.every(inp => inp && inp.value !== '')) return;
                const typed = inputs.map(inp => inp.value).join('');
                if (typed === wp.text) markWordCorrect(wp);
                else flashAndClear(wp, triggerDir);
            });
        };

        // ── Build grid ────────────────────────────────────────────────────
        gridInfo.forEach((char, key) => {
            const [x, y] = key.split(',').map(Number);

            const cell = document.createElement('div');
            cell.className        = 'cw-cell';
            cell.style.gridColumn = x - minX + 1;
            cell.style.gridRow    = y - minY + 1;
            keyToCell[key] = cell;

            if (startCellsMap[key]) {
                cell.classList.add('start-cell');
                const num = document.createElement('span');
                num.className   = 'cw-number';
                num.textContent = startCellsMap[key];
                cell.appendChild(num);
            }

            const input = document.createElement('input');
            input.maxLength       = 1;
            input.dataset.correct = char;
            input.dataset.key     = key;
            keyToInput[key] = input;

            // Track if focus already belonged to this cell before the click
            let wasActiveBeforeClick = false;
            cell.addEventListener('mousedown', () => {
                wasActiveBeforeClick = activeKey === key && document.activeElement === input;
            });
            cell.addEventListener('click', () => {
                if (!wasActiveBeforeClick) return; // focus handler will call setActive
                if (isIntersection(key)) {
                    activeDir = activeDir === 'H' ? 'V' : 'H';
                    updateIndicator(key);
                    const entry = getEntry(key, activeDir);
                    highlightWord(entry ? entry.wp.originalIndex : null);
                }
            });

            input.addEventListener('focus', () => {
                // Sblocca temporaneamente se è una cella corretta a un'intersezione
                // con una parola non ancora corretta
                if (input.readOnly) {
                    const hasNonCorrect = (cellWords[key] || [])
                        .some(e => !correctWords.has(e.wp.originalIndex));
                    if (hasNonCorrect) tempUnlock(key);
                }
                if (activeKey === key) return; // già gestito
                setActive(key);
            });

            input.addEventListener('keydown', e => {
                if (input.readOnly) return;
                const [cx, cy] = key.split(',').map(Number);

                if (e.key === 'Backspace') {
                    e.preventDefault();
                    if (input.value) { input.value = ''; return; }
                    const entry = getEntry(key, activeDir);
                    if (entry && entry.letterIdx > 0) {
                        const { wp, letterIdx } = entry;
                        const prevKey = `${wp.x + (letterIdx-1)*wp.dirX},${wp.y + (letterIdx-1)*wp.dirY}`;
                        if (keyToInput[prevKey]) {
                            // Sblocca temporaneamente se necessario
                            if (keyToInput[prevKey].readOnly) tempUnlock(prevKey);
                            setActive(prevKey, activeDir);
                            keyToInput[prevKey].focus();
                        }
                    }
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const t = `${cx-1},${cy}`;
                    if (keyToInput[t]) { setActive(t, 'H'); keyToInput[t].focus(); }
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const t = `${cx+1},${cy}`;
                    if (keyToInput[t]) { setActive(t, 'H'); keyToInput[t].focus(); }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const t = `${cx},${cy-1}`;
                    if (keyToInput[t]) { setActive(t, 'V'); keyToInput[t].focus(); }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const t = `${cx},${cy+1}`;
                    if (keyToInput[t]) { setActive(t, 'V'); keyToInput[t].focus(); }
                }
            });

            input.addEventListener('input', () => {
                if (input.readOnly) return;
                const val = input.value.replace(/\s/g, '');
                input.value = val ? val[val.length - 1].toUpperCase() : '';
                if (!input.value) return;

                // Avanza nella direzione corrente (sblocca temporaneamente se necessario)
                const entry = getEntry(key, activeDir);
                if (entry && entry.letterIdx < entry.wp.text.length - 1) {
                    const { wp, letterIdx } = entry;
                    const nextKey = `${wp.x + (letterIdx+1)*wp.dirX},${wp.y + (letterIdx+1)*wp.dirY}`;
                    const nextInp = keyToInput[nextKey];
                    if (nextInp) {
                        if (nextInp.readOnly) tempUnlock(nextKey);
                        activeKey = nextKey;
                        updateIndicator(nextKey);
                        nextInp.focus();
                    }
                }
                checkWordCompletion(key, activeDir);
            });

            cell.appendChild(input);
            cwGrid.appendChild(cell);
        });

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

        const showZoom = src => {
            if (!src || src === 'null') return;
            cwZoomImg.src = src;
            cwZoomPopup.style.display = 'block';
        };
        const hideZoom = () => { cwZoomPopup.style.display = 'none'; };

        document.getElementById('cwZoomClose').addEventListener('click', e => {
            e.stopPropagation();
            hideZoom();
            activeWordIdx = null;
            highlightWord(null);
            cwClues.querySelectorAll('.clue-item.active').forEach(c => c.classList.remove('active'));
        });

        // ── Clue panel ────────────────────────────────────────────────────
        wordPlacements.sort((a, b) => a.originalIndex - b.originalIndex).forEach(w => {
            const clue = document.createElement('div');
            clue.className         = 'clue-item';
            clue.dataset.wordIndex = w.originalIndex;

            const numSpan = document.createElement('span');
            numSpan.className   = 'clue-number';
            numSpan.textContent = w.originalIndex;
            clue.appendChild(numSpan);

            if (w.image && w.image !== 'null') {
                const wrapper = document.createElement('div');
                wrapper.className = 'clue-img-wrapper';
                const img = document.createElement('img');
                img.src = w.image; img.alt = 'indizio';
                wrapper.appendChild(img);
                const zBtn = document.createElement('button');
                zBtn.type = 'button'; zBtn.className = 'clue-zoom-btn'; zBtn.textContent = '🔍';
                zBtn.addEventListener('click', e => { e.stopPropagation(); showZoom(w.image); });
                wrapper.appendChild(zBtn);
                clue.appendChild(wrapper);
            } else {
                const noImg = document.createElement('span');
                noImg.className = 'clue-no-image'; noImg.textContent = '(nessuna immagine)';
                clue.appendChild(noImg);
            }

            clue.addEventListener('mouseenter', () => highlightWord(w.originalIndex));
            clue.addEventListener('mouseleave', () => highlightWord(activeWordIdx));
            clue.addEventListener('click', () => {
                cwClues.querySelectorAll('.clue-item.active').forEach(c => c.classList.remove('active'));
                if (activeWordIdx === w.originalIndex) {
                    activeWordIdx = null; highlightWord(null); hideZoom();
                } else {
                    activeWordIdx = w.originalIndex;
                    clue.classList.add('active');
                    highlightWord(w.originalIndex);
                    if (w.image && w.image !== 'null') showZoom(w.image);
                    const firstKey = `${w.x},${w.y}`;
                    if (keyToInput[firstKey]) {
                        setActive(firstKey, dirOf(w));
                        setTimeout(() => keyToInput[firstKey].focus(), 50);
                    }
                }
            });

            cwClues.appendChild(clue);
        });

        // Initial focus
        setTimeout(() => {
            const first = wordPlacements[0];
            if (!first) return;
            const firstKey = `${first.x},${first.y}`;
            setActive(firstKey, dirOf(first));
            keyToInput[firstKey]?.focus();
        }, 100);

        this.onRegisterSolution?.(() => {
            document.querySelectorAll('#cwGrid .cw-cell input').forEach(inp => {
                inp.value    = inp.dataset.correct;
                inp.readOnly = true;
                inp.closest('.cw-cell')?.classList.add('cw-cell-correct');
            });
            cwGrid.querySelectorAll('.cw-dir-indicator').forEach(el => el.remove());
        });

        this.onStartTimer();
    }
}
