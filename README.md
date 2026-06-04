# 🖥️ Datacenter Lockdown — Escape Room IT (gioco grafico)

Una **escape room grafica punta-e-clicca**, giocabile nel browser, per la **formazione di tecnici IT junior**.
Sei chiuso in una sala datacenter andata in *lockdown*: **esplori la stanza cliccando sugli apparati** e risolvi
**quattro enigmi pratici** — costruisci un array RAID trascinando i dischi, assegni le VM al host, ricolleghi i cavi
di rete, individui l'intruso nei log — per ottenere le **4 cifre** del codice e aprire la **porta blindata**.

> Niente domande a risposta multipla: **si gioca manipolando gli oggetti**.
> HTML5 Canvas + JavaScript, **nessuna dipendenza, nessuna installazione**. Funziona anche offline.

![Anteprima della sala datacenter](docs/preview.png)

---

## ▶️ Come si gioca

**Opzione 1 — apri il file:** doppio clic su **`index.html`** → parte nel browser.

**Opzione 2 — server locale (consigliata in aula):**
```bash
python3 -m http.server 8000      # poi vai su http://localhost:8000
```

Funziona con mouse **e touch** (tablet/smartphone): gli enigmi col trascinamento usano i *pointer events*.
I progressi si salvano da soli nel browser: puoi chiudere e riprendere.

**Obiettivo:** clicca i 4 apparati luminescenti, risolvi i loro enigmi (ognuno dà una cifra), poi clicca la
**porta blindata** e digita il codice a 4 cifre sul tastierino per scappare.

---

## 🧩 La stanza e le 4 stazioni interattive

| Apparato | Tema | Cosa fai (gameplay) | Cosa impari |
|----------|------|---------------------|-------------|
| 🟦 **Rack Storage** | Storage / RAID | **Trascini i dischi** nell'array e scegli il livello RAID per ottenere la capacità utile richiesta con ridondanza | RAID 0/1/5, capacità utile, tolleranza ai guasti |
| 🟪 **Host VM** | Virtualizzazione | **Trascini le VM** sul host rispettando la RAM disponibile | Consolidamento, RAM, overcommit |
| 🟩 **Patch Panel** | Network | **Colleghi i nodi** (clic-per-collegare) per ripristinare il percorso PC→Switch→Router→Internet | Topologia, percorso dati, gateway |
| 🟥 **Terminale SOC** | Security | **Clicchi nel log** l'IP che fa brute-force per bloccarlo al firewall | Analisi log, riconoscere un attacco |

Poi: 🚪 **Porta blindata** → tastierino numerico dove inserire il codice raccolto.

Ogni enigma ha un **indizio** (💡) e un **feedback live** (es. la barra RAM che diventa rossa in overcommit,
il pacchetto che viaggia sui cavi quando la rete è a posto). Pensato per livello **junior/onboarding**:
tentativi illimitati, nessun *game over*.

---

## ✨ Caratteristiche

- **Scena disegnata e animata** su `<canvas>`: rack con LED lampeggianti, monitor, porta blindata, luci, prospettiva.
- **Hover + click** sugli apparati con etichette e contorno luminoso.
- **Drag & drop** funzionante con **mouse e touch**.
- **HUD**: slot del codice che si illuminano, cronometro, audio on/off, reset.
- **Effetti sonori** sintetici (Web Audio, nessun file), disattivabili.
- **Salvataggio** progressi in `localStorage`. **Responsive**. Rispetta `prefers-reduced-motion`.

---

## 🗂️ Struttura del progetto

```
EscapeRoom/
├── index.html              # il gioco grafico (pagina principale)
├── assets/
│   ├── logic.js            # REGOLE pure degli enigmi (RAID, VM, rete, log) — testabili
│   ├── scene.js            # disegno e animazione della sala su canvas + click sugli oggetti
│   ├── puzzles.js          # i 4 enigmi interattivi (drag&drop, clic-per-collegare, log)
│   ├── main.js             # stato, HUD, finestre, tastierino della porta, vittoria, salvataggio
│   ├── audio.js            # effetti sonori sintetici
│   └── style.css           # interfaccia (HUD, finestre, enigmi)
├── docs/preview.png        # anteprima della scena
├── test/
│   └── logic.test.js       # test delle regole degli enigmi (nessuna dipendenza)
├── quiz/                   # versione precedente "a domande" (vedi sotto)
└── package.json
```

## ✅ Test

```bash
npm test        # regole del gioco + validazione contenuti della versione quiz (zero dipendenze)
```

Le **regole tecniche** (capacità RAID, overcommit RAM, percorso di rete, rilevamento brute-force) sono in
`assets/logic.js`, separate dall'interfaccia e coperte da `test/logic.test.js`. Il flusso completo del gioco
(apertura enigmi, soluzione, tastierino, fuga) è stato verificato end-to-end con jsdom durante lo sviluppo.

## 🔧 Personalizzazione

- **Regole/obiettivi** degli enigmi → `assets/logic.js` (es. capacità RAID o RAM del host).
- **Parametri** dei singoli enigmi (dischi, VM, nodi, righe di log) → `assets/puzzles.js`.
- **Codici e stazioni** (cifre, etichette) → `assets/main.js` (`G.stations`, `G.codeOrder`).
- **Disposizione/aspetto** della sala → `assets/scene.js` (oggetto `LAYOUT`).

---

## 📋 Versione "a domande" (quiz)

La prima versione — una escape room a **quiz** (4 zone, indizi e spiegazioni didattiche) — è conservata in
**`quiz/`** e resta giocabile aprendo `quiz/index.html`. Utile come modalità di sola teoria/onboarding.

## 📄 Licenza

[MIT](LICENSE) — libero uso, anche a scopo formativo aziendale.
