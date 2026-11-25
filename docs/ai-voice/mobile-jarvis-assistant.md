# ChatWork Mobile JARVIS Assistant

## Goal

Build an opt-in, on-device-first personal voice assistant inside the existing ChatWork Android application. The interaction model is inspired by hands-free mobile assistants: the user explicitly enables the assistant, says "Hey ChatWork", speaks naturally, and hears a spoken response.

This is a staged implementation plan, not a claim that always-on wake-word detection is already implemented.

## Repository audit (main, 2026-11-25)

The ChatWork Android project is `android-ai-voice/` (application ID `com.worklyindia.chatwork`, namespace `com.worklyindia.aivoice`). It is distinct from the Workly India website-wrapper/native battery-monitor project under `native/android/`; do not mix the two applications.

Existing capabilities found:
- `QwenModelManager.kt` downloads Qwen 2.5 GGUF 0.5B / 1.5B / 3B models and validates file size + GGUF magic.
- `OfflineAiEngine.kt` loads GGUF through the bundled llama.cpp JNI runtime and generates local responses.
- `SpeechModelCatalog.kt`, `SpeechPackDownloadManager.kt`, `OfflineSpeechRecognizer.kt` and `OfflineSpeechEngineFactory.kt` provide downloaded Sherpa-ONNX IndicConformer INT8 Hindi/Gujarati and other language packs.
- The voice-to-text screen has a local audio-file transcription path. The Offline AI Chat microphone path and actual offline recognition path must be tested separately before being called integrated.
- Existing TTS engines include Android system TTS and several optional engines/adapters. The README explicitly says Indic Tiny TTS is not yet integrated into Android inference; do not advertise it as usable until the end-to-end synthesis path passes tests.
- `VoiceRelayService.kt` is a website voice-relay data-sync foreground service. It is not an always-on microphone/wake-word service.
- No dedicated "Hey ChatWork" wake-word detector or assistant lifecycle/controller was found in the inspected source.
- Latest main Android workflow (run 45655463404) completed successfully and produced signed APK + Play Store AAB artifacts. That build predates this branch and does not include the planned JARVIS features.

## Target architecture

1. **Assistant settings and lifecycle**
   - Explicit opt-in switch, wake-word status, selected language, selected voice, model readiness, battery/thermal status.
   - Clear start / pause / stop controls and a persistent notification with a microphone privacy indicator.
   - No microphone access before user consent and runtime permission.
   - No silent microphone auto-start at boot.

2. **Wake-word engine**
   - Dedicated small on-device keyword model for "Hey ChatWork"; do not run IndicConformer continuously.
   - Evaluate Android-compatible open-source model/runtime candidates and licenses before selecting one.
   - Run only while the user has enabled the assistant and the OS permits a microphone foreground service.
   - Add confidence threshold, cooldown, false-positive tests, and an immediate stop action.
   - If the device/OS cannot safely keep the service alive, show a paused state and explain how to resume.

3. **Speech-to-text**
   - Prefer the installed IndicConformer INT8 pack for supported Indian languages.
   - Capture 16 kHz mono audio only after wake-word detection; use voice activity detection (VAD) to stop at the end of speech.
   - Reuse existing Sherpa-ONNX adapter where compatible; keep model loading/inference off the main thread.
   - Provide Android SpeechRecognizer only as an explicitly identified fallback, not as proof of offline operation.

4. **Adaptive AI brain**
   - Add Qwen3 GGUF choices only after verifying exact upstream repository, file, size, checksum, license and llama.cpp compatibility.
   - Select the largest model that passes available-memory and device benchmark checks, with a conservative safety margin.
   - Never select a model solely from total physical RAM. Check available RAM, ABI, free storage, thermal state and prior OOM/failure history.
   - Load only one LLM at a time; unload speech/LLM engines when idle and handle memory pressure.
   - Retain Qwen 2.5 as a fallback until Qwen3 is validated on supported devices.

5. **Text-to-speech**
   - Define a single TTS interface and connect only engines with a verified inference implementation.
   - Verify iTantra model provenance and actual architecture. The currently catalogued Indic Tiny TTS exports are not VITS and are not yet end-to-end integrated.
   - Add VITS only as a separate model family if a compatible, licensed model and runtime are verified.
   - Support Hindi, Gujarati and English voice packs, test audio quality and report which voice is active.

6. **Conversation**
   - Pipeline: wake word -> VAD -> STT -> Qwen3 -> TTS.
   - Keep a bounded, user-controlled conversation context on-device. Provide clear-history and memory controls.
   - Offline mode must not silently send transcripts/audio to a server. Any cloud fallback must be separately disclosed and user-enabled.

## Android background and privacy constraints

- Use a microphone foreground service with the correct `microphone` foreground-service type and runtime permissions on supported Android versions.
- Start microphone capture only from a user-visible, permitted interaction; Android 14+ background-start restrictions must be respected.
- Show a persistent notification while listening, with Pause/Stop actions. Never claim guaranteed 24/7 operation.
- Do not request unrelated permissions. Do not bypass OEM battery controls or hide microphone use.
- Reboot recovery must restore only a non-listening paused state; require a user action to resume microphone capture.
- Test Android 13 through current target API and Realme/Oppo background restrictions.

## Implementation phases and exit gates

### Phase 0 — Baseline and safety
- Preserve the current signed update identity and signing key.
- Confirm the Android app project, package ID, current build workflow and existing model contracts.
- Add automated unit tests for adaptive selection, model readiness, state transitions and download integrity.

### Phase 1 — Model manager
- Add verified Qwen3 GGUF catalog entries and checksums.
- Implement adaptive recommendation using available RAM + storage + ABI + device benchmark.
- Make model cards show exact installed/downloaded/unsupported state, Test, Activate, Deactivate and Delete.
- Ensure deleting a model clears its selected/active state and related usage records.
- Exit gate: clean build; download integrity tests; no false READY state for partial/corrupt files.

### Phase 2 — Unified speech pipeline
- Connect downloaded IndicConformer to live microphone capture, VAD and transcription.
- Integrate one verified Hindi/Gujarati TTS engine end-to-end.
- Exit gate: recorded Hindi/Gujarati utterances transcribe; generated speech plays; model loading is off main thread; memory stays bounded.

### Phase 3 — Wake word and foreground service
- Select and license-check a compact wake-word engine/model.
- Add explicit opt-in, notification actions, permission flow, service lifecycle and pause/resume.
- Exit gate: false-positive/false-negative test set; screen-off tests; notification stop works immediately; no hidden listening.

### Phase 4 — Conversation orchestration
- Join wake word, STT, adaptive Qwen3, TTS and conversation context.
- Add interruption/stop-speaking, timeout, thermal and OOM recovery.
- Exit gate: offline round-trip conversation works on at least one low-memory and one higher-memory ARM64 test device.

### Phase 5 — Release validation
- Run CI, APK/AAB signing checks, model smoke tests and device tests.
- Verify R2 upload and update metadata separately from build success.
- Do not call the feature production-ready until physical-device tests pass.

## Non-goals

- Do not modify `native/android/` battery protection features for this assistant.
- Do not bundle multi-gigabyte model weights in the APK.
- Do not claim the assistant can bypass Android microphone, foreground-service, battery or reboot restrictions.
- Do not mark a model "offline-ready" from download completion alone; require integrity and inference smoke tests.
