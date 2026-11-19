# Speech stack decision

Date: 2026-11-17
Branch: `feature/server-side-indic-speech`
Tracking: https://github.com/worklyindia/worklyindia_01/issues/174

## Confirmed four-model roles

1. **AI4Bharat IndicConformer INT8 — primary STT.**
2. **Shruti — backup STT.** The known `udgamlabs/Shruti` is Hindi/English/Hinglish speech recognition, not TTS.
3. **Indic Tiny TTS — Indic TTS.** Benchmark separate Hindi and Gujarati checkpoints.
4. **Kokoro-82M — English TTS.** Do not route Hindi/Gujarati to Kokoro without validated support.

## Candidate routing (not production enabled)

| Pipeline | Candidate | Task | Gate |
|---|---|---|---|
| Primary STT | AI4Bharat IndicConformer INT8 export | Speech → text | Pin exact compatible export; verify provenance, license and Gujarati/Hindi/English accuracy. |
| Backup STT | `udgamlabs/Shruti` | Speech → text | Verify exact revision/license and test Hindi/English/Hinglish WER/CER, latency and runtime. Use only as controlled fallback. |
| Indic TTS | `sulabhkatiyar/indic-tiny-tts-hindi` and `sulabhkatiyar/indic-tiny-tts-gujarati` | Text → speech | Treat as separate language checkpoints; verify full model/code/vocoder license chain, quality and runtime. |
| English TTS | `hexgrad/Kokoro-82M` | Text → speech | English-focused; verify voice/output quality and runtime. |

## Routing rules

1. Route Gujarati/Hindi/English STT to IndicConformer only for language pairs that pass the benchmark.
2. Use Shruti as backup STT only for the tested Hindi/English/Hinglish cases when primary STT is unavailable or fails its defined confidence/health gate. Never route Gujarati to Shruti unless separately validated.
3. Route Hindi and Gujarati TTS to their corresponding Indic Tiny TTS checkpoints only after language-specific benchmark pass.
4. Route English TTS to Kokoro after quality and latency validation.
5. Do not use IndicConformer or Shruti for TTS.
6. Keep existing production speech paths unchanged until new endpoints pass end-to-end tests.

## Hosting and release gates

- Cloudflare Worker is a thin authenticated gateway; AI Gateway can observe/route supported requests. Neither hosts arbitrary PyTorch/ONNX weights.
- Check exact model IDs against Cloudflare Workers AI catalogue; custom/unsupported models run on an external inference server.
- R2 stores approved artifacts/audio, not inference. Use Queues only if concurrency/back-pressure requires them and privacy/retention is controlled.
- ₹0/month is a hard constraint. No paid GPU, paid Cloudflare plan, credits or paid host. If no reliable free runtime passes, keep server-side feature disabled.
- Preserve local/legacy fallback and charging notification audio until server functionality and rollback are proven.
- Remove bundled weights/local inference dependencies only after production endpoints are verified and APK before/after sizes are measured.

## Current state

Architecture/documentation only. No model endpoint has passed production validation. No production code, Worker, Queue, R2 object, DNS route, secret, Supabase function, Android model asset or billing setting has been changed.
