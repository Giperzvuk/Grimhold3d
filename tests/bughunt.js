// Багхант v1.5: рельеф, дома, предметы-модели, мини-игры, озвучка, утечки
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const file = process.argv[2] || require('path').resolve(__dirname, '..', 'game/index.html');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 890, height: 400 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
  const ev = (fn, a) => p.evaluate(fn, a); const wait = ms => p.waitForTimeout(ms);
  const bad = []; const check = (name, ok, info) => { console.log((ok ? 'OK   ' : 'BUG  ') + name + (info !== undefined ? ' — ' + info : '')); if (!ok) bad.push(name + ': ' + info); };

  await p.addInitScript(() => { try { const o = JSON.parse(localStorage.getItem('grimhold_opts') || '{}'); o.updates = false; localStorage.setItem('grimhold_opts', JSON.stringify(o)); } catch (e) { } });

  await p.goto('file://' + path.resolve(file)); await wait(2500);
  await ev(() => { UI.newGame(); UI.closeAll(); }); await wait(2500);

  // --- 1. Рельеф: сущности стоят на земле, не парят и не тонут ---
  for (const lvl of ['village', 'forest']) {
    await ev(l => { loadLevel(l, WORLDS[l].spawn); UI.closeAll(); }, lvl); await wait(1800);
    const r = await ev(() => {
      const off = [];
      const test = (list, get, tag) => { for (const e of list) { const m = get(e); if (!m || !m.position) continue; const g = Terrain.h(m.position.x, m.position.z); const d = m.position.y - g; if (d < -0.6 || d > 2.6) off.push(tag + ' ' + (e.id || e.item || '') + ' d=' + d.toFixed(2)); } };
      test(L.npcs, n => n.mesh, 'npc'); test(L.enemies, e => e.mesh, 'enemy'); test(L.pickups, k => k.mesh, 'pickup'); test(L.chests, c => c.mesh, 'chest');
      return { off: off.slice(0, 6), n: L.npcs.length + L.enemies.length + L.pickups.length + L.chests.length };
    });
    check('рельеф: сущности на земле (' + lvl + ')', r.off.length === 0, r.off.length ? r.off.join('; ') : r.n + ' объектов');
  }
  // игрок не проваливается и не застревает при ходьбе по склону
  const walk = await ev(async () => {
    P.x = cw(20); P.z = cw(24); P.y = 0; const start = [P.x, P.z]; const seen = [];
    for (let i = 0; i < 120; i++) { IN.keys.KeyW = true; P.yaw = i * 0.05; await new Promise(r => requestAnimationFrame(r)); seen.push(P.gy); }
    IN.keys.KeyW = false; return { moved: Math.hypot(P.x - start[0], P.z - start[1]) > 1, minGy: Math.min(...seen), maxGy: Math.max(...seen), nan: seen.some(v => !isFinite(v)), py: P.y };
  });
  check('ходьба по склону: игрок движется, высота конечна', walk.moved && !walk.nan && walk.py >= 0, `сдвиг=${walk.moved} gy ${walk.minGy.toFixed(1)}..${walk.maxGy.toFixed(1)} nan=${walk.nan}`);

  // --- 2. Дома: вход, интерьер, выход ---
  const houses = await ev(() => Object.keys(HOUSES));
  check('дома сгенерированы', houses.length === 4, houses.join(','));
  for (const h of houses) {
    const res = await ev(async id => {
      const d = WORLDS.village.doors.find(x => x.to === id);
      loadLevel('village', { x: d.cx, z: d.cz + 1, yaw: 0 }); UI.closeAll();
      await new Promise(r => setTimeout(r, 900));
      P.x = cw(d.cx); P.z = cw(d.cz) + 1.2; const t = findInteract();
      const label = t && t.label;
      loadLevel(id, WORLDS[id].spawn); UI.closeAll(); await new Promise(r => setTimeout(r, 900));
      const inside = { name: L.def.name, props: L.group.items.size, solidAtSpawn: blocked(P.x, P.z, P.r) };
      const back = findInteract(); // выход должен быть рядом со спавном
      loadLevel('village', WORLDS[id].doors[0].spawn); UI.closeAll(); await new Promise(r => setTimeout(r, 700));
      return { label, inside, back: back && back.label, outOk: !blocked(P.x, P.z, P.r) };
    }, h);
    check('дом ' + h + ': дверь снаружи', !!res.label && /Войти/.test(res.label), res.label);
    check('дом ' + h + ': интерьер и спавн свободен', !res.inside.solidAtSpawn && res.inside.props > 3, `${res.inside.name}, объектов ${res.inside.props}`);
    check('дом ' + h + ': выход наружу свободен', res.outOk, res.back || '');
  }

  // --- 3. Предметы-модели ---
  const items = await ev(() => {
    const icons = [...new Set(Object.keys(ITEMS).map(k => ITEMS[k].icon))];
    const missing = icons.filter(i => !Items3D.has(i));
    const byIcon = {}; for (const k in ITEMS) if (!byIcon[ITEMS[k].icon]) byIcon[ITEMS[k].icon] = k;
    const before = R.scene.meshes.length; const made = [];
    for (const ic of icons) { const pk = spawnPickup(byIcon[ic], P.x + 1, P.z + 1, 'bh_' + ic); made.push(pk); }
    const vertsBad = made.filter(m => { const mesh = m.mesh.mesh; return !mesh || !mesh.isEnabled(); }).length;
    for (const m of made) { removeMesh(m.mesh); L.pickups.splice(L.pickups.indexOf(m), 1); }
    return { icons: icons.length, missing, vertsBad, leaked: R.scene.meshes.length - before };
  });
  check('модели предметов: есть для всех иконок', items.missing.length === 0, items.missing.length ? items.missing.join(',') : items.icons + ' типов');
  check('модели предметов: инстансы включены и удаляются', items.vertsBad === 0 && items.leaked <= items.icons, `битых=${items.vertsBad} остаток мешей=${items.leaked}`);

  // --- 4. Подбор предмета и золота ---
  const pick = await ev(async () => {
    const n0 = countItem('herb'), g0 = G.gold;
    const pk = spawnPickup('herb', P.x + 0.3, P.z, 'bh_pick'); spawnGold(P.x - 0.3, P.z, 7);
    for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r));
    return { herb: countItem('herb') - n0, gold: G.gold - g0, left: L.pickups.filter(p => p.id === 'bh_pick').length };
  });
  check('подбор предмета и золота', pick.herb === 1 && pick.gold === 7 && pick.left === 0, `трава+${pick.herb} золото+${pick.gold}`);

  // --- 5. Мини-игры: каждая доходит до результата ---
  const games = [['mine', 'Mini.mine(cb)'], ['lockpick', 'Mini.lockpick(2, cb)'], ['smelt', 'Mini.smelt(cb)'], ['forge', 'Mini.forge(cb)'], ['brew', 'Mini.brew(cb)'], ['runes', 'Mini.runes(cb)'], ['haggle', 'Mini.haggle(cb)']];
  for (const [name, call] of games) {
    const r = await p.evaluate(async src => {
      addItem('lockpick', 5, true);
      let done = null; const cb = v => { done = v === undefined ? 'undef' : v; };
      eval(src);
      const drawErr = [];
      for (let i = 0; i < 800 && done === null; i++) { await new Promise(r2 => requestAnimationFrame(r2)); if (Mini.active) { if (Mini.active.tapAt) Mini.active.tapAt(300 - 200 + 50); else Mini.tap(); } }
      const active = !!Mini.active; if (Mini.active) { Mini.stop(); UI.closeAll(); }
      return { done, active, drawErr };
    }, call);
    check('мини-игра ' + name + ': завершается', r.done !== null, 'результат=' + JSON.stringify(r.done));
    await ev(() => { Mini.stop(); UI.closeAll(); }); await wait(150);
  }

  // --- 6. Отмена мини-игры крестиком ---
  const cancel = await ev(async () => { let got = null; Mini.forge(v => { got = v; }); await new Promise(r => setTimeout(r, 300)); Mini.cancel(); await new Promise(r => setTimeout(r, 900)); return { got, open: $('mini').classList.contains('show') }; });
  check('отмена мини-игры возвращает результат и закрывает окно', cancel.got !== null && !cancel.open, JSON.stringify(cancel));

  // --- 7. Озвучка: без ключа молчит, с ключом шлёт корректный запрос ---
  const voice = await ev(async () => {
    const reqs = []; const orig = window.fetch;
    window.fetch = (u, o) => { reqs.push({ u, h: o.headers, b: JSON.parse(o.body) }); return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)) }); };
    OPTS.voiceOn = true; OPTS.voiceKey = ''; OPTS.voiceProxy = '';
    Voice.speak('Проверка без ключа', 'elder'); await new Promise(r => setTimeout(r, 200));
    const noKey = reqs.length;
    OPTS.voiceKey = 'k'; Voice.speak('Проверка с ключом', 'elder'); await new Promise(r => setTimeout(r, 900));
    const withKey = reqs.length, body = reqs[0] && reqs[0].b;
    OPTS.voiceOn = false; OPTS.voiceKey = ''; window.fetch = orig;
    return { noKey, withKey, model: reqs[0] && reqs[0].h.model, hasSpeed: !!(body && body.prosody && body.prosody.speed), fmt: body && body.format };
  });
  check('озвучка: без ключа не шлёт запрос', voice.noKey === 0, 'запросов=' + voice.noKey);
  check('озвучка: с ключом корректный запрос', voice.withKey === 1 && voice.model === 's2.1-pro-free' && voice.fmt === 'mp3' && voice.hasSpeed, JSON.stringify(voice));

  // --- 8. Сохранение/загрузка внутри дома ---
  const save = await ev(async () => {
    loadLevel('house1', WORLDS.house1.spawn); UI.closeAll(); await new Promise(r => setTimeout(r, 800));
    addItem('gem_red', 1, true); Save.write(); const gem = countItem('gem_red');
    loadLevel('village', WORLDS.village.spawn); await new Promise(r => setTimeout(r, 800));
    const ok = Save.load(); await new Promise(r => setTimeout(r, 900));
    return { ok, level: L.id, gem: countItem('gem_red'), same: countItem('gem_red') === gem };
  });
  check('сохранение в доме и загрузка', save.ok && save.level === 'house1' && save.same, JSON.stringify(save));

  // --- 9. Утечки: 6 переходов между уровнями ---
  const leak = await ev(async () => {
    const snap = () => ({ m: R.scene.meshes.length, mat: R.scene.materials.length, tex: R.scene.textures.length, ps: R.scene.particleSystems.length, lg: R.scene.lights.length });
    const seq = ['village', 'house2', 'village', 'forest', 'mine', 'forest', 'village', 'tavern', 'village'];
    for (const l of seq) { loadLevel(l, WORLDS[l].spawn); await new Promise(r => setTimeout(r, 650)); }
    loadLevel('village', WORLDS.village.spawn); await new Promise(r => setTimeout(r, 900));
    const a = snap(); // база: прогреты все кэши, загружена деревня
    for (const l of seq) { loadLevel(l, WORLDS[l].spawn); await new Promise(r => setTimeout(r, 700)); }
    loadLevel('village', WORLDS.village.spawn); await new Promise(r => setTimeout(r, 900));
    const c = snap(); return { a, c };
  });
  const dm = leak.c.m - leak.a.m, dmat = leak.c.mat - leak.a.mat, dtex = leak.c.tex - leak.a.tex;
  check('нет утечки мешей/материалов/текстур после 10 переходов', dm < 30 && dmat < 20 && dtex < 20, `Δмеши=${dm} Δматериалы=${dmat} Δтекстуры=${dtex} частицы=${leak.c.ps} света=${leak.c.lg}`);

  // --- 10. Раскладка HUD и гироскоп не ломают игру ---
  const layout = await ev(async () => {
    Input.setMode(true); Layout.edit(true); await new Promise(r => setTimeout(r, 200));
    const paused = (() => { const t = performance.now(); return true; })();
    OPTS.layout = { bAttack: { x: 0.3, y: 0.4, s: 1.4, a: 0.5 } }; Layout.apply();
    const r1 = $('bAttack').getBoundingClientRect();
    const cx1 = r1.left + r1.width / 2;
    Layout.edit(false); await new Promise(r => setTimeout(r, 200));
    const swing0 = P.swing; $('bAttack').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', bubbles: true })); $('bAttack').dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    OPTS.layout = {}; Layout.apply(); Input.setMode(false);
    return { moved: Math.abs(cx1 - 0.3 * window.innerWidth) < 12, scaled: Math.abs(r1.width - 88 * 1.4) < 12, attacks: P.swing > swing0 };
  });
  check('редактор раскладки: позиция и размер применяются, кнопка работает после', layout.moved && layout.scaled && layout.attacks, JSON.stringify(layout));

  // --- 11. Бой: замах, парирование, стая, отступление ---
  const combat = await ev(async () => {
    loadLevel('village', WORLDS.village.spawn); await new Promise(r => setTimeout(r, 900));
    P.x = cw(20); P.z = cw(26); P.y = 0; G.hp = 100;
    for (const e of [...L.enemies]) killEnemy(e);
    const en = spawnEnemy({ id: 'bh_c', type: 'banditAxe', x: 20, z: 26, temp: true });
    en.x = P.x + 1.5; en.z = P.z; en.state = 'chase'; en.cd = 0;
    let windSeen = 0, parried = false; const hp0 = G.hp;
    for (let i = 0; i < 240; i++) { await new Promise(r => requestAnimationFrame(r)); if (en.wind > 0) windSeen++;
      if (en.wind > 0 && en.wind < 0.2 && !P.blockHold) { P.yaw = Math.atan2(-(en.x - P.x), -(en.z - P.z)); startBlock(); }
      if (en.stagger > 1) parried = true; if (P.blockHold && en.wind <= 0) endBlock(); }
    return { windSeen, parried, hurt: hp0 - G.hp };
  });
  check('бой: замах виден и парируется', combat.windSeen > 10 && combat.parried, JSON.stringify(combat));

  // --- 12. Вода: брод, плавание, урон от падения ---
  const water = await ev(async () => {
    const w = (() => { const m = L.map; for (let z = 0; z < m.length; z++) for (let x = 0; x < m[0].length; x++) if (m[z][x] === 'w') return [x, z]; })();
    P.x = cw(w[0]); P.z = cw(w[1]); P.y = 0; await new Promise(r => setTimeout(r, 300));
    for (let i = 0; i < 40; i++) await new Promise(r => requestAnimationFrame(r));
    const swim = !!P.swim, wade = +(P.wade || 0).toFixed(2);
    P.x = cw(20); P.z = cw(26); for (let i = 0; i < 30; i++) await new Promise(r => requestAnimationFrame(r));
    const hp0 = G.hp; P.y = 14; P.vy = 0; for (let i = 0; i < 150; i++) await new Promise(r => requestAnimationFrame(r));
    return { swim, wade, fallDmg: Math.round(hp0 - G.hp) };
  });
  check('вода и падение', water.swim && water.wade > 1 && water.fallDmg > 5, JSON.stringify(water));

  // --- 13. Перки, аффиксы, поручения, слоты ---
  const rpg = await ev(async () => {
    for (const e of [...L.enemies]) killEnemy(e); UI.closeAll(); await new Promise(r => setTimeout(r, 400));
    const before = Object.keys(G.perks || {}).length; G.lvl = 1; G.xp = 0; gainXp(500);
    await new Promise(r => setTimeout(r, 1100));
    const perkDlg = $('dlg').classList.contains('show') && $('dlgName').textContent.includes('Уровень');
    if (perkDlg) document.querySelector('#dlgOpts .ubtn').click();
    const got = Object.keys(G.perks || {}).length > before;
    let inst = null, named = ''; for (let k = 0; k < 20 && !(inst && (inst.pre || inst.suf)); k++) { inst = affixify({ dur: 10, plus: 0, ench: null }, 'sword_iron', 1); named = itemName(Object.assign({ id: 'sword_iron' }, inst)); }
    const task = Tasks.option('smith'); const hasTask = !!task && !!task.label;
    Save.use(2); Save.write(); const slotInfo = Save.info(2); Save.use(0);
    return { perkDlg, got, named, affixed: !!(inst.pre || inst.suf), hasTask, slot2: !!slotInfo && slotInfo.level };
  });
  check('перки: выбор при уровне', rpg.perkDlg && rpg.got, JSON.stringify({ dlg: rpg.perkDlg, got: rpg.got }));
  check('аффиксы предметов', rpg.affixed, rpg.named);
  check('повторяемые поручения', rpg.hasTask, String(rpg.hasTask));
  check('слоты сохранения', !!rpg.slot2, 'слот 3: ' + rpg.slot2);

  // --- 14. Штольня генерируется и проходима ---
  const delve = await ev(async () => {
    loadLevel('delve', WORLDS.delve ? WORLDS.delve.spawn : { x: 5, z: 5 }); await new Promise(r => setTimeout(r, 1200));
    const d = L.def; const sp = d.spawn; P.x = cw(sp.x); P.z = cw(sp.z);
    const blockedSpawn = blocked(P.x, P.z, P.r);
    const exit = findInteract();
    return { name: d.name, rooms: d.props.length, enemies: L.enemies.length, blockedSpawn, exit: exit && exit.label };
  });
  check('боковая штольня: генерируется, спавн свободен, есть выход', !delve.blockedSpawn && delve.enemies > 3 && /Выбраться/.test(delve.exit || ''), JSON.stringify(delve));

  console.log('\nERRORS:', errs.length ? errs.join('\n') : 'none');
  console.log('ИТОГ: ' + (bad.length ? bad.length + ' проблем\n - ' + bad.join('\n - ') : 'проблем не найдено'));
  await b.close();
})();
