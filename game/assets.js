// ---------- Нарисованные поверхности поверх процедурных ----------
// Если сборка содержит assets_data.js (его делает tools/pack_assets.py из художественной
// сдачи), подменяем канвасы в TEX.T на нарисованные тайлы. Нет файла или картинка
// не открылась — молча остаётся процедурная генерация из textures.js.
//
// Раскладка та же, что у процедурных: сетка 2×2 из четырёх вариантов одной поверхности,
// клетки карты выбирают квадрант. Поэтому подмена ничего не меняет ни в геометрии,
// ни в UV — рендер продолжает работать с канвасом, только большего размера.
'use strict';
const ASSETS = (() => {
  const data = (typeof ASSET_DATA !== 'undefined' && ASSET_DATA && ASSET_DATA.tiles) || null;
  const names = data ? Object.keys(data) : [];
  let pending = names.length;
  let loaded = 0;
  const waiters = [];

  function done() {
    // Уровень уже собран: материалы держат старые текстуры, поэтому сбрасываем кэш
    // и пересобираем сцену на месте — тем же приёмом, что смена качества теней.
    if (loaded && typeof R !== 'undefined' && R.dropTileCache) {
      R.dropTileCache();
      if (typeof G !== 'undefined' && G && typeof L !== 'undefined' && L &&
          typeof loadLevel === 'function' && typeof P !== 'undefined' && P) {
        try { loadLevel(L.id, { wx: P.x, wz: P.z, yaw: P.yaw }); } catch (e) { console.error(e); }
      }
    }
    while (waiters.length) waiters.shift()();
  }

  function put(name, src) {
    const img = new Image();
    img.onload = () => {
      if (typeof TEX !== 'undefined' && TEX.T && TEX.T[name]) {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;      // фильтрация NEAREST, как в движке
        x.drawImage(img, 0, 0);
        c.isTile = true;                       // без этого texOf не включит повтор по UV
        TEX.T[name] = c;
        loaded++;
      }
      if (--pending === 0) done();
    };
    img.onerror = () => { if (--pending === 0) done(); };
    img.src = src;
  }

  if (pending) for (const n of names) put(n, data[n]); else done();

  return {
    // Сколько поверхностей заменено нарисованными. 0 — игра целиком на процедурных.
    get count() { return loaded; },
    get total() { return names.length; },
    get ready() { return pending === 0; },
    whenReady(fn) { if (pending === 0) fn(); else waiters.push(fn); },
  };
})();
