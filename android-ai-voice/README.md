# Workly Voice (separate Android app)

This is an independent Android project. This feature branch also adds a separate website pairing page and isolated Supabase relay source for review. It does not change the production Workly Android app, live Supabase database/functions, deployed website, or Cloudflare Workers.

## App identity

- App display name: **Workly Voice**
- Launcher icon: custom dark navy tile with a turquoise W and white voice-wave bars.
- APK download filename: **Workly-Voice-v1.0.0.apk**
- Application ID: com.worklyindia.aivoice

## First milestone

- Hindi (hi-IN), Indian English (en-IN), and Gujarati (gu-IN) language selection.
- Text-to-speech using the Android TTS engine installed on the phone.
- Speech-to-text using the Android speech-recognition service installed on the phone.
- Microphone permission requested only when the user starts speech recognition.
- No model download, paid API key, analytics, or background microphone capture.

Voice quality and language availability depend on the TTS/recognition engines installed on the device. Gujarati may be unavailable on some Android engines. Speech recognition may use internet and the device's configured recognition provider; this app does not promise offline recognition.


## Offline Workly AI model (on-demand download milestone)

The Android app now includes an on-demand downloader for the official
`Qwen/Qwen2.5-3B-Instruct-GGUF` model using the `Q4_K_M` quantization:

- Model file: `qwen2.5-3b-instruct-q4_k_m.gguf`
- Exact Hub file size: 2,104,932,768 bytes (about 2.1 GB decimal).
- Source: https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF
- Direct download from Hugging Face; no Cloudflare/R2 dependency.
- The model is not bundled in the APK. Users explicitly start the download.
- DownloadManager handles the background transfer and retry behavior; the app shows progress and can cancel/delete the model.
- Stored in app-specific external storage. No broad storage permission is requested.
- Before download, the app checks for the model size plus 512 MB free-space headroom; after download it checks the exact size and GGUF magic.

The Android project now also contains a pinned llama.cpp native runtime build and a local Qwen chat screen:

- The `llama.cpp` runtime is pinned to release tag `b5046` and built with Android NDK/CMake; the model is loaded from the app-private model file at runtime.
- After download, the user can open **Offline AI Chat** from the main screen. The chat runs locally and keeps a limited recent conversation context on the phone.
- The chat screen provides microphone input and spoken replies for Hindi, Indian English and Gujarati. Android speech recognition is asked to prefer offline mode; this is only a preference, not a guarantee. Offline recognition and TTS require compatible language packs/voices installed on the phone.
- Qwen loading is blocked on devices reporting less than 6 GB total RAM. Actual performance still depends on the phone's chipset, free RAM and thermal limits.
- Basic chat and text-based tasks work locally; web browsing, live job search, external integrations and server-side tools are not available while offline.
- The APK build and real-device inference/voice tests are still required before calling this feature verified.

## Supabase phone relay (review branch only)

The separate relay foundation includes an authenticated website pairing-code page at `/settings/ai-voice-server`, one-time 5-minute pairing codes, a paired-device token encrypted with Android Keystore, and a user-started Android foreground service that polls over outbound HTTPS. The migration and Edge Function remain review-only and have NOT been deployed to the live Supabase project. A phone on Jio/mobile data is commonly behind carrier-grade NAT, so the website cannot call the phone directly by its mobile IP.

Current remote behavior is deliberately limited: TTS jobs are spoken through the paired phone speaker and return a playback confirmation. Remote audio-file STT and generated audio-file delivery to the website are not implemented. The phone must remain powered, connected and running the foreground service. The service holds a partial wake lock while active, which can increase battery use. Android 15+ limits data-sync foreground services to a total of 6 hours per 24 hours. The service handles the OS timeout and stops cleanly; the user must reopen the app to start it again. No service-role key is included in the Android app; the embedded Supabase publishable key is public by design.

## Build

Open the `android-ai-voice/` folder as a standalone Gradle project in Android Studio, or use the repository GitHub Actions workflow to build a debug APK.

- Minimum Android: API 24
- Target SDK: 35
- Java: 17
