# Speech model benchmark plan

Run this only on a runtime whose cost is confirmed as ₹0/month. Do not enable a trial that can convert to paid usage or request billing details.

## Test matrix

| Model | Task | Language tests | Required measurements |
|---|---|---|---|
| IndicConformer INT8 | STT | Gujarati, Hindi, English; clean + noisy | WER, CER, cold start, warm latency, peak RAM, real-time factor |
| Shruti | STT fallback | Hindi, English, Hinglish; clean + noisy | WER, CER, cold start, warm latency, peak RAM, real-time factor |
| Mithi v2 Flash | TTS | Gujarati, Hindi, Bengali, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu, English | pronunciation review, MOS-style human rating, synthesis latency, real-time factor, peak RAM |
| Kokoro-82M | TTS fallback | English only | pronunciation review, MOS-style human rating, synthesis latency, real-time factor, peak RAM |

## Dataset rules

- Use consented, non-sensitive, speaker-diverse recordings.
- Keep a human-verified transcript for each STT sample.
- Split samples by speaker so the same speaker does not appear in both tuning and evaluation.
- Include common Indian names, job terms, numbers, dates, code-switching and regional accents.
- Do not upload user production audio to public demo spaces or third-party benchmark services.
- Delete temporary test audio/transcripts after the evaluation; retain only aggregate metrics and anonymized test IDs.

## Pass/fail gates

- All selected models must load within the actual free runtime's memory and startup limits.
- Warm inference must be faster than the audio duration for interactive use; otherwise classify it as batch-only.
- Record peak RAM/VRAM and concurrency; never infer capacity from parameter count alone.
- No unexplained language substitution, hallucinated transcript, clipped audio or broken pronunciation.
- Any language/model pair that fails is marked unsupported and must not be routed in production.
- If the free runtime sleeps, throttles or loses capacity unpredictably, do not advertise always-on service.

## Result template

| Model / language | WER or human rating | Cold start | Warm latency | Peak RAM/VRAM | RTF | Concurrent requests | Pass? |
|---|---:|---:|---:|---:|---:|---:|---|
| Fill with measured values | | | | | | | |
