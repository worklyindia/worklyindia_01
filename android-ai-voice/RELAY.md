# Workly AI Voice — Supabase relay (review-only)

This is a separate Android app and an isolated relay backend. The relay source is included for review in PR #177 only. **It has not been applied to the live Supabase project and no production service has been changed.**

## Design
- Existing Workly India Supabase project is intended as the free-tier relay, not as an AI inference host.
- Website users authenticate with their normal Supabase session and request a short-lived pairing code.
- The Android app claims the one-time code and receives a random device token. Only its SHA-256 hash is stored in the database; the token is returned once and must be stored in Android Keystore-backed encrypted storage before production use.
- The phone polls the Edge Function over an outbound HTTPS connection, so Jio/mobile CGNAT does not need an inbound port.
- The Edge Function stores jobs in dedicated tables in the public schema and returns results only to the owning website user.
- No service-role key, database password, or private API secret belongs in the Android APK or browser bundle.

## Actions in `workly-ai-voice-relay`
- `create_pairing`: authenticated website user; returns a one-time 24-character hex code valid for 5 minutes.
- `claim_device`: Android app exchanges the code for a device token.
- `create_job`: authenticated website user creates a `tts`, `stt`, `ai` or owner-only `image` request (payload limit 20 KB; image jobs have a 15-minute expiry).
- `upload_image`: the paired phone uploads a small JPEG result to private Storage; the website receives a 24-hour signed URL.
- `get_job`: authenticated website user retrieves only their own job status/result.
- `list_devices`: authenticated website user lists their own paired phones.
- `revoke_device`: authenticated website user revokes a paired phone token.
- `poll`: paired phone receives one queued job and sends a heartbeat.
- `complete_job`: paired phone returns a result (limit 32 KB).
- `fail_job`: paired phone marks an unsupported or failed request with an explicit error.
- `revoke_device`: authenticated owner revokes the phone token.

## Current limitations
- This is the relay API contract/backend foundation, not yet a complete working website-to-phone voice server.
- The Android app now includes pairing UI, Android Keystore AES-GCM token storage, a user-started foreground service, polling/reconnect logic, and on-device TTS playback for remote TTS jobs.
- The website now includes a signed-in pairing-code generator, paired-phone listing/revocation, and a test TTS request page at `/settings/ai-voice-server`.
- Android's current `SpeechRecognizer` listens to the phone microphone; it does not transcribe an arbitrary audio file uploaded by a website. Remote STT requires a separately implemented/tested audio-input model or a supported external-audio recognition path.
- Remote TTS currently plays text through the paired phone speaker and returns a playback confirmation, not an audio file. Audio-file synthesis/upload and remote audio-file STT still need implementation and device testing.
- Phone availability depends on power, network, Android background limits, and the user keeping the foreground server enabled. No 24/7 uptime guarantee.
- Local image inference uses Stable Diffusion 1.5 Q4 (about 1.57 GB) downloaded to the Android app's private files. The phone uses the CPU backend at 512×512 and 4–10 steps; it does not call a paid image-generation API.
- Website image jobs are restricted to the owner account because they consume the owner's phone battery, memory and mobile data. The phone must be online, registered, and running the foreground relay.
- The Android model/runtime integration still requires a successful CI build and physical-device performance/RAM testing before production use.
- Free Supabase quotas apply to relay, Storage and network transfer. This design does not promise unlimited traffic or zero throttling.

## Deployment safety
1. Review and test the SQL migration and Edge Function.
2. Apply the migration and deploy the function only after explicit production-deployment approval.
3. Pair a test device, verify owner isolation, token revocation, job expiry, and network reconnect.
4. Add app/website integrations only after those tests pass.
