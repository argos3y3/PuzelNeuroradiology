function initGuessWhat(container, data, callbacks) {
    const { image, labels } = data;

    if (!image || !labels || labels.length === 0) {
        container.innerHTML = '<p style="padding:40px;color:#888;text-align:center;">Contenuto non disponibile.</p>';
        callbacks.onStartTimer();
        return;
    }

    container.innerHTML = `
        <div class="gw-layout">
            <div class="gw-image-area">
                <div class="gw-img-wrapper" id="gwImgWrapper">
                    <img src="${image}" class="gw-image" id="gwImage" alt="Immagine">
                </div>
            </div>
            <div class="gw-answers" id="gwAnswers"></div>
            <svg id="gwLineSvg" class="gw-line-svg" xmlns="http://www.w3.org/2000/svg">
                <line id="gwActiveLine" stroke="#7c3aed" stroke-width="1.5"
                      opacity="0.75" display="none"/>
            </svg>
        </div>
    `;

    const imgEl      = document.getElementById('gwImage');
    const answersDiv = document.getElementById('gwAnswers');
    const svg        = document.getElementById('gwLineSvg');
    const lineEl     = document.getElementById('gwActiveLine');

    function showLine(label, badgeEl) {
        const sr      = svg.getBoundingClientRect();
        const imgRect = imgEl.getBoundingClientRect();
        const x1 = imgRect.left + label.x / 100 * imgRect.width  - sr.left;
        const y1 = imgRect.top  + label.y / 100 * imgRect.height - sr.top;
        const br  = badgeEl.getBoundingClientRect();
        const x2  = br.left + br.width  / 2 - sr.left;
        const y2  = br.top  + br.height / 2 - sr.top;
        lineEl.setAttribute('x1', x1);
        lineEl.setAttribute('y1', y1);
        lineEl.setAttribute('x2', x2);
        lineEl.setAttribute('y2', y2);
        lineEl.removeAttribute('display');
    }
    function hideLine() { lineEl.setAttribute('display', 'none'); }

    const inputEls = [];

    labels.forEach((label, idx) => {
        const row = document.createElement('div');
        row.className = 'gw-input-row';

        const numBadge = document.createElement('span');
        numBadge.className   = 'gw-input-num';
        numBadge.textContent = idx + 1;

        const input = document.createElement('input');
        input.type         = 'text';
        input.className    = 'gw-input';
        input.placeholder  = 'Risposta...';
        input.autocomplete = 'off';

        row.appendChild(numBadge);
        row.appendChild(input);
        answersDiv.appendChild(row);
        inputEls.push(input);

        input.addEventListener('focus', () => showLine(label, numBadge));
        input.addEventListener('blur',  hideLine);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const next = inputEls[idx + 1];
                if (next) next.focus();
                else input.blur();
            }
        });
    });

    // VERIFICA
    const checkBtn = document.createElement('button');
    checkBtn.type        = 'button';
    checkBtn.className   = 'gw-check-btn';
    checkBtn.textContent = 'VERIFICA';
    answersDiv.appendChild(checkBtn);

    checkBtn.addEventListener('click', () => {
        let allCorrect = true;

        inputEls.forEach((input, i) => {
            const ok = input.value.trim().toLowerCase() === labels[i].name.trim().toLowerCase();
            input.classList.toggle('gw-correct', ok);
            input.classList.toggle('gw-wrong',   !ok);
            if (!ok) { allCorrect = false; input.readOnly = false; }
            else      { input.readOnly = true; }
        });

        if (allCorrect) callbacks.onWin('Perfetto! Tutte le strutture identificate correttamente!');
    });

    callbacks.onRegisterSolution?.(() => {
        inputEls.forEach((input, i) => {
            input.value    = labels[i].name;
            input.readOnly = true;
            input.classList.remove('gw-wrong');
            input.classList.add('gw-correct');
        });
        hideLine();
    });

    callbacks.onStartTimer();
}
