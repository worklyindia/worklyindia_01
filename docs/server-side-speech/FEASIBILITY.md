# Server-side speech models: feasibility audit

Date: 2026-11-17
Repository branch: `feature/server-side-indic-speech`
Tracking issue: https://github.com/worklyindia/worklyindia_01/issues/174

## Important model-task correction

The four names supplied are not four TTS models:

| Requested name | Verified task | Initial finding |
|---|---|---|
| AI4Bharat IndicConformer INT8 | STT / ASR | Quantized Sherpa-ONNX exports exist; one public pack documents ~190 MB per language model plus shared tokens. Verify exact export, upstream provenance and license before adopting. |
| Indic Tiny TTS | TTS | A public candidate `sulabhkatiyar/indic-tts-mini-24k` is described as an 8.9M-parameter Matcha-TTS acoustic model with Vocos vocoder. The surfaced Tamil model card lists CC-BY-4.0 acoustic weights, MIT code and MIT Vocos weights. This candidate is Tamil-specific; do not assume it covers Hindi/Gujarati. |
| Kokoro-82M | TTS | Official `hexgrad/Kokoro-82M` has 82M parameters and Apache-2.0 weights. Its model card lists English (American/British) support, not Indic-language coverage. |
| Shruti | **STT / ASR, not TTS** | `udgamlabs/Shruti` is a 55M-parameter Hindi/English/Hinglish recognizer. The quantized `.cact` file is about 29.5 MB; Apache-2.0 weights and Cactus needle engine. It cannot be wired as a TTS voice. |

Sources:
- IndicConformer Sherpa-ONNX export overview: https://huggingface.co/parismitaglobalsolutions/indicconformer-sherpa-onnx
- Indic Tiny TTS candidate: https://huggingface.co/sulabhkatiyar/indic-tiny-tts-tamil
- Kokoro model card: https://huggingface.co/hexgrad/Kokoro-82M
- Shruti model and runtime: https://github.com/udgamlabs/shruti and https://udgamlabs.com/research/shruti

## Hosting feasibility under the approved ₹0/month budget

- Cloudflare Workers AI Free currently includes 10,000 Neurons/day, but it exposes Cloudflare's supported catalogue; this does not mean arbitrary custom model weights such as these four can be uploaded and served there.
- Cloudflare Workers Free is suitable for a lightweight authenticated API gateway, not for loading large PyTorch/ONNX speech models into a Worker.
- Supabase Edge Functions should remain orchestration/authentication only; they are not a persistent GPU model host.
- R2 can store model/audio artifacts within its free allowance, but object storage does not execute inference.
- No reliable always-on free GPU host has been verified for production. Hugging Face ZeroGPU/free shared GPU capacity is quota-limited and unsuitable as a guaranteed production endpoint.

## Safe implementation sequence

1. Confirm the exact intended Indic Tiny TTS repository/version and whether Tamil-only is acceptable.
2. Confirm whether Shruti was mistakenly labelled TTS; keep it as an optional STT candidate alongside IndicConformer, not as TTS.
3. Benchmark candidate models on a genuinely free CPU/GPU runtime, recording cold start, peak RAM/VRAM, real-time factor, language accuracy and concurrent request behavior.
4. Build a separate inference container only after a free host is proven; do not place model weights in Workers or Supabase Edge Functions.
5. Add a new, isolated API route/gateway after inference tests pass. Keep existing `unified-voice` production routing unchanged until authenticated end-to-end tests pass.
6. Move clients away from local model downloads only after the replacement server endpoint passes Hindi, Gujarati and English tests and fallback behavior is verified.

## Current state

This is a feasibility/documentation commit only. No production Worker, Supabase function, secret, model file, billing setting, or production route has been changed. No paid resource has been created. A production-ready all-four-model service at ₹0/month is **not yet demonstrated**.
