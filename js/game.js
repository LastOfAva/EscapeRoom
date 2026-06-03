/*
 * game.js — Motore dell'Escape Room IT
 *
 * Gestisce stato, navigazione tra schermate, valutazione delle risposte,
 * indizi, punteggio, timer e salvataggio dei progressi (localStorage).
 *
 * Dipende da window.ESCAPE_DATA (definito in rooms.js, caricato prima).
 */

(function () {
  "use strict";

  const DATA = window.ESCAPE_DATA;
  const ROOMS = DATA.rooms;
  const META = DATA.meta;
  const SAVE_KEY = "escaperoom-it-v1";

  // --- Stato di gioco -----------------------------------------------------
  function freshState() {
    return {
      screen: "intro", // 'intro' | 'room' | 'roomComplete' | 'final' | 'win'
      roomIndex: 0,
      puzzleIndex: 0,
      fragments: [], // frammenti raccolti, es. ['RD1', 'VM2']
      score: META.scoring.start,
      hintsUsed: 0,
      wrongAnswers: 0,
      startTime: null, // timestamp di avvio (ms)
      finishTime: null, // timestamp di completamento (ms)
    };
  }

  let STATE = loadState() || freshState();
  let tickHandle = null; // intervallo per il cronometro

  // --- Persistenza --------------------------------------------------------
  function saveState() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(STATE));
    } catch (e) {
      /* localStorage non disponibile (es. modalità privata): si gioca comunque */
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || typeof s.screen !== "string") return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function resetGame() {
    STATE = freshState();
    saveState();
    stopTimer();
    render();
  }

  // --- Helper -------------------------------------------------------------
  function normalize(str) {
    return String(str).trim().toLowerCase().replace(/\s+/g, "");
  }

  function arraysEqualAsSets(a, b) {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  }

  function formatTime(ms) {
    if (!ms || ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function elapsedMs() {
    if (!STATE.startTime) return 0;
    const end = STATE.finishTime || Date.now();
    return end - STATE.startTime;
  }

  function rankFor(score) {
    return META.ranks.find((r) => score >= r.min) || META.ranks[META.ranks.length - 1];
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // --- Cronometro ---------------------------------------------------------
  function startTimer() {
    stopTimer();
    tickHandle = setInterval(() => {
      const el = document.getElementById("hud-time");
      if (el) el.textContent = formatTime(elapsedMs());
    }, 1000);
  }

  function stopTimer() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  // --- Rendering: root ----------------------------------------------------
  const app = document.getElementById("app");

  function render() {
    saveState();
    let html = "";
    switch (STATE.screen) {
      case "intro":
        html = viewIntro();
        break;
      case "room":
        html = viewRoom();
        break;
      case "roomComplete":
        html = viewRoomComplete();
        break;
      case "final":
        html = viewFinal();
        break;
      case "win":
        html = viewWin();
        break;
      default:
        html = viewIntro();
    }
    app.innerHTML = html;
    bindEvents();

    // Il cronometro gira solo durante il gioco vero e proprio.
    if (STATE.screen === "room" || STATE.screen === "roomComplete" || STATE.screen === "final") {
      startTimer();
    } else {
      stopTimer();
    }
  }

  // --- Vista: Intro / Briefing -------------------------------------------
  function viewIntro() {
    const hasProgress =
      STATE.startTime &&
      (STATE.roomIndex > 0 || STATE.puzzleIndex > 0 || STATE.fragments.length > 0);

    const resumeBtn = hasProgress
      ? `<button class="btn btn-ghost" data-action="resume">▶ Riprendi (zona ${STATE.roomIndex + 1})</button>`
      : "";

    const zonesList = ROOMS.map(
      (r) => `
      <li class="zone-chip" style="--zc:${r.color}">
        <span class="zone-chip-ico">${r.icon}</span>
        <span>
          <strong>${esc(r.title.replace(/^Zona \d+ — /, ""))}</strong>
          <small>${esc(r.subtitle)}</small>
        </span>
      </li>`
    ).join("");

    return `
    <section class="screen intro">
      <div class="terminal-tag">// sistema di sicurezza datacenter — accesso tecnico</div>
      <h1 class="title-glow">${esc(META.title)}</h1>
      <h2 class="subtitle">${esc(META.subtitle)}</h2>

      <div class="briefing card">
        <p class="prompt">&gt; BRIEFING DELLA MISSIONE</p>
        <p>
          Sei il <strong>tecnico IT di turno notturno</strong>. Alle 02:14 un'anomalia ha mandato il datacenter
          in <strong>lockdown</strong>: le porte blindate si sono chiuse e i sistemi sono bloccati.
        </p>
        <p>
          Per uscire devi attraversare <strong>4 zone</strong>, dimostrando competenza in
          <em>storage, virtualizzazione, network</em> e <em>security</em>. Ogni zona superata ti consegna un
          <strong>frammento</strong> della chiave maestra che apre la porta finale.
        </p>
        <ul class="zones">${zonesList}</ul>
        <p class="rules">
          📋 <strong>Regole:</strong> nessun limite di tempo (il cronometro è solo per la tua statistica).
          Hai indizi a disposizione su ogni enigma e una spiegazione didattica dopo ogni risposta corretta.
          Tentativi illimitati: l'obiettivo è imparare. Buon lavoro!
        </p>
      </div>

      <div class="actions">
        <button class="btn btn-primary" data-action="start">${hasProgress ? "↺ Ricomincia da capo" : "⚡ Avvia la missione"}</button>
        ${resumeBtn}
      </div>
    </section>`;
  }

  // --- HUD (barra superiore durante il gioco) ----------------------------
  function viewHud() {
    const dots = ROOMS.map((r, i) => {
      let cls = "map-node";
      if (STATE.fragments.includes(r.fragment)) cls += " done";
      else if (i === STATE.roomIndex && STATE.screen !== "final") cls += " active";
      return `<span class="${cls}" style="--zc:${r.color}" title="${esc(r.title)}">${r.icon}</span>`;
    }).join('<span class="map-link"></span>');

    const frags = STATE.fragments.length
      ? STATE.fragments.map((f) => `<code class="frag">${esc(f)}</code>`).join("")
      : '<span class="frag-empty">nessuno</span>';

    return `
    <header class="hud">
      <div class="hud-map">${dots}</div>
      <div class="hud-stats">
        <span class="hud-item" title="Frammenti raccolti">🔑 ${frags}</span>
        <span class="hud-item" title="Punteggio">★ <strong>${STATE.score}</strong></span>
        <span class="hud-item" title="Tempo trascorso">⏱ <span id="hud-time">${formatTime(elapsedMs())}</span></span>
        <button class="btn btn-mini" data-action="confirm-reset" title="Ricomincia da capo">↺</button>
      </div>
    </header>`;
  }

  // --- Vista: Stanza + enigma corrente -----------------------------------
  function viewRoom() {
    const room = ROOMS[STATE.roomIndex];
    const puzzle = room.puzzles[STATE.puzzleIndex];

    // Intro della stanza solo sul primo enigma.
    const roomIntro =
      STATE.puzzleIndex === 0
        ? `<div class="room-intro card" style="--zc:${room.color}">
             <div class="room-intro-ico">${room.icon}</div>
             <p>${esc(room.intro)}</p>
           </div>`
        : "";

    const progress = room.puzzles
      .map((_, i) => {
        let c = "pz-dot";
        if (i < STATE.puzzleIndex) c += " ok";
        else if (i === STATE.puzzleIndex) c += " cur";
        return `<span class="${c}"></span>`;
      })
      .join("");

    return `
    ${viewHud()}
    <section class="screen room" style="--zc:${room.color}">
      <div class="room-head">
        <span class="room-badge">${room.icon}</span>
        <div>
          <h2 class="room-title">${esc(room.title)}</h2>
          <span class="room-sub">${esc(room.subtitle)}</span>
        </div>
        <div class="room-progress">
          <span class="room-counter">Enigma ${STATE.puzzleIndex + 1}/${room.puzzles.length}</span>
          <div class="pz-dots">${progress}</div>
        </div>
      </div>
      ${roomIntro}
      ${viewPuzzle(puzzle)}
    </section>`;
  }

  function viewPuzzle(puzzle) {
    let input = "";

    if (puzzle.type === "mc") {
      input = `<div class="options" data-puzzle="${puzzle.id}">
        ${puzzle.options
          .map(
            (opt, i) =>
              `<button class="option" data-i="${i}"><span class="option-key">${String.fromCharCode(65 + i)}</span>${esc(opt)}</button>`
          )
          .join("")}
      </div>`;
    } else if (puzzle.type === "multi") {
      input = `<div class="options multi" data-puzzle="${puzzle.id}">
        ${puzzle.options
          .map(
            (opt, i) =>
              `<label class="option option-check"><input type="checkbox" data-i="${i}"><span class="check-box"></span>${esc(opt)}</label>`
          )
          .join("")}
        <button class="btn btn-primary btn-verify" data-action="verify-multi">Verifica selezione</button>
      </div>`;
    } else if (puzzle.type === "text") {
      input = `<div class="text-answer" data-puzzle="${puzzle.id}">
        <input type="text" id="text-input" autocomplete="off" spellcheck="false"
               placeholder="${esc(puzzle.placeholder || "Scrivi la risposta…")}">
        <button class="btn btn-primary" data-action="verify-text">Conferma</button>
      </div>`;
    }

    const pre = puzzle.pre
      ? `<pre class="log-block">${esc(puzzle.pre)}</pre>`
      : "";

    return `
    <div class="puzzle card">
      <p class="puzzle-q"><span class="q-prompt">?</span> ${esc(puzzle.question)}</p>
      ${pre}
      ${input}
      <div class="puzzle-foot">
        <button class="btn btn-hint" data-action="hint">💡 Indizio</button>
        <div id="feedback" class="feedback" aria-live="polite"></div>
      </div>
      <div id="hint-zone" class="hint-zone"></div>
    </div>`;
  }

  // --- Vista: Stanza completata (frammento ottenuto) ---------------------
  function viewRoomComplete() {
    const room = ROOMS[STATE.roomIndex];
    const isLast = STATE.roomIndex === ROOMS.length - 1;
    const nextLabel = isLast
      ? "🚪 Vai alla porta blindata"
      : `➡ Entra nella ${esc(ROOMS[STATE.roomIndex + 1].title)}`;

    return `
    ${viewHud()}
    <section class="screen room-complete" style="--zc:${room.color}">
      <div class="unlock-anim">${room.icon}</div>
      <p class="unlock-tag">ZONA SBLOCCATA</p>
      <h2 class="room-title">${esc(room.title)} — completata!</h2>
      <p class="frag-reveal">Frammento ottenuto: <code class="frag-big">${esc(room.fragment)}</code></p>
      <p class="muted">Annotalo: ti servirà per comporre la chiave maestra alla porta finale.</p>
      <div class="actions">
        <button class="btn btn-primary" data-action="next-room">${nextLabel}</button>
      </div>
    </section>`;
  }

  // --- Vista: Porta finale -----------------------------------------------
  function viewFinal() {
    const frags = STATE.fragments.map((f) => `<code class="frag-big">${esc(f)}</code>`).join('<span class="plus">-</span>');

    return `
    ${viewHud()}
    <section class="screen final">
      <div class="vault">
        <div class="vault-door">
          <div class="vault-ring"></div>
          <div class="vault-lock">🔒</div>
        </div>
      </div>
      <h2 class="room-title">Porta blindata — Uscita</h2>
      <p>Hai raccolto tutti i frammenti. Componi la <strong>chiave maestra</strong> per uscire dal datacenter.</p>
      <div class="frag-tray">${frags}</div>
      <p class="muted">
        Inserisci i quattro frammenti separati da trattino, <strong>nell'ordine in cui hai attraversato le zone</strong>
        (Storage → Virtualizzazione → Network → Security).
      </p>
      <div class="text-answer text-answer-final">
        <input type="text" id="master-input" autocomplete="off" spellcheck="false"
               placeholder="es. AB1-CD2-EF3-GH4">
        <button class="btn btn-primary" data-action="verify-master">🔓 Apri la porta</button>
      </div>
      <div class="puzzle-foot">
        <button class="btn btn-hint" data-action="hint-master">💡 Indizio</button>
        <div id="feedback" class="feedback" aria-live="polite"></div>
      </div>
      <div id="hint-zone" class="hint-zone"></div>
    </section>`;
  }

  // --- Vista: Vittoria ----------------------------------------------------
  function viewWin() {
    const rank = rankFor(STATE.score);
    const time = formatTime(elapsedMs());
    return `
    <section class="screen win">
      <div class="confetti">🎉</div>
      <div class="terminal-tag">// lockdown rimosso — accesso ripristinato</div>
      <h1 class="title-glow">FUGA RIUSCITA</h1>
      <p class="win-sub">Sei uscito dal datacenter e hai ripristinato i sistemi. Ottimo lavoro, tecnico!</p>

      <div class="rank card">
        <div class="medal">${rank.medal}</div>
        <div class="rank-label">${esc(rank.label)}</div>
      </div>

      <div class="stats card">
        <div class="stat"><span class="stat-n">${STATE.score}</span><span class="stat-l">Punteggio</span></div>
        <div class="stat"><span class="stat-n">${time}</span><span class="stat-l">Tempo</span></div>
        <div class="stat"><span class="stat-n">${STATE.hintsUsed}</span><span class="stat-l">Indizi usati</span></div>
        <div class="stat"><span class="stat-n">${STATE.wrongAnswers}</span><span class="stat-l">Errori</span></div>
      </div>

      <div class="recap card">
        <p class="prompt">&gt; COMPETENZE DIMOSTRATE</p>
        <ul class="zones">
          ${ROOMS.map(
            (r) => `<li class="zone-chip" style="--zc:${r.color}">
              <span class="zone-chip-ico">${r.icon}</span>
              <span><strong>${esc(r.title.replace(/^Zona \d+ — /, ""))}</strong><small>${esc(r.subtitle)}</small></span>
              <span class="zone-check">✓</span>
            </li>`
          ).join("")}
        </ul>
      </div>

      <div class="actions">
        <button class="btn btn-primary" data-action="start">🔁 Gioca di nuovo</button>
      </div>
    </section>`;
  }

  // --- Gestione risposte --------------------------------------------------
  function setFeedback(kind, msg) {
    const fb = document.getElementById("feedback");
    if (!fb) return;
    fb.className = "feedback " + kind;
    fb.innerHTML = msg;
  }

  function advanceAfterCorrect(puzzle) {
    // Mostra la spiegazione e un pulsante "Avanti".
    const card = document.querySelector(".puzzle");
    if (card) card.classList.add("solved");
    setFeedback(
      "ok",
      `<strong>✔ Corretto!</strong>`
    );
    const foot = document.querySelector(".puzzle-foot");
    if (foot) {
      const expl = document.createElement("div");
      expl.className = "explanation";
      expl.innerHTML = `<p class="prompt">&gt; PERCHÉ</p><p>${esc(puzzle.explanation)}</p>
        <button class="btn btn-primary" data-action="next-puzzle">Avanti ➡</button>`;
      card.appendChild(expl);
      // Disabilita i controlli di input.
      card.querySelectorAll(".option, input, .btn-verify, .btn-hint").forEach((e) => {
        e.setAttribute("disabled", "true");
        e.classList.add("locked");
      });
      bindEvents();
    }
  }

  function handleMc(i) {
    const room = ROOMS[STATE.roomIndex];
    const puzzle = room.puzzles[STATE.puzzleIndex];
    const buttons = document.querySelectorAll(".options .option");
    if (i === puzzle.answer) {
      buttons[i].classList.add("correct");
      advanceAfterCorrect(puzzle);
    } else {
      buttons[i].classList.add("wrong");
      STATE.wrongAnswers += 1;
      STATE.score = Math.max(0, STATE.score - META.scoring.wrongCost);
      setFeedback("err", "✘ Non è corretta. Riprova o chiedi un indizio.");
      updateHudScore();
      saveState();
    }
  }

  function handleMultiVerify() {
    const room = ROOMS[STATE.roomIndex];
    const puzzle = room.puzzles[STATE.puzzleIndex];
    const checked = [...document.querySelectorAll('.options.multi input[type="checkbox"]')]
      .filter((c) => c.checked)
      .map((c) => Number(c.getAttribute("data-i")));

    if (checked.length === 0) {
      setFeedback("err", "Seleziona almeno una risposta.");
      return;
    }

    if (arraysEqualAsSets(checked, puzzle.answer)) {
      document.querySelectorAll(".options.multi .option-check").forEach((lab, idx) => {
        if (puzzle.answer.includes(idx)) lab.classList.add("correct");
      });
      advanceAfterCorrect(puzzle);
    } else {
      STATE.wrongAnswers += 1;
      STATE.score = Math.max(0, STATE.score - META.scoring.wrongCost);
      setFeedback("err", "✘ La selezione non è esatta. Controlla bene: potrebbe mancarne una o essercene una di troppo.");
      updateHudScore();
      saveState();
    }
  }

  function handleTextVerify() {
    const room = ROOMS[STATE.roomIndex];
    const puzzle = room.puzzles[STATE.puzzleIndex];
    const input = document.getElementById("text-input");
    if (!input) return;
    const val = normalize(input.value);
    if (!val) {
      setFeedback("err", "Scrivi una risposta prima di confermare.");
      return;
    }
    const ok = puzzle.accept.some((a) => normalize(a) === val);
    if (ok) {
      input.classList.add("correct");
      advanceAfterCorrect(puzzle);
    } else {
      input.classList.add("wrong");
      STATE.wrongAnswers += 1;
      STATE.score = Math.max(0, STATE.score - META.scoring.wrongCost);
      setFeedback("err", "✘ Non è la risposta giusta. Riprova o usa un indizio.");
      updateHudScore();
      saveState();
    }
  }

  let hintStep = 0; // indizio corrente per l'enigma in corso

  function showHint(hints) {
    const zone = document.getElementById("hint-zone");
    if (!zone) return;
    if (!hints || hints.length === 0) {
      zone.innerHTML = `<div class="hint">Nessun indizio disponibile per questo enigma.</div>`;
      return;
    }
    if (hintStep >= hints.length) {
      // Già rivelati tutti.
      return;
    }
    STATE.hintsUsed += 1;
    STATE.score = Math.max(0, STATE.score - META.scoring.hintCost);
    updateHudScore();
    const h = document.createElement("div");
    h.className = "hint";
    h.innerHTML = `💡 ${esc(hints[hintStep])}`;
    zone.appendChild(h);
    hintStep += 1;
    if (hintStep >= hints.length) {
      const btn = document.querySelector('[data-action="hint"], [data-action="hint-master"]');
      if (btn) {
        btn.setAttribute("disabled", "true");
        btn.classList.add("locked");
        btn.textContent = "💡 Indizi esauriti";
      }
    }
    saveState();
  }

  function updateHudScore() {
    // Aggiorna i numeri della HUD senza ridisegnare tutta la schermata.
    const items = document.querySelectorAll(".hud-item strong");
    if (items && items[0]) items[0].textContent = STATE.score;
  }

  function handleMaster() {
    const input = document.getElementById("master-input");
    if (!input) return;
    const val = normalize(input.value);
    const ok = META.masterAccept.some((a) => normalize(a) === val);
    if (ok) {
      STATE.finishTime = Date.now();
      STATE.screen = "win";
      stopTimer();
      saveState();
      render();
    } else {
      input.classList.add("wrong");
      STATE.wrongAnswers += 1;
      STATE.score = Math.max(0, STATE.score - META.scoring.wrongCost);
      setFeedback("err", "✘ Chiave errata. Ricontrolla l'ordine e i trattini tra i frammenti.");
      updateHudScore();
      saveState();
    }
  }

  // --- Navigazione --------------------------------------------------------
  function nextPuzzle() {
    const room = ROOMS[STATE.roomIndex];
    hintStep = 0;
    if (STATE.puzzleIndex + 1 < room.puzzles.length) {
      STATE.puzzleIndex += 1;
      render();
    } else {
      // Stanza completata: assegna il frammento (se non già presente).
      if (!STATE.fragments.includes(room.fragment)) STATE.fragments.push(room.fragment);
      STATE.screen = "roomComplete";
      render();
    }
  }

  function nextRoom() {
    hintStep = 0;
    if (STATE.roomIndex + 1 < ROOMS.length) {
      STATE.roomIndex += 1;
      STATE.puzzleIndex = 0;
      STATE.screen = "room";
    } else {
      STATE.screen = "final";
    }
    render();
  }

  function startGame() {
    STATE = freshState();
    STATE.screen = "room";
    STATE.startTime = Date.now();
    hintStep = 0;
    saveState();
    render();
  }

  function resumeGame() {
    // Se lo stato salvato è coerente, riprende; altrimenti riparte.
    if (!STATE.startTime) STATE.startTime = Date.now();
    if (STATE.screen === "intro") STATE.screen = "room";
    hintStep = 0;
    render();
  }

  // --- Binding eventi -----------------------------------------------------
  // bindEvents può essere invocata più volte sullo stesso DOM (es. quando
  // aggiungiamo la spiegazione dopo una risposta corretta): il flag dataset
  // "bound" evita di registrare due volte lo stesso listener.
  function bindEvents() {
    // Pulsanti con data-action
    app.querySelectorAll("[data-action]").forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = "1";
      el.addEventListener("click", onAction);
    });

    // Scelta multipla (mc): click sull'opzione
    app.querySelectorAll(".options:not(.multi) .option").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        if (btn.hasAttribute("disabled")) return;
        handleMc(Number(btn.getAttribute("data-i")));
      });
    });

    // Invio da tastiera nei campi di testo
    const ti = document.getElementById("text-input");
    if (ti && !ti.dataset.bound) {
      ti.dataset.bound = "1";
      ti.focus();
      ti.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleTextVerify();
      });
    }
    const mi = document.getElementById("master-input");
    if (mi && !mi.dataset.bound) {
      mi.dataset.bound = "1";
      mi.focus();
      mi.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleMaster();
      });
    }
  }

  function currentHints() {
    if (STATE.screen === "final") {
      return ["I frammenti vanno separati da un trattino '-'.", `Ordine: Storage, Virtualizzazione, Network, Security.`];
    }
    const room = ROOMS[STATE.roomIndex];
    const puzzle = room.puzzles[STATE.puzzleIndex];
    return puzzle.hints || [];
  }

  function onAction(e) {
    const action = e.currentTarget.getAttribute("data-action");
    switch (action) {
      case "start":
        startGame();
        break;
      case "resume":
        resumeGame();
        break;
      case "next-puzzle":
        nextPuzzle();
        break;
      case "next-room":
        nextRoom();
        break;
      case "verify-multi":
        handleMultiVerify();
        break;
      case "verify-text":
        handleTextVerify();
        break;
      case "verify-master":
        handleMaster();
        break;
      case "hint":
      case "hint-master":
        showHint(currentHints());
        break;
      case "confirm-reset":
        if (confirm("Vuoi ricominciare da capo? I progressi attuali andranno persi.")) resetGame();
        break;
      default:
        break;
    }
  }

  // --- Avvio --------------------------------------------------------------
  render();
})();
