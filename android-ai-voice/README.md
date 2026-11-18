# Workly Voice (separate Android app)

This is an independent Android project. This feature branch also adds a separate website pairing page and isolated Supabase relay source for review. It does not change the production Workly Android app, live Supabase database/functions, deployed website, or Cloudflare Workers.

## App identity

- App display name: **Workly Voice**
- Launcher icon: custom dark navy tile with a turquoise W and white voice-wave bars.
- APK download filename: **Workly-Voice-v1.0.0.apk**
- Application ID: com.worklyindia.aivoice

## First milestone

- Hindi (hi-IN), Indian English (en-IN), and Gujarati (gu-IN) language selection.
- Android system TTS plus optional Indic Tiny TTS language packs; Kokoro 82M has been removed.
- Android SpeechRecognizer remains the microphone fallback while the offline IndicConformer and Shruti adapters are not yet connected to the microphone UI.
- Microphone permission is requested only when the user starts speech recognition.
- No paid API key, analytics, or background microphone capture.

Speech recognition is not yet guaranteed to work offline. Gujarati neural TTS is not yet integrated; its availability depends on the installed Android TTS engine.


## Offline Workly AI models (Wi-Fi or user-approved mobile-data download)

Three Qwen 2.5 Q4_K_M choices are available: 0.5B (~491 MB), 1.5B (~1.12 GB), and 3B (~2.1 GB, labelled Premium). The downloads screen checks currently available RAM, disables models that do not meet the app's minimum free-RAM estimate, and displays transferred size, percentage and live network speed. Only the model selected with **Use this model in Chat** is loaded by Offline AI Chat; it is not a multi-model simultaneous session.

The Android app now includes an on-demand downloader for the official
`Qwen/Qwen2.5-3B-Instruct-GGUF` model using the `Q4_K_M` quantization:

- Model file: `qwen2.5-3b-instruct-q4_k_m.gguf`
- Exact Hub file size: 2,104,932,768 bytes (about 2.1 GB decimal).
- Source: https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF
- Direct download from Hugging Face; no Cloudflare/R2 dependency.
- The model is not bundled in the APK. On first launch, the app asks whether large model downloads may use mobile data. The saved choice is applied to Qwen and speech-pack downloads. If mobile data is approved, Android DownloadManager may use Wi-Fi or mobile data; otherwise it uses unmetered Wi-Fi only.
- DownloadManager handles the background transfer and retry behavior; the app shows progress and can cancel/delete the model. Roaming is always disabled. Mobile data is enabled only after the user explicitly approves it.
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

The Sherpa-ONNX Android runtime (v2.0.1) is included, with file-backed Kotlin adapters for:
- AI4Bharat IndicConformer INT8 CTC (Hindi and Gujarati model files plus shared tokens).
- Shruti sherpa-onnx/Moonshine (Hindi and Gujarati packs; each can also recognize English and code-switching).

Both adapters accept 16 kHz mono Float32 PCM and expose offline transcription. The Voice-to-Text screen now exposes separate Hindi/Gujarati download actions for both packs, backed by Android DownloadManager and the saved Wi-Fi/mobile-data consent. Pack readiness checks verify every expected file size before the adapter factory opens a model. The Voice-to-Text screen now has an engine selector and native 16 kHz mono microphone capture path for either downloaded Sherpa engine. It records up to 90 seconds, converts PCM16 to Float32, and sends it to the selected local recognizer on a worker thread. Android SpeechRecognizer remains the default fallback. CI compilation and real-device Hindi/Gujarati accuracy, memory and thermal tests are still pending; do not treat the feature as device-verified until those pass.

Indic Tiny TTS is still not integrated into Android inference and is not exposed as a download yet. It is not a drop-in Sherpa Matcha model: its three ONNX graphs require the model's own character tokenizer, text normalizer, duration/flow decoding and Vocos ISTFT post-processing. Hindi, Gujarati and English packs are about 91 MB each. They must not be downloaded until that inference path is implemented and validated.

Approximate model weights for the requested speech stack: IndicConformer Hindi+Gujarati ~395 MB; Shruti Hindi+Gujarati ~108 MB; Indic Tiny TTS Hindi+Gujarati+English ~273 MB. These are separate from the selected Qwen model. Model licensing/attribution must be retained: AI4Bharat MIT, Shruti Apache-2.0 (NOTICE required), Indic Tiny TTS CC-BY-4.0 for acoustic weights plus MIT Vocos, and Kokoro LiteRT bundle Apache-2.0.

Do not mark IndicConformer, Shruti or Indic Tiny TTS as available offline until their download flows, checksum/size validation, UI wiring and real-device Hindi/Gujarati/English inference tests pass. Qwen 0.5B, 1.5B and 3B GGUF model packs and supported speech packs can be downloaded on demand (Wi-Fi, or mobile data if explicitly approved).

## Supabase phone relay (review branch only)

The separate relay foundation includes an authenticated website pairing-code page at `/settings/ai-voice-server`, one-time 5-minute pairing codes, a paired-device token encrypted with Android Keystore, and a user-started Android foreground service that polls over outbound HTTPS. The migration and Edge Function remain review-only and have NOT been deployed to the live Supabase project. A phone on Jio/mobile data is commonly behind carrier-grade NAT, so the website cannot call the phone directly by its mobile IP.

Current remote behavior is deliberately limited: TTS jobs are spoken through the paired phone speaker and return a playback confirmation. Remote audio-file STT and generated audio-file delivery to the website are not implemented. The phone must remain powered, connected and running the foreground service. The service holds a partial wake lock while active, which can increase battery use. Android 15+ limits data-sync foreground services to a total of 6 hours per 24 hours. The service handles the OS timeout and stops cleanly; the user must reopen the app to start it again. No service-role key is included in the Android app; the embedded Supabase publishable key is public by design.

## Build

Open the `android-ai-voice/` folder as a standalone Gradle project in Android Studio, or use the repository GitHub Actions workflow to build a debug APK.

- Minimum Android: API 26 (Android 8.0)
- Target SDK: 35
- Java: 17
- Gradle: 8.14.4
- Android NDK: 27.2.12479018
- CMake: 3.22.1
