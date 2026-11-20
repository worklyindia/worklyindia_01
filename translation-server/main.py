import os
import re
import threading
from contextlib import asynccontextmanager
from typing import Optional

import torch
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

MODEL_ID = os.getenv("TRANSLATION_MODEL_ID", "google/madlad400-3b-mt")
API_TOKEN = os.getenv("TRANSLATION_SERVICE_TOKEN", "")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MAX_INPUT_CHARS = int(os.getenv("MAX_INPUT_CHARS", "4000"))
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "512"))

# ISO language tags accepted by the current Workly translation UI.
SUPPORTED_LANGUAGES = {
    "en", "hi", "gu", "bn", "mr", "te", "ta", "kn", "ml", "pa", "or",
    "as", "ur", "ne", "sd", "sa", "es", "fr", "de", "zh", "ar", "pt",
    "ru", "ja", "ko", "it", "nl", "pl", "tr", "uk", "th", "id", "vi",
    "fa", "he", "el", "sv", "cs", "ro", "hu", "fi", "da", "sk", "bg",
    "ms", "tl", "sw", "si", "my",
}

tokenizer = None
model = None
model_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer, model
    # Load once at process startup. GPU is strongly recommended for production.
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    dtype = torch.float16 if DEVICE == "cuda" else torch.float32
    model = AutoModelForSeq2SeqLM.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        low_cpu_mem_usage=True,
    )
    model.to(DEVICE)
    model.eval()
    yield
    del model
    del tokenizer


app = FastAPI(
    title="Workly Self-Hosted Translation API",
    version="1.0.0",
    lifespan=lifespan,
)


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_INPUT_CHARS)
    targetLang: str = Field(min_length=2, max_length=3)
    sourceLang: Optional[str] = "auto"


def require_token(authorization: Optional[str]) -> None:
    if not API_TOKEN:
        raise HTTPException(status_code=503, detail="Translation service token is not configured")
    if authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": DEVICE,
        "ready": model is not None,
    }


@app.post("/translate")
def translate(payload: TranslateRequest, authorization: Optional[str] = Header(default=None)):
    require_token(authorization)
    text = payload.text.strip()
    target = payload.targetLang.lower().split("-")[0].split("_")[0]

    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    if not re.fullmatch(r"[a-z]{2,3}", target):
        raise HTTPException(status_code=400, detail="Invalid target language code")
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Translation model is not ready")

    # MADLAD-400 uses a target-language prefix such as <2gu> or <2en>.
    target_token = f"<2{target}>"
    token_id = tokenizer.convert_tokens_to_ids(target_token)
    if token_id == tokenizer.unk_token_id:
        raise HTTPException(status_code=400, detail="The selected target language is not supported by this model")
    prompt = f"{target_token} {text}"
    with model_lock, torch.inference_mode():
        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        ).to(DEVICE)
        output = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            num_beams=1,
            do_sample=False,
        )
        translated = tokenizer.decode(output[0], skip_special_tokens=True).strip()

    if not translated:
        raise HTTPException(status_code=502, detail="The model returned an empty translation")

    source = payload.sourceLang or "auto"
    return {
        "translatedText": translated,
        "detectedLanguage": source if source != "auto" else "auto",
        "provider": "workly-self-hosted",
        "model": MODEL_ID,
    }
