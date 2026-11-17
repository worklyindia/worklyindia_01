# Speech model benchmark plan

Run only on a runtime whose cost is confirmed as ₹0/month. Do not enable a trial that can convert to paid usage or request billing details.

## Test matrix

| Model / checkpoint | Task | Language tests | Required measurements |
|---|---|---|---|
| AI4Bharat IndicConformer INT8 pinned export | STT | Gujarati, Hindi, English; clean + noisy | WER, CER, cold start, warm latency, peak RAM/VRAM, RTF |
| Indic Tiny TTS Hindi checkpoint | TTS | Hindi | Pronunciation, intelligibility, naturalness, synthesis latency, peak RAM/VRAM, RTF |
| Indic Tiny TTS Gujarati checkpoint | TTS | Gujarati | Pronunciation, intelligibility, naturalness, synthesis latency, peak RAM/VRAM, RTF |
| Kokoro-82M | TTS | English | Pronunciation, intelligibility, naturalness, synthesis latency, peak RAM/VRAM, RTF |
| "Shruti TTS" | TTS | Pending exact repository/model identity | No benchmark until exact repository, task and license are verified |
| udgamlabs/Shruti (optional fallback only) | STT | Hindi, English, Hinglish; clean + noisy | WER, CER, cold start, warm latency, peak RAM/VRAM, RTF |

## Dataset and privacy rules

- Use consented, non-sensitive, speaker-diverse recordings.
- Keep a human-verified transcript for each STT sample.
- Split samples by speaker so the same speaker does not appear in tuning and evaluation.
- Include common Indian names, job terms, numbers, dates, code-switching and regional accents.
- Do not upload user production audio to public demo spaces or third-party benchmark services.
- Do not store user recordings by default. Delete temporary benchmark audio/transcripts after evaluation; retain only aggregate metrics and anonymized test IDs.

## Pass/fail gates

- Pin exact model revisions and record model, code, tokenizer and vocoder licenses.
- All selected models must load within the actual free runtime's memory and startup limits.
- Warm inference must be faster than the audio duration for interactive use; otherwise classify as batch-only.
- Record peak RAM/VRAM and concurrency; never infer capacity from parameter count alone.
- No language substitution, hallucinated transcript, clipped audio or broken pronunciation.
- A failed language/model pair is unsupported and must not be routed in production.
- Test simultaneous requests, duplicate request idempotency, queue behavior, cancellation, timeout and recovery.
- If the free runtime sleeps, throttles or loses capacity unpredictably, do not advertise always-on service.

## Result template

| Model / language | WER/CER or human rating | Cold start | Warm latency | Peak RAM/VRAM | RTF | Concurrent requests | Pass? |
|---|---:|---:|---:|---:|---:|---:|---|
| Fill with measured values | | | | | | | |
