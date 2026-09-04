# Мини-прокси для Fish Audio TTS: браузер не может ходить в api.fish.audio напрямую (нет CORS),
# поэтому запрос идёт сюда. Ключ живёт на сервере — в игру его вписывать не нужно.
# Запуск:  pip install fastapi uvicorn httpx  &&  FISH_KEY=... uvicorn fish_proxy:app --host 0.0.0.0 --port 8080
# В игре:  Меню → Озвучка диалогов → Адрес прокси = https://твой-домен/fish   (без /v1/tts на конце)
import os
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

KEY = os.environ.get("FISH_KEY", "")
MODEL = os.environ.get("FISH_MODEL", "s2.1-pro-free")
UPSTREAM = "https://api.fish.audio/v1/tts"
MAX_CHARS = 1200

app = FastAPI()
# Разрешаем запрос из игры: она открывается как file:// (origin "null"), с claude.ai или из WebView APK.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # при желании сузить до своих доменов
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,
)


@app.post("/fish/v1/tts")
@app.post("/v1/tts")
async def tts(req: Request):
    body = await req.json()
    text = (body.get("text") or "").strip()
    if not text:
        return Response(status_code=400, content=b"empty text")
    body["text"] = text[:MAX_CHARS]
    # Ключ игрока (если он вписал его в игре) имеет приоритет, иначе серверный
    auth = req.headers.get("authorization") or (f"Bearer {KEY}" if KEY else None)
    if not auth:
        return Response(status_code=401, content=b"no api key configured")
    headers = {"Authorization": auth, "model": req.headers.get("model", MODEL), "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=60) as cl:
        r = await cl.post(UPSTREAM, json=body, headers=headers)
    if r.status_code != 200:
        return Response(status_code=r.status_code, content=r.content[:500])
    return Response(content=r.content, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/fish/health")
async def health():
    return {"ok": True, "key": bool(KEY), "model": MODEL}
