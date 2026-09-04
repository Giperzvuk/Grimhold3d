// ---------- Ввод: сенсор (джойстик + обзор + кнопки), клавиатура и мышь ----------
'use strict';
const IN = { lookDX: 0, lookDY: 0, gyroYaw: 0, gyroPitch: 0, keys: {}, joy: null, look: null, jump: false, touch: false, gyroOk: false };
const Input = (() => {
  const JOY_R = 44; // радиус хода ручки
  const joyEl = $('joy'), knob = $('joyKnob');
  let joyHome = null; // положение кольца в покое
  const isTouchDevice = () => ('ontouchstart' in window || navigator.maxTouchPoints > 0) && !window.matchMedia('(pointer: fine) and (hover: hover)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  function setMode(touch) {
    IN.touch = touch; document.body.classList.toggle('touch', touch); document.body.classList.toggle('desktop', !touch);
    if (touch) { document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth); }
  }
  const LY = () => (typeof Layout !== 'undefined' ? Layout : null);
  function placeJoy(x, y) { joyEl.style.left = (x - 60) + 'px'; joyEl.style.top = (y - 60) + 'px'; joyEl.style.bottom = 'auto'; joyEl.style.right = 'auto'; joyEl.style.opacity = String(0.9 * (LY() ? LY().alpha('joy') : 1)); }
  function homeJoy() { const ly = LY(); joyEl.style.left = ''; joyEl.style.top = ''; joyEl.style.bottom = ''; joyEl.style.right = ''; joyEl.style.opacity = String(0.55 * (ly ? ly.alpha('joy') : 1)); knob.style.transform = ''; if (ly) ly.apply(); }
  const inLeftZone = (x, y) => { const ly = LY(), c = ly && ly.homeCenter('joy'); if (c && Math.hypot(x - c.x, y - c.y) < 120 * ly.scale('joy')) return true; return (!c || c.x < VW * 0.5) && x < VW * 0.45 && y > VH * 0.22; };
  const edge = (x, y) => x < 24 || x > VW - 24 || y > VH - 24 || y < 8;
  // --- сенсор ---
  function onDown(e) {
    if (!IN.touch || UI.open || P.dead || (LY() && LY().active)) return; if (e.pointerType === 'mouse') return;
    SFX.init(); const x = e.clientX, y = e.clientY; if (edge(x, y)) return;
    if (inLeftZone(x, y)) { if (!IN.joy) { IN.joy = { id: e.pointerId, ox: x, oy: y, x, y }; joyPid = e.pointerId; placeJoy(x, y); } }
    else if (!IN.look && (x > VW * 0.45 || y > VH * 0.22)) { IN.look = { id: e.pointerId, lx: x, ly: y, t: performance.now(), moved: 0 }; UI.hintSeen('touch'); }
  }
  function onMove(e) {
    if (IN.joy && e.pointerId === IN.joy.id) { IN.joy.x = e.clientX; IN.joy.y = e.clientY; const dx = e.clientX - IN.joy.ox, dy = e.clientY - IN.joy.oy, l = Math.hypot(dx, dy), k = l > JOY_R ? JOY_R / l : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; }
    if (IN.look && e.pointerId === IN.look.id) { const dx = e.clientX - IN.look.lx, dy = e.clientY - IN.look.ly; IN.look.lx = e.clientX; IN.look.ly = e.clientY; IN.look.moved += Math.abs(dx) + Math.abs(dy); IN.lookDX += dx * 1.15; IN.lookDY += dy * 1.15; }
  }
  let joyPid = null;
  function onUp(e) {
    if (e.pointerId === joyPid) { joyPid = null; IN.joy = null; homeJoy(); }
    if (IN.look && e.pointerId === IN.look.id) { if (OPTS.tapAttack && performance.now() - IN.look.t < 220 && IN.look.moved < 18 && !UI.open && !P.dead) { const ti = findInteract(); if (ti && (ti.kind === 'npc' || ti.kind === 'enemyTalk')) interact(); else attack(); } IN.look = null; }
  }
  hudc.style.pointerEvents = 'auto';
  const noClick = e => e.preventDefault(); hudc.addEventListener('touchend', noClick, { passive: false }); $('ctx').addEventListener('touchend', noClick, { passive: false });
  document.addEventListener('click', e => { if (IN.touch && UI.shieldT && performance.now() < UI.shieldT) { e.stopPropagation(); e.preventDefault(); } }, true);
  hudc.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  // --- кнопки ---
  const bindBtn = (id, fn, opts) => {
    opts = opts || {}; const el = $(id); let held = false, timer = null;
    el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); SFX.init(); if (P.dead && id !== 'bMenu') return; el.classList.add('on'); held = false; if (opts.hold) timer = setTimeout(() => { held = true; opts.hold(); }, (opts.spam && opts.spam()) ? 320 : (opts.holdMs || 350)); else fn(); });
    const off = e => { if (!el.classList.contains('on')) return; el.classList.remove('on'); if (timer) { clearTimeout(timer); timer = null; } if (opts.hold) { if (held) { if (opts.release) opts.release(); } else if (e.type !== 'pointerleave') fn(); } };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    el.addEventListener('contextmenu', e => e.preventDefault()); el.addEventListener('touchend', noClick, { passive: false });
  };
  bindBtn('bAttack', attack, { hold: startBlock, release: endBlock, holdMs: 180, spam: () => P.swing > 0 });
  bindBtn('bSpell', castSpell, { hold: () => UI.nextSpell(), holdMs: 450 });
  bindBtn('bUse', () => interact()); bindBtn('bJump', () => { IN.jump = true; });
  for (let i = 0; i < 4; i++) bindBtn('bQ' + (i + 1), () => useQuick(i), { hold: () => { if (G.quick[i]) { G.quick[i] = null; log('Ячейка ' + (i + 1) + ' очищена'); if (navigator.vibrate && OPTS.vibro) navigator.vibrate(20); } }, holdMs: 600 });
  bindBtn('bInv', () => { if (!P.dead) UI.toggle('inv'); }); bindBtn('bJournal', () => UI.toggle('journal')); bindBtn('bMap', () => UI.toggle('map')); bindBtn('bMenu', () => UI.menu(true));
  $('ctx').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); interact(); });
  // --- клавиатура ---
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && e.target && e.target.blur) e.target.blur();
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.code !== 'Escape') return;
    if (e.repeat) return; IN.keys[e.code] = true;
    if (!G) return;
    if (LY() && LY().active) { if (e.code === 'Escape') LY().edit(false); return; }
    if (e.code === 'Escape' && Mini.active) { $('miniClose').click(); return; }
    if (e.code === 'KeyE' || e.code === 'Enter') interact(); if (e.code === 'KeyF') castSpell(); if (e.code === 'KeyI' || e.code === 'Tab') { UI.toggle('inv'); e.preventDefault(); } if (e.code === 'KeyJ') UI.toggle('journal'); if (e.code === 'KeyM') UI.toggle('map');
    if (e.code === 'KeyQ') UI.nextSpell(); if (/^Digit[1-4]$/.test(e.code)) useQuick(+e.code[5] - 1); if (e.code === 'KeyR') drinkFlask();
    if (e.code === 'Space') { IN.jump = true; e.preventDefault(); } if (e.code === 'Escape') { if (UI.open) UI.closeAll(); else UI.menu(true); }
    if (e.code === 'ShiftLeft' || e.code === 'ControlLeft') startBlock();
  });
  window.addEventListener('keyup', e => { IN.keys[e.code] = false; if (e.code === 'ShiftLeft' || e.code === 'ControlLeft') endBlock(); });
  // --- мышь (десктоп): захват курсора ---
  const lockEl = canvas3d;
  const locked = () => document.pointerLockElement === lockEl;
  const tryLock = () => { if (!IN.touch && !UI.open && G && L && !P.dead && lockEl.requestPointerLock) { try { const p = lockEl.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => lockEl.requestPointerLock()); } catch (e) { lockEl.requestPointerLock(); } } };
  hudc.addEventListener('mousedown', e => { if (IN.touch || UI.open) return; if (!locked()) { tryLock(); return; } });
  document.addEventListener('pointerlockchange', () => { document.body.classList.toggle('unlocked', !locked()); });
  document.addEventListener('mousemove', e => { if (locked()) { IN.lookDX += e.movementX; IN.lookDY += e.movementY; } });
  document.addEventListener('mousedown', e => { if (!locked() || UI.open) return; if (e.button === 0) attack(); if (e.button === 2) startBlock(); if (e.button === 1) { castSpell(); e.preventDefault(); } });
  document.addEventListener('mouseup', e => { if (e.button === 2) endBlock(); });
  let wheelAcc = 0, wheelT = 0;
  document.addEventListener('wheel', e => { if (!locked() || UI.open) return; wheelAcc += e.deltaY; if (Math.abs(wheelAcc) < 50 || performance.now() - wheelT < 150) return; wheelT = performance.now(); UI.nextSpell(wheelAcc < 0 ? -1 : 1); wheelAcc = 0; }, { passive: true });
  document.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => { IN.keys = {}; endBlock(); IN.joy = null; joyPid = null; IN.look = null; homeJoy(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { IN.keys = {}; endBlock(); } });
  window.addEventListener('resize', () => { if (IN.touch) document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth); });
  // --- гироскоп: поворот камеры движением телефона (интегрируем угловую скорость devicemotion) ---
  // Оси: Chromium (Chrome/WebView на Android) отдаёт rotationRate как alpha=X, beta=Y, gamma=Z (не по спецификации,
  // см. device_motion_event_pump.cc); WebKit/Gecko — по спецификации: alpha=Z, beta=X, gamma=Y.
  // Положение телефона определяем по вектору силы тяжести из акселерометра, поэтому маппинг не зависит от того,
  // как держат телефон (вертикально, под 45°, лёжа) и от угла поворота экрана (90°/270°).
  // Рыскание = проекция угловой скорости на мировую вертикаль; тангаж = вокруг горизонтальной оси экрана.
  const UA = navigator.userAgent, isIOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const chromiumAxes = /Android/.test(UA) && /Chrome|Chromium|wv\)/.test(UA) && !/Firefox/.test(UA);
  let gyroBound = false, gyroLast = 0, gyroSamples = 0; const gyroDbg = { wx: 0, wy: 0, wz: 0, ux: 0, uy: 0, uz: 0, ang: 0, yaw: 0, pitch: 0 };
  const screenAngle = () => (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (typeof window.orientation === 'number' ? (window.orientation + 360) % 360 : 0);
  function onMotion(e) {
    const r = e.rotationRate, g = e.accelerationIncludingGravity; if (!r || r.alpha == null || !g || g.x == null || isNaN(g.x)) return;
    const now = performance.now(); const dt = gyroLast ? Math.min(0.06, (now - gyroLast) / 1000) : 0; gyroLast = now; gyroSamples++; if (gyroSamples > 3) IN.gyroOk = true;
    const D = Math.PI / 180; let wx, wy, wz; // угловые скорости вокруг осей устройства X (короткая), Y (длинная), Z (из экрана), рад/с
    if (chromiumAxes) { wx = r.alpha * D; wy = r.beta * D; wz = r.gamma * D; } else { wx = r.beta * D; wy = r.gamma * D; wz = r.alpha * D; }
    const gl = Math.hypot(g.x, g.y, g.z) || 1; let ux = g.x / gl, uy = g.y / gl, uz = g.z / gl; if (isIOS) { ux = -ux; uy = -uy; uz = -uz; } // «вверх» в системе устройства
    Object.assign(gyroDbg, { wx, wy, wz, ux, uy, uz, ang: screenAngle() });
    if (!dt || !G || !L || UI.open || P.dead || !IN.touch || !OPTS.gyro) return;
    // горизонтальная ось экрана («вправо»): перпендикуляр к вертикали и нормали экрана; лёжа плашмя — берём из ориентации экрана
    let hx = uy, hy = -ux, hz = 0; const hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl;
    const ang = gyroDbg.ang, sx = ang === 0 ? 1 : ang === 180 ? -1 : 0, sy = ang === 90 ? -1 : ang === 270 ? 1 : 0;
    const flat = Math.min(1, Math.max(0, (Math.abs(uz) - 0.75) / 0.2)); if (flat > 0) { hx = hx * (1 - flat) + sx * flat; hy = hy * (1 - flat) + sy * flat; const l2 = Math.hypot(hx, hy) || 1; hx /= l2; hy /= l2; }
    let yawRate = wx * ux + wy * uy + wz * uz;   // + = поворот влево (против часовой, если смотреть сверху)
    let pitchRate = -(wx * hx + wy * hy);        // + = верх экрана отклоняется от игрока (взгляд вверх)
    if (OPTS.gyroMirror) { yawRate = -yawRate; pitchRate = -pitchRate; }
    const dz = 0.02, k = OPTS.gyroSens || 1; const soft = v => Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz);
    gyroDbg.yaw = yawRate; gyroDbg.pitch = pitchRate;
    IN.gyroYaw += soft(yawRate) * dt * k; IN.gyroPitch += soft(pitchRate) * dt * k;
  }
  function gyroStart() {
    if (gyroBound || !IN.touch || !OPTS.gyro || !('DeviceMotionEvent' in window)) return;
    const bind = () => { if (gyroBound) return; gyroBound = true; window.addEventListener('devicemotion', onMotion, { passive: true }); };
    if (typeof DeviceMotionEvent.requestPermission === 'function') { DeviceMotionEvent.requestPermission().then(st => { if (st === 'granted') bind(); else { OPTS.gyro = false; saveOpts(); log('Нет доступа к гироскопу', 'red'); } }).catch(() => { }); } else bind();
  }
  // Полный экран + фиксация альбомной ориентации (для игры из браузера; в APK ориентация задана манифестом)
  function fullscreen() {
    const el = document.documentElement; const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen ? (el.webkitRequestFullscreen(), Promise.resolve()) : Promise.reject();
    return Promise.resolve(p).then(() => { if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape').catch(() => { }); }).catch(() => { });
  }
  const gyroStatus = () => { if (!('DeviceMotionEvent' in window)) return 'датчики движения недоступны'; if (!gyroBound) return 'гироскоп: ждёт первого касания экрана'; if (!IN.gyroOk) return 'гироскоп: событий нет (нет датчика или нет доступа)'; const d = gyroDbg; const tilt = Math.round(Math.acos(Math.min(1, Math.abs(d.uz))) * 180 / Math.PI); return `гироскоп ✓ · экран ${d.ang}° · наклон ${tilt}° · оси ${chromiumAxes ? 'Chromium' : 'спец.'} · ω ${(d.wx * 57.3).toFixed(0)} ${(d.wy * 57.3).toFixed(0)} ${(d.wz * 57.3).toFixed(0)}°/с`; };
  hudc.addEventListener('pointerdown', () => gyroStart(), { passive: true });
  setMode(isTouchDevice()); homeJoy(); document.body.classList.add('unlocked');
  return { setMode, tryLock, locked, homeJoy, gyroStart, gyroStatus, fullscreen, get touch() { return IN.touch; }, get gyroReady() { return gyroBound; }, get isApp() { return /GrimholdApp/.test(UA); } };
})();
