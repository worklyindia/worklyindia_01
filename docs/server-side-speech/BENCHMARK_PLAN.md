# Speech model benchmark plan

Run only on a runtime confirmed to cost ₹0/month. Do not enable auto-billing trials or paid credits.

## Test matrix

| Model / checkpoint | Task | Language tests | Required measurements |
|---|---|---|---|
| AI4Bharat IndicConformer INT8 pinned export | Primary STT | Gujarati, Hindi, English; clean + noisy | WER, CER, cold/warm latency, peak RAM/VRAM, RTF |
| udgamlabs/Shruti pinned revision | Backup STT | Hindi, English, Hinglish; clean + noisy | WER, CER, cold/warm latency, peak RAM/VRAM, RTF |
| Indic Tiny TTS Hindi checkpoint | TTS | Hindi | Pronunciation, intelligibility, naturalness, latency, peak RAM/VRAM, RTF |
| Indic Tiny TTS Gujarati checkpoint | TTS | Gujarati | Pronunciation, intelligibility, naturalness, latency, peak RAM/VRAM, RTF |
| Kokoro-82M | TTS | English | Pronunciation, intelligibility, naturalness, latency, peak RAM/VRAM, RTF |

## Dataset and privacy rules

- Use consented, non-sensitive, speaker-diverse recordings.
- Maintain human-verified transcripts for STT.
- Split by speaker between tuning and evaluation.
- Include common Indian names, job terms, numbers, dates, code-switching and regional accents.
- Do not upload production user audio to public demo spaces.
- Do not store user recordings by default; delete temporary benchmark audio/transcripts after evaluation and retain only aggregate metrics/anonymized test IDs.

## Pass/fail gates

- Pin revisions and record model, code, tokenizer and vocoder licenses.
- Every selected model must load within actual free runtime memory/startup limits.
- Warm inference must be faster than audio duration for interactive use; otherwise classify as batch-only.
- Record peak RAM/VRAM and concurrency.
- No hallucinated transcripts, clipped audio, language substitution or broken pronunciation.
- Test simultaneous requests, duplicate idempotency, queue behavior, cancellation, timeout and recovery.
- If free runtime sleeps/throttles unpredictably, do not advertise always-on service.

## Result template

| Model / language | WER/CER or human rating | Cold start | Warm latency | Peak RAM/VRAM | RTF | Concurrent requests | Pass? |
|---|---:|---:|---:|---:|---:|---:|---|
| Fill with measured values | | | | | | | |
