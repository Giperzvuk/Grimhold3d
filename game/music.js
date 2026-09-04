// ---------- Процедурная музыка: секвенсор на WebAudio ----------
const MUSIC = (() => {
  let ctx = null, out = null, cur = null, curKind = null, nextT = 0, step = 0, volume = 0.55, duckG = null, duckV = 1;
  const tracks = {};
  const mkRng = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const SCALES = { dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmMinor: [0, 2, 3, 5, 7, 8, 11] };
  const f = (root, semi) => root * Math.pow(2, semi / 12);

  // Генерация фраз: массив шагов, каждый шаг — null или {deg, oct, len}
  // Мотивный генератор: мотив (4 шага) → мотив → транспозиция → мотив → каденция на тонике/квинте
  function phrase(rng, steps, density, range, rest) {
    const motif = []; let deg = Math.floor(rng() * 3);
    for (let i = 0; i < 4; i++) { if (rng() < density + 0.2 || i === 0) { const mv = [-2, -1, 1, 1, 2, 3][Math.floor(rng() * 6)]; deg = Math.max(0, Math.min(range, deg + mv)); motif.push({ deg, len: 1 }); } else motif.push(null); }
    const out = []; let last = -1, rep = 0;
    for (let i = 0; i < steps; i++) {
      const grp = Math.floor(i / 8) % 4, k = i % 8; let n = null;
      if (k === 7 && (grp === 1 || grp === 3)) n = { deg: grp === 3 ? 0 : 4, len: 2 }; // каденция
      else if (k === 6 && (grp === 1 || grp === 3)) n = null;
      else { const src = motif[k % 4]; if (src) n = { deg: Math.max(0, Math.min(range, src.deg + (grp === 2 ? 2 : grp === 1 ? 1 : 0) + (k >= 4 ? (grp % 2 ? -1 : 1) : 0))), len: 1 }; }
      if (n && rng() > density + 0.35) n = null;
      if (rest && i % rest === rest - 1) n = null;
      if (n && n.deg === last) { rep++; if (rep >= 2) { n.deg = Math.max(0, Math.min(range, n.deg + (rng() < 0.5 ? 2 : -2))); rep = 0; } } else rep = 0;
      if (n) last = n.deg;
      out.push(n);
    }
    return out;
  }
  function define(kind, cfg) {
    const rng = mkRng(cfg.seed);
    const t = Object.assign({ kind, phrases: [], chords: cfg.chords || [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], gain: null }, cfg);
    for (let i = 0; i < 4; i++) t.phrases.push(phrase(rng, cfg.steps, cfg.density, cfg.range, cfg.rest));
    t.order = [0, 0, 1, 0, 2, 2, 1, 3, 0, 1, 3, 3, 2, 1, 0, 3];
    tracks[kind] = t;
  }
  define('village', { seed: 11, bpm: 84, follow: true, stepDiv: 2, steps: 24, density: 0.5, range: 8, rest: 6, scale: 'dorian', root: 146.83, lead: 'pluck', pad: true, bass: 'soft', drums: null });
  define('forest', { seed: 23, bpm: 72, follow: true, stepDiv: 2, steps: 32, density: 0.35, range: 7, rest: 8, scale: 'aeolian', root: 164.81, lead: 'flute', pad: true, bass: 'soft', drums: 'tribal' });
  define('tavern', { seed: 37, bpm: 124, follow: true, stepDiv: 2, steps: 32, density: 0.55, range: 9, rest: 4, scale: 'mixo', root: 196.0, lead: 'pluck', pad: false, bass: 'pizz', drums: 'clap', breaks: true });
  define('dungeon', { seed: 5, bpm: 56, stepDiv: 2, steps: 32, density: 0.16, range: 9, rest: 0, scale: 'phrygian', root: 130.81, lead: 'bell', pad: 'drone', bass: null, drums: 'heart' });
  define('combat', { seed: 77, bpm: 144, follow: true, stepDiv: 2, steps: 32, density: 0.55, range: 6, rest: 0, scale: 'harmMinor', root: 146.83, lead: 'stab', pad: false, bass: 'drive', drums: 'rock', chords: [[0, 2, 4], [0, 2, 4], [5, 0, 2], [6, 1, 3]] });

  function env(g, t0, a, d, s, r, peak) {
    g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t0 + a + d); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
  }
  function voice(type, freq, t0, a, d, s, r, peak, dest, filt, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; if (detune) o.detune.value = detune;
    const g = ctx.createGain(); env(g, t0, a, d, s, r, peak);
    if (filt) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); fl.connect(g); } else o.connect(g);
    g.connect(dest); o.start(t0); o.stop(t0 + a + d + r + 0.05); return o;
  }
  function noiseHit(t0, dur, freq, peak, dest, type) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = b; const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = freq; fl.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = peak; s.connect(fl); fl.connect(g); g.connect(dest); s.start(t0);
  }
  function kick(t0, dest, peak) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.12); g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + 0.3); }

  function scheduleStep(t, st, time) {
    const sc = SCALES[t.scale], bar = Math.floor(st / t.steps), pi = t.order[bar % t.order.length], ph = t.phrases[pi], s = st % t.steps;
    const chord = t.chords[bar % t.chords.length], dest = t.gain;
    const stepDur = 60 / t.bpm / t.stepDiv;
    const degF = (deg, oct) => { const o = Math.floor(deg / 7) + (oct || 0); return f(t.root, sc[((deg % 7) + 7) % 7] + o * 12); };
    // аккорд / пэд
    if (t.pad === true && s === 0 && !(bar % 16 >= 8 && bar % 16 < 12)) for (const d of chord) { voice('triangle', degF(d, 1), time, 1.2, 1.5, 0.7, 2.5, 0.03, dest, 900, 4); voice('triangle', degF(d, 1), time, 1.2, 1.5, 0.7, 2.5, 0.03, dest, 900, -4); }
    if (t.pad === 'drone' && s % 8 === 0) { const L8 = stepDur * 8; voice('sawtooth', t.root / 2, time, 1.5, L8, 0.9, 2.5, 0.06, dest, 180); voice('sawtooth', t.root / 2 * 1.5, time + 0.02, 1.5, L8, 0.7, 2.5, 0.025, dest, 160, 6); }
    // бас
    if (t.bass === 'soft' && s % 12 === 0) voice('sine', degF(chord[0], -2), time, 0.05, 0.8, 0.5, 1.2, 0.18, dest);
    if (t.bass === 'pizz' && s % 4 === 0) voice('triangle', degF(s % 8 === 0 ? chord[0] : chord[2], -1), time, 0.01, 0.25, 0.1, 0.2, 0.2, dest, 900);
    if (t.bass === 'drive' && s % 2 === 0) voice('sawtooth', degF(chord[0], -1) * (s % 8 === 6 ? 1.5 : 1), time, 0.01, 0.12, 0.3, 0.12, 0.18, dest, 500);
    // лид
    const n = (t.breaks && bar % 16 >= 8 && bar % 16 < 12) ? null : ph[s];
    if (n) {
      const vel = (s % 8 === 0 ? 1.15 : s % 4 === 0 ? 1.0 : 0.82) * (0.95 + ((st * 7) % 5) * 0.025); let dg = n.deg + (t.follow ? chord[0] : 0); if (s % 4 === 0) { const rel = ((dg % 7) + 7) % 7, ct = chord.map(c => ((c % 7) + 7) % 7); if (!ct.includes(rel)) { const best = ct.reduce((a, c) => Math.abs(c - rel) < Math.abs(a - rel) ? c : a, ct[0]); dg += best - rel; } } const fr = degF(dg, 1), len = n.len * stepDur;
      if (t.lead === 'pluck') voice('triangle', fr, time, 0.005, len * 0.9, 0.05, 0.4, 0.14 * vel, t.echo || dest, 2400);
      if (t.lead === 'flute') { const o = voice('sine', fr, time, 0.08, len, 0.6, 0.35, 0.12, dest); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = fr * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(time); l.stop(time + len + 0.5); }
      if (t.lead === 'square') voice('square', fr, time, 0.005, len * 0.7, 0.2, 0.08, 0.07 * vel, t.echo || dest, 1800);
      if (t.lead === 'bell') { voice('sine', fr * 2, time, 0.005, 1.5, 0.2, 2.5, 0.09, t.echo || dest); voice('sine', fr * 2 * 2.76, time, 0.005, 0.4, 0.05, 0.6, 0.02, dest); }
      if (t.lead === 'stab') { voice('square', fr, time, 0.005, 0.1, 0.3, 0.1, 0.08, dest, 2200); voice('sawtooth', fr / 2, time, 0.005, 0.1, 0.3, 0.1, 0.05, dest, 1200); }
    }
    // ударные
    if (t.drums === 'rock') { if (s % 8 === 0 || s % 8 === 5) kick(time, dest, 0.5); if (s % 8 === 4) noiseHit(time, 0.18, 1800, 0.35, dest); if (s % 2 === 0) noiseHit(time, 0.04, 7000, 0.08, dest, 'highpass'); }
    if (t.drums === 'clap' && (s % 8 === 3 || s % 8 === 6)) noiseHit(time, 0.12, 1500, 0.12, dest); if (t.drums === 'clap' && s % 8 === 0) kick(time, dest, 0.2);
    if (t.drums === 'tribal' && (s % 16 === 0 || s % 16 === 6 || s % 16 === 10)) kick(time, dest, 0.25);
    if (t.drums === 'heart' && (s % 8 === 0 || s % 8 === 1)) kick(time, dest, s % 8 === 0 ? 0.3 : 0.2);
  }

  return {
    init(audioCtx, master) {
      if (ctx) return; ctx = audioCtx; out = ctx.createGain(); out.gain.value = volume; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25; out.connect(comp); comp.connect(master); duckG = ctx.createGain(); duckG.gain.value = 1;
      for (const k in tracks) { const g = ctx.createGain(); g.gain.value = 0; g.connect(out); tracks[k].gain = g;
        // эхо для лида: задержка на одну восьмую с затуханием
        const dl = ctx.createDelay(1.0); dl.delayTime.value = 60 / tracks[k].bpm / 2 * 1.5; const fb = ctx.createGain(); fb.gain.value = 0.28; const fbf = ctx.createBiquadFilter(); fbf.type = 'lowpass'; fbf.frequency.value = 1800; const wet = ctx.createGain(); wet.gain.value = 0.35;
        const echo = ctx.createGain(); echo.connect(g); echo.connect(dl); dl.connect(fbf); fbf.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(g); tracks[k].echo = echo; }
      nextT = ctx.currentTime + 0.1;
    },
    set(kind) {
      if (!ctx || kind === curKind) return;
      const now = ctx.currentTime;
      if (cur) { cur.gain.gain.cancelScheduledValues(now); cur.gain.gain.setValueAtTime(cur.gain.gain.value, now); cur.gain.gain.linearRampToValueAtTime(0, now + 1.8); }
      if (cur) cur.step = step; cur = tracks[kind]; curKind = kind; step = cur.step || 0; nextT = now + 0.3;
      cur.gain.gain.cancelScheduledValues(now); cur.gain.gain.setValueAtTime(0, now); cur.gain.gain.linearRampToValueAtTime(1, now + 2.5);
    },
    update() {
      if (!ctx || !cur) return;
      const stepDur = 60 / cur.bpm / cur.stepDiv;
      while (nextT < ctx.currentTime + 0.25) { scheduleStep(cur, step, nextT); step++; nextT += stepDur; }
    },
    setVolume(v) { volume = v; if (out) out.gain.value = v * duckV; },
    duck(v) { if (v === duckV || !out) return; duckV = v; out.gain.cancelScheduledValues(ctx.currentTime); out.gain.linearRampToValueAtTime(volume * v, ctx.currentTime + 0.8); },
    get volume() { return volume; }
  };
})();
