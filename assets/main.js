/*
 * main.js — Stato di gioco, HUD, gestione finestre (enigmi + tastierino),
 * porta blindata, schermata di vittoria e salvataggio progressi.
 * Avvia la scena (scene.js) e collega i clic agli enigmi (puzzles.js).
 */

(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.G = root.G || {};
  const SAVE_KEY = "datacenter-lockdown-v1";

  // --- Configurazione stazioni e codice porta ----------------------------
  G.stations = {
    storage: { label: "Rack Storage", sub: "Costruisci l'array RAID", digit: 7 },
    vm: { label: "Host Virtualizzazione", sub: "Assegna le VM", digit: 3 },
    network: { label: "Patch Panel", sub: "Cabla la rete", digit: 5 },
    security: { label: "Terminale SOC", sub: "Individua l'intruso", digit: 9 },
  };
  G.codeOrder = ["storage", "vm", "network", "security"];
  const DOOR_CODE = G.codeOrder.map((id) => String(G.stations[id].digit)).join("");

  // --- Stato --------------------------------------------------------------
  function fresh() {
    return { solved: {}, digits: {}, startTime: Date.now(), finishTime: null, hints: 0, escaped: false, muted: false };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.solved) return s;
    } catch (e) {}
    return null;
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); } catch (e) {}
  }
  G.state = load() || fresh();

  // --- Riferimenti DOM ----------------------------------------------------
  let elHud, elCodes, elTimer, elObjective, overlay, modalTitle, modalSub, mount, elToast;
  let timerHandle = null;

  function allSolved() {
    return G.codeOrder.every((id) => G.state.solved[id]);
  }
  function solvedCount() {
    return G.codeOrder.filter((id) => G.state.solved[id]).length;
  }

  // --- HUD ----------------------------------------------------------------
  function buildHud() {
    elHud.innerHTML = "";
    const left = document.createElement("div");
    left.className = "hud-left";
    left.innerHTML = '<span class="logo">⬢ DATACENTER <b>LOCKDOWN</b></span>';

    elCodes = document.createElement("div");
    elCodes.className = "hud-codes";

    const right = document.createElement("div");
    right.className = "hud-right";
    elTimer = document.createElement("span");
    elTimer.className = "hud-timer";
    elTimer.textContent = "00:00";
    const mute = document.createElement("button");
    mute.className = "hud-btn";
    mute.title = "Audio on/off";
    mute.textContent = G.state.muted ? "🔇" : "🔊";
    mute.onclick = () => {
      G.state.muted = !G.state.muted;
      if (G.sfx) G.sfx.setMuted(G.state.muted);
      mute.textContent = G.state.muted ? "🔇" : "🔊";
      save();
    };
    const reset = document.createElement("button");
    reset.className = "hud-btn";
    reset.title = "Ricomincia";
    reset.textContent = "↺";
    reset.onclick = () => {
      if (confirm("Ricominciare da capo? I progressi andranno persi.")) {
        G.state = fresh();
        save();
        closeModal();
        renderHud();
        setObjective();
      }
    };
    right.appendChild(elTimer);
    right.appendChild(mute);
    right.appendChild(reset);

    elHud.appendChild(left);
    elHud.appendChild(elCodes);
    elHud.appendChild(right);
    if (G.sfx) G.sfx.setMuted(G.state.muted);
    renderHud();
  }

  function renderHud() {
    if (!elCodes) return;
    elCodes.innerHTML = "";
    G.codeOrder.forEach((id) => {
      const st = G.stations[id];
      const done = G.state.solved[id];
      const slot = document.createElement("div");
      slot.className = "code-slot st-" + id + (done ? " filled" : "");
      slot.title = st.label + (done ? " ✓" : "");
      slot.innerHTML = '<span class="cs-digit">' + (done ? G.state.digits[id] : "?") + '</span><span class="cs-lbl">' + st.label.replace(/^.*\s/, "") + "</span>";
      elCodes.appendChild(slot);
    });
  }

  function setObjective() {
    if (!elObjective) return;
    if (G.state.escaped) {
      elObjective.innerHTML = "✅ <b>Fuga completata.</b>";
    } else if (allSolved()) {
      elObjective.innerHTML = "🔓 Tutti i codici trovati! Clicca la <b>PORTA BLINDATA</b> e digita il codice per uscire.";
    } else {
      elObjective.innerHTML = "🎮 Esplora la sala: clicca gli apparati, risolvi i <b>4 enigmi</b> (" + solvedCount() + "/4) e apri la porta blindata.";
    }
  }

  // --- Timer --------------------------------------------------------------
  function fmt(ms) {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  function elapsed() {
    return (G.state.finishTime || Date.now()) - G.state.startTime;
  }
  function startTimer() {
    stopTimer();
    timerHandle = setInterval(() => { if (elTimer) elTimer.textContent = fmt(elapsed()); }, 500);
  }
  function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

  // --- Finestre modali ----------------------------------------------------
  function openModal(title, subtitle, build, accent) {
    overlay.classList.remove("hidden");
    overlay.style.setProperty("--accent", accent || "#22d3ee");
    modalTitle.textContent = title;
    modalSub.textContent = subtitle || "";
    mount.innerHTML = "";
    build(mount);
  }
  function closeModal() { overlay.classList.add("hidden"); mount.innerHTML = ""; }

  // --- Apertura stazione (enigma) ----------------------------------------
  const ACCENT = { storage: "#22d3ee", vm: "#a78bfa", network: "#34d399", security: "#f87171" };
  G.openStation = function (id) {
    const st = G.stations[id];
    if (!st) return;
    if (G.state.escaped) return;
    if (G.state.solved[id]) {
      openModal(st.label + " ✓", "Stazione già completata", (box) => {
        box.appendChild(make("p", "pz-obj", "Hai già risolto questo enigma. Codice ottenuto: <b>" + G.state.digits[id] + "</b>."));
        box.appendChild(button("Torna alla sala", "pz-hintbtn", closeModal));
      }, ACCENT[id]);
      return;
    }
    if (G.sfx) G.sfx.click();
    openModal(st.label, st.sub, (box) => {
      G.puzzles[id](box, () => onSolved(id));
    }, ACCENT[id]);
  };

  function onSolved(id) {
    if (G.state.solved[id]) return;
    G.state.solved[id] = true;
    G.state.digits[id] = G.stations[id].digit;
    save();
    renderHud();
    setObjective();
    toast("🔑 Codice ottenuto: " + G.stations[id].digit + " — " + G.stations[id].label);
    setTimeout(() => {
      closeModal();
      if (allSolved()) toast("🔓 Hai tutti i codici! Vai alla porta blindata.");
    }, 900);
  }
  G.completeStation = onSolved; // alias usato anche dai test

  // --- Porta blindata: tastierino ----------------------------------------
  G.openDoor = function () {
    if (G.state.escaped) { showWin(); return; }
    if (G.sfx) G.sfx.click();
    let entry = "";
    openModal("Porta blindata", "Inserisci il codice di sblocco a 4 cifre", (box) => {
      const found = solvedCount();
      box.appendChild(make("p", "pz-obj", found < 4
        ? "🔒 Servono <b>4 cifre</b>. Finora hai trovato <b>" + found + "/4</b> codici risolvendo gli enigmi della sala."
        : "🔓 Hai tutti i codici. Digita le 4 cifre nell'ordine delle stazioni e premi <b>OK</b>."));

      const disp = make("div", "keypad-disp");
      for (let i = 0; i < 4; i++) disp.appendChild(make("span", "kp-cell", ""));
      box.appendChild(disp);

      const status = make("div", "pz-status", "");
      const pad = make("div", "keypad");
      function refresh() {
        [...disp.children].forEach((c, i) => { c.textContent = entry[i] || ""; c.classList.toggle("on", !!entry[i]); });
      }
      "123456789".split("").forEach((d) => pad.appendChild(key(d)));
      pad.appendChild(key("C", "wide", () => { entry = ""; status.textContent = ""; refresh(); }));
      pad.appendChild(key("0"));
      pad.appendChild(key("OK", "wide ok", submit));
      box.appendChild(pad);
      box.appendChild(status);

      function key(d, cls, fn) {
        return button(d, "kp-btn " + (cls || ""), fn || (() => {
          if (entry.length < 4) { entry += d; if (G.sfx) G.sfx.click(); refresh(); }
        }));
      }
      function submit() {
        if (entry.length < 4) { status.className = "pz-status warn"; status.textContent = "Inserisci tutte e 4 le cifre."; return; }
        if (!allSolved()) {
          status.className = "pz-status warn";
          status.textContent = "Mancano dei codici: risolvi prima tutti gli enigmi (" + solvedCount() + "/4).";
          if (G.sfx) G.sfx.err();
          return;
        }
        if (entry === DOOR_CODE) { win(); }
        else {
          status.className = "pz-status warn";
          status.textContent = "❌ Codice errato. Controlla le cifre sugli slot in alto.";
          disp.classList.add("shake");
          setTimeout(() => disp.classList.remove("shake"), 400);
          if (G.sfx) G.sfx.err();
        }
      }
      refresh();
    }, "#fbbf24");
  };

  // Esposto per i test: verifica/sblocco del codice.
  G.tryKeypad = function (code) {
    if (!allSolved()) return "missing";
    if (code === DOOR_CODE) { win(); return "ok"; }
    return "wrong";
  };

  // --- Vittoria -----------------------------------------------------------
  function win() {
    if (G.state.escaped) return;
    G.state.escaped = true;
    G.state.finishTime = Date.now();
    save();
    stopTimer();
    setObjective();
    if (G.sfx) G.sfx.win();
    showWin();
  }

  function rankByHints(h) {
    if (h === 0) return { medal: "🏆", label: "Tecnico Esperto — zero indizi!" };
    if (h <= 2) return { medal: "🥇", label: "Ottimo lavoro, tecnico!" };
    if (h <= 5) return { medal: "🥈", label: "Missione compiuta." };
    return { medal: "🎓", label: "Datacenter salvato — continua a fare pratica!" };
  }

  function showWin() {
    const r = rankByHints(G.state.hints || 0);
    openModal("FUGA RIUSCITA", "Lockdown rimosso — sistemi ripristinati", (box) => {
      box.appendChild(make("div", "win-medal", r.medal));
      box.appendChild(make("p", "win-rank", r.label));
      const stats = make("div", "win-stats");
      stats.appendChild(stat(fmt(elapsed()), "Tempo"));
      stats.appendChild(stat(String(G.state.hints || 0), "Indizi usati"));
      stats.appendChild(stat("4/4", "Enigmi risolti"));
      stats.appendChild(stat(DOOR_CODE, "Codice porta"));
      box.appendChild(stats);
      box.appendChild(make("p", "pz-dim center", "Hai dimostrato competenza in storage, virtualizzazione, network e security. 🎉"));
      box.appendChild(button("🔁 Gioca di nuovo", "pz-hintbtn", () => {
        G.state = fresh();
        save();
        renderHud();
        setObjective();
        startTimer();
        closeModal();
      }));
    }, "#34d399");
  }

  // --- Toast --------------------------------------------------------------
  let toastT = null;
  function toast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => elToast.classList.remove("show"), 2600);
  }

  // --- mini-helper DOM ----------------------------------------------------
  function make(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(text, cls, fn) {
    const b = document.createElement("button");
    b.className = cls || "";
    b.textContent = text;
    if (fn) b.onclick = fn;
    return b;
  }
  function stat(n, l) {
    const d = make("div", "win-stat");
    d.appendChild(make("span", "ws-n", n));
    d.appendChild(make("span", "ws-l", l));
    return d;
  }

  G.onHint = function () { G.state.hints = (G.state.hints || 0) + 1; save(); };

  // --- Avvio --------------------------------------------------------------
  let inited = false;
  function init() {
    if (inited) return; // evita doppia inizializzazione
    inited = true;
    elHud = document.getElementById("hud");
    elObjective = document.getElementById("objective");
    overlay = document.getElementById("overlay");
    modalTitle = document.getElementById("modal-title");
    modalSub = document.getElementById("modal-sub");
    mount = document.getElementById("puzzle-mount");
    elToast = document.getElementById("toast");

    document.getElementById("modal-close").onclick = closeModal;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.classList.contains("hidden")) closeModal(); });

    buildHud();
    setObjective();
    if (G.scene) G.scene.init(document.getElementById("scene"));
    startTimer();
    if (G.state.escaped) showWin();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  G._test = { allSolved, solvedCount, DOOR_CODE, fmt };
})();
