function initRadiazione(container, questions, callbacks) {
    let currentIdx = 0;
    let correctCount = 0;
    let answered = false;
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];

    function render() {
        answered = false;
        const q = questions[currentIdx];
        const pct = Math.round(((currentIdx + 1) / questions.length) * 100);
        const isLast = currentIdx === questions.length - 1;

        container.innerHTML = `
            <div class="rac-layout">
                <div class="rac-progress-row">
                    <div class="rac-bar-track">
                        <div class="rac-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="rac-counter">${currentIdx + 1} / ${questions.length}</span>
                </div>
                <div class="rac-question-card">
                    ${q.image ? `
                    <div class="rac-img-wrapper">
                        <img class="rac-q-image" src="${q.image}" alt="">
                        <button type="button" class="rac-zoom-btn" id="racZoomBtn">🔍</button>
                    </div>` : ''}
                    <p class="rac-question-text">${q.question}</p>
                </div>
                <div class="rac-answers-grid" id="racAnswers"></div>
                <div class="rac-next-wrap" id="racNextWrap" style="display:none;">
                    <button type="button" class="rac-next-btn" id="racNext">
                        ${isLast ? 'RISULTATI' : 'PROSSIMA DOMANDA'}
                    </button>
                </div>
            </div>
            ${q.image ? `
            <div class="rac-zoom-popup" id="racZoomPopup">
                <button type="button" class="rac-zoom-close" id="racZoomClose">×</button>
                <img class="rac-zoom-img" src="${q.image}" alt="">
            </div>` : ''}
        `;

        const zoomPopup = document.getElementById('racZoomPopup');
        if (zoomPopup) {
            const openZoom  = () => { zoomPopup.style.display = 'flex'; };
            const closeZoom = () => { zoomPopup.style.display = 'none'; };
            document.getElementById('racZoomBtn').addEventListener('click', openZoom);
            document.getElementById('racZoomClose').addEventListener('click', closeZoom);
            zoomPopup.addEventListener('click', (e) => { if (e.target === zoomPopup) closeZoom(); });
            document.addEventListener('keydown', function escClose(e) {
                if (e.key === 'Escape') { closeZoom(); document.removeEventListener('keydown', escClose); }
            });
        }

        const grid = document.getElementById('racAnswers');
        q.answers.forEach((ans, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rac-answer-btn';
            btn.innerHTML = `
                <span class="rac-answer-label">${labels[i]}</span>
                <span class="rac-answer-text">${ans}</span>
                <span class="rac-answer-icon"></span>
            `;
            btn.addEventListener('click', () => handleAnswer(i));
            grid.appendChild(btn);
        });

        document.getElementById('racNext').addEventListener('click', nextQuestion);
    }

    function handleAnswer(chosenIdx) {
        if (answered) return;
        answered = true;
        const q = questions[currentIdx];
        const correct = q.correctIndex;
        const btns = [...document.querySelectorAll('.rac-answer-btn')];
        const icons = [...document.querySelectorAll('.rac-answer-icon')];

        btns.forEach(btn => { btn.disabled = true; btn.style.pointerEvents = 'none'; });

        if (chosenIdx === correct) {
            btns[chosenIdx].classList.add('rac-correct');
            icons[chosenIdx].textContent = '✓';
            correctCount++;
        } else {
            btns[chosenIdx].classList.add('rac-wrong');
            icons[chosenIdx].textContent = '✗';
            btns[correct].classList.add('rac-correct');
            icons[correct].textContent = '✓';
        }

        document.getElementById('racNextWrap').style.display = 'flex';
    }

    function nextQuestion() {
        currentIdx++;
        if (currentIdx >= questions.length) {
            if (correctCount === questions.length) {
                callbacks.onWin(`Perfetto! ${correctCount}/${questions.length} risposte corrette!`);
            } else {
                callbacks.onLose(`${correctCount}/${questions.length} risposte corrette.`);
            }
        } else {
            render();
        }
    }

    callbacks.onRegisterSolution?.(() => {
        container.innerHTML = `
            <div class="rac-layout" style="overflow-y:auto;">
                ${questions.map((q, i) => `
                    <div class="rac-question-card">
                        ${q.image ? `<div class="rac-img-wrapper" style="margin-bottom:10px;">
                            <img class="rac-q-image" src="${q.image}" alt="" style="max-height:140px;">
                        </div>` : ''}
                        <p class="rac-question-text" style="font-size:15px;margin-bottom:10px;">${q.question}</p>
                        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f0fdf4;border:1.5px solid #22c55e;border-radius:50px;">
                            <span style="width:26px;height:26px;border-radius:50%;background:#22c55e;color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;flex-shrink:0;">${labels[q.correctIndex]||''}</span>
                            <span style="font-size:14px;color:#166534;font-weight:600;">${q.answers[q.correctIndex]}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    });

    render();
    callbacks.onStartTimer();
}
