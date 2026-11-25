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

Qwen model downloads include Qwen 2.5 Q4_K_M choices (0.5B, 1.5B and 3B) plus the official Qwen3 0.6B Q8_0 GGUF (~639 MB). The Qwen3 option requires the newer llama.cpp runtime and remains subject to device inference smoke tests. The downloads screen checks currently available RAM, disables models that do not meet the app's minimum free-RAM estimate, and displays transferred size, percentage and live network speed. Only the model selected with **Use this model in Chat** is loaded by Offline AI Chat; it is not a multi-model simultaneous session.

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

- The `llama.cpp` runtime is pinned to release tag `b5092` (Qwen3-compatible) and built with Android NDK/CMake; the model is loaded from the app-private model file at runtime.
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

## Shared owner-phone voice relay (review branch only)

The intended shared model is one owner Android phone for all signed-in Workly India website users. Only the owner account may register the phone; website users create their own authenticated voice jobs, which are routed to that one phone in FIFO order. Website visitors do not install this Android app, pair a phone, or enter a code. The device token is encrypted with Android Keystore and the phone polls over outbound HTTPS, so carrier-grade NAT is supported.

For this review branch, browser AI Voice playback requests are routed through the relay. The phone synthesizes a WAV file with the Android TTS engine, uploads it to a private Supabase Storage bucket through the authenticated device-token Edge Function, and the website receives a short-lived signed playback URL. The queue allows up to 20 pending/running jobs and the phone processes one at a time. Audio is limited to 1.3 MB per response. The relay migration, bucket, Edge Function and owner secret are review-only and have NOT been deployed/configured in the live Supabase project.

Before deployment, set the Edge Function secret `WORKLY_AI_VOICE_OWNER_USER_ID` to the owner's Supabase Auth user UUID. Do not put this value in website or Android client code. The owner must sign into the Workly Voice Android app using that same account once to register the central phone. The phone must remain powered, connected and running its foreground service. Android 15+ limits data-sync foreground services to a total of 6 hours per 24 hours, so 24/7 availability is not guaranteed; reopen the app after an OS timeout. The service holds a partial wake lock while active and can increase battery use.

Important scope: this milestone uses the Android-installed TTS voice to synthesize audio. It does not yet route speech-to-text microphone audio from website users to the phone, and it does not yet use the downloaded Qwen/Indic offline model files as the TTS engine. Those are separate integrations and require their own model/runtime work and device testing. No service-role key is included in the Android app; the embedded Supabase publishable key is public by design.

## Build

Open the `android-ai-voice/` folder as a standalone Gradle project in Android Studio, or use the repository GitHub Actions workflow to build a debug APK.

- Minimum Android: API 26 (Android 8.0)
- Target SDK: 35
- Java: 17
- Gradle: 8.14.4
- Android NDK: 27.2.12479018
- CMake: 3.22.1


## Kokoro-82M multilingual offline text-to-speech

ChatWork includes a native Android Kokoro-82M adapter using MediaPipe Tasks Audio. Its approximately 295 MB CPU-compatible `.litertlm` bundle is downloaded on demand to app-private storage, checked against expected size and SHA-256, and can be tested or deleted from the model downloads screen. The test screen groups all **54 voices by 9 locales**: American English, British English, Hindi, Spanish, French, Italian, Brazilian Portuguese, Mandarin Chinese and Japanese. Users select language, individual female/male voice, and custom test text before generating audio. After download, synthesis runs locally without network access. Gujarati is not supported by this Kokoro bundle. Device inference and audio quality still require physical-phone verification.


## Offline text-to-speech model language and voice testing

The ChatWork Download Model page lists every integrated local TTS pack. Each downloaded TTS model exposes its own Test Model dialog; available language and speaker choices are model-specific rather than a shared, unsupported list.

- **Indic Tiny TTS:** separate Hindi, Gujarati and English model downloads. Test dialog provides Female and Male speaker styles for each language pack.
- **MOSS-TTS-Nano:** English and Mandarin Chinese test text selector; one bundled Junhao voice preset.
- **Qwen3-TTS CustomVoice:** reads the speaker names exposed by the loaded GGUF at runtime and lets the user select one. The current Android test path is English; other language controls are not exposed until native language-ID mapping is verified.
- **Chatterbox Multilingual:** language selector for the 23 languages in the multilingual model pack, including Hindi and English. The model uses its built-in voice conditioning; it does not expose a list of named voice presets in this Android adapter.
- **CosyVoice 3:** language selector for Chinese, English, Japanese, Korean, German, French, Russian, Spanish and Italian. The current pack uses its bundled reference voice audio; users can select language but not multiple bundled speaker identities.
- **Kokoro-82M:** 54 selectable voices grouped across 9 locales: American/British English, Hindi, Spanish, French, Italian, Brazilian Portuguese, Mandarin Chinese and Japanese.

Every model card shows its language/voice capability. The test screen lets users enter custom text and play generated audio. These integrations still require Android CI success and physical-device inference verification; language choices are not a claim that every accent or text input has been validated on every phone.


## ChatWork assistant integration status

The home screen exposes **AI Assistant** and opens the existing `OfflineAiChatActivity`; the feature does not create a second chat implementation. Adaptive selection uses current available RAM and free storage with safety reserves. The Qwen3 GGUF catalog entry and architecture-specific non-thinking prompt are implemented in the review branch, but Qwen3 load/inference has not yet been validated on a physical arm64 phone.

The `Hey ChatWork` wake-word detector, explicit microphone foreground service, persistent listening notification and lock-screen wake flow are still pending. The current microphone input is user-initiated from the chat screen. Do not describe this branch as a complete JARVIS assistant until those features, CI and physical-device tests pass.
