# Speech stack decision

Date: 2026-11-17
Branch: `feature/server-side-indic-speech`
Tracking: https://github.com/worklyindia/worklyindia_01/issues/174

## Decision (selected by project owner: use engineering judgment)

Use a language-routed speech stack, not four interchangeable TTS models:

| Pipeline | Selected model | Role | Coverage / reason |
|---|---|---|---|
| STT primary | AI4Bharat IndicConformer INT8 (verified export only) | Speech → text | Primary Indian-language recognizer; select exact language-specific export after validation. |
| STT secondary | Shruti (`udgamlabs/Shruti`) | Speech → text | Hindi / English / Hinglish fallback candidate only. Not TTS. |
| TTS primary | Mithi v2 Flash (`Oomni/mithi-v2-flash`) | Text → speech | 11 languages including Hindi and Gujarati; ~199 MB BF16; Apache-2.0. First candidate for low-footprint Indic TTS. |
| TTS secondary | Kokoro-82M (`hexgrad/Kokoro-82M`) | Text → speech | English-only/English-first fallback; do not route Gujarati/Hindi to it. Apache-2.0. |

## Explicitly not selected for the first implementation

- The surfaced Indic Tiny TTS candidate is Tamil-specific; exclude from the default multilingual stack. Reconsider only if Tamil-specific benchmarking shows a clear advantage.
- Maya 2 Native supports 12 languages including Gujarati and Hindi and provides streaming, but its published BF16 checkpoint is about 5 GB. Keep as a future quality/streaming candidate, not the first free-hosting target.
- Do not add snorTTS-Indic (3B) or other multi-billion-parameter TTS models to the first zero-cost prototype; runtime requirements are too high to assume free availability.

## Routing rules

1. Detect language from audio/text; never infer Gujarati/Hindi from device locale alone.
2. Route supported Indian languages to IndicConformer; use Shruti only for Hindi/English/Hinglish fallback after confidence/error checks.
3. Route Hindi, Gujarati, Bengali, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu and English to Mithi v2 Flash, subject to language-specific voice tests.
4. Route English-only requests to Kokoro when its output quality is preferred or Mithi is unavailable.
5. Never silently route unsupported languages to an unrelated voice. Return a clear unsupported-language response or existing safe fallback.
6. Keep existing production `unified-voice` behavior untouched until a new server endpoint passes tests.

## Free-hosting gate (must pass before production)

- First prove whether a free runtime can keep Mithi weights loaded with acceptable RAM, cold start and latency. Do not assume a free GPU or always-on instance exists.
- Run CPU quantization/ONNX investigation only if upstream implementation and license permit it; compare speech quality against BF16 reference.
- Benchmark STT language-by-language with noisy and clean Hindi/Gujarati/English samples; report WER/CER and latency.
- Benchmark TTS per language/voice with pronunciation, naturalness, real-time factor, cold start, RAM/VRAM and concurrent requests.
- No paid GPU, paid Cloudflare plan, credits, or paid host. If a model cannot run reliably for ₹0/month, mark it unavailable for production rather than adding billing.
- Cloudflare Worker is only a thin auth/routing gateway; Supabase Edge Function remains orchestration/auth only. Model inference belongs in a separately proven runtime.
- Preserve local/legacy fallback until server-side parity and rollback are tested.

## Current implementation state

This document records the selected architecture only. No production code, model downloads, Workers, secrets, Supabase functions, or live routing have been changed. No model has yet passed a runtime benchmark. No paid resources were created.

## Model references

- Mithi v2 Flash: https://huggingface.co/Oomni/mithi-v2-flash
- Kokoro-82M: https://huggingface.co/hexgrad/Kokoro-82M
- IndicConformer export: https://huggingface.co/parismitaglobalsolutions/indicconformer-sherpa-onnx
- Shruti: https://github.com/udgamlabs/shruti
- Maya 2 Native (future candidate): https://huggingface.co/maya-research/maya2-native
