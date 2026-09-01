"""Sarvam Bulbul TTS. Returns audio URL (short-lived)."""
from __future__ import annotations
import httpx, base64, hashlib, os
from ..settings import settings
from ..logging import log


CACHE_DIR = "/tmp/setu-tts"
os.makedirs(CACHE_DIR, exist_ok=True)


SARVAM_TTS_LIMIT = 450  # bulbul:v3 rejects inputs longer than ~500 chars


def _shorten(text: str, limit: int = SARVAM_TTS_LIMIT) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit]
    # snap to the last sentence boundary we can find
    for sep in ("। ", ". ", "? ", "! "):
        i = cut.rfind(sep)
        if i > limit * 0.5:
            return cut[: i + 1]
    return cut


async def synthesise(text: str, language: str) -> str:
    """Return a path (or URL) to a WAV. Never raises — on any provider error
    we return a silent placeholder so the caller can still ship a JSON reply."""
    text = (text or "").strip()
    if not text:
        text = "..."
    text = _shorten(text)

    key = hashlib.sha256(f"{language}:{text}".encode()).hexdigest()[:16]
    path = f"{CACHE_DIR}/{key}.wav"
    if os.path.exists(path):
        return f"file://{path}"

    def _silent_placeholder() -> str:
        with open(path, "wb") as f:
            f.write(b"RIFF\x00\x00\x00\x00WAVEfmt ")
        return f"file://{path}"

    if not settings.sarvam_api_key:
        log.info("tts.mock", text=text[:80])
        return _silent_placeholder()

    url = "https://api.sarvam.ai/text-to-speech"
    headers = {"api-subscription-key": settings.sarvam_api_key}
    body = {"inputs": [text], "target_language_code": _lang(language),
            "model": settings.sarvam_tts_model}
    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(url, headers=headers, json=body)
            r.raise_for_status()
            audio_b64 = r.json()["audios"][0]
        with open(path, "wb") as f:
            f.write(base64.b64decode(audio_b64))
        return f"file://{path}"
    except Exception as e:
        log.warning("tts.failed_returning_silent", err=str(e)[:200])
        return _silent_placeholder()


_LANG = {"hi": "hi-IN", "bn": "bn-IN", "ta": "ta-IN", "mr": "mr-IN",
         "te": "te-IN", "gu": "gu-IN", "kn": "kn-IN", "ml": "ml-IN",
         "pa": "pa-IN", "or": "od-IN", "en": "en-IN"}


def _lang(code: str) -> str:
    return _LANG.get(code, "hi-IN")
