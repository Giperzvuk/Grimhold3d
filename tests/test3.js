const { chromium } = require('playwright');
const path = require('path');
const file = process.argv[2] || (process.argv[2] || require('path').resolve(__dirname, '..', 'game/index.html'));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 890, height: 400 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await page.addInitScript(() => { try { const o = JSON.parse(localStorage.getItem('grimhold_opts') || '{}'); o.updates = false; localStorage.setItem('grimhold_opts', JSON.stringify(o)); } catch (e) { } });
  await page.goto('file://' + path.resolve(__dirname, file));
  await page.waitForTimeout(1500);
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const shot = n => page.screenshot({ path: 'shots/t_' + n + '.png' });
  const wait = ms => page.waitForTimeout(ms);
  const bad = await ev(() => {
    const out = [], PASS = ch => !BLOCK.has(ch) || ch === 'L' || ch === 'K' || ch === 'O';
    for (const id in WORLDS) {
      const w = WORLDS[id]; const chk = (x, z, what) => { if (BLOCK.has(cellAt(w.map, x, z))) out.push(id + ':' + what + '@' + x + ',' + z + '=' + cellAt(w.map, x, z)); };
      w.npcs.forEach(n => chk(n.x, n.z, n.id)); w.enemies.forEach(n => chk(n.x, n.z, n.id)); w.items.forEach(n => chk(n.x, n.z, n.id)); w.chests.forEach(n => chk(n.x, n.z, n.id)); chk(w.spawn.x, w.spawn.z, 'spawn');
      w.props.forEach(p => { if (p.act && p.act !== 'sign' && p.act !== 'read') chk(p.x, p.z, 'act:' + p.act); });
      w.doors.forEach(d => { if (d.floor) chk(d.cx, d.cz, 'door'); const t = WORLDS[d.to]; const s = d.spawn || (t && t.spawn); if (t && s && BLOCK.has(cellAt(t.map, s.x, s.z))) out.push(id + ':doorspawn->' + d.to + '@' + s.x + ',' + s.z); });
      if (w.treasure && !['.', 'g', ','].includes(cellAt(w.map, w.treasure.x, w.treasure.z))) out.push(id + ':treasure cell=' + cellAt(w.map, w.treasure.x, w.treasure.z));
      for (const r of w.map) if (r.length !== w.map[0].length) out.push(id + ': ширина строк неодинакова');
      const seen = new Set(), q = [[w.spawn.x, w.spawn.z]]; seen.add(w.spawn.x + ',' + w.spawn.z);
      while (q.length) { const [x, z] = q.pop(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (PASS(cellAt(w.map, nx, nz)) && !seen.has(nx + ',' + nz)) { seen.add(nx + ',' + nz); q.push([nx, nz]); } } }
      const targets = [].concat(w.npcs.map(n => [n.x, n.z, n.id]), w.enemies.map(n => [n.x, n.z, n.id]), w.chests.map(n => [n.x, n.z, n.id]), w.items.map(n => [n.x, n.z, n.id]), w.props.filter(p => p.act && p.act !== 'sign').map(p => [p.x, p.z, p.act]));
      for (const [x, z, n] of targets) { let ok = false; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) if (seen.has((x + dx) + ',' + (z + dz))) ok = true; if (!ok) out.push(id + ':unreachable ' + n + '@' + x + ',' + z); }
      for (const d of w.doors) { let ok = false; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) if (seen.has((d.cx + dx) + ',' + (d.cz + dz))) ok = true; if (!ok) out.push(id + ':door unreachable ' + d.to); }
    }
    return out;
  });
  console.log('map validation:', bad.length ? '\n  ' + bad.join('\n  ') : 'ok');
  await ev(() => UI.newGame()); await wait(500); await ev(() => UI.hide('dlg')); await wait(700);
  console.log('start inv:', await ev(() => G.inv.map(i => i.id + (i.dur !== undefined ? '(' + i.dur + ')' : '')).join(',')), 'eq:', await ev(() => itemName(weapon())), 'quick:', await ev(() => G.quick.map(u => inst(u) && inst(u).id).join(',')));
  await shot('00_village');
  console.log('fps at start:', await ev(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); })), 'calls:', await ev(() => R.scene.getActiveMeshes().length + ' active meshes'));
  // выживание: вода у колодца
  await ev(() => { G.thirst = 10; P.x = cw(17); P.z = cw(14); P.yaw = 0; }); await wait(300);
  console.log('well prompt:', await ev(() => { const t = findInteract(); return t && t.label; })); await ev(() => interact()); console.log('thirst after well:', await ev(() => Math.round(G.thirst)));
  // рубка дерева
  await ev(() => { addItem('axe_wood', 1, true); equipItem(G.inv.find(i => i.id === 'axe_wood').uid); P.x = cw(3); P.z = cw(4); P.yaw = Math.PI / 2; }); await wait(300);
  console.log('tree prompt:', await ev(() => { const t = findInteract(); return t && t.label; }));
  for (let i = 0; i < 3; i++) { await ev(() => interact()); await wait(3000); }
  console.log('wood after chop:', await ev(() => countItem('wood')), 'cut:', await ev(() => JSON.stringify(G.cut)));
  await shot('01_chopped');
  // копание
  await ev(() => { addItem('shovel', 1, true); equipItem(G.inv.find(i => i.id === 'shovel').uid); P.x = cw(17); P.z = cw(19); P.yaw = 0; P.pitch = -0.6; }); await wait(300);
  console.log('dig prompt:', await ev(() => { const t = findInteract(); return t && t.label; })); await ev(() => interact()); await wait(700); console.log('dug:', await ev(() => JSON.stringify(G.dug)));
  await ev(() => { P.pitch = 0; });
  // плавильня: мини-игра
  await ev(() => { addItem('ore', 6, true); P.x = cw(21); P.z = cw(18); P.yaw = 0; }); await wait(300);
  console.log('furnace prompt:', await ev(() => { const t = findInteract(); return t && t.label; })); await ev(() => interact()); await wait(200);
  await ev(() => document.querySelectorAll('#craftList .item')[0].click()); await wait(100); await ev(() => document.querySelectorAll('#craftList .item')[0].click()); await wait(300); await shot('02_smelt');
  let smeltInfo = ''; for (let i = 0; i < 120; i++) { const st = await ev(() => Mini.active ? (Mini.active.temp < 0.6 ? (Mini.tap(), 'tap') : 'wait') + ' ' + Mini.active.t.toFixed(1) + ' ' + Mini.active.temp.toFixed(2) + ' ' + Mini.active.good.toFixed(2) : 'done'); smeltInfo = st; if (st === 'done') break; await wait(250); } console.log('smelt last state:', smeltInfo);
  await wait(1200); console.log('ingots after smelt:', await ev(() => countItem('ingot')), 'mini open:', await ev(() => UI.ids.filter(i => document.getElementById(i).classList.contains('show')).join(',')));
  await ev(() => UI.closeAll());
  // ковка
  await ev(() => { addItem('ingot', 4, true); addItem('wood', 3, true); P.x = cw(19); P.z = cw(18); P.yaw = 0; }); await wait(300);
  console.log('anvil prompt:', await ev(() => { const t = findInteract(); return t && t.label; })); await ev(() => interact()); await wait(200);
  await ev(() => { const items = [...document.querySelectorAll('#craftList .item')]; items.find(e => e.textContent.includes('Железный меч')).click(); }); await wait(100); await ev(() => { const items = [...document.querySelectorAll('#craftList .item')]; items.find(e => e.textContent.includes('Железный меч')).click(); }); await wait(300); await shot('03_forge');
  for (let i = 0; i < 3; i++) { await ev(() => new Promise(r => { const chk = () => { const s = Mini.active; if (!s) return r(); const m = Mini.pingpong(s.t, 1.1); if (m >= s.zone && m <= s.zone + 0.18) { Mini.tap(); r(); } else setTimeout(chk, 20); }; chk(); })); await wait(200); }
  await wait(1000); console.log('forged:', await ev(() => G.inv.filter(i => i.id === 'sword_iron').map(i => itemName(i) + ' dur ' + i.dur).join(',')));
  // улучшение и ремонт
  await ev(() => { Craft.tab = 'upgrade'; Craft.render(); }); await shot('04_upgrade'); await ev(() => UI.closeAll());
  // взлом сундука
  await ev(() => { addItem('lockpick', 5, true); P.x = cw(3); P.z = cw(4); P.yaw = 0; }); await wait(300);
  console.log('chest prompt:', await ev(() => { const t = findInteract(); return t && t.label; })); await ev(() => interact()); await wait(300); await shot('05_lockpick');
  for (let i = 0; i < 3; i++) { await ev(() => new Promise(r => { const chk = () => { const s = Mini.active; if (!s || s.res !== null) return r(); const speed = 1.6 - 0.25, m = Mini.pingpong(s.t, speed), z = s.zones[s.pin]; if (m >= z && m <= z + 0.2) { Mini.tap(); r(); } else setTimeout(chk, 15); }; chk(); })); await wait(150); }
  await wait(1000); console.log('chest unlocked:', await ev(() => JSON.stringify(G.unlocked)), 'lockpicks left:', await ev(() => countItem('lockpick')));
  await ev(() => { if (Mini.active) Mini.stop(); UI.closeAll(); interact(); }); await wait(200); console.log('chest opened:', await ev(() => JSON.stringify(G.opened)));
  // погода и температура
  await ev(() => { G.weather.type = 'snow'; G.weather.until = 500; G.time = 0.95; }); await wait(1500); await shot('06_snow_night'); console.log('warmth target env:', await ev(() => envTemp().toFixed(1)), 'warmth:', await ev(() => Math.round(G.warmth)));
  await ev(() => { G.weather.type = 'rain'; G.time = 0.5; }); await wait(600); await shot('07_rain');
  await ev(() => { G.weather.type = 'clear'; G.time = 0.4; });
  // таверна: сон платный, кладовая, дверь
  await ev(() => changeLevel('tavern', { x: 7, z: 8, yaw: 0 })); await wait(1300); await shot('08_tavern');
  await ev(() => { P.x = cw(8); P.z = cw(2); P.yaw = -Math.PI / 2; }); await wait(300); console.log('door prompt:', await ev(() => { const t = findInteract(); return t && t.label; })); await ev(() => interact()); await wait(200);
  console.log('door state:', await ev(() => JSON.stringify(G.doors)), 'blocked at door:', await ev(() => blocked(cw(9), cw(2), 0.3)));
  await ev(() => { const g = G.gold; UI.sleep(true); console.log('gold', g, '->', G.gold); UI.doSleep(4); }); await wait(1300); console.log('slept; gold:', await ev(() => G.gold), 'day:', await ev(() => G.day));
  // Свен → квест брата; лес: атаман — уговор
  await ev(() => Dialog.start('drunk')); await ev(() => { const b = [...document.querySelectorAll('#dlgOpts .ubtn')].find(b => b.textContent.includes('Хродгар')); if (b) b.click(); }); await ev(() => document.querySelectorAll('#dlgOpts .ubtn')[0].click()); await ev(() => UI.closeAll());
  console.log('cousin quest:', await ev(() => G.quests.cousin));
  await ev(() => changeLevel('forest', { x: 2, z: 20, yaw: -Math.PI / 2 })); await wait(1300);
  await ev(() => { const en = L.enemies.find(e => e.id === 'f_chief'); P.x = en.x - 2.5; P.z = en.z; P.yaw = Math.atan2(-(en.x - P.x), -(en.z - P.z)); }); await wait(400); console.log('chief prompt:', await ev(() => { const t = findInteract(); return t && t.label; }));
  await ev(() => { G.gold = 200; interact(); }); await wait(200); await shot('09_chief_talk');
  await ev(() => document.querySelectorAll('#dlgOpts .ubtn')[0].click()); await ev(() => document.querySelectorAll('#dlgOpts .ubtn')[0].click()); await wait(200); await ev(() => UI.closeAll());
  console.log('chief gone:', await ev(() => G.flags.chiefGone), 'bandits left:', await ev(() => L.enemies.filter(e => e.type.startsWith('bandit') || e.type === 'chief').length), 'gold:', await ev(() => G.gold));
  // книга Эйнара → Ансгар
  await ev(() => { addItem('ledger', 1, true); Quests.check(); P.x = cw(11); P.z = cw(37); P.yaw = 0; }); await wait(300); console.log('arrow quest:', await ev(() => G.quests.arrow), 'hunter prompt:', await ev(() => { const t = findInteract(); return t && t.label; }));
  await ev(() => Dialog.start('hunter')); await ev(() => { const b = [...document.querySelectorAll('#dlgOpts .ubtn')].find(b => b.textContent.includes('убил')); if (b) b.click(); }); await wait(100); await shot('10_ansgar');
  await ev(() => document.querySelectorAll('#dlgOpts .ubtn')[0].click()); await ev(() => document.querySelectorAll('#dlgOpts .ubtn')[0].click()); await ev(() => UI.closeAll());
  console.log('arrow:', await ev(() => G.quests.arrow), 'ansgarGone:', await ev(() => G.flags.ansgarGone), 'hunter npc left:', await ev(() => L.npcs.some(n => n.def.id === 'hunter')));
  // клад
  await ev(() => { addItem('treasure_map', 1, true); Quests.check(); P.x = cw(33); P.z = cw(35); P.yaw = 0; P.pitch = -0.6; }); await wait(300); console.log('treasure quest:', await ev(() => G.quests.treasure), 'dig prompt:', await ev(() => { const t = findInteract(); return t && t.label + ' @' + t.cx + ',' + t.cz; }));
  await ev(() => interact()); await wait(700); console.log('treasure found:', await ev(() => G.flags.treasureFound), 'gold:', await ev(() => G.gold)); await ev(() => { P.pitch = 0; });
  // шахта: самоцветы, отмычка-дверь
  await ev(() => changeLevel('mine', { x: 20, z: 2, yaw: Math.PI })); await wait(1300);
  await ev(() => { addItem('pickaxe', 1, true); P.x = cw(11); P.z = cw(28); P.yaw = Math.PI / 2; }); await wait(300); console.log('K door prompt:', await ev(() => { const t = findInteract(); return t && t.label; }));
  await ev(() => { P.x = cw(7); P.z = cw(30); P.yaw = Math.PI; }); await wait(300); console.log('gem prompt:', await ev(() => { const t = findInteract(); return t && t.label; }));
  await ev(() => interact()); await wait(300); await ev(() => Mini.tap()); await wait(1000); console.log('gems:', await ev(() => G.inv.filter(i => ITEMS[i.id].type === 'gem').map(i => i.id + 'x' + i.q).join(',')));
  await shot('11_mine_gems');
  // крипта: Ворлат монолог, дневник, алтарь-зачарование
  await ev(() => changeLevel('crypt', { x: 19, z: 2, yaw: Math.PI })); await wait(1300);
  await ev(() => { P.x = cw(21); P.z = cw(3); P.yaw = 0; }); await wait(300); console.log('wall prompt:', await ev(() => { const t = findInteract(); return t && t.label; })); await ev(() => interact()); await wait(200); await shot('12_inscription');
  await ev(() => { const b = [...document.querySelectorAll('#dlgOpts .ubtn')].find(b => b.textContent.includes('вслух')); if (b) b.click(); }); await wait(300); console.log('wraith spawned:', await ev(() => L.enemies.some(e => e.id.startsWith('aloud'))));
  await ev(() => { P.x = cw(29); P.z = cw(31); P.yaw = Math.atan2(-(cw(31) - P.x), -(cw(33) - P.z)); G.unlocked['crypt:31,27'] = 1; }); await wait(600); console.log('vorlat talk:', await ev(() => G.flags.vorlatTalk), 'dlg open:', await ev(() => UI.open)); await shot('13_vorlat');
  await ev(() => UI.closeAll());
  await ev(() => { for (const en of [...L.enemies]) if (en.id === 'd_boss') damageEnemy(en, 150, false, 'spell'); }); await wait(300); console.log('boss phase summons:', await ev(() => L.enemies.filter(e => e.id.startsWith('summon')).length));
  await ev(() => { for (const en of [...L.enemies]) if (en.id === 'd_boss') damageEnemy(en, 999, false, 'spell'); }); console.log('key_seal:', await ev(() => countItem('key_seal')));
  // зачарование на алтаре (деревня)
  await ev(() => changeLevel('village', { x: 11, z: 10, yaw: 0 })); await wait(1300);
  await ev(() => { G.perkPending = 0; if ($('dlg').classList.contains('show')) UI.hide('dlg'); });
  await ev(() => { addItem('rune_fire', 1, true); addItem('gem_red', 1, true); P.x = cw(11); P.z = cw(10); P.yaw = 0; }); await wait(300); console.log('altar prompt:', await ev(() => { const t = findInteract(); return t && t.label; }));
  await ev(() => interact()); await wait(200); console.log('altar dlg:', await ev(() => $('dlg').classList.contains('show'))); await ev(() => { const b = [...document.querySelectorAll('#dlgOpts .ubtn')].find(b => b.textContent === 'Зачаровать вещь'); if (b) b.click(); }); await wait(200); await ev(() => { document.querySelectorAll('#craftList .item')[0].click(); }); await wait(100); await ev(() => { [...document.querySelectorAll('#craftList .item')].find(e => e.textContent.includes('Руна')).click(); }); await wait(100); await ev(() => { [...document.querySelectorAll('#craftList .item')].find(e => e.textContent.includes('Гранат')).click(); }); await wait(100); await shot('14_altar');
  await ev(() => { [...document.querySelectorAll('#craftList .ubtn')].find(b => b.textContent === 'Зачаровать').click(); }); await wait(4500); await shot('15_runes');
  await ev(() => { const s = Mini.active; if (s) { const glyphs = ['runeFire', 'runeFrost', 'runeLife', 'runeAsh']; } });
  // вводим последовательность через приватный seq — читаем из замыкания невозможно; эмулируем 4 тапа по позициям 0..3 и смотрим результат
  const runeRes = await ev(() => new Promise(r => { const s = Mini.active; if (!s) return r('no mini'); const tries = []; s.tapAt(600 / 2 - 150); setTimeout(() => r(s.res === null ? 'continuing' : s.res ? 'ok' : 'fail'), 200); }));
  console.log('rune input:', runeRes); await ev(() => { if (Mini.active) { Mini.stop(); } UI.closeAll(); });
  // концовка: сжечь ключ
  await ev(() => { G.quests.seal = 1; Dialog.start('healer'); }); await ev(() => { const b = [...document.querySelectorAll('#dlgOpts .ubtn')].find(b => b.textContent.includes('Ключ')); if (b) b.click(); }); await ev(() => document.querySelectorAll('#dlgOpts .ubtn')[0].click()); await wait(200); await shot('16_ending'); await ev(() => UI.closeAll());
  console.log('ending:', await ev(() => G.flags.ending), 'seal:', await ev(() => G.quests.seal));
  // сохранение/загрузка экземпляров
  await ev(() => Save.write()); console.log('save/load:', await ev(() => Save.load()), 'inv count:', await ev(() => G.inv.length), 'weapon:', await ev(() => weapon() && itemName(weapon())));
  await wait(500);
  await ev(() => UI.toggle('inv')); await wait(300); await shot('17_inv'); await ev(() => UI.closeAll());
  await ev(() => UI.toggle('map')); await wait(300); await shot('18_map'); await ev(() => UI.closeAll());
  await ev(() => UI.menu(true)); await wait(200); await shot('19_menu'); await ev(() => UI.hide('menu'));
  const fps = await ev(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps (swiftshader):', fps, 'draw calls:', await ev(() => R.scene.getActiveMeshes().length + ' active meshes'));
  console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
  await browser.close();
})();
