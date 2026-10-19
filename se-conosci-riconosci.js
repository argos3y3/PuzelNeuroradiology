class SeConosci {
    constructor(container, words, callbacks = {}) {
        this.container    = container;
        this.words        = words;
        this.hiddenSolution = (callbacks.hiddenSolution || '').toUpperCase().replace(/\s/g, '');
        this.hiddenIsWord   = !!callbacks.hiddenIsWord;
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
        // Rows are saved in the order that spells the hidden word, so the numbers
        // shown on rows follow the shuffled order too: numbering them by saved
        // position would give the word away.
        const rowOrder = placements.map((_, i) => i);
        for (let i = rowOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rowOrder[i], rowOrder[j]] = [rowOrder[j], rowOrder[i]];
        }
        placements.forEach((p, i) => { p.row = rowOrder[i]; p.wordNum = rowOrder[i] + 1; });
        placements.sort((a, b) => a.row - b.row);

        const hiddenCol = Math.max(...placements.map(p => p.hiddenPos), 0);
        placements.forEach(p => { p.startX = hiddenCol - p.hiddenPos; });

        const totalCols = Math.max(...placements.map(p => p.startX + p.text.length));
        const totalRows = placements.length;

        // ── HTML ──────────────────────────────────────────────────────────
        // The grid takes the whole width; the row's picture is a floating window.
        this.container.innerHTML = `
            <div class="scr-layout">
                <div class="scr-grid-area" id="scrGridArea">
                    <div class="crossword-grid" id="cwGrid"></div>
                    <div class="scr-status" id="scrStatus"></div>
                    ${hiddenSol ? `
                    <div class="scr-hidden-bar" id="scrHiddenBar">
                        <div class="scr-hidden-row">
                            <label for="scrHiddenInput">Parola nascosta</label>
                            <input type="text" id="scrHiddenInput" autocomplete="off" autocapitalize="characters" spellcheck="false">
                            <button type="button" id="scrHiddenCheck">Verifica</button>
                        </div>
                        <div class="scr-hidden-error" id="scrHiddenError"></div>
                    </div>` : ''}
                </div>
                <div class="cw-image-float" id="scrImageFloat"></div>
            </div>
        `;

        const cwGrid   = document.getElementById('cwGrid');
        const gridArea = document.getElementById('scrGridArea');
        const status   = document.getElementById('scrStatus');
        const viewer   = createImageViewer(document.getElementById('scrImageFloat'), { floating: true });

        // ── Cell size ─────────────────────────────────────────────────────
        // Sized on the space the grid really has (the black box minus the message line
        // and the hidden-word bar), recomputed whenever it changes: the on-screen
        // keyboard appears after this runs. If the grid still doesn't fit, the box scrolls.
        const fitCellSize = () => {
            const st  = getComputedStyle(gridArea);
            const gap = parseFloat(st.rowGap) || 0;
            const below = [...gridArea.children].filter(el => el !== cwGrid)
                .reduce((h, el) => h + el.offsetHeight + gap, 0);
            const availW = gridArea.clientWidth  - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
            const availH = gridArea.clientHeight - parseFloat(st.paddingTop)  - parseFloat(st.paddingBottom) - below;
            const byW = Math.floor((availW - (totalCols - 1) * 2) / totalCols);
            const byH = Math.floor((availH - (totalRows - 1) * 2) / totalRows);
            return Math.max(12, Math.min(48, byW, byH));
        };
        const applyGridSize = () => {
            const cs = fitCellSize();
            cwGrid.style.setProperty('--cw-cell-size', cs + 'px');
            cwGrid.style.gridTemplateColumns = `repeat(${totalCols}, ${cs}px)`;
            cwGrid.style.gridTemplateRows    = `repeat(${totalRows}, ${cs}px)`;
        };
        applyGridSize();
        new ResizeObserver(applyGridSize).observe(gridArea);

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

        // ── Rows checked like in the crossword ────────────────────────────
        // A completed row turns green and is locked when right; when wrong it flashes
        // red and is emptied. Wrong rows never end the game: only the timer does.
        const solvedRows = new Set();
        const firstOpenRow = (from) => {
            for (let i = 0; i < totalRows; i++) {
                const r = (from + i) % totalRows;
                if (!solvedRows.has(r)) return r;
            }
            return -1;
        };
        const checkRow = (rowIdx) => {
            const rowArr = rowInputs[rowIdx];
            if (rowArr.every(inp => inp.value === inp.dataset.correct)) {
                solvedRows.add(rowIdx);
                rowArr.forEach(inp => {
                    inp.readOnly = true;
                    inp.closest('.cw-cell').classList.add('cw-cell-correct');
                });
                const next = firstOpenRow(rowIdx + 1);
                if (next === -1) allRowsSolved();
                else rowInputs[next][0].focus();
            } else {
                rowArr.forEach(inp => inp.closest('.cw-cell').classList.add('cw-cell-wrong'));
                setTimeout(() => {
                    rowArr.forEach(inp => {
                        inp.closest('.cw-cell').classList.remove('cw-cell-wrong');
                        inp.value = '';
                    });
                    rowArr[0].focus();
                }, 700);
            }
        };
        const allRowsSolved = () => {
            if (!hiddenSol) { this.onWin('Cruciverba completato perfettamente!'); return; }
            // every row is right: the game is won only by typing the hidden word
            status.textContent = 'Dunque la parola nascosta è..?';
            document.getElementById('scrHiddenInput')?.focus();
        };

        // ── Input event handling ──────────────────────────────────────────
        rowInputs.forEach((rowArr, rowIdx) => {
            rowArr.forEach((input, colIdx) => {
                input.addEventListener('focus', () => selectRow(placements.find(pl => pl.row === rowIdx)));

                input.addEventListener('input', () => {
                    if (input.readOnly) return;
                    input.value = input.value.replace(/\s/g, '').toUpperCase();
                    if (input.value === '') return;
                    if (rowArr.every(inp => inp.value !== '')) { checkRow(rowIdx); return; }
                    if (colIdx < rowArr.length - 1) rowArr[colIdx + 1].focus();
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace') {
                        // Like a normal keyboard: delete this letter, or from an empty
                        // cell step back and delete the previous one (solved rows are locked)
                        e.preventDefault();
                        if (input.value) {
                            if (!input.readOnly) input.value = '';
                        } else {
                            const prevInp = colIdx > 0 ? rowArr[colIdx - 1]
                                : rowIdx > 0 ? rowInputs[rowIdx - 1][rowInputs[rowIdx - 1].length - 1] : null;
                            if (prevInp) {
                                prevInp.focus();
                                if (!prevInp.readOnly) prevInp.value = '';
                            }
                        }
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
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const next = firstOpenRow(rowIdx + 1);
                        if (next !== -1) rowInputs[next][0].focus();
                    }
                });
            });
        });

        if (rowInputs.length > 0) setTimeout(() => rowInputs[0][0]?.focus(), 100);

        // ── Row highlight and picture ─────────────────────────────────────
        const highlightRow = (p) => {
            cwGrid.querySelectorAll('.cw-cell.highlighted').forEach(c => c.classList.remove('highlighted'));
            for (let k = 0; k < p.text.length; k++) {
                keyToCell[`${p.row},${p.startX + k}`]?.classList.add('highlighted');
            }
        };
        // Moving to another row shows its picture in the floating window (fitted);
        // staying on the same row keeps the zoom the player chose.
        let shownRow = null;
        const selectRow = (p) => {
            if (!p) return;
            highlightRow(p);
            if (shownRow === p.row) return;
            shownRow = p.row;
            viewer.show(p.image, String(p.wordNum));
        };

        // ── Hidden word bar ───────────────────────────────────────────────
        // Typing the hidden word wins at any time, even with rows still empty.
        const hiddenInput = document.getElementById('scrHiddenInput');
        if (hiddenInput) {
            const hiddenError = document.getElementById('scrHiddenError');
            const tryHiddenWord = () => {
                const typed = hiddenInput.value.toUpperCase().replace(/\s/g, '');
                if (!typed) return;
                if (this.isHiddenWord(typed)) {
                    hiddenInput.readOnly = true;
                    hiddenError.textContent = '';
                    this.onWin('Hai trovato la parola nascosta!');
                } else {
                    hiddenError.textContent = 'Non è la parola nascosta. Riprova!';
                    hiddenInput.classList.add('scr-hidden-wrong');
                    setTimeout(() => hiddenInput.classList.remove('scr-hidden-wrong'), 600);
                }
            };
            hiddenInput.addEventListener('input', () => {
                hiddenInput.value = hiddenInput.value.toUpperCase();
                hiddenError.textContent = '';
            });
            hiddenInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); tryHiddenWord(); }
            });
            document.getElementById('scrHiddenCheck').addEventListener('click', tryHiddenWord);
        }

        this.onRegisterSolution?.(() => {
            document.querySelectorAll('#cwGrid .cw-cell input').forEach(inp => {
                inp.value    = inp.dataset.correct;
                inp.readOnly = true;
                inp.closest('.cw-cell').classList.add('cw-cell-correct');
            });
            document.getElementById('scrHiddenBar')?.remove();
            status.remove();
        });

        this.onStartTimer();
    }

    // Activities saved with the real hidden word require it exactly. Older ones stored
    // one letter per row in whatever order the rows had, usually not spelling the word:
    // for those accept any word made of exactly those letters.
    isHiddenWord(typed) {
        if (this.hiddenIsWord) return typed === this.hiddenSolution;
        const letters = (w) => [...w].sort().join('');
        return letters(typed) === letters(this.hiddenSolution);
    }
}
