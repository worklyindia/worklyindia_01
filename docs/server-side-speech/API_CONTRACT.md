# Speech inference API contract (isolated, not production-enabled)

Date: 2026-11-17
Tracking: https://github.com/worklyindia/worklyindia_01/issues/174

## Boundary

Separate inference service behind a Cloudflare Worker gateway. This does not replace or modify the existing `unified-voice` function. Do not deploy until runtime, model identity/license, privacy and benchmark gates pass.

The inference service must not receive Supabase service-role credentials. The application backend authenticates the user and forwards a short-lived, audience-bound service token.

## Endpoints

### `GET /api/speech/health`

Returns actual readiness per model. A model is `ready` only after weights load and a local smoke test succeeds; otherwise `unavailable`.

### `POST /api/speech/transcribe`

Accepts documented audio MIME type/format and:
- `Authorization: Bearer <short-lived-service-token>`
- `X-Audio-Language: auto|hi|gu|en|...` (hint only)
- `X-Request-ID: <random-id>`

Returns language-tagged recognized text, selected model, confidence where supported and processing duration. IndicConformer is primary STT. Shruti is backup STT only for separately validated Hindi/English/Hinglish cases. Never use either as TTS.

### `POST /api/speech/synthesize`

Accepts text, language, requested model/voice and audio format; returns audio bytes with accurate `Content-Type`, model and duration headers.

Indic Tiny TTS Hindi/Gujarati checkpoints are language-specific candidates; Kokoro is English-focused. Do not route unsupported languages.

## Required controls

- Require short-lived signed audience-restricted tokens.
- Enforce maximum audio bytes/duration, text length, per-user concurrency and request timeout.
- Validate model selection against server-side allowlist; never accept arbitrary repo IDs from clients.
- Allow only documented audio MIME types/formats.
- Stable errors: `UNAUTHORIZED` (401), `INVALID_AUDIO` (400), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `MODEL_UNAVAILABLE` (503), `INFERENCE_TIMEOUT` (504).
- Add idempotency for retries; cache TTS only with privacy-safe keys and explicit retention policy.
- Never log request bodies, audio, transcripts, TTS text, generated audio, auth tokens or user identifiers.
- Do not persist private audio/transcripts by default; clear buffers after completion, cancellation or disconnect.
- Keep model files outside Git and browser/mobile bundles.
- Protect origin so public traffic reaches it only through authenticated Cloudflare gateway.

## Acceptance tests

1. Missing/expired/wrong-audience tokens rejected.
2. Oversized/malformed audio rejected before inference.
3. Gujarati, Hindi and English STT evaluated against labelled samples; measure WER/CER for primary IndicConformer.
4. Shruti fallback tested separately for Hindi/English/Hinglish; verify fallback routing and ensure no Gujarati fallback unless validated.
5. Hindi, Gujarati and English TTS tested separately for pronunciation and naturalness.
6. Record cold/warm latency, RTF, peak RAM/VRAM and concurrent capacity.
7. Test unavailable model, quota exhaustion, overload, timeout, retry, duplicate request and cancellation.
8. Confirm no speech payload in logs or persisted storage by default.
9. Confirm existing `unified-voice`, charging notification sounds and unrelated audio features remain unchanged.
10. Verify Android playback, slow network, interruption, loading/error UI and APK size before/after.
11. Rollback by disabling new route; legacy/local behavior remains available until parity is proven.

## Explicitly out of scope until all gates pass

No production DNS route, Worker, Queue, R2 object, secret, Supabase function, model deployment, billing change, client switch or model-weight removal. No promise of unlimited/always-on free compute.
