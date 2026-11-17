# Workly India AI Voice — zero-cost-first deployment plan

## Current implementation status

- The AI Chat composer has a dedicated phone-call icon that opens `/ai-voice-call`.
- The voice-call page is a UI shell with a microphone permission check.
- Live calling remains disabled until an open-source inference service is deployed and configured.
- The existing `unified-voice` function remains untouched during this isolated speech-model project.

## Selected open-source speech stack

- **STT primary:** AI4Bharat IndicConformer INT8 (use only a verified export; language-by-language validation is required).
- **STT fallback:** Shruti by Udgam Labs for Hindi, English and Hinglish only. Shruti is speech-to-text, not TTS.
- **Indic TTS primary:** Mithi v2 Flash; validate pronunciation separately for every claimed language.
- **English TTS fallback:** Kokoro-82M. Do not route Gujarati or Hindi to Kokoro.
- The previously considered Indic Tiny TTS surfaced candidate is Tamil-specific and is not the default multilingual model.

See [STACK_DECISION.md](../server-side-speech/STACK_DECISION.md), [API_CONTRACT.md](../server-side-speech/API_CONTRACT.md) and [BENCHMARK_PLAN.md](../server-side-speech/BENCHMARK_PLAN.md).

## Hosting and cost constraints

- Approved budget: **₹0/month only**. No paid GPU, paid Cloudflare plan, prepaid credits, trial with auto-billing or paid host.
- Cloudflare Workers Free can serve as a lightweight authenticated gateway, not as a place to load arbitrary PyTorch/ONNX speech model weights.
- Workers AI free allocation applies to Cloudflare's supported model catalogue; it does not make arbitrary Hugging Face model uploads free.
- Supabase Edge Functions remain suitable for authentication/orchestration, not persistent model inference.
- R2 can store artifacts within its allowance, but object storage does not execute models.
- No reliable always-on free GPU host has been verified. A free tier that sleeps, throttles or has a small quota is not a production guarantee.

A public 24/7 service with unlimited callers cannot be guaranteed at zero cost. If a free runtime cannot pass the measured capacity and latency gates, the affected model stays unavailable for production.

## Required backend contract before enabling the call button

The separate inference service must:
1. Authenticate requests using short-lived, audience-restricted signed tokens; never expose service credentials in browser code.
2. Accept audio for STT and return language-tagged transcripts.
3. Accept text for TTS and return audio bytes.
4. Enforce request-size, duration, text-length, concurrency and timeout limits.
5. Return explicit errors for unavailable model, overload, timeout and quota exhaustion.
6. Never fall back to a paid provider or silently use the wrong language/model.
7. Support cancellation and disconnect cleanup.
8. Keep audio and transcript data transient and out of logs, databases, object storage and analytics.

## Privacy-first, no-retention requirement

The production voice service must process speech in memory and must not persist raw microphone audio, generated audio, partial/final transcripts, prompts, responses, recordings or replay buffers. Disable payload logging at the app, gateway, proxy, host and observability layers. Log only request ID, model ID, status, latency and coarse byte counts. Clear in-memory buffers after processing, cancellation or disconnect. Verify provider and host retention settings before launch.

## Rollout sequence

1. Prove the models can load on an approved ₹0/month runtime.
2. Run the language-specific benchmark matrix and publish measured RAM, latency, RTF and accuracy.
3. Implement the isolated inference API contract and security/privacy tests.
4. Add the Cloudflare gateway only after the inference origin exists and is proven.
5. Connect a small test client while preserving current behavior.
6. Switch production clients only after Hindi, Gujarati and English parity, rollback and no-retention checks pass.
