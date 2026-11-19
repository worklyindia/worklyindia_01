# Cloudflare Whisper deployment

## Live components

- Cloudflare Worker: `workly-speech-transcribe`
- Worker URL: `https://workly-speech-transcribe.gohilvishal7600.workers.dev`
- Model: `@cf/openai/whisper`
- Authentication: Supabase access token is validated against the project's Supabase Auth `/auth/v1/user` endpoint.
- CORS: only the Workly India production website origin is accepted by the Worker; server-to-server calls from Supabase Edge Functions do not send a browser Origin header.
- Audio limit: approximately 10 MB encoded payload.
- Retention: Worker returns the transcript directly and does not write audio/transcripts to R2 or database.

## Supabase integration

The following existing Edge Functions now route speech recognition through the Cloudflare Worker:

1. `unified-voice`, action `speech-to-text` — used by chat dictation.
2. `ai-voice-transcribe` — used by the AI Career Assistant voice input. Existing `voice_input` quota check and increment are preserved.

Both paths pass the authenticated user's Supabase Bearer token to the Worker. They do not fall back to AssemblyAI or Lovable when Cloudflare is unavailable, so this path does not silently incur third-party STT charges. A failed or exhausted Cloudflare free quota returns an error and the user can retry later.

## Cost and quota

Cloudflare Workers AI includes 10,000 Neurons/day on the Free plan. The published rate for `@cf/openai/whisper` is 41.14 Neurons/audio minute, approximately 243 audio minutes/day at that rate if no other Workers AI models consume the shared allocation. Usage beyond the free allocation is not enabled by this setup; on the Free plan requests stop when the allocation is exhausted.

No Paid plan, paid GPU, Hugging Face Job, AI Gateway credit purchase, or automatic billing was enabled.

## Not yet deployed

Custom IndicConformer, Shruti, Indic Tiny TTS Hindi/Gujarati and Kokoro inference are not hosted. They require a compatible runtime; R2 only stores files and does not execute models. Text-to-speech remains on its existing provider/cache path and is not converted to a free TTS model by this deployment.

## Verification

- Worker upload succeeded and its Workers AI binding, Supabase URL, and publishable key bindings are configured.
- Worker `workers.dev` subdomain is enabled.
- Supabase Edge Functions `unified-voice` and `ai-voice-transcribe` are ACTIVE after deployment.
- End-to-end audio inference with a signed-in production user still needs a real microphone test. The management environment blocks direct requests to the `workers.dev` host, so a live transcription result has not been independently verified here.
