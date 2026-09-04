// Прокси для озвучки Fish Audio на Cloudflare Workers — бесплатно, без своего сервера.
//
// Как поставить (5 минут):
//   1. dash.cloudflare.com → Workers & Pages → Create → Worker → Deploy
//   2. Edit code → вставить этот файл целиком → Deploy
//   3. (по желанию) Settings → Variables → добавить секрет FISH_KEY с ключом,
//      тогда ключ живёт на сервере и в игру его вписывать не нужно
//   4. В игре: Меню → Озвучка диалогов → «Адрес прокси» = https://ИМЯ.ВАШ-СУБДОМЕН.workers.dev
//      (без /v1/tts на конце)
//
// Бесплатный тариф Workers: 100 000 запросов в сутки — для игры с запасом.

const UPSTREAM = 'https://api.fish.audio/v1/tts';
const CORS = {
  'Access-Control-Allow-Origin': '*',            // при желании сузить до своего домена
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, model',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: CORS });

    const url = new URL(request.url);
    if (!url.pathname.endsWith('/v1/tts')) return new Response('not found', { status: 404, headers: CORS });

    let body;
    try { body = await request.json(); } catch (e) { return new Response('bad json', { status: 400, headers: CORS }); }
    if (!body.text || typeof body.text !== 'string') return new Response('no text', { status: 400, headers: CORS });
    body.text = body.text.slice(0, 1200);   // отсекаем слишком длинные реплики

    // Ключ игрока имеет приоритет; иначе берём серверный секрет FISH_KEY
    const auth = request.headers.get('authorization') || (env.FISH_KEY ? `Bearer ${env.FISH_KEY}` : null);
    if (!auth) return new Response('no api key', { status: 401, headers: CORS });

    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        Authorization: auth,
        model: request.headers.get('model') || env.FISH_MODEL || 's2.1-pro-free',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!upstream.ok) {
      const text = (await upstream.text()).slice(0, 300);
      return new Response(text || 'upstream error', { status: upstream.status, headers: CORS });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' }
    });
  }
};
