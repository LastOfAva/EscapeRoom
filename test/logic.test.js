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

console.log("\n[STORAGE / RAID6 — livello avanzato]");
eq(L.raidUsable("RAID6", [2, 2, 2, 2, 2, 2]), 8, "RAID6 con 6×2TB = 8 TB (2 dischi di parità)");
eq(L.raidTolerance("RAID6", 6), 2, "RAID6 tollera 2 guasti");
eq(L.raidValid("RAID6", 3), false, "RAID6 richiede almeno 4 dischi");
eq(L.storageSolved("RAID6", [2, 2, 2, 2, 2, 2], 8, 2), true, "soluzione RAID6: 8 TB tolleranti a 2 guasti");
eq(L.storageSolved("RAID5", [2, 2, 2, 2, 2], 8, 2), false, "RAID5 non basta quando servono 2 guasti tollerati");

console.log("\n[STORAGE / TIERING]");
const corr = { db: "ssd", vmos: "ssd", backup: "hdd", archive: "tape" };
eq(L.tieringSolved({ db: "ssd", vmos: "ssd", backup: "hdd", archive: "tape" }, corr), true, "ogni dato sul tier corretto");
eq(L.tieringSolved({ db: "hdd", vmos: "ssd", backup: "hdd", archive: "tape" }, corr), false, "DB su HDD invece che SSD → errato");

console.log("\n[VM / MULTI-HOST]");
const vmS = { web: 4, db: 8, app: 4, cache: 6 };
eq(L.vmMultiSolved({ web: 0, db: 1, app: 0 }, vmS, [12, 12], ["web", "db", "app"]), true, "VM richieste distribuite su 2 host senza overcommit");
eq(L.vmMultiSolved({ web: 0, db: 0, app: 0 }, vmS, [12, 12], ["web", "db", "app"]), false, "tutte sullo stesso host (16>12) → overcommit");
eq(L.vmMultiSolved({ web: 0, db: 1 }, vmS, [12, 12], ["web", "db", "app"]), false, "manca una VM richiesta (App)");

console.log("\n[SUBNETTING]");
eq(L.usableHosts(24), 254, "/24 → 254 host utilizzabili");
eq(L.usableHosts(26), 62, "/26 → 62 host utilizzabili");
eq(L.bestPrefixFor(50), 26, "per ≥50 host il prefisso più efficiente è /26 (62 host)");
eq(L.subnetSolved(26, 50), true, "scegliere /26 per 50 host è corretto");
eq(L.subnetSolved(24, 50), false, "/24 funziona ma spreca indirizzi → non ottimale");
eq(L.subnetSolved(27, 50), false, "/27 (30 host) è troppo piccolo");

console.log("\n[FIREWALL]");
const rules = [
  { id: "a", kind: "attacker" },
  { id: "b", kind: "legit" },
  { id: "c", kind: "legit" },
];
eq(L.firewallSolved(rules, { a: "deny", b: "allow", c: "allow" }), true, "nega l'attaccante, consente i legittimi");
eq(L.firewallSolved(rules, { a: "allow", b: "allow", c: "allow" }), false, "consentire l'attaccante → errato");
eq(L.firewallSolved(rules, { a: "deny", b: "deny", c: "allow" }), false, "negare un legittimo → errato");

console.log(`\n=== Esito logica: ${failed === 0 ? "TUTTI I TEST PASSATI ✅" : failed + " FALLITI ❌"} ===`);
process.exit(failed === 0 ? 0 : 1);
