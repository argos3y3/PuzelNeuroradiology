// commonQuestion (optional, set in the editor): { options: [...], correctIndex }. When present,
// finding the right images opens the question "Cosa hanno in comune le immagini?": a wrong
// option flashes red and the player chooses again, and the win message reports how many
// attempts the images and the question took. Without it the images alone decide.
function initTrovaIntruso(container, images, callbacks, commonQuestion) {
    // Randomize the on-screen order on every play, so the intruder's position
    // isn't memorizable across attempts.
    images = [...images];
    for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]];
    }

    const question = commonQuestion && Array.isArray(commonQuestion.options) &&
                     commonQuestion.options.length >= 2 ? commonQuestion : null;
    const rightAnswer = question ? question.options[question.correctIndex] : '';
    // options in a new random order on every play, like the images
    const options = question ? question.options.map((text, i) => ({ text, correct: i === question.correctIndex })) : [];
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

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
        <div class="ti-question-popup" id="tiQuestionPopup">
            <div class="ti-question-box">
                <button type="button" class="ti-question-close" id="tiQuestionClose" title="Torna alle immagini">×</button>
                <div class="ti-question-title">Cosa hanno in comune le immagini?</div>
                <div class="ti-question-options" id="tiQuestionOptions"></div>
            </div>
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
    const questionPopup = document.getElementById('tiQuestionPopup');
    const openQuestion  = () => { questionPopup.style.display = 'flex'; };
    const closeQuestion = () => { questionPopup.style.display = 'none'; };
    // closing it goes back to the images; UNLOCK asks again
    document.getElementById('tiQuestionClose').addEventListener('click', closeQuestion);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (zoomPopup.style.display === 'flex') closeZoom();
        else if (questionPopup.style.display === 'flex') closeQuestion();
    });

    const attempt = n => n === 1 ? 'al primo tentativo' : `al ${n}° tentativo`;
    let imageTries = 0;      // UNLOCK presses so far
    let imagesFoundAt = 0;   // the press that found the right images
    let questionTries = 0;
    const optionsBox = document.getElementById('tiQuestionOptions');
    options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ti-option-btn';
        btn.innerHTML = `<span class="ti-option-letter">${String.fromCharCode(65 + i)}</span><span></span>`;
        btn.lastChild.textContent = opt.text;
        btn.addEventListener('click', () => {
            questionTries++;
            if (!opt.correct) {
                // flash red for a moment, then the player picks again
                btn.classList.remove('ti-option-wrong');
                void btn.offsetWidth; // restart the animation on a repeated click
                btn.classList.add('ti-option-wrong');
                return;
            }
            closeQuestion();
            callbacks.onWin(`Hai trovato il gruppo di immagini associate ${attempt(imagesFoundAt)}.\n` +
                            `Hai indovinato cosa hanno in comune («${rightAnswer}») ${attempt(questionTries)}.`);
        });
        btn.addEventListener('animationend', () => btn.classList.remove('ti-option-wrong'));
        optionsBox.appendChild(btn);
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
        const nonIntrusoIndices = new Set(
            images.map((item, idx) => item.isIntruso ? -1 : idx).filter(i => i >= 0)
        );

        const correct = selected.size === nonIntrusoIndices.size &&
                        [...selected].every(i => nonIntrusoIndices.has(i));

        imageTries++;
        if (!correct) tiError.style.display = 'block';
        else if (question) {
            if (!imagesFoundAt) imagesFoundAt = imageTries; // reopening after × doesn't count again
            openQuestion();
        }
        else callbacks.onWin('Hai selezionato correttamente tutte le strutture della stessa categoria!');
    });

    callbacks.onRegisterSolution?.(() => {
        const cards = [...document.querySelectorAll('.ti-img-card')];
        images.forEach((item, idx) => {
            cards[idx]?.classList.toggle('selected', !item.isIntruso);
        });
        tiError.style.display = 'none';
        closeQuestion();
        if (question) {
            const instr = container.querySelector('.ti-instruction');
            instr.textContent = 'Cosa hanno in comune le immagini? ';
            const b = document.createElement('strong');
            b.textContent = rightAnswer;
            instr.appendChild(b);
        }
    });

    callbacks.onStartTimer();
}
