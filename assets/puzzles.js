/*
 * puzzles.js — I quattro enigmi interattivi (manipolazione diretta, non quiz).
 *
 *   storage  → trascina i dischi e scegli il RAID per ottenere l'array richiesto
 *   vm       → trascina le VM sul host senza superare la RAM
 *   network  → collega i nodi (clic-per-collegare) per ripristinare il percorso
 *   security → clicca nel log l'IP che sta facendo brute-force
 *
 * Ogni enigma è una factory G.puzzles.<id>(container, onSolve) che costruisce
 * l'interfaccia nel contenitore e chiama onSolve() quando viene risolto.
 * La correttezza si appoggia a G.Logic (vedi logic.js), testato a parte.
 */

(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.G = root.G || {};
  const L = G.Logic;

  // --- mini-helper DOM ----------------------------------------------------
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
  function hintBox(text) {
    const box = el("div", { class: "pz-hint hidden" });
    const btn = el("button", {
      class: "pz-hintbtn",
      text: "💡 Indizio",
      onclick: () => {
        box.classList.remove("hidden");
        box.textContent = "💡 " + text;
        btn.disabled = true;
        if (typeof G.onHint === "function") G.onHint();
      },
    });
    return { btn, box };
  }

  // --- Drag & drop con pointer events (mouse + touch) ---------------------
  function enableDrag(item) {
    item.classList.add("drag-item");
    item.style.touchAction = "none";
    item.addEventListener("pointerdown", (e) => {
      if (item.dataset.locked) return;
      e.preventDefault();
      const rect = item.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      const w = rect.width;
      const startParent = item.parentElement;
      try { item.setPointerCapture(e.pointerId); } catch (err) {}
      item.classList.add("dragging");
      item.style.position = "fixed";
      item.style.width = w + "px";
      item.style.zIndex = 9999;
      if (G.sfx) G.sfx.pick();

      function move(ev) {
        item.style.left = ev.clientX - offX + "px";
        item.style.top = ev.clientY - offY + "px";
      }
      function up(ev) {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        item.classList.remove("dragging");
        item.style.visibility = "hidden";
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        item.style.visibility = "";
        const zone = under ? under.closest("[data-drop]") : null;
        item.style.position = "";
        item.style.left = item.style.top = item.style.width = item.style.zIndex = "";
        const fn = item._onDrop;
        if (fn) fn(zone, startParent);
        if (G.sfx) G.sfx.drop();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      move(e);
    });
  }

  // =====================================================================
  // 1) STORAGE — costruisci l'array RAID
  // =====================================================================
  G.puzzles = G.puzzles || {};

  G.puzzles.storage = function (box, onSolve) {
    const TARGET = 4; // TB utili richiesti
    const DISK = 2; // TB per disco
    let mode = "RAID0";
    let done = false;

    box.appendChild(el("p", { class: "pz-obj", html:
      `🎯 <b>Obiettivo:</b> configura un array da <b>${TARGET} TB utilizzabili</b> che continui a funzionare anche se <b>si rompe 1 disco</b>.<br><span class="pz-dim">Trascina i dischi nell'array e scegli il livello RAID giusto.</span>` }));

    // selettore RAID
    const modes = ["RAID0", "RAID1", "RAID5"];
    const modeWrap = el("div", { class: "seg" });
    modes.forEach((m) => {
      modeWrap.appendChild(el("button", {
        class: "seg-btn" + (m === mode ? " on" : ""),
        text: m,
        "data-m": m,
        onclick: () => { mode = m; [...modeWrap.children].forEach((b) => b.classList.toggle("on", b.dataset.m === m)); if (G.sfx) G.sfx.click(); revalidate(); },
      }));
    });
    box.appendChild(modeWrap);

    // zone
    const tray = el("div", { class: "dropzone tray", "data-drop": "tray" }, [el("span", { class: "zone-lbl", text: "Dischi disponibili" })]);
    const array = el("div", { class: "dropzone array", "data-drop": "array" }, [el("span", { class: "zone-lbl", text: "Array RAID" })]);
    const zones = el("div", { class: "zones2" }, [tray, array]);
    box.appendChild(zones);

    for (let i = 0; i < 4; i++) {
      const d = el("div", { class: "disk", title: DISK + " TB" }, [el("span", { class: "disk-cap", text: DISK + "TB" })]);
      d._onDrop = (zone, startParent) => {
        const target = zone && (zone.dataset.drop === "array" || zone.dataset.drop === "tray") ? zone : startParent;
        target.appendChild(d);
        revalidate();
      };
      enableDrag(d);
      tray.appendChild(d);
    }

    const read = el("div", { class: "pz-readout" });
    box.appendChild(read);
    const status = el("div", { class: "pz-status" });
    box.appendChild(status);

    const h = hintBox("Con RAID 5 la capacità utile è (numero dischi − 1) × capacità del disco e tollera 1 guasto. Quanti dischi da 2 TB servono per arrivare a 4 TB?");
    box.appendChild(el("div", { class: "pz-foot" }, [h.btn]));
    box.appendChild(h.box);

    function disksInArray() {
      return [...array.querySelectorAll(".disk")];
    }
    function revalidate() {
      const n = disksInArray().length;
      const sizes = new Array(n).fill(DISK);
      const valid = L.raidValid(mode, n);
      const usable = L.raidUsable(mode, sizes);
      const tol = L.raidTolerance(mode, n);
      read.innerHTML =
        `<span>Modalità: <b>${mode}</b></span>` +
        `<span>Dischi: <b>${n}</b></span>` +
        `<span>Capacità utile: <b class="${usable === TARGET ? "good" : ""}">${valid ? usable : "—"} TB</b></span>` +
        `<span>Tollera guasti: <b class="${tol >= 1 ? "good" : ""}">${valid ? tol : "—"}</b></span>`;
      array.classList.toggle("over", !valid && n > 0);
      if (!valid && n > 0) {
        status.className = "pz-status warn";
        status.textContent = mode === "RAID5" ? "RAID 5 richiede almeno 3 dischi." : mode === "RAID1" ? "RAID 1 richiede almeno 2 dischi." : "Aggiungi almeno un disco.";
      } else {
        status.className = "pz-status";
        status.textContent = "";
      }
      if (!done && L.storageSolved(mode, sizes, TARGET)) {
        done = true;
        status.className = "pz-status ok";
        status.innerHTML = "✅ Array corretto! <b>RAID 5</b>: capacità (n−1)×disco e tolleranza a 1 guasto.";
        disksInArray().forEach((d) => (d.dataset.locked = "1"));
        if (G.sfx) G.sfx.ok();
        setTimeout(onSolve, 700);
      }
    }
    revalidate();
  };

  // =====================================================================
  // 2) VIRTUALIZZAZIONE — assegna le VM al host
  // =====================================================================
  G.puzzles.vm = function (box, onSolve) {
    const CAP = 16; // GB RAM del host
    const REQUIRED = ["web", "db", "app"];
    const VMS = [
      { id: "web", name: "Web", gb: 4 },
      { id: "db", name: "DB", gb: 8 },
      { id: "app", name: "App", gb: 4 },
      { id: "cache", name: "Cache", gb: 6 },
      { id: "test", name: "Test", gb: 2 },
    ];
    const sizeById = {};
    VMS.forEach((v) => (sizeById[v.id] = v.gb));
    let done = false;

    box.appendChild(el("p", { class: "pz-obj", html:
      `🎯 <b>Obiettivo:</b> avvia le VM di produzione <b>Web</b>, <b>DB</b> e <b>App</b> sul host <b>senza superare i ${CAP} GB</b> di RAM.<br><span class="pz-dim">Trascina le VM sul host. Attenzione all'overcommit!</span>` }));

    const tray = el("div", { class: "dropzone tray", "data-drop": "tray" }, [el("span", { class: "zone-lbl", text: "VM disponibili" })]);
    const host = el("div", { class: "dropzone host", "data-drop": "host" }, [el("span", { class: "zone-lbl", text: "🖥️ Host ESXi — RAM " + CAP + " GB" })]);
    box.appendChild(el("div", { class: "zones2" }, [tray, host]));

    const barWrap = el("div", { class: "ram-bar" }, [el("div", { class: "ram-fill" }), el("span", { class: "ram-txt" })]);
    box.appendChild(barWrap);
    const status = el("div", { class: "pz-status" });
    box.appendChild(status);

    VMS.forEach((v) => {
      const vm = el("div", { class: "vm vm-" + v.id, "data-id": v.id, style: { "--gb": v.gb } }, [
        el("b", { text: v.name }),
        el("span", { class: "vm-gb", text: v.gb + " GB" }),
      ]);
      vm._onDrop = (zone, startParent) => {
        const target = zone && (zone.dataset.drop === "host" || zone.dataset.drop === "tray") ? zone : startParent;
        target.appendChild(vm);
        revalidate();
      };
      enableDrag(vm);
      tray.appendChild(vm);
    });

    const h = hintBox("Somma la RAM delle VM che metti sul host: Web(4) + DB(8) + App(4) = 16 GB, esattamente la capacità. Aggiungerne altre causa overcommit.");
    box.appendChild(el("div", { class: "pz-foot" }, [h.btn]));
    box.appendChild(h.box);

    function placed() {
      return [...host.querySelectorAll(".vm")].map((e) => e.dataset.id);
    }
    function revalidate() {
      const ids = placed();
      const total = L.vmTotal(ids, sizeById);
      const pct = Math.min(100, (total / CAP) * 100);
      const fill = barWrap.querySelector(".ram-fill");
      fill.style.width = pct + "%";
      const over = total > CAP;
      fill.classList.toggle("over", over);
      barWrap.querySelector(".ram-txt").textContent = total + " / " + CAP + " GB" + (over ? " — OVERCOMMIT!" : "");
      if (over) {
        status.className = "pz-status warn";
        status.textContent = "⚠️ Hai superato la RAM del host: le VM non si avvierebbero.";
      } else {
        status.className = "pz-status";
        status.textContent = "";
      }
      if (!done && L.vmSolved(ids, sizeById, CAP, REQUIRED)) {
        done = true;
        status.className = "pz-status ok";
        status.innerHTML = "✅ Consolidamento corretto: tutte le VM di produzione entrano nei " + CAP + " GB.";
        [...host.querySelectorAll(".vm")].forEach((e) => (e.dataset.locked = "1"));
        if (G.sfx) G.sfx.ok();
        setTimeout(onSolve, 700);
      }
    }
    revalidate();
  };

  // =====================================================================
  // 3) NETWORK — ripristina il cablaggio (clic-per-collegare)
  // =====================================================================
  G.puzzles.network = function (box, onSolve) {
    const REQUIRED = [["pc", "switch"], ["switch", "router"], ["router", "internet"]];
    const NODES = [
      { id: "pc", label: "PC", icon: "🖥️", x: 80, y: 70 },
      { id: "switch", label: "Switch", icon: "🔀", x: 250, y: 180 },
      { id: "router", label: "Router", icon: "📡", x: 430, y: 70 },
      { id: "internet", label: "Internet", icon: "🌐", x: 600, y: 180 },
    ];
    const nodeById = {};
    NODES.forEach((n) => (nodeById[n.id] = n));
    let edges = [];
    let sel = null;
    let done = false;

    box.appendChild(el("p", { class: "pz-obj", html:
      `🎯 <b>Obiettivo:</b> ripristina il percorso dati <b>PC → Switch → Router → Internet</b>.<br><span class="pz-dim">Clicca due apparati per collegarli con un cavo. Clicca un cavo per rimuoverlo.</span>` }));

    const stage = svg("svg", { class: "net-stage", viewBox: "0 0 680 250" });
    const gCables = svg("g", {});
    const gPacket = svg("g", {});
    stage.appendChild(gCables);
    stage.appendChild(gPacket);
    box.appendChild(stage);

    // nodi (HTML in overlay assoluto per facilità di click/stile)
    const layer = el("div", { class: "net-nodes" });
    box.appendChild(layer);
    const status = el("div", { class: "pz-status" });
    box.appendChild(status);

    const h = hintBox("Servono esattamente tre cavi in fila: PC↔Switch, Switch↔Router, Router↔Internet. Niente collegamenti diretti che 'saltano' un apparato.");
    box.appendChild(el("div", { class: "pz-foot" }, [
      el("button", { class: "pz-hintbtn ghost", text: "↺ Ripristina", onclick: () => { edges = []; sel = null; render(); } }),
      h.btn,
    ]));
    box.appendChild(h.box);

    function pos(id) {
      const n = nodeById[id];
      // viewBox 680x250 mappato; i nodi HTML usano percentuali equivalenti
      return { x: n.x, y: n.y };
    }
    function hasEdge(a, b) {
      const k = L.edgeKey(a, b);
      return edges.findIndex((e) => L.edgeKey(e[0], e[1]) === k);
    }
    function toggleEdge(a, b) {
      if (a === b) return;
      const i = hasEdge(a, b);
      if (i >= 0) edges.splice(i, 1);
      else edges.push([a, b]);
    }
    function clickNode(id) {
      if (done) return;
      if (G.sfx) G.sfx.click();
      if (sel === null) sel = id;
      else if (sel === id) sel = null;
      else { toggleEdge(sel, id); sel = null; }
      render();
    }

    function render() {
      // cavi
      gCables.innerHTML = "";
      edges.forEach(([a, b]) => {
        const pa = pos(a), pb = pos(b);
        const line = svg("line", { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, class: "net-cable" + (done ? " ok" : "") });
        line.style.cursor = "pointer";
        line.addEventListener("click", () => { if (!done) { toggleEdge(a, b); render(); } });
        gCables.appendChild(line);
      });
      // nodi
      layer.innerHTML = "";
      NODES.forEach((n) => {
        const node = el("button", {
          class: "net-node" + (sel === n.id ? " sel" : ""),
          style: { left: (n.x / 680) * 100 + "%", top: (n.y / 250) * 100 + "%" },
          onclick: () => clickNode(n.id),
        }, [el("span", { class: "net-ico", text: n.icon }), el("span", { class: "net-lbl", text: n.label })]);
        layer.appendChild(node);
      });

      if (done) return; // dopo la vittoria non tocchiamo più lo stato/testo

      if (L.networkSolved(edges, REQUIRED)) {
        done = true;
        status.className = "pz-status ok";
        status.innerHTML = "✅ Percorso completo: il pacchetto arriva fino a Internet!";
        render(); // ridisegna i cavi in verde
        animatePacket();
        return;
      }
      if (sel) {
        status.className = "pz-status";
        status.textContent = "Apparato selezionato: clicca un secondo apparato per collegarlo.";
      } else if (edges.length > 0) {
        status.className = "pz-status";
        status.textContent = "Topologia incompleta o errata.";
      } else {
        status.className = "pz-status";
        status.textContent = "";
      }
    }

    function animatePacket() {
      const path = ["pc", "switch", "router", "internet"].map(pos);
      const dot = svg("circle", { r: 6, class: "net-packet" });
      gPacket.appendChild(dot);
      let seg = 0, t0 = null;
      const SEG_MS = 380;
      function step(ts) {
        if (t0 == null) t0 = ts;
        const k = Math.min(1, (ts - t0) / SEG_MS);
        const a = path[seg], b = path[seg + 1];
        dot.setAttribute("cx", a.x + (b.x - a.x) * k);
        dot.setAttribute("cy", a.y + (b.y - a.y) * k);
        if (k >= 1) { seg++; t0 = ts; if (seg >= path.length - 1) { if (G.sfx) G.sfx.ok(); setTimeout(onSolve, 350); return; } }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    render();
  };

  // =====================================================================
  // 4) SECURITY — individua l'intruso nel log
  // =====================================================================
  G.puzzles.security = function (box, onSolve) {
    const LINES = [
      { ip: "10.0.0.5", status: "OK", user: "mario", t: "02:01" },
      { ip: "10.0.0.8", status: "OK", user: "lucia", t: "02:03" },
      { ip: "185.23.44.9", status: "FAILED", user: "root", t: "02:07" },
      { ip: "185.23.44.9", status: "FAILED", user: "root", t: "02:07" },
      { ip: "10.0.0.5", status: "OK", user: "mario", t: "02:08" },
      { ip: "185.23.44.9", status: "FAILED", user: "admin", t: "02:08" },
      { ip: "185.23.44.9", status: "FAILED", user: "admin", t: "02:08" },
      { ip: "185.23.44.9", status: "FAILED", user: "test", t: "02:09" },
      { ip: "10.0.0.12", status: "OK", user: "giulia", t: "02:10" },
    ];
    const attacker = L.attackerIp(LINES, 3);
    let done = false;

    box.appendChild(el("p", { class: "pz-obj", html:
      `🎯 <b>Obiettivo:</b> nel log degli accessi SSH, <b>clicca l'IP che sta tentando un attacco brute-force</b> per bloccarlo al firewall.<br><span class="pz-dim">Suggerimento: cerca tanti accessi FALLITI di seguito dallo stesso indirizzo.</span>` }));

    const term = el("div", { class: "terminal" }, [
      el("div", { class: "term-bar" }, [el("span", { class: "dot r" }), el("span", { class: "dot y" }), el("span", { class: "dot g" }), el("span", { class: "term-title", text: "auth.log — accessi SSH" })]),
    ]);
    const list = el("div", { class: "term-body" });
    term.appendChild(list);
    box.appendChild(term);
    const status = el("div", { class: "pz-status" });
    box.appendChild(status);

    LINES.forEach((ln) => {
      const row = el("button", {
        class: "log-row " + (ln.status === "FAILED" ? "bad" : "good"),
        onclick: () => clickRow(ln),
      }, [
        el("span", { class: "log-t", text: ln.t }),
        el("span", { class: "log-ip", text: ln.ip }),
        el("span", { class: "log-st", text: ln.status }),
        el("span", { class: "log-u", text: "user=" + ln.user }),
      ]);
      list.appendChild(row);
    });

    const h = hintBox("L'indirizzo 185.23.44.9 prova in sequenza root, admin, test con password sbagliate: è un attacco a forza bruta.");
    box.appendChild(el("div", { class: "pz-foot" }, [h.btn]));
    box.appendChild(h.box);

    function clickRow(ln) {
      if (done) return;
      if (ln.ip === attacker) {
        done = true;
        if (G.sfx) G.sfx.ok();
        [...list.querySelectorAll(".log-row")].forEach((r) => {
          if (r.querySelector(".log-ip").textContent === attacker) r.classList.add("banned");
        });
        status.className = "pz-status ok";
        status.innerHTML = "✅ IP <b>" + attacker + "</b> bloccato dal firewall. Attacco brute-force neutralizzato!";
        setTimeout(onSolve, 750);
      } else {
        if (G.sfx) G.sfx.err();
        status.className = "pz-status warn";
        status.textContent = "❌ Quello è traffico legittimo (accesso riuscito). Cerca i tentativi FALLITI ripetuti.";
      }
    }
  };
})();
