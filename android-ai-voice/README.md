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
- The model is not bundled in the APK. On the first app launch, the app automatically queues the download through Android DownloadManager; the transfer runs only on unmetered Wi-Fi.
- DownloadManager handles the background transfer and retry behavior; the app shows progress and can cancel/delete the model. Mobile data and roaming are disabled for this download.
- Stored in app-specific external storage. No broad storage permission is requested.
- Before download, the app checks for the model size plus 512 MB free-space headroom; after download it checks the exact size and GGUF magic.

The Android project now also contains a pinned llama.cpp native runtime build and a local Qwen chat screen:

- The `llama.cpp` runtime is pinned to release tag `b5046` and built with Android NDK/CMake; the model is loaded from the app-private model file at runtime.
- After download, the user can open **Offline AI Chat** from the main screen. The chat runs locally and keeps a limited recent conversation context on the phone.
- The chat screen provides microphone input and spoken replies for Hindi, Indian English and Gujarati. Android speech recognition is asked to prefer offline mode; this is only a preference, not a guarantee. Offline recognition and TTS require compatible language packs/voices installed on the phone.
- Qwen loading is blocked on devices reporting less than 6 GB total RAM. Actual performance still depends on the phone's chipset, free RAM and thermal limits.
- Basic chat and text-based tasks work locally; web browsing, live job search, external integrations and server-side tools are not available while offline.
- The APK build and real-device inference/voice tests are still required before calling this feature verified.

## Speech model integration status

The Sherpa-ONNX Android runtime (v2.0.1) is now added to the Android project, with file-backed Kotlin adapters for:
- AI4Bharat IndicConformer INT8 CTC (separate Hindi and Gujarati model files plus shared tokens).
- Shruti's sherpa-onnx/Moonshine pack (separate Hindi and Gujarati packs; each also handles English and code-switching).

These adapters accept 16 kHz mono Float32 PCM and expose offline transcription, but they are not yet connected to the microphone UI or an automatic speech-pack downloader. The app still uses Android's installed SpeechRecognizer and TextToSpeech until that wiring and device tests are completed.

The two TTS models still need separate integration work:
- Kokoro 82M has a 295 MB LiteRT-LM / MediaPipe TTS bundle for Hindi and English. Its Android sample currently targets Android 8.0+ (API 26); this project currently supports API 24+, so compatibility must be resolved without silently dropping older devices.
- Indic Tiny TTS is not a drop-in Sherpa Matcha model. Its three ONNX graphs require the model's own character tokenizer, text normalizer, duration/flow decoding and Vocos ISTFT post-processing. The Hindi, Gujarati and English packs are about 91 MB each. Merely downloading the graphs would not make TTS work.

Approximate model weights for the requested speech stack: IndicConformer Hindi+Gujarati ~395 MB; Shruti Hindi+Gujarati ~108 MB; Indic Tiny TTS Hindi+Gujarati+English ~273 MB; Kokoro ~295 MB. Total is about 1.07 GB, in addition to the existing Qwen model (~2.1 GB). Model licensing/attribution must be retained: AI4Bharat MIT, Shruti Apache-2.0 (NOTICE required), Indic Tiny TTS CC-BY-4.0 for acoustic weights plus MIT Vocos, and Kokoro LiteRT bundle Apache-2.0.

Do not mark these speech engines as available offline until model downloads, checksum/size validation, microphone/playback wiring, and real-device Hindi/Gujarati/English inference tests pass. The automatic first-launch Wi-Fi download currently applies to Qwen only.

## Supabase phone relay (review branch only)

The separate relay foundation includes an authenticated website pairing-code page at `/settings/ai-voice-server`, one-time 5-minute pairing codes, a paired-device token encrypted with Android Keystore, and a user-started Android foreground service that polls over outbound HTTPS. The migration and Edge Function remain review-only and have NOT been deployed to the live Supabase project. A phone on Jio/mobile data is commonly behind carrier-grade NAT, so the website cannot call the phone directly by its mobile IP.

Current remote behavior is deliberately limited: TTS jobs are spoken through the paired phone speaker and return a playback confirmation. Remote audio-file STT and generated audio-file delivery to the website are not implemented. The phone must remain powered, connected and running the foreground service. The service holds a partial wake lock while active, which can increase battery use. Android 15+ limits data-sync foreground services to a total of 6 hours per 24 hours. The service handles the OS timeout and stops cleanly; the user must reopen the app to start it again. No service-role key is included in the Android app; the embedded Supabase publishable key is public by design.

## Build

Open the `android-ai-voice/` folder as a standalone Gradle project in Android Studio, or use the repository GitHub Actions workflow to build a debug APK.

- Minimum Android: API 24
- Target SDK: 35
- Java: 17
- Gradle: 8.9
- Android NDK: 27.2.12479018
- CMake: 3.22.1
