from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .logging import configure_logging, log
from .routers import session, ivr, whatsapp, admin, voice
from .settings import settings
import os

configure_logging()
app = FastAPI(title="Livelihood Setu Voice", version="0.1.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(session.router)
app.include_router(ivr.router)
app.include_router(whatsapp.router)
app.include_router(admin.router)
app.include_router(voice.router)

TTS_DIR = "/tmp/setu-tts"
os.makedirs(TTS_DIR, exist_ok=True)
app.mount("/tts", StaticFiles(directory=TTS_DIR), name="tts")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/ui", StaticFiles(directory=STATIC_DIR, html=True), name="ui")


@app.get("/health")
async def health():
    return {"ok": True, "env": settings.app_env}


@app.on_event("startup")
async def on_start():
    log.info("voice.start", provider_ivr=settings.ivr_provider,
             provider_wa=settings.whatsapp_provider,
             extractor=settings.extractor_provider)
