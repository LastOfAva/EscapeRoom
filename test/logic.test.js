/*
 * logic.test.js — test della logica degli enigmi (nessuna dipendenza).
 * Esegui con:  node test/logic.test.js   (oppure  npm test)
 */
"use strict";
const L = require("../assets/logic.js");

let failed = 0;
function eq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "  ✔ " : "  ✘ ") + msg + (ok ? "" : `  (atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)})`));
  if (!ok) failed++;
}

console.log("\n[STORAGE / RAID]");
eq(L.raidUsable("RAID0", [2, 2, 2]), 6, "RAID0 con 3×2TB = 6 TB");
eq(L.raidUsable("RAID1", [2, 2]), 2, "RAID1 mirror = capacità di 1 disco (2 TB)");
eq(L.raidUsable("RAID5", [2, 2, 2]), 4, "RAID5 con 3×2TB = 4 TB utili");
eq(L.raidUsable("RAID5", [2, 2]), 0, "RAID5 con meno di 3 dischi non è valido");
eq(L.raidTolerance("RAID0", 3), 0, "RAID0 non tollera guasti");
eq(L.raidTolerance("RAID5", 3), 1, "RAID5 tollera 1 guasto");
eq(L.storageSolved("RAID5", [2, 2, 2], 4), true, "soluzione storage: RAID5 + 3 dischi → 4TB ridondanti");
eq(L.storageSolved("RAID1", [2, 2], 4), false, "RAID1 (2TB) non raggiunge l'obiettivo di 4TB");
eq(L.storageSolved("RAID0", [2, 2], 4), false, "RAID0 (4TB) fallisce: nessuna ridondanza");

console.log("\n[VIRTUALIZZAZIONE / VM]");
const sizeById = { web: 4, db: 8, app: 4, cache: 6, test: 2 };
eq(L.vmTotal(["web", "db", "app"], sizeById), 16, "Web+DB+App = 16 GB");
eq(L.vmSolved(["web", "db", "app"], sizeById, 16, ["web", "db", "app"]), true, "soluzione VM: tutte le richieste entrano in 16 GB");
eq(L.vmSolved(["web", "db", "app", "cache"], sizeById, 16, ["web", "db", "app"]), false, "aggiungere Cache supera la RAM (overcommit)");
eq(L.vmSolved(["web", "db"], sizeById, 16, ["web", "db", "app"]), false, "manca una VM richiesta (App)");

console.log("\n[NETWORK / CABLAGGIO]");
const req = [["pc", "switch"], ["switch", "router"], ["router", "internet"]];
eq(L.networkSolved([["switch", "pc"], ["router", "switch"], ["internet", "router"]], req), true, "soluzione network: percorso PC→Switch→Router→Internet (ordine cavi indifferente)");
eq(L.networkSolved([["pc", "switch"], ["switch", "router"]], req), false, "percorso incompleto (manca Router→Internet)");
eq(L.networkSolved([["pc", "switch"], ["switch", "router"], ["router", "internet"], ["pc", "router"]], req), false, "collegamento errato di troppo (PC→Router)");

console.log("\n[SECURITY / LOG]");
const lines = [
  { ip: "10.0.0.5", status: "OK", user: "mario" },
  { ip: "185.23.44.9", status: "FAILED", user: "root" },
  { ip: "185.23.44.9", status: "FAILED", user: "root" },
  { ip: "185.23.44.9", status: "FAILED", user: "admin" },
  { ip: "185.23.44.9", status: "FAILED", user: "test" },
  { ip: "10.0.0.8", status: "OK", user: "lucia" },
];
eq(L.attackerIp(lines, 3), "185.23.44.9", "rileva l'IP brute-force (4 FAILED)");
eq(L.attackerIp([{ ip: "1.1.1.1", status: "FAILED", user: "x" }], 3), null, "un solo fallimento non basta per essere un attacco");

console.log(`\n=== Esito logica: ${failed === 0 ? "TUTTI I TEST PASSATI ✅" : failed + " FALLITI ❌"} ===`);
process.exit(failed === 0 ? 0 : 1);
