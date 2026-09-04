// ---------- Обновление игры прямо из GitHub ----------
// Манифест version.json лежит в корне репозитория. Игра сравнивает versionCode,
// показывает список изменений и (в APK) сама качает и ставит новую сборку.
'use strict';
const Update = (() => {
  const REPO = 'Giperzvuk/Grimhold3d', BRANCH = 'main';
  const CODE = 20;                       // versionCode ЭТОЙ сборки — растёт с каждым релизом
  const MANIFEST = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/version.json`;
  const API = `https://api.github.com/repos/${REPO}/releases/latest`;
  const PAGE = `https://github.com/${REPO}/releases/latest`;
  const PERIOD = 6 * 3600 * 1000;        // не чаще раза в 6 часов
  let latest = null, busy = false, dlId = null, lastErr = '';

  // Мост приложения: сеть и установщик на нативной стороне (в WebView нет CORS и нет установки APK)
  const net = () => { try { return (typeof GrimholdNet !== 'undefined' && GrimholdNet && GrimholdNet.available()) ? GrimholdNet : null; } catch (e) { return null; } };
  const pend = new Map(); let reqN = 0;
  const mark = (k, v) => { try { localStorage.setItem('grimhold_upd_' + k, String(v)); } catch (e) { } };
  const read = k => { try { return localStorage.getItem('grimhold_upd_' + k) || ''; } catch (e) { return ''; } };

  function getText(url) {
    const nt = net();
    if (nt) {
      const id = 'u' + (++reqN);
      return new Promise((res, rej) => {
        pend.set(id, { res, rej });
        try { nt.get(id, url); } catch (e) { pend.delete(id); rej(new Error('мост приложения недоступен')); }
        setTimeout(() => { if (pend.has(id)) { pend.delete(id); try { nt.done(id); } catch (e) { } rej(new Error('таймаут')); } }, 25000);
      });
    }
    return fetch(url, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
  }
  function netDone(id) {
    const p = pend.get(id); pend.delete(id); const nt = net(); if (!p || !nt) return;
    try { const e = nt.error(id); if (e) { nt.done(id); p.rej(new Error(e)); return; } const t = nt.text(id); nt.done(id); p.res(t); }
    catch (err) { try { nt.done(id); } catch (e2) { } p.rej(err); }
  }

  // Запасной путь: если version.json не дошёл, спрашиваем последний релиз у API GitHub
  function fromRelease(json) {
    const r = JSON.parse(json), tag = String(r.tag_name || '').replace(/^v/, '');
    const apk = (r.assets || []).find(a => /\.apk$/i.test(a.name)), html = (r.assets || []).find(a => /\.html$/i.test(a.name));
    const code = (() => { const m = /versionCode[^0-9]*(\d+)/i.exec(r.body || ''); return m ? +m[1] : 0; })();
    return { version: tag, versionCode: code, date: (r.published_at || '').slice(0, 10), notes: String(r.body || '').split('\n').map(s => s.replace(/^[-*]\s*/, '').trim()).filter(s => s && !/^#|versionCode/i.test(s)).slice(0, 12), apk: apk && apk.browser_download_url, apkSize: apk && apk.size, html: html && html.browser_download_url, page: r.html_url || PAGE };
  }
  const newer = m => m && ((m.versionCode | 0) > CODE || ((m.versionCode | 0) === 0 && cmpVer(m.version, VERSION) > 0));
  function cmpVer(a, b) { const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; }

  function check(manual) {
    if (busy) return Promise.resolve(null);
    busy = true; lastErr = '';
    return getText(MANIFEST + '?t=' + Math.floor(Date.now() / 6e5))
      .then(t => JSON.parse(t))
      .catch(() => getText(API).then(fromRelease))
      .then(m => { latest = m; mark('checked', Date.now()); mark('code', m.versionCode | 0); busy = false; return m; })
      .catch(e => { busy = false; lastErr = (e && e.message) || 'нет сети'; if (manual) log('Обновление: ' + lastErr, 'red'); return null; });
  }

  // Автопроверка при запуске: тихо, не чаще раза в 6 часов, не мешает игре
  function auto() {
    if (OPTS.updates === false) return;
    const t = +read('checked') || 0;
    if (Date.now() - t < PERIOD) { if (newer(cached()) && !skipped(cached())) setTimeout(() => badge(), 1200); return; }
    setTimeout(() => check(false).then(m => { if (newer(m)) { cache(m); if (!skipped(m)) prompt(); else badge(); } }), 3500);
  }
  function cache(m) { try { localStorage.setItem('grimhold_upd_manifest', JSON.stringify(m)); } catch (e) { } }
  function cached() { if (latest) return latest; try { return latest = JSON.parse(localStorage.getItem('grimhold_upd_manifest') || 'null'); } catch (e) { return null; } }
  const skipped = m => !!m && read('skip') === String(m.versionCode | 0);

  // Ненавязчивая метка в меню, если обновление отложили
  function badge() { const el = $('menuVer'); if (el && newer(cached())) el.innerHTML = 'v' + VERSION + ' · <span style="color:#d9a53c">есть ' + cached().version + '</span>'; }

  const kb = n => !n ? '' : n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.round(n / 1024) + ' КБ';
  function notesHtml(m) {
    const li = (m.notes || []).map(s => `<div class="item"><span>·</span><span class="hint" style="margin:0;text-align:left">${String(s).replace(/[<>]/g, '')}</span></div>`).join('');
    return `<div style="text-align:left">Установлено: <b>v${VERSION}</b> · доступно: <b style="color:#d9a53c">v${m.version}</b>${m.date ? ' от ' + m.date : ''}${m.apkSize ? ' · ' + kb(m.apkSize) : ''}</div>${li || '<div class="hint">Описание изменений не приложили.</div>'}`;
  }

  // Главное окно обновления
  function prompt(manual) {
    const m = cached();
    if (!m || !newer(m)) {
      Dialog.show({ name: 'Обновление', voice: null, text: lastErr ? 'Не удалось спросить GitHub: ' + lastErr + '\n\nПроверь сеть и попробуй позже.' : 'У тебя последняя версия — v' + VERSION + '. Ничего нового не завезли.', opts: [{ label: 'Проверить ещё раз', go: () => { check(true).then(m2 => { if (newer(m2)) { cache(m2); prompt(true); } else prompt(true); }); return 'keep'; } }, { label: 'Назад', main: true, go: () => { UI.menu(true); return 'close'; } }] });
      return;
    }
    const app = !!net();
    const opts = [];
    opts.push({ label: app ? 'Скачать и установить' : 'Открыть страницу загрузки', main: true, go: () => { if (app) startDownload(m); else { openUrl(m.page || PAGE); return 'close'; } return 'keep'; } });
    if (!app && m.web) opts.push({ label: 'Играть в браузере', go: () => { openUrl(m.web); return 'close'; } });
    opts.push({ label: 'Позже', go: () => { mark('checked', Date.now()); badge(); UI.menu(true); return 'close'; } });
    opts.push({ label: 'Пропустить эту версию', go: () => { mark('skip', m.versionCode | 0); UI.menu(true); return 'close'; } });
    Dialog.show({ name: 'Доступно обновление', voice: null, html: notesHtml(m), opts });
  }

  function openUrl(u) { try { const nt = net(); if (nt && nt.open) { nt.open(u); return; } } catch (e) { } try { window.open(u, '_blank'); } catch (e) { log('Ссылка: ' + u, 'blue'); } }

  // ---- загрузка APK через нативный мост ----
  function startDownload(m) {
    const nt = net(); if (!nt) return;
    if (!m.apk) { progress('В релизе нет файла APK. Открой страницу релиза вручную.', true); return; }
    try { if (nt.canInstall && !nt.canInstall()) { progress('Android просит разрешить установку из этого приложения. Открываю настройки — включи переключатель и вернись.', true); try { nt.askInstall(); } catch (e) { } return; } } catch (e) { }
    dlId = 'd' + (++reqN);
    progress('Скачиваю… 0%');
    try { nt.download(dlId, m.apk, m.apkSha256 || '', m.apkSize | 0); }
    catch (e) { progress('Не удалось начать загрузку: ' + e.message, true); }
  }
  function progress(text, err) {
    const opts = err
      ? [{ label: 'Открыть страницу релиза', main: true, go: () => { openUrl((cached() && cached().page) || PAGE); return 'close'; } }, { label: 'Закрыть', go: () => { UI.menu(true); return 'close'; } }]
      : [{ label: 'Отменить', go: () => { const nt = net(); if (nt && dlId) try { nt.cancel(dlId); } catch (e) { } dlId = null; UI.menu(true); return 'close'; } }];
    Dialog.show({ name: 'Обновление', voice: null, html: `<div style="text-align:left">${String(text).replace(/[<>]/g, '')}</div>`, opts });
  }
  function dlProgress(id, got, total) { if (id !== dlId) return; const pc = total > 0 ? Math.round(got / total * 100) : 0; const el = $('dlgText'); if (el) el.innerHTML = `<div style="text-align:left">Скачиваю… ${pc}% <span class="hint" style="margin:0">(${kb(got)}${total ? ' из ' + kb(total) : ''})</span></div>`; }
  function dlDone(id) {
    if (id !== dlId) return; const nt = net(); dlId = null; if (!nt) return;
    try { const e = nt.error(id); if (e) { nt.done(id); progress('Загрузка не удалась: ' + e, true); return; } }
    catch (e) { progress('Загрузка не удалась', true); return; }
    progress('Файл загружен. Сейчас откроется установщик Android — подтверди установку. Прогресс и настройки сохранятся.');
    setTimeout(() => { try { net().install(id); } catch (e) { progress('Не удалось открыть установщик: ' + e.message, true); } }, 400);
  }

  return { check, auto, prompt, badge, get latest() { return cached(); }, get available() { return newer(cached()) && !skipped(cached()); }, get isApp() { return !!net(); }, CODE, REPO, PAGE, _netDone: netDone, _dlProgress: dlProgress, _dlDone: dlDone };
})();
