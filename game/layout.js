// ---------- Раскладка сенсорного управления: перемещение, размер, прозрачность элементов HUD ----------
'use strict';
const Layout = (() => {
  const IDS = ['joy', 'bAttack', 'bUse', 'bSpell', 'bJump', 'quick', 'topbtns', 'vitals'];
  const NAMES = { joy: 'Джойстик', bAttack: 'Удар', bUse: 'Действие', bSpell: 'Заклинание', bJump: 'Прыжок', quick: 'Ячейки', topbtns: 'Меню/сумка', vitals: 'Здоровье' };
  let active = false, sel = null, drag = null, bar = null;
  const store = () => (OPTS.layout = OPTS.layout || {});
  const ent = id => store()[id];
  // Применить сохранённую раскладку к элементу: центр в долях экрана, масштаб и прозрачность через CSS-переменные
  function applyOne(id) {
    const el = $(id); if (!el) return; const e = ent(id);
    el.style.setProperty('--ls', e && e.s ? e.s : 1); el.style.setProperty('--la', e && e.a !== undefined ? e.a : 1);
    if (e && e.x !== undefined) {
      if (id === 'joy' && IN.joy) return; // ручка сейчас под пальцем — не трогаем
      const w = el.offsetWidth, h = el.offsetHeight; el.style.left = Math.round(e.x * VW - w / 2) + 'px'; el.style.top = Math.round(e.y * VH - h / 2) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
    } else if (id !== 'joy' || !IN.joy) { el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = ''; }
  }
  function apply() { for (const id of IDS) applyOne(id); }
  const alpha = id => { const e = ent(id); return e && e.a !== undefined ? e.a : 1; };
  const scale = id => { const e = ent(id); return e && e.s ? e.s : 1; };
  const center = id => { const r = $(id).getBoundingClientRect(); return { x: (r.left + r.width / 2) / VW, y: (r.top + r.height / 2) / VH, hw: r.width / 2, hh: r.height / 2 }; };
  function select(id) {
    sel = id; for (const i of IDS) $(i).classList.toggle('lsel', i === id);
    if (!bar) return; $('lyName').textContent = id ? NAMES[id] : 'Все элементы'; $('lyS').value = id ? scale(id) : 1; $('lyA').value = id ? alpha(id) : 1;
  }
  function setProp(k, v) {
    const ids = sel ? [sel] : IDS; for (const id of ids) { const e = store()[id] || (store()[id] = {}); e[k] = v; applyOne(id); } saveOpts();
  }
  function buildBar() {
    bar = document.createElement('div'); bar.id = 'layoutBar';
    bar.innerHTML = `<div class="row"><b id="lyName">Все элементы</b><span class="hint">перетаскивай элементы · тап — выбрать</span></div>
      <div class="row"><label>Размер <input type="range" id="lyS" min="0.6" max="1.7" step="0.05" value="1"></label><label>Прозрачность <input type="range" id="lyA" min="0.15" max="1" step="0.05" value="1"></label></div>
      <div class="row"><button class="ubtn" id="lyAll">Все</button><button class="ubtn" id="lyReset">Сброс</button><button class="ubtn main" id="lyDone">Готово</button></div>`;
    document.body.appendChild(bar);
    $('lyS').oninput = e => setProp('s', +e.target.value); $('lyA').oninput = e => setProp('a', +e.target.value);
    $('lyAll').onclick = () => select(null);
    $('lyReset').onclick = () => { OPTS.layout = {}; saveOpts(); apply(); select(sel); UI.toast('Раскладка сброшена'); };
    $('lyDone').onclick = () => edit(false);
    bar.addEventListener('pointerdown', e => e.stopPropagation(), true);
  }
  function edit(on) {
    if (on === active) return; active = on; document.body.classList.toggle('layoutEdit', on);
    if (on) { if (!bar) buildBar(); bar.style.display = ''; UI.closeAll(); Input.homeJoy(); apply(); select(null); }
    else { bar.style.display = 'none'; select(null); drag = null; saveOpts(); apply(); Input.homeJoy(); }
  }
  // Перетаскивание: перехватываем указатель раньше кнопок (capture), пока открыт режим настройки
  document.addEventListener('pointerdown', e => {
    if (!active) return; const t = e.target.closest && e.target.closest('[data-edit]'); if (bar && bar.contains(e.target)) return;
    e.stopPropagation(); e.preventDefault();
    if (!t) return; const id = t.id; select(id); const c = center(id); drag = { id, pid: e.pointerId, ox: e.clientX, oy: e.clientY, cx: c.x, cy: c.y, hw: c.hw, hh: c.hh, moved: false };
  }, true);
  document.addEventListener('pointermove', e => {
    if (!active || !drag || e.pointerId !== drag.pid) return; e.stopPropagation();
    const dx = e.clientX - drag.ox, dy = e.clientY - drag.oy; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; if (!drag.moved) return;
    const x = clamp(drag.cx + dx / VW, drag.hw / VW, 1 - drag.hw / VW), y = clamp(drag.cy + dy / VH, drag.hh / VH, 1 - drag.hh / VH);
    const en = store()[drag.id] || (store()[drag.id] = {}); en.x = x; en.y = y; applyOne(drag.id);
  }, true);
  const up = e => { if (!active || !drag || e.pointerId !== drag.pid) return; e.stopPropagation(); drag = null; saveOpts(); };
  document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
  document.addEventListener('click', e => { if (active && !(bar && bar.contains(e.target))) { e.stopPropagation(); e.preventDefault(); } }, true);
  window.addEventListener('resize', () => setTimeout(apply, 50));
  for (const id of IDS) { const el = $(id); if (el) el.setAttribute('data-edit', '1'); }
  return { edit, apply, alpha, scale, get active() { return active; }, has: id => !!(ent(id) && ent(id).x !== undefined), homeCenter: id => { const e = ent(id); return e && e.x !== undefined ? { x: e.x * VW, y: e.y * VH } : null; } };
})();
