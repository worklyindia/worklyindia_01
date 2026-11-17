# Speech inference API contract (isolated, not production-enabled)

Date: 2026-11-17
Tracking: https://github.com/worklyindia/worklyindia_01/issues/174

## Boundary

This contract defines a separate inference service. It does not replace or modify the existing `unified-voice` function. The service is not deployable until a genuinely free runtime passes the benchmark gate in `STACK_DECISION.md`.

The service must not receive Supabase service-role credentials. The application backend authenticates the user and forwards a short-lived, audience-bound service token. The inference service validates that token before accepting work.

## Endpoints

### `GET /healthz`

Returns only operational status; no model prompt/audio data.

```json
{ "status": "ok", "models": { "indicconformer": "ready", "shruti": "ready", "mithi": "ready", "kokoro": "ready" } }
```

A model is `ready` only after its weights are loaded and a local smoke test succeeds. Otherwise return `unavailable`; do not report a model ready merely because its files exist.

### `POST /v1/stt`

Request: `Content-Type: audio/*` (raw audio body), plus headers:
- `Authorization: Bearer <short-lived-service-token>`
- `X-Audio-Language: auto|hi|gu|en|...` (hint only; never the sole language detector)
- `X-Request-ID: <random-id>`

Response:
```json
{
  "text": "recognized words",
  "language": "gu-IN",
  "model": "indicconformer",
  "confidence": 0.0,
  "duration_ms": 0
}
```

Route Indian languages to IndicConformer. Shruti is only a Hindi/English/Hinglish fallback. Never use Shruti as TTS. Return `503 MODEL_UNAVAILABLE` when no valid recognizer is loaded; do not silently switch to a paid provider.

### `POST /v1/tts`

Request JSON:
```json
{ "text": "નમસ્તે", "language": "gu-IN", "format": "wav" }
```

Response: audio bytes with an accurate `Content-Type`, `X-Voice-Model`, and `X-Duration-Ms` headers. Mithi v2 Flash is the primary Indic route. Kokoro is an English-only fallback. Do not send Hindi/Gujarati to Kokoro.

## Required controls

- Require a short-lived, signed, audience-restricted token; reject missing, expired, wrong-audience and malformed tokens.
- Enforce maximum audio bytes, maximum duration, text length, per-user concurrency and request timeout before inference.
- Allow only documented audio MIME types and formats; reject malformed media with HTTP 400.
- Return stable machine-readable errors: `UNAUTHORIZED` (401), `INVALID_AUDIO` (400), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `MODEL_UNAVAILABLE` (503), `INFERENCE_TIMEOUT` (504).
- Do not retry through a paid vendor or an unapproved model.
- Set `Cache-Control: no-store` for all speech responses.
- Never log request bodies, audio, transcripts, TTS text, generated audio, auth tokens or user identifiers. Operational logs may contain request ID, model ID, status, latency and coarse byte counts only.
- Do not persist audio or transcripts in files, object storage, database, queues, analytics or crash reports. Clear in-memory buffers after completion, cancellation or disconnect.
- Keep model files outside Git and outside browser/mobile bundles.

## Acceptance tests before connecting clients

1. No-token, expired-token and wrong-audience requests are rejected.
2. Oversized and malformed audio are rejected before model execution.
3. Gujarati, Hindi and English STT produce language-tagged output; measure WER/CER against labelled samples.
4. Hindi and Gujarati TTS are tested separately for pronunciation and naturalness; English Kokoro fallback is tested separately.
5. Report cold start, warm latency, real-time factor, peak RAM/VRAM and concurrent request capacity for every model.
6. Model absence, quota exhaustion, overload, timeout and cancellation return stable errors.
7. Confirm no payload appears in application, platform, proxy or observability logs and no speech payload is persisted.
8. Confirm existing `unified-voice` and its clients remain unchanged during the trial.
9. Rollback consists of disabling the new route; legacy/local behavior remains available until parity is proven.

## Explicitly out of scope

- No production DNS route, Cloudflare Worker, Supabase function, secret, model download or billing change is made by this contract.
- No client is switched away from local/browser speech.
- No promise of unlimited or always-on free compute is made.
