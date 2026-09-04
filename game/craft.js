// ---------- Ремесло и мини-игры (v0.3) ----------
'use strict';

// ================= МИНИ-ИГРЫ =================
const Mini = {
  active: null, raf: null,
  start(spec) {
    this.stop(); this.active = spec; spec.t = 0; spec.last = performance.now(); spec.wasCraft = $('craft').classList.contains('show'); if (spec.wasCraft) $('craft').classList.remove('show');
    $('miniTitle').textContent = spec.title; $('miniHint').textContent = spec.hint || 'Тапни по полю в нужный момент';
    UI.show('mini'); const c = $('minic'); c.width = 600 * 2; c.height = 240 * 2; c.getContext('2d').imageSmoothingEnabled = false;
    const loop = now => { if (this.active !== spec) return; const dt = Math.min(0.1, (now - spec.last) / 1000); spec.last = now; spec.t += dt; if (spec.update) spec.update(dt); const x = c.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, 600, 240); spec.draw(x, 600, 240); if (spec.finished) { this.finish(spec); return; } this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },
  tap() { if (this.active && this.active.tap && !this.active.finished) this.active.tap(); },
  finish(spec) { this.active = null; setTimeout(() => { UI.hide('mini'); if (spec.wasCraft && G && !P.dead) UI.show('craft'); if (spec.done) spec.done(); }, spec.finished === 'instant' ? 0 : 700); },
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.active = null; },
  // Отмена крестиком: считается провалом (материалы уже потрачены)
  cancel() { const spec = this.active; if (!spec) { UI.hide('mini'); return; } spec.cancelled = true; if (spec.res === null || spec.res === undefined) spec.res = spec.title === 'Плавильня' || spec.title === 'Котёл' || spec.title === 'Ковка' ? 0 : false; spec.finished = 'instant'; log('Ты бросил на середине. Материалы — тоже. Они не вернутся.', 'red'); },
  // общие рисовалки
  bar(x, w, h, y, zone, marker, label) {
    x.fillStyle = '#2a1a14'; x.fillRect(40, y, w - 80, 26); x.fillStyle = 'rgba(92,154,60,.55)'; x.fillRect(40 + zone[0] * (w - 80), y, (zone[1] - zone[0]) * (w - 80), 26);
    x.strokeStyle = '#5a4a3a'; x.strokeRect(40.5, y + 0.5, w - 81, 25);
    x.fillStyle = '#ffd060'; x.fillRect(40 + marker * (w - 80) - 3, y - 6, 6, 38);
    if (label) { x.fillStyle = '#e7dcc3'; x.font = 'bold 14px "Courier New", monospace'; x.textAlign = 'center'; x.fillText(label, w / 2, y - 16); }
  },
  banner(x, w, text, col, y) { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(w / 2 - 200, (y || 130) - 22, 400, 32); x.fillStyle = col || '#d9a53c'; x.font = 'bold 22px "Courier New", monospace'; x.textAlign = 'center'; x.fillText(text, w / 2, y || 130); },
  pingpong(t, period) { const p = (t % period) / period; return p < 0.5 ? p * 2 : 2 - p * 2; },

  // ---- общие сцены ----
  txt(x, t, cx, cy, col, size) { x.fillStyle = col || '#e7dcc3'; x.font = `bold ${size || 14}px "Courier New", monospace`; x.textAlign = 'center'; x.fillText(t, cx, cy); },
  // каменная кладка фона (детерминированная)
  stoneBg(x, w, h, seed, col1, col2) { x.fillStyle = col1; x.fillRect(0, 0, w, h); for (let r = 0; r < h / 24; r++) for (let c = -1; c < w / 40 + 1; c++) { const k = hash2(c, r, seed); x.fillStyle = k < 0.5 ? col2 : col1; x.fillRect(c * 40 + (r % 2) * 20 + 1, r * 24 + 1, 38, 22); } },
  sparks(x, list, dt) { for (const p of list) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; x.fillStyle = p.t > 0.15 ? '#ffe070' : '#ff7a30'; x.fillRect(p.x, p.y, 3, 3); } return list.filter(p => p.t > 0); },
  burst(list, px, py, n, col) { for (let i = 0; i < n; i++) list.push({ x: px, y: py, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220 - 40, t: 0.3 + Math.random() * 0.3, col }); },
  // кирка/молот в руке: рисуем иконку с поворотом вокруг рукояти; swing 0..1 — фаза удара
  tool(x, art, px, py, swing, size) { const a = -0.9 + Math.sin(Math.min(1, swing) * Math.PI) * 1.4; x.save(); x.translate(px, py); x.rotate(a); x.drawImage(art, -size * 0.2, -size * 0.85, size, size); x.restore(); },

  // Добыча: жила в скале, блик ползёт по трещине — бей киркой, когда он в светлой трещине
  mine(cb) {
    const skill = G.skills.craft, zw = 0.18 + Math.min(0.14, skill * 0.006), z0 = 0.4 + Math.random() * 0.2;
    const s = { title: 'Добыча', hint: 'Бей киркой, когда блик доходит до трещины — жила отдаст больше', res: null, swing: 1, sp: [], chunks: [] };
    const X0 = 90, X1 = 510, veinY = i => 150 - i * 40; // жила идёт по диагонали
    s.draw = (x, w, h) => {
      this.stoneBg(x, w, h, 3, '#3a3634', '#443f3c');
      // жила
      x.strokeStyle = '#8a7a5a'; x.lineWidth = 14; x.beginPath(); x.moveTo(X0, veinY(0)); x.lineTo(X1, veinY(1)); x.stroke();
      for (let i = 0; i < 26; i++) { const t = i / 25, k = hash2(i, 1, 5); x.fillStyle = k < 0.5 ? '#d8b04a' : '#b08a30'; x.fillRect(X0 + (X1 - X0) * t - 3 + (hash2(i, 2, 5) - 0.5) * 10, veinY(t) - 3 + (hash2(i, 3, 5) - 0.5) * 10, 5, 5); }
      // трещина (зона)
      const zx0 = X0 + (X1 - X0) * z0, zx1 = X0 + (X1 - X0) * (z0 + zw); x.strokeStyle = '#e8e0d0'; x.lineWidth = 2; x.beginPath(); x.moveTo(zx0, veinY(z0) - 26); x.lineTo(zx0 + (zx1 - zx0) * 0.3, veinY(z0) - 4); x.lineTo(zx0 + (zx1 - zx0) * 0.6, veinY(z0) + 8); x.lineTo(zx1, veinY(z0 + zw) + 24); x.stroke();
      x.fillStyle = 'rgba(232,224,208,.12)'; x.beginPath(); x.moveTo(zx0, veinY(z0) - 40); x.lineTo(zx1, veinY(z0 + zw) - 40); x.lineTo(zx1, veinY(z0 + zw) + 40); x.lineTo(zx0, veinY(z0) + 40); x.fill();
      // блик
      const m = this.pingpong(s.t, 1.4), bx = X0 + (X1 - X0) * m, by = veinY(m); if (s.res === null) { const g = x.createRadialGradient(bx, by, 2, bx, by, 22); g.addColorStop(0, 'rgba(255,240,180,.95)'); g.addColorStop(1, 'rgba(255,240,180,0)'); x.fillStyle = g; x.fillRect(bx - 22, by - 22, 44, 44); }
      for (const c of s.chunks) { c.t += 0.016; c.x += c.vx * 0.016; c.y += c.vy * 0.016; c.vy += 500 * 0.016; x.fillStyle = '#c8a040'; x.fillRect(c.x, c.y, 7, 7); } s.chunks = s.chunks.filter(c => c.t < 0.8);
      s.sp = this.sparks(x, s.sp, 0.016);
      this.tool(x, TEX.ART.pick, s.hitX || 300, 210, s.swing, 96); s.swing = Math.min(1, s.swing + 0.05);
      if (s.res !== null) this.banner(x, w, s.res ? 'Точно в жилу!' : 'Мимо. Руда крошится, кирка тупится, жизнь идёт', s.res ? '#9ad27a' : '#e06a5c', 40);
    };
    s.tap = () => { if (s.res !== null) return; const m = this.pingpong(s.t, 1.4); s.res = m >= z0 && m <= z0 + zw; s.swing = 0; s.hitX = X0 + (X1 - X0) * m; s.finished = true; if (s.res) { SFX.hammer(); for (let i = 0; i < 8; i++) s.chunks.push({ x: s.hitX, y: veinY(m), vx: (Math.random() - 0.5) * 240, vy: -Math.random() * 200 - 60, t: 0 }); this.burst(s.sp, s.hitX, veinY(m), 10); } else { SFX.fail(); this.burst(s.sp, s.hitX, veinY(m), 3); } };
    s.update = () => { if (s.t > 5 && s.res === null) { s.res = false; s.finished = true; } };
    s.done = () => cb(!!s.res, !!s.cancelled); this.start(s);
  },
  // Взлом: разрез замка — отмычка поднимает штифт, тапни, когда зазор штифта совпал с линией среза
  lockpick(tier, cb) {
    tier = tier || 1; const pins = tier + 1, skill = G.skills.lock, speed = 1.6 - tier * 0.25, zw = Math.max(0.26 / speed, 0.26 - tier * 0.05 + skill * 0.004);
    const s = { title: 'Взлом замка', hint: `Штифты: ${pins}. Тапни, когда зазор штифта на линии среза. Промах может сломать отмычку`, pin: 0, zones: [], res: null, msg: '', flash: 0 };
    for (let i = 0; i < pins; i++) s.zones.push(0.1 + Math.random() * (0.8 - zw));
    const LX = 150, LW = 300, shear = 120, lift = 70, px = i => LX + 40 + i * (LW - 80) / Math.max(1, pins - 1);
    s.draw = (x, w, h) => {
      this.stoneBg(x, w, h, 7, '#24201e', '#2a2624');
      x.fillStyle = '#5a5a62'; x.fillRect(LX - 30, 30, LW + 60, 190); x.fillStyle = '#3c3c44'; x.fillRect(LX - 22, 38, LW + 44, 174); // корпус
      x.fillStyle = '#6a6a72'; x.fillRect(LX - 22, shear, LW + 44, 100); // цилиндр (ниже линии среза)
      x.fillStyle = '#1a1a20'; x.fillRect(LX - 22, shear + 46, LW + 44, 16); // скважина
      x.fillStyle = '#c9bea3'; x.fillRect(LX - 22, shear - 1, LW + 44, 2); // линия среза
      for (let i = 0; i < pins; i++) {
        const cx = px(i), set = i < s.pin, cur = i === s.pin && s.res === null; const m = cur ? this.pingpong(s.t, speed) : (set ? s.zones[i] + zw / 2 : 0);
        const split = shear + lift * (s.zones[i] + zw / 2) - lift * m; // где сейчас зазор между штифтами
        x.fillStyle = '#2a2a30'; x.fillRect(cx - 9, 42, 18, shear + 44 - 42); // канал
        if (cur) { x.fillStyle = 'rgba(154,210,122,.35)'; x.fillRect(cx - 12, shear - lift * zw / 2, 24, lift * zw); } // зона: где должен оказаться зазор
        // пружина, ведущий штифт (сверху), ключевой (снизу)
        x.strokeStyle = '#8a8a92'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k < 6; k++) { x.moveTo(cx - 6, 46 + k * 6); x.lineTo(cx + 6, 49 + k * 6); } x.stroke();
        x.fillStyle = set ? '#9ad27a' : '#b0b0b8'; x.fillRect(cx - 7, Math.max(46, split - 34), 14, Math.min(34, split - 46 + 34 > 34 ? 34 : split - 46 + 34)); if (split - 34 < 46) x.fillRect(cx - 7, 46, 14, Math.max(0, split - 46));
        x.fillStyle = '#d8b040'; x.fillRect(cx - 7, split + 1, 14, shear + 46 - split - 1); x.fillStyle = '#e8c860'; x.beginPath(); x.moveTo(cx - 7, shear + 46); x.lineTo(cx, shear + 52); x.lineTo(cx + 7, shear + 46); x.fill();
      }
      // отмычка и натяжитель
      const cur = Math.min(s.pin, pins - 1), tipX = px(cur), tipY = shear + 50 - (s.res === null ? this.pingpong(s.t, speed) * 6 : 0);
      x.strokeStyle = '#c8c8d0'; x.lineWidth = 4; x.beginPath(); x.moveTo(40, 215); x.lineTo(tipX - 30, shear + 54); x.lineTo(tipX, tipY); x.stroke();
      x.strokeStyle = '#8a8a92'; x.beginPath(); x.moveTo(60, 225); x.lineTo(LX - 22, shear + 58); x.stroke();
      if (s.flash > 0) { s.flash -= 0.016; x.fillStyle = `rgba(255,120,80,${s.flash})`; x.fillRect(LX - 30, 30, LW + 60, 190); }
      this.txt(x, `Штифт ${Math.min(s.pin + 1, pins)} из ${pins} · отмычек: ${countItem('lockpick')}`, w / 2, 22);
      if (s.msg) this.banner(x, w, s.msg, s.res ? '#9ad27a' : '#e06a5c');
    };
    s.tap = () => { if (s.res !== null) return; const m = this.pingpong(s.t, speed), z = s.zones[s.pin]; if (m >= z && m <= z + zw) { s.pin++; SFX.click(); vibrate(10); if (s.pin >= pins) { s.res = true; s.msg = 'Щёлк. Открыто'; s.finished = true; SFX.unlock(); } } else { s.flash = 0.5; if (Math.random() < 0.35 + tier * 0.1) { removeItem('lockpick', 1); SFX.fail(); vibrate(40); if (!countItem('lockpick')) { s.res = false; s.msg = 'Отмычка сломалась. Больше нет'; s.finished = true; } else { s.msg = 'Отмычка сломалась'; setTimeout(() => { if (s.res === null) s.msg = ''; }, 700); } } else { SFX.fail(); s.msg = 'Сорвалось'; setTimeout(() => { if (s.res === null) s.msg = ''; }, 500); } } };
    s.done = () => cb(!!s.res); this.start(s);
  },
  // Плавка: печь с мехами — тапай, чтобы качать; держи пламя в нужном жаре
  smelt(cb) {
    const s = { title: 'Плавильня', hint: 'Тапай — качай меха. Держи жар в зелёной зоне', temp: 0.3, good: 0, total: 7, res: null, puff: 0 };
    s.update = dt => { s.puff = Math.max(0, s.puff - dt * 3); if (s.res !== null) return; s.temp = clamp(s.temp - dt * (0.22 + Math.sin(s.t * 1.3) * 0.06), 0, 1); if (s.temp > 0.45 && s.temp < 0.75) s.good += dt; if (s.t >= s.total) { s.res = s.good / s.total; s.finished = true; if (s.res > 0.3) SFX.craft(); else SFX.fail(); } };
    s.draw = (x, w, h) => {
      this.stoneBg(x, w, h, 11, '#2a2220', '#332a26');
      const cx = w / 2 + 40; x.fillStyle = '#5a4a3a'; x.fillRect(cx - 110, 20, 220, 200); x.fillStyle = '#3a2e26'; for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) { x.fillStyle = hash2(c, r, 3) < 0.5 ? '#4a3c30' : '#3a2e26'; x.fillRect(cx - 108 + c * 44 + (r % 2) * 22, 22 + r * 25, 42, 23); }
      x.fillStyle = '#100c0a'; x.beginPath(); x.moveTo(cx - 70, 200); x.lineTo(cx - 70, 110); x.quadraticCurveTo(cx, 40, cx + 70, 110); x.lineTo(cx + 70, 200); x.fill(); // устье
      // пламя: высота = температура
      const fh = 20 + s.temp * 130; for (let i = 0; i < 7; i++) { const fx = cx - 48 + i * 16, hh = fh * (0.6 + hash2(i, Math.floor(s.t * 12), 4) * 0.5); const g = x.createLinearGradient(0, 196, 0, 196 - hh); g.addColorStop(0, '#ff3a1a'); g.addColorStop(0.5, '#ff9a2a'); g.addColorStop(1, s.temp > 0.75 ? '#ffffff' : '#ffe07a'); x.fillStyle = g; x.beginPath(); x.moveTo(fx - 8, 196); x.lineTo(fx, 196 - hh); x.lineTo(fx + 8, 196); x.fill(); }
      x.fillStyle = s.temp > 0.45 ? (s.temp > 0.75 ? '#fff0c0' : '#ff8a30') : '#6a3a2a'; x.fillRect(cx - 14, 176, 28, 14); // крица
      // шкала жара на стенке печи
      x.fillStyle = '#1a1410'; x.fillRect(cx + 84, 40, 12, 150); x.fillStyle = 'rgba(92,154,60,.7)'; x.fillRect(cx + 84, 190 - 150 * 0.75, 12, 150 * 0.3); x.fillStyle = s.temp > 0.75 ? '#ffffff' : '#ff9a2a'; x.fillRect(cx + 86, 190 - 150 * s.temp, 8, 150 * s.temp);
      // меха
      const sq = s.puff; x.fillStyle = '#7a5a3a'; x.beginPath(); x.moveTo(40, 150 - 40 * (1 - sq)); x.lineTo(160, 170); x.lineTo(160, 190); x.lineTo(40, 210 + 20 * sq); x.fill(); x.fillStyle = '#4a3020'; x.fillRect(150, 172, cx - 70 - 150, 12); x.fillStyle = '#3a2a1a'; x.fillRect(20, 140 - 40 * (1 - sq), 40, 8); x.fillRect(20, 214 + 20 * sq, 40, 8);
      this.txt(x, `Осталось ${Math.max(0, s.total - s.t).toFixed(1)} с · в зоне ${Math.round(s.good / s.total * 100)}%`, w / 2, 22);
      this.txt(x, s.temp > 0.75 ? 'ПЕРЕГРЕВ' : s.temp < 0.45 ? 'холодно' : 'в самый раз', 100, 110, s.temp > 0.75 ? '#ff8a60' : s.temp < 0.45 ? '#8fb3ff' : '#9ad27a');
      if (s.res !== null) this.banner(x, w, s.res > 0.85 ? 'Отличная плавка!' : s.res > 0.3 ? 'Слиток готов' : 'Шлак. Руда пропала, гордость тоже', s.res > 0.3 ? '#9ad27a' : '#e06a5c');
    };
    s.tap = () => { if (s.res !== null) return; s.temp = Math.min(1, s.temp + 0.16); s.puff = 1; SFX.bellows(); };
    s.done = () => cb(s.res || 0); this.start(s);
  },
  // Ковка: раскалённая заготовка на наковальне, молот ходит над ней — бей по светлому пятну
  forge(cb) {
    const skill = G.skills.craft, zw = 0.22 + Math.min(0.12, skill * 0.005), s = { title: 'Ковка', hint: 'Три удара — опускай молот на самое яркое место заготовки', hits: 0, n: 0, zone: 0.4, res: null, msg: '', swing: 1, sp: [], hitAt: [] };
    s.newZone = () => { s.zone = 0.12 + Math.random() * (0.76 - zw); };
    const BX0 = 150, BX1 = 450, BY = 150;
    s.draw = (x, w, h) => {
      this.stoneBg(x, w, h, 13, '#2a2220', '#332a26');
      x.fillStyle = '#3a3a40'; x.fillRect(120, 160, 360, 30); x.fillRect(200, 190, 200, 40); x.beginPath(); x.moveTo(120, 160); x.lineTo(70, 168); x.lineTo(120, 190); x.fill(); x.fillStyle = '#4a4a52'; x.fillRect(120, 158, 360, 6); // наковальня
      const heat = Math.max(0.25, 1 - s.t / 12); // заготовка остывает
      const g = x.createLinearGradient(BX0, 0, BX1, 0); g.addColorStop(0, `rgba(${200 + 55 * heat},${60 + 120 * heat},${20 + 40 * heat},1)`); g.addColorStop(1, `rgba(${180 + 60 * heat},${40 + 100 * heat},20,1)`); x.fillStyle = g; x.fillRect(BX0, BY - 9, BX1 - BX0, 18); x.fillStyle = '#5a3a2a'; x.fillRect(BX0 - 40, BY - 6, 40, 12);
      const zx = BX0 + (BX1 - BX0) * s.zone, zwPx = (BX1 - BX0) * zw; const gg = x.createRadialGradient(zx + zwPx / 2, BY, 2, zx + zwPx / 2, BY, zwPx * 0.8); gg.addColorStop(0, 'rgba(255,255,220,.95)'); gg.addColorStop(0.5, 'rgba(255,220,120,.6)'); gg.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = gg; x.fillRect(zx - 30, BY - 30, zwPx + 60, 60); // яркое пятно — куда бить
      const m = this.pingpong(s.t, 1.1), hx = BX0 + (BX1 - BX0) * m; // молот ходит над заготовкой
      const hy = BY - 70 + (1 - Math.abs(Math.sin(Math.min(1, s.swing) * Math.PI))) * 0; this.hammer(x, s.res === null ? hx : (s.hitX || hx), BY, s.swing);
      for (let i = 0; i < 3; i++) { x.fillStyle = i < s.n ? (s.hitAt[i] ? '#9ad27a' : '#e06a5c') : '#5a4a3a'; x.beginPath(); x.arc(w / 2 - 40 + i * 40, 30, 10, 0, Math.PI * 2); x.fill(); }
      s.sp = this.sparks(x, s.sp, 0.016); s.swing = Math.min(1, s.swing + 0.06);
      if (s.msg) this.banner(x, w, s.msg, s.hits >= 2 ? '#9ad27a' : '#e06a5c');
    };
    s.tap = () => { if (s.res !== null) return; const m = this.pingpong(s.t, 1.1); const ok = m >= s.zone && m <= s.zone + zw; s.hitAt.push(ok); s.swing = 0; s.hitX = BX0 + (BX1 - BX0) * m; if (ok) { s.hits++; SFX.hammer(); vibrate(15); this.burst(s.sp, s.hitX, BY, 14); } else { SFX.fail(); this.burst(s.sp, s.hitX, BY, 3); } s.n++; s.newZone(); if (s.n >= 3) { s.res = s.hits; s.msg = s.hits === 3 ? 'Мастерская работа!' : s.hits === 2 ? 'Добротно' : s.hits === 1 ? 'Кривовато, но сойдёт' : 'Испорчено. Брандт сделает вид, что не видел'; s.finished = true; } };
    s.newZone(); s.done = () => cb(s.res || 0); this.start(s);
  },
  hammer(x, px, py, swing) { const lift = 70 * (1 - Math.sin(Math.min(1, swing) * Math.PI)); const a = -0.5 + 0.5 * (1 - Math.min(1, swing)); x.save(); x.translate(px, py - 10 - lift); x.rotate(a); x.fillStyle = '#6b4a2a'; x.fillRect(-4, -8, 8, 70); x.fillStyle = '#7a7a82'; x.fillRect(-26, -22, 52, 26); x.fillStyle = '#9a9aa2'; x.fillRect(-26, -22, 52, 8); x.restore(); },
  // Алхимия: котёл сверху — лопай пузыри, когда кольцо сжалось
  brew(cb) {
    const s = { title: 'Котёл', hint: 'Тапни, когда кольцо сжимается вокруг пузыря', bubbles: [], good: 0, n: 0, total: 4, res: null, next: 0.6 };
    s.update = dt => { if (s.res !== null) return; s.next -= dt; if (s.next <= 0 && s.n < s.total) { s.n++; s.next = 1.5; const a = Math.random() * 6.28, r = Math.random() * 60; s.bubbles.push({ x: 300 + Math.cos(a) * r * 1.9, y: 125 + Math.sin(a) * r, t: 0 }); } for (const b of s.bubbles) b.t += dt; s.bubbles = s.bubbles.filter(b => b.t < 1.5); if (s.n >= s.total && !s.bubbles.length) { s.res = s.good / s.total; s.finished = true; if (s.good) SFX.craft(); } };
    s.draw = (x, w, h) => {
      this.stoneBg(x, w, h, 17, '#1e1a1c', '#262024');
      x.fillStyle = '#2a2a30'; x.beginPath(); x.ellipse(300, 125, 190, 105, 0, 0, 6.28); x.fill(); x.fillStyle = '#1d3a1a'; x.beginPath(); x.ellipse(300, 125, 170, 88, 0, 0, 6.28); x.fill();
      for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + s.t * 0.3, r = 0.5 + hash2(i, 0, 9) * 0.45; x.fillStyle = 'rgba(120,190,90,.25)'; x.beginPath(); x.ellipse(300 + Math.cos(a) * 150 * r, 125 + Math.sin(a) * 78 * r, 10, 6, 0, 0, 6.28); x.fill(); }
      for (const b of s.bubbles) { const r = 26 * (1 - b.t / 1.5) + 8; x.strokeStyle = '#c8e070'; x.lineWidth = 2; x.beginPath(); x.arc(b.x, b.y, r + 14, 0, Math.PI * 2); x.stroke(); x.fillStyle = r < 20 ? '#7ad07a' : '#4a9a4a'; x.beginPath(); x.arc(b.x, b.y, 12, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(b.x - 5, b.y - 6, 3, 3); }
      x.strokeStyle = '#6b4a2a'; x.lineWidth = 8; x.beginPath(); x.moveTo(560, 30); x.lineTo(470, 110); x.stroke(); x.fillStyle = '#4a3020'; x.beginPath(); x.ellipse(462, 116, 22, 12, -0.5, 0, 6.28); x.fill(); // черпак
      this.txt(x, `Пузыри: ${s.good}/${s.total}`, w / 2, 228);
      if (s.res !== null) this.banner(x, w, s.res >= 0.75 ? 'Зелье вышло крепким!' : s.res > 0 ? 'Готово' : 'Выкипело. Пахнет так, что соседи стучали', s.res > 0 ? '#9ad27a' : '#e06a5c');
    };
    s.tap = () => { if (s.res !== null) return; let best = null; for (const b of s.bubbles) { const r = 26 * (1 - b.t / 1.5) + 8; if (r < 22 && r > 9) best = b; } if (best) { s.good++; best.t = 9; SFX.bubble(); } else SFX.fail(); };
    s.done = () => cb(s.res || 0); this.start(s);
  },
  // Руны: алтарный камень, повтори последовательность
  runes(cb) {
    const glyphs = ['runeFire', 'runeFrost', 'runeLife', 'runeAsh'], seq = []; for (let i = 0; i < 4; i++) seq.push(Math.floor(Math.random() * 4));
    const s = { title: 'Зачарование', hint: 'Запомни порядок рун и повтори его', phase: 'show', idx: 0, input: [], res: null, msg: '' };
    s.update = () => { if (s.phase === 'show' && s.t > 4 * 0.9 + 0.6) s.phase = 'input'; };
    s.draw = (x, w, h) => {
      this.stoneBg(x, w, h, 19, '#1a1620', '#221c2a'); x.fillStyle = '#4a4650'; x.fillRect(80, 40, 440, 120); x.fillStyle = '#3a3640'; x.fillRect(90, 48, 420, 104);
      for (let i = 0; i < 4; i++) { const cx = w / 2 - 150 + i * 100; x.fillStyle = '#2a1a2e'; x.fillRect(cx - 34, 66, 68, 68); x.drawImage(TEX.ART[glyphs[i]], cx - 28, 72, 56, 56); }
      if (s.phase === 'show') { const k = Math.floor((s.t - 0.6) / 0.9); if (k >= 0 && k < 4 && (s.t - 0.6) % 0.9 < 0.7) { const cx = w / 2 - 150 + seq[k] * 100; x.strokeStyle = '#ffd060'; x.lineWidth = 4; x.strokeRect(cx - 36, 64, 72, 72); x.fillStyle = 'rgba(255,208,96,.18)'; x.fillRect(cx - 36, 64, 72, 72); } this.txt(x, 'Смотри...', w / 2, 190); }
      else { this.txt(x, `Повтори: ${s.input.length}/4`, w / 2, 190); for (let i = 0; i < s.input.length; i++) x.drawImage(TEX.ART[glyphs[s.input[i]]], w / 2 - 60 + i * 30, 200, 24, 24); }
      if (s.msg) this.banner(x, w, s.msg, s.res ? '#9ad27a' : '#e06a5c'); };
    s.tapAt = (px) => { if (s.phase !== 'input' || s.res !== null) return; const i = Math.floor((px - (600 / 2 - 200)) / 100); if (i < 0 || i > 3) return; s.input.push(i); SFX.rune(); if (seq[s.input.length - 1] !== i) { s.res = false; s.msg = 'Руны погасли, самоцвет рассыпался. Магия не любит невнимательных'; s.finished = true; SFX.fail(); } else if (s.input.length === 4) { s.res = true; s.msg = 'Руны вспыхнули!'; s.finished = true; SFX.level(); } };
    s.done = () => cb(!!s.res); this.start(s);
  },
  // Торг: весы торговца — тапни, когда чаши выровнялись
  haggle(cb) {
    const zw = 0.28, z0 = 0.2 + Math.random() * 0.5, s = { title: 'Торг', hint: 'Поймай момент, когда чаши весов сойдутся — цена дрогнет', res: null };
    s.draw = (x, w, h) => {
      this.stoneBg(x, w, h, 23, '#2a2220', '#332a26');
      const m = s.res === null ? this.pingpong(s.t, 0.9) : s.m, ang = (m - (z0 + zw / 2)) * 0.9; // 0 — равновесие
      x.fillStyle = '#5a4a3a'; x.fillRect(290, 60, 20, 150); x.fillRect(220, 205, 160, 14);
      x.save(); x.translate(300, 70); x.rotate(ang); x.fillStyle = '#8a7a5a'; x.fillRect(-150, -5, 300, 10); for (const sgn of [-1, 1]) { x.strokeStyle = '#6a5a4a'; x.lineWidth = 2; x.beginPath(); x.moveTo(sgn * 140, 0); x.lineTo(sgn * 120, 70); x.moveTo(sgn * 140, 0); x.lineTo(sgn * 160, 70); x.stroke(); } x.restore();
      for (const sgn of [-1, 1]) { const px = 300 + Math.cos(ang) * 140 * sgn, py = 70 + Math.sin(ang) * 140 * sgn + 70; x.fillStyle = '#6a5a4a'; x.beginPath(); x.ellipse(px, py, 40, 10, 0, 0, 6.28); x.fill(); if (sgn < 0) { x.fillStyle = '#e0b040'; for (let i = 0; i < 5; i++) x.fillRect(px - 16 + i * 7, py - 8 - (i % 2) * 4, 8, 4); } else { x.fillStyle = '#8a6a40'; x.fillRect(px - 14, py - 20, 28, 16); } }
      x.fillStyle = '#c9bea3'; x.beginPath(); x.moveTo(300, 40); x.lineTo(294, 52); x.lineTo(306, 52); x.fill(); // стрелка равновесия
      x.fillStyle = 'rgba(154,210,122,.5)'; x.fillRect(300 - zw * 0.9 * 100 * 0.5 * 3, 44, zw * 0.9 * 100 * 3, 6);
      if (s.res !== null) this.banner(x, w, s.res ? 'По рукам! Скидка 15%' : 'Торговец обиделся: +10% к ценам', s.res ? '#9ad27a' : '#e06a5c');
    };
    s.tap = () => { if (s.res !== null) return; const m = this.pingpong(s.t, 0.9); s.m = m; s.res = m >= z0 && m <= z0 + zw; s.finished = true; if (s.res) SFX.gold(); else SFX.fail(); };
    s.update = () => { if (s.t > 5 && s.res === null) { s.m = this.pingpong(s.t, 0.9); s.res = false; s.finished = true; } };
    s.done = () => cb(!!s.res); this.start(s);
  }
};
$('mini').addEventListener('pointerdown', e => { if (e.target.id === 'miniClose') return; e.preventDefault(); const r = $('minic').getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * 600; if (Mini.active && Mini.active.tapAt) Mini.active.tapAt(px); else Mini.tap(); });
$('miniClose').addEventListener('click', e => { e.stopPropagation(); if (!Mini.active) { UI.hide('mini'); return; } if (Mini.armCancel) { Mini.armCancel = false; Mini.cancel(); } else { Mini.armCancel = true; $('miniHint').textContent = 'Ещё раз ✕ — прервать (материалы пропадут)'; setTimeout(() => { Mini.armCancel = false; }, 2500); } });

