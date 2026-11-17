# Server-side speech models: feasibility audit

Date: 2026-11-17
Repository branch: `feature/server-side-indic-speech`
Tracking issue: https://github.com/worklyindia/worklyindia_01/issues/174

## Requested four-model scope and verified task types

The owner requests all four named model families to be server-side, with exact repositories and licenses verified before deployment.

| Requested model | Verified task / current finding | Deployment decision |
|---|---|---|
| AI4Bharat IndicConformer INT8 | STT / ASR. Public INT8 ONNX exports surfaced, including `yashwork-byte/indic-conformer-600m-int8-onnx`; the exact export, upstream provenance, runtime compatibility and license still require review. | STT candidate only. Never use as TTS. |
| Indic Tiny TTS | TTS. Search surfaced separate language repos by `sulabhkatiyar`, including Hindi (`indic-tiny-tts-hindi`) and Gujarati (`indic-tiny-tts-gujarati`), both tagged CC-BY-4.0. Other language-specific repositories also surfaced. | Include Hindi/Gujarati candidates in benchmark; verify model card, files, code/vocoder licensing and runtime before deployment. Do not assume one checkpoint is multilingual. |
| Kokoro-82M | TTS. Official `hexgrad/Kokoro-82M` is Apache-2.0 and English-focused (American/British voices in its model card). | TTS candidate; English route only unless a separately validated supported language is proven. |
| Shruti | The previously identified `udgamlabs/Shruti` is STT / ASR for Hindi, English and Hinglish, not TTS. Search for a distinct "Shruti TTS" repository did not return a verified match. | Do not deploy as TTS. Owner's intended TTS repository/name and license remain unverified. Keep known Shruti ASR only as optional STT fallback. |

## Candidate repository references

- IndicConformer quantized candidate: https://huggingface.co/yashwork-byte/indic-conformer-600m-int8-onnx
- Indic Tiny TTS Hindi: https://huggingface.co/sulabhkatiyar/indic-tiny-tts-hindi
- Indic Tiny TTS Gujarati: https://huggingface.co/sulabhkatiyar/indic-tiny-tts-gujarati
- Kokoro: https://huggingface.co/hexgrad/Kokoro-82M
- Shruti ASR project: https://github.com/udgamlabs/shruti

Repository search results are discovery only, not a license or production-readiness approval. Inspect each model card, pinned revision, weight license, inference code license, dependencies and any vocoder/tokenizer license before downloading or deploying.

## Cloudflare and inference boundary

- Cloudflare Workers are the public authenticated API gateway, not the runtime for arbitrary PyTorch/ONNX model weights.
- Check each model against the current Cloudflare Workers AI supported catalogue. Only route a model through Workers AI if that exact model is officially supported there; otherwise route through the external inference service.
- AI Gateway can provide supported request observability/routing controls, but it does not host arbitrary custom model weights.
- R2 is object storage for explicitly approved reusable artifacts/audio; it does not execute inference. Do not persist private recordings by default.
- Queues are optional for back-pressure and asynchronous workloads; do not queue raw private audio unless retention, access controls and deletion are explicitly designed.
- DNS/security protect the public gateway and origin; origin must not be directly exposed.
- Supabase Edge Functions are suitable for auth/orchestration, not persistent GPU inference.
- No reliable always-on free GPU host has been verified. The approved budget remains ₹0/month; do not create paid compute, trials that auto-bill, credits or billing changes.

## Safe implementation sequence

1. Verify exact pinned repositories, revisions, task type, model/weight/code/vocoder licenses and language coverage for all requested models.
2. Resolve the "Shruti TTS" identity. Do not substitute the known Shruti ASR model as TTS.
3. Benchmark IndicConformer INT8 for Gujarati, Hindi and English STT; benchmark Indic Tiny TTS Hindi/Gujarati separately; benchmark Kokoro English; benchmark any verified Shruti TTS candidate only after its identity is confirmed.
4. Prove a genuinely free runtime can load and serve the models. Record cold start, warm latency, peak RAM/VRAM, real-time factor and concurrency. No always-on or unlimited capacity claims without evidence.
5. Implement an isolated external inference service behind a Cloudflare Worker gateway. Keep model weights out of Workers and Supabase.
6. Add the requested API routes only after the inference runtime is healthy and smoke-tested.
7. Change Android clients only after server parity, security, retry, playback and rollback tests pass. Keep existing local/browser speech and charging notification sounds until acceptance tests pass.

## Current state

Documentation and candidate discovery only. No model has been deployed as a production inference endpoint. No Worker, Queue, R2 object, DNS route, Supabase function, secret, model weight or Android client has been changed by this audit. No paid resources or billing changes were made. A production-ready all-four-model service at ₹0/month is not demonstrated.
