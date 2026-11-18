# Workly Mithi v2 Flash server

This service loads the official `Oomni/mithi-v2-flash` model and exposes authenticated WAV synthesis for Hindi (`hi`), Indian English (`en`) and Gujarati (`gu`). It returns 24 kHz mono WAV audio. Model source/license: https://huggingface.co/Oomni/mithi-v2-flash (Apache-2.0).

## Run

Build the Docker image and start it with a long random `MITHI_API_KEY`. The model is downloaded into the image during build. Set `MITHI_CPU_THREADS` for available CPU cores. A GPU can be selected with `MITHI_DEVICE=cuda` only when the container has a compatible CUDA runtime and PyTorch build.

```sh
docker build -t workly-mithi .
docker run --rm -p 7860:7860 -e MITHI_API_KEY='replace-with-a-long-random-secret' workly-mithi
```

## API

`POST /v1/audio/speech` with `Authorization: Bearer <MITHI_API_KEY>` and JSON:
```json
{"text":"નમસ્તે, કેમ છો?","language":"gu","voice":"vaidehi"}
```
Returns `audio/wav`. Supported language codes: `hi`, `en`, `gu`. Voices: `satvik`, `anirban`, `nakul`, `vasant`, `siddhant`, `charvi`, `ahana`, `vaidehi`, `malini`, `jahnavi`.

Do not expose this API publicly without TLS, authentication, request limits and monitoring. Keep `MITHI_API_KEY` in the hosting provider's secret store, never in the Android APK or website JavaScript.

## Integration status

This is the server foundation only. It must be deployed and smoke-tested before Android TTS playback is switched to it. Existing phone-side Kokoro/Indic TTS code is intentionally retained until the remote audio playback path is verified. Speech-to-Text is independent and remains unchanged.
