# Speech inference API contract (isolated, not production-enabled)

Date: 2026-11-17
Tracking: https://github.com/worklyindia/worklyindia_01/issues/174

## Boundary

This contract defines a separate inference service behind a Cloudflare Worker gateway. It does not replace or modify the existing `unified-voice` function. Do not deploy until the runtime, model identity/license checks, privacy controls and benchmark gates pass.

The service must not receive Supabase service-role credentials. The application backend authenticates the user and forwards a short-lived, audience-bound service token. The inference service validates that token before accepting work.

## Endpoints

### `GET /api/speech/health`

Returns operational status and each model's actual readiness. A model is `ready` only after its weights are loaded and a local smoke test succeeds. Otherwise return `unavailable`. Never mark a model ready because its files merely exist.

### `POST /api/speech/transcribe`

Accepts a documented audio MIME type and format, with:
- `Authorization: Bearer <short-lived-service-token>`
- `X-Audio-Language: auto|hi|gu|en|...` (hint only)
- `X-Request-ID: <random-id>`

Returns language-tagged recognized text, selected STT model, confidence where supported, and processing duration. IndicConformer is STT primary. The known Shruti model may be a separately tested Hindi/English/Hinglish STT fallback only; never TTS.

### `POST /api/speech/synthesize`

Accepts JSON containing text, language, requested model/voice and audio format. Returns audio bytes with accurate `Content-Type`, model and duration headers.

Indic Tiny TTS Hindi/Gujarati checkpoints are language-specific candidates; Kokoro is English-focused. The requested "Shruti TTS" is blocked until an exact TTS repository/model and license are verified. Never silently substitute a model with a different task or unsupported language.

## Required controls

- Require short-lived, signed, audience-restricted tokens; reject missing, expired, wrong-audience and malformed tokens.
- Enforce maximum audio bytes, duration, text length, per-user concurrency and request timeout before inference.
- Validate model selection against a server-side allowlist; never accept arbitrary repository IDs from clients.
- Allow only documented audio MIME types and formats; reject malformed media with HTTP 400.
- Return stable errors: `UNAUTHORIZED` (401), `INVALID_AUDIO` (400), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `MODEL_UNAVAILABLE` (503), `INFERENCE_TIMEOUT` (504).
- Add idempotency/request deduplication for retries; cache TTS only with a privacy-safe key and explicit retention policy.
- Never log request bodies, audio, transcripts, TTS text, generated audio, auth tokens or user identifiers.
- Do not persist private audio/transcripts by default. Clear temporary buffers after completion, cancellation or disconnect.
- Model files must remain outside Git and outside browser/mobile bundles.
- Protect the inference origin so public traffic reaches it only through the authenticated Cloudflare gateway.

## Acceptance tests before connecting clients

1. No-token, expired-token and wrong-audience requests are rejected.
2. Oversized and malformed audio are rejected before model execution.
3. Gujarati, Hindi and English STT produce language-tagged output; measure WER/CER against labelled samples.
4. Hindi, Gujarati and English TTS are tested separately for pronunciation and naturalness.
5. Report cold start, warm latency, real-time factor, peak RAM/VRAM and concurrent request capacity for every deployable model.
6. Model absence, quota exhaustion, overload, timeout, retry, duplicate request and cancellation return stable outcomes.
7. Confirm no payload appears in application, platform, proxy or observability logs and no speech payload is persisted without explicit approval.
8. Confirm existing `unified-voice`, charging notification sounds and unrelated audio features remain unchanged during the trial.
9. Verify Android playback, slow network, interruption, loading/error UI, and APK size before/after.
10. Rollback consists of disabling the new route; legacy/local behavior remains available until parity is proven.

## Explicitly out of scope until all gates pass

- No production DNS route, Cloudflare Worker, Queue, R2 object, secret, Supabase function, model deployment or billing change.
- No client is switched away from local/browser speech.
- No model weights are removed from Android before endpoint verification.
- No promise of unlimited or always-on free compute.
