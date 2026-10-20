function initPassaESpassa(container, phrases, callbacks) {
    if (!phrases || phrases.length === 0) {
        container.innerHTML = '<p style="padding:40px;color:#888;text-align:center;">Nessuna frase disponibile.</p>';
        callbacks.onStartTimer();
        return;
    }

    container.innerHTML = `<div class="pps-layout" id="ppsCards"></div>`;

    const cardsContainer = document.getElementById('ppsCards');
    const allBlanks   = [];
    // The keyboard has no accents: compare letters without them (E is accepted for È)
    const plain = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const allInputEls = []; // flat, ordered list of every letter-box across all phrases

    function focusNext(fromIdx) {
        for (let i = fromIdx + 1; i < allInputEls.length; i++) {
            if (!allInputEls[i].readOnly) { allInputEls[i].focus(); return; }
        }
    }
    function focusPrev(fromIdx) {
        for (let i = fromIdx - 1; i >= 0; i--) {
            if (!allInputEls[i].readOnly) { allInputEls[i].focus(); return; }
        }
    }

    phrases.forEach((phrase, phraseIdx) => {
        const tokens    = phrase.text.trim().split(/\s+/).filter(t => t.length > 0);
        const blanksSet = new Set(phrase.blanks || []);

        const card = document.createElement('div');
        card.className = 'pps-card';

        if (phrase.instruction && phrase.instruction.trim()) {
            const instr = document.createElement('div');
            instr.className = 'pps-instruction-text';
            instr.textContent = phrase.instruction;
            card.appendChild(instr);
        }

        const topRow      = document.createElement('div');
        topRow.className  = 'pps-top';
        // the outer box has the available size; the inner one is the text, measured to fit
        const sentenceBox = document.createElement('div');
        sentenceBox.className = 'pps-sentence';
        const sentenceDiv = document.createElement('div');
        sentenceDiv.className = 'pps-sentence-inner';
        sentenceBox.appendChild(sentenceDiv);

        tokens.forEach((token, idx) => {
            if (idx > 0) sentenceDiv.appendChild(document.createTextNode(' '));
            if (blanksSet.has(idx)) {
                const group = document.createElement('span');
                group.className       = 'pps-blank-group';
                group.dataset.correct = token;
                group.dataset.phrase  = phraseIdx;

                const parts    = []; // { type:'input'|'static', el, char? }
                const inputEls = []; // inputs for this group only (for verification)

                token.split('').forEach(char => {
                    if (/[a-zA-ZÀ-ÿ0-9]/.test(char)) {
                        const box = document.createElement('input');
                        box.type           = 'text';
                        box.maxLength      = 1;
                        box.className      = 'pps-letter-box';
                        box.autocomplete   = 'off';
                        box.autocorrect    = 'off';
                        box.autocapitalize = 'characters';
                        box.spellcheck     = false;

                        box.addEventListener('keydown', e => {
                            if (group.classList.contains('pps-correct')) { e.preventDefault(); return; }
                            const gi = allInputEls.indexOf(box);
                            if (e.key === 'Backspace') {
                                e.preventDefault();
                                if (box.value) {
                                    box.value = '';
                                } else {
                                    // Like a normal keyboard: step back and delete the previous letter
                                    focusPrev(gi);
                                    const prev = document.activeElement;
                                    if (prev !== box && allInputEls.includes(prev) && !prev.closest('.pps-correct')) prev.value = '';
                                }
                            } else if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                focusPrev(gi);
                            } else if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                focusNext(gi);
                            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                                box.value = ''; // clear so input event can replace
                            }
                        });

                        box.addEventListener('input', () => {
                            if (group.classList.contains('pps-correct')) return;
                            const cleaned = box.value.replace(/\s/g, '');
                            box.value = cleaned ? cleaned[cleaned.length - 1].toUpperCase() : '';
                            if (!box.value) return;
                            if (inputEls.every(i => i.value)) { checkBlank(blank); return; }
                            // reaching the last letter with gaps (started from the middle) is a wrong answer
                            if (box === inputEls[inputEls.length - 1]) { blankWrong(blank); return; }
                            focusNext(allInputEls.indexOf(box));
                        });

                        box.addEventListener('focus', () => box.select());

                        parts.push({ type: 'input', el: box });
                        inputEls.push(box);
                        allInputEls.push(box); // register globally in document order
                        group.appendChild(box);
                    } else {
                        const sep = document.createElement('span');
                        sep.className   = 'pps-letter-sep';
                        sep.textContent = char;
                        parts.push({ type: 'static', char, el: sep });
                        group.appendChild(sep);
                    }
                });

                const blank = { el: group, parts, inputEls };
                allBlanks.push(blank);
                sentenceDiv.appendChild(group);
            } else {
                sentenceDiv.appendChild(document.createTextNode(token));
            }
        });

        topRow.appendChild(sentenceBox);

        if (phrase.image && phrase.image !== 'null') {
            const imgWrap = document.createElement('div');
            imgWrap.className = 'pps-image-wrap';
            const img = document.createElement('img');
            img.src       = phrase.image;
            img.className = 'pps-image';
            imgWrap.appendChild(img);
            topRow.appendChild(imgWrap);
        }

        card.appendChild(topRow);
        cardsContainer.appendChild(card);
    });

    // A word is checked as soon as all its letters are typed, like in the crossword:
    // right → green and locked; wrong → red, then emptied to try again.
    function checkBlank({ el: group, parts, inputEls }) {
        const typed = parts.map(p => p.type === 'input' ? p.el.value : p.char).join('');
        if (plain(typed) === plain(group.dataset.correct)) {
            group.classList.add('pps-correct');
            inputEls.forEach(i => { i.readOnly = true; });
            if (allBlanks.every(b => b.el.classList.contains('pps-correct'))) {
                callbacks.onWin('Complimenti! Tutti gli spazi sono corretti!');
                return;
            }
            focusNext(allInputEls.indexOf(inputEls[inputEls.length - 1]));
        } else {
            blankWrong({ el: group, inputEls });
        }
    }
    function blankWrong({ el: group, inputEls }) {
        group.classList.add('pps-wrong');
        setTimeout(() => {
            group.classList.remove('pps-wrong');
            inputEls.forEach(i => { i.value = ''; });
            inputEls[0].focus();
        }, 700);
    }

    // Text as big as its box allows: the largest font size at which the sentence
    // (and its letter boxes, sized in em) still fits. Redone whenever the space changes,
    // e.g. when the on-screen keyboard appears.
    function fitText() {
        cardsContainer.querySelectorAll('.pps-sentence').forEach(box => {
            const inner = box.firstElementChild;
            let lo = 14, hi = 80;
            while (hi - lo > 1) {
                const mid = Math.floor((lo + hi) / 2);
                box.style.fontSize = mid + 'px';
                if (inner.scrollHeight <= box.clientHeight && inner.scrollWidth <= box.clientWidth) lo = mid;
                else hi = mid;
            }
            box.style.fontSize = lo + 'px';
        });
    }
    fitText();
    new ResizeObserver(fitText).observe(cardsContainer);

    callbacks.onRegisterSolution?.(() => {
        allBlanks.forEach(({ el: group, parts }) => {
            const correct = group.dataset.correct || '';
            // parts[i] maps 1-to-1 with correct[i]
            parts.forEach((p, i) => {
                if (p.type === 'input') {
                    p.el.value    = (correct[i] || '').toUpperCase();
                    p.el.readOnly = true;
                }
            });
            group.classList.remove('pps-wrong');
            group.classList.add('pps-correct');
        });
    });

    callbacks.onStartTimer();
}
