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

## Implementation update — 2026-11-25

- The ChatWork home screen exposes **AI Assistant** and opens the existing `OfflineAiChatActivity` (no duplicate chat engine).
- Adaptive model selection is connected to the existing offline chat and wake service. It evaluates live available RAM and storage with safety reserves.
- Added the official `Qwen/Qwen3-0.6B-GGUF` Q8_0 model as a separate 639,446,688-byte download; Qwen2.5 models remain fallbacks.
- Upgraded the pinned llama.cpp runtime from `b5046` to `b5092`, the minimum version identified by Qwen's official guidance for Qwen3 support. Native code detects `general.architecture=qwen3` and uses the non-thinking ChatML prompt.
- Qwen model cards now require a **Test Model** action that loads the native model and generates a real local response before the manager marks the model `READY`.
- Added the official Sherpa-ONNX GigaSpeech KWS mobile model archive as a separate download. The installer extracts only required ONNX/tokenizer files and verifies their expected sizes and SHA-256 hashes. It configures two BPE phrase variants for `Hey ChatWork`.
- Added a **Test Model** action for the wake-word pack; it initializes the native keyword spotter and its configured keyword stream.
- Added an explicitly user-started microphone foreground service with a persistent Stop notification, microphone FGS type/permission, partial CPU wake lock, and `START_NOT_STICKY` so Android does not silently restart listening after process death.
- The service orchestrates wake-word detection → command capture with silence timeout → downloaded IndicConformer STT → tested Qwen model → downloaded Indic Tiny TTS. All audio inference is local; no audio recording is uploaded by this service.
- The existing chat screen has an explicit consent/language selection flow, checks required downloads, and requests microphone/notification permissions before starting the service.

### Release gates still open

- CI for the latest branch head must pass; multiple Android workflow runs are still building/queued.
- The wake phrase token variants and detection threshold must be tested with real voices and noise on physical arm64 devices. The wake model test currently verifies model/stream initialization, not live acoustic recognition.
- Qwen3 inference, Hindi/Gujarati/English STT/TTS quality, long-running memory/thermal behavior, audio echo, lock-screen behavior and Realme battery-management behavior require physical-device tests.
- Android 14+ microphone foreground-service start/stop behavior and notification controls must be validated on-device.
- No claim of unrestricted 24/7 listening: Android/OEM policies may stop or restrict the service. The user must start it manually and can stop it from the notification.
- Do not merge or publish as a release until CI and the physical-device acceptance tests pass.


## Expanded mobile-first feature roadmap (requested 2026-11-26)

These are targets and are **not yet implemented/verified** unless listed above as implemented. Deliver in phases with tests, without claiming all capabilities are complete:

1. **Voice assistant** — hands-free speech interaction; wake-word opt-in, tap-to-talk fallback, interruption and silence handling.
2. **User memory** — explicit opt-in, local structured memory, user review/edit/delete/clear, retrieval in context; avoid sensitive details by default and never upload without consent.
3. **AI agents** — task planning, bounded step execution, approval gates for consequential actions, execution log and result verification; safe failure/undo where feasible.
4. **Mobile Control** — control this Android phone through user-approved Android APIs and a separately enabled Accessibility service when needed; scoped actions, visible consent, confirmation for risky actions, and stop/disable controls. No root or security bypass.
5. **File assistant** — user-granted Android document access (SAF), search/read/summarize and organize with confirmation before moving/deleting; never scan private files without grant.
6. **Hindi/Gujarati/English** — language-aware STT, LLM prompt and TTS, language switching and mixed-language testing.
7. **Offline AI** — local-only features when compatible packs are installed; model selection must use only verified/test-passed downloads, live RAM/storage budget and fallback to smaller models; explicitly report unsupported offline tasks.
8. **AI voice** — integrated, tested TTS packs, voice selection, interruption/stop controls and no cloud fallback unless separately enabled.
9. **Smart tasks** — local reminders/calendar-style planning; request notification/calendar permissions only as needed; distinguish suggested plans from scheduled actions.
10. **Online AI research** — separately opt-in network mode, disclose what text/context is sent, source links and offline fallback.
11. **System tools** — only Android APIs and user-authorized actions; explain limitations, no root/bypass or silent privileged control.
12. **App control** — Android intents/accessibility only where lawful, explicit user enablement, scoped operation and confirmations; no stealth interaction or credential handling.

### Phased delivery and acceptance criteria

- **Phase A (foundation):** stable build, model auto-selection/fallback, unified language and audio pipeline, model and device tests.
- **Phase B (mobile assistant):** memory controls, file assistant (SAF), reminders, app launching, permission-aware system actions. Test each action and recovery.
- **Phase C (agents + online):** task planner/executor with confirmation and audit log, online research opt-in, source attribution and privacy controls.
- **Phase D (Mobile Control):** implement scoped Android action service, explicit Accessibility enablement only for UI automation, user-visible action logs, confirmations and test cases; never silently operate apps or handle credentials.
- Each feature must have a UI, permission/consent flow, tests and documented limits. Mark it complete only after CI and device validation. Do not merge this draft PR or claim production readiness solely from code changes.


## Implementation update — 2026-11-26

- Added the first Mobile Control screen with explicit, user-triggered Back, Home, Recents and scroll actions, plus direct Wi-Fi, Bluetooth and Display settings shortcuts.
- The Accessibility service is opt-in, protected by Android's `BIND_ACCESSIBILITY_SERVICE` permission and configured to retrieve the active window only for the requested scroll operation. Its event callback deliberately does not inspect or retain events; no screen text is uploaded.
- Fixed Kotlin source formatting in the chat menu and Mobile Control service, corrected the accessibility service manifest binding declaration, and refresh the permission/connection status when returning from Android Accessibility settings.
- Limited text-file import to 120,000 characters while reading, rather than loading an arbitrarily large file before applying the limit.

### Next implementation targets (not yet complete)

1. **AI Agent and approvals:** structured action proposals, visible plan preview, per-action confirmation, cancel/undo where Android supports it, and a local audit history. No autonomous destructive actions.
2. **Mobile Control expansion:** user-selected app launch, notification/settings shortcuts and supported accessibility actions only; no hidden input capture, credential entry or security bypass.
3. **File Assistant:** bounded PDF/text extraction, explicit file selection, document summaries and search over files the user has selected.
4. **Smart Tasks:** recurring reminders, reminder list/edit/cancel, calendar event creation only after confirmation, and reliable reboot/permission handling.
5. **Multilingual voice:** end-to-end Hindi, Gujarati and English STT/LLM/TTS validation, language selection, interruption and playback stop.
6. **Offline/online modes:** visible offline readiness checks and an optional, separately consented online research mode. Offline conversations must not silently upload content.
7. **Release validation:** automated tests, clean signed APK/AAB build, artifact inspection and physical Android testing across supported Android/OEM versions.

These are roadmap items, not implemented or validated functionality. Keep the PR draft until CI for the latest head and device acceptance tests pass.
