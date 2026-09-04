// Проверка механизма обновления: манифест, сравнение версий, диалог, ветка приложения
const { chromium } = require('playwright'); const path = require('path');
// Ожидаемую версию берём из AndroidManifest.xml — он источник правды.
// Раньше здесь стояли числа 19 и 1.8, и тест ломался при любом подъёме версии.
// version.json для сверки не годится: его пишет CI уже после выпуска релиза,
// поэтому в рабочем дереве он законно отстаёт от исходников.
const MANIFEST = require('fs').readFileSync(
  require('path').resolve(__dirname, '..', 'android/AndroidManifest.xml'), 'utf8');
const WANT_CODE = +MANIFEST.match(/android:versionCode="(\d+)"/)[1];
const WANT_NAME = MANIFEST.match(/android:versionName="([^"]+)"/)[1];
(async () => {
  const file = process.argv[2] || require('path').resolve(__dirname, '..', 'game/index.html');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 890, height: 400 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)); });
  const ev = (f, a) => p.evaluate(f, a); const wait = ms => p.waitForTimeout(ms);
  const bad = []; const ck = (n, ok, i) => { console.log((ok ? 'OK   ' : 'BUG  ') + n + (i !== undefined ? ' — ' + i : '')); if (!ok) bad.push(n + ': ' + i); };

  // сеть наружу запрещена: любой незаглушённый запрос — баг
  let leaked = [];
  await p.route('**://*/**', r => { const u = r.request().url(); if (!u.startsWith('file:')) { leaked.push(u); r.abort(); } else r.continue(); });
  await p.goto('file://' + path.resolve(file)); await wait(2200);

  ck('модуль загружен', await ev(() => typeof Update === 'object'));
  const code = await ev(() => Update.CODE);
  ck('versionCode совпадает с манифестом APK', code === WANT_CODE, 'CODE=' + code + ' манифест=' + WANT_CODE);

  // --- 1. манифест новее: показываем окно ---
  await ev(() => {
    localStorage.removeItem('grimhold_upd_checked'); localStorage.removeItem('grimhold_upd_skip'); localStorage.removeItem('grimhold_upd_manifest');
    window.__f = []; window.fetch = (u, o) => { window.__f.push(u); return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ version: '9.9', versionCode: 99, date: '2026-12-01', notes: ['первое', 'второе'], apk: 'https://example/a.apk', apkSize: 2097152, page: 'https://example/rel' })) }); };
  });
  const m = await ev(() => Update.check(true).then(m => ({ m, urls: window.__f })));
  ck('манифест разобран', m.m && m.m.versionCode === 99, JSON.stringify(m.m && m.m.version));
  ck('запрос ушёл на raw.githubusercontent', /raw\.githubusercontent\.com\/Giperzvuk\/Grimhold3d\/main\/version\.json/.test(m.urls[0]), m.urls[0]);
  ck('новее текущей', await ev(() => Update.available), '');
  await ev(() => Update.prompt(true)); await wait(120);
  const dlg = await ev(() => ({ show: $('dlg').classList.contains('show'), name: $('dlgName').textContent, txt: $('dlgText').textContent, opts: [...$('dlgOpts').children].map(b => b.textContent) }));
  ck('окно обновления открылось', dlg.show && /Доступно обновление/.test(dlg.name), dlg.name);
  ck('видно обе версии и размер', dlg.txt.includes(WANT_NAME) && /9\.9/.test(dlg.txt) && /2\.0 МБ/.test(dlg.txt), dlg.txt.slice(0, 90));
  ck('список изменений', /первое/.test(dlg.txt) && /второе/.test(dlg.txt));
  ck('кнопки: загрузка, позже, пропустить', dlg.opts.length === 3 && /Открыть страницу/.test(dlg.opts[0]) && /Позже/.test(dlg.opts[1]) && /Пропустить/.test(dlg.opts[2]), dlg.opts.join(' | '));

  // --- 2. «Пропустить эту версию» больше не всплывает ---
  await ev(() => { [...$('dlgOpts').children].find(b => /Пропустить/.test(b.textContent)).click(); });
  ck('версия отмечена как пропущенная', await ev(() => localStorage.getItem('grimhold_upd_skip') === '99' && Update.available === false));

  // --- 3. равная и старая версия: окно «всё свежее» ---
  for (const [tag, vc] of [['равная', 19], ['старая', 5]]) {
    await ev(v => { localStorage.clear(); window.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ version: '1.0', versionCode: v })) }); }, vc);
    const r = await ev(() => Update.check(true).then(() => { Update.prompt(true); return { av: Update.available, name: $('dlgName').textContent, txt: $('dlgText').textContent }; }));
    ck('обновления нет (' + tag + ' версия)', !r.av && /Обновление/.test(r.name) && /последняя версия/.test(r.txt), r.txt.slice(0, 60));
  }

  // --- 4. запасной путь: version.json недоступен, читаем релиз из API ---
  await ev(() => {
    localStorage.clear(); window.__f = [];
    window.fetch = u => { window.__f.push(u); if (/version\.json/.test(u)) return Promise.reject(new Error('HTTP 404'));
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ tag_name: 'v2.5', published_at: '2026-10-02T10:00:00Z', html_url: 'https://example/rel25', body: '- новая пещера\n- versionCode 40', assets: [{ name: 'Grimhold3D.apk', size: 1700000, browser_download_url: 'https://example/g.apk' }] })) }); };
  });
  const fb = await ev(() => Update.check(true).then(m => ({ m, urls: window.__f })));
  ck('запасной путь через API релизов', fb.m && fb.m.versionCode === 40 && fb.m.version === '2.5', JSON.stringify(fb.m && [fb.m.version, fb.m.versionCode, fb.m.apk]));
  ck('описание релиза разобрано', fb.m && fb.m.notes.join('|') === 'новая пещера', JSON.stringify(fb.m && fb.m.notes));
  ck('второй запрос — к api.github.com', /api\.github\.com\/repos\/Giperzvuk\/Grimhold3d\/releases\/latest/.test(fb.urls[1]), fb.urls[1]);

  // --- 5. нет сети: тихо, без падений ---
  await ev(() => { localStorage.clear(); window.fetch = () => Promise.reject(new Error('Failed to fetch')); });
  const off = await ev(() => Update.check(false).then(m => ({ m, av: Update.available })));
  ck('нет сети — не падаем, проверка возвращает пусто', off.m === null, 'available=' + off.av + ' (последний известный манифест помним намеренно)');

  // --- 6. ветка приложения: мост GrimholdNet вместо fetch ---
  await ev(() => {
    localStorage.clear(); window.__dl = null; window.__opened = null;
    window.GrimholdNet = {
      available: () => true,
      get(id, url) { window.__got = url; setTimeout(() => { window.__txt = JSON.stringify({ version: '3.0', versionCode: 50, notes: ['мостовая проверка'], apk: 'https://example/x.apk', apkSize: 3000000, apkSha256: 'a'.repeat(64) }); Update._netDone(id); }, 10); },
      text: () => window.__txt, error: () => null, done() { }, cancel() { },
      canInstall: () => true, askInstall() { }, open(u) { window.__opened = u; },
      download(id, url, sha, size) { window.__dl = { id, url, sha, size }; setTimeout(() => Update._dlProgress(id, 1500000, size), 10); },
      install(id) { window.__installed = id; }
    };
    window.fetch = () => Promise.reject(new Error('fetch не должен вызываться в приложении'));
  });
  const app = await ev(() => Update.check(true).then(m => ({ m, got: window.__got, isApp: Update.isApp })));
  ck('в приложении запрос идёт через мост', app.isApp && app.m && app.m.versionCode === 50 && /raw\.githubusercontent/.test(app.got), app.got);
  await ev(() => Update.prompt(true)); await wait(60);
  const ao = await ev(() => [...$('dlgOpts').children].map(b => b.textContent));
  ck('в приложении первая кнопка — установка', /Скачать и установить/.test(ao[0]), ao.join(' | '));
  await ev(() => [...$('dlgOpts').children][0].click()); await wait(120);
  const dl = await ev(() => ({ dl: window.__dl, txt: $('dlgText').textContent, opts: [...$('dlgOpts').children].map(b => b.textContent) }));
  ck('загрузка началась с sha256 и размером', dl.dl && dl.dl.url === 'https://example/x.apk' && dl.dl.sha.length === 64 && dl.dl.size === 3000000, JSON.stringify(dl.dl));
  ck('прогресс показан в процентах', /50%/.test(dl.txt), dl.txt.trim().slice(0, 60));
  ck('во время загрузки есть отмена', dl.opts.length === 1 && /Отменить/.test(dl.opts[0]), dl.opts.join('|'));
  await ev(() => Update._dlDone(window.__dl.id)); await wait(600);
  ck('после загрузки вызван установщик', await ev(() => !!window.__installed), await ev(() => window.__installed));

  // --- 7. ошибка загрузки → предложение открыть релиз вручную ---
  await ev(() => { window.GrimholdNet.error = () => 'контрольная сумма не совпала'; window.GrimholdNet.download = (id) => { window.__dl = { id }; }; Update.prompt(true); });
  await ev(() => [...$('dlgOpts').children][0].click()); await wait(60);
  await ev(() => Update._dlDone(window.__dl.id)); await wait(60);
  const er = await ev(() => ({ txt: $('dlgText').textContent, opts: [...$('dlgOpts').children].map(b => b.textContent) }));
  ck('ошибка объяснена и есть ручной путь', /не удалась/.test(er.txt) && /сумма/.test(er.txt) && /страницу релиза/.test(er.opts[0]), er.txt.slice(0, 80));

  // --- 8. Android не разрешил установку из источника ---
  await ev(() => { window.GrimholdNet.canInstall = () => false; window.__asked = false; window.GrimholdNet.askInstall = () => { window.__asked = true; }; Update.prompt(true); [...$('dlgOpts').children][0].click(); }); await wait(60);
  ck('просим разрешение на установку', await ev(() => window.__asked && /разрешить установку/.test($('dlgText').textContent)), await ev(() => $('dlgText').textContent.slice(0, 70)));

  // --- 9. автопроверка при запуске: включена — ходит сама, выключена — молчит ---
  await p.addInitScript(() => { window.__f = []; window.fetch = u => { window.__f.push(u); return Promise.reject(new Error('нет сети')); }; });
  for (const [tag, on, want] of [['включена', true, true], ['выключена', false, false]]) {
    await ev(v => { localStorage.clear(); OPTS.updates = v; saveOpts(); }, on);
    await p.reload(); await wait(6000);
    const n = await ev(() => window.__f.length);
    ck('автопроверка при запуске (' + tag + ')', (n > 0) === want, n + ' запрос(ов)');
  }

  // --- 10. кнопка в меню ---
  await ev(() => { OPTS.updates = true; saveOpts(); localStorage.setItem('grimhold_upd_manifest', JSON.stringify({ version: '4.1', versionCode: 60, notes: ['проверка меню'] })); });
  await p.reload(); await wait(2500);
  await ev(() => UI.menu(true));
  const btn = await ev(() => [...$('menuBtns').querySelectorAll('button')].map(b => b.textContent));
  ck('пункт меню показывает новую версию', btn.some(t => /Обновление · есть v4\.1/.test(t)), btn.filter(t => /бновлени/.test(t)).join('|'));
  ck('метка версии в углу меню', /есть 4\.1/.test(await ev(() => $('menuVer').textContent)), await ev(() => $('menuVer').textContent));

  ck('запросов мимо заглушки нет', leaked.length === 0, leaked.slice(0, 3).join(' '));
  ck('ошибок в консоли нет', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(bad.length ? '\nПРОБЛЕМ: ' + bad.length + '\n' + bad.join('\n') : '\nВсё чисто');
  process.exit(bad.length ? 1 : 0);
})();
