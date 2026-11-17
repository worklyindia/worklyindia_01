# Speech stack decision

Date: 2026-11-17
Branch: `feature/server-side-indic-speech`
Tracking: https://github.com/worklyindia/worklyindia_01/issues/174

## Owner-requested scope

1. AI4Bharat IndicConformer INT8 — STT only.
2. Indic Tiny TTS — TTS; benchmark separate Hindi and Gujarati repositories/checkpoints.
3. Kokoro-82M — TTS; English-focused route.
4. "Shruti TTS" — identity unresolved. The known `udgamlabs/Shruti` is STT, not TTS. Do not mislabel or deploy it as TTS.

## Verified candidate routing (not production enabled)

| Pipeline | Candidate | Task | Gate |
|---|---|---|---|
| STT primary | AI4Bharat IndicConformer INT8 export | Speech → text | Pin exact compatible export; verify license/provenance and Gujarati/Hindi/English accuracy. |
| TTS Indic | `sulabhkatiyar/indic-tiny-tts-hindi` and `sulabhkatiyar/indic-tiny-tts-gujarati` | Text → speech | Treat as separate language checkpoints; verify full license chain, quality and CPU/GPU runtime. |
| TTS English | `hexgrad/Kokoro-82M` | Text → speech | English-focused only; verify voice/output quality. |
| "Shruti TTS" | No verified repository found | Unknown | Block deployment until exact repository URL/model ID and license are verified. |
| Optional STT fallback | `udgamlabs/Shruti` | Speech → text | Hindi/English/Hinglish only, after WER/CER and runtime validation. |

## Routing rules

1. Detect or validate the requested language; do not infer it solely from device locale.
2. Route supported Indic STT requests to IndicConformer; use known Shruti ASR only as a separately tested Hindi/English/Hinglish fallback.
3. Route Hindi and Gujarati TTS to their corresponding Indic Tiny TTS checkpoints only after language-specific benchmark pass.
4. Route English TTS to Kokoro after quality and latency validation.
5. Do not route Gujarati/Hindi to Kokoro or route Shruti ASR as TTS.
6. Do not advertise "Shruti TTS" until the exact model identity and license are confirmed.
7. Keep existing production speech paths unchanged until the new endpoints pass end-to-end tests.

## Hosting and release gates

- Cloudflare Worker is a thin authenticated gateway; AI Gateway can observe/route supported requests. Neither should be treated as arbitrary custom model hosting.
- Check Cloudflare Workers AI catalogue for exact supported model IDs; custom/unsupported models must run on the external inference server.
- R2 stores approved artifacts only; it does not run inference. Use Queues only when concurrency/back-pressure requires them and privacy/retention is controlled.
- No paid GPU, paid Cloudflare plan, credits or paid host. ₹0/month is a hard constraint. If no reliable free runtime passes, keep server-side feature disabled rather than adding billing.
- Preserve local/legacy fallback and charging notification audio until server functionality and rollback are proven.
- Remove bundled weights/local inference dependencies only after the production server is verified and APK before/after sizes are measured.

## Current state

This is an architecture decision only. No model endpoint has passed production validation. No production code, Worker, Queue, R2 object, DNS route, secret, Supabase function, Android model asset or billing setting has been changed.
