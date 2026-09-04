// ---------- Рельеф открытых локаций: высотная карта, плато под зданиями, долины у воды, склоны по краю ----------
'use strict';
const Terrain = (() => {
  const S = 2; // сэмплов высоты на клетку
  const BUILD = new Set(['H', 'C', 'W', 'D']);
  let cur = null; // { W, H, hg, hc, border, base }
  // value-noise по координатам клеток
  const vnoise = (x, z, seed) => { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz); const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed), c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed); const t = a + (b - a) * sx, u = c + (d - c) * sx; return t + (u - t) * sz; };
  const fbm = (x, z, seed) => vnoise(x, z, seed) * 0.6 + vnoise(x * 2.1 + 7, z * 2.1 + 3, seed + 1) * 0.28 + vnoise(x * 4.3 + 1, z * 4.3 + 9, seed + 2) * 0.12;

  function build(def, map) {
    if (!def.outdoor) { cur = null; return; }
    const H = map.length, W = map[0].length, N = W * H, amp = def.relief || (def.kind === 'forest' ? 3.0 : 2.3), seed = def.seed || (def.kind === 'forest' ? 31 : 17), wl = def.kind === 'forest' ? 6.5 : 8;
    const at = (x, z) => cellAt(map, x, z);
    // 1. базовый шум по клеткам
    const noise = new Float32Array(N); for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) noise[z * W + x] = (fbm(x / wl, z / wl, seed) - 0.5) * 2 * amp;
    // 2. скалы по краю карты: только те '#', что соединены с краем (заливка)
    const border = new Uint8Array(N); { const q = []; const push = (x, z) => { if (x < 0 || z < 0 || x >= W || z >= H) return; const i = z * W + x; if (border[i] || at(x, z) !== '#') return; border[i] = 1; q.push(i); }; for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); } for (let z = 0; z < H; z++) { push(0, z); push(W - 1, z); } while (q.length) { const i = q.pop(), x = i % W, z = (i / W) | 0; push(x + 1, z); push(x - 1, z); push(x, z + 1); push(x, z - 1); } }
    // 3. плато под зданиями: средняя высота связной компоненты
    const w = new Float32Array(N), t = new Float32Array(N), seen = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const x = i % W, z = (i / W) | 0; if (seen[i] || !BUILD.has(at(x, z))) continue; const comp = [], q = [i]; seen[i] = 1; while (q.length) { const j = q.pop(); comp.push(j); const jx = j % W, jz = (j / W) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = jx + dx, nz = jz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const k = nz * W + nx; if (!seen[k] && BUILD.has(at(nx, nz))) { seen[k] = 1; q.push(k); } } } let m = 0; for (const j of comp) m += noise[j]; m /= comp.length; for (const j of comp) { w[j] = 1; t[j] = m; } }
    // 4. вода: русло ниже, берега плавные
    for (let i = 0; i < N; i++) { const x = i % W, z = (i / W) | 0; if (at(x, z) === 'w') { w[i] = 1; t[i] = -2.3; } } // русло глубокое: у берега брод, на середине плывём
    for (let i = 0; i < N; i++) { const x = i % W, z = (i / W) | 0; if (w[i] || at(x, z) === 'w') continue; let nearW = false; for (let dz = -1; dz <= 1 && !nearW; dz++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, z + dz) === 'w') { nearW = true; break; } if (nearW) { w[i] = 0.7; t[i] = -0.75; } }
    // 5. ворота и подходы к ним — ровные, чтобы проход через край остался проходимым
    for (let i = 0; i < N; i++) { const x = i % W, z = (i / W) | 0; if (at(x, z) === 'G') { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const k = nz * W + nx; if (!BUILD.has(at(nx, nz))) { w[k] = Math.max(w[k], 0.8); t[k] = noise[i]; } } } }
    // 6. подъём у края (в клетках до границы): скалы вокруг долины; у ворот — нет
    const rise = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = i % W, z = (i / W) | 0; if (!border[i]) continue; const d = Math.min(x, z, W - 1 - x, H - 1 - z); rise[i] = d === 0 ? 10 : d === 1 ? 6 : d === 2 ? 3 : 1.2; }
    for (let i = 0; i < N; i++) { const x = i % W, z = (i / W) | 0; if (at(x, z) === 'G') { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if (nx >= 0 && nz >= 0 && nx < W && nz < H && !border[nz * W + nx]) rise[nz * W + nx] = 0; } } }
    // 7. высота клетки, затем сглаживание 3×3 весов (юбка вокруг плато) — сама высота клетки без размытия, чтобы скалы были крутыми
    const hc = new Float32Array(N), wb = new Float32Array(N), tb = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = i % W, z = (i / W) | 0; let sw = 0, st = 0, n = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const k = nz * W + nx, kk = (dx === 0 && dz === 0) ? 2 : 1; sw += w[k] * kk; st += t[k] * w[k] * kk; n += kk; } wb[i] = Math.max(w[i], sw / n); tb[i] = w[i] ? t[i] : (sw > 0 ? st / sw : 0); }
    for (let i = 0; i < N; i++) hc[i] = noise[i] * (1 - wb[i]) + tb[i] * wb[i] + rise[i];
    // 8. сетка сэмплов: билинейно по центрам клеток + мелкая рябь там, где нет плато
    const SW = W * S + 1, SH = H * S + 1, hg = new Float32Array(SW * SH);
    const cellH = (x, z) => hc[Math.min(H - 1, Math.max(0, z)) * W + Math.min(W - 1, Math.max(0, x))];
    const cellW = (x, z) => wb[Math.min(H - 1, Math.max(0, z)) * W + Math.min(W - 1, Math.max(0, x))];
    for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
      const cx = i / S - 0.5, cz = j / S - 0.5, x0 = Math.floor(cx), z0 = Math.floor(cz), fx = cx - x0, fz = cz - z0;
      const lerp = f => { const a = f(x0, z0), b = f(x0 + 1, z0), c = f(x0, z0 + 1), d = f(x0 + 1, z0 + 1); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz; };
      const h = lerp(cellH), ww = lerp(cellW); hg[j * SW + i] = h + (vnoise(i * 0.9, j * 0.9, seed + 5) - 0.5) * 0.35 * (1 - ww);
    }
    // плато: у зданий все сэмплы внутри клетки строго на высоте плато (стены и пол должны совпасть)
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { if (w[z * W + x] < 1) continue; for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) hg[(z * S + j) * SW + x * S + i] = t[z * W + x]; }
    cur = { W, H, hg, hc, border, SW, SH };
  }
  // высота по мировым координатам (билинейно по сетке сэмплов)
  function h(x, z) {
    if (!cur) return 0; const sx = x / CS * S, sz = z / CS * S, i0 = Math.max(0, Math.min(cur.SW - 2, Math.floor(sx))), j0 = Math.max(0, Math.min(cur.SH - 2, Math.floor(sz))), fx = Math.max(0, Math.min(1, sx - i0)), fz = Math.max(0, Math.min(1, sz - j0));
    const g = cur.hg, SW = cur.SW, a = g[j0 * SW + i0], b = g[j0 * SW + i0 + 1], c = g[(j0 + 1) * SW + i0], d = g[(j0 + 1) * SW + i0 + 1];
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
  }
  const sample = (i, j) => cur ? cur.hg[Math.max(0, Math.min(cur.SH - 1, j)) * cur.SW + Math.max(0, Math.min(cur.SW - 1, i))] : 0; // высота сэмпла сетки
  const base = (x, z) => cur ? cur.hc[Math.max(0, Math.min(cur.H - 1, z)) * cur.W + Math.max(0, Math.min(cur.W - 1, x))] : 0; // высота плато/клетки
  const isBorder = (x, z) => !!(cur && x >= 0 && z >= 0 && x < cur.W && z < cur.H && cur.border[z * cur.W + x]);
  // минимум высоты по углам клетки (для фундамента стен)
  const cellMin = (x, z) => { if (!cur) return 0; let m = Infinity; for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) m = Math.min(m, sample(x * S + i, z * S + j)); return m; };
  const WATER_Y = -0.4; // уровень воды в реке (русло вырезано до -1.4)
  return { S, build, h, sample, base, isBorder, cellMin, waterY: WATER_Y, get active() { return !!cur; } };
})();
