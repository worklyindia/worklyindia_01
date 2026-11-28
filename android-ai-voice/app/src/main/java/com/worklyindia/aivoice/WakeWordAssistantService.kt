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
import org.json.JSONObject

/**
 * Explicitly user-started foreground microphone service.
 * All wake-word, STT, LLM and TTS processing stays on-device.
 */
class WakeWordAssistantService : Service() {
    private val running = AtomicBoolean(false)
    private val worker = Executors.newSingleThreadExecutor()
    @Volatile private var recorder: AudioRecord? = null
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
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, true)
            .putString(KEY_STATUS, STATUS_STARTING).putString(KEY_STATUS_MESSAGE, "Starting Hey ChatWork…")
            .remove(KEY_ERROR).apply()
        val notification = buildNotification("Preparing JARVIS AI and speech models…")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (error: Exception) {
            running.set(false)
            isRunning = false
            publishStatus(STATUS_ERROR, "Could not start microphone service.", error.message)
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply()
            stopSelf()
            throw error
        }
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, true).apply()
        acquireCpuWakeLock()
        worker.execute { runAssistantLoop() }
        return START_NOT_STICKY
    }

    private fun runAssistantLoop() {
        var wakeSession: WakeWordEngineFactory.Session? = null
        var speech: OfflineSpeechRecognizer? = null
        var tts: SherpaVitsTtsEngine? = null
        var audio: AudioRecord? = null
        try {
            publishStatus(STATUS_LOADING, "Checking downloaded voice and AI models…")
            check(running.get()) { "Hey ChatWork listening was stopped." }
            check(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                "Microphone permission is missing. Open ChatWork and enable Hey ChatWork again."
            }
            val jarvisConfig = JarvisSettingsStore.read(this)
            check(jarvisConfig.active) { "JARVIS is deactivated. Open JARVIS Active · Setup to activate it." }
            check(jarvisConfig.apiKey.isNotBlank()) { "Save a Groq or Google AI Studio (Gemini) API key in JARVIS Setup." }
            val sttLanguage = jarvisConfig.sttLanguage
            val ttsLanguage = jarvisConfig.ttsLanguage
            val speechManager = SpeechPackDownloadManager(this)
            val sttPack = SpeechModelCatalog.indicConformer(sttLanguage)
            val ttsPack = SpeechModelCatalog.itantraVits(ttsLanguage)
            check(OfflineSpeechEngineFactory.isReady(this, sttPack)) { "Download AI4Bharat IndicConformer ${sttLanguage.uppercase(Locale.ROOT)} first." }
            check(speechManager.snapshot(ttsPack).state == SpeechPackDownloadManager.State.COMPLETE) { "Download iTantra VITS ${ttsLanguage.uppercase(Locale.ROOT)} first." }
            check(speechManager.isModelTested(ttsPack)) { "Test iTantra VITS ${ttsLanguage.uppercase(Locale.ROOT)} before activation." }
            val wakePack = SpeechModelCatalog.chatWorkWakeWord()
            check(WakeWordEngineFactory.isReady(this) && speechManager.isModelTested(wakePack)) { "Download and test the Hey ChatWork wake-word model first." }
            publishStatus(STATUS_LOADING, "Testing ${jarvisConfig.provider.uppercase(Locale.ROOT)} AI connection…")
            JarvisSettingsStore.generateReply(this, "Reply with exactly READY.", jarvisConfig)
            check(running.get()) { "Hey ChatWork listening was stopped." }

            publishStatus(STATUS_LOADING, "Loading AI4Bharat IndicConformer ${sttLanguage.uppercase(Locale.ROOT)}…")
            val activeSpeechRecognizer = OfflineSpeechEngineFactory.openIndicConformer(this, sttLanguage)
            speech = activeSpeechRecognizer
            check(running.get()) { "Hey ChatWork listening was stopped." }
            publishStatus(STATUS_LOADING, "Loading iTantra VITS ${ttsLanguage.uppercase(Locale.ROOT)} voice output…")
            val activeTtsEngine = SherpaVitsTtsEngine.create(this, ttsPack)
            tts = activeTtsEngine
            check(running.get()) { "Hey ChatWork listening was stopped." }
            publishStatus(STATUS_LOADING, "Loading Hey ChatWork wake-word model…")
            val activeWakeSession = WakeWordEngineFactory.open(this)
            wakeSession = activeWakeSession
            check(running.get()) { "Hey ChatWork listening was stopped." }

            var activeAudio = createWakeWordRecorder()
            audio = activeAudio
            publishStatus(STATUS_LISTENING, "Listening for ${WakeWordEngineFactory.WAKE_PHRASE} · STT ${sttLanguage.uppercase(Locale.ROOT)} · TTS ${ttsLanguage.uppercase(Locale.ROOT)}")

            val history = StringBuilder()
            history.append("System: You are JARVIS, ChatWork’s calm, concise voice assistant. Understand Hindi, Hinglish, Gujarati and English. Reply naturally in the user’s language, keep spoken answers clear and brief, and ask before any consequential action. You cannot control phone settings, read private device data, or perform actions outside this conversation.\n")
            val buffer = ShortArray(1600)
            val session = activeWakeSession
            while (running.get()) {
                val count = activeAudio.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
                if (count < 0) {
                    // Android can invalidate AudioRecord after an input-route change,
                    // Bluetooth handoff or temporary microphone interruption. Recover
                    // the recorder in-place instead of ending the always-on assistant.
                    updateNotification("Microphone interrupted · reconnecting…")
                    publishStatus(STATUS_LOADING, "Reconnecting the microphone…")
                    runCatching { if (activeAudio.recordingState == AudioRecord.RECORDSTATE_RECORDING) activeAudio.stop() }
                    runCatching { activeAudio.release() }
                    recorder = null
                    var replacement: AudioRecord? = null
                    var lastFailure: Exception? = null
                    for (attempt in 1..5) {
                        if (!running.get()) break
                        try {
                            Thread.sleep(350L * attempt)
                            replacement = createWakeWordRecorder()
                            break
                        } catch (failure: Exception) {
                            lastFailure = failure
                        }
                    }
                    activeAudio = replacement ?: throw IllegalStateException(
                        "Microphone could not reconnect after 5 attempts: ${lastFailure?.message ?: "recording was interrupted"}"
                    )
                    audio = activeAudio
                    publishStatus(STATUS_LISTENING, "Listening for ${WakeWordEngineFactory.WAKE_PHRASE} · ${sttLanguage.uppercase(Locale.ROOT)} · On-device")
                    continue
                }
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
                                updateNotification("JARVIS is thinking with ${jarvisConfig.provider.uppercase(Locale.ROOT)}…")
                                val answer = JarvisSettingsStore.generateReply(this, history.toString(), jarvisConfig)
                                history.append("Assistant: ").append(answer).append("\n")
                                if (history.length > MAX_HISTORY_CHARS) history.delete(0, history.length - MAX_HISTORY_CHARS)
                                updateNotification("Speaking with iTantra VITS · ${ttsLanguage.uppercase(Locale.ROOT)}")
                                activeTtsEngine.speak(answer)
                                discardPlaybackAudio(activeAudio, buffer)
                            } else {
                                updateNotification("No speech recognized · Listening for Hey ChatWork")
                            }
                        } else {
                            updateNotification("No command heard · Listening for Hey ChatWork")
                        }
                        session.spotter.reset(session.stream)
                        updateNotification("Listening for ${WakeWordEngineFactory.WAKE_PHRASE} · ${sttLanguage.uppercase(Locale.ROOT)} · On-device")
                    }
                }
            }
        } catch (error: Exception) {
            if (running.get()) publishStatus(STATUS_ERROR,
                "Assistant stopped · ${error.message ?: "Model or microphone error"}",
                error.message ?: error.javaClass.simpleName)
            // Keep the foreground notification visible on startup/runtime failure.
            // The notification reports the real error and offers an explicit Stop action;
            // never leave a failed microphone session looking like active listening.
            running.set(false)
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply()
            JarvisSettingsStore.setActive(this, false)
            isRunning = false
        } finally {
            running.set(false)
            recorder = null
            runCatching { if (audio?.recordingState == AudioRecord.RECORDSTATE_RECORDING) audio.stop() }
            runCatching { audio?.release() }
            runCatching { wakeSession?.close() }
            runCatching { speech?.close() }
            runCatching { tts?.close() }
            releaseCpuWakeLock()
            JarvisSettingsStore.setActive(this, false)
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply()
            if (getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_STATUS, null) != STATUS_ERROR) {
                publishStatus(STATUS_STOPPED, "Hey ChatWork is stopped.")
            }
            isRunning = false
        }
    }

    /** Create and start a fresh 16 kHz voice-recognition recorder. */
    private fun createWakeWordRecorder(): AudioRecord {
        check(running.get()) { "Hey ChatWork listening was stopped." }
        check(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            "Microphone permission was revoked while Hey ChatWork was active."
        }
        val minBuffer = AudioRecord.getMinBufferSize(
            WakeWordEngineFactory.SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        check(minBuffer > 0) { "This phone does not support 16 kHz microphone input (AudioRecord=$minBuffer)." }
        val next = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            WakeWordEngineFactory.SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minBuffer * 2, 6400)
        )
        try {
            check(next.state == AudioRecord.STATE_INITIALIZED) { "Could not initialize the microphone (state=${next.state})." }
            next.startRecording()
            check(next.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "Android did not start microphone recording." }
            recorder = next
            return next
        } catch (failure: Exception) {
            runCatching { next.release() }
            throw failure
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
        JarvisSettingsStore.setActive(this, false)
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

    private fun publishStatus(state: String, message: String, error: String? = null) {
        val editor = getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString(KEY_STATUS, state).putString(KEY_STATUS_MESSAGE, message)
        if (error != null) editor.putString(KEY_ERROR, error)
        else if (state != STATUS_ERROR) editor.remove(KEY_ERROR)
        editor.apply()
        runCatching { updateNotification(message) }
    }

    private fun updateNotification(message: String) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_STATUS_MESSAGE, message).apply()
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(message))
    }

    override fun onDestroy() {
        stopAssistant()
        // Let the worker finish its native unload before publishing isRunning=false in finally.
        worker.shutdown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "com.worklyindia.aivoice.action.STOP_WAKE_ASSISTANT"
        const val PREFS = "chatwork_wake_word"
        const val KEY_ACTIVE = "active"
        const val KEY_LANGUAGE = "language"
        const val KEY_STATUS = "assistant_status"
        const val KEY_STATUS_MESSAGE = "assistant_status_message"
        const val KEY_ERROR = "assistant_last_error"
        const val STATUS_STARTING = "STARTING"
        const val STATUS_LOADING = "LOADING_MODELS"
        const val STATUS_LISTENING = "LISTENING"
        const val STATUS_ERROR = "ERROR"
        const val STATUS_STOPPED = "STOPPED"
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
