/*
 * scene.js — La "stanza" del gioco disegnata e animata su <canvas>.
 *
 * Disegna la sala datacenter (rack, patch panel, terminale, porta blindata),
 * gestisce hover/click sugli oggetti e il loop di animazione (LED lampeggianti,
 * testo che scorre sul monitor, slot del codice che si illuminano).
 *
 * Espone window.G.scene = { init, invalidate }. Le geometrie degli oggetti
 * (LAYOUT) fungono anche da aree cliccabili (hotspot).
 */

(function () {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  root.G = root.G || {};

  // Dimensioni logiche della scena (poi scalate per riempire lo schermo).
  const W = 1000;
  const H = 620;

  // Geometria + tipo di disegno di ogni oggetto interattivo.
  const LAYOUT = {
    storage: { x: 60, y: 120, w: 170, h: 350, kind: "rack", color: "#22d3ee" },
    vm: { x: 790, y: 120, w: 170, h: 350, kind: "rack", color: "#a78bfa" },
    network: { x: 642, y: 150, w: 150, h: 150, kind: "panel", color: "#34d399" },
    security: { x: 250, y: 468, w: 240, h: 130, kind: "desk", color: "#f87171" },
    door: { x: 418, y: 108, w: 184, h: 374, kind: "door", color: "#fbbf24" },
  };

  let canvas, ctx, dpr;
  let hovered = null; // id dell'oggetto sotto il mouse
  let pointer = { x: -1, y: -1 }; // coordinate logiche del puntatore
  let rafId = null;

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // --- Setup --------------------------------------------------------------
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", () => {
      hovered = null;
      pointer.x = pointer.y = -1;
      canvas.style.cursor = "default";
    });
    canvas.addEventListener("click", onClick);
    loop();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || canvas.parentElement.clientWidth || W;
    const cssH = cssW * (H / W);
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  function toLogical(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / rect.width) * W,
      y: ((evt.clientY - rect.top) / rect.height) * H,
    };
  }

  function hotspotAt(x, y) {
    // Ordine: gli oggetti in primo piano (desk) hanno priorità.
    const order = ["security", "network", "door", "storage", "vm"];
    for (const id of order) {
      const r = LAYOUT[id];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
    }
    return null;
  }

  function onMove(evt) {
    pointer = toLogical(evt);
    const id = hotspotAt(pointer.x, pointer.y);
    hovered = id;
    canvas.style.cursor = id ? "pointer" : "default";
  }

  function onClick(evt) {
    const p = toLogical(evt);
    const id = hotspotAt(p.x, p.y);
    if (!id) return;
    if (id === "door") {
      if (typeof G.openDoor === "function") G.openDoor();
    } else if (typeof G.openStation === "function") {
      G.openStation(id);
    }
  }

  // --- Loop di disegno ----------------------------------------------------
  function loop() {
    draw(performance.now());
    rafId = requestAnimationFrame(loop);
  }

  function solved(id) {
    return !!(G.state && G.state.solved && G.state.solved[id]);
  }

  function draw(t) {
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    const sx = cw / W;
    const sy = ch / H;
    ctx.scale(sx, sy); // così disegniamo sempre in coordinate logiche W×H

    drawRoom(t);
    drawRack(t, "storage", "STORAGE");
    drawRack(t, "vm", "HOST VM");
    drawPanel(t, "network");
    drawDesk(t, "security");
    drawDoor(t);

    if (hovered) drawHover(hovered);

    ctx.restore();
  }

  // --- Ambiente -----------------------------------------------------------
  function drawRoom(t) {
    // pareti
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1220");
    g.addColorStop(0.65, "#0a0f1a");
    g.addColorStop(1, "#070b12");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const horizon = 420;

    // griglia parete di fondo
    ctx.strokeStyle = "rgba(80,120,160,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, horizon);
      ctx.stroke();
    }
    for (let y = 0; y <= horizon; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // pavimento in prospettiva
    ctx.fillStyle = "#080c14";
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.strokeStyle = "rgba(34,211,238,0.10)";
    const vpx = W / 2;
    for (let x = -200; x <= W + 200; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(vpx + (x - vpx) * 3.2, H);
      ctx.stroke();
    }
    for (let i = 1; i <= 6; i++) {
      const y = horizon + Math.pow(i / 6, 1.8) * (H - horizon);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // strisce luminose a soffitto
    for (const lx of [200, 500, 800]) {
      const gg = ctx.createLinearGradient(lx - 60, 0, lx + 60, 0);
      gg.addColorStop(0, "rgba(34,211,238,0)");
      gg.addColorStop(0.5, "rgba(120,200,230,0.18)");
      gg.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(lx - 70, 18, 140, 10);
    }

    // vignettatura
    const v = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 640);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Rack (storage / vm) ------------------------------------------------
  function drawRack(t, id, title) {
    const r = LAYOUT[id];
    const col = r.color;

    // ombra a terra
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(r.x + r.w / 2, r.y + r.h + 12, r.w * 0.6, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // telaio armadio
    const fg = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    fg.addColorStop(0, "#1b2433");
    fg.addColorStop(0.5, "#283548");
    fg.addColorStop(1, "#161e2b");
    ctx.fillStyle = fg;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();

    // targhetta
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.9;
    roundRect(ctx, r.x + 12, r.y + 10, r.w - 24, 22, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#06121a";
    ctx.font = "bold 13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, r.x + r.w / 2, r.y + 21);

    // server impilati
    const top = r.y + 44;
    const slots = 7;
    const sh = (r.h - 58) / slots;
    for (let i = 0; i < slots; i++) {
      const yy = top + i * sh + 3;
      ctx.fillStyle = i % 2 ? "#10182400" : "#0e1622";
      ctx.fillStyle = "#0e1622";
      roundRect(ctx, r.x + 12, yy, r.w - 24, sh - 6, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.stroke();

      // feritoie
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      for (let v = 0; v < 3; v++) {
        const vy = yy + 5 + v * 4;
        ctx.beginPath();
        ctx.moveTo(r.x + 22, vy);
        ctx.lineTo(r.x + r.w - 60, vy);
        ctx.stroke();
      }

      // LED lampeggianti
      const blink = (Math.sin(t / 320 + i * 1.7) + 1) / 2;
      const ledOn = solved(id) ? col : blink > 0.55 ? "#39d98a" : "#1f3a2e";
      ctx.fillStyle = ledOn;
      ctx.shadowColor = ledOn;
      ctx.shadowBlur = solved(id) ? 8 : blink > 0.6 ? 6 : 0;
      ctx.beginPath();
      ctx.arc(r.x + r.w - 30, yy + (sh - 6) / 2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r.x + r.w - 20, yy + (sh - 6) / 2, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = blink > 0.3 ? "#e0b020" : "#3a3413";
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (solved(id)) drawSolvedBadge(r);
  }

  // --- Patch panel (network) ---------------------------------------------
  function drawPanel(t, id) {
    const r = LAYOUT[id];
    const col = r.color;
    ctx.fillStyle = "#141d2b";
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();

    ctx.fillStyle = col;
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("PATCH PANEL", r.x + 12, r.y + 20);

    // porte
    const cols = 6;
    const rows = 2;
    const px = r.x + 16;
    const py = r.y + 34;
    const gapx = (r.w - 32) / (cols - 1);
    const gapy = 30;
    for (let rrow = 0; rrow < rows; rrow++) {
      for (let c = 0; c < cols; c++) {
        const cx = px + c * gapx;
        const cy = py + rrow * gapy;
        ctx.fillStyle = "#0a1018";
        roundRect(ctx, cx - 8, cy - 7, 16, 14, 3);
        ctx.fill();
        const on = solved(id) || (Math.sin(t / 400 + c + rrow * 3) > 0.4);
        ctx.fillStyle = solved(id) ? "#34d399" : on ? "#2a9d6e" : "#27313f";
        ctx.beginPath();
        ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // qualche cavo patch colorato
    const cables = [
      ["#22d3ee", 0, 0, 3, 1],
      ["#f59e0b", 1, 0, 4, 1],
      ["#34d399", 2, 0, 1, 1],
    ];
    ctx.lineWidth = 3;
    cables.forEach(([cc, c1, r1, c2, r2]) => {
      const x1 = px + c1 * gapx;
      const y1 = py + r1 * gapy;
      const x2 = px + c2 * gapx;
      const y2 = py + r2 * gapy;
      ctx.strokeStyle = cc;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, y1 + 40, x2, y2 + 40, x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    ctx.lineWidth = 1;

    if (solved(id)) drawSolvedBadge(r);
  }

  // --- Desk + monitor (security) -----------------------------------------
  function drawDesk(t, id) {
    const r = LAYOUT[id];
    const col = r.color;

    // scrivania
    ctx.fillStyle = "#11161f";
    ctx.beginPath();
    ctx.moveTo(r.x - 10, r.y + r.h);
    ctx.lineTo(r.x + r.w + 10, r.y + r.h);
    ctx.lineTo(r.x + r.w - 20, r.y + r.h - 26);
    ctx.lineTo(r.x + 20, r.y + r.h - 26);
    ctx.closePath();
    ctx.fill();

    // monitor
    const mw = 150;
    const mh = 92;
    const mx = r.x + r.w / 2 - mw / 2;
    const my = r.y - 2;
    ctx.fillStyle = "#05202a";
    roundRect(ctx, mx, my, mw, mh, 6);
    ctx.fill();
    ctx.strokeStyle = "#1c2a36";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineWidth = 1;

    // schermo glow
    ctx.save();
    roundRect(ctx, mx + 6, my + 6, mw - 12, mh - 12, 4);
    ctx.clip();
    ctx.fillStyle = "#031318";
    ctx.fillRect(mx + 6, my + 6, mw - 12, mh - 12);
    // righe di log che scorrono
    const scroll = (t / 40) % 12;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "left";
    for (let i = 0; i < 9; i++) {
      const yy = my + 16 + i * 11 - scroll;
      const bad = i % 4 === 1;
      ctx.fillStyle = solved(id)
        ? "rgba(52,211,153,0.85)"
        : bad
        ? "rgba(248,113,113,0.85)"
        : "rgba(120,200,170,0.65)";
      const txt = bad ? "FAILED  185.23.44.9" : "OK  10.0.0." + ((i * 7) % 90);
      ctx.fillText(txt, mx + 12, yy);
    }
    ctx.restore();

    // base monitor
    ctx.fillStyle = "#1c2a36";
    ctx.fillRect(mx + mw / 2 - 8, my + mh, 16, 12);
    ctx.fillRect(mx + mw / 2 - 22, my + mh + 12, 44, 5);

    // etichetta
    ctx.fillStyle = col;
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("TERMINALE SOC", r.x + r.w / 2, r.y + r.h - 8);

    if (solved(id)) drawSolvedBadge({ x: mx, y: my, w: mw, h: mh });
  }

  // --- Porta blindata -----------------------------------------------------
  function drawDoor(t) {
    const r = LAYOUT.door;
    const open = !!(G.state && G.state.escaped);

    // vano porta
    ctx.fillStyle = "#05080e";
    roundRect(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 8);
    ctx.fill();

    if (open) {
      // luce di fuga
      const lg = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      lg.addColorStop(0, "#bdf3ff");
      lg.addColorStop(1, "#5ad1ea");
      ctx.fillStyle = lg;
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("→ USCITA →", r.x + r.w / 2, r.y + r.h / 2);
      return;
    }

    // due ante metalliche
    const dg = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    dg.addColorStop(0, "#283344");
    dg.addColorStop(0.5, "#3a4a61");
    dg.addColorStop(1, "#222c3b");
    ctx.fillStyle = dg;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.moveTo(r.x + r.w / 2, r.y + 6);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h - 6);
    ctx.stroke();

    // strisce di pericolo in alto
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, 16, 6);
    ctx.clip();
    for (let i = -1; i < r.w / 14 + 1; i++) {
      ctx.fillStyle = i % 2 ? "#0e1420" : "#e0b020";
      ctx.beginPath();
      ctx.moveTo(r.x + i * 14, r.y);
      ctx.lineTo(r.x + i * 14 + 14, r.y);
      ctx.lineTo(r.x + i * 14 + 6, r.y + 16);
      ctx.lineTo(r.x + i * 14 - 8, r.y + 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // insegna USCITA
    ctx.fillStyle = "#0c1119";
    roundRect(ctx, r.x + r.w / 2 - 42, r.y + 26, 84, 20, 4);
    ctx.fill();
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("USCITA", r.x + r.w / 2, r.y + 40);

    // slot del codice (4) che si illuminano man mano
    const order = G.codeOrder || [];
    const slotY = r.y + 70;
    for (let i = 0; i < 4; i++) {
      const cx = r.x + 28 + i * ((r.w - 56) / 3);
      const stId = order[i];
      const got = stId && solved(stId);
      ctx.fillStyle = "#0a0f17";
      roundRect(ctx, cx - 15, slotY, 30, 34, 5);
      ctx.fill();
      ctx.strokeStyle = got ? LAYOUT[stId].color : "rgba(255,255,255,0.12)";
      ctx.stroke();
      if (got) {
        ctx.fillStyle = LAYOUT[stId].color;
        ctx.shadowColor = LAYOUT[stId].color;
        ctx.shadowBlur = 10;
        ctx.font = "bold 20px ui-monospace, monospace";
        ctx.fillText(String(G.state.digits[stId]), cx, slotY + 24);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "bold 18px ui-monospace, monospace";
        ctx.fillText("?", cx, slotY + 24);
      }
    }

    // tastierino stilizzato + maniglia
    const kx = r.x + r.w / 2 - 26;
    const ky = r.y + 130;
    ctx.fillStyle = "#0c1119";
    roundRect(ctx, kx, ky, 52, 64, 5);
    ctx.fill();
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        ctx.fillStyle = "#22303f";
        roundRect(ctx, kx + 8 + b * 13, ky + 8 + a * 16, 10, 11, 2);
        ctx.fill();
      }
    }
    const pulse = (Math.sin(t / 500) + 1) / 2;
    ctx.fillStyle = `rgba(251,191,36,${0.4 + pulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, ky + 84, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Badge "risolto" ----------------------------------------------------
  function drawSolvedBadge(r) {
    const bx = r.x + r.w - 16;
    const by = r.y - 6;
    ctx.fillStyle = "#34d399";
    ctx.shadowColor = "#34d399";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(bx, by, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#06121a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - 5, by);
    ctx.lineTo(bx - 1, by + 4);
    ctx.lineTo(bx + 6, by - 4);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // --- Evidenziazione hover + tooltip ------------------------------------
  function drawHover(id) {
    const r = LAYOUT[id];
    const col = r.color || "#22d3ee";
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = col;
    ctx.shadowBlur = 16;
    roundRect(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 10);
    ctx.stroke();
    ctx.restore();

    const meta = (G.stations && G.stations[id]) || {};
    const label = meta.label || id;
    const sub = solved(id) ? "✓ Completato" : meta.sub || "";
    ctx.font = "bold 14px ui-monospace, monospace";
    const tw = Math.max(ctx.measureText(label).width, ctx.measureText(sub).width) + 24;
    let tx = Math.min(Math.max(pointer.x - tw / 2, 8), W - tw - 8);
    let ty = r.y - 52;
    if (ty < 8) ty = r.y + r.h + 10;
    ctx.fillStyle = "rgba(8,12,20,0.92)";
    roundRect(ctx, tx, ty, tw, 42, 8);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(label, tx + 12, ty + 18);
    ctx.fillStyle = solved(id) ? "#34d399" : "rgba(190,205,225,0.85)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(sub, tx + 12, ty + 34);
  }

  G.scene = { init: init, LAYOUT: LAYOUT, W: W, H: H };
})();
