# Server-side speech models: feasibility audit

Date: 2026-11-17
Repository branch: `feature/server-side-indic-speech`
Tracking issue: https://github.com/worklyindia/worklyindia_01/issues/174

## Confirmed four-model roles and candidate repositories

| Model | Task / finding | Decision |
|---|---|---|
| AI4Bharat IndicConformer INT8 | STT / ASR. Public INT8 ONNX export candidate: `yashwork-byte/indic-conformer-600m-int8-onnx`; exact provenance, runtime compatibility and license need review. | Primary STT candidate only. |
| Shruti (`udgamlabs/Shruti`) | STT / ASR for Hindi, English and Hinglish; not TTS. | Backup STT candidate only; verify exact revision, license and WER/CER/runtime before routing. |
| Indic Tiny TTS | TTS. Search surfaced separate Hindi (`sulabhkatiyar/indic-tiny-tts-hindi`) and Gujarati (`sulabhkatiyar/indic-tiny-tts-gujarati`) repositories, both tagged CC-BY-4.0. | Benchmark as separate language-specific candidates; verify model card, files, code/vocoder licensing and runtime. |
| Kokoro-82M | TTS. Official `hexgrad/Kokoro-82M` is Apache-2.0 and English-focused. | English TTS candidate only unless other language support is separately validated. |

## Candidate repository references

- IndicConformer INT8 candidate: https://huggingface.co/yashwork-byte/indic-conformer-600m-int8-onnx
- Shruti backup STT: https://github.com/udgamlabs/shruti
- Indic Tiny TTS Hindi: https://huggingface.co/sulabhkatiyar/indic-tiny-tts-hindi
- Indic Tiny TTS Gujarati: https://huggingface.co/sulabhkatiyar/indic-tiny-tts-gujarati
- Kokoro: https://huggingface.co/hexgrad/Kokoro-82M

Discovery results are not a production approval. Inspect each pinned revision, model/weight license, inference code license, dependencies and vocoder/tokenizer license before downloading or deploying.

## Cloudflare and inference boundary

- Cloudflare Workers are the public authenticated API gateway, not arbitrary PyTorch/ONNX model hosting.
- Check each exact model against Cloudflare Workers AI supported catalogue; only exact officially supported model IDs may be routed there.
- AI Gateway provides supported request observability/routing controls; it does not host arbitrary custom model weights.
- R2 is object storage, not inference. Do not persist private recordings by default.
- Queues are optional for back-pressure; do not queue raw private audio unless retention and deletion are explicitly designed.
- DNS/security protect the gateway; inference origin must not be directly exposed.
- Supabase Edge Functions are suitable for auth/orchestration, not persistent GPU inference.
- No reliable always-on free GPU host has been verified. Approved budget remains ₹0/month; do not create paid compute, auto-billing trials or paid credits.

## Safe implementation sequence

1. Pin exact repositories/revisions and verify model, code, tokenizer and vocoder licenses.
2. Benchmark IndicConformer primary STT and Shruti backup STT separately for their supported languages.
3. Benchmark Indic Tiny TTS Hindi and Gujarati separately, and Kokoro English.
4. Prove a genuinely free runtime can load and serve every selected model. Record cold/warm latency, peak RAM/VRAM, RTF and concurrency.
5. Implement an isolated inference service behind the Cloudflare Worker gateway.
6. Add API routes only after runtime health and smoke tests pass.
7. Change Android clients only after parity, security, retry, playback and rollback tests pass.

## Current state

Documentation and candidate discovery only. No model has been deployed as a production inference endpoint. No Worker, Queue, R2 object, DNS route, Supabase function, secret, model weight or Android client has been changed. No paid resources or billing changes were made. A production-ready four-model service at ₹0/month is not demonstrated.
