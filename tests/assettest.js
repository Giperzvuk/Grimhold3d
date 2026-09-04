// Проверка загрузчика нарисованных поверхностей (game/assets.js).
// Подменяет game/assets_data.js на время прогона и возвращает как было.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

const DATA = path.resolve(__dirname, '..', 'game', 'assets_data.js');
const PAGE = 'file://' + path.resolve(__dirname, '..', 'game/index.html');
// 64×64: четыре квадранта разного цвета — красный, зелёный, синий, жёлтый
const TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAW0lEQVR42u3YwQkAMQwDQSn99+yrwiEHsw2YQT93sluXD5z8PAAAAAAAAAAAAAAAAAAAAAAAAAAAAID7Ndl94M/UAgAAAAAAAAAAAAAAAAAAAAAAAAAAAABv9QGJggV8G1IcDQAAAABJRU5ErkJggg==';

const bad = [];
const ck = (n, ok, info) => {
  console.log((ok ? 'OK   ' : 'BUG  ') + n + (info !== undefined ? ' — ' + info : ''));
  if (!ok) bad.push(n + ': ' + info);
};

async function withPage(fn) {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 890, height: 400 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGE: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)); });
  await p.addInitScript(() => {
    try {
      const o = JSON.parse(localStorage.getItem('grimhold_opts') || '{}');
      o.updates = false; localStorage.setItem('grimhold_opts', JSON.stringify(o));
    } catch (e) { }
  });
  await p.goto(PAGE);
  await p.waitForTimeout(2000);
  try { return await fn(p, errs); } finally { await b.close(); }
}

(async () => {
  const saved = fs.existsSync(DATA) ? fs.readFileSync(DATA, 'utf8') : null;
  try {
    // ---- пустой манифест: игра целиком на процедурных ----
    fs.writeFileSync(DATA, 'const ASSET_DATA = { tiles: {} };\n');
    await withPage(async (p, errs) => {
      const r = await p.evaluate(() => ({
        count: ASSETS.count, total: ASSETS.total, ready: ASSETS.ready,
        brick: TEX.T.brick.width, tile: TEX.T.brick.isTile === true,
      }));
      ck('пустой манифест: ничего не заменено', r.count === 0 && r.total === 0, `count=${r.count}`);
      ck('пустой манифест: готовность выставлена', r.ready === true);
      ck('пустой манифест: остаются процедурные 128px', r.brick === 128, r.brick);
      ck('пустой манифест: ошибок нет', errs.length === 0, errs.join(' | '));
    });

    // ---- битая ссылка: тихий откат на процедурные ----
    fs.writeFileSync(DATA, 'const ASSET_DATA = { tiles: { brick: "data:image/png;base64,zzz" } };\n');
    await withPage(async (p, errs) => {
      const r = await p.evaluate(() => ({ count: ASSETS.count, ready: ASSETS.ready, brick: TEX.T.brick.width }));
      ck('битая картинка: не заменяет процедурную', r.count === 0 && r.brick === 128, `count=${r.count} w=${r.brick}`);
      ck('битая картинка: не подвешивает готовность', r.ready === true);
      ck('битая картинка: не роняет страницу', !errs.some(e => e.startsWith('PAGE:')), errs.join(' | '));
    });

    // ---- нормальная сдача: подмена и раскладка 2×2 ----
    fs.writeFileSync(DATA, `const ASSET_DATA = { tiles: { brick: "${TILE}", rock: "${TILE}" } };\n`);
    await withPage(async (p, errs) => {
      const r = await p.evaluate(() => {
        const c = TEX.T.brick, x = c.getContext('2d');
        const px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data).slice(0, 3).join(',');
        return {
          count: ASSETS.count, total: ASSETS.total,
          w: c.width, tile: c.isTile === true,
          plaster: TEX.T.plaster.width,
          qs: [px(16, 16), px(48, 16), px(16, 48), px(48, 48)],
        };
      });
      ck('сдача: обе поверхности заменены', r.count === 2 && r.total === 2, `${r.count}/${r.total}`);
      ck('сдача: размер взят из картинки', r.w === 64, r.w);
      ck('сдача: isTile проставлен (иначе не будет повтора по UV)', r.tile);
      ck('сдача: незаявленная поверхность осталась процедурной', r.plaster === 128, r.plaster);
      ck('сдача: раскладка 2×2 сохранена без перестановки квадрантов',
        r.qs.join(' ') === '255,0,0 0,255,0 0,0,255 255,255,0', r.qs.join(' '));
      ck('сдача: ошибок нет', errs.length === 0, errs.join(' | '));

      // материал движка обязан взять именно загруженную текстуру
      const m = await p.evaluate(() => {
        UI.newGame(); UI.closeAll();
        return new Promise(res => setTimeout(() => {
          const s = n => { const t = R.tileMat(n).diffuseTexture.getSize(); return t.width; };
          const before = s('brick');
          R.dropTileCache();
          loadLevel(L.id, { wx: P.x, wz: P.z, yaw: P.yaw });
          res({ before, after: s('brick'), proc: s('plaster'), meshes: R.scene.meshes.length });
        }, 2500));
      });
      ck('материал движка держит загруженную текстуру', m.before === 64, m.before);
      ck('после сброса кэша текстура остаётся загруженной', m.after === 64, m.after);
      ck('процедурная поверхность в материале не тронута', m.proc === 128, m.proc);
      ck('пересборка уровня не размножает меши', m.meshes > 0 && m.meshes < 400, m.meshes);
    });
  } finally {
    if (saved === null) fs.unlinkSync(DATA); else fs.writeFileSync(DATA, saved);
  }

  console.log(bad.length ? '\nПРОБЛЕМЫ:\n' + bad.join('\n') : '\nВсё чисто');
  process.exit(bad.length ? 1 : 0);
})();