// ================= РЕЦЕПТЫ =================
const RECIPES = {
  furnace: [{ out: 'ingot', need: { ore: 2, wood: 1 }, mini: 'smelt' }],
  anvil: [
    { out: 'dagger_iron', need: { ingot: 1 } }, { out: 'sword_iron', need: { ingot: 2, wood: 1 } }, { out: 'spear_wood', need: { ingot: 1, wood: 2 } }, { out: 'axe_iron', need: { ingot: 3, wood: 1 } },
    { out: 'mace_iron', need: { ingot: 3 } }, { out: 'sword_steel', need: { ingot: 4, gem_red: 1 }, skill: 12 }, { out: 'sword_silver', need: { ingot: 3, gem_purple: 1 }, skill: 8 }, { out: 'axe_halvar', need: { pickaxe_old: 1, ingot: 2, wood: 1 }, skill: 10 }, { out: 'armor_bear', need: { bear_pelt: 1, pelt: 2, ingot: 1 }, skill: 10 }, { out: 'helmet_iron', need: { ingot: 2 } }, { out: 'shield_wood', need: { wood: 3 } }, { out: 'shield_iron', need: { ingot: 3, wood: 1 } },
    { out: 'armor_leather', need: { pelt: 3 } }, { out: 'armor_chain', need: { ingot: 4, pelt: 1 } }, { out: 'armor_plate', need: { ingot: 7, pelt: 1 }, skill: 15 }, { out: 'pickaxe', need: { ingot: 2, wood: 1 } }, { out: 'shovel', need: { ingot: 1, wood: 2 } },
    { out: 'lockpick', q: 3, need: { ingot: 1 }, nomini: true }, { out: 'cloak', need: { pelt: 2 }, nomini: true }, { out: 'fur_coat', need: { pelt: 4, cloak: 1 }, nomini: true }
  ],
  cauldron: [{ out: 'potion_hp', need: { herb: 2 } }, { out: 'potion_mp', need: { moonflower: 1, herb: 1 } }, { out: 'potion_g', need: { mushroom: 2, herb: 1 } }, { out: 'potion_warm', need: { herb: 1, mushroom: 1 } }, { out: 'bandage', q: 2, need: { pelt: 1 }, nomini: true }],
  campfire: [{ out: 'meatCooked', need: { meat: 1 } }, { out: 'stew', need: { meat: 1, mushroom: 1, herb: 1 } }, { out: 'bread', need: { mushroom: 3 } }]
};
const Craft = {
  names: { anvil: 'Наковальня Брандта', furnace: 'Плавильня', cauldron: 'Котёл знахарки', campfire: 'Костёр', altar: 'Алтарь Печати' },
  st: 'anvil', tab: 'make',
  open(st) { UI.hintSeen('craft'); this.st = st; this.confirm = null; this.sel = {}; this.tab = st === 'altar' ? 'ench' : 'make'; $('craftName').textContent = this.names[st]; this.render(); UI.show('craft'); },
  render() {
    const tabs = $('craftTabs'); tabs.innerHTML = '';
    const tabList = this.st === 'anvil' ? [['make', 'Ковать'], ['upgrade', 'Улучшить'], ['repair', 'Починить']] : this.st === 'altar' ? [['ench', 'Зачаровать']] : [['make', this.st === 'furnace' ? 'Плавить' : this.st === 'cauldron' ? 'Варить' : 'Готовить']];
    for (const [k, n] of tabList) { const b = document.createElement('button'); b.className = 'ubtn' + (this.tab === k ? ' main' : ''); b.textContent = n; b.onclick = () => { this.tab = k; this.confirm = null; this.render(); }; tabs.appendChild(b); }
    const list = $('craftList'); list.innerHTML = '';
    if (this.tab === 'make') this.renderMake(list); else if (this.tab === 'upgrade') this.renderUpgrade(list); else if (this.tab === 'repair') this.renderRepair(list); else this.renderEnch(list);
    $('craftHint').textContent = this.st === 'anvil' ? 'Слитки — из плавильни рядом. Дрова — топором с деревьев, шкуры — с волков. Мини-игра с молотом влияет на качество (+1/+2).' : this.st === 'furnace' ? 'Две руды и дрова — один слиток. Держи жар: перегрев или холод — и получишь шлак.' : this.st === 'cauldron' ? 'Моховник у скал и воды, грибы под деревьями, лунный цветок — в глубине шахты. Точная варка даёт двойную порцию.' : this.st === 'altar' ? 'Руна + самоцвет + вещь. Запомни порядок рун — ошибка сожжёт самоцвет.' : 'Сырое мясо падает с волков и медведей.';
  },
  row(list, html, ok, fn, sel) { const d = document.createElement('div'); d.className = 'item' + (ok ? '' : ' dim') + (sel ? ' sel' : ''); d.innerHTML = html; d.onclick = fn; list.appendChild(d); return d; },
  renderMake(list) {
    for (const r of RECIPES[this.st]) {
      const it = ITEMS[r.out]; const ok = Object.keys(r.need).every(k => countItem(k) >= r.need[k]) && (!r.skill || G.skills.craft >= r.skill);
      const need = Object.keys(r.need).map(k => `${ITEMS[k].name}: нужно ${r.need[k]} · есть ${countItem(k)}`).join('; ') + (r.skill ? ` · Ремесло ${r.skill}` : '');
      const armed = this.confirm === 'make:' + r.out;
      this.row(list, `<span>${UI.icon(it.icon)}${it.name}${r.q ? ' ×' + r.q : ''} <span class="q">${UI.itemInfo(it)}</span></span><span class="q">${armed ? '<b>Ещё раз — начать</b>' : need}</span>`, ok, () => {
        if (!ok) { log('Не хватает материалов', 'red'); return; }
        if (!armed) { this.confirm = 'make:' + r.out; this.render(); return; } this.confirm = null;
        const take = () => { for (const k in r.need) removeItem(k, r.need[k]); };
        if (this.st === 'furnace') { take(); Mini.smelt(q => { if (q > 0.3) { addItem('ingot', q > 0.85 && Math.random() < 0.6 ? 2 : 1); skillUse('craft', 2); G.stats.crafted++; } else log('Плавка не удалась — шлак.', 'red'); this.render(); }); return; }
        if (this.st === 'cauldron' && !r.nomini) { take(); Mini.brew(q => { if (q > 0) { addItem(r.out, (r.q || 1) * (q >= 0.75 ? 2 : 1)); skillUse('alch', 2); G.stats.crafted++; } else log('Зелье выкипело.', 'red'); this.render(); }); return; }
        if (this.st === 'anvil' && !r.nomini && SLOTS.includes(it.type)) { take(); Mini.forge(hits => { if (hits === 0) { log('Заготовка испорчена.', 'red'); } else { addItem(r.out, 1, false, { plus: hits === 3 ? 1 : 0 }); skillUse('craft', 2); G.stats.crafted++; } this.render(); }); return; }
        take(); addItem(r.out, r.q || 1); G.stats.crafted++; skillUse(this.st === 'cauldron' ? 'alch' : 'craft', 1); SFX.craft(); this.render();
      }, armed);
    }
  },
  gear() { return G.inv.filter(i => ['weapon', 'armor', 'shield', 'helmet'].includes(ITEMS[i.id].type)); },
  renderUpgrade(list) {
    const items = this.gear(); if (!items.length) { list.innerHTML = '<div class="q">Нет снаряжения для улучшения</div>'; return; }
    for (const i of items) {
      const p = i.plus || 0; if (p >= 3) { this.row(list, `<span>${itemName(i)}</span><span class="q">предел</span>`, false, () => { }); continue; }
      const need = p === 0 ? { ingot: 2 } : p === 1 ? { ingot: 2, gem_red: 1 } : { ingot: 3, gem_blue: 1 };
      const ok = Object.keys(need).every(k => countItem(k) >= need[k]);
      const armed = this.confirm === 'up:' + i.uid;
      this.row(list, `<span>${UI.icon(ITEMS[i.id].icon)}${itemName(i)} → +${p + 1}${armed ? ' <b>· ещё раз — ковать</b>' : ''}</span><span class="q">${Object.keys(need).map(k => `${ITEMS[k].name}: нужно ${need[k]} · есть ${countItem(k)}`).join('; ')}</span>`, ok, () => {
        if (!ok) { log('Не хватает материалов', 'red'); return; } if (!armed) { this.confirm = 'up:' + i.uid; this.render(); return; } this.confirm = null; for (const k in need) removeItem(k, need[k]);
        Mini.forge(hits => { if (hits >= 2) { i.plus = p + 1; i.dur = ITEMS[i.id].maxDur; log(`${itemName(i)}: улучшено!`, 'gold'); skillUse('craft', 3); } else if (hits === 1) { log('Улучшение не вышло, материалы потрачены.', 'red'); } else { i.dur = Math.max(0, (i.dur || 0) - 30); log('Испорчено: вещь повреждена.', 'red'); } this.render(); });
      }, armed);
    }
  },
  renderRepair(list) {
    const items = this.gear().filter(i => i.dur !== undefined && i.dur < ITEMS[i.id].maxDur); if (!items.length) { list.innerHTML = '<div class="q">Всё снаряжение в порядке</div>'; return; }
    for (const i of items) {
      const d = ITEMS[i.id], wood = ['shield_wood', 'spear_wood', 'axe_wood', 'shovel'].includes(i.id), mat = wood ? 'wood' : 'ingot', ok = countItem(mat) >= 1;
      this.row(list, `<span>${UI.icon(d.icon)}${itemName(i)} <span class="q">прочн. ${Math.round(i.dur)}/${d.maxDur}</span></span><span class="q">${ITEMS[mat].name}: нужно 1 · есть ${countItem(mat)}</span>`, ok, () => { if (!ok) { log('Нужен ' + ITEMS[mat].name.toLowerCase(), 'red'); return; } removeItem(mat, 1); i.dur = d.maxDur; SFX.hammer(); log(`${itemName(i)}: починено`, 'gold'); skillUse('craft'); this.render(); });
    }
  },
  renderEnch(list) {
    const items = this.gear().filter(i => !i.ench); const runes = G.inv.filter(i => ITEMS[i.id].type === 'rune'), gems = G.inv.filter(i => ITEMS[i.id].type === 'gem');
    if (!items.length) { list.innerHTML = '<div class="q">Нет незачарованного снаряжения</div>'; return; }
    if (!runes.length) { list.innerHTML = '<div class="q">Нужна руна. Руны лежат в сундуках крипты и шахты, руну жизни продаёт Ильва.</div>'; return; }
    const sel = this.sel = this.sel || {};
    list.innerHTML = '<h3>Вещь</h3>';
    for (const i of items) this.row(list, `<span>${UI.icon(ITEMS[i.id].icon)}${itemName(i)}${sel.item === i.uid ? ' ◄' : ''}</span>`, true, () => { sel.item = i.uid; this.render(); });
    const h2 = document.createElement('h3'); h2.textContent = 'Руна'; list.appendChild(h2);
    for (const r of runes) { const k = Object.keys(ENCH).find(k => ENCH[k].rune === r.id); this.row(list, `<span>${UI.icon(ITEMS[r.id].icon)}${ITEMS[r.id].name}${sel.rune === r.id ? ' ◄' : ''} <span class="q">${ENCH[k].wDesc} / ${ENCH[k].aDesc}</span></span>`, true, () => { sel.rune = r.id; this.render(); }); }
    const h3 = document.createElement('h3'); h3.textContent = 'Самоцвет'; list.appendChild(h3);
    if (!gems.length) list.innerHTML += '<div class="q">Нужен любой самоцвет</div>';
    for (const g of gems) this.row(list, `<span>${UI.icon(ITEMS[g.id].icon)}${ITEMS[g.id].name}${sel.gem === g.id ? ' ◄' : ''}</span>`, true, () => { sel.gem = g.id; this.render(); });
    const ok = sel.item && sel.rune && sel.gem && inst(sel.item) && countItem(sel.rune) && countItem(sel.gem);
    const b = document.createElement('button'); b.className = 'ubtn' + (ok ? ' main' : ''); b.textContent = 'Зачаровать'; b.onclick = () => {
      if (!ok) { log('Выбери вещь, руну и самоцвет', 'red'); return; }
      const item = inst(sel.item), k = Object.keys(ENCH).find(k => ENCH[k].rune === sel.rune);
      removeItem(sel.gem, 1);
      Mini.runes(success => { if (success) { removeItem(sel.rune, 1); item.ench = k; log(`${itemName(item)} — зачаровано!`, 'gold'); skillUse('destr', 3); G.stats.crafted++; } else log('Самоцвет рассыпался в пыль. Руна цела.', 'red'); this.sel = {}; this.render(); });
    }; list.appendChild(b);
  }
};
