// ---------- Интерфейс, сохранения, HUD (v0.3) ----------
'use strict';
const HAS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const IS_APP = /GrimholdApp/.test(navigator.userAgent);
const OPTS = (() => { try { return Object.assign({ music: 0.55, sfx: 0.5, hires: false, vibro: true, tapAttack: true, sens: 1, invertY: false, shadows: 'low', gyro: true, gyroSens: 1.4, gyroMirror: false, voiceOn: false, voiceKey: '', voiceProxy: '', voiceVol: 0.9, voiceSpeed: 1, voiceRefs: {}, updates: true }, JSON.parse(localStorage.getItem('grimhold_opts') || '{}')); } catch (e) { return { music: 0.55, sfx: 0.5, hires: false, vibro: true, tapAttack: true, sens: 1, invertY: false, gyro: true, gyroSens: 1.4, gyroMirror: false, voiceOn: false, voiceKey: '', voiceProxy: '', voiceVol: 0.9, voiceSpeed: 1, voiceRefs: {}, updates: true }; } })();
function saveOpts() { try { localStorage.setItem('grimhold_opts', JSON.stringify(OPTS)); } catch (e) { } }
function applyOpts() { MUSIC.setVolume(OPTS.music); SFX.setVolume(OPTS.sfx); HIRES = OPTS.hires; R.setHires(HIRES); R.setShadowQuality(OPTS.shadows || 'low'); resize(); }

