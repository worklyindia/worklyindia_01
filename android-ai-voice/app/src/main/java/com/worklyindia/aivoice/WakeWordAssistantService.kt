package com.worklyindia.aivoice

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.sqrt

/**
 * Explicitly user-started foreground microphone service.
 * All wake-word, STT, LLM and TTS processing stays on-device.
 */
class WakeWordAssistantService : Service() {
    private val running = AtomicBoolean(false)
    private val worker = Executors.newSingleThreadExecutor()
    @Volatile private var recorder: AudioRecord? = null
    @Volatile private var activeAi: OfflineAiEngine? = null
    @Volatile private var cpuWakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (intent.action == ACTION_STOP) {
            stopAssistant()
            return START_NOT_STICKY
        }
        if (!running.compareAndSet(false, true)) return START_NOT_STICKY
        isRunning = true
        val notification = buildNotification("Preparing offline voice models…")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, true).apply()
        acquireCpuWakeLock()
        worker.execute { runAssistantLoop() }
        return START_NOT_STICKY
    }

    private fun runAssistantLoop() {
        var wakeSession: WakeWordEngineFactory.Session? = null
        var speech: OfflineSpeechRecognizer? = null
        var tts: IndicTinyTtsEngine? = null
        var ai: OfflineAiEngine? = null
        var audio: AudioRecord? = null
        try {
            check(running.get()) { "Hey ChatWork listening was stopped." }
            check(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                "Microphone permission is missing. Open ChatWork and enable Hey ChatWork again."
            }
            val language = getSharedPreferences(PREFS, MODE_PRIVATE)
                .getString(KEY_LANGUAGE, "hi")?.lowercase(Locale.ROOT) ?: "hi"
            check(language in setOf("hi", "gu", "en")) { "Choose Hindi, Gujarati or English in the assistant settings." }

            val speechManager = SpeechPackDownloadManager(this)
            val sttPack = SpeechModelCatalog.indicConformer(language)
            val ttsPack = SpeechModelCatalog.indicTinyTts(language)
            check(OfflineSpeechEngineFactory.isReady(this, sttPack)) {
                "Download IndicConformer ${language.uppercase(Locale.ROOT)} from Download Models first."
            }
            check(speechManager.snapshot(ttsPack).state == SpeechPackDownloadManager.State.COMPLETE) {
                "Download Indic Tiny TTS ${language.uppercase(Locale.ROOT)} from Download Models first."
            }
            val wakePack = SpeechModelCatalog.chatWorkWakeWord()
            check(WakeWordEngineFactory.isReady(this)) {
                "Download the ChatWork Wake Word model from Download Models first."
            }
            check(speechManager.isModelTested(wakePack)) {
                "Run Test Model for the ChatWork Wake Word pack before enabling listening."
            }

            val modelManager = QwenModelManager(this)
            val memory = ActivityManager.MemoryInfo()
            (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
            val modelDirectory = modelManager.file(modelManager.models.first()).parentFile ?: filesDir
            val budget = AssistantModelPolicy.readBudget(this, modelDirectory)
            val candidates = modelManager.models.map { model ->
                AssistantModelPolicy.Candidate(
                    id = model.id,
                    displayName = model.title,
                    expectedBytes = model.size,
                    minimumAvailableRamBytes = model.minFreeRam,
                    minimumFreeStorageBytes = 256L * 1024L * 1024L,
                    enabled = modelManager.snapshot(model).state == QwenModelManager.State.READY
                )
            }
            val recommendation = AssistantModelPolicy.recommend(
                candidates = candidates,
                budget = budget,
                reserveRamBytes = 1_200L * 1024L * 1024L,
                reserveStorageBytes = 256L * 1024L * 1024L
            )
            val savedModelId = getSharedPreferences("workly_qwen_models", MODE_PRIVATE)
                .getString("selected_model_id", null)
            val chosenCandidate = recommendation.candidate
            val chosen = if (savedModelId != null) {
                check(chosenCandidate?.id == savedModelId) {
                    "The selected Qwen model does not fit the wake assistant memory budget. Choose a smaller tested model in ChatWork first."
                }
                modelManager.models.first { it.id == savedModelId }
            } else {
                chosenCandidate?.let { item -> modelManager.models.firstOrNull { it.id == item.id } }
                    ?: throw IllegalStateException("No tested Qwen model fits the live memory budget. ${recommendation.reason}")
            }
            val activeAiEngine = OfflineAiEngine()
            ai = activeAiEngine
            activeAi = activeAiEngine
            check(activeAiEngine.loadModel(modelManager.file(chosen))) { "Could not load ${chosen.title}." }
            check(running.get()) { "Hey ChatWork listening was stopped." }

            val activeSpeechRecognizer = OfflineSpeechEngineFactory.openIndicConformer(this, language)
            speech = activeSpeechRecognizer
            check(running.get()) { "Hey ChatWork listening was stopped." }
            val activeTtsEngine = IndicTinyTtsEngine.create(this, language)
            tts = activeTtsEngine
            check(running.get()) { "Hey ChatWork listening was stopped." }
            val activeWakeSession = WakeWordEngineFactory.open(this)
            wakeSession = activeWakeSession
            check(running.get()) { "Hey ChatWork listening was stopped." }

            val minBuffer = AudioRecord.getMinBufferSize(
                WakeWordEngineFactory.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            check(minBuffer > 0) { "This phone does not support 16 kHz microphone input." }
            val activeAudio = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                WakeWordEngineFactory.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                maxOf(minBuffer * 2, 6400)
            )
            audio = activeAudio
            check(activeAudio.state == AudioRecord.STATE_INITIALIZED) { "Could not initialize the microphone." }
            recorder = activeAudio
            activeAudio.startRecording()
            updateNotification("Listening for ${WakeWordEngineFactory.WAKE_PHRASE} · ${language.uppercase(Locale.ROOT)} · On-device")

            val history = StringBuilder()
            val buffer = ShortArray(1600)
            val session = activeWakeSession
            while (running.get()) {
                val count = activeAudio.read(buffer, 0, buffer.size)
                if (count < 0) throw IllegalStateException("Microphone read failed ($count).")
                if (count == 0) continue
                val samples = FloatArray(count) { buffer[it] / 32768.0f }
                session.stream.acceptWaveform(samples, sampleRate = WakeWordEngineFactory.SAMPLE_RATE)
                while (session.spotter.isReady(session.stream)) {
                    session.spotter.decode(session.stream)
                    val detected = session.spotter.getResult(session.stream).keyword
                    if (detected.isNotBlank()) {
                        session.spotter.reset(session.stream)
                        updateNotification("Hey ChatWork detected · Speak now")
                        val commandSamples = captureCommand(activeAudio, buffer)
                        if (commandSamples.isNotEmpty()) {
                            updateNotification("Converting your speech offline…")
                            val userText = activeSpeechRecognizer.transcribe(commandSamples)
                            if (userText.isNotBlank()) {
                                history.append("User: ").append(userText).append("\n")
                                if (history.length > MAX_HISTORY_CHARS) history.delete(0, history.length - MAX_HISTORY_CHARS)
                                updateNotification("ChatWork is thinking offline…")
                                val answer = activeAiEngine.generate(history.toString())
                                history.append("Assistant: ").append(answer).append("\n")
                                if (history.length > MAX_HISTORY_CHARS) history.delete(0, history.length - MAX_HISTORY_CHARS)
                                updateNotification("Speaking offline · ${language.uppercase(Locale.ROOT)}")
                                activeTtsEngine.speak(answer)
                                discardPlaybackAudio(activeAudio, buffer)
                            } else {
                                updateNotification("No speech recognized · Listening for Hey ChatWork")
                            }
                        } else {
                            updateNotification("No command heard · Listening for Hey ChatWork")
                        }
                        session.spotter.reset(session.stream)
                        updateNotification("Listening for ${WakeWordEngineFactory.WAKE_PHRASE} · ${language.uppercase(Locale.ROOT)} · On-device")
                    }
                }
            }
        } catch (error: Exception) {
            if (running.get()) updateNotification("Assistant stopped · ${error.message ?: "Model or microphone error"}")
            running.set(false)
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply()
            isRunning = false
            stopSelf()
        } finally {
            running.set(false)
            recorder = null
            runCatching { if (audio?.recordingState == AudioRecord.RECORDSTATE_RECORDING) audio.stop() }
            runCatching { audio?.release() }
            runCatching { wakeSession?.close() }
            runCatching { speech?.close() }
            runCatching { tts?.close() }
            runCatching { ai?.unload() }
            activeAi = null
            releaseCpuWakeLock()
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply()
        }
    }

    /** Ignore the speaker's tail audio so the assistant does not wake itself after speaking. */
    private fun discardPlaybackAudio(audio: AudioRecord, buffer: ShortArray) {
        val until = SystemClock.elapsedRealtime() + PLAYBACK_COOLDOWN_MS
        while (running.get() && SystemClock.elapsedRealtime() < until) {
            val count = audio.read(buffer, 0, buffer.size)
            if (count < 0) break
        }
    }
    /** Record the command after the wake phrase until 1.2 s of silence or 12 s maximum. */
    private fun captureCommand(audio: AudioRecord, buffer: ShortArray): FloatArray {
        val samples = ArrayList<Float>(WakeWordEngineFactory.SAMPLE_RATE * 8)
        val startedAt = SystemClock.elapsedRealtime()
        var lastVoiceAt = 0L
        var voiceStarted = false
        while (running.get() && SystemClock.elapsedRealtime() - startedAt < COMMAND_MAX_MS) {
            val count = audio.read(buffer, 0, buffer.size)
            if (count < 0) throw IllegalStateException("Microphone read failed ($count).")
            if (count == 0) continue
            var sum = 0.0
            for (i in 0 until count) {
                val value = buffer[i] / 32768.0
                sum += value * value
            }
            val rms = sqrt(sum / count)
            val now = SystemClock.elapsedRealtime()
            if (rms >= VOICE_RMS_THRESHOLD) {
                voiceStarted = true
                lastVoiceAt = now
            }
            if (voiceStarted) {
                for (i in 0 until count) samples.add(buffer[i] / 32768.0f)
                if (now - lastVoiceAt >= SILENCE_AFTER_SPEECH_MS) break
            } else if (now - startedAt >= WAIT_FOR_COMMAND_MS) {
                break
            }
        }
        return samples.toFloatArray()
    }

    private fun stopAssistant() {
        running.set(false)
        runCatching { recorder?.let { if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) it.stop() } }
        releaseCpuWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun acquireCpuWakeLock() {
        if (cpuWakeLock?.isHeld == true) return
        val power = getSystemService(POWER_SERVICE) as PowerManager
        cpuWakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ChatWork:HeyChatWork").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseCpuWakeLock() {
        val lock = cpuWakeLock
        cpuWakeLock = null
        if (lock?.isHeld == true) runCatching { lock.release() }
    }
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "ChatWork AI Assistant", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Visible notification while Hey ChatWork wake-word listening is enabled."
                setShowBadge(false)
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(message: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0, Intent(this, OfflineAiChatActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 1, Intent(this, WakeWordAssistantService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID)
            else Notification.Builder(this)
        return builder
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("ChatWork · Hey ChatWork")
            .setContentText(message)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .addAction(Notification.Action.Builder(android.R.drawable.ic_media_pause, "Stop listening", stopIntent).build())
            .build()
    }

    private fun updateNotification(message: String) {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(message))
    }

    override fun onDestroy() {
        stopAssistant()
        isRunning = false
        worker.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "com.worklyindia.aivoice.action.STOP_WAKE_ASSISTANT"
        const val PREFS = "chatwork_wake_word"
        const val KEY_ACTIVE = "active"
        const val KEY_LANGUAGE = "language"
        @Volatile var isRunning: Boolean = false
            private set
        private const val CHANNEL_ID = "chatwork_wake_assistant"
        private const val NOTIFICATION_ID = 7421
        private const val MAX_HISTORY_CHARS = 2500
        private const val COMMAND_MAX_MS = 12_000L
        private const val WAIT_FOR_COMMAND_MS = 5_000L
        private const val SILENCE_AFTER_SPEECH_MS = 1_200L
        private const val VOICE_RMS_THRESHOLD = 0.012
        private const val PLAYBACK_COOLDOWN_MS = 700L
    }
}
