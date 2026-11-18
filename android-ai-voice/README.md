# Workly AI Voice (separate Android app)

This is an independent Android project. It does not change the existing Workly India website, production Android app, Supabase functions, or Cloudflare Workers.

## First milestone

- Hindi (hi-IN), Indian English (en-IN), and Gujarati (gu-IN) language selection.
- Text-to-speech using the Android TTS engine installed on the phone.
- Speech-to-text using the Android speech-recognition service installed on the phone.
- Microphone permission requested only when the user starts speech recognition.
- No model download, paid API key, analytics, or background microphone capture.

Voice quality and language availability depend on the TTS/recognition engines installed on the device. Gujarati may be unavailable on some Android engines. Speech recognition may use internet and the device's configured recognition provider; this app does not promise offline recognition.

## Supabase phone relay (review branch only)

The separate relay foundation now includes an authenticated website pairing-code page at `/settings/ai-voice-server`, one-time 5-minute pairing codes, a paired-device token encrypted with Android Keystore, and a user-started Android foreground service that polls over outbound HTTPS. The migration and Edge Function remain review-only and have NOT been deployed to the live Supabase project. A phone on Jio/mobile data is commonly behind carrier-grade NAT, so the website cannot call the phone directly by its mobile IP.

Current remote behavior is deliberately limited: TTS jobs are spoken through the paired phone speaker and return a playback confirmation. Remote audio-file STT and generated audio-file delivery to the website are not implemented. The phone must remain powered, connected and running the foreground service. The service holds a partial wake lock while active, which can increase battery use. Android 15+ limits data-sync foreground services to a total of 6 hours per 24 hours. The service handles the OS timeout and stops cleanly; the user must reopen the app to start it again. No service-role key is included in the Android app; the embedded Supabase publishable key is public by design.

## Build

Open the android-ai-voice/ folder as a standalone Gradle project in Android Studio, or use the repository GitHub Actions workflow to build a debug APK.

- Application ID: com.worklyindia.aivoice
- Minimum Android: API 24
- Target SDK: 35
- Java: 17
