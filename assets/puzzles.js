/*
 * puzzles.js — Gli enigmi interattivi, ora in VARIANTI parametrizzabili.
 *
 * Dispatcher pubblico:  G.buildPuzzle(box, onSolve, spec)
 *   spec = { variant, params }
 *   variant ∈ raid | tier | fit | fit2 | cable | subnet | log | fw
 *
 * Ogni livello/difficoltà passa parametri diversi (vedi G.LEVELS in main.js),
 * così gli stessi meccanismi producono enigmi via via più difficili.
 * La correttezza si appoggia a G.Logic (logic.js), coperto dai test.
 */

(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.G = root.G || {};
  const L = G.Logic;

  // ---------------------------------------------------------------- helpers
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs)
      for (const k in attrs) {
        const v = attrs[k];
        if (k === "class") e.className = v;
        else if (k === "html") e.innerHTML = v;
        else if (k === "text") e.textContent = v;
        else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
        else if (k.slice(0, 2) === "on" && typeof v === "function") e.addEventListener(k.slice(2), v);
        else if (v != null) e.setAttribute(k, v);
      }
    (kids || []).forEach((c) => e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return e;
  }
  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function obj(html) { return el("p", { class: "pz-obj", html: html }); }
  function statusEl() { return el("div", { class: "pz-status" }); }

  function hintBox(text) {
    const box = el("div", { class: "pz-hint hidden" });
    const btn = el("button", {
      class: "pz-hintbtn", text: "💡 Indizio",
      onclick: () => {
        const allowed = typeof G.useHint !== "function" || G.useHint();
        box.classList.remove("hidden");
        box.textContent = allowed ? "💡 " + text : "💡 Indizi esauriti in questa modalità.";
        btn.disabled = true;
      },
    });
    return { btn, box };
  }
  function foot(hint, extra) {
    const f = el("div", { class: "pz-foot" });
    (extra || []).forEach((e) => f.appendChild(e));
    f.appendChild(hint.btn);
    return f;
  }

  // drag & drop con pointer events (mouse + touch)
  function enableDrag(item) {
    item.classList.add("drag-item");
    item.style.touchAction = "none";
    item.addEventListener("pointerdown", (e) => {
      if (item.dataset.locked) return;
      e.preventDefault();
      const rect = item.getBoundingClientRect();
      const offX = e.clientX - rect.left, offY = e.clientY - rect.top, w = rect.width;
      const startParent = item.parentElement;
      try { item.setPointerCapture(e.pointerId); } catch (err) {}
      item.classList.add("dragging");
      item.style.position = "fixed"; item.style.width = w + "px"; item.style.zIndex = 9999;
      if (G.sfx) G.sfx.pick();
      function move(ev) { item.style.left = ev.clientX - offX + "px"; item.style.top = ev.clientY - offY + "px"; }
      function up(ev) {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        item.classList.remove("dragging");
        item.style.visibility = "hidden";
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        item.style.visibility = "";
        const zone = under ? under.closest("[data-drop]") : null;
        item.style.position = item.style.left = item.style.top = item.style.width = item.style.zIndex = "";
        if (item._onDrop) item._onDrop(zone, startParent);
        if (G.sfx) G.sfx.drop();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      move(e);
    });
  }
  function lockAll(container) {
    container.querySelectorAll(".drag-item").forEach((d) => (d.dataset.locked = "1"));
  }

  // ====================================================================
  // STORAGE — RAID (raid)
  // ====================================================================
  function buildRaid(box, onSolve, p) {
    const DISK = p.diskSize || 2, N = p.diskCount || 4, TARGET = p.target || 4;
    const MODES = p.modes || ["RAID0", "RAID1", "RAID5"], MINTOL = p.minTol || 1;
    let mode = MODES[0], done = false;

    box.appendChild(obj(`🎯 <b>Obiettivo:</b> array da <b>${TARGET} TB utilizzabili</b> che resista al guasto di <b>${MINTOL} disco${MINTOL > 1 ? "/i" : ""}</b>.<br><span class="pz-dim">Trascina i dischi (${DISK} TB l'uno) nell'array e scegli il RAID giusto.</span>`));

    const seg = el("div", { class: "seg" });
    MODES.forEach((m) => seg.appendChild(el("button", { class: "seg-btn" + (m === mode ? " on" : ""), text: m, "data-m": m,
      onclick: () => { mode = m; [...seg.children].forEach((b) => b.classList.toggle("on", b.dataset.m === m)); if (G.sfx) G.sfx.click(); recalc(); } })));
    box.appendChild(seg);

    const tray = el("div", { class: "dropzone tray", "data-drop": "tray" }, [el("span", { class: "zone-lbl", text: "Dischi disponibili" })]);
    const array = el("div", { class: "dropzone array", "data-drop": "array" }, [el("span", { class: "zone-lbl", text: "Array RAID" })]);
    box.appendChild(el("div", { class: "zones2" }, [tray, array]));
    for (let i = 0; i < N; i++) {
      const d = el("div", { class: "disk" }, [el("span", { class: "disk-cap", text: DISK + "TB" })]);
      d._onDrop = (zone, sp) => { (zone && (zone.dataset.drop === "array" || zone.dataset.drop === "tray") ? zone : sp).appendChild(d); recalc(); };
      enableDrag(d); tray.appendChild(d);
    }
    const read = el("div", { class: "pz-readout" }), status = statusEl();
    box.appendChild(read); box.appendChild(status);
    const h = hintBox(`Con RAID 5 la capacità utile è (n−1)×disco; con RAID 6 è (n−2)×disco e tollera 2 guasti. Quanti dischi da ${DISK} TB servono per ${TARGET} TB?`);
    box.appendChild(foot(h)); box.appendChild(h.box);

    function recalc() {
      const n = array.querySelectorAll(".disk").length;
      const sizes = new Array(n).fill(DISK);
      const valid = L.raidValid(mode, n), usable = L.raidUsable(mode, sizes), tol = L.raidTolerance(mode, n);
      read.innerHTML = `<span>Modalità: <b>${mode}</b></span><span>Dischi: <b>${n}</b></span><span>Utile: <b class="${usable === TARGET ? "good" : ""}">${valid ? usable : "—"} TB</b></span><span>Tollera: <b class="${tol >= MINTOL ? "good" : ""}">${valid ? tol : "—"} guasti</b></span>`;
      array.classList.toggle("over", !valid && n > 0);
      status.className = "pz-status" + (!valid && n > 0 ? " warn" : "");
      status.textContent = !valid && n > 0 ? `${mode} richiede più dischi.` : "";
      if (!done && L.storageSolved(mode, sizes, TARGET, MINTOL)) {
        done = true; status.className = "pz-status ok";
        status.innerHTML = `✅ Array corretto: <b>${mode}</b>, ${usable} TB, tollera ${tol} guasti.`;
        lockAll(array); if (G.sfx) G.sfx.ok(); setTimeout(onSolve, 700);
      }
    }
    recalc();
  }

  // ====================================================================
  // STORAGE — TIERING (tier)
  // ====================================================================
  function buildTier(box, onSolve, p) {
    const ITEMS = [
      { id: "db", name: "Database in produzione", note: "IOPS altissimi", tier: "ssd" },
      { id: "vmos", name: "Dischi sistema VM", note: "accesso frequente", tier: "ssd" },
      { id: "backup", name: "Backup notturni", note: "capacità, costo basso", tier: "hdd" },
      { id: "archive", name: "Archivio legale 10 anni", note: "raramente letto", tier: "tape" },
    ];
    const TIERS = [
      { id: "ssd", name: "SSD / NVMe", note: "velocissimo, costoso" },
      { id: "hdd", name: "HDD", note: "capiente, economico" },
      { id: "tape", name: "Tape / Glacier", note: "lentissimo, costo minimo" },
    ];
    const correct = {}; ITEMS.forEach((i) => (correct[i.id] = i.tier));
    let done = false;

    box.appendChild(obj(`🎯 <b>Obiettivo:</b> assegna ogni dato al <b>tier di storage</b> giusto in base a prestazioni e costo.<br><span class="pz-dim">Trascina ogni cartellino sul tier corretto.</span>`));
    const pool = el("div", { class: "dropzone tray tier-pool", "data-drop": "pool" }, [el("span", { class: "zone-lbl", text: "Dati da classificare" })]);
    box.appendChild(pool);
    const tierWrap = el("div", { class: "tier-zones" });
    TIERS.forEach((t) => tierWrap.appendChild(el("div", { class: "dropzone tier", "data-drop": "tier", "data-tier": t.id }, [el("span", { class: "zone-lbl", html: `${t.name} <small>· ${t.note}</small>` })])));
    box.appendChild(tierWrap);
    const status = statusEl(); box.appendChild(status);

    ITEMS.forEach((it) => {
      const card = el("div", { class: "data-item", "data-id": it.id }, [el("b", { text: it.name }), el("span", { class: "di-note", text: it.note })]);
      card._onDrop = (zone, sp) => { (zone && (zone.dataset.drop === "tier" || zone.dataset.drop === "pool") ? zone : sp).appendChild(card); recalc(); };
      enableDrag(card); pool.appendChild(card);
    });
    const h = hintBox("Database e dischi VM = SSD (serve velocità). Backup = HDD (capacità a basso costo). Archivio a lungo termine raramente letto = Tape.");
    box.appendChild(foot(h)); box.appendChild(h.box);

    function recalc() {
      const placement = {};
      ITEMS.forEach((it) => {
        const z = box.querySelector('.data-item[data-id="' + it.id + '"]').closest("[data-drop]");
        placement[it.id] = z && z.dataset.drop === "tier" ? z.dataset.tier : null;
      });
      const allPlaced = ITEMS.every((it) => placement[it.id]);
      if (!done && allPlaced && L.tieringSolved(placement, correct)) {
        done = true; status.className = "pz-status ok";
        status.innerHTML = "✅ Tiering corretto: ogni dato sul supporto giusto per prestazioni e costo.";
        lockAll(box); if (G.sfx) G.sfx.ok(); setTimeout(onSolve, 700);
      } else if (allPlaced) {
        status.className = "pz-status warn"; status.textContent = "Qualcosa non torna: controlla prestazioni vs costo di ogni tier.";
      } else { status.className = "pz-status"; status.textContent = ""; }
    }
  }

  // ====================================================================
  // VM — singolo host (fit)
  // ====================================================================
  function buildVmFit(box, onSolve, p) {
    const CAP = p.cap || 16, REQUIRED = p.required, VMS = p.vms;
    const sizeById = {}; VMS.forEach((v) => (sizeById[v.id] = v.gb));
    const reqNames = REQUIRED.map((id) => VMS.find((v) => v.id === id).name).join(", ");
    let done = false;

    box.appendChild(obj(`🎯 <b>Obiettivo:</b> avvia le VM di produzione <b>${reqNames}</b> sul host <b>senza superare ${CAP} GB</b> di RAM.<br><span class="pz-dim">Trascina le VM sul host. Attenzione all'overcommit!</span>`));
    const tray = el("div", { class: "dropzone tray", "data-drop": "tray" }, [el("span", { class: "zone-lbl", text: "VM disponibili" })]);
    const host = el("div", { class: "dropzone host", "data-drop": "host" }, [el("span", { class: "zone-lbl", text: "🖥️ Host — RAM " + CAP + " GB" })]);
    box.appendChild(el("div", { class: "zones2" }, [tray, host]));
    const bar = ramBar(); box.appendChild(bar.wrap);
    const status = statusEl(); box.appendChild(status);

    VMS.forEach((v) => {
      const vm = el("div", { class: "vm vm-" + v.id, "data-id": v.id }, [el("b", { text: v.name }), el("span", { class: "vm-gb", text: v.gb + " GB" })]);
      vm._onDrop = (zone, sp) => { (zone && (zone.dataset.drop === "host" || zone.dataset.drop === "tray") ? zone : sp).appendChild(vm); recalc(); };
      enableDrag(vm); tray.appendChild(vm);
    });
    const h = hintBox(`Somma la RAM delle VM richieste e mettile sul host senza sforare ${CAP} GB. Le altre VM sono distrattori.`);
    box.appendChild(foot(h)); box.appendChild(h.box);

    function recalc() {
      const ids = [...host.querySelectorAll(".vm")].map((e) => e.dataset.id);
      const total = L.vmTotal(ids, sizeById), over = total > CAP;
      bar.set(total, CAP, over);
      status.className = "pz-status" + (over ? " warn" : "");
      status.textContent = over ? "⚠️ Overcommit: le VM non si avvierebbero." : "";
      if (!done && L.vmSolved(ids, sizeById, CAP, REQUIRED)) {
        done = true; status.className = "pz-status ok";
        status.innerHTML = "✅ Consolidamento corretto: tutte le VM richieste entrano nei " + CAP + " GB.";
        lockAll(box); if (G.sfx) G.sfx.ok(); setTimeout(onSolve, 700);
      }
    }
    recalc();
  }

  // ====================================================================
  // VM — cluster a 2 host (fit2)
  // ====================================================================
  function buildVmFit2(box, onSolve, p) {
    const CAPS = p.caps || [12, 12], REQUIRED = p.required, VMS = p.vms;
    const sizeById = {}; VMS.forEach((v) => (sizeById[v.id] = v.gb));
    const reqNames = REQUIRED.map((id) => VMS.find((v) => v.id === id).name).join(", ");
    let done = false;

    box.appendChild(obj(`🎯 <b>Obiettivo:</b> distribuisci <b>${reqNames}</b> sui <b>2 host</b> del cluster senza che nessuno superi la propria RAM.<br><span class="pz-dim">Nessun host può andare in overcommit: bilancia il carico.</span>`));
    const tray = el("div", { class: "dropzone tray", "data-drop": "tray" }, [el("span", { class: "zone-lbl", text: "VM da distribuire" })]);
    box.appendChild(tray);
    const hosts = [], bars = [];
    const hostRow = el("div", { class: "zones2" });
    CAPS.forEach((cap, i) => {
      const host = el("div", { class: "dropzone host", "data-drop": "host", "data-host": i }, [el("span", { class: "zone-lbl", text: "🖥️ Host " + (i + 1) + " — " + cap + " GB" })]);
      const b = ramBar();
      const col = el("div", {}, [host, b.wrap]);
      hosts.push(host); bars.push(b); hostRow.appendChild(col);
    });
    box.appendChild(hostRow);
    const status = statusEl(); box.appendChild(status);

    VMS.forEach((v) => {
      const vm = el("div", { class: "vm vm-" + v.id, "data-id": v.id }, [el("b", { text: v.name }), el("span", { class: "vm-gb", text: v.gb + " GB" })]);
      vm._onDrop = (zone, sp) => { (zone && (zone.dataset.drop === "host" || zone.dataset.drop === "tray") ? zone : sp).appendChild(vm); recalc(); };
      enableDrag(vm); tray.appendChild(vm);
    });
    const h = hintBox("Somma le richieste e spezzale tra i due host: es. metti la VM più grande da sola con una piccola, e le altre due sull'altro host.");
    box.appendChild(foot(h)); box.appendChild(h.box);

    function recalc() {
      const placement = {};
      VMS.forEach((v) => {
        const z = box.querySelector('.vm[data-id="' + v.id + '"]').closest("[data-drop]");
        placement[v.id] = z && z.dataset.drop === "host" ? Number(z.dataset.host) : -1;
      });
      let over = false;
      CAPS.forEach((cap, i) => {
        const sum = VMS.filter((v) => placement[v.id] === i).reduce((a, v) => a + v.gb, 0);
        const o = sum > cap; if (o) over = true; bars[i].set(sum, cap, o);
      });
      status.className = "pz-status" + (over ? " warn" : "");
      status.textContent = over ? "⚠️ Un host è in overcommit: ribilancia." : "";
      if (!done && L.vmMultiSolved(placement, sizeById, CAPS, REQUIRED)) {
        done = true; status.className = "pz-status ok";
        status.innerHTML = "✅ Cluster bilanciato: tutte le VM girano senza overcommit.";
        lockAll(box); if (G.sfx) G.sfx.ok(); setTimeout(onSolve, 700);
      }
    }
    recalc();
  }

  function ramBar() {
    const fill = el("div", { class: "ram-fill" }), txt = el("span", { class: "ram-txt" });
    const wrap = el("div", { class: "ram-bar" }, [fill, txt]);
    return { wrap, set: (used, cap, over) => { fill.style.width = Math.min(100, (used / cap) * 100) + "%"; fill.classList.toggle("over", over); txt.textContent = used + " / " + cap + " GB" + (over ? " — OVERCOMMIT!" : ""); } };
  }

  // ====================================================================
  // NETWORK — cablaggio (cable)
  // ====================================================================
  function buildCable(box, onSolve, p) {
    const PRESETS = {
      basic: {
        nodes: [
          { id: "pc", label: "PC", icon: "🖥️", x: 80, y: 70 },
          { id: "switch", label: "Switch", icon: "🔀", x: 250, y: 180 },
          { id: "router", label: "Router", icon: "📡", x: 430, y: 70 },
          { id: "internet", label: "Internet", icon: "🌐", x: 600, y: 180 },
        ],
        required: [["pc", "switch"], ["switch", "router"], ["router", "internet"]],
        goal: "PC → Switch → Router → Internet",
      },
      dmz: {
        nodes: [
          { id: "pc", label: "PC", icon: "🖥️", x: 70, y: 60 },
          { id: "switch", label: "Switch", icon: "🔀", x: 210, y: 160 },
          { id: "fw", label: "Firewall", icon: "🧱", x: 360, y: 70 },
          { id: "dmz", label: "Server DMZ", icon: "🗄️", x: 360, y: 210 },
          { id: "router", label: "Router", icon: "📡", x: 510, y: 150 },
          { id: "internet", label: "Internet", icon: "🌐", x: 640, y: 60 },
        ],
        required: [["pc", "switch"], ["switch", "fw"], ["fw", "router"], ["router", "internet"], ["fw", "dmz"]],
        goal: "PC→Switch→Firewall→Router→Internet, con il Server DMZ dietro il Firewall",
      },
    };
    const cfg = PRESETS[p.preset || "basic"];
    const nodeById = {}; cfg.nodes.forEach((n) => (nodeById[n.id] = n));
    let edges = [], sel = null, done = false;

    box.appendChild(obj(`🎯 <b>Obiettivo:</b> ripristina il percorso: <b>${cfg.goal}</b>.<br><span class="pz-dim">Clicca due apparati per collegarli; clicca un cavo per rimuoverlo.</span>`));
    const stage = svg("svg", { class: "net-stage", viewBox: "0 0 680 250" });
    const gC = svg("g", {}), gP = svg("g", {});
    stage.appendChild(gC); stage.appendChild(gP); box.appendChild(stage);
    const layer = el("div", { class: "net-nodes" }); box.appendChild(layer);
    const status = statusEl(); box.appendChild(status);
    const h = hintBox("Collega gli apparati in fila, uno dopo l'altro, senza 'saltare' tappe. Servono esattamente " + cfg.required.length + " cavi.");
    box.appendChild(foot(h, [el("button", { class: "pz-hintbtn ghost", text: "↺ Ripristina", onclick: () => { edges = []; sel = null; render(); } })]));
    box.appendChild(h.box);

    function pos(id) { return nodeById[id]; }
    function idxEdge(a, b) { const k = L.edgeKey(a, b); return edges.findIndex((e) => L.edgeKey(e[0], e[1]) === k); }
    function toggle(a, b) { if (a === b) return; const i = idxEdge(a, b); if (i >= 0) edges.splice(i, 1); else edges.push([a, b]); }
    function click(id) { if (done) return; if (G.sfx) G.sfx.click(); if (sel === null) sel = id; else if (sel === id) sel = null; else { toggle(sel, id); sel = null; } render(); }

    function render() {
      gC.innerHTML = "";
      edges.forEach(([a, b]) => {
        const pa = pos(a), pb = pos(b);
        const line = svg("line", { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, class: "net-cable" + (done ? " ok" : "") });
        line.style.cursor = "pointer";
        line.addEventListener("click", () => { if (!done) { toggle(a, b); render(); } });
        gC.appendChild(line);
      });
      layer.innerHTML = "";
      cfg.nodes.forEach((n) => {
        layer.appendChild(el("button", { class: "net-node" + (sel === n.id ? " sel" : ""), style: { left: (n.x / 680) * 100 + "%", top: (n.y / 250) * 100 + "%" }, onclick: () => click(n.id) }, [el("span", { class: "net-ico", text: n.icon }), el("span", { class: "net-lbl", text: n.label })]));
      });
      if (done) return;
      if (L.networkSolved(edges, cfg.required)) {
        done = true; status.className = "pz-status ok"; status.innerHTML = "✅ Percorso completo: il traffico raggiunge Internet!";
        render(); packet();
        return;
      }
      status.className = "pz-status";
      status.textContent = sel ? "Apparato selezionato: clicca il prossimo per collegarlo." : edges.length ? "Topologia incompleta o errata." : "";
    }
    function packet() {
      const order = cfg.preset === "dmz" ? ["pc", "switch", "fw", "router", "internet"] : ["pc", "switch", "router", "internet"];
      const path = order.map(pos), dot = svg("circle", { r: 6, class: "net-packet" });
      gP.appendChild(dot); let seg = 0, t0 = null;
      function step(ts) {
        if (t0 == null) t0 = ts; const k = Math.min(1, (ts - t0) / 360), a = path[seg], b = path[seg + 1];
        dot.setAttribute("cx", a.x + (b.x - a.x) * k); dot.setAttribute("cy", a.y + (b.y - a.y) * k);
        if (k >= 1) { seg++; t0 = ts; if (seg >= path.length - 1) { if (G.sfx) G.sfx.ok(); setTimeout(onSolve, 350); return; } }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    cfg.preset_ = p.preset; // (solo per packet order)
    render();
  }

  // ====================================================================
  // NETWORK — subnetting (subnet)
  // ====================================================================
  function buildSubnet(box, onSolve, p) {
    const MIN = p.minHosts || 50, PREFIXES = [24, 25, 26, 27, 28];
    let prefix = 24, done = false;

    box.appendChild(obj(`🎯 <b>Obiettivo:</b> ti servono almeno <b>${MIN} host</b> in una subnet. Scegli il prefisso <b>più efficiente</b> (che non sprechi indirizzi).<br><span class="pz-dim">Host utilizzabili = 2^(32−prefisso) − 2.</span>`));
    const btns = el("div", { class: "prefix-btns" });
    PREFIXES.forEach((pf) => btns.appendChild(el("button", { class: "prefix-btn" + (pf === prefix ? " on" : ""), text: "/" + pf, "data-p": pf,
      onclick: () => { if (done) return; prefix = pf; [...btns.children].forEach((b) => b.classList.toggle("on", Number(b.dataset.p) === pf)); if (G.sfx) G.sfx.click(); recalc(); } })));
    box.appendChild(btns);
    const read = el("div", { class: "subnet-readout" }); box.appendChild(read);
    const status = statusEl(); box.appendChild(status);
    const h = hintBox(`Cerca il prefisso più ALTO (subnet più piccola) che dia comunque almeno ${MIN} host. /26 = 62 host, /27 = 30 host.`);
    box.appendChild(foot(h)); box.appendChild(h.box);

    function recalc() {
      const hosts = L.usableHosts(prefix), enough = hosts >= MIN;
      read.innerHTML = `Subnet <b>/${prefix}</b> → <b class="${enough ? "good" : "bad"}">${hosts}</b> host utilizzabili <span class="pz-dim">(servono ≥ ${MIN})</span>`;
      if (!done && L.subnetSolved(prefix, MIN)) {
        done = true; status.className = "pz-status ok";
        status.innerHTML = `✅ Giusto! <b>/${prefix}</b> offre ${hosts} host: copre il fabbisogno con il minimo spreco.`;
        if (G.sfx) G.sfx.ok(); setTimeout(onSolve, 650);
      } else if (!enough) {
        status.className = "pz-status warn"; status.textContent = "Troppo piccola: non bastano gli host.";
      } else {
        status.className = "pz-status"; status.textContent = "Funziona, ma spreca indirizzi: puoi essere più efficiente.";
      }
    }
    recalc();
  }

  // ====================================================================
  // SECURITY — analisi log (log)
  // ====================================================================
  function buildLog(box, onSolve, p) {
    const DATA = {
      basic: [
        { ip: "10.0.0.5", status: "OK", user: "mario", t: "02:01" },
        { ip: "10.0.0.8", status: "OK", user: "lucia", t: "02:03" },
        { ip: "185.23.44.9", status: "FAILED", user: "root", t: "02:07" },
        { ip: "185.23.44.9", status: "FAILED", user: "root", t: "02:07" },
        { ip: "10.0.0.5", status: "OK", user: "mario", t: "02:08" },
        { ip: "185.23.44.9", status: "FAILED", user: "admin", t: "02:08" },
        { ip: "185.23.44.9", status: "FAILED", user: "admin", t: "02:08" },
        { ip: "185.23.44.9", status: "FAILED", user: "test", t: "02:09" },
        { ip: "10.0.0.12", status: "OK", user: "giulia", t: "02:10" },
      ],
      hard: [
        { ip: "10.0.0.5", status: "OK", user: "mario", t: "03:00" },
        { ip: "45.9.12.7", status: "FAILED", user: "admin", t: "03:01" },
        { ip: "10.0.0.9", status: "OK", user: "sara", t: "03:02" },
        { ip: "45.9.12.7", status: "FAILED", user: "root", t: "03:03" },
        { ip: "10.0.0.5", status: "FAILED", user: "mario", t: "03:03" },
        { ip: "45.9.12.7", status: "FAILED", user: "oracle", t: "03:04" },
        { ip: "10.0.0.21", status: "OK", user: "team", t: "03:05" },
        { ip: "45.9.12.7", status: "FAILED", user: "postgres", t: "03:06" },
        { ip: "45.9.12.7", status: "FAILED", user: "ubuntu", t: "03:07" },
        { ip: "10.0.0.9", status: "OK", user: "sara", t: "03:08" },
        { ip: "45.9.12.7", status: "FAILED", user: "git", t: "03:09" },
      ],
    };
    const LINES = DATA[p.preset || "basic"], attacker = L.attackerIp(LINES, 3);
    let done = false;

    box.appendChild(obj(`🎯 <b>Obiettivo:</b> clicca nel log l'<b>IP che fa brute-force</b> per bloccarlo al firewall.<br><span class="pz-dim">Cerca molti accessi FALLITI di seguito dallo stesso indirizzo, con utenti diversi.</span>`));
    const term = el("div", { class: "terminal" }, [el("div", { class: "term-bar" }, [el("span", { class: "dot r" }), el("span", { class: "dot y" }), el("span", { class: "dot g" }), el("span", { class: "term-title", text: "auth.log — accessi SSH" })])]);
    const list = el("div", { class: "term-body" }); term.appendChild(list); box.appendChild(term);
    const status = statusEl(); box.appendChild(status);
    LINES.forEach((ln) => list.appendChild(el("button", { class: "log-row " + (ln.status === "FAILED" ? "bad" : "good"), onclick: () => clickRow(ln) }, [el("span", { class: "log-t", text: ln.t }), el("span", { class: "log-ip", text: ln.ip }), el("span", { class: "log-st", text: ln.status }), el("span", { class: "log-u", text: "user=" + ln.user })])));
    const h = hintBox("L'attaccante prova in sequenza tanti utenti (root, admin, oracle…) con password sbagliate dallo stesso IP.");
    box.appendChild(foot(h)); box.appendChild(h.box);

    function clickRow(ln) {
      if (done) return;
      if (ln.ip === attacker) {
        done = true; if (G.sfx) G.sfx.ok();
        [...list.children].forEach((r) => { if (r.querySelector(".log-ip").textContent === attacker) r.classList.add("banned"); });
        status.className = "pz-status ok"; status.innerHTML = "✅ IP <b>" + attacker + "</b> bloccato dal firewall!";
        setTimeout(onSolve, 750);
      } else { if (G.sfx) G.sfx.err(); status.className = "pz-status warn"; status.textContent = "❌ Traffico legittimo. Cerca i FALLITI ripetuti dallo stesso IP."; }
    }
  }

  // ====================================================================
  // SECURITY — regole firewall (fw)
  // ====================================================================
  function buildFirewall(box, onSolve, p) {
    const RULES = [
      { id: "r1", ip: "203.0.113.9", note: "centinaia di SYN al secondo (port scan)", kind: "attacker" },
      { id: "r2", ip: "10.0.0.0/24", note: "rete interna degli uffici", kind: "legit" },
      { id: "r3", ip: "198.51.100.7", note: "tentativi RDP falliti a raffica", kind: "attacker" },
      { id: "r4", ip: "52.94.0.0/16", note: "backup verso cloud aziendale", kind: "legit" },
    ];
    const decisions = {}; let done = false;

    box.appendChild(obj(`🎯 <b>Obiettivo:</b> scrivi le regole del firewall: <b>nega</b> il traffico ostile e <b>consenti</b> quello legittimo.<br><span class="pz-dim">Per ogni voce scegli ALLOW o DENY in base alla descrizione.</span>`));
    const tbl = el("div", { class: "fw-table" });
    RULES.forEach((r) => {
      const allow = el("button", { class: "fw-toggle fw-allow", text: "ALLOW", onclick: () => set(r.id, "allow") });
      const deny = el("button", { class: "fw-toggle fw-deny", text: "DENY", onclick: () => set(r.id, "deny") });
      r._allow = allow; r._deny = deny;
      tbl.appendChild(el("div", { class: "fw-rule" }, [el("div", { class: "fw-info" }, [el("b", { text: r.ip }), el("span", { class: "fw-note", text: r.note })]), el("div", { class: "fw-actions" }, [allow, deny])]));
    });
    box.appendChild(tbl);
    const status = statusEl(); box.appendChild(status);
    const h = hintBox("Port scan e tentativi RDP falliti = attacco → DENY. Rete uffici e backup cloud = legittimo → ALLOW.");
    box.appendChild(foot(h)); box.appendChild(h.box);

    function set(id, val) {
      if (done) return; decisions[id] = val; if (G.sfx) G.sfx.click();
      RULES.forEach((r) => { r._allow.classList.toggle("on", decisions[r.id] === "allow"); r._deny.classList.toggle("on", decisions[r.id] === "deny"); });
      const allSet = RULES.every((r) => decisions[r.id]);
      if (L.firewallSolved(RULES, decisions)) {
        done = true; status.className = "pz-status ok"; status.innerHTML = "✅ Regole corrette: attacchi bloccati, traffico legittimo permesso.";
        if (G.sfx) G.sfx.ok(); setTimeout(onSolve, 700);
      } else if (allSet) { status.className = "pz-status warn"; status.textContent = "Qualche regola è sbagliata: rileggi le descrizioni."; }
      else { status.className = "pz-status"; status.textContent = ""; }
    }
  }

  // ---------------------------------------------------------------- dispatch
  const BUILDERS = { raid: buildRaid, tier: buildTier, fit: buildVmFit, fit2: buildVmFit2, cable: buildCable, subnet: buildSubnet, log: buildLog, fw: buildFirewall };
  G.buildPuzzle = function (box, onSolve, spec) {
    const fn = BUILDERS[spec.variant];
    if (fn) fn(box, onSolve, spec.params || {});
  };
})();
