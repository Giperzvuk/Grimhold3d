// ---------- Процедурные пиксельные текстуры и спрайты (v0.2) ----------
const TEX = (() => {
  let seed = 1337;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  function vnoise(x, y, period) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const wrap = v => ((v % period) + period) % period;
    const fx = smooth(x - xi), fy = smooth(y - yi);
    const a = hash(wrap(xi), wrap(yi)), b = hash(wrap(xi + 1), wrap(yi)), c = hash(wrap(xi), wrap(yi + 1)), d = hash(wrap(xi + 1), wrap(yi + 1));
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }
  function fbm(x, y, size, oct) {
    let v = 0, amp = 0.35, freq = 8 / size, tot = 0, per = 8;
    for (let i = 0; i < oct; i++) { v += vnoise(x * freq, y * freq, per) * amp; tot += amp; amp *= 0.5; freq *= 2; per *= 2; }
    return v / tot;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Байер 4×4; дизеринг только в средней зоне между ступенями, иначе — округление (нет «москитной сетки»)
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16));
  function tile(size, fn, steps) {
    const n = Math.abs(steps || 10), noDither = (steps || 10) < 0;
    const c = canvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let [r, g, b] = fn(x, y); const i = (y * size + x) * 4;
      r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
      const lum = r * 0.3 + g * 0.59 + b * 0.11, q = lum / 255 * n, fl = Math.floor(q), fr = q - fl;
      const thr = noDither || fr < 0.35 || fr > 0.65 ? 0.5 : BAYER[y & 3][x & 3];
      const ql = Math.min(n, fl + (fr > thr ? 1 : 0)) / n * 255, k = lum > 1 ? ql / lum : 1;
      d[i] = clamp(r * k, 0, 255); d[i + 1] = clamp(g * k, 0, 255); d[i + 2] = clamp(b * k, 0, 255); d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function toTex(c) { c.isTile = true; return c; } // канвас; в 3D-рендере оборачивается в текстуру движка

  const S = 128; // 2×2 суб-тайла по 64 px; клетки выбирают квадрант — меньше видимого повтора
  const gen = {};
  gen.brick = () => tile(S, (x, y) => {
    const row = Math.floor(y / 8), off = (row % 2) * 8, bx = (x + off) % 16, by = y % 8, mortar = bx === 0 || by === 0;
    const n = fbm(x, y, S, 3), bn = hash(Math.floor((x + off) / 16), row) * 0.25;
    if (mortar) { const m = 62 + n * 30; return [m, m - 4, m - 8]; }
    const bev = (bx === 1 || by === 1) ? 1.18 : (bx === 15 || by === 7) ? 0.78 : 1;
    const v = (95 + n * 55 + bn * 40) * bev; return [v, v - 8, v - 14];
  });
  gen.crypt = () => tile(S, (x, y) => { // сырой камень с зеленью
    const row = Math.floor(y / 8), off = (row % 2) * 8, bx = (x + off) % 16, by = y % 8, mortar = bx === 0 || by === 0;
    const n = fbm(x, y, S, 4), moss = by >= 5 && hash(Math.floor((x + off) / 16), row + 3) < 0.35 && fbm(x * 3, y * 3, S, 2) > 0.5;
    if (mortar) { const m = 50 + n * 25; return [m, m + 2, m - 6]; }
    const bev = (bx === 1 || by === 1) ? 1.15 : (bx === 15 || by === 7) ? 0.8 : 1;
    const v = (80 + n * 55) * bev; return moss ? [v * 0.55, v * 0.85, v * 0.45] : [v, v + 2, v - 4];
  });
  // Ячейки Вороного (бесшовные по периоду S) — камень с гранями
  const VOR = 10, vpts = []; for (let i = 0; i < 40; i++) vpts.push([hash(i, 1) * S, hash(i, 2) * S, hash(i, 3)]);
  function voronoi(x, y) {
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (const [px, py, h] of vpts) { let dx = Math.abs(x - px), dy = Math.abs(y - py); dx = Math.min(dx, S - dx); dy = Math.min(dy, S - dy); const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d; }
    return { edge: Math.sqrt(d2) - Math.sqrt(d1), id };
  }
  gen.rock = () => tile(S, (x, y) => { const vo = voronoi(x, y), n = fbm(x, y, S, 4); const v = (55 + vo.id * 45 + n * 45) * (vo.edge < 1.5 ? 0.55 : vo.edge < 3 ? 1.12 : 1); return [v + 6, v, v - 6]; });
  gen.mine = () => tile(S, (x, y) => { const vo = voronoi(x + 37, y + 11), n = fbm(x, y, S, 4), vein = fbm(x * 2 + 5, y + 50, S, 3) > 0.74; const v = (50 + vo.id * 40 + n * 40) * (vo.edge < 1.5 ? 0.55 : vo.edge < 3 ? 1.1 : 1); return vein ? [v + 45, v + 30, v] : [v + 12, v + 4, v - 6]; });
  gen.planks = () => tile(S, (x, y) => {
    const p = Math.floor(x / 8), seam = x % 8 === 0 || (y % 64 === Math.floor(hash(p, 4) * 64)), n = fbm(x * 0.4, y * 3, S, 3), pn = hash(p, 3) * 0.3;
    const knot = Math.hypot((x % 8) - 4, (y % 37) - 17) < 2 && hash(p, y >> 5) < 0.3;
    if (seam) return [40, 28, 18]; if (knot) return [58, 38, 22];
    const v = 88 + n * 50 + pn * 40; return [v + 10, v * 0.72, v * 0.45];
  });
  gen.boards = () => tile(S, (x, y) => { // пол из досок (горизонтальные)
    const p = Math.floor(y / 8), seam = y % 8 === 0 || (x % 32 === 0 && (p % 2)), n = fbm(x * 3, y * 0.4, S, 3), pn = hash(p, 9) * 0.3;
    if (seam) return [35, 24, 15];
    const v = 78 + n * 45 + pn * 35; return [v + 8, v * 0.7, v * 0.42];
  });
  gen.plaster = () => tile(S, (x, y) => { // фахверк: балки каждые 21 px, раскосы, окно, грязь снизу
    const xx = x % 64, yy = y % 64, q = (x >> 6) + (y >> 6) * 2;
    const vbeam = xx % 21 < 4, hbeam = yy < 4 || (yy >= 30 && yy < 34 && q % 2 === 0);
    const diag = q % 2 === 1 && Math.abs((xx % 21) - (yy % 26) * 17 / 26) < 2.2;
    const win = q === 3 && xx >= 24 && xx < 36 && yy >= 12 && yy < 28;
    const n = fbm(x, y, S, 3);
    if (win) { const fr = xx === 24 || xx === 35 || yy === 12 || yy === 27 || xx === 30 || yy === 20; return fr ? [70, 50, 30] : [22 + n * 10, 24 + n * 10, 34 + n * 10]; }
    if (vbeam || hbeam || diag) { const v = 55 + n * 30; return [v + 10, v * 0.7, v * 0.45]; }
    const dirt = 1 - Math.max(0, (yy - 40) / 24) * 0.35;
    const v = (165 + n * 45) * dirt; return [v, v - 12, v - 34];
  });
  gen.logs = () => tile(S, (x, y) => { // бревенчатая стена
    const r = y % 16, edge = r < 2 || r > 13, n = fbm(x * 3, y * 0.6, S, 3), ln = hash(0, Math.floor(y / 16)) * 0.3;
    const shade = 1 - Math.abs(r - 8) / 10;
    if (edge) return [30, 20, 12];
    const v = (70 + n * 45 + ln * 30) * (0.7 + shade * 0.4); return [v + 10, v * 0.68, v * 0.42];
  });
  gen.grass = () => tile(S, (x, y) => { const n = fbm(x, y, S, 4), b = hash(x, y); const v = 55 + n * 60 + (b > 0.92 ? 30 : 0); return [v * 0.55 + 10, v + 20, v * 0.35]; }, -8);
  gen.grassDark = () => tile(S, (x, y) => { const n = fbm(x + 7, y + 3, S, 4), b = hash(x, y); const v = 40 + n * 55 + (b > 0.93 ? 25 : 0); return [v * 0.5 + 6, v + 12, v * 0.35]; }, -8);
  gen.dirt = () => tile(S, (x, y) => { const n = fbm(x, y, S, 4), b = hash(x * 3, y * 7); const v = 85 + n * 60 + (b > 0.95 ? 35 : 0); return [v + 12, v * 0.78, v * 0.5]; }, -8);
  gen.flag = () => tile(S, (x, y) => {
    const bx = x % 32, by = y % 32, mortar = bx < 2 || by < 2, cell = hash(Math.floor(x / 32), Math.floor(y / 32) + 9), n = fbm(x, y, S, 4);
    if (mortar) { const m = 38 + n * 20; return [m, m, m + 4]; }
    const bev = (bx === 2 || by === 2) ? 1.15 : (bx === 31 || by === 31) ? 0.8 : 1, crack = fbm(x * 3, y * 3, S, 2) > 0.78;
    const v = (70 + n * 55 + cell * 25) * bev * (crack ? 0.7 : 1); return [v, v, v + 6];
  });
  gen.gravel = () => tile(S, (x, y) => { const n = fbm(x, y, S, 5), b = hash(x * 5, y * 3); const v = 60 + n * 50 + (b > 0.9 ? 30 : 0); return [v + 8, v + 4, v - 2]; }, -8);
  gen.ceiling = () => tile(S, (x, y) => { const n = fbm(x, y, S, 5); const v = 35 + n * 50; return [v, v - 2, v + 2]; }, -8);
  gen.roof = () => tile(S, (x, y) => { // черепица: ряды 6 px со смещением, скруглённый низ, мох
    const row = Math.floor(y / 6), off = (row % 2) * 5, bx = (x + off) % 10, by = y % 6, n = fbm(x, y, S, 3), sn = hash(Math.floor((x + off) / 10), row + 50);
    if (by === 5) return [40, 20, 16]; if (by === 4) return [150, 78, 56];
    if (bx === 0) return [58, 28, 22];
    const moss = sn > 0.92 && fbm(x * 3, y * 3, S, 2) > 0.45;
    const v = (100 + n * 30 + sn * 30) * (by === 0 ? 1.12 : 1); return moss ? [v * 0.55, v * 0.75, v * 0.35] : [v, v * 0.5, v * 0.38];
  });
  gen.thatch = () => tile(S, (x, y) => { const n = fbm(x * 0.5, y * 4, S, 3), r = y % 10 === 9; const v = 120 + n * 60; return r ? [70, 50, 25] : [v + 20, v * 0.8, v * 0.4]; });
  gen.water = () => tile(S, (x, y) => { const n = fbm(x, y * 2, S, 3); const v = n * 70; return [20 + v * 0.4, 50 + v * 0.8, 110 + v]; });
  gen.door = (locked) => tile(S, (x0, y0) => {
    const x = x0 % 64, y = y0 % 64; const p = Math.floor(x / 10), seam = x % 10 === 0, n = fbm(x * 0.5, y * 2, S, 3), pn = hash(p, 11) * 0.25;
    const band = (y >= 12 && y < 17) || (y >= 46 && y < 51), knob = !locked && Math.abs(x - 50) < 3 && Math.abs(y - 32) < 3, lock = locked && Math.abs(x - 32) < 6 && Math.abs(y - 32) < 7;
    if (lock) { const inner = Math.abs(x - 32) < 2 && y > 30 && y < 37; return inner ? [15, 12, 10] : [120, 110, 70]; }
    if (knob) return [200, 170, 60];
    if (band) { const rivet = (x % 12 === 3) && (y === 14 || y === 48); return rivet ? [130, 130, 135] : [55, 55, 62]; }
    if (seam) return [35, 22, 14];
    const v = 75 + n * 45 + pn * 40; return [v + 10, v * 0.66, v * 0.4];
  });
  gen.chapel = () => tile(S, (x, y) => {
    const row = Math.floor(y / 16), off = (row % 2) * 16, bx = (x + off) % 32, by = y % 16, mortar = bx < 2 || by < 2, n = fbm(x, y, S, 4), bn = hash(Math.floor((x + off) / 32), row + 77) * 0.2;
    if (mortar) { const m = 50 + n * 25; return [m, m, m + 4]; }
    const v = 105 + n * 45 + bn * 40; return [v, v - 2, v - 8];
  });
  gen.gate = () => tile(S, (x, y) => { // ворота: вертикальные брусья
    const yy = y % 64; const p = Math.floor(x / 8), seam = x % 8 < 2, n = fbm(x * 0.4, y * 3, S, 3), band = (yy >= 8 && yy < 13) || (yy >= 50 && yy < 55);
    if (band) return [60, 58, 62];
    if (seam) return [22, 16, 10];
    const v = 60 + n * 40 + hash(p, 5) * 30; return [v + 8, v * 0.7, v * 0.45];
  });
  gen.carpet = () => tile(S, (x, y) => { const b = (x % 32 < 3 || y % 32 < 3), n = fbm(x, y, S, 2); const v = 100 + n * 40; return b ? [v * 0.9, v * 0.6, v * 0.25] : [v, v * 0.28, v * 0.25]; });

  const T = {};
  for (const k of ['brick', 'crypt', 'rock', 'mine', 'planks', 'boards', 'plaster', 'logs', 'grass', 'grassDark', 'dirt', 'flag', 'gravel', 'ceiling', 'roof', 'thatch', 'water', 'chapel', 'gate', 'carpet']) T[k] = toTex(gen[k]());
  T.door = toTex(gen.door(false)); T.doorLocked = toTex(gen.door(true));

  // ---------- Пиксель-арт ----------
  function art(rows, pal) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const c = canvas(w, h), ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x]; if (ch === '.' || ch === ' ') continue;
      ctx.fillStyle = pal[ch] || '#ff00ff'; ctx.fillRect(x, y, 1, 1);
    }
    return c;
  }
  // Второй кадр ходьбы: зеркалим строки ног
  function legFrame(c, legRow) {
    const w = c.width, h = c.height, o = canvas(w, h), ctx = o.getContext('2d');
    ctx.drawImage(c, 0, 0, w, legRow, 0, 0, w, legRow);
    ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(c, 0, legRow, w, h - legRow, 0, legRow, w, h - legRow); ctx.restore();
    return o;
  }
  // Кадры шага без зеркалирования: тело чуть опускается, одна нога приподнята (нет «прыгающего» оружия и теней)
  function stepFrame(c, legRow, splitX, side) {
    const w = c.width, h = c.height, o = canvas(w, h), ctx = o.getContext('2d');
    ctx.drawImage(c, 0, 0, w, legRow, 0, 1, w, legRow); // верх — на 1 px вниз
    const x0 = side < 0 ? 0 : splitX, x1 = side < 0 ? splitX : w;
    ctx.drawImage(c, x0, legRow, x1 - x0, h - legRow, x0, legRow - 1, x1 - x0, h - legRow); // шагающая нога вверх
    const y0 = side < 0 ? splitX : 0, y1 = side < 0 ? w : splitX;
    ctx.drawImage(c, y0, legRow, y1 - y0, h - legRow, y0, legRow, y1 - y0, h - legRow); // опорная нога на месте
    return o;
  }
  function walkFrames(c, legRow, splitX) { return [c, stepFrame(c, legRow, splitX, -1), c, stepFrame(c, legRow, splitX, 1)]; }
  function spriteTex(c) { return c; }
  // Тень-эллипс у ног: делает спрайты «стоящими» на земле
  function withShadow(c) {
    const o = canvas(c.width, c.height + 3), ctx = o.getContext('2d');
    ctx.fillStyle = 'rgba(20,16,26,0.45)'; const w = c.width * 0.6; ctx.beginPath(); ctx.ellipse(c.width / 2, c.height + 1, w / 2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(c, 0, 0); return o;
  }

  const K = '#14120f';
  const ART = {}, ANIM = {};

  // ---- Генератор людей ----
  // opts: skin, hair, hairStyle(short|long|bald|hood|helmet|cap), beard, shirt, armor(none|leather|chain|plate|robe|apron), pants, boots, weapon(none|sword|axe|staff|dagger|bow|pick)
  function human(o) {
    const P = { k: K, S: o.skin || '#e0b48c', d: o.skinShade || '#c89a74', D: o.shade || '#3d2f3f', H: o.hair || '#5a3a20', e: '#1e1e28', T: o.shirt || '#6b4a2a', A: o.armorCol || '#8a5a30', L: o.pants || '#3d2a18', B: o.boots || '#2a1c10', M: '#9aa0a8', W: '#c8ccd4', Y: '#d9a53c', R: o.robe || '#4a2a6a', N: o.apron || '#9a8a70', s: '#6a5030' };
    const g = Array.from({ length: 30 }, () => Array(18).fill('.'));
    const put = (x, y, ch) => { if (y >= 0 && y < 30 && x >= 0 && x < 18) g[y][x] = ch; };
    const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, ch); };
    // голова
    rect(6, 2, 11, 8, 'S'); rect(5, 3, 5, 7, 'k'); rect(12, 3, 12, 7, 'k'); rect(6, 1, 11, 1, 'k'); rect(6, 9, 11, 9, 'k');
    put(7, 5, 'e'); put(10, 5, 'e');
    const hs = o.hairStyle || 'short';
    if (hs === 'short') { rect(6, 1, 11, 2, 'H'); put(5, 2, 'H'); put(12, 2, 'H'); rect(5, 1, 12, 0, 'k'); }
    if (hs === 'long') { rect(6, 1, 11, 2, 'H'); rect(5, 2, 5, 9, 'H'); rect(12, 2, 12, 9, 'H'); rect(4, 3, 4, 9, 'k'); rect(13, 3, 13, 9, 'k'); rect(5, 0, 12, 0, 'k'); }
    if (hs === 'bald') { rect(6, 1, 11, 1, 'S'); rect(6, 0, 11, 0, 'k'); }
    if (hs === 'hood') { rect(5, 0, 12, 2, 'R'); rect(4, 1, 4, 9, 'R'); rect(13, 1, 13, 9, 'R'); rect(3, 2, 3, 9, 'k'); rect(14, 2, 14, 9, 'k'); rect(5, -1, 12, -1, 'k'); }
    if (hs === 'helmet') { rect(5, 0, 12, 3, 'M'); rect(4, 1, 4, 5, 'M'); rect(13, 1, 13, 5, 'M'); rect(5, -1, 12, -1, 'k'); put(8, 4, 'M'); put(9, 4, 'M'); }
    if (hs === 'cap') { rect(5, 0, 12, 2, 'T'); rect(4, 2, 13, 2, 'T'); rect(3, 2, 3, 2, 'k'); rect(14, 2, 14, 2, 'k'); rect(5, -1, 12, -1, 'k'); }
    if (o.beard) { rect(6, 7, 11, 9, o.beard === 'grey' ? 'W' : 'H'); rect(7, 10, 10, o.beardLong ? 13 : 10, o.beard === 'grey' ? 'W' : 'H'); put(8, 7, 'S'); put(9, 7, 'S'); }
    // шея / торс
    rect(8, 10, 9, 10, 'S');
    const arm = o.armor || 'none';
    const torso = arm === 'none' ? 'T' : arm === 'leather' ? 'A' : arm === 'chain' || arm === 'plate' ? 'M' : arm === 'robe' ? 'R' : 'T';
    rect(5, 11, 12, 19, torso); rect(4, 11, 4, 19, 'k'); rect(13, 11, 13, 19, 'k'); rect(5, 10, 12, 10, 'k');
    if (arm === 'plate') { rect(6, 12, 11, 13, 'W'); rect(8, 14, 9, 18, 'W'); }
    if (arm === 'chain') { for (let y = 12; y <= 18; y++) for (let x = 5; x <= 12; x++) if ((x + y) % 2) put(x, y, 'W'); }
    if (arm === 'leather') { rect(8, 12, 9, 18, 'k'); rect(5, 15, 12, 15, 'k'); }
    if (arm === 'apron') { rect(7, 13, 10, 19, 'N'); rect(7, 12, 10, 12, 'k'); }
    if (arm === 'robe') { rect(5, 20, 12, 27, 'R'); rect(4, 20, 4, 27, 'k'); rect(13, 20, 13, 27, 'k'); rect(5, 28, 12, 28, 'k'); }
    rect(5, 17, 12, 17, arm === 'robe' ? 'R' : 's'); // пояс
    // руки
    rect(3, 12, 3, 18, torso === 'R' ? 'R' : torso); rect(14, 12, 14, 18, torso === 'R' ? 'R' : torso); rect(2, 12, 2, 18, 'k'); rect(15, 12, 15, 18, 'k'); rect(3, 11, 3, 11, 'k'); rect(14, 11, 14, 11, 'k');
    rect(3, 19, 3, 20, 'S'); rect(14, 19, 14, 20, 'S'); rect(2, 19, 2, 21, 'k'); rect(15, 19, 15, 21, 'k'); put(3, 21, 'k'); put(14, 21, 'k');
    // ноги
    if (arm !== 'robe') {
      rect(5, 20, 8, 26, 'L'); rect(9, 20, 12, 26, 'L'); rect(4, 20, 4, 26, 'k'); rect(13, 20, 13, 26, 'k'); rect(8, 21, 8, 26, 'k'); rect(9, 21, 9, 26, 'k');
      rect(5, 27, 8, 28, 'B'); rect(9, 27, 12, 28, 'B'); rect(4, 27, 4, 29, 'k'); rect(13, 27, 13, 29, 'k'); rect(5, 29, 12, 29, 'k'); put(8, 27, 'k'); put(9, 27, 'k');
      put(4, 28, 'B'); put(3, 28, 'k'); put(3, 29, 'k'); // носок левого сапога
    }
    // оружие в правой руке (справа на экране)
    const wp = o.weapon || 'none';
    if (wp !== 'none') { rect(15, 18, 16, 20, 'S'); }
    if (wp === 'sword') { rect(16, 8, 16, 17, 'W'); put(16, 7, 'W'); rect(15, 17, 17, 17, 'Y'); rect(16, 21, 16, 22, 's'); }
    if (wp === 'dagger') { rect(16, 14, 16, 19, 'W'); rect(15, 19, 17, 19, 'Y'); put(16, 20, 's'); }
    if (wp === 'axe') { rect(16, 9, 16, 21, 's'); rect(14, 8, 17, 11, 'M'); rect(13, 9, 13, 10, 'M'); }
    if (wp === 'staff') { rect(16, 4, 16, 24, 's'); put(16, 3, 'Y'); put(15, 3, 'Y'); put(17, 3, 'Y'); put(16, 2, 'Y'); }
    if (wp === 'pick') { rect(16, 9, 16, 21, 's'); rect(13, 9, 17, 9, 'M'); put(13, 10, 'M'); put(17, 10, 'M'); }
    if (wp === 'bow') { rect(16, 6, 16, 22, 's'); put(17, 8, 'W'); put(17, 20, 'W'); }
    if (wp === 'lantern') { rect(16, 14, 16, 16, 's'); rect(15, 17, 17, 20, 'Y'); rect(15, 21, 17, 21, 'k'); }
    const rows = g.map(r => r.join(''));
    const a = art(rows, P);
    // затенение: правая треть торса и ног темнее
    const ctx = a.getContext('2d'), im = ctx.getImageData(0, 0, a.width, a.height), d = im.data;
    for (let y = 10; y < 29; y++) for (let x = 10; x <= 12; x++) { const i = (y * a.width + x) * 4; if (d[i + 3] && !(d[i] < 30 && d[i + 1] < 30)) { d[i] *= 0.78; d[i + 1] *= 0.74; d[i + 2] *= 0.82; } }
    ctx.putImageData(im, 0, 0);
    return walkFrames(a, 20, 9);
  }

  // ---- Монстры (вручную) ----
  ANIM.goblin = (() => { const a = art([
    '.......kkkkkkk..........',
    '.....kkGGGGGGGkk........',
    '....kGGGGGGGGGGGk.......',
    '..kkGGwkGGGGGkwGGkk.....',
    '.kGGGGkkGGGGGkkGGGGk....',
    '.kGGGGGGGGGGGGGGGGGk....',
    '..kGGGGGrrrrrrGGGGk.....',
    '...kGGGGGGGGGGGGGk......',
    '....kkGGGGGGGGGkk.......',
    '.....kkGGGGGGGkk........',
    '....kBBkGGGGGkBBk....k..',
    '...kBBBBBBBBBBBBBk..kWk.',
    '..kGBBBBBBBBBBBBBGk.kWk.',
    '..kGkBBBBBBBBBBBkGk.kWk.',
    '..kGkkbbbbbbbbbkkGk.kWk.',
    '..kskkbbbbbbbbbkksk.kWk.',
    '..kskkbbbbkkbbbkksk.kYk.',
    '...k.kGGGkkkGGGk.k..ksk.',
    '.....kGGGkkkGGGk........',
    '.....kGGGk.kGGGk........',
    '....kkkkkk.kkkkkk.......',
    '....kkkkk...kkkkk.......'
  ], { k: K, G: '#5f8a3a', w: '#f2e8b0', r: '#a83232', B: '#6b4a2a', b: '#3d2a18', s: '#9aa0a8', W: '#c8ccd4', Y: '#d9a53c' }); return [a, legFrame(a, 17)]; })();
  ANIM.skeleton = (() => { const a = art([
    '.......kkkkkkk..........',
    '......kWWWWWWWk.........',
    '.....kWWWWWWWWWk........',
    '.....kWkkWWWkkWk........',
    '.....kWkkWWWkkWk........',
    '.....kWWWWWWWWWk........',
    '......kWkWkWkWk.........',
    '.......kkkkkkk..........',
    '......kkWWWWWkk.........',
    '....kkWkWWWWWkWkk.......',
    '...kWkkWWWWWWWkkWk......',
    '...kWk.kWWWWWk.kWk......',
    '...kWk.kWkkkWk.kWk..kk..',
    '...kWk.kWWWWWk.kWk.kMMk.',
    '...kWk.kWkkkWk.kWk.kMMk.',
    '...kWk..kWWWk..kWk.kMMk.',
    '...kWk..kWWWk..kWk.kMMk.',
    '...ksk..kWWWk..kWkkkssk.',
    '...ksk.kWkkkWk..kkkkkk..',
    '...ksk.kWk.kWk..........',
    '.......kWk.kWk..........',
    '.......kWk.kWk..........',
    '......kkkk.kkkk.........',
    '......kkkk.kkkk.........'
  ], { k: K, W: '#d9d2bf', s: '#8c8a80', M: '#8a8a90' }); return [a, legFrame(a, 18)]; })();
  ANIM.wolf = (() => { const a = art([
    '.kk.........................................kkk.',
    'kDDk.......................................kDDDk',
    'kDGDk....kkkkkkkkkkkkkkkkkkkkkkkkkk.......kDDDk.',
    'kDGGDkkkkDDDDDDDDDDDDDDDDDDDDDDDDDDkk....kDDDk..',
    '.kGyGGGGGDDDDDDDDDDDDDDDDDDDDDDDDDDDDk..kDDDk...',
    '.kGGGGGGGGGGGGGGDDDDDDDDDDDDDDGGGGGGGDkkDDDk....',
    'kGnGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGDDDDDk....',
    'kGGwwGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGDDDk.....',
    '.kGGrGGkGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGDk......',
    '..kkkkkkGGGLLLLLLLLLLLLLLLLLLLLLLLLLLGGGGk......',
    '.......kGGGLLLLLLLLLLLLLLLLLLLLLLLLLLGGGk.......',
    '........kGGGGGGLLLLLLLLLLLLLLLLLLLGGGGGGk.......',
    '........kGGGGGGkGGGGGGGGGGGkkGGGGGGkGGGGk.......',
    '.........kGGGGk.kGGGGGGGGGk..kGGGGGk.kGGGk......',
    '.........kGGGk..kGGGGGk.kGGk.kGGGGk...kGGk......',
    '.........kGGk...kGGGGk...kGk..kGGGk...kGGk......',
    '.........kGGk...kGGGk....kGk..kGGk....kGGk......',
    '.........kDDk...kGGk.....kDk..kDDk....kDDk......',
    '.........kDDk...kDDk.....kDk..kDDk....kDDk......',
    '.........kkkk...kkkk.....kkk..kkkk....kkkk......'
  ], { k: K, G: '#6f6a66', D: '#4a4644', L: '#8f8a84', y: '#f2c04a', w: '#f2e8b0', r: '#c04040', n: '#1a1410' }); return [a, legFrame(a, 12)]; })();
  ANIM.lich = (() => { const a = art([
    '........kkkkkk..........',
    '.......kPPPPPPk.........',
    '......kPPPPPPPPk........',
    '......kWWWWWWWWk........',
    '......kWggWWggWk........',
    '......kWWWWWWWWk........',
    '.......kWkkkkWk.........',
    '........kkkkkk..........',
    '......kkPPPPPPkk........',
    '.....kPPPPPPPPPPk.......',
    '....kPPPPPPPPPPPPk......',
    '...kPPPPPPPPPPPPPPk.....',
    '...kPPkPPPPPPPPkPPk..kk.',
    '...kWk.PPPPPPPP.kWk.kggk',
    '...kWk.PPPPPPPP.kWk.kggk',
    '...kWk.PPPPPPPP.kok..kk.',
    '....k..PPPPPPPP.kok..o..',
    '.......PPPPPPPP..o...o..',
    '.......PPPPPPPP..o...o..',
    '.......PPPPPPPP..o...o..',
    '......PPPPPPPPPP.o...o..',
    '......PPPPPPPPPP.o...o..',
    '.....PPPPPPPPPPPP....o..',
    '.....PPPPPPPPPPPP....o..',
    '....PPPPPPPPPPPPPP......',
    '....kkkkkkkkkkkkkk......'
  ], { k: K, P: '#4a2a6a', W: '#d9d2bf', g: '#7df0a0', o: '#5a4020' }); return [a, a]; })();
  ANIM.spider = (() => { const a = art([
    '.........kk....................kk...............',
    '........kDDk..................kDDk..............',
    '.......kDDDDkk..............kkDDDDk.............',
    '......kDDDDDDDkkkkkkkkkkkkkkDDDDDDDk............',
    '.....kDDDDDDDDDDDDLLLLLLDDDDDDDDDDDDk...........',
    'kk..kDDDDDDDDDDDLLLLLLLLLLDDDDDDDDDDDk.....kk...',
    'kDkkDDDDDDDDDDDLLLLLLLLLLLLDDDDDDDDDDDkkkkkDDk..',
    '.kDDDDDDDDDDDDDLLLLLLLLLLLLDDDDDDDDDDDDDDDDDk...',
    '..kDDDDrrDDDDDDDLLLLLLLLLLDDDDDDDDDDDDDDDDk.....',
    '..kDDDrrrrDDDDDDDLLLLLLLLDDDDDDDDDDDDDDDDDk.....',
    '.kDDDDrrDDrrDDDDDDLLLLLLDDDDDDDDDDDDDDDDDDDk....',
    'kDDkDDDDDrrDDDDDDDDDDDDDDDDDDDDDDDDDDDDDkDDDk...',
    'kDk.kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk.kDDk...',
    'kk...kDDDkDDDkDDDDDDDDDDDDDDDDDkDDDkDDDk..kkk...',
    '......kkkDDkkkDDkkDDDDDDDDkkDDkkkDDkkk..........',
    '.........kk..kDk..kDDDDDDk..kDk..kk.............',
    '............kDk...kDk..kDk...kDk................',
    '...........kk.....kk....kk....kk................'
  ], { k: '#2e1e34', D: '#5c3868', L: '#8a6a96', r: '#e04040' }); return [a, legFrame(a, 12)]; })();
  ANIM.bear = (() => { const a = art([
    '....................k...................................',
    '.............kkkkkkkHkkkkkkk............................',
    '..........kkkHHHHHHHHHHHHHHHkkk.........................',
    '........kkHHHHHHHHHHHHHHHHHHHHHkk..............kkk......',
    '.......kHHHHHHHHHHHHHHHHHHHHHHHHHk.......kkk..kbbbk.....',
    '......kHHHHHHHHHHHHHHHHHHHHHHHHHHHkkk...kbbbk.kbBbk.....',
    '.....kHHHHHHHHHHHHHHHHHHHHHHHHHHHHHbbkkkkbBbkkbbbbk.....',
    '.....kHHHHHHHHHHHHHHHHHHHHHHHHHHHHbbbbbbkbbbbbbbbbkk....',
    '......kHHHHHHHHHHHHHHHHHHHHHHHHHHbbbbbbbbbbbbbbbbbbbk...',
    '.....kbbbbbHHHHHHHHHHHHHHHHHHHbbbbbbbbbbbbbbbbbbbbbbbk..',
    '....kbbbbbbbbbbbbbbbHbbbbbbbbbbbbbbbbbbbbbbbbbbwebbbbk..',
    '...kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBbbk..',
    '..kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBBBBBBBk.',
    '..kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBBBBBBBBnk',
    '..kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBBBBBBBBnnB',
    '.kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBBBBBBBBBk',
    '..kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBBBBBBBk.',
    '..kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBkkk..',
    '..kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbkkkk.....',
    '...kbbbbbbBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBbbkk.........',
    '....kbbbbBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk...........',
    '.....kbbBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk..........',
    '.....kddddddddBBBBBBBBBBBBBBBBBBBBBBddddddddk...........',
    '.....kddddddddBBBBBBBBBBBBBBBBBBBBBBddddddddk...........',
    '.....kddddddddbbbbbbBBBBBBBBBBbbbbbbddddddddk...........',
    '.....kddddddddbbbbbbBBBBBBBBBBbbbbbbddddddddk...........',
    '.....kddddddddbbbbbbkkkkbkBkkkbbbbbbddddddddk...........',
    '.....kddddddddbbbbbbk...k.k..kbbbbbbddddddddk...........',
    '.....kddddddddbbbbbbk........kbbbbbbddddddddk...........',
    '.....kddddddddbbbbbbk........kbbbbbbddddddddk...........',
    '.....kddddddddbbbbbbk........kbbbbbbddddddddk...........',
    '.....kddddddddbbbbbbk........kbbbbbbddddddddk...........',
    '.....kddddddddddddddk........kddddddddddddddk...........',
    '.....kddddddddddddddk........kddddddddddddddk...........',
    '......kwkwkwkkkwkwkk..........kwkwkkkwkwkwkk............',
    '.......k.k.k...k.k.............k.k...k.k.k..............'
  ], { k: '#2a1a10', b: '#5a3a22', H: '#3f2816', B: '#8a6a4a', d: '#3d2a18', w: '#f2e8b0', n: '#120c08', e: '#120c08' }); return walkFrames(a, 23, 28); })();
  ANIM.ghost = (() => { const a = art([
    '.........kkkkkk.........',
    '.......kkwwwwwwkk.......',
    '......kwwwwwwwwwwk......',
    '.....kwwwwwwwwwwwwk.....',
    '.....kwwkkwwwwkkwwk.....',
    '.....kwkkkwwwwkkkwk.....',
    '.....kwwkkwwwwkkwwk.....',
    '.....kwwwwwwwwwwwwk.....',
    '.....kwwwwwkkkkwwwwk....',
    '....kwwwwwwkkkwwwwwwk...',
    '....kwwwwwwwwwwwwwwwk...',
    '...kwwwwwwwwwwwwwwwwwk..',
    '...kwwwwwwwwwwwwwwwwwk..',
    '..kwwwwwwwwwwwwwwwwwwwk.',
    '..kwggwwwwwwwwwwwwwggwk.',
    '..kgggwwwwwwwwwwwwwgggk.',
    '.kgggggwwwwwwwwwwwgggggk',
    '.kgggggggwwwwwwwgggggggk',
    '.kggggggggggggggggggggk.',
    '..kgggkggggggggggkgggk..',
    '...kk.kggggkkgggggk.kk..',
    '.......kkkk..kkkkk......'
  ], { k: '#3a4a5a', w: '#b8d0e0', g: '#6a8aa0' }); return [a, a]; })();
  ANIM.bandit = human({ hairStyle: 'hood', robe: '#3a3a2a', armor: 'leather', armorCol: '#5a4a30', pants: '#2a2a20', weapon: 'dagger', shirt: '#4a3a28' });
  ANIM.banditAxe = human({ hairStyle: 'cap', shirt: '#3a3a2a', armor: 'leather', armorCol: '#5a4a30', pants: '#2a2a20', weapon: 'axe', beard: true, hair: '#2a1a10' });
  ANIM.chief = human({ hairStyle: 'helmet', armor: 'chain', pants: '#3a2a20', weapon: 'sword', beard: true, hair: '#7a3a20' });
  // ---- NPC ----
  ANIM.elder = human({ hairStyle: 'bald', beard: 'grey', beardLong: true, armor: 'robe', robe: '#6b4a2a', weapon: 'staff' });
  ANIM.smith = human({ hairStyle: 'short', hair: '#3a2a1a', beard: true, shirt: '#8a3a2a', armor: 'apron', apron: '#b0a090', pants: '#3d2a18' });
  ANIM.healer = human({ hairStyle: 'long', hair: '#5a3a20', shirt: '#4a7a3a', armor: 'robe', robe: '#4a7a3a' });
  ANIM.innkeeper = human({ hairStyle: 'long', hair: '#c04a2a', shirt: '#7a3a4a', armor: 'apron', apron: '#e0d8c0', pants: '#5a2a3a' });
  ANIM.miner = human({ hairStyle: 'cap', shirt: '#5a5a60', armor: 'leather', armorCol: '#6a5a40', pants: '#4a4a40', weapon: 'pick', beard: true, hair: '#6a6a60' });
  ANIM.hunter = human({ hairStyle: 'hood', robe: '#3a5a2a', armor: 'leather', armorCol: '#6a4a2a', pants: '#3a2a18', weapon: 'bow' });
  ANIM.villager1 = human({ hairStyle: 'short', hair: '#8a6a3a', shirt: '#5a6a8a', pants: '#3d2a18' });
  ANIM.villager2 = human({ hairStyle: 'long', hair: '#2a1a10', shirt: '#8a5a6a', armor: 'robe', robe: '#8a5a6a' });
  ANIM.guard = human({ hairStyle: 'helmet', armor: 'chain', pants: '#3a2a20', weapon: 'sword' });

  // ---- Реквизит и предметы ----
  ART.pine = art([
    '.........kk.........', '........kGGk........', '.......kGGGGk.......', '......kGGGGGGk......', '.......kGGGGk.......', '......kGGGGGGk......', '.....kGGGGGGGGk.....', '....kGGGgGGGGGGk....',
    '.....kGGGGGGGGk.....', '....kGGGGGGGGGGk....', '...kGGGGgGGGGGGGk...', '..kGGGGGGGGGGgGGGk..', '...kGGGGGGGGGGGGk...', '..kGGGGGGGgGGGGGGk..', '.kGGGGgGGGGGGGGGGGk.', 'kGGGGGGGGGGGGGgGGGGk',
    '.kkkkkkkkkkkkkkkkkk.', '.........kbk........', '.........kbk........', '.........kbk........', '........kkbkk.......'
  ], { k: '#0e140e', G: '#2f5a2a', g: '#4a7a3a', b: '#4a3018' });
  ART.pineDark = art(['.........kk.........', '........kGGk........', '.......kGGGGk.......', '......kGGGGGGk......', '.......kGGGGk.......', '......kGGGGGGk......', '.....kGGGGGGGGk.....', '....kGGGgGGGGGGk....', '.....kGGGGGGGGk.....', '....kGGGGGGGGGGk....', '...kGGGGgGGGGGGGk...', '..kGGGGGGGGGGgGGGk..', '...kGGGGGGGGGGGGk...', '..kGGGGGGGgGGGGGGk..', '.kGGGGgGGGGGGGGGGGk.', 'kGGGGGGGGGGGGGgGGGGk', '.kkkkkkkkkkkkkkkkkk.', '.........kbk........', '.........kbk........', '.........kbk........', '........kkbkk.......'], { k: '#0a100c', G: '#1f4a2a', g: '#2f6a3a', b: '#3a2a18' });
  ART.oak = art([
    '.......kkkkkkkkk........', '.....kkGGGGGGGGGkk......', '...kkGGGGgGGGGGGGGkk....', '..kGGGGGGGGGGGGgGGGGk...', '.kGGgGGGGGGGGGGGGGGGGk..', 'kGGGGGGGGGgGGGGGGGGGGGk.', 'kGGGGGGGGGGGGGGGgGGGGGGk', 'kGgGGGGGGGGGGGGGGGGGGGGk',
    '.kGGGGGGGgGGGGGGGGGgGGk.', '.kGGGGGGGGGGGGGGGGGGGGk.', '..kGGGgGGGGGGGGgGGGGGk..', '...kkGGGGGGGGGGGGGGkk...', '.....kkGGGkbbbkGGkk.....', '.......kkkkbbbkkk.......', '..........kbbbk.........', '..........kbbbk.........', '..........kbbbk.........', '.........kkbbbkk........', '........kkkkkkkkk.......'
  ], { k: '#0e140e', G: '#3c6a2e', g: '#5a8a3a', b: '#4a3018' });
  ART.deadTree = art(['....k...k.k.', '....kb..kbk.', '.k..kb.kbk..', '.kbkkbbbk...', '..kbbbbk....', '...kbbk.....', '...kbbk.....', '...kbbk.....', '...kbbk.....', '..kkbbkk....', '.kkkkkkkk...'], { k: '#0e100e', b: '#3a3020' });
  ART.bush = art(['...kkkkk....', '..kGGGGGkk..', '.kGGgGGGGGk.', 'kGGGGGGgGGGk', 'kGgGGGGGGGGk', '.kGGGGgGGGk.', '..kkkkkkkk..'], { k: '#0e140e', G: '#3a6a2a', g: '#5a8a3a' });
  ART.grassTuft = art(['.k...k..', 'kgk.kgk.', 'kgkkkgkk', '.kgggggk', '..kkkkk.'], { k: '#1a2a12', g: '#4f8a3a' });
  ART.flower = art(['..kk..', '.kyyk.', 'kyryyk', '.kyyk.', '..kgk.', '..kgk.'], { k: '#1a2a12', y: '#e8d060', r: '#d04030', g: '#4f8a3a' });
  ART.flowerB = art(['..kk..', '.kbbk.', 'kbwbbk', '.kbbk.', '..kgk.', '..kgk.'], { k: '#1a2a12', b: '#7a6ad0', w: '#f0f0ff', g: '#4f8a3a' });
  ART.mushroom = art(['..kkkk..', '.krrrrk.', 'krwrrwrk', 'kkkkkkkk', '..kwwk..', '..kwwk..', '..kkkk..'], { k: K, r: '#c03a2a', w: '#f0e0d0' });
  ART.rock = art(['....kkkkk....', '..kkssssskk..', '.kssSSssssskk', 'ksSSSsssssssk', 'kssssssssssk.', '.kkssssssskk.', '...kkkkkkk...'], { k: '#1a1a1a', s: '#6a6a70', S: '#8a8a90' });
  ART.rockBig = art(['......kkkkkkk......', '....kkssssssskk....', '..kkssSSSsssssskk..', '.kssSSSSsssssssssk.', 'kssSSSsssssssssssk.', 'kssssssssssssssssk.', 'kssssssssssssssssk.', '.kssssssssssssssk..', '..kkkkkkkkkkkkkk...'], { k: '#1a1a1a', s: '#6a6a70', S: '#8a8a90' });
  ART.fence = art(['k......k......k.', 'kbk...kbk...kbk.', 'kbkkkkkbkkkkkbkk', 'kbbbbbbbbbbbbbbk', 'kbk...kbk...kbk.', 'kbk...kbk...kbk.', 'kbkkkkkbkkkkkbkk', 'kbbbbbbbbbbbbbbk', 'kbk...kbk...kbk.', 'kkk...kkk...kkk.'], { k: '#2a1c10', b: '#8a6a3a' });
  ART.well = art(['....kkkkkkkk....', '...kRRRRRRRRk...', '..kRRRRRRRRRRk..', '.kkkkkkkkkkkkkk.', '.kbk........kbk.', '.kbk..kkkk..kbk.', '.kbk.kssssk.kbk.', '.kbkkssssssk.bk.', 'kssssssssssssssk', 'kssSssssssssssk.', 'ksssssssSssssssk', 'kssssssssssssssk', '.kkkkkkkkkkkkkk.'], { k: '#1a1a1a', R: '#7a3a22', b: '#8a6a3a', s: '#7a7a80', S: '#9a9aa0' });
  ART.barrel = art(['.kkkkkkkk.', 'kbbbbbbbbk', 'kssssssssk', 'kbbbbbbbbk', 'kbbbbbbbbk', 'kssssssssk', 'kbbbbbbbbk', '.kkkkkkkk.'], { k: '#2a1c10', b: '#8a5a2a', s: '#5a5a60' });
  ART.crate = art(['kkkkkkkkkk', 'kbbbbbbbbk', 'kbkbbbbkbk', 'kbbkbbkbbk', 'kbbbkkbbbk', 'kbbkbbkbbk', 'kbkbbbbkbk', 'kbbbbbbbbk', 'kkkkkkkkkk'], { k: '#2a1c10', b: '#9a7a3a' });
  ART.signpost = art(['kkkkkkkkkkkk.', 'kbbbbbbbbbbbk', 'kbkkkbkkkkbbk', 'kbbbbbbbbbbbk', 'kkkkkkkkkkkk.', '.....kbk.....', '.....kbk.....', '.....kbk.....', '.....kbk.....', '.....kbk.....', '....kkkkk....'], { k: '#2a1c10', b: '#9a7a3a' });
  ART.anvil = art(['kkkkkkkkkkkk..', 'kssssssssssskk', 'kSSSSSSSSSSSSk', '.kkksssssskkk.', '....kssssk....', '....kssssk....', '...kssssssk...', '..kssssssssk..', '..kkkkkkkkkk..'], { k: '#151515', s: '#5a5a62', S: '#8a8a92' });
  ART.cauldron = art(['..k......k..', '...kkkkkk...', '..kgGGGGgk..', '.kkkkkkkkkk.', 'kssssssssssk', 'kssssssssssk', 'kssssssssssk', '.kssssssssk.', '..kkkkkkkk..', '.kk..kk..kk.'], { k: '#151515', s: '#3a3a42', g: '#4a9a4a', G: '#7ad07a' });
  ART.campfire = art(['................', '................', '.......y........', '.......y.yy.....', '.....y.y........', '.....yyyy...y...', '....yyyoo...y...', '....yyyoo..yyy..', '....ooooo..ooo..', '....oooooo.ooo..', '...ooRRRRRooooo.', '...RRRRRRRRRRRR.', '..kbRRRRRRRRbkR.', '.bbbbkbbbbkbbbb.', '...bbbbbbbbbb...', 'kkkkkkkkkkkkkkkk'], { y: '#ffe07a', o: '#ff9a2a', R: '#ff3a1a', b: '#4a3018', k: '#1a1410' });
  ANIM.campfire = [
    ['................', '................', '.......y........', '.......y.yy.....', '.....y.y........', '.....yyyy...y...', '....yyyoo...y...', '....yyyoo..yyy..', '....ooooo..ooo..', '....oooooo.ooo..', '...ooRRRRRooooo.', '...RRRRRRRRRRRR.', '..kbRRRRRRRRbkR.', '.bbbbkbbbbkbbbb.', '...bbbbbbbbbb...', 'kkkkkkkkkkkkkkkk'],
    ['................', '......y.........', '................', '................', '........y.y.....', '........y..y....', '.......yyy.y....', '....y..yyyyyy...', '....y..oooooo...', '...yyy.oooooo...', '...ooooooooooo..', '..ooooRRRRRRRR..', '..kbRRRRRRRRbk..', '.bbbbkbbbbkbbbb.', '...bbbbbbbbbb...', 'kkkkkkkkkkkkkkkk'],
    ['................', '............y...', '.......y........', '.......y........', '.......y........', '......yyy.......', '......ooo.y.....', '....y.ooo.y.....', '....y.oooyyy....', '...yyyoooooo....', '...ooRRRRRoo....', '..oooRRRRRRRR...', '..kbRRRRRRRRbk..', '.bbbbkbbbbkbbbb.', '...bbbbbbbbbb...', 'kkkkkkkkkkkkkkkk'],
    ['................', '........y...y...', '........y.......', '........y.y.....', '.......yyy......', '.......yyy......', '....y..ooo......', '....y..ooo......', '...yyyooooo.y...', '...ooooooooyyy..', '...oooRRRRRooo..', '..RRRRRRRRRoooo.', '..kbRRRRRRRRbkR.', '.bbbbkbbbbkbbbb.', '...bbbbbbbbbb...', 'kkkkkkkkkkkkkkkk']
  ].map(r => art(r, { y: '#ffe07a', o: '#ff9a2a', R: '#ff3a1a', b: '#4a3018', k: '#1a1410' }));
  ART.campfireOff = art(['..........', '..........', '..........', '..........', 'kk.kkkk.kk', 'bbkkggkkbb', '.kbbkkbbk.', 'kkbbbbbbkk', 'kkkkkkkkkk'], { g: '#3a3a3a', b: '#4a3018', k: '#1a1410' });
  ART.bed = art(['kkkkkkkkkkkkkkkkkk', 'kbbbbbbbbbbbbbbbbk', 'kbwwwwkrrrrrrrrrrk', 'kbwwwwkrrrrrrrrrrk', 'kbbbbbbbbbbbbbbbbk', 'kkkkkkkkkkkkkkkkkk', 'kbk............kbk', 'kkk............kkk'], { k: '#2a1c10', b: '#8a6a3a', w: '#e0d8c0', r: '#7a2a2a' });
  ART.table = art(['kkkkkkkkkkkkkk', 'kbbbbbbbbbbbbk', 'kkkkkkkkkkkkkk', '.kbk......kbk.', '.kbk......kbk.', '.kbk......kbk.', '.kkk......kkk.'], { k: '#2a1c10', b: '#9a7a3a' });
  ART.tent = art(['.........kk.........', '........kbbk........', '.......kbbbbk.......', '......kbbbbbbk......', '.....kbbbbbbbbk.....', '....kbbbkbbkbbbk....', '...kbbbbkddkbbbbk...', '..kbbbbbkddkbbbbbk..', '.kbbbbbbkddkbbbbbbk.', 'kbbbbbbbkddkbbbbbbbk', 'kkkkkkkkkkkkkkkkkkkk'], { k: '#1a1410', b: '#8a7a5a', d: '#2a2018' });
  ART.corpse = art(['..............kkkk', '.kkkkkkkkkkkkkSSSk', 'kbbbbbbbbbbbbkSSSk', 'kbbbbbbbbbbbbbkkk.', '.kkkkkkkkkkkkk....'], { k: K, b: '#4a3a5a', S: '#c0a080' });
  ART.web = art(['k......k', '.k.kk.k.', '..kkkk..', 'kkkkkkkk', '..kkkk..', '.k.kk.k.', 'k......k'], { k: '#c8c8d0' });
  ART.ore = art(['...kkkkk...', '.kkssYsskk.', 'kssssssYssk', 'ksYsssssssk', 'kssssYsssk.', '.kkssssskk.', '...kkkkk...'], { k: '#1a1a1a', s: '#5a5a60', Y: '#d0a040' });
  ART.oreEmpty = art(['...kkkkk...', '.kksssssk..', 'kssssssssk.', 'kssssssssk.', 'kssssssssk.', '.kksssskk..', '...kkkkk...'], { k: '#1a1a1a', s: '#4a4a50' });
  ART.support = art(['kbbbbbbbbbbbbk', 'kbbbbbbbbbbbbk', 'kbbk......kbbk', 'kbbk......kbbk', 'kbbk......kbbk', 'kbbk......kbbk', 'kbbk......kbbk', 'kbbk......kbbk', 'kbbk......kbbk', 'kbbk......kbbk', 'kbbk......kbbk', 'kbbk......kbbk'], { k: '#1a1410', b: '#6a4a2a' });
  ART.stump = art(['.kkkkkkkk.', 'kbBBBBBBbk', 'kbBbbbbBbk', 'kbBBBBBBbk', 'kbbbbbbbbk', 'kbbbbbbbbk', '.kkkkkkkk.'], { k: '#2a1c10', b: '#6a4a2a', B: '#b09060' });
  ART.lantern = art(['..kk..', '.kbbk.', 'kkkkkk', 'kyyyyk', 'kyYYyk', 'kyyyyk', 'kkkkkk', '..kk..'], { k: '#2a2a2a', b: '#5a5a5a', y: '#f0c040', Y: '#fff0a0' });
  ART.grave = art(['...kkkk...', '..kssssk..', '.kssssssk.', '.kskssksk.', '.kssssssk.', '.kssssssk.', '.kssssssk.', '.kssssssk.', 'kkkkkkkkkk'], { k: K, s: '#7a7a80' });
  ART.bones = art(['kk..kkkk..kk', 'kwkkwwwwkkwk', '.kwwwwwwwwk.', '..kkwwwwkk..', '....kkkk....'], { k: K, w: '#c9c2af' });
  ART.torch = art(['..yy..', '.yooy.', '.yRRy.', '..oo..', '..bb..', '..bb..', '..bb..', '..bb..'], { y: '#ffe07a', o: '#ff9a2a', R: '#ff3a1a', b: '#4a3018' });
  ART.chest = art(['.kkkkkkkkkkkkkk.', 'kBBBBBBBBBBBBBBk', 'kBsBBBBBBBBBBsBk', 'kBsBBBBBBBBBBsBk', 'kkkkkkkkkkkkkkkk', 'kBsBBBBBygBBBBsk', 'kBsBBBBBygBBBBsk', 'kBsBBBBBBBBBBBsk', 'kBsBBBBBBBBBBBsk', 'kBBBBBBBBBBBBBBk', '.kkkkkkkkkkkkkk.'], { k: K, B: '#7a4a22', s: '#8a8a90', y: '#d9a53c', g: '#a07020' });
  ART.chestOpen = art(['.kkkkkkkkkkkkkk.', 'kBBBBBBBBBBBBBBk', 'kBBBBBBBBBBBBBBk', 'kkkkkkkkkkkkkkkk', 'kkddddddddddddkk', 'kBsBBBBBBBBBBBsk', 'kBsBBBBBBBBBBBsk', 'kBsBBBBBBBBBBBsk', 'kBBBBBBBBBBBBBBk', '.kkkkkkkkkkkkkk.'], { k: K, B: '#7a4a22', s: '#8a8a90', d: '#221812' });
  ART.potion = art(['..kkkk..', '..kwwk..', '...kk...', '..kRRk..', '.kRRRRk.', 'kRRRRRRk', 'kRRRRRRk', 'kRRRRRRk', '.kRRRRk.', '..kkkk..'], { k: K, w: '#d9d2bf', R: '#c83a3a' });
  ART.potionB = art(['..kkkk..', '..kwwk..', '...kk...', '..kBBk..', '.kBBBBk.', 'kBBBBBBk', 'kBBBBBBk', 'kBBBBBBk', '.kBBBBk.', '..kkkk..'], { k: K, w: '#d9d2bf', B: '#3a6ac8' });
  ART.potionG = art(['..kkkk..', '..kwwk..', '...kk...', '..kGGk..', '.kGGGGk.', 'kGGGGGGk', 'kGGGGGGk', 'kGGGGGGk', '.kGGGGk.', '..kkkk..'], { k: K, w: '#d9d2bf', G: '#4ac86a' });
  ART.sword = art(['..........kk', '.........kWk', '........kWk.', '.......kWk..', '......kWk...', '..k..kWk....', '.kykkWk.....', '..kyyk......', '.kbkyyk.....', 'kbk..kk.....', 'kk..........'], { k: K, W: '#c8ccd4', y: '#d9a53c', b: '#5a3a20' });
  ART.dagger = art(['......kk', '.....kWk', '....kWk.', '...kWk..', '.kykWk..', '..kyk...', '.kbkyk..', 'kbk.kk..', 'kk......'], { k: K, W: '#c8ccd4', y: '#d9a53c', b: '#5a3a20' });
  ART.axe = art(['....kkkk', '...kMMMMk', '..kMMMMMk', '.kMMkMMMk', 'kbkkkMMk.', 'kbk.kMMk.', 'kbk..kk..', 'kbk......', 'kkk......'], { k: K, M: '#9aa0a8', b: '#5a3a20' });
  ART.mace = art(['.....kkk', '....kMMMk', '....kMMMk', '.....kkk.', '....kbk..', '...kbk...', '..kbk....', '.kbk.....', 'kbk......', 'kk.......'], { k: K, M: '#8a8a92', b: '#5a3a20' });
  ART.spear = art(['.........kk', '........kWk', '.......kWk.', '......kbk..', '.....kbk...', '....kbk....', '...kbk.....', '..kbk......', '.kbk.......', 'kbk........', 'kk.........'], { k: K, W: '#c8ccd4', b: '#7a5a30' });
  ART.pick = art(['..kkkkkkkk.', '.kMMMMMMMMk', 'kMkkkbkkkMk', 'kk..kbk..kk', '....kbk....', '....kbk....', '....kbk....', '....kbk....', '....kkk....'], { k: K, M: '#9aa0a8', b: '#7a5a30' });
  ART.key = art(['kkkk......', 'kyykkkkkkk', 'kyykyyyyyk', 'kyykkkykyk', 'kkkk..k.kk'], { k: K, y: '#d9a53c' });
  ART.herb = art(['...kk...', '..kggk..', '.kgggkk.', 'kggkggGk', 'kggkgggk', '.kkkgkk.', '...kbk..', '...kbk..'], { k: '#0e140e', g: '#6ab04c', G: '#c8e070', b: '#4a3018' });
  ART.moonflower = art(['..kkkk..', '.kbwwbk.', 'kbwWWwbk', 'kbwWWwbk', '.kbwwbk.', '..kkkk..', '...kgk..', '...kgk..'], { k: '#101020', b: '#6a6ad0', w: '#c0c0ff', W: '#ffffff', g: '#4f8a3a' });
  ART.gold = art(['.kkkkkk.', 'kyyyyyyk', 'kyyyyyyk', '.kkkkkk.', 'kyyyyyyk', 'kyyyyyyk', '.kkkkkk.'], { k: K, y: '#d9a53c' });
  ART.fireball = art(['..yy..', '.yooy.', 'yoRRoy', 'yoRRoy', '.yooy.', '..yy..'], { y: '#ffe07a', o: '#ff9a2a', R: '#ff3a1a' });
  ART.iceball = art(['..ww..', '.wbbw.', 'wbBBbw', 'wbBBbw', '.wbbw.', '..ww..'], { w: '#e0f4ff', b: '#7ab8ff', B: '#3a70e0' });
  ART.shield = art(['kkkkkkkkkk', 'kssssssssk', 'kssrrrrssk', 'kssrrrrssk', 'kssssssssk', '.kssssssk.', '..kssssk..', '...kssk...', '....kk....'], { k: K, s: '#8a8a90', r: '#a83232' });
  ART.shieldWood = art(['kkkkkkkkkk', 'kbbbbbbbbk', 'kbbkssbbbk', 'kbbkssbbbk', 'kbbbbbbbbk', '.kbbbbbbk.', '..kbbbbk..', '...kbbk...', '....kk....'], { k: K, b: '#8a6a3a', s: '#8a8a90' });
  ART.armor = art(['.kk....kk.', 'kaakkkkaak', 'kaaaaaaaak', 'kaaaaaaaak', '.kaaaaaak.', '.kaaaaaak.', '.kaaaaaak.', '.kkkkkkkk.'], { k: K, a: '#9aa0a8' });
  ART.armorL = art(['.kk....kk.', 'kaakkkkaak', 'kaaaaaaaak', 'kaakaakaak', '.kaaaaaak.', '.kaaaaaak.', '.kaaaaaak.', '.kkkkkkkk.'], { k: K, a: '#8a5a30' });
  ART.helmet = art(['..kkkkkk..', '.kMMMMMMk.', 'kMMMMMMMMk', 'kMMMMMMMMk', 'kMkkkkkkMk', 'kMk....kMk', 'kkk....kkk'], { k: K, M: '#9aa0a8' });
  ART.amulet = art(['..kkkk..', '.ky..yk.', 'ky....yk', 'ky....yk', '.kykkyk.', '..kggk..', '..kggk..', '...kk...'], { k: K, y: '#d9a53c', g: '#7df0a0' });
  ART.pelt = art(['.kkkkkk.', 'kGGGGGGk', 'kGGGGGGk', 'kGGGGGGk', '.kGGGGk.', '..kkkk..'], { k: K, G: '#6f6a66' });
  ART.meat = art(['..kkkk..', '.kRRRRk.', 'kRRwRRRk', 'kRRRRRRk', '.kRRRRk.', '..kkkk..'], { k: K, R: '#b03a3a', w: '#e0c0c0' });
  ART.meatCooked = art(['..kkkk..', '.kBBBBk.', 'kBBwBBBk', 'kBBBBBBk', '.kBBBBk.', '..kkkk..'], { k: K, B: '#8a4a2a', w: '#d0b090' });
  ART.bread = art(['..kkkkkk..', '.kbbbbbbk.', 'kbbBbbBbbk', 'kbbbbbbbbk', '.kkkkkkkk.'], { k: K, b: '#c08a40', B: '#e0b060' });
  ART.wood = art(['kkkkkkkkkk', 'kbbbbbbbbk', 'kkkkkkkkkk', '.kbbbbbbbk', '.kkkkkkkkk'], { k: '#2a1c10', b: '#8a6a3a' });
  ART.oreItem = art(['..kkkk..', '.kssYsk.', 'kssssssk', 'kYssssYk', '.kssYsk.', '..kkkk..'], { k: '#1a1a1a', s: '#5a5a60', Y: '#d0a040' });
  ART.letter = art(['kkkkkkkkkk', 'kwwwwwwwwk', 'kwkwwwwkwk', 'kwwkwwkwwk', 'kwwwkkwwwk', 'kwwwwwwwwk', 'kkkkkkkkkk'], { k: K, w: '#e8e0c8' });
  ART.locket = art(['..kkkk..', '.kyyyyk.', 'kyyPPyyk', 'kyyPPyyk', '.kyyyyk.', '..kkkk..'], { k: K, y: '#d9a53c', P: '#8a4a8a' });
  ART.bandage = art(['.kkkkkk.', 'kwwwwwwk', 'kwkkkkwk', 'kwwwwwwk', '.kkkkkk.'], { k: K, w: '#e8e0d0' });
  ART.hitFx = art(['..w..w..', '.w.ww.w.', '..wwww..', 'wwwWWwww', '..wwww..', '.w.ww.w.', '..w..w..'], { w: '#ffe0a0', W: '#ffffff' });
  ART.bloodFx = art(['..r..r..', '.r.rr.r.', '..rrrr..', 'rrrRRrrr', '..rrrr..', '.r.rr.r.', '..r..r..'], { r: '#a02020', R: '#e04040' });

  ART.furnace = art(['..kkkkkkkkkk..', '.kssssssssssk.', 'kssssssssssssk', 'kssskkkkkksssk', 'ksskoRRRRoksk.', 'ksskRRyyRRksk.', 'ksskoRRRRoksk.', 'kssskkkkkksssk', 'kssssssssssssk', 'kssssssssssssk', 'kkkkkkkkkkkkkk'], { k: '#151515', s: '#5a5a62', o: '#ff9a2a', R: '#ff3a1a', y: '#ffe07a' });
  ART.furnaceOff = art(['..kkkkkkkkkk..', '.kssssssssssk.', 'kssssssssssssk', 'kssskkkkkksssk', 'ksskddddddksk.', 'ksskddddddksk.', 'ksskddddddksk.', 'kssskkkkkksssk', 'kssssssssssssk', 'kssssssssssssk', 'kkkkkkkkkkkkkk'], { k: '#151515', s: '#5a5a62', d: '#221812' });
  ART.altar = art(['....kkkkkk....', '...kssPPssk...', '..kssPggPssk..', '.kssssPPssssk.', 'kssssssssssssk', 'kkkkkkkkkkkkkk', '..kssssssssk..', '..kssssssssk..', '..kssssssssk..', '.kssssssssssk.', 'kkkkkkkkkkkkkk'], { k: '#151515', s: '#7a7a80', P: '#6a3a8a', g: '#7df0a0' });
  ART.gemVein = art(['...kkkkk...', '.kkssBsskk.', 'kssBsBssBsk', 'ksssBBBsssk', 'kssBsBsBsk.', '.kkssBsskk.', '...kkkkk...'], { k: '#1a1a1a', s: '#5a5a60', B: '#6ad0ff' });
  ART.treeStump = art(['..kkkkkkkkkk..', '.kbBBBBBBBBbk.', '.kbBbbbbbbBbk.', '.kbBBBBBBBBbk.', '.kbbbbbbbbbbk.', 'kkbbbbbbbbbbkk', 'kbbbbbbbbbbbbk', '.kkkkkkkkkkkk.'], { k: '#2a1c10', b: '#6a4a2a', B: '#b09060' });
  ART.book = art(['kkkkkkkkkk', 'kRRRRRRRRk', 'kRRyyyyRRk', 'kRRRRRRRRk', 'kRRRRRRRRk', 'kwwwwwwwwk', 'kkkkkkkkkk'], { k: K, R: '#7a2a2a', y: '#d9a53c', w: '#e8e0c8' });
  ART.note = art(['kkkkkkkk', 'kwwwwwwk', 'kwkkkwwk', 'kwwwwwwk', 'kwkkkkwk', 'kwwwwwwk', 'kwkkwwwk', 'kkkkkkkk'], { k: K, w: '#e8e0c8' });
  ART.flask = art(['..kkkk..', '..kwwk..', '..kwwk..', '.kkwwkk.', 'kbbbbbbk', 'kbbwbbbk', 'kbbbbbbk', '.kkkkkk.'], { k: K, w: '#d9d2bf', b: '#5a3a20' });
  ART.flaskFull = art(['..kkkk..', '..kwwk..', '..kBBk..', '.kkBBkk.', 'kBBBBBBk', 'kBBwBBBk', 'kBBBBBBk', '.kkkkkk.'], { k: K, w: '#d9d2bf', B: '#3a6ac8' });
  ART.cloak = art(['..kkkkkk..', '.kFFFFFFk.', 'kFFFFFFFFk', 'kFFFFFFFFk', 'kFFkFFkFFk', 'kFFFFFFFFk', 'kFFFFFFFFk', '.kkkkkkkk.'], { k: K, F: '#8a6a4a' });
  ART.furCoat = art(['..kkkkkk..', '.kwFFFFwk.', 'kwFFFFFFwk', 'kFFFFFFFFk', 'kFFkFFkFFk', 'kFFFFFFFFk', 'kwwFFFFwwk', '.kkkkkkkk.'], { k: K, F: '#6f6a66', w: '#d9d2bf' });
  ART.shovel = art(['.......kk', '......kbk', '.....kbk.', '....kbk..', '...kbk...', '..kbk....', '.kMMk....', 'kMMMMk...', 'kMMMMk...', '.kkkk....'], { k: K, M: '#9aa0a8', b: '#7a5a30' });
  ART.hammer = art(['kkkkkkk..', 'kMMMMMMk.', 'kMMMMMMk.', 'kkkkbkkk.', '....kbk..', '....kbk..', '....kbk..', '....kbk..', '....kkk..'], { k: K, M: '#9aa0a8', b: '#7a5a30' });
  ART.lockpick = art(['kkk.....', 'kwwk....', '.kwwk...', '..kwwkkk', '...kwwwk', '....kkkk'], { k: K, w: '#c8ccd4' });
  ART.ingot = art(['.kkkkkkkk.', 'kMMMMMMMMk', 'kMMWWWMMMk', 'kMMMMMMMMk', '.kkkkkkkk.'], { k: K, M: '#9aa0a8', W: '#c8ccd4' });
  ART.gemRed = art(['..kkkk..', '.kRrrRk.', 'kRrwwrRk', 'kRrrrrRk', '.kRrrRk.', '..kRRk..', '...kk...'], { k: K, R: '#8a1a2a', r: '#e04050', w: '#ffd0d8' });
  ART.gemBlue = art(['..kkkk..', '.kBbbBk.', 'kBbwwbBk', 'kBbbbbBk', '.kBbbBk.', '..kBBk..', '...kk...'], { k: K, B: '#1a3a8a', b: '#4a90e0', w: '#d0e8ff' });
  ART.gemPurple = art(['..kkkk..', '.kPppPk.', 'kPpwwpPk', 'kPppppPk', '.kPppPk.', '..kPPk..', '...kk...'], { k: K, P: '#4a1a6a', p: '#a050e0', w: '#f0d8ff' });
  ART.runeFire = art(['kkkkkkkk', 'kssssssk', 'kssRsssk', 'ksRRRssk', 'kssRRssk', 'ksRsRssk', 'kssssssk', 'kkkkkkkk'], { k: K, s: '#5a5a62', R: '#ff6a2a' });
  ART.runeFrost = art(['kkkkkkkk', 'kssssssk', 'ksBsBssk', 'kssBBssk', 'ksBBBBsk', 'kssBsssk', 'kssssssk', 'kkkkkkkk'], { k: K, s: '#5a5a62', B: '#7ab8ff' });
  ART.runeLife = art(['kkkkkkkk', 'kssssssk', 'ksssGssk', 'kssGGGsk', 'ksssGssk', 'ksssGssk', 'kssssssk', 'kkkkkkkk'], { k: K, s: '#5a5a62', G: '#7df0a0' });
  ART.runeAsh = art(['kkkkkkkk', 'kssssssk', 'ksAssAsk', 'kssAAssk', 'kssAAssk', 'ksAssAsk', 'kssssssk', 'kkkkkkkk'], { k: K, s: '#5a5a62', A: '#d9a53c' });
  ART.treasureMap = art(['kkkkkkkkkkkk', 'kwwwwwwwwwwk', 'kwwbbwwwwwwk', 'kwwwwbbwwwwk', 'kwwwwwwbbRwk', 'kwwwwwwwwwwk', 'kkkkkkkkkkkk'], { k: K, w: '#e8d8a8', b: '#8a6a4a', R: '#c03a2a' });
  ART.lockedChest = art(['.kkkkkkkkkkkkkk.', 'kBBBBBBBBBBBBBBk', 'kBsBBBBBBBBBBsBk', 'kBsBBBBBBBBBBsBk', 'kkkkkkkkkkkkkkkk', 'kBsBBBBkkkBBBBsk', 'kBsBBBkyyykBBBsk', 'kBsBBBkykykBBBsk', 'kBsBBBkkkkkBBBsk', 'kBBBBBBBBBBBBBBk', '.kkkkkkkkkkkkkk.'], { k: K, B: '#5a3a22', s: '#8a8a90', y: '#d9a53c' });
  ART.spark = art(['.y.', 'yYy', '.y.'], { y: '#ffb040', Y: '#ffffff' });
  ART.drop = art(['.b.', 'bBb', '.b.'], { b: '#4a90e0', B: '#d0e8ff' });
  ART.firefly = art(['.g.', 'gGg', '.g.'], { g: '#c8e070', G: '#ffffb0' });
  ART.dirtPile = art(['....kkkk....', '..kkbbbbkk..', '.kbbbbbbbbk.', 'kbbbbbbbbbbk', 'kkkkkkkkkkkk'], { k: '#2a1c10', b: '#6a4a2a' });
  ART.doorOpen = art(['kkkkkkkkkk', 'kbbkddddkk', 'kbbkddddkk', 'kbbkddddkk', 'kbbkddddkk', 'kbbkddddkk', 'kbbkddddkk', 'kbbkddddkk', 'kkkkkkkkkk'], { k: '#2a1c10', b: '#8a6a3a', d: '#0a0808' });

  ART.glow = (() => { const c = canvas(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,150,50,0.55)'); g.addColorStop(0.5, 'rgba(255,110,30,0.18)'); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; })();
  const SPR = {};
  for (const k in ART) SPR[k] = spriteTex(ART[k]);
  const SPRA = {};
  for (const k in ANIM) SPRA[k] = ANIM[k].map(c => spriteTex(withShadow(c)));
  SPRA.campfire = ANIM.campfire.map(spriteTex);
  for (const k of ['chest', 'chestOpen', 'lockedChest', 'barrel', 'crate', 'well', 'anvil', 'cauldron', 'furnace', 'furnaceOff', 'altar', 'table', 'bed', 'tent', 'stump', 'treeStump', 'rock', 'rockBig', 'signpost', 'grave']) SPR[k] = spriteTex(withShadow(ART[k]));

  // ---- Вьюмодели оружия (HUD) ----
  const VIEW = {};
  VIEW.sword = art(['..................kk', '.................kWWk', '................kWWk.', '...............kWWk..', '..............kWWk...', '.............kWWk....', '............kWWk.....', '...........kWWk......', '..........kWWk.......', '.........kWWk........', '....k...kWWk.........', '...kyk.kWWk..........', '...kyykWWk...........', '....kyyyk............', '...kbkyyyk...........', '..kbk.kyyk...........', '.kbk...kk............', 'kbk..................', 'kk...................'], { k: K, W: '#c8ccd4', y: '#d9a53c', b: '#5a3a20' });
  VIEW.dagger = art(['..........kk', '.........kWk', '........kWWk', '.......kWWk.', '......kWWk..', '.....kWWk...', '..k.kWWk....', '.kykWWk.....', '..kyyk......', '.kbkyk......', 'kbk.kk......', 'kk..........'], { k: K, W: '#c8ccd4', y: '#d9a53c', b: '#5a3a20' });
  VIEW.axe = art(['.............kkkkk', '...........kkMMMMMk', '..........kMMMMMMMk', '.........kMMMMMMMk.', '........kMMkkMMMMk.', '.......kbkkkkMMMk..', '......kbk..kMMMk...', '.....kbk...kkkk....', '....kbk............', '...kbk.............', '..kbk..............', '.kbk...............', 'kbk................', 'kk.................'], { k: K, M: '#9aa0a8', b: '#5a3a20' });
  VIEW.mace = art(['............kkkk', '...........kMMMMk', '..........kMMkMMMk', '..........kMMMMMMk', '..........kMkMMMMk', '...........kMMMMk', '..........kbkkkk', '.........kbk....', '........kbk.....', '.......kbk......', '......kbk.......', '.....kbk........', '....kbk.........', '...kbk..........', '..kbk...........', '.kbk............', 'kbk.............', 'kk..............'], { k: K, M: '#8a8a92', b: '#5a3a20' });
  VIEW.spear = art(['...................kk', '..................kWWk', '.................kWWk.', '................kWWk..', '...............kWWk...', '..............kbbk....', '.............kbbk.....', '............kbbk......', '...........kbbk.......', '..........kbbk........', '.........kbbk.........', '........kbbk..........', '.......kbbk...........', '......kbbk............', '.....kbbk.............', '....kbbk..............', '...kbbk...............', '..kbbk................', '.kbbk.................', 'kbbk..................', 'kkk...................'], { k: K, W: '#c8ccd4', b: '#7a5a30' });
  VIEW.pick = art(['..........kkkkkkkkkk', '.........kMMMMMMMMMMk', '........kMMkkkkbkkMMk', '.......kMk....kbk.kk.', '......kbk....kbk.....', '.....kbk.....kk......', '....kbk..............', '...kbk...............', '..kbk................', '.kbk.................', 'kbk..................', 'kk...................'], { k: K, M: '#9aa0a8', b: '#7a5a30' });
  VIEW.shovel = art(['...............kkkk', '..............kMMMMk', '.............kMMMMMk', '............kMMMMMk.', '...........kkMMMMk..', '..........kbkkkkk...', '.........kbk........', '........kbk.........', '.......kbk..........', '......kbk...........', '.....kbk............', '....kbk.............', '...kbk..............', '..kbk...............', '.kbk................', 'kbk.................', 'kk..................'], { k: K, M: '#9aa0a8', b: '#7a5a30' });
  VIEW.hand = art(['....kkkk....', '...kSSSSk...', '..kSSSSSSk..', '.kSSSSSSSSk.', '.kSSSSSSSSk.', '.kSSSSSSSSk.', '.kSSSSSSSSk.', '.kSSSSSSSSk.', '.kSSSSSSSSk.'], { k: K, S: '#e0b48c' });
  VIEW.shield = art(['kkkkkkkkkkkkkkkk', 'kbbbbbbbbbbbbbbk', 'kbbbbbkssskbbbbk', 'kbbbbbkssskbbbbk', 'kbbbbbbbbbbbbbbk', 'kbbbbbbbbbbbbbbk', '.kbbbbbbbbbbbbk.', '.kbbbbbbbbbbbbk.', '..kbbbbbbbbbbk..', '...kbbbbbbbbk...', '....kbbbbbbk....', '.....kbbbbk.....', '......kkkk......'], { k: K, b: '#8a6a3a', s: '#8a8a90' });
  VIEW.shieldIron = art(['kkkkkkkkkkkkkkkk', 'kssssssssssssssk', 'ksssssskrrkssssk', 'kssssskrrrrkssss', 'ksssssskrrkssssk', 'kssssssssssssssk', '.kssssssssssssk.', '.kssssssssssssk.', '..kssssssssssk..', '...kssssssssk...', '....kssssssk....', '.....kssssk.....', '......kkkk......'], { k: K, s: '#8a8a90', r: '#a83232' });

  return { T, ART, ANIM, SPR, SPRA, VIEW, rnd, art, spriteTex, human, withShadow };
})();
