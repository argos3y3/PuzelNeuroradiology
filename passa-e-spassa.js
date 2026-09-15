function initPassaESpassa(container, phrases, callbacks) {
    if (!phrases || phrases.length === 0) {
        container.innerHTML = '<p style="padding:40px;color:#888;text-align:center;">Nessuna frase disponibile.</p>';
        callbacks.onStartTimer();
        return;
    }

    container.innerHTML = `
        <div class="pps-layout">
            <div id="ppsCards"></div>
            <div class="pps-footer">
                <button type="button" class="pps-check-btn" id="ppsCheck">VERIFICA</button>
            </div>
        </div>
    `;

    const cardsContainer = document.getElementById('ppsCards');
    const allBlanks   = [];
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
        const sentenceDiv = document.createElement('div');
        sentenceDiv.className = 'pps-sentence';

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
                                    focusPrev(gi);
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
                            if (group.classList.contains('pps-correct')) { box.value = ''; return; }
                            const cleaned = box.value.replace(/\s/g, '');
                            box.value = cleaned ? cleaned[cleaned.length - 1].toUpperCase() : '';
                            if (box.value) {
                                const gi = allInputEls.indexOf(box);
                                focusNext(gi);
                            }
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

                allBlanks.push({ el: group, parts, inputEls });
                sentenceDiv.appendChild(group);
            } else {
                sentenceDiv.appendChild(document.createTextNode(token));
            }
        });

        topRow.appendChild(sentenceDiv);

        if (phrase.image && phrase.image !== 'null') {
            const img = document.createElement('img');
            img.src       = phrase.image;
            img.className = 'pps-image';
            topRow.appendChild(img);
        }

        card.appendChild(topRow);
        cardsContainer.appendChild(card);
    });

    document.getElementById('ppsCheck').addEventListener('click', () => {
        allBlanks.forEach(({ el: group, parts, inputEls }) => {
            if (group.classList.contains('pps-correct')) return;
            if (!inputEls.some(i => i.value)) return; // skip fully empty

            const typed   = parts.map(p => p.type === 'input' ? p.el.value : p.char).join('');
            const correct = group.dataset.correct;

            if (typed.toUpperCase() === correct.toUpperCase()) {
                group.classList.add('pps-correct');
                inputEls.forEach(i => { i.readOnly = true; });
            } else {
                group.classList.add('pps-wrong');
                setTimeout(() => {
                    group.classList.remove('pps-wrong');
                    inputEls.forEach(i => { i.value = ''; i.readOnly = false; });
                    if (inputEls.length) inputEls[0].focus();
                }, 900);
            }
        });

        const total   = allBlanks.length;
        const correct = allBlanks.filter(({ el }) => el.classList.contains('pps-correct')).length;
        if (correct === total) callbacks.onWin('Complimenti! Tutti gli spazi sono corretti!');
    });

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
