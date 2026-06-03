# 🔒 Escape Room IT — "Lockdown in Datacenter"

Una **escape room tecnica** giocabile nel browser, pensata per la **formazione di tecnici IT junior**.
Il giocatore è il tecnico di turno notturno: un'anomalia ha messo il datacenter in *lockdown* e, per
uscire, deve attraversare **4 zone blindate** dimostrando competenza in **Storage, Virtualizzazione,
Network** e **Security**. Ogni zona superata consegna un **frammento** della chiave maestra che apre la
porta finale.

> Livello: **Junior / onboarding** · Lingua: **Italiano** · Durata stimata: **30–45 minuti**
> Nessuna installazione, nessuna dipendenza: è tutto HTML/CSS/JavaScript statico.

---

## ▶️ Come si gioca

**Opzione 1 — apri il file (più semplice):**
fai doppio clic su **`index.html`**: si apre nel browser e funziona subito, anche offline.

**Opzione 2 — server locale (consigliata in aula):**

```bash
# con Python (di solito già presente)
python3 -m http.server 8000
# poi visita http://localhost:8000
```

Funziona su qualunque browser moderno (Chrome, Edge, Firefox, Safari), anche da tablet/smartphone.
I progressi vengono salvati automaticamente nel browser (`localStorage`): puoi chiudere e riprendere.

---

## 🎯 Le 4 zone e gli obiettivi didattici

| Zona | Tema | Concetti chiave |
|------|------|-----------------|
| 1 · **Storage** | Dischi e array | RAID 0/1/5, capacità utile, snapshot, iSCSI/NFS/SMB |
| 2 · **Virtualizzazione** | Hypervisor e VM | Tipo 1 vs Tipo 2, VM vs container, live migration (vMotion) |
| 3 · **Network** | Reti TCP/IP | IP privati (RFC 1918), subnet /24, porte note, default gateway, broadcast |
| 4 · **Security** | Sicurezza di base | Triade CIA, hashing vs cifratura, phishing, MFA, lettura log, least privilege |

Ogni enigma è pensato per **insegnare**, non solo per valutare:

- **Indizi progressivi** su ogni domanda (💡), per non bloccarsi mai.
- **Spiegazione didattica** mostrata dopo ogni risposta corretta ("&gt; PERCHÉ").
- **Tentativi illimitati**: l'obiettivo è imparare.
- **Cronometro e punteggio** solo come statistica/gamification (nessun "game over").

Al termine il giocatore riceve un **grado** in base al punteggio (es. 🥇 *Tecnico IT Certificato*).

---

## 🧑‍🏫 Note per chi conduce la formazione

- **Onboarding di gruppo:** proietta il gioco e fai rispondere il team a turno, commentando ogni
  spiegazione. Ottimo come "rompighiaccio" tecnico nei primi giorni.
- **Autoapprendimento:** condividi semplicemente la cartella o l'URL; ognuno gioca al proprio ritmo.
- **Gara a squadre:** confronta punteggio, tempo e numero di indizi usati (mostrati nella schermata finale).
- **Reset:** il pulsante ↺ nella barra in alto (o "Ricomincia da capo") azzera i progressi salvati.

---

## ➕ Come aggiungere o modificare gli enigmi

Tutti i contenuti sono in **`js/rooms.js`**, separati dalla logica di gioco: puoi modificarli senza
toccare il motore. Ogni enigma supporta tre tipi:

```js
// Scelta multipla (una risposta corretta)
{ id: "ex1", type: "mc",
  question: "Domanda…",
  options: ["A", "B", "C"],
  answer: 1,                 // indice dell'opzione corretta (0-based)
  hints: ["Indizio 1", "…"],
  explanation: "Perché la risposta è questa…" }

// Selezione multipla (più risposte corrette)
{ id: "ex2", type: "multi",
  options: ["A", "B", "C", "D"],
  answer: [0, 2],            // indici corretti
  /* question, hints, explanation … */ }

// Risposta da digitare
{ id: "ex3", type: "text",
  accept: ["10.0.0.1"],      // risposte accettate (confronto senza maiuscole/spazi)
  placeholder: "es. …",
  pre: "blocco di testo monospazio opzionale (es. un log)",
  /* question, hints, explanation … */ }
```

Per **aggiungere una zona** copia un blocco `room` in `js/rooms.js` (servono `id`, `title`, `subtitle`,
`icon` SVG, `color`, `fragment` e `puzzles[]`) e aggiorna `META.masterKey` / `META.masterAccept`:
la chiave maestra è la **concatenazione dei `fragment` con un trattino**, nell'ordine delle zone.

Dopo ogni modifica, **valida i contenuti**:

```bash
node test/validate-data.js     # oppure:  npm test
```

Il test controlla indici di risposta, campi obbligatori, id duplicati e che la chiave maestra
corrisponda ai frammenti. (211 controlli sull'insieme di base.)

---

## 🗂️ Struttura del progetto

```
EscapeRoom/
├── index.html              # pagina e punto di montaggio
├── css/
│   └── style.css           # stile "datacenter/terminale"
├── js/
│   ├── rooms.js            # CONTENUTI: zone, enigmi, indizi, spiegazioni
│   └── game.js             # MOTORE: stato, schermate, punteggio, salvataggio
├── test/
│   └── validate-data.js    # controllo d'integrità dei contenuti (no dipendenze)
├── package.json            # script comodi (test / serve)
└── README.md
```

---

## 🛠️ Dettagli tecnici

- **Zero dipendenze, zero build:** solo HTML/CSS/JS. Icone SVG inline, nessun font esterno → funziona offline.
- **Salvataggio progressi** via `localStorage` (degrada con grazia se non disponibile).
- **Accessibilità:** navigazione da tastiera (Invio per confermare), `prefers-reduced-motion` rispettato,
  layout responsive per mobile.
- Compatibile con i browser moderni (usa `color-mix()` per le tinte d'accento).

## 📄 Licenza

[MIT](LICENSE) — libero uso, anche a scopo formativo aziendale.