const Save = {
  key: 'grimhold_save', slot: 0, SLOTS_N: 3,
  keyOf(i) { return i ? 'grimhold_save' + i : 'grimhold_save'; },
  has(i) { try { return !!localStorage.getItem(this.keyOf(i === undefined ? this.slot : i)); } catch (e) { return false; } },
  // краткая сводка слота для меню: где, какой уровень, когда
  info(i) { try { const raw = localStorage.getItem(this.keyOf(i)); if (!raw) return null; const d = JSON.parse(raw); const w = WORLDS[d.level]; const t = d.savedAt ? new Date(d.savedAt) : null;
      return { level: (w && w.name) || d.level || '?', lvl: d.lvl || 1, day: d.day || 1, when: t ? `${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : '' }; } catch (e) { return null; } },
  use(i) { this.slot = i; this.key = this.keyOf(i); try { localStorage.setItem('grimhold_slot', String(i)); } catch (e) { } },
  write(silent) {
    if (!G || !L || P.dead || G.hp <= 0) return;
    if (silent && (G.hp < effMaxHp() * 0.25 || G.poison > 0 || G.thirst <= 0 || G.hunger <= 0)) return; // автосейв не должен вести в петлю смерти
    G.pos = { wx: P.x, wz: P.z, yaw: P.yaw };
    G.savedAt = Date.now();
    try { localStorage.setItem(this.key, JSON.stringify(G)); if (!silent) log('Игра сохранена · слот ' + (this.slot + 1), 'blue'); } catch (e) { log('Не удалось сохранить', 'red'); }
  },
  auto() { this.write(true); },
  merge(base, d) { for (const k in d) { if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) this.merge(base[k], d[k]); else base[k] = d[k]; } return base; },
  load() {
    try { const s = localStorage.getItem(this.key); if (!s) return false; const d = JSON.parse(s); const vcmp = (x, y) => { const a = String(x).split('.').map(Number), b = String(y).split('.').map(Number); for (let i = 0; i < Math.max(a.length, b.length); i++) { const d0 = (a[i] || 0) - (b[i] || 0); if (d0) return d0; } return 0; }; if (!d.v || vcmp(d.v, '0.3') < 0) { log('Сохранение старой версии несовместимо — начата новая игра', 'red'); return false; } const g2 = this.merge(newState(), d); g2.v = VERSION;
      // санитизация: неизвестные предметы/заклинания/уровень
      g2.inv = (g2.inv || []).filter(i => i && ITEMS[i.id]); const uids = new Set(g2.inv.map(i => i.uid)); for (const k in g2.eq) if (g2.eq[k] && !uids.has(g2.eq[k])) g2.eq[k] = null; g2.quick = (g2.quick || []).concat([null, null, null, null]).slice(0, 4).map(u => uids.has(u) ? u : null);
      g2.spells = (g2.spells || ['fire']).filter(sp => SPELLS[sp]); if (!g2.spells.length) g2.spells = ['fire']; if (!SPELLS[g2.spell] || !g2.spells.includes(g2.spell)) g2.spell = g2.spells[0];
      if (!WORLDS[g2.level]) { g2.level = 'village'; g2.pos = null; }
      g2.hp = Math.max(g2.hp, effMaxHpOf(g2) * 0.3); g2.poison = 0; G = g2; } catch (e) { return false; }
    P.dead = false; if (P.deathTimer) { clearTimeout(P.deathTimer); P.deathTimer = null; } $('death').classList.remove('show');
    try { loadLevel(G.level, G.pos); } catch (e) { console.error(e); G.level = 'village'; G.pos = null; loadLevel('village'); } return true;
  }
};

try { const sl = +localStorage.getItem('grimhold_slot'); if (sl >= 0 && sl < Save.SLOTS_N) Save.use(sl); } catch (e) { }

const UI = {
  open: false, tgt: null, tgtT: 0, promptT: 0, saveT: 0, toastEl: null, iconCache: {},
  ids: ['inv', 'journal', 'dlg', 'shop', 'menu', 'death', 'craft', 'map', 'sleep', 'mini'],
  // Экран смерти: реплика подбирается под обстоятельства кончины
  deathLine() {
    const L1 = [
      'Пепел перевала принимает ещё одного странника. Очередь, кстати, небольшая — тут мало кто доходит.',
      'Ты умер. Деревня узнает об этом послезавтра, и то если кто-нибудь пойдёт за грибами.',
      'Похороны за счёт общины не предусмотрены. Община просила передать, что искренне сочувствует.',
      'Ты умер героем. То есть так же, как все остальные, но с более пафосным выражением лица.',
      'Мир не изменился. Он и не собирался — это была твоя идея, не его.'
    ];
    if (G && G.hunger <= 0) return 'Ты умер от голода. В деревне, где хлеб стоит две монеты. Две.';
    if (G && G.thirst <= 0) return 'Ты умер от жажды. Рядом с рекой. Мы все немного в шоке.';
    if (G && G.warmth < 10) return 'Ты замёрз. Плащ, между прочим, продавали. Дважды.';
    if (G && G.poison > 0) return 'Яд. Противоядие варится из двух ингредиентов, оба росли по дороге сюда.';
    return L1[Math.floor((G ? G.stats.deaths || 0 : 0) + Math.random() * 2) % L1.length];
  },
  show(id) { this.shieldT = performance.now() + 400; if (id === 'death') { const dt = $('deathText'); if (dt) dt.textContent = this.deathLine(); }
    if (id === 'death') { const has = Save.has(); $('deathLoad').classList.toggle('main', has); $('deathLoad').classList.toggle('dim', !has); $('deathNew').classList.toggle('main', !has); } $(id).classList.add('show'); if (id === 'inv') this.renderInv(); if (id === 'journal') this.renderJournal(); if (id === 'map') this.renderMap(); this.sync(); },
  hide(id) { $(id).classList.remove('show'); if (id === 'dlg' && typeof Voice !== 'undefined') Voice.stop(); this.needFrame = true; this.sync(); },
  toggle(id) { if (!G || (P && P.dead)) return; if ($(id).classList.contains('show')) this.hide(id); else { this.closeAll(); this.show(id); } },
  closeAll() { if (Mini.active) { const sp = Mini.active; Mini.cancel(); Mini.active = null; if (sp.done) sp.done(); } for (const id of this.ids) if ((id !== 'menu' || G) && !(id === 'death' && P && P.dead)) $(id).classList.remove('show'); Mini.stop(); this.sync(); },
  sync() { this.open = this.ids.some(id => $(id).classList.contains('show')); if (this.open && document.pointerLockElement) document.exitPointerLock(); if (this.open) { IN.joy = null; IN.look = null; endBlock(); if (typeof Input !== 'undefined') Input.homeJoy(); } },
  icon(name) { if (!this.iconCache[name]) { const c = TEX.ART[name]; this.iconCache[name] = c ? `<img class="ico" src="${c.toDataURL()}">` : ''; } return this.iconCache[name]; },
  itemInfo(it, i) {
    const p = [];
    if (it.dmg) p.push('урон ' + (i ? Math.round(instDmg(i)) : it.dmg) + (it.spd ? (it.spd <= 0.3 ? ', быстрое' : it.spd >= 0.55 ? ', медленное' : '') : '') + (it.reach >= 3 ? ', длинное' : ''));
    if (it.armor) p.push('броня ' + (i ? Math.round(instArmor(i)) : it.armor)); if (it.hp && it.type === 'potion') p.push('+' + it.hp + ' зд.'); if (it.mp && it.type === 'potion') p.push('+' + it.mp + ' маны');
    if (it.type === 'amulet') p.push(it.mp ? '+' + it.mp + ' маны' : '+' + it.hp + ' здоровья'); if (it.dmgMul) p.push('+' + Math.round((it.dmgMul - 1) * 100) + '% урона'); if (it.warm && it.type !== 'potion') p.push('тепло +' + it.warm);
    if (it.food) p.push('сытость +' + it.food + (it.hp && it.type === 'food' ? ', +' + it.hp + ' зд.' : '')); if (it.drink) p.push('жажда +' + it.drink); if (it.cure) p.push('лечит яд'); if (it.warmT) p.push('греет 4 мин'); if (it.tool === 'pick') p.push('кирка'); if (it.tool === 'axe') p.push('рубит деревья'); if (it.tool === 'shovel') p.push('копает');
    if (i && i.dur !== undefined && it.maxDur) p.push(`прочн. ${Math.round(i.dur)}/${it.maxDur}`); if (i && i.ench) p.push(it.type === 'weapon' ? ENCH[i.ench].wDesc : ENCH[i.ench].aDesc);
    return p.join(' · ');
  },
  // Экран сохранений: три слота с локацией, уровнем и временем
  slots() {
    const rows = [];
    for (let i = 0; i < Save.SLOTS_N; i++) { const inf = Save.info(i); rows.push(`<div class="item${Save.slot === i ? ' sel' : ''}"><span>Слот ${i + 1}${Save.slot === i ? ' ·' : ''}</span><span class="hint" style="margin:0">${inf ? `${inf.level} · ур.${inf.lvl} · день ${inf.day} · ${inf.when}` : 'пусто'}</span></div>`); }
    const opts = [];
    for (let i = 0; i < Save.SLOTS_N; i++) {
      if (Save.has(i)) opts.push({ label: 'Загрузить ' + (i + 1), main: i === Save.slot, go: () => { Save.use(i); if (Save.load()) { this.hide('dlg'); this.hide('menu'); } return 'close'; } });
      if (G && L && !P.dead) opts.push({ label: 'Записать в ' + (i + 1), go: () => { Save.use(i); Save.write(); this.hide('dlg'); this.hide('menu'); return 'close'; } });
    }
    opts.push({ label: 'Назад', go: () => { this.menu(true); return 'close'; } });
    Dialog.show({ name: 'Сохранения', html: rows.join(''), voice: null, opts });
  },
  // Настройки онлайн-озвучки (Fish Audio). Ключ хранится только на устройстве игрока.
  voiceSetup() {
    const esc = v => String(v || '').replace(/"/g, '&quot;');
    const body = `<div class="opts" style="text-align:left">
      <label><input type="checkbox" id="vOn" ${OPTS.voiceOn ? 'checked' : ''}> Включить озвучку реплик</label>
      <label style="flex-direction:column;align-items:stretch">Ключ Fish Audio (fish.audio → API keys)<input type="password" id="vKey" value="${esc(OPTS.voiceKey)}" placeholder="вставь ключ" style="width:100%"></label>
      <label style="flex-direction:column;align-items:stretch">Адрес прокси (если браузер блокирует прямой запрос)<input type="text" id="vProxy" value="${esc(OPTS.voiceProxy)}" placeholder="https://твой-сервер/fish" style="width:100%"></label>
      <label>Громкость голоса <input type="range" min="0" max="1" step="0.05" id="vVol" value="${OPTS.voiceVol}"></label>
      <label>Скорость речи <input type="range" min="0.7" max="1.4" step="0.05" id="vSpd" value="${OPTS.voiceSpeed}"></label>
      <label style="flex-direction:column;align-items:stretch">Голос по умолчанию — reference_id с fish.audio (пусто = голос модели)<input type="text" id="vRef" value="${esc((OPTS.voiceRefs || {}).all)}" placeholder="например 7f92f8afb8ec43bf81429cc1c9199cb1" style="width:100%"></label>
      <div class="hint" id="vStat">${Voice.native ? 'Приложение ходит в сеть напрямую — прокси не нужен' : 'Браузер не пускает запрос напрямую (CORS): нужен адрес прокси. В APK работает без него'}</div>
      <div class="hint">Модель s2.1-pro-free · реплики кэшируются, повтор не тратит квоту</div></div>`;
    const save = () => { OPTS.voiceOn = $('vOn').checked; OPTS.voiceKey = $('vKey').value.trim(); OPTS.voiceProxy = $('vProxy').value.trim(); OPTS.voiceVol = +$('vVol').value; OPTS.voiceSpeed = +$('vSpd').value; OPTS.voiceRefs = Object.assign({}, OPTS.voiceRefs, { all: $('vRef').value.trim() }); saveOpts(); };
    Dialog.show({ name: 'Озвучка диалогов', html: body, voice: null, opts: [
      { label: 'Проверить голос', main: true, go: () => { save(); $('vStat').textContent = 'Запрос…'; Voice.test(msg => { const el = $('vStat'); if (el) el.textContent = msg; }); return 'keep'; } },
      { label: 'Очистить кэш голосов', go: () => { Voice.clearCache(); const el = $('vStat'); if (el) el.textContent = 'Кэш очищен'; return 'keep'; } },
      { label: 'Готово', go: () => { save(); this.menu(true); return 'close'; } }
    ] });
  },
  menu(show) {
    if (!show) { this.hide('menu'); return; }
    if (P && P.dead) { if (!$('death').classList.contains('show')) this.show('death'); return; }
    this.closeAll();
    const b = $('menuBtns'); b.innerHTML = '';
    const add = (label, fn, main) => { const el = document.createElement('button'); el.className = 'ubtn' + (main ? ' main' : ''); el.textContent = label; el.onclick = () => { SFX.init(); SFX.click(); fn(); }; b.appendChild(el); };
    if (G && L) add('Продолжить', () => this.hide('menu'), true);
    add('Сохранения', () => this.slots(), !(G && L) && Save.has());
    add('Новая игра', () => { if (G && L) { Dialog.show({ name: 'Новая игра', text: 'Начать заново? Несохранённый прогресс пропадёт.', opts: [{ label: 'Да, начать заново', main: true, go: () => { UI.newGame(); return 'close'; } }, { label: 'Отмена', go: () => { UI.hide('dlg'); UI.menu(true); return 'close'; } }] }); return; } this.newGame(); });
    if (G && L && !P.dead) add('Быстро сохранить', () => { Save.write(); this.hide('menu'); });
    add('Озвучка диалогов', () => { this.voiceSetup(); });
    add(typeof Update !== 'undefined' && Update.available ? 'Обновление · есть v' + Update.latest.version : 'Проверить обновление', () => { if (typeof Update === 'undefined') return; if (Update.latest) { Update.prompt(true); return; } this.hide('menu'); UI.toast('Спрашиваю GitHub…'); Update.check(true).then(() => Update.prompt(true)); }, typeof Update !== 'undefined' && Update.available);
    if (IN.touch) add('Настроить управление', () => { this.hide('menu'); Layout.edit(true); });
    if (IN.touch && !Input.isApp && document.fullscreenEnabled && !document.fullscreenElement) add('На весь экран', () => { Input.fullscreen(); this.hide('menu'); });
    const opt = document.createElement('div'); opt.className = 'opts';
    opt.innerHTML = `<label>Музыка <input type="range" min="0" max="1" step="0.05" id="oMusic" value="${OPTS.music}"></label><label>Звуки <input type="range" min="0" max="1" step="0.05" id="oSfx" value="${OPTS.sfx}"></label><label>Чувствительность обзора <input type="range" min="0.4" max="2" step="0.1" id="oSens" value="${OPTS.sens}"></label>
      <label><input type="checkbox" id="oInv" ${OPTS.invertY ? 'checked' : ''}> Инверсия вертикали</label><label><input type="checkbox" id="oVib" ${OPTS.vibro ? 'checked' : ''}> Вибрация</label><label><input type="checkbox" id="oTap" ${OPTS.tapAttack ? 'checked' : ''}> Тап справа = удар</label><label><input type="checkbox" id="oHires" ${OPTS.hires ? 'checked' : ''}> Чёткая картинка (тяжелее для телефона)</label><label><input type="checkbox" id="oUpd" ${OPTS.updates !== false ? 'checked' : ''}> Проверять обновления на GitHub</label>
      <label>Тени <select id="oShadow"><option value="off"${OPTS.shadows === 'off' ? ' selected' : ''}>выключить</option><option value="low"${OPTS.shadows === 'low' ? ' selected' : ''}>обычные</option><option value="high"${OPTS.shadows === 'high' ? ' selected' : ''}>мягкие + в помещениях</option></select></label>
      ${IN.touch ? `<label><input type="checkbox" id="oGyro" ${OPTS.gyro ? 'checked' : ''}> Гироскоп: поворот камеры наклоном телефона</label><label>Чувствительность гироскопа <input type="range" min="0.3" max="3" step="0.1" id="oGyroSens" value="${OPTS.gyroSens}"></label><label><input type="checkbox" id="oGyroMirror" ${OPTS.gyroMirror ? 'checked' : ''}> Гироскоп зеркально (если крутит не в ту сторону)</label><div class="hint" id="gyroStat">${Input.gyroStatus()}</div>` : ''}`;
    b.appendChild(opt);
    $('oMusic').oninput = e => { OPTS.music = +e.target.value; applyOpts(); saveOpts(); }; $('oSfx').oninput = e => { OPTS.sfx = +e.target.value; applyOpts(); saveOpts(); }; $('oSens').oninput = e => { OPTS.sens = +e.target.value; saveOpts(); };
    $('oInv').onchange = e => { OPTS.invertY = e.target.checked; saveOpts(); }; $('oVib').onchange = e => { OPTS.vibro = e.target.checked; saveOpts(); }; $('oTap').onchange = e => { OPTS.tapAttack = e.target.checked; saveOpts(); }; $('oHires').onchange = e => { OPTS.hires = e.target.checked; applyOpts(); saveOpts(); };
    $('oUpd').onchange = e => { OPTS.updates = e.target.checked; saveOpts(); };
    $('oShadow').onchange = e => { OPTS.shadows = e.target.value; R.setShadowQuality(OPTS.shadows); saveOpts(); if (G && L) loadLevel(L.id, { wx: P.x, wz: P.z, yaw: P.yaw }); };
    if ($('oGyro')) { $('oGyro').onchange = e => { OPTS.gyro = e.target.checked; saveOpts(); if (OPTS.gyro) Input.gyroStart(); }; $('oGyroSens').oninput = e => { OPTS.gyroSens = +e.target.value; saveOpts(); }; $('oGyroMirror').onchange = e => { OPTS.gyroMirror = e.target.checked; saveOpts(); }; }
    $('menuHint').textContent = IN.touch ? 'Левый большой палец — джойстик (ходьба), правый — обзор и тап по цели. УДАР: удержать — блок. ОГОНЬ: удержать — сменить заклинание. Ячейки 1–4 внизу: тап — использовать, удержать — очистить. Гироскоп: наклоняй телефон, чтобы осматриваться на ходу (настраивается ниже). Кнопка «назад» — меню.' : 'WASD — ходьба · мышь — обзор · ЛКМ — удар · ПКМ — блок · F / колесо — заклинание · E — действие · Space — прыжок · 1–4 — ячейки · I J M — сумка/дневник/карта · Esc — отпустить мышь, ещё раз — меню';
    $('menuVer').textContent = 'v' + VERSION;
    if (typeof Update !== 'undefined') Update.badge();
    this.show('menu');
  },
  newGame() { G = newState(); P.dead = false; giveStart(); loadLevel('village'); this.closeAll(); Dialog.start('intro'); },
  target(en) { this.tgt = en; this.tgtT = 3.5; },
  nextSpell(dir) { if (!G || G.spells.length < 2) { if (G) log('Другие заклинания ещё не изучены', 'blue'); return; } const i = G.spells.indexOf(G.spell); G.spell = G.spells[(i + (dir || 1) + G.spells.length) % G.spells.length]; log('Заклинание: ' + SPELLS[G.spell].name, 'blue'); SFX.click(); },
  locName(n) { const el = $('locName'); el.textContent = n; el.style.opacity = '1'; setTimeout(() => el.style.opacity = '0', 3500); },
  saveIcon() { const el = $('saveIco'); el.style.opacity = '1'; setTimeout(() => el.style.opacity = '0', 1800); },
  shakeBtn(id) { const el = $(id); el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 350); },
  toast(item, q) { const el = $('toast'); el.innerHTML = typeof item === 'string' ? item : `${this.icon(ITEMS[item.id].icon)} ${itemName(item)}${q > 1 ? ' ×' + q : ''}`; el.style.opacity = '1'; clearTimeout(this.toastT); this.toastT = setTimeout(() => el.style.opacity = '0', 2200); },
  hintSeen(k) { if (G && !G.hints[k]) G.hints[k] = 1; },
  campfire() { Dialog.show({ name: 'Костёр', text: 'Огонь трещит и греет. Можно приготовить еду или прилечь у огня — сон под открытым небом восстанавливает хуже кровати, и к огню может выйти зверь.', opts: [{ label: 'Готовить', main: true, go: () => { Craft.open('campfire'); return 'close'; } }, { label: 'Отдохнуть', go: () => { UI.sleep(false); return 'close'; } }, { label: 'Уйти', go: () => 'close' }] }); },
  sleep(bed) {
    if (L.enemies.some(en => en.state === 'chase' && !en.friendly && dist2(P.x, P.z, en.x, en.z) < 12)) { log('Нельзя спать: рядом враг.', 'red'); return; }
    if (bed && G.level === 'tavern' && G.quests.seal < 1) { if (G.gold < 10) { log('Марта: «Десять монет за ночь, странник».', 'red'); return; } }
    this.bed = bed; $('sleepTitle').textContent = bed ? 'Кровать' : 'Отдых у костра'; $('sleepText').textContent = bed ? 'Сколько часов проспать?' : 'Сколько часов подремать у огня? (восстановление вдвое слабее)';
    this.show('sleep');
  },
  doSleep(h) {
    const bed = this.bed, k = bed ? 1 : 0.5; if (bed && G.level === 'tavern' && G.quests.seal < 1) { if (G.gold < 10) { log('Марта: «Десять монет за ночь, странник».', 'red'); this.hide('sleep'); return; } G.gold -= 10; log('−10 золота за ночлег', 'gold'); } if (h === 'morning') { const cur = G.time * 24; h = ((6.5 - cur) + 24) % 24; if (h < 1) h = 24 + h; h = Math.round(h * 10) / 10; }
    const before = G.time; G.time = (G.time + h / 24) % 1; if (G.time < before) G.day++; G.lastTime = G.time; G.playTime += h * 60;
    G.rest = Math.min(100, G.rest + h * 13 * k); G.hp = Math.min(effMaxHp(), G.hp + effMaxHp() * 0.08 * h * k); G.mp = Math.min(effMaxMp(), G.mp + effMaxMp() * 0.1 * h * k);
    G.hunger = Math.max(0, G.hunger - h * 3); G.thirst = Math.max(0, G.thirst - h * 4); G.sta = effMaxSta(); if (bed) G.warmth = Math.max(G.warmth, 55);
    this.hide('sleep'); $('fade').classList.add('on'); SFX.sleep();
    setTimeout(() => { $('fade').classList.remove('on'); log(`Прошло ${h} ч. ${bed ? 'Ты выспался.' : 'Спина затекла, но силы вернулись.'}`, 'blue'); refreshGatherSprites(); if (!bed && Math.random() < 0.3 && L.def.outdoor) { const c = freeCellNear(Math.floor(P.x / CS) + 3, Math.floor(P.z / CS), 3); if (c) { const en = spawnEnemy({ id: 'wolf_night_' + uid(), temp: true, type: 'wolf', x: c[0], z: c[1] }); en.state = 'chase'; log('Волк подкрался к костру!', 'red'); } } Save.auto(); }, 900);
  },
  tick(dt) {
    if (this.tgtT > 0) this.tgtT -= dt;
    if (!this.tgt || this.tgt.dead || this.tgtT <= 0) { this.tgt = null; let bd = 9; for (const en of L.enemies) { if (en.friendly) continue; const d = dist2(P.x, P.z, en.x, en.z); if (d < bd && facingDot(en.x, en.z) > 0.93) { bd = d; this.tgt = en; } } }
    const tg = $('target');
    if (this.tgt && !this.tgt.dead) { tg.style.display = 'block'; $('targetName').textContent = this.tgt.name + (this.tgt.slow > 0 ? ' ❄' : '') + (this.tgt.burn > 0 ? ' 🔥' : ''); $('targetHp').style.width = Math.max(0, this.tgt.hp / this.tgt.maxHp * 100) + '%'; } else tg.style.display = 'none';
    this.promptT -= dt;
    if (this.promptT <= 0) {
      this.promptT = 0.12; const t = (!this.open && !P.dead) ? findInteract() : null; const pr = $('prompt');
      const ctx = $('ctx'), bUse = $('bUse');
      if (t) { if (IN.touch) { pr.style.display = 'none'; ctx.style.display = 'block'; ctx.textContent = t.label; bUse.classList.add('hot'); } else { pr.style.display = 'block'; pr.textContent = '[E] ' + t.label; ctx.style.display = 'none'; } } else { pr.style.display = 'none'; ctx.style.display = 'none'; bUse.classList.remove('hot'); }
      $('bSpellName').textContent = SPELLS[G.spell].short; $('bSpell').classList.toggle('dim', G.mp < SPELLS[G.spell].mp);
      const w = wdef(); $('bAttack').classList.toggle('dim', G.sta < (w ? w.sta : 4)); $('bAttack').classList.toggle('block', P.block > 0); $('bAttack').querySelector('span').textContent = P.block > 0 ? 'БЛОК' : 'УДАР';
      this.vitals();
      for (let i = 0; i < QUICK_N; i++) { const el = $('bQ' + (i + 1)), u = G.quick[i], it = inst(u); const html = `<u>${i + 1}</u>` + (it ? this.icon(ITEMS[it.id].icon) + `<i>${it.id === 'flask' ? G.flaskWater : it.q}</i>` : ''); if (el._h !== html) { el._h = html; el.innerHTML = html; } }
      // Ворлат: монолог перед боем
      const boss = L.enemies.find(e => e.id === 'd_boss'); if (boss && !G.flags.vorlatTalk && !this.open && !P.dead && dist2(P.x, P.z, boss.x, boss.z) < 13 && los(P.x, P.z, boss.x, boss.z)) { G.flags.vorlatTalk = 1; Dialog.start('vorlat'); }
    }
  },
  vitals() {
    const set = (id, v, m, txt) => { const el = $(id); el.querySelector('i').style.width = clamp(v / m * 100, 0, 100) + '%'; el.querySelector('b').textContent = txt; };
    set('vbHp', G.hp, effMaxHp(), Math.round(G.hp) + (G.poison > 0 ? ' ЯД' : '')); $('vbHp').classList.toggle('poison', G.poison > 0); $('vbHp').classList.toggle('low', G.hp < effMaxHp() * 0.25); set('vbMp', G.mp, effMaxMp(), Math.round(G.mp)); set('vbSt', G.sta, effMaxSta(), Math.round(G.sta));
    const nd = (id, v, low, col) => { const el = $(id); el.style.setProperty('--v', clamp(v, 0, 100)); el.classList.toggle('low', low); if (col) el.style.setProperty('--c', col); };
    nd('ndFood', G.hunger, G.hunger < 20); nd('ndWater', G.thirst, G.thirst < 20); nd('ndRest', G.rest, G.rest < 20); nd('ndWarm', G.warmth, G.warmth < 25 || G.warmth > 85, G.warmth < 25 ? '#60b0ff' : G.warmth > 85 ? '#ff6a2a' : '#c8a060');
    $('hudLvl').textContent = 'Ур.' + G.lvl + ' · ' + G.xp + '/' + xpNeed(); $('hudGold').textContent = G.gold + ' зол.';
  },
  invTab: 'items',
  renderInv() { this.hintSeen('inv');
    const tabs = $('invTabs'); tabs.innerHTML = '';
    for (const [k, n] of [['items', 'Предметы'], ['gear', 'Снаряжение'], ['stats', 'Странник'], ['spells', 'Заклинания']]) { const b = document.createElement('button'); b.className = 'ubtn' + (this.invTab === k ? ' main' : ''); b.textContent = n; b.onclick = () => { SFX.click(); this.invTab = k; this.renderInv(); }; tabs.appendChild(b); }
    const grid = $('invGrid'), det = $('invDetail'); grid.innerHTML = ''; det.innerHTML = ''; grid.style.display = ''; det.style.display = '';
    const cellFor = (s, extra) => {
      const it = ITEMS[s.id], eq = Object.values(G.eq).includes(s.uid), qi = G.quick.indexOf(s.uid);
      const d = document.createElement('div'); d.className = 'cell' + (eq ? ' eq' : '') + (s.dur !== undefined && s.dur <= 0 ? ' broken' : '') + (this.invSel === s.uid ? ' sel' : '');
      d.innerHTML = this.icon(it.icon) + (s.q > 1 ? `<b>${s.q}</b>` : s.id === 'flask' ? `<b>${G.flaskWater}/3</b>` : '') + (qi >= 0 ? `<u>${qi + 1}</u>` : '') + (extra || '');
      d.onclick = () => { SFX.click(); this.invSel = s.uid; this.renderInv(); }; return d;
    };
    if (this.invTab === 'items') {
      const order = { weapon: 0, shield: 1, armor: 2, helmet: 3, cloak: 4, amulet: 5, ring: 6, potion: 7, food: 8, tool: 9, mat: 10, gem: 11, rune: 12, key: 13 };
      const items = [...G.inv].sort((a, b) => (order[ITEMS[a.id].type] || 0) - (order[ITEMS[b.id].type] || 0));
      for (const s of items) grid.appendChild(cellFor(s));
      for (let i = items.length; i < Math.max(24, items.length + 4); i++) { const d = document.createElement('div'); d.className = 'cell empty'; grid.appendChild(d); }
      if (!items.length) det.innerHTML = '<div class="hint">Сумка пуста.</div>';
    } else if (this.invTab === 'gear') {
      const slots = document.createElement('div'); slots.id = 'invSlots';
      for (const sl of SLOTS) { const it = eqItem(sl); const d = document.createElement('div'); d.className = 'cell' + (it && this.invSel === it.uid ? ' sel' : '') + (it ? '' : ' empty'); d.innerHTML = (it ? this.icon(ITEMS[it.id].icon) : '') + `<small>${SLOT_NAMES[sl]}</small>`; if (it) d.onclick = () => { SFX.click(); this.invSel = it.uid; this.renderInv(); }; slots.appendChild(d); }
      grid.style.display = 'block'; grid.appendChild(slots);
      const w = weapon(); const rows = [['Оружие', w ? itemName(w) : 'Кулаки'], ['Урон', Math.round(weaponDmg())], ['Броня', Math.round(armorVal())], ['Тепло одежды', '+' + warmGear()]];
      const st = document.createElement('div'); st.innerHTML = '<h3>Итого</h3>' + rows.map(r => `<div class="stat"><span>${r[0]}</span><span>${r[1]}</span></div>`).join(''); grid.appendChild(st);
      const h = document.createElement('h3'); h.textContent = 'Можно надеть'; grid.appendChild(h);
      const g2 = document.createElement('div'); g2.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,64px);gap:6px'; for (const s of G.inv) if (SLOTS.includes(ITEMS[s.id].type) && !Object.values(G.eq).includes(s.uid)) g2.appendChild(cellFor(s)); grid.appendChild(g2);
    } else if (this.invTab === 'stats') {
      grid.style.display = 'block'; det.style.display = 'none';
      const rows = [['Уровень', G.lvl], ['Опыт', `${G.xp} / ${xpNeed()}`], ['Золото', G.gold], ['Здоровье', `${Math.round(G.hp)} / ${effMaxHp()}`], ['Мана', `${Math.round(G.mp)} / ${effMaxMp()}`], ['Силы', `${Math.round(G.sta)} / ${effMaxSta()}`], ['Сытость', Math.round(G.hunger) + '%'], ['Жажда', Math.round(G.thirst) + '%'], ['Бодрость', Math.round(G.rest) + '%'], ['Тепло', Math.round(G.warmth) + (G.warmth < 25 ? ' (холодно)' : G.warmth > 85 ? ' (жарко)' : '')], ['Клинок', G.skills.blade], ['Разрушение', G.skills.destr], ['Доспех', G.skills.armor], ['Ремесло', G.skills.craft], ['Алхимия', G.skills.alch], ['Взлом', G.skills.lock], ['Убито', G.stats.kills], ['День', G.day]];
      grid.innerHTML = '<div style="columns:2;column-gap:24px">' + rows.map(r => `<div class="stat" style="break-inside:avoid"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('') + '</div>';
    } else {
      grid.style.display = 'block'; det.style.display = 'none';
      for (const s of G.spells) { const d = document.createElement('div'); d.className = 'item' + (G.spell === s ? ' eq sel' : ''); d.innerHTML = `<span>${SPELLS[s].name}${G.spell === s ? ' — выбрано' : ''}</span><span class="q">${SPELLS[s].mp} маны · ${SPELLS[s].heal ? 'лечит ' + SPELLS[s].heal : 'урон ' + SPELLS[s].dmg}${SPELLS[s].slow ? ' · замедляет' : ''}${SPELLS[s].aoe ? ' · по площади' : ''}</span>`; d.onclick = () => { SFX.click(); G.spell = s; this.renderInv(); }; grid.appendChild(d); }
      const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'Заклинание можно сменить и в бою: удержи кнопку ОГОНЬ (Q или колесо мыши на компьютере).'; grid.appendChild(h);
    }
    if (det.style.display !== 'none') this.itemDetail(this.invSel);
  },
  itemDetail(u) {
    const det = $('invDetail'); const i = u && inst(u); if (!i) { det.innerHTML = '<div class="hint">Выбери предмет, чтобы надеть, выпить, назначить в ячейку или бросить.</div>'; this.invSel = null; return; }
    const it = ITEMS[i.id], eq = Object.values(G.eq).includes(i.uid);
    det.innerHTML = `<div class="name${i.dur !== undefined && i.dur <= 0 ? ' broken' : ''}">${this.icon(it.icon)}${itemName(i)}${i.q > 1 ? ' ×' + i.q : ''}${eq ? ' · надето' : ''}${i.dur !== undefined && i.dur <= 0 ? ' · сломано' : ''}</div><div class="info">${this.itemInfo(it, i)}${it.value ? ' · цена ' + it.value : ''}</div>${it.desc ? `<div class="desc">${it.desc}</div>` : ''}<div class="acts"></div>`;
    const acts = det.querySelector('.acts');
    const btn = (label, fn, main) => { const b = document.createElement('button'); b.className = 'ubtn' + (main ? ' main' : ''); b.textContent = label; b.onclick = () => { SFX.click(); fn(); this.renderInv(); }; acts.appendChild(b); };
    if (SLOTS.includes(it.type)) { if (G.eq[it.type] === u) btn('Снять', () => { G.eq[it.type] = null; G.mp = Math.min(G.mp, effMaxMp()); G.hp = Math.min(G.hp, effMaxHp()); }); else btn('Надеть', () => equipItem(u), true); }
    if (it.type === 'potion') btn('Выпить', () => consume(u), true); if (it.type === 'food') btn('Съесть', () => consume(u), true); if (i.id === 'flask') btn('Глотнуть', () => drinkFlask(), true);
    if (it.type === 'potion' || it.type === 'food' || i.id === 'flask') { const qi = G.quick.indexOf(u); btn(qi >= 0 ? `Ячейка ${qi + 1} ✓ · убрать` : 'В ячейку быстрого доступа', () => setQuick(u), qi < 0); }
    if (it.type !== 'key' && !it.quest) btn('Бросить', () => { const dx = -Math.sin(P.yaw), dz = -Math.cos(P.yaw); const one = STACKABLE.has(it.type); if (one) removeItem(i.id, 1); else removeInst(u); let px = P.x + dx * 2, pz = P.z + dz * 2; if (blocked(px, pz, 0.2)) { px = P.x + dx * 1.2; pz = P.z + dz * 1.2; } if (blocked(px, pz, 0.2)) { px = P.x; pz = P.z; } const pk = spawnPickup(i.id, px, pz, null, 1, one ? undefined : { dur: i.dur, plus: i.plus, ench: i.ench }); if (pk) pk.noPick = 2.5; if (!inst(u)) this.invSel = null; });
  },
  renderJournal() {
    const j = $('jList'); j.innerHTML = Quests.journal().map(e => `<h3>${e[0]}</h3><div>${e[1]}</div>`).join('');
    const hours = Math.floor(G.time * 24), mins = Math.floor((G.time * 24 % 1) * 60), w = G.weather.type;
    j.innerHTML += `<div class="hint" style="margin-top:12px">День ${G.day}, ${hours}:${mins < 10 ? '0' : ''}${mins} · ${w === 'rain' ? 'дождь' : w === 'snow' ? 'снег' : 'ясно'} · В пути ${Math.floor(G.playTime / 60)} мин. · Убито: ${G.stats.kills} · Создано: ${G.stats.crafted} · Добыто руды: ${G.stats.mined} · Срублено: ${G.stats.chopped} · Раскопано: ${G.stats.dug}</div>`;
  },
  renderMap() {
    const c = $('mapc'), map = L.map, W = map[0].length, H = map.length, ex = G.explored[L.id] || {};
    const size = Math.max(4, Math.min(Math.floor((window.innerWidth * 0.92 - 40) / W), Math.floor((window.innerHeight * 0.8 - 70) / H), 16));
    c.width = W * size; c.height = H * size; const x = c.getContext('2d');
    x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, c.width, c.height);
    const col = { '#': L.def.outdoor ? '#4a4a52' : '#3a3a44', '.': L.def.outdoor ? '#2e5a28' : '#5a5a62', 'g': '#24481f', ',': '#6a5033', ':': '#5a5a5a', 'w': '#2a4a8a', 'T': '#1c3a18', 't': '#22441a', 'd': '#3a3020', 'H': '#7a6a4a', 'W': '#6a4a2a', 'C': '#8a8a90', 'D': '#c0a050', 'G': '#c0a050', 'L': '#b04040', 'K': '#b08040', 'X': '#c0a050', '~': '#6a4a2a', 'c': '#7a2a2a' };
    for (let z = 0; z < H; z++) for (let xx = 0; xx < W; xx++) { if (!ex[xx + ',' + z]) continue; const ch = map[z][xx]; x.fillStyle = col[ch] || '#333'; x.fillRect(xx * size, z * size, size, size); }
    const dot = (wx, wz, color, r) => { x.fillStyle = color; x.beginPath(); x.arc(wx / CS * size, wz / CS * size, r, 0, Math.PI * 2); x.fill(); };
    for (const n of L.npcs) if (ex[Math.floor(n.x / CS) + ',' + Math.floor(n.z / CS)]) dot(n.x, n.z, '#6fb0ff', size * 0.32);
    for (const ch of L.chests) if (!ch.opened && ex[Math.floor(ch.x / CS) + ',' + Math.floor(ch.z / CS)]) dot(ch.x, ch.z, '#d9a53c', size * 0.28);
    for (const a of L.acts) if (['anvil', 'furnace', 'cauldron', 'campfire', 'bed', 'altar', 'well'].includes(a.p.act) && ex[Math.floor(a.x / CS) + ',' + Math.floor(a.z / CS)]) dot(a.x, a.z, '#ff9a4a', size * 0.25);
    for (const en of L.enemies) if (en.state === 'chase' && !en.friendly) dot(en.x, en.z, '#e04040', size * 0.3);
    const mk = Quests.marker(); if (mk) { x.strokeStyle = '#ffd060'; x.lineWidth = 2; x.beginPath(); x.arc(mk.x / CS * size, mk.z / CS * size, size * 0.6, 0, Math.PI * 2); x.stroke(); }
    x.save(); x.translate(P.x / CS * size, P.z / CS * size); x.rotate(-P.yaw); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -size * 0.7); x.lineTo(size * 0.45, size * 0.5); x.lineTo(-size * 0.45, size * 0.5); x.fill(); x.restore();
    $('mapTitle').textContent = L.def.name; $('mapLegend').textContent = 'Белая стрелка — ты · синие — жители · жёлтые — сундуки · оранжевые — верстаки, кровати, колодец · красные — враги · кольцо — цель';
  },
  drawHud(dt) {
    const c = hctx, W = VW, H = VH; c.setTransform(HDPR, 0, 0, HDPR, 0, 0); c.clearRect(0, 0, W, H); c.imageSmoothingEnabled = false;
    if (!G || !L) return;
    c.font = 'bold 13px "Courier New", monospace'; c.textBaseline = 'middle';
    // --- компас ---
    const cwid = Math.min(260, W * 0.36), cx0 = W / 2 - cwid / 2, cy0 = 10;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(cx0, cy0, cwid, 16); c.strokeStyle = '#5a4a3a'; c.strokeRect(cx0 + 0.5, cy0 + 0.5, cwid - 1, 15);
    const heading = -P.yaw, span = 1.05;
    const put = (a, txt, col, tri) => { let rel = a - heading; rel = Math.atan2(Math.sin(rel), Math.cos(rel)); if (Math.abs(rel) > span) return; const x = W / 2 + rel / span * cwid / 2; c.fillStyle = col; if (tri) { c.beginPath(); c.moveTo(x, cy0 + 3); c.lineTo(x - 5, cy0 + 13); c.lineTo(x + 5, cy0 + 13); c.fill(); } else { c.textAlign = 'center'; c.fillText(txt, x, cy0 + 8); c.textAlign = 'left'; } };
    put(0, 'С', '#e7dcc3'); put(Math.PI / 2, 'В', '#c9bea3'); put(Math.PI, 'Ю', '#c9bea3'); put(-Math.PI / 2, 'З', '#c9bea3');
    for (let i = 0; i < 8; i++) put(i * Math.PI / 4 + Math.PI / 8, '·', '#8a7a60');
    const mk = Quests.marker(); if (mk) put(Math.atan2(mk.x - P.x, -(mk.z - P.z)), '', '#d9a53c', true);
    for (const en of L.enemies) if (en.state === 'chase' && !en.friendly) put(Math.atan2(en.x - P.x, -(en.z - P.z)), '', '#b3352b', true);
    const hours = Math.floor(G.time * 24), mins = Math.floor((G.time * 24 % 1) * 60), wt = G.weather.type; c.fillStyle = '#c9bea3'; c.textAlign = 'left'; c.textAlign = 'center'; c.fillText(`${hours}:${mins < 10 ? '0' : ''}${mins} ${L.def.outdoor ? (wt === 'rain' ? '☂' : wt === 'snow' ? '❄' : '☼') : ''}`, W / 2, cy0 + 27); c.textAlign = 'left'; 
    // --- всплывающие числа ---
    if (FLOAT.length) { c.font = 'bold 14px "Courier New", monospace'; c.textAlign = 'center'; for (const f of FLOAT) { const v = R.project(f.x, f.y + f.t * 1.2, f.z); if (v.behind) continue; c.globalAlpha = 1 - f.t; c.fillStyle = '#000'; c.fillText(f.text, v.x * W + 1, v.y * H + 1); c.fillStyle = f.col; c.fillText(f.text, v.x * W, v.y * H); } c.globalAlpha = 1; c.textAlign = 'left'; c.font = 'bold 13px "Courier New", monospace'; }
    c.fillStyle = 'rgba(231,220,195,.85)'; c.fillRect(W / 2 - 1, H / 2 - 1, 3, 3);
    // --- вспышка заклинания у руки ---
    if (P.castAnim > 0) { const s = H / 46, p = 1 - P.castAnim / 0.5, hx = W * 0.66, hy = H - 6 * s + Math.sin(p * Math.PI) * -30, ice = G.spell === 'ice', heal = G.spell === 'heal'; const g = c.createRadialGradient(hx + 6 * s, hy - 2 * s, 2, hx + 6 * s, hy - 2 * s, 9 * s); g.addColorStop(0, ice ? `rgba(160,210,255,${0.9 * Math.sin(p * Math.PI)})` : heal ? `rgba(160,255,180,${0.9 * Math.sin(p * Math.PI)})` : `rgba(255,190,80,${0.9 * Math.sin(p * Math.PI)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(hx - 8 * s, hy - 14 * s, 30 * s, 30 * s); c.drawImage(TEX.VIEW.hand, hx, hy, 12 * s, 9 * s); }
    // --- подсказки-обучение ---
    if (!this.open && !P.dead) { const hints = IN.touch
      ? [['move', 'Левый палец — джойстик. Да, вот так. Молодец'], ['touch', 'Правой половиной экрана — обзор. Мир большой, в основном пустой'], ['use', 'Кнопка ДЕЙСТВИЕ: говорить, открывать, брать чужое'], ['attack', 'УДАР — атака. Удержать — блок. Блок работает лучше, чем кажется'], ['parry', 'Блок ровно в момент замаха — парирование. Враг отлетит и обидится'], ['spell', 'ОГОНЬ — заклинание. Удержать — сменить'], ['quick', 'Ячейки 1–4: тап — выпить, удержать — очистить'], ['inv', 'Сумка вверху справа. Там лежит всё, что ты у кого-то забрал'], ['craft', 'Наковальня, печь и котёл — ремесло. Дешевле, чем у Брандта, и злее']]
      : [['move', 'WASD — ходьба, мышь — обзор'], ['use', 'E — говорить, открывать, брать чужое'], ['attack', 'ЛКМ — удар, ПКМ — блок'], ['parry', 'Блок ровно в момент замаха — парирование'], ['spell', 'F — заклинание, колесо — сменить'], ['quick', '1–4 — быстрые ячейки'], ['inv', 'I — сумка, J — дневник, M — карта'], ['craft', 'Наковальня, печь и котёл — ремесло']]; const h = hints.find(h => !G.hints[h[0]]); if (h) { const hy = cy0 + 24; c.font = 'bold 14px "Courier New", monospace'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.6)'; const tw = c.measureText(h[1]).width + 24; c.fillRect(W / 2 - tw / 2, hy, tw, 26); c.fillStyle = '#ffd060'; c.fillText(h[1], W / 2, hy + 13); c.textAlign = 'left'; c.font = 'bold 13px "Courier New", monospace'; } }
    // --- виньетки ---
    if (G.rest < 20 || G.hunger < 15 || G.thirst < 15) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(${G.hunger < 15 ? '60,20,0' : G.thirst < 15 ? '40,30,0' : '10,0,30'},0.5)`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (G.warmth < 25) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(120,180,255,0)'); g.addColorStop(1, `rgba(120,180,255,${0.15 + (25 - G.warmth) / 25 * 0.35})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (G.warmth > 85) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, 'rgba(255,120,40,0.25)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (!this.vig || this.vigW !== W || this.vigH !== H) { this.vigW = W; this.vigH = H; const vc = document.createElement('canvas'); vc.width = 256; vc.height = 128; const vx = vc.getContext('2d'); const vg = vx.createRadialGradient(128, 64, 60, 128, 64, 130); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.4)'); vx.fillStyle = vg; vx.fillRect(0, 0, 256, 128); this.vig = vc; }
    c.imageSmoothingEnabled = true; c.drawImage(this.vig, 0, 0, W, H); c.imageSmoothingEnabled = false;
    if (P.dead) { c.fillStyle = 'rgba(60,0,0,.5)'; c.fillRect(0, 0, W, H); }
  }
};

if (!IS_APP && ('ontouchstart' in window)) {
  const fs = () => { const el = document.documentElement; try { if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => { }); } catch (e) { } };
  document.addEventListener('pointerdown', fs, { passive: true });
}
window.appBack = () => { if ($('death').classList.contains('show') || (P && P.dead)) return 'handled'; if (Mini.active) { Mini.cancel(); return 'handled'; } if (UI.open && !$('menu').classList.contains('show')) { UI.closeAll(); return 'handled'; } if ($('menu').classList.contains('show') && !(G && L)) return 'exit'; if ($('menu').classList.contains('show')) { UI.hide('menu'); return 'handled'; } UI.menu(true); return 'handled'; };
for (const [id, ov] of [['invClose', 'inv'], ['jClose', 'journal'], ['shopClose', 'shop'], ['craftClose', 'craft'], ['mapClose', 'map'], ['sleepClose', 'sleep']]) $(id).onclick = () => { SFX.click(); UI.hide(ov); };
document.querySelectorAll('#sleep [data-h]').forEach(b => b.onclick = () => UI.doSleep(b.dataset.h === 'morning' ? 'morning' : +b.dataset.h));
$('deathLoad').onclick = () => { SFX.init(); if (!Save.has()) { UI.toast('Сохранения нет'); return; } $('death').classList.remove('show'); P.dead = false; if (!Save.load()) UI.newGame(); else UI.sync(); };
$('deathNew').onclick = () => { SFX.init(); $('death').classList.remove('show'); UI.newGame(); };
setInterval(() => { const el = $('gyroStat'); if (el && UI.open) el.textContent = Input.gyroStatus(); }, 400);
applyOpts();
UI.menu(true);
try { if (typeof Update !== 'undefined') Update.auto(); } catch (e) { }
requestAnimationFrame(frame);
