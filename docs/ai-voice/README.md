# Workly India AI Voice — zero-cost-first deployment plan

## Current implementation status

- The AI Chat composer has a dedicated phone-call icon that opens `/ai-voice-call`.
- The voice-call page is a UI shell with a microphone permission check.
- Live calling remains disabled until an open-source inference service is deployed and configured.
- Existing `unified-voice` function remains untouched during this isolated speech-model project.

## Confirmed four-model roles

- **Primary STT:** AI4Bharat IndicConformer INT8.
- **Backup STT:** `udgamlabs/Shruti` (Hindi/English/Hinglish only after benchmark); this is speech recognition, not TTS.
- **Indic TTS:** Indic Tiny TTS Hindi and Gujarati language-specific candidates; verify each checkpoint and full model/code/vocoder license chain.
- **English TTS:** Kokoro-82M; English-focused, do not route Gujarati/Hindi to it.

See [STACK_DECISION.md](../server-side-speech/STACK_DECISION.md), [FEASIBILITY.md](../server-side-speech/FEASIBILITY.md), [API_CONTRACT.md](../server-side-speech/API_CONTRACT.md) and [BENCHMARK_PLAN.md](../server-side-speech/BENCHMARK_PLAN.md).

## Hosting and cost constraints

- Approved budget: **₹0/month only**. No paid GPU, paid Cloudflare plan, prepaid credits, auto-billing trial or paid host.
- Cloudflare Workers are the authenticated public API gateway, not arbitrary model inference hosts.
- Check exact model IDs against Workers AI catalogue; only exact supported models may route there. Unsupported custom models run on external inference server.
- AI Gateway provides request routing/observability controls, not arbitrary model hosting.
- R2 stores approved artifacts/audio, not inference.
- Queues are optional for back-pressure; do not persist private audio without a reviewed retention design.
- Supabase Edge Functions are for auth/orchestration, not persistent model inference.
- No reliable always-on free GPU host has been verified. If free runtime cannot pass capacity and latency gates, do not enable production routing.

## Required API before enabling clients

Expose `POST /api/speech/transcribe`, `POST /api/speech/synthesize`, and `GET /api/speech/health`. Use short-lived audience-restricted tokens; never expose service credentials in browser or APK. Enforce payload, duration, text, concurrency and timeout limits. Return explicit errors for unavailable models, overload and quota exhaustion. Do not silently fall back to paid services or unsupported models.

## Android safety and privacy

Do not remove model weights/local inference dependencies until server endpoint is deployed, authenticated and tested end-to-end. Then remove only approved model assets and unnecessary dependencies. Preserve unrelated audio features and charging notification sounds. Keep UI text English-only. Measure actual APK before/after.

Process speech in memory; do not persist raw audio, generated audio, transcripts, prompts, responses or replay buffers by default. Disable payload logging across app, gateway, proxy, host and observability. Clear buffers after processing/cancellation/disconnect.

## Rollout sequence

1. Verify exact repositories, pinned revisions, task types, language support and complete license chain.
2. Benchmark IndicConformer primary STT and Shruti backup STT separately.
3. Benchmark Indic Tiny TTS Hindi/Gujarati and Kokoro English.
4. Prove all selected models load and serve on approved ₹0/month runtime.
5. Implement and security-test isolated inference API.
6. Add Cloudflare gateway, AI Gateway controls, and optional R2/Queues only where needed.
7. Connect a test client while preserving current behavior.
8. Switch production clients only after language parity, Android playback, APK-size, rollback and no-retention checks pass.

No model endpoint is currently approved as production-ready; do not claim deployment until live inference endpoint passes tests.
