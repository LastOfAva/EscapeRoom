/*
 * logic.js — Logica "pura" degli enigmi del gioco (niente DOM).
 *
 * Tenuta separata dall'interfaccia così da poterla verificare con test
 * automatici (vedi test/logic.test.js) e perché un docente possa controllare
 * facilmente le regole tecniche. Funziona sia nel browser sia in Node.
 */

(function () {
  "use strict";

  const Logic = {};

  // ======================= STORAGE / RAID ===============================
  // sizes: array di capacità dei dischi (in TB). Si assume dischi uguali.
  // mode: 'RAID0' | 'RAID1' | 'RAID5'
  Logic.raidUsable = function (mode, sizes) {
    const n = sizes.length;
    if (n === 0) return 0;
    const s = sizes[0];
    if (mode === "RAID0") return n * s; // striping: tutto lo spazio
    if (mode === "RAID1") return s; // mirroring: capacità di un solo disco
    if (mode === "RAID5") return n >= 3 ? (n - 1) * s : 0; // 1 disco di parità
    return 0;
  };

  // Quanti guasti disco simultanei tollera la configurazione.
  Logic.raidTolerance = function (mode, n) {
    if (mode === "RAID0") return 0;
    if (mode === "RAID1") return n >= 2 ? n - 1 : 0;
    if (mode === "RAID5") return n >= 3 ? 1 : 0;
    return 0;
  };

  // Configurazione valida (numero minimo di dischi per la modalità).
  Logic.raidValid = function (mode, n) {
    if (mode === "RAID0") return n >= 1;
    if (mode === "RAID1") return n >= 2;
    if (mode === "RAID5") return n >= 3;
    return false;
  };

  // Obiettivo: capacità utile == targetTB E almeno 1 guasto tollerato.
  Logic.storageSolved = function (mode, sizes, targetTB) {
    const n = sizes.length;
    return (
      Logic.raidValid(mode, n) &&
      Logic.raidUsable(mode, sizes) === targetTB &&
      Logic.raidTolerance(mode, n) >= 1
    );
  };

  // ======================= VIRTUALIZZAZIONE / VM ========================
  Logic.vmTotal = function (placedIds, sizeById) {
    return placedIds.reduce((a, id) => a + (sizeById[id] || 0), 0);
  };

  // Risolto se tutte le VM richieste sono avviate e la RAM non è superata.
  Logic.vmSolved = function (placedIds, sizeById, capGB, requiredIds) {
    const total = Logic.vmTotal(placedIds, sizeById);
    if (total > capGB) return false; // overcommit
    return requiredIds.every((id) => placedIds.includes(id));
  };

  // ======================= NETWORK / CABLAGGIO ==========================
  Logic.edgeKey = function (a, b) {
    return [a, b].slice().sort().join("|");
  };

  // Risolto se i collegamenti coincidono ESATTAMENTE con quelli richiesti.
  Logic.networkSolved = function (edges, required) {
    const E = new Set(edges.map((e) => Logic.edgeKey(e[0], e[1])));
    const R = required.map((e) => Logic.edgeKey(e[0], e[1]));
    if (E.size !== R.length) return false;
    return R.every((k) => E.has(k));
  };

  // ======================= SECURITY / LOG ===============================
  // lines: [{ ip, status: 'OK'|'FAILED', user }]
  // Ritorna l'IP con più accessi FALLITI se supera la soglia, altrimenti null.
  Logic.attackerIp = function (lines, threshold) {
    const counts = {};
    lines.forEach((l) => {
      if (l.status === "FAILED") counts[l.ip] = (counts[l.ip] || 0) + 1;
    });
    let best = null;
    let bestN = 0;
    Object.keys(counts).forEach((ip) => {
      if (counts[ip] > bestN) {
        bestN = counts[ip];
        best = ip;
      }
    });
    return bestN >= (threshold || 3) ? best : null;
  };

  // --- Esposizione (browser + Node) --------------------------------------
  const root = typeof window !== "undefined" ? window : globalThis;
  root.G = root.G || {};
  root.G.Logic = Logic;
  if (typeof module !== "undefined" && module.exports) module.exports = Logic;
})();
