/*
 * audio.js — Effetti sonori sintetici (Web Audio API), leggeri e opzionali.
 * Nessun file audio esterno: i suoni sono generati al volo. Tutto è protetto
 * da try/catch e da un flag di mute, così non interferisce mai col gioco.
 */

(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.G = root.G || {};

  let actx = null;
  let muted = false;

  function ensure() {
    if (actx) return actx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    } catch (e) {
      actx = null;
    }
    return actx;
  }

  function tone(freq, dur, type, vol) {
    if (muted) return;
    const a = ensure();
    if (!a) return;
    try {
      if (a.state === "suspended") a.resume();
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = vol == null ? 0.06 : vol;
      o.connect(g);
      g.connect(a.destination);
      const now = a.currentTime;
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.start(now);
      o.stop(now + dur);
    } catch (e) {
      /* ignora */
    }
  }

  const Sfx = {
    click: () => tone(420, 0.06, "square", 0.04),
    pick: () => tone(660, 0.05, "triangle", 0.05),
    drop: () => tone(300, 0.08, "sine", 0.05),
    ok: () => {
      tone(540, 0.09, "square", 0.05);
      setTimeout(() => tone(720, 0.12, "square", 0.05), 90);
    },
    err: () => tone(160, 0.18, "sawtooth", 0.05),
    win: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, "triangle", 0.06), i * 130));
    },
    setMuted: (m) => {
      muted = !!m;
    },
    isMuted: () => muted,
  };

  G.sfx = Sfx;
})();
