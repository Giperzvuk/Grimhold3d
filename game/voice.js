// ---------- Онлайн-озвучка реплик через Fish Audio (модель s2.1-pro-free) ----------
// Ключ хранится только в localStorage игрока. Запрос: POST /v1/tts, заголовки Authorization + model.
// Ответ — поток аудио (mp3), играем через общий AudioContext, чтобы работала громкость и приглушение музыки.
'use strict';
const Voice = (() => {
  const API = 'https://api.fish.audio/v1/tts', MODEL = 's2.1-pro-free';
  // Предел ожидания ответа. Без него браузерный путь висит бесконечно: fetch сам
  // по себе не истекает, и настройки застревали на «Запрос…» вместо диагноза.
  const REQ_TIMEOUT = 30000;
  // Роли: разная подача без клонирования голоса. reference_id можно вписать в настройках (id голоса с fish.audio).
  const ROLES = {
    narrator: { speed: 1.0, temp: 0.6, top_p: 0.7 },
    elderMale: { speed: 0.88, temp: 0.6, top_p: 0.7 },
    gruffMale: { speed: 0.95, temp: 0.75, top_p: 0.8 },
    youngMale: { speed: 1.08, temp: 0.8, top_p: 0.8 },
    warmFemale: { speed: 1.0, temp: 0.7, top_p: 0.75 },
    oldFemale: { speed: 0.9, temp: 0.65, top_p: 0.7 },
    villain: { speed: 0.82, temp: 0.55, top_p: 0.65 }
  };
  const NPC_ROLE = {
    elder: 'elderMale', smith: 'gruffMale', healer: 'oldFemale', guard: 'youngMale', villager1: 'youngMale',
    innkeeper: 'warmFemale', miner: 'gruffMale', drunk: 'youngMale', hunter: 'gruffMale', chief: 'gruffMale',
    vorlat: 'villain', intro: 'narrator', ilva: 'oldFemale', elinor: 'warmFemale'
  };
  const roleFor = npc => ROLES[NPC_ROLE[npc] || 'narrator'] ? (NPC_ROLE[npc] || 'narrator') : 'narrator';

  let ctx = null, bus = null, cur = null, abort = null, fails = 0, mem = new Map(), db = null, lastKey = '';
  // Мост приложения: в APK запрос уходит через нативный код, поэтому CORS не мешает вовсе
  const native = () => { try { return (typeof GrimholdTTS !== 'undefined' && GrimholdTTS && GrimholdTTS.available()) ? GrimholdTTS : null; } catch (e) { return null; } };
  const pending = new Map(); let reqN = 0;
  const b64 = str => { const bin = atob(str), n = bin.length, a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = bin.charCodeAt(i); return a; };
  const MEM_MAX = 40;
  // ---- нормализация текста под TTS ----
  const ONES = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const HUNDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  function num2ru(n) {
    n = +n; if (!isFinite(n) || n > 9999) return String(n);
    if (n >= 1000) { const t = Math.floor(n / 1000); return (t === 1 ? 'тысяча' : t === 2 ? 'две тысячи' : ONES[t] + ' тысяч') + (n % 1000 ? ' ' + num2ru(n % 1000) : ''); }
    let out = '';
    if (n >= 100) { out += HUNDS[Math.floor(n / 100)]; n %= 100; if (n) out += ' '; }
    if (n >= 20) { out += TENS[Math.floor(n / 10)]; n %= 10; if (n) out += ' ' + ONES[n]; }
    else if (n > 0 || !out) out += ONES[n];
    return out;
  }
  function prep(text) {
    return String(text || '')
      .replace(/[«»"]/g, '')          // кавычки TTS читает как паузы-артефакты
      .replace(/—/g, ',')             // тире → запятая: пауза без «минуса»
      .replace(/…/g, '.')
      .replace(/\b(\d+)\b/g, (m, d) => num2ru(d))
      .replace(/\s+/g, ' ')
      .replace(/ +([,.!?])/g, '$1')   // «слово , слово» → «слово, слово»
      .replace(/,\s*\./g, '.')
      .trim().slice(0, 900);
  }
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

  // ---- кэш в IndexedDB: одну и ту же реплику не запрашиваем дважды ----
  function openDb() {
    if (db !== null) return Promise.resolve(db);
    return new Promise(res => {
      try { const r = indexedDB.open('grimhold_voice', 1); r.onupgradeneeded = () => r.result.createObjectStore('clips'); r.onsuccess = () => { db = r.result; res(db); }; r.onerror = () => { db = false; res(false); }; }
      catch (e) { db = false; res(false); }
    });
  }
  function cacheGet(k) { return openDb().then(d => d ? new Promise(res => { try { const q = d.transaction('clips').objectStore('clips').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }) : null); }
  function cachePut(k, buf) { openDb().then(d => { if (!d) return; try { d.transaction('clips', 'readwrite').objectStore('clips').put(buf, k); } catch (e) { } }); }

  function audio() {
    if (!SFX.ready) SFX.init();
    if (!ctx && SFX.ctx) { ctx = SFX.ctx; bus = ctx.createGain(); bus.gain.value = 1; bus.connect(SFX.master || ctx.destination); }
    return ctx;
  }
  function stop() {
    if (abort) { try { abort.abort(); } catch (e) { } abort = null; }
    if (cur) { try { cur.stop(); } catch (e) { } cur = null; }
    MUSIC.duck(1);
  }
  function play(buf) {
    if (!audio()) return;
    return ctx.decodeAudioData(buf.slice(0)).then(ab => {
      if (cur) { try { cur.stop(); } catch (e) { } }
      const src = ctx.createBufferSource(); src.buffer = ab; const g = ctx.createGain(); g.gain.value = (OPTS.voiceVol === undefined ? 0.9 : OPTS.voiceVol);
      src.connect(g); g.connect(bus); src.start(); cur = src; MUSIC.duck(0.35);
      src.onended = () => { if (cur === src) { cur = null; MUSIC.duck(1); } };
    }).catch(() => { MUSIC.duck(1); });
  }
  function request(text, role) {
    const r = ROLES[role], refs = OPTS.voiceRefs || {}, ref = refs[role] || refs.all || null;
    const body = { text, format: 'mp3', mp3_bitrate: 64, latency: 'balanced', chunk_length: 200, normalize: true, temperature: r.temp, top_p: r.top_p, prosody: { speed: r.speed * (OPTS.voiceSpeed || 1), volume: 0 } };
    if (ref) body.reference_id = ref;
    const base = (OPTS.voiceProxy || '').trim().replace(/\/$/, ''), url = base ? base + '/v1/tts' : API;
    const auth = OPTS.voiceKey ? 'Bearer ' + OPTS.voiceKey.trim() : '';
    const nat = native();
    if (nat) { // путь приложения: без fetch и без CORS
      const id = 'r' + (++reqN);
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        try { nat.request(id, url, auth, MODEL, JSON.stringify(body)); }
        catch (e) { pending.delete(id); rej(new Error('мост приложения недоступен')); }
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); try { nat.done(id); } catch (e) { } rej(new Error('таймаут')); } }, REQ_TIMEOUT);
      });
    }
    abort = new AbortController();
    const headers = { 'Content-Type': 'application/json', model: MODEL };
    if (auth) headers.Authorization = auth;
    // Свой таймаут: обрыв по нему нужно отличать от отмены игроком, иначе диагноз
    // будет «Отменено» там, где на самом деле никто не ответил.
    const ctl = abort; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { ctl.abort(); } catch (e) { } }, REQ_TIMEOUT);
    return fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal })
      .then(r2 => { if (!r2.ok) throw new Error('HTTP ' + r2.status); return r2.arrayBuffer(); })
      .catch(e => { throw timedOut ? new Error('таймаут') : e; })
      .finally(() => clearTimeout(timer));
  }
  // Ответ нативного моста: забираем звук кусками (строка через мост ограничена по длине)
  function nativeDone(id) {
    const p = pending.get(id); pending.delete(id); const nat = native(); if (!p || !nat) return;
    try {
      const err = nat.error(id);
      if (err) { nat.done(id); p.rej(new Error(err)); return; }
      const total = nat.size(id) | 0; if (!total) { nat.done(id); p.rej(new Error('пустой ответ')); return; }
      const buf = new Uint8Array(total); let off = 0;
      while (off < total) { const part = b64(nat.chunk(id, off, 131072)); buf.set(part, off); off += part.length; if (!part.length) break; }
      nat.done(id); p.res(buf.buffer);
    } catch (e) { try { nat.done(id); } catch (e2) { } p.rej(e); }
  }
  function speak(text, npc, opts) {
    if (!OPTS.voiceOn || !text) return;
    if (!OPTS.voiceKey && !OPTS.voiceProxy) return;
    const role = roleFor(npc), t = prep(text); if (!t) return;
    const key = hash(role + '|' + (OPTS.voiceRefs && (OPTS.voiceRefs[role] || OPTS.voiceRefs.all) || '') + '|' + t);
    if (key === lastKey && cur) return; lastKey = key;
    stop();
    const m = mem.get(key);
    if (m) return play(m);
    cacheGet(key).then(buf => {
      if (buf) { mem.set(key, buf); return play(buf); }
      return request(t, role).then(ab => {
        fails = 0; mem.set(key, ab); if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value); cachePut(key, ab); return play(ab);
      }).catch(e => {
        if (e && e.name === 'AbortError') return;
        fails++;
        const why = /HTTP 401|HTTP 403/.test(e.message) ? 'ключ не принят' : /HTTP 402/.test(e.message) ? 'исчерпана квота' : /HTTP 5/.test(e.message) ? 'сервер занят' : native() ? 'нет сети: ' + e.message : 'браузер блокирует запрос (CORS) — нужен прокси';
        if (fails <= 2 || fails % 5 === 0) log('Озвучка: ' + why, 'red');
        if (fails >= 6) { OPTS.voiceOn = false; saveOpts(); log('Озвучка отключена после ошибок. Проверь ключ в меню.', 'red'); }
      });
    });
    if (opts && opts.onStart) opts.onStart();
  }
  // Пробный запрос из настроек: даёт понятный диагноз вместо молчания
  function test(cb) {
    if (!OPTS.voiceKey && !OPTS.voiceProxy) { cb('Нужен ключ Fish Audio или адрес прокси'); return; }
    stop(); const t0 = performance.now();
    request('Добро пожаловать в Гримхолд, странник.', 'elderMale')
      .then(ab => { play(ab); cb('Работает · ' + Math.round(performance.now() - t0) + ' мс'); })
      .catch(e => cb(/таймаут/.test(e.message) ? 'Ответа нет ' + Math.round(REQ_TIMEOUT / 1000) + ' с. '
        + (native() ? 'Проверь сеть и ключ.' : 'Скорее всего браузер режет прямой запрос — нужен прокси, поле «Адрес прокси».') :
        e && e.name === 'AbortError' ? 'Отменено' : /HTTP 401|HTTP 403/.test(e.message) ? 'Ключ не принят (401/403) — проверь ключ' : /HTTP 402/.test(e.message) ? 'Квота исчерпана (402)' : /HTTP/.test(e.message) ? e.message : native() ? 'Нет соединения: ' + e.message : 'Браузер блокирует прямой запрос (CORS). Нужен прокси — см. настройки, поле «Адрес прокси». В приложении-APK это не требуется.'));
  }
  function clearCache() { mem.clear(); openDb().then(d => { if (d) try { d.transaction('clips', 'readwrite').objectStore('clips').clear(); } catch (e) { } }); }
  try { openDb(); } catch (e) { } // прогреваем кэш заранее: первая реплика не должна ждать открытия базы
  return { speak, stop, test, clearCache, prep, num2ru, ROLES, NPC_ROLE, _nativeDone: nativeDone, get native() { return !!native(); }, get busy() { return !!cur; } };
})();
