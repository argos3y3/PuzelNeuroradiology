# PuzelNeuroradiology

Piattaforma web di mini-giochi didattici (anatomia/neuroradiologia). Vanilla HTML/CSS/JS, nessun framework, nessuna build. Persistenza su Cloud Firestore, hosting su Firebase Hosting.

## Stack e hosting

- **Nessun build step**: `firebase.json` pubblica la root del repo (`"public": "."`) così com'è.
- **Firestore** come unico backend, progetto `olimpiadi-radiologia` (config in [firebase-init.js](firebase-init.js): `apiKey` pubblica lato client — normale per Firebase, la sicurezza reale è nelle regole Firestore, non nella segretezza della chiave).
- **Nessun Firebase Auth**: login in [login.html](login.html) è un controllo hardcoded lato client (`admin/admin`, `utente1/utente1`, `utente2/utente2`), stato tenuto in `sessionStorage`. Chi integra un'interfaccia diversa dovrà sostituire questo meccanismo con qualcosa di reale.
- **Deploy**: `firebase deploy --only hosting` (richiede CLI autenticata sul progetto in [.firebaserc](.firebaserc)).
- Le immagini delle attività sono salvate come base64 compresso **dentro i documenti Firestore** (niente Firebase Storage).

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

- `index.html` + `index.js`: dashboard "flat" delle attività senza cartelle — versione alternativa/precedente a `folders.html`.
- `404.html`: pagina di errore di default di Firebase Hosting.
- Tutte le pagine admin (`home`, `folders`, `stats`, `editor`, `sequence-editor`, `lobby`, `session`) importano `firebase-init.js` come modulo ES e parlano direttamente con Firestore, non c'è un layer API.

## Moduli di gioco

`game.html` legge `activityData.templateKey` e istanzia il modulo giusto dentro `#gameContainer`:

| templateKey | File | Entry point |
|---|---|---|
| `crossword` | [crossword.js](crossword.js) | `class Crossword` |
| `hangman` | inline in `game.html` | `initHangman()` (unico senza file proprio) |
| `trova-intruso` | [trova-intruso.js](trova-intruso.js) | `initTrovaIntruso()` |
| `radiazione-a-catena` | [radiazione-a-catena.js](radiazione-a-catena.js) | `initRadiazione()` |
| `se-conosci-riconosci` | [se-conosci-riconosci.js](se-conosci-riconosci.js) | `class SeConosci` |
| `guess-what` | [guess-what.js](guess-what.js) | `initGuessWhat()` |
| `passa-e-spassa` | [passa-e-spassa.js](passa-e-spassa.js) | `initPassaESpassa()` |

Contratto comune: `new/init(container, dati, { onWin, onLose, onStartTimer, onRegisterSolution })`. `game.html` gestisce attorno a questo timer, tastiera a schermo, modale risultato e log statistiche — è il punto più semplice per riusare un singolo gioco in un'altra shell.

`editor.html` è condiviso da tutti i tipi: cambia UI in base a `?type=<templateKey>` (nuova attività) o `?id=<activityId>` (modifica).

## Modello dati Firestore

| Collection | Doc id | Contenuto |
|---|---|---|
| `filesystem` | id cartella (`root` = radice) | `{ items: [...] }`, ogni item è `folder` (id, name, color) o `activity` (metadati leggeri: id, name, activityType, templateKey, date, timerMinutes) |
| `activities` | `a_<timestamp>` | Documento completo per attività: campi specifici per tipo (`words`, `questions`, `images`, `labels`, `phrases`, `hiddenSolution`, ecc.) + `folderId` |
| `sequences` | `seq_<timestamp>` | Sequenza di attività per sessioni di gruppo: `{ id, name, createdAt, steps: [{ id, activityType, activities: [ids], randomize }] }` |
| `lobby` | `current` (singleton) | Stato live della sessione in corso, letto in realtime (`onSnapshot`) da `login.html`/`session.html`: `{ seqId, seqName, steps, activityIds, selectedUsers, status: idle\|pre-game\|active\|complete, currentIdx, gameStartTime }` |
| `presence` | username | Heartbeat online `{ ts }`, scritto ogni 5s da `login.html` |
| `userStatus` | username | Esito sull'attività corrente della sessione: `{ activityId, status: win\|timeout, completedAt }` |
| `gameStats` | auto-id | Log di ogni partita: `{ activityId, timestamp }`, aggregato in `stats.html`/`stats.js` (Chart.js) |

## File di servizio (non parte dell'app live)

- [scrape.py](scrape.py) / [scrape_nuovi.py](scrape_nuovi.py): script una tantum per importare i puzzle dalla piattaforma originale (puzzel.org) in questo formato (richiedono `--email`/`--password` di quell'account).
- `stato.json`: vecchio export locale di `filesystem`, non referenziato da nessuna pagina — solo backup manuale.
- `img/`, `inserimento-esempio/`: asset/esempi, esclusi dal deploy hosting (vedi `firebase.json` → `hosting.ignore`).

## Per chi integra un'altra interfaccia

- Nessuna API REST: una nuova interfaccia deve parlare direttamente con Firestore (stesso `firebaseConfig`) o dietro un proprio layer che replichi le collection sopra.
- Nessun vero auth/ruoli: da sostituire se serve un controllo accessi reale.
- I moduli di gioco sono isolati e riusabili singolarmente grazie al contratto `(container, dati, callbacks)` descritto sopra.
