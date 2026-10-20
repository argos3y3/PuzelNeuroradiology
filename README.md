# PuzelNeuroradiology

Piattaforma web di mini-giochi didattici (anatomia/neuroradiologia), online su [anatomiadi.eu](https://anatomiadi.eu). Vanilla HTML/CSS/JS, nessun framework, nessuna build. Persistenza su Cloud Firestore, hosting su Firebase Hosting.

## Stack e hosting

- **Nessun build step**: `firebase.json` pubblica la root del repo (`"public": "."`) così com'è, escludendo tutto ciò che non serve al sito (vedi [Struttura delle cartelle](#struttura-delle-cartelle)).
- **Firestore** come unico backend, progetto `olimpiadi-radiologia` (config in [script/comune/firebase-init.js](script/comune/firebase-init.js): `apiKey` pubblica lato client — normale per Firebase, la sicurezza reale è nelle regole Firestore, non nella segretezza della chiave).
- **Nessun Firebase Auth**: login in [pagine/login.html](pagine/login.html) è un controllo hardcoded lato client (`admin/admin`, `agente/agente`, `utente1/utente1`, `utente2/utente2`), stato tenuto in `sessionStorage`. L'account `agente` vede solo la cartella `agente_selezione` (copia di 21 attività, una per tipo di gioco e livello) e può giocare/vedere la soluzione ma non modificare. Chi integra un'interfaccia diversa dovrà sostituire questo meccanismo con qualcosa di reale.
- **Deploy**: `firebase deploy --only hosting` (richiede CLI autenticata sul progetto in [.firebaserc](.firebaserc)).
- Le immagini delle attività sono salvate come base64 compresso **dentro i documenti Firestore** (niente Firebase Storage).

## Struttura delle cartelle

| Percorso | Contenuto | Online | Su GitHub |
|---|---|---|---|
| `pagine/` | tutte le pagine HTML e i CSS (`style.css`, `folders.css`) | sì | sì |
| `script/comune/` | `firebase-init.js`, connessione a Firestore usata da tutte le pagine | sì | sì |
| `script/giochi/` | i motori dei giochi caricati da `game.html` e `image-viewer.js` (riquadro immagine con zoom dei giochi a griglia) | sì | sì |
| `script/dashboard/` | `folders.js` (per `folders.html`) e `index.js` (per `index.html`) | sì | sì |
| `script/statistiche/` | `stats.js` (per `stats.html`) | sì | sì |
| `script/puzzel/` | script Python per scaricare le attività da puzzel.org | no | sì (tranne `lista_codici_puzzel.py`) |
| `script/integrazione/` | pagine di prova locali per l'iframe di `play.html` | no | no |
| `documenti/` | documenti e appunti (pdf, txt, rtf) | no | no |
| `outputs/` | file prodotti dagli script e copie dei dati (immagini scaricate, backup, elenco codici, `stato.json`) | no | solo `stato.json` |
| `catalogo.json` | valori ammessi da `play.html` (zone, difficoltà, tipi) | sì | sì |
| `404.html` | pagina di errore di Firebase Hosting: deve restare nella root | sì | sì |

### Indirizzi delle pagine

Le pagine stanno in `pagine/` ma restano raggiungibili ai loro indirizzi pubblici di sempre (`anatomiadi.eu/play.html`, `anatomiadi.eu/game.html`, …): in `firebase.json` → `hosting.rewrites` ogni `/<pagina>.html` (e `/`, che apre `index.html`) è servito dal file in `pagine/` senza redirect, quindi l'indirizzo nel browser non cambia. Funziona anche `anatomiadi.eu/pagine/<pagina>.html`.

Per questo dentro le pagine:
- CSS, script, import dei moduli e `catalogo.json` usano **percorsi assoluti** (`/pagine/style.css`, `/script/giochi/crossword.js`, `import … from '/script/comune/firebase-init.js'`, `fetch('/catalogo.json')`), validi da entrambi gli indirizzi;
- i link tra pagine restano **relativi** (`editor.html?id=…`), così portano alla pagina giusta sia da `/` sia da `/pagine/`;
- i moduli in `script/` importano `firebase-init.js` con percorsi relativi al file stesso (`../comune/firebase-init.js`).

**Aggiungendo una pagina nuova** va aggiunta anche la sua riga in `hosting.rewrites`.

### Provare il sito in locale

- `firebase serve --only hosting` dalla root applica le stesse regole del sito online: le pagine si aprono ai soliti indirizzi (`http://localhost:5000/login.html`).
- In alternativa `python3 -m http.server 8765` dalla root, aprendo le pagine da `http://localhost:8765/pagine/login.html` (questo server non conosce i rewrite).

In entrambi i casi i dati sono quelli veri su Firestore: salvare un'attività o giocare una partita scrive nel database del sito.

## Compatibilità: schermi Samsung (Chromium 85)

Il sito gira anche su schermi Samsung con **TizenBrowser 5.2, motore Chromium 85**, che non si possono aggiornare. Su quel motore una sola istruzione non supportata in uno `<script type="module">` blocca tutta la pagina in silenzio (resta su "Caricamento…"). Quindi:

- niente top-level await: il codice dei moduli è avvolto in `(async () => { … })()`, con gli `import` fuori;
- JavaScript fino a ES2020 (più `||=`), niente API successive a Chrome 85 (`.at()`, `structuredClone`, `findLast`, `Object.hasOwn`, `crypto.randomUUID`…);
- CSS: niente `inset` (usare top/right/bottom/left), `aspect-ratio` solo con alternativa in `@supports not`, niente `:is`/`:where`/`:has`.

[anatomiadi.eu/diag.html](pagine/diag.html) mostra motore e funzionalità supportate dal browser che la apre (utile da fotografare sullo schermo). Chromium 85 chiede anche un indirizzo inesistente `url('https://fonts.googleapis.com/…` (404): è un difetto del suo preload scanner con gli `@import` dei font, innocuo — il font si carica comunque.

## Gerarchia pagine (chi chiama chi)

```
login.html ──(admin)──> home.html ─┬─> folders.html ──> editor.html (crea/modifica attività)
                                    │                       │
                                    ├─> stats.html          └─> game.html (gioca 1 attività)
                                    │
                                    └─> sequence-editor.html ──> lobby.html ──> session.html
                                                                                    │
                                                                    (avvia)  ──> game.html

login.html ──(utente non-admin)──> resta in attesa (ascolta lobby/current in realtime)
                                    finché l'admin non lo mette in sessione ──> game.html
```

- `index.html` + `script/dashboard/index.js`: dashboard "flat" delle attività senza cartelle — versione alternativa/precedente a `folders.html`.
- `play.html`: ingresso per siti esterni (vedi [Integrazione esterna via iframe](#integrazione-esterna-via-iframe)).
- `diag.html`: diagnostica del browser (vedi sopra).
- Tutte le pagine admin (`home`, `folders`, `stats`, `editor`, `sequence-editor`, `lobby`, `session`) importano `firebase-init.js` come modulo ES e parlano direttamente con Firestore, non c'è un layer API.

## Moduli di gioco

`game.html` legge `activityData.templateKey` e istanzia il modulo giusto dentro `#gameContainer`:

| templateKey | File | Entry point |
|---|---|---|
| `crossword` (Crucitomo) | [crossword.js](script/giochi/crossword.js) | `class Crossword` |
| `hangman` (Il tempo è tiranno) | inline in `game.html` | `initHangman()` (unico senza file proprio) |
| `trova-intruso` | [trova-intruso.js](script/giochi/trova-intruso.js) | `initTrovaIntruso()` |
| `radiazione-a-catena` | [radiazione-a-catena.js](script/giochi/radiazione-a-catena.js) | `initRadiazione()` |
| `se-conosci-riconosci` (Filippino) | [se-conosci-riconosci.js](script/giochi/se-conosci-riconosci.js) | `class SeConosci` |
| `guess-what` | [guess-what.js](script/giochi/guess-what.js) | `initGuessWhat()` |
| `passa-e-spassa` | [passa-e-spassa.js](script/giochi/passa-e-spassa.js) | `initPassaESpassa()` |

Contratto comune: `new/init(container, dati, { onWin, onLose, onStartTimer, onRegisterSolution })`. `game.html` gestisce attorno a questo timer, tastiera a schermo, modale risultato e log statistiche — è il punto più semplice per riusare un singolo gioco in un'altra shell.

`editor.html` è condiviso da tutti i tipi: cambia UI in base a `?type=<templateKey>` (nuova attività) o `?id=<activityId>` (modifica).

### Comportamento dei giochi

- **Tastiera**: nei giochi in cui si scrive compare la tastiera a schermo di `game.html` (⌫ in alto a destra, funziona come una tastiera normale); quella del dispositivo è disattivata (`inputmode="none"`).
- **Fine partita**: vittoria con jingle sintetizzato nel browser (`playWinJingle` in `game.html`, provvisorio in attesa del file audio definitivo); sconfitta con la schermata "Respira: sei in Trentino" allo scadere del tempo e, in Radiazione a Catena, se alla fine non tutte le risposte sono giuste. Nei giochi a griglia e in Trova l'Intruso gli errori non fanno perdere: si riprova finché c'è tempo.
- **Giochi a griglia** (Crucitomo, Filippino, Passa e Spassa): una parola viene giudicata appena è completa, oppure quando se ne scrive l'ultima lettera anche se mancano lettere prima (es. iniziata dalla metà). Giusta → verde e bloccata; sbagliata → rossa per un attimo e poi svuotata.
- **Crucitomo**: griglia a tutta larghezza con zoom (+/−/⤢, pinch, ctrl+rotella) che parte dalla vista intera; l'immagine della parola selezionata è in una finestra flottante spostabile e zoomabile ([image-viewer.js](script/giochi/image-viewer.js)). Toccando la casella numerata d'inizio di una parola si seleziona quella parola.
- **Filippino**: stessa finestra immagine; risolte tutte le righe si chiede la parola nascosta (esatta se `hiddenSolutionIsWord`, altrimenti basta un anagramma delle lettere).
- **Il tempo è tiranno**: dopo ogni parola una schermata di esito con "Prossima parola" (timer in pausa); "Rigioca" solo alla fine. Punteggiatura visibile da subito, lettere accentate indovinate con la lettera base.
- **Trova l'Intruso**: immagini in ordine casuale a ogni partita. Se l'attività ha la domanda finale (`commonQuestion`), dopo aver trovato le immagini giuste (UNLOCK) compare il popup «Cosa hanno in comune le immagini?» con le opzioni in ordine casuale; un'opzione sbagliata lampeggia di rosso e si sceglie di nuovo. Il messaggio di vittoria riporta a quale tentativo sono state trovate le immagini e la risposta.

## Modello dati Firestore

| Collection | Doc id | Contenuto |
|---|---|---|
| `filesystem` | id cartella (`root` = radice) | `{ items: [...] }`, ogni item è `folder` (id, name, color) o `activity` (metadati leggeri: id, name, activityType, templateKey, date, timerMinutes, timerSeconds, zones, difficulty). `agente_selezione` contiene solo copie di attività che vivono in altre cartelle. |
| `activities` | `a_<timestamp>` | Documento completo per attività: campi specifici per tipo (`words`, `questions`, `images`, `labels`, `phrases`, `hiddenSolution`, `hiddenSolutionIsWord`, ecc.) + `folderId`, `zones` (array tra `CTV`, `SN`, `AP`, `MS`, `TC`), `difficulty` (1–3). Trova l'Intruso può avere `commonQuestion: { options, correctIndex }`, la domanda facoltativa «Cosa hanno in comune le immagini?» (`null` = nessuna domanda) |
| `sequences` | `seq_<timestamp>` | Sequenza di attività per sessioni di gruppo: `{ id, name, createdAt, steps: [{ id, activityType, activities: [ids], randomize }] }` |
| `lobby` | `current` (singleton) | Stato live della sessione in corso, letto in realtime (`onSnapshot`) da `login.html`/`session.html`: `{ seqId, seqName, steps, activityIds, selectedUsers, status: idle\|pre-game\|active\|complete, currentIdx, gameStartTime }` |
| `presence` | username | Heartbeat online `{ ts }`, scritto ogni 5s da `login.html` |
| `userStatus` | username | Esito sull'attività corrente della sessione: `{ activityId, status: win\|timeout, completedAt }` |
| `gameStats` | auto-id | Log di ogni partita: `{ activityId, timestamp }`, aggregato in `stats.html`/`script/statistiche/stats.js` (Chart.js) |

Editor, `script/dashboard/folders.js` e `script/dashboard/index.js` modificano le cartelle solo con transazioni Firestore (rileggono la cartella lato server prima di scrivere), così più persone possono salvare contemporaneamente senza cancellarsi gli inserimenti a vicenda. Fa eccezione solo il ripristino da backup in `index.html`, che sovrascrive tutto per definizione.

## File di servizio (non parte dell'app live)

- [script/puzzel/scrape.py](script/puzzel/scrape.py) / [script/puzzel/scrape_nuovi.py](script/puzzel/scrape_nuovi.py): script una tantum per scaricare i puzzle dalla piattaforma originale (puzzel.org) in `outputs/` (richiedono `--email`/`--password` di quell'account). Funzionano da qualunque cartella, es. `python script/puzzel/scrape.py ...`; `lista_codici_puzzel.py` (solo in locale) scrive l'elenco dei codici in `outputs/codici_puzzel.txt`.
- `outputs/stato.json`: vecchio export locale di `filesystem`, non referenziato da nessuna pagina — solo backup manuale.
- Non sono pubblicati sul sito (`firebase.json` → `hosting.ignore`): `documenti/`, `outputs/`, `script/puzzel/`, `script/integrazione/`, la cartella `.git` e ogni file o cartella che inizia con un punto.
- Non sono su GitHub (`.gitignore`): `documenti/`, le immagini scaricate e gli altri file in `outputs/` (tranne `stato.json`), `script/integrazione/`, i backup `backup_*.json`.

## Integrazione esterna via iframe

[play.html](pagine/play.html) è il punto d'ingresso per siti esterni, pensato per essere usato come `src` di un iframe:

```
https://anatomiadi.eu/play.html?zona=TC&difficolta=2[&tipo=CW]
```

I valori ammessi sono pubblicati in [catalogo.json](catalogo.json) (`https://anatomiadi.eu/catalogo.json`, leggibile anche da altri domini), che è anche la fonte usata da `play.html` per validarli:

| Parametro | Valori | Note |
|---|---|---|
| `zona` | `CTV` cardio toracovascolare, `SN` sistema nervoso, `AP` addome pelvi, `MS` muscolo scheletrico, `TC` testa collo | obbligatorio |
| `difficolta` | `1` base, `2` intermedio, `3` avanzato | obbligatorio |
| `tipo` | `CW` Crucitomo, `TT` Il tempo è tiranno, `INTR` Trova l'Intruso, `RC` Radiazione a Catena, `ACR` Se Conosci…Riconosci, `GW` Guess What, `PSP` Passa e Spassa — oppure gli alias lunghi (`crossword`, `hangman`, `trova-intruso`, `radiazione-a-catena`, `se-conosci-riconosci`, `guess-what`, `passa-e-spassa`) | facoltativo |

- Sceglie a caso un'attività con quella zona (un'attività multi-zona vale per ognuna delle sue zone) e quella difficoltà, e la apre in `game.html?id=…&embed=1`. In modalità embed sono nascosti i link verso le pagine interne del sito.
- Nessuna ripetizione nella stessa sessione del browser finché non sono state servite tutte le attività compatibili. Per ottenerne un'altra basta reimpostare il `src` dell'iframe su `play.html`.
- Parametri non validi o nessuna attività compatibile: la pagina mostra un messaggio d'errore.
- Eventi verso la pagina che ospita l'iframe (`window.postMessage`, sempre con `source: 'anatomiadi'`):
  - `{ type: 'start', activityId, name, templateKey, zones, difficulty }` all'avvio dell'esercizio
  - `{ type: 'end', activityId, result: 'win'|'lose', message }` a fine partita
  - `{ type: 'error', reason: 'invalid-params'|'no-match'|'not-found'|'load-error', … }`

## Per chi integra un'altra interfaccia

- Per mostrare un esercizio basta l'iframe su `play.html` descritto sopra: nessuna API da chiamare.
- Nessun vero auth/ruoli: da sostituire se serve un controllo accessi reale.
- I moduli di gioco sono isolati e riusabili singolarmente grazie al contratto `(container, dati, callbacks)` descritto sopra.
