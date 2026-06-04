/*
 * main.js — Regia della campagna: modalità di difficoltà, livelli in sequenza,
 * HUD, finestre (enigmi + tastierino), transizioni di livello, vittoria,
 * budget indizi e salvataggio. Avvia scene.js e collega i clic a puzzles.js.
 */

(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.G = root.G || {};
  const SAVE_KEY = "datacenter-lockdown-v2";

  // --- Modalità di difficoltà --------------------------------------------
  G.MODES = {
    junior: { id: "junior", label: "Junior", desc: "Onboarding: ritmo tranquillo, 4 indizi per livello.", hints: 4, accent: "#34d399" },
    intermedio: { id: "intermedio", label: "Intermedio", desc: "Esperienza operativa: 2 indizi per livello.", hints: 2, accent: "#22d3ee" },
    senior: { id: "senior", label: "Senior", desc: "Sotto pressione: 1 solo indizio per livello.", hints: 1, accent: "#f87171" },
  };

  // --- Categorie (= stazioni fisse nella sala) ---------------------------
  G.codeOrder = ["storage", "vm", "network", "security"];
  const ACCENT = { storage: "#22d3ee", vm: "#a78bfa", network: "#34d399", security: "#f87171" };

  // --- I tre livelli ------------------------------------------------------
  G.LEVELS = [
    {
      n: 1, name: "Sala Server", tint: "#22d3ee",
      digits: { storage: 7, vm: 3, network: 5, security: 9 },
      stations: {
        storage: { label: "Rack Storage", sub: "Costruisci l'array RAID", variant: "raid",
          params: { diskSize: 2, diskCount: 4, target: 4, modes: ["RAID0", "RAID1", "RAID5"], minTol: 1 } },
        vm: { label: "Host Virtualizzazione", sub: "Assegna le VM", variant: "fit",
          params: { cap: 16, required: ["web", "db", "app"], vms: [
            { id: "web", name: "Web", gb: 4 }, { id: "db", name: "DB", gb: 8 }, { id: "app", name: "App", gb: 4 },
            { id: "cache", name: "Cache", gb: 6 }, { id: "test", name: "Test", gb: 2 }] } },
        network: { label: "Patch Panel", sub: "Ripristina il cablaggio", variant: "cable", params: { preset: "basic" } },
        security: { label: "Terminale SOC", sub: "Individua l'intruso", variant: "log", params: { preset: "basic" } },
      },
    },
    {
      n: 2, name: "Sala Rete", tint: "#34d399",
      digits: { storage: 4, vm: 8, network: 2, security: 6 },
      stations: {
        storage: { label: "Storage Array", sub: "Classifica i dati sui tier", variant: "tier", params: {} },
        vm: { label: "Host Virtualizzazione", sub: "Consolida senza overcommit", variant: "fit",
          params: { cap: 24, required: ["web", "db", "app", "mail"], vms: [
            { id: "web", name: "Web", gb: 6 }, { id: "db", name: "DB", gb: 8 }, { id: "app", name: "App", gb: 6 },
            { id: "mail", name: "Mail", gb: 4 }, { id: "cache", name: "Cache", gb: 8 }, { id: "ci", name: "CI", gb: 6 }] } },
        network: { label: "Router", sub: "Dimensiona la subnet", variant: "subnet", params: { minHosts: 50 } },
        security: { label: "Firewall", sub: "Scrivi le regole", variant: "fw", params: {} },
      },
    },
    {
      n: 3, name: "Sala Critica", tint: "#f87171",
      digits: { storage: 1, vm: 9, network: 5, security: 3 },
      stations: {
        storage: { label: "Rack Storage HA", sub: "Array ad alta resilienza", variant: "raid",
          params: { diskSize: 2, diskCount: 6, target: 8, modes: ["RAID0", "RAID1", "RAID5", "RAID6"], minTol: 2 } },
        vm: { label: "Cluster 2 Host", sub: "Distribuisci sul cluster", variant: "fit2",
          params: { caps: [12, 12], required: ["web", "db", "app", "mail"], vms: [
            { id: "web", name: "Web", gb: 4 }, { id: "db", name: "DB", gb: 8 }, { id: "app", name: "App", gb: 4 },
            { id: "mail", name: "Mail", gb: 6 }, { id: "cache", name: "Cache", gb: 6 }] } },
        network: { label: "Patch Panel", sub: "Topologia con DMZ", variant: "cable", params: { preset: "dmz" } },
        security: { label: "Terminale SOC", sub: "Caccia all'intruso", variant: "log", params: { preset: "hard" } },
      },
    },
  ];

  // --- Stato --------------------------------------------------------------
  function fresh() {
    return { mode: null, levelIndex: 0, solved: {}, digits: {}, hintsLeft: 0, hintsUsed: 0,
      startTime: Date.now(), levelStart: Date.now(), escaped: false, muted: false };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.solved && s.mode) return s; } catch (e) {}
    return null;
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); } catch (e) {} }
  G.state = load() || fresh();

  let elHud, elCodes, elTimer, elLevel, elMode, elHints, elObjective, overlay, modalTitle, modalSub, mount, elToast;
  let timerHandle = null;

  function level() { return G.LEVELS[G.state.levelIndex]; }
  function levelCode() { const d = level().digits; return G.codeOrder.map((id) => String(d[id])).join(""); }
  function allSolved() { return G.codeOrder.every((id) => G.state.solved[id]); }
  function solvedCount() { return G.codeOrder.filter((id) => G.state.solved[id]).length; }
  function curMode() { return G.MODES[G.state.mode] || G.MODES.junior; }

  // --- Applica i metadati del livello alla scena/HUD (senza azzerare i progressi)
  function applyLevelMeta(i) {
    G.state.levelIndex = i;
    const lv = G.LEVELS[i];
    G.stations = {};
    G.codeOrder.forEach((id) => { G.stations[id] = { label: lv.stations[id].label, sub: lv.stations[id].sub, digit: lv.digits[id] }; });
    G.levelInfo = { n: lv.n, name: lv.name, tint: lv.tint };
    renderHud();
    setObjective();
  }
  function setLevel(i) {
    G.state.solved = {}; G.state.digits = {};
    G.state.hintsLeft = curMode().hints;
    G.state.levelStart = Date.now();
    applyLevelMeta(i);
    save();
  }

  // --- HUD ----------------------------------------------------------------
  function buildHud() {
    elHud.innerHTML = "";
    const left = el("div", "hud-left");
    left.appendChild(el("span", "logo", "⬢ DATACENTER <b>LOCKDOWN</b>", true));
    elLevel = el("span", "hud-level"); left.appendChild(elLevel);

    elCodes = el("div", "hud-codes");

    const right = el("div", "hud-right");
    elMode = el("span", "hud-mode");
    elHints = el("span", "hud-hints");
    elTimer = el("span", "hud-timer", "00:00");
    const mute = el("button", "hud-btn", G.state.muted ? "🔇" : "🔊");
    mute.title = "Audio on/off";
    mute.onclick = () => { G.state.muted = !G.state.muted; if (G.sfx) G.sfx.setMuted(G.state.muted); mute.textContent = G.state.muted ? "🔇" : "🔊"; save(); };
    const reset = el("button", "hud-btn", "↺"); reset.title = "Ricomincia";
    reset.onclick = () => { if (confirm("Ricominciare la campagna da capo?")) { G.state = fresh(); save(); closeModal(); startScreen(); } };
    [elMode, elHints, elTimer, mute, reset].forEach((e) => right.appendChild(e));

    elHud.appendChild(left); elHud.appendChild(elCodes); elHud.appendChild(right);
    if (G.sfx) G.sfx.setMuted(G.state.muted);
    renderHud();
  }
  function renderHud() {
    if (!elCodes) return;
    if (elLevel) elLevel.textContent = G.levelInfo ? "LVL " + G.levelInfo.n + "/" + G.LEVELS.length + " · " + G.levelInfo.name : "";
    if (elMode) { elMode.textContent = curMode().label; elMode.style.color = curMode().accent; }
    if (elHints) elHints.textContent = "💡×" + (G.state.hintsLeft || 0);
    elCodes.innerHTML = "";
    G.codeOrder.forEach((id) => {
      const st = (G.stations && G.stations[id]) || { label: id };
      const done = G.state.solved[id];
      const slot = el("div", "code-slot st-" + id + (done ? " filled" : ""));
      slot.title = st.label + (done ? " ✓" : "");
      slot.innerHTML = '<span class="cs-digit">' + (done ? G.state.digits[id] : "?") + '</span><span class="cs-lbl">' + id + "</span>";
      elCodes.appendChild(slot);
    });
  }
  function setObjective() {
    if (!elObjective) return;
    if (G.state.escaped) elObjective.innerHTML = "🏆 <b>Campagna completata!</b>";
    else if (!G.state.mode) elObjective.innerHTML = "Scegli una modalità per iniziare.";
    else if (allSolved()) elObjective.innerHTML = "🔓 Codici completi! Clicca la <b>PORTA BLINDATA</b> per passare al livello successivo.";
    else elObjective.innerHTML = "🎮 Livello " + G.levelInfo.n + " — risolvi i <b>4 enigmi</b> (" + solvedCount() + "/4) e apri la porta.";
  }

  // --- Timer --------------------------------------------------------------
  function fmt(ms) { if (!ms || ms < 0) ms = 0; const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function elapsed() { return Date.now() - G.state.startTime; }
  function startTimer() { stopTimer(); timerHandle = setInterval(() => { if (elTimer) elTimer.textContent = fmt(elapsed()); }, 500); }
  function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

  // --- Modali -------------------------------------------------------------
  function openModal(title, subtitle, build, accent) {
    overlay.classList.remove("hidden");
    overlay.style.setProperty("--accent", accent || "#22d3ee");
    modalTitle.textContent = title; modalSub.textContent = subtitle || "";
    mount.innerHTML = ""; build(mount);
  }
  function closeModal() { overlay.classList.add("hidden"); mount.innerHTML = ""; }
  G.closeModal = closeModal;

  // --- Schermata iniziale: scelta modalità -------------------------------
  function startScreen() {
    applyLevelMeta(0); // mostra la sala del livello 1 dietro al menu
    openModal("DATACENTER LOCKDOWN", "Escape room IT a livelli — scegli la difficoltà", (box) => {
      box.appendChild(make("p", "pz-obj", "Sei il tecnico di turno: il datacenter è in <b>lockdown</b>. Supera <b>3 livelli</b> (Sala Server → Sala Rete → Sala Critica) risolvendo enigmi di storage, virtualizzazione, rete e sicurezza."));
      const grid = make("div", "mode-grid");
      Object.values(G.MODES).forEach((m) => {
        const card = make("button", "mode-card");
        card.style.setProperty("--mc", m.accent);
        card.innerHTML = '<span class="mc-name">' + m.label + '</span><span class="mc-desc">' + m.desc + "</span>";
        card.onclick = () => { if (G.sfx) G.sfx.click(); chooseMode(m.id); };
        grid.appendChild(card);
      });
      box.appendChild(grid);
    }, "#22d3ee");
  }
  function chooseMode(id) {
    G.state = fresh(); G.state.mode = id; G.state.startTime = Date.now();
    setLevel(0); closeModal();
    toast("Modalità " + curMode().label + " — Livello 1: " + level().name);
  }

  // --- Stazioni / enigmi --------------------------------------------------
  G.openStation = function (id) {
    if (!G.state.mode || G.state.escaped) return;
    const lv = level(), st = G.stations[id];
    if (G.state.solved[id]) {
      openModal(st.label + " ✓", "Stazione completata", (box) => {
        box.appendChild(make("p", "pz-obj", "Già risolto. Codice ottenuto: <b>" + G.state.digits[id] + "</b>."));
        box.appendChild(button("Torna alla sala", "pz-hintbtn", closeModal));
      }, ACCENT[id]);
      return;
    }
    if (G.sfx) G.sfx.click();
    openModal(st.label, st.sub, (box) => {
      G.buildPuzzle(box, () => onSolved(id), lv.stations[id]);
    }, ACCENT[id]);
  };
  function onSolved(id) {
    if (G.state.solved[id]) return;
    G.state.solved[id] = true; G.state.digits[id] = level().digits[id];
    save(); renderHud(); setObjective();
    toast("🔑 Codice ottenuto: " + G.state.digits[id] + " — " + G.stations[id].label);
    setTimeout(() => { closeModal(); if (allSolved()) toast("🔓 Codici completi! Vai alla porta blindata."); }, 900);
  }
  G.completeStation = onSolved;

  // --- Indizi -------------------------------------------------------------
  G.useHint = function () {
    if ((G.state.hintsLeft || 0) <= 0) return false;
    G.state.hintsLeft--; G.state.hintsUsed = (G.state.hintsUsed || 0) + 1;
    renderHud(); save(); return true;
  };

  // --- Porta blindata -----------------------------------------------------
  G.openDoor = function () {
    if (!G.state.mode) { startScreen(); return; }
    if (G.state.escaped) { showWin(); return; }
    if (G.sfx) G.sfx.click();
    const CODE = levelCode();
    let entry = "";
    openModal("Porta blindata — Livello " + G.levelInfo.n, "Inserisci il codice di sblocco a 4 cifre", (box) => {
      const found = solvedCount();
      box.appendChild(make("p", "pz-obj", found < 4
        ? "🔒 Servono <b>4 cifre</b>: finora ne hai trovate <b>" + found + "/4</b> risolvendo gli enigmi."
        : "🔓 Digita le 4 cifre nell'ordine delle stazioni e premi <b>OK</b>."));
      const disp = make("div", "keypad-disp");
      for (let i = 0; i < 4; i++) disp.appendChild(make("span", "kp-cell", ""));
      box.appendChild(disp);
      const status = make("div", "pz-status", "");
      const pad = make("div", "keypad");
      function refresh() { [...disp.children].forEach((c, i) => { c.textContent = entry[i] || ""; c.classList.toggle("on", !!entry[i]); }); }
      function key(d, cls, fn) { return button(d, "kp-btn " + (cls || ""), fn || (() => { if (entry.length < 4) { entry += d; if (G.sfx) G.sfx.click(); refresh(); } })); }
      "123456789".split("").forEach((d) => pad.appendChild(key(d)));
      pad.appendChild(key("C", "wide", () => { entry = ""; status.textContent = ""; refresh(); }));
      pad.appendChild(key("0"));
      pad.appendChild(key("OK", "wide ok", submit));
      box.appendChild(pad); box.appendChild(status);
      function submit() {
        if (entry.length < 4) { status.className = "pz-status warn"; status.textContent = "Inserisci tutte e 4 le cifre."; return; }
        if (!allSolved()) { status.className = "pz-status warn"; status.textContent = "Mancano codici: risolvi prima tutti gli enigmi (" + solvedCount() + "/4)."; if (G.sfx) G.sfx.err(); return; }
        if (entry === CODE) levelDone();
        else { status.className = "pz-status warn"; status.textContent = "❌ Codice errato. Controlla le cifre sugli slot in alto."; disp.classList.add("shake"); setTimeout(() => disp.classList.remove("shake"), 400); if (G.sfx) G.sfx.err(); }
      }
      refresh();
    }, "#fbbf24");
  };
  // Esposto per i test
  G.tryKeypad = function (code) { if (!allSolved()) return "missing"; if (code === levelCode()) { levelDone(); return "ok"; } return "wrong"; };

  // --- Fine livello / vittoria -------------------------------------------
  function levelDone() {
    if (G.sfx) G.sfx.ok();
    const isLast = G.state.levelIndex >= G.LEVELS.length - 1;
    if (isLast) { win(); return; }
    openModal("Livello " + G.levelInfo.n + " superato!", "Porta sbloccata", (box) => {
      box.appendChild(make("div", "win-medal", "🚪"));
      box.appendChild(make("p", "win-rank", "Avanzi al Livello " + (G.levelInfo.n + 1) + " — " + G.LEVELS[G.state.levelIndex + 1].name));
      box.appendChild(make("p", "pz-dim center", "Le difficoltà aumentano: nuovi enigmi ti aspettano."));
      box.appendChild(button("➡ Entra nel livello successivo", "pz-hintbtn", () => { setLevel(G.state.levelIndex + 1); closeModal(); toast("Livello " + G.levelInfo.n + ": " + level().name); }));
    }, level().tint);
  }
  function win() {
    if (G.state.escaped) return;
    G.state.escaped = true; G.state.finishTime = Date.now(); save(); stopTimer(); setObjective();
    if (G.sfx) G.sfx.win();
    showWin();
  }
  function rankByHints(h) {
    if (h === 0) return { medal: "🏆", label: "Tecnico Esperto — zero indizi in 3 livelli!" };
    if (h <= 3) return { medal: "🥇", label: "Ottimo lavoro, tecnico!" };
    if (h <= 7) return { medal: "🥈", label: "Campagna completata." };
    return { medal: "🎓", label: "Datacenter salvato — continua a fare pratica!" };
  }
  function showWin() {
    const r = rankByHints(G.state.hintsUsed || 0);
    openModal("CAMPAGNA COMPLETATA", "Tutti e 3 i livelli superati — lockdown rimosso", (box) => {
      box.appendChild(make("div", "win-medal", r.medal));
      box.appendChild(make("p", "win-rank", r.label));
      const stats = make("div", "win-stats");
      stats.appendChild(stat(fmt(Date.now() - G.state.startTime), "Tempo totale"));
      stats.appendChild(stat(String(G.state.hintsUsed || 0), "Indizi usati"));
      stats.appendChild(stat(curMode().label, "Modalità"));
      stats.appendChild(stat("3/3", "Livelli"));
      box.appendChild(stats);
      box.appendChild(make("p", "pz-dim center", "Storage, virtualizzazione, network e security: padroneggiati su tre livelli di difficoltà. 🎉"));
      box.appendChild(button("🔁 Nuova partita", "pz-hintbtn", () => { G.state = fresh(); save(); closeModal(); startScreen(); }));
    }, "#34d399");
  }

  // --- Toast / helper DOM -------------------------------------------------
  let toastT = null;
  function toast(msg) { if (!elToast) return; elToast.textContent = msg; elToast.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => elToast.classList.remove("show"), 2600); }
  function el(tag, cls, html, isHtml) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) { if (isHtml) e.innerHTML = html; else e.textContent = html; } return e; }
  function make(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function button(text, cls, fn) { const b = document.createElement("button"); b.className = cls || ""; b.textContent = text; if (fn) b.onclick = fn; return b; }
  function stat(n, l) { const d = make("div", "win-stat"); d.appendChild(make("span", "ws-n", n)); d.appendChild(make("span", "ws-l", l)); return d; }

  // --- Avvio --------------------------------------------------------------
  let inited = false;
  function init() {
    if (inited) return; inited = true;
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
    if (G.scene) G.scene.init(document.getElementById("scene"));
    startTimer();

    if (!G.state.mode) startScreen();
    else { applyLevelMeta(G.state.levelIndex); if (G.state.escaped) showWin(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  G._test = { allSolved, solvedCount, levelCode, fmt, level: () => level() };
})();
