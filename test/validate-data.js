/*
 * validate-data.js — controllo di integrità dei contenuti dell'escape room.
 *
 * Esegui con:  node test/validate-data.js
 *
 * Non richiede dipendenze esterne: carica js/rooms.js in un contesto isolato
 * (con uno stub di `window`) e verifica che ogni enigma sia ben formato.
 * Utile da lanciare dopo aver aggiunto o modificato enigmi in js/rooms.js.
 */

"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

// --- Carica i dati senza browser ----------------------------------------
const code = fs.readFileSync(path.join(__dirname, "..", "js", "rooms.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const DATA = sandbox.window.ESCAPE_DATA;

let errors = 0;
let checks = 0;

function check(cond, msg) {
  checks++;
  if (!cond) {
    errors++;
    console.error("  ✘ " + msg);
  }
}

// --- Verifiche di base ---------------------------------------------------
check(DATA && Array.isArray(DATA.rooms), "ESCAPE_DATA.rooms deve essere un array");
check(DATA && DATA.meta, "ESCAPE_DATA.meta deve esistere");

const seenIds = new Set();

DATA.rooms.forEach((room, ri) => {
  const where = `stanza #${ri + 1} (${room && room.id})`;
  check(typeof room.id === "string" && room.id, `${where}: id mancante`);
  check(typeof room.title === "string" && room.title, `${where}: title mancante`);
  check(typeof room.fragment === "string" && room.fragment, `${where}: fragment mancante`);
  check(typeof room.icon === "string" && room.icon.includes("<svg"), `${where}: icona SVG mancante`);
  check(Array.isArray(room.puzzles) && room.puzzles.length > 0, `${where}: nessun enigma`);

  (room.puzzles || []).forEach((p, pi) => {
    const w = `${where} · enigma #${pi + 1} (${p && p.id})`;

    // id univoco
    check(typeof p.id === "string" && p.id, `${w}: id mancante`);
    if (p.id) {
      check(!seenIds.has(p.id), `${w}: id duplicato "${p.id}"`);
      seenIds.add(p.id);
    }

    check(typeof p.question === "string" && p.question.length > 5, `${w}: domanda mancante o troppo corta`);
    check(["mc", "multi", "text"].includes(p.type), `${w}: type non valido "${p.type}"`);
    check(Array.isArray(p.hints), `${w}: hints deve essere un array`);
    check(typeof p.explanation === "string" && p.explanation.length > 10, `${w}: spiegazione mancante`);

    if (p.type === "mc") {
      check(Array.isArray(p.options) && p.options.length >= 2, `${w}: servono almeno 2 opzioni`);
      check(
        Number.isInteger(p.answer) && p.answer >= 0 && p.answer < (p.options || []).length,
        `${w}: 'answer' deve essere un indice valido (0..${(p.options || []).length - 1})`
      );
    } else if (p.type === "multi") {
      check(Array.isArray(p.options) && p.options.length >= 2, `${w}: servono almeno 2 opzioni`);
      check(Array.isArray(p.answer) && p.answer.length >= 1, `${w}: 'answer' deve essere un array non vuoto`);
      (p.answer || []).forEach((idx) =>
        check(
          Number.isInteger(idx) && idx >= 0 && idx < (p.options || []).length,
          `${w}: indice risposta fuori range (${idx})`
        )
      );
    } else if (p.type === "text") {
      check(
        Array.isArray(p.accept) && p.accept.length >= 1 && p.accept.every((a) => typeof a === "string" && a.length),
        `${w}: 'accept' deve contenere almeno una risposta testuale`
      );
    }
  });
});

// --- La chiave maestra deve corrispondere ai frammenti -------------------
const composed = DATA.rooms.map((r) => r.fragment).join("-");
check(
  composed === DATA.meta.masterKey,
  `La chiave maestra (${DATA.meta.masterKey}) non corrisponde ai frammenti concatenati (${composed})`
);

// La masterKey deve essere fra le forme accettate (con normalizzazione).
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, "");
check(
  (DATA.meta.masterAccept || []).some((a) => norm(a) === norm(DATA.meta.masterKey)),
  "masterAccept non include la chiave maestra normalizzata"
);

// --- Esito ---------------------------------------------------------------
console.log(`\nControlli eseguiti: ${checks} — errori: ${errors}`);
if (errors === 0) {
  console.log("✅ Tutti i contenuti dell'escape room sono validi.");
  process.exit(0);
} else {
  console.error("❌ Trovati problemi nei contenuti. Correggi js/rooms.js.");
  process.exit(1);
}
