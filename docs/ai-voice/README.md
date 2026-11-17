# Workly India AI Voice — zero-cost-first deployment plan

## Current implementation status

- The AI Chat composer has a dedicated phone-call icon that opens `/ai-voice-call`.
- The voice-call page is a UI shell with a microphone permission check.
- Live calling remains disabled until an open-source inference service is deployed and configured.
- The existing `unified-voice` function remains untouched during this isolated speech-model project.

## Owner-requested speech model scope

- **STT:** AI4Bharat IndicConformer INT8; speech recognition only.
- **Indic TTS:** Indic Tiny TTS Hindi and Gujarati language-specific candidates; verify each checkpoint and full model/code/vocoder license chain.
- **English TTS:** Kokoro-82M; English-focused, do not route Gujarati/Hindi to it.
- **Requested "Shruti TTS":** exact repository/model not verified. The known `udgamlabs/Shruti` is STT for Hindi/English/Hinglish, not TTS. Do not mislabel it; keep it only as an optional STT fallback after testing.

See [STACK_DECISION.md](../server-side-speech/STACK_DECISION.md), [FEASIBILITY.md](../server-side-speech/FEASIBILITY.md), [API_CONTRACT.md](../server-side-speech/API_CONTRACT.md) and [BENCHMARK_PLAN.md](../server-side-speech/BENCHMARK_PLAN.md).

## Hosting and cost constraints

- Approved budget: **₹0/month only**. No paid GPU, paid Cloudflare plan, prepaid credits, trial with auto-billing or paid host.
- Cloudflare Workers are the authenticated public API gateway, not a runtime for arbitrary PyTorch/ONNX model weights.
- Check the exact model against Cloudflare Workers AI's supported catalogue; only exact supported models may be routed there. Unsupported custom models run on the external inference server.
- AI Gateway provides supported request routing/observability controls; it does not host arbitrary model weights.
- R2 stores approved artifacts/audio within limits but does not execute inference.
- Queues are optional for back-pressure/concurrency and must not persist private audio without a reviewed retention design.
- Supabase Edge Functions remain suitable for authentication/orchestration, not persistent model inference.
- No reliable always-on free GPU host has been verified. A free tier that sleeps, throttles or has a small quota is not a production guarantee.

A public 24/7 service with unlimited callers cannot be guaranteed at zero cost. If a free runtime cannot pass measured capacity and latency gates, do not enable production routing.

## Required backend contract before enabling the call button

The separate inference service must:
1. Expose `POST /api/speech/transcribe`, `POST /api/speech/synthesize`, and `GET /api/speech/health`.
2. Authenticate requests using short-lived, audience-restricted signed tokens; never expose service credentials in browser or APK code.
3. Accept audio for STT and return language-tagged transcripts.
4. Accept text for TTS and return audio bytes.
5. Enforce request-size, duration, text-length, concurrency and timeout limits.
6. Return explicit errors for unavailable model, overload, timeout and quota exhaustion.
7. Never fall back to a paid provider or silently use the wrong language/model.
8. Support cancellation, idempotent retries and disconnect cleanup.
9. Keep audio and transcript data transient and out of logs, databases, object storage and analytics by default.

## Android safety

Do not remove bundled model files or local inference dependencies until the corresponding server endpoint is deployed, authenticated and tested end-to-end. Then remove only the four approved models' weights/download code and unrelated inference dependencies proven unnecessary. Preserve all unrelated audio features and existing charging notification sounds. Keep loading/error/retry/playback behavior in English. Measure the actual APK before and after.

## Privacy-first, no-retention requirement

Process speech in memory and do not persist raw microphone audio, generated audio, partial/final transcripts, prompts, responses, recordings or replay buffers by default. Disable payload logging at app, gateway, proxy, host and observability layers. Log only request ID, model ID, status, latency and coarse byte counts. Clear in-memory buffers after processing, cancellation or disconnect. Verify provider and host retention settings before launch.

## Rollout sequence

1. Verify exact repositories, pinned revisions, task type, language support and complete license chain.
2. Resolve the exact "Shruti TTS" identity; the known Shruti repository is STT.
3. Prove all deployable models load on an approved ₹0/month runtime.
4. Run language-specific accuracy/pronunciation, latency, memory, concurrency and recovery benchmarks.
5. Implement the isolated inference API contract and security/privacy tests.
6. Add Cloudflare gateway, AI Gateway controls, and optional R2/Queues only where required.
7. Connect a test client while preserving current behavior.
8. Switch production clients only after Hindi, Gujarati and English parity, Android playback, APK-size, rollback and no-retention checks pass.

No model endpoint is currently approved as production-ready; do not claim deployment until its live inference endpoint has passed tests.
