# Workly AI Voice (separate Android app)

This is an independent Android project. It does not change the existing Workly India website, production Android app, Supabase functions, or Cloudflare Workers.

## First milestone

- Hindi (hi-IN), Indian English (en-IN), and Gujarati (gu-IN) language selection.
- Text-to-speech using the Android TTS engine installed on the phone.
- Speech-to-text using the Android speech-recognition service installed on the phone.
- Microphone permission requested only when the user starts speech recognition.
- No model download, paid API key, analytics, or background microphone capture.

Voice quality and language availability depend on the TTS/recognition engines installed on the device. Gujarati may be unavailable on some Android engines. Speech recognition may use internet and the device's configured recognition provider; this app does not promise offline recognition.

## Important: public website server is a later milestone

This first milestone is an on-device speech app. A separate Supabase relay foundation has now been added to the review branch, but it is not deployed or connected to the app/website yet. A phone on mobile data is commonly behind carrier-grade NAT, so a website cannot reliably call the phone directly by its mobile IP. The relay uses outbound HTTPS and one-time pairing; do not expose an unauthenticated phone port or put credentials in the website bundle.

## Build

Open the android-ai-voice/ folder as a standalone Gradle project in Android Studio, or use the repository GitHub Actions workflow to build a debug APK.

- Application ID: com.worklyindia.aivoice
- Minimum Android: API 24
- Target SDK: 35
- Java: 17
