# Workly India AI Voice — zero-cost-first deployment plan

## Current implementation status

- The AI Chat composer has a dedicated phone-call icon that opens `/ai-voice-call`.
- The voice-call page is a UI shell with a microphone permission check.
- The page deliberately does not call OpenAI Realtime or any paid voice API.
- Live calling remains disabled until an open-source inference service is deployed and configured.

## Intended open-source stack

- Speech-to-text: `whisper.cpp` (start with the multilingual base model; Gujarati/Hindi/English must be tested with real audio).
- Text-to-speech: Mithi v2 Flash (verify the model card, license, runtime dependencies, voice quality and language coverage before production use).
- Existing Workly AI response service: reuse only if it can be called without introducing a paid provider charge. Otherwise the AI response model also needs a self-hosted open-source option.
- Browser transport: WebRTC or a self-hosted WebSocket/WebRTC gateway. Do not assume Vercel serverless functions can host persistent audio streams.

## Free-tier constraints

Supabase Free and Vercel are not model-inference hosts. Do not upload model weights into Supabase database/storage or commit model weights to GitHub. Store source code, setup scripts and configuration in GitHub; download model weights onto the inference host at deployment time.

A public 24/7 service with unlimited callers cannot be guaranteed at zero cost. Any free hosting tier has compute, bandwidth, concurrency, execution-time or inactivity limits. If no always-on machine is available, the voice feature must remain unavailable or run only while a user's own machine is online.

## Required backend contract before enabling the call button

Create a separately hosted inference service that:
1. Authenticates users with short-lived signed tokens; never expose service credentials in browser code.
2. Accepts streamed audio and returns partial/final transcripts.
3. Sends text to the approved Workly AI response provider.
4. Synthesizes the response with Mithi and streams audio chunks back.
5. Supports interruption/cancellation, mute, call termination and disconnect cleanup.
6. Enforces request-size, duration, concurrency and abuse controls.
7. Returns explicit errors for unavailable model, overload, timeout and quota exhaustion.

Suggested environment variables (server-side only):
- `WORKLY_VOICE_SERVICE_URL`
- `WORKLY_VOICE_SERVICE_SECRET`

Do not enable live calling until the inference host, AI response model, license review, security checks and Hindi/English/Gujarati quality tests are complete.

## Privacy-first, no-retention requirement

The production voice service must process speech in memory and must not persist:
- Raw microphone audio or generated speech audio.
- Partial or final speech-to-text transcripts.
- Text prompts or AI voice responses created during a call.
- Call recordings, replay buffers, or speech payloads in analytics/crash reports.

Implementation requirements:
1. Keep audio chunks and transcript buffers in volatile memory only; discard them immediately after each processing step and clear remaining buffers when a call ends, is interrupted, or disconnects.
2. Do not write audio, transcripts, prompts, or generated responses to Supabase, object storage, browser local/session storage, IndexedDB, GitHub, or application logs.
3. Disable request-body logging and payload capture at the inference gateway, reverse proxy, hosting platform, observability tools, and error reporting. Log only non-content operational metadata (for example status, latency, model availability and coarse byte counts), with no user speech or text.
4. Do not retain provider-side prompts or speech data. Use only a self-hosted/open-source inference stack whose runtime and hosting configuration can meet this requirement; verify host-level logs and backups before launch.
5. Keep only the minimum non-content operational event if required, and make even that optional. Do not save transcripts as chat history by default.
6. Clearly disclose that transient processing still occurs and that infrastructure providers may process network/operational metadata.

This no-retention policy is a required acceptance criterion, not a claim that the current UI already performs live speech processing. It reduces stored data and privacy risk, but does not remove free-tier compute, bandwidth, concurrency, request-duration or quota limits.
