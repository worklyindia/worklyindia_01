import io
import os
import threading
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
import soundfile as sf
import numpy as np
import torch
from run import Mithi

API_KEY = os.environ.get("MITHI_API_KEY", "")
if not API_KEY:
    raise RuntimeError("Set MITHI_API_KEY before starting the server")

app = FastAPI(title="Workly Mithi v2 Flash TTS", version="1.0.0")
engine = None
engine_lock = threading.Lock()
LANGUAGES = {"hi", "en", "gu"}
VOICES = {"satvik", "anirban", "nakul", "vasant", "siddhant",
          "charvi", "ahana", "vaidehi", "malini", "jahnavi"}

class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: str = Field(pattern="^(hi|en|gu)$")
    voice: str = Field(default="vaidehi", pattern="^(satvik|anirban|nakul|vasant|siddhant|charvi|ahana|vaidehi|malini|jahnavi)$")

@app.on_event("startup")
def load_model():
    global engine
    torch.set_num_threads(int(os.environ.get("MITHI_CPU_THREADS", "4")))
    engine = Mithi(device=os.environ.get("MITHI_DEVICE", "cpu"))

@app.get("/health")
def health():
    return {"status": "ok", "model": "Oomni/mithi-v2-flash", "languages": sorted(LANGUAGES)}

@app.post("/v1/audio/speech")
def speech(body: SpeechRequest, authorization: str | None = Header(default=None)):
    if authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if engine is None:
        raise HTTPException(status_code=503, detail="Mithi model is loading")
    try:
        with engine_lock:
            audio = engine.synthesize(body.text, lang=body.language, voice=body.voice)
        buffer = io.BytesIO()
        sf.write(buffer, np.asarray(audio, dtype=np.float32), 24000, format="WAV", subtype="PCM_16")
        return Response(buffer.getvalue(), media_type="audio/wav", headers={"Cache-Control": "no-store"})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(exc)[:300]}")
