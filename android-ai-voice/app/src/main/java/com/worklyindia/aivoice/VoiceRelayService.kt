package com.worklyindia.aivoice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.util.Locale
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

class VoiceRelayService : Service() {
    private val running = AtomicBoolean(false)
    @Volatile private var activeJobId: String? = null
    @Volatile private var activeAudioFile: File? = null
    private val speechManager by lazy { SpeechPackDownloadManager(this) }
    // Keep the 295 MB Kokoro runtime alive between website jobs. Recreating it
    // for every request forces the model to reload and makes Hindi/English slow.
    @Volatile private var kokoroTtsEngine: KokoroTtsEngine? = null
    private var pollThread: Thread? = null
    private var activeToken: String? = null
    private var relayWakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val token = SecureDeviceTokenStore.read(this)
        if (token.isNullOrBlank()) {
            setStatus("Phone server stopped: connect the owner account first.")
            stopSelf()
            return START_NOT_STICKY
        }
        activeToken = token
        val initialStatus = currentConnectionNotificationText()
        startForeground(NOTIFICATION_ID, buildNotification(initialStatus))
        if (initialStatus == "Waiting for Data on…") setStatus(initialStatus)
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        relayWakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:WorklyVoiceRelay").apply {
            setReferenceCounted(false)
            acquire()
        }
        if (running.compareAndSet(false, true)) {
            pollThread = Thread { pollLoop(token) }.apply {
                name = "WorklyVoiceRelay"
                start()
            }
        }
        return START_STICKY
    }

    private fun hasValidatedInternet(): Boolean {
        val manager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun pollLoop(token: String) {
        setStatus(if (hasValidatedInternet()) "Connecting to Supabase relay…" else "Waiting for Data on…")
        var wasWaitingForData = !hasValidatedInternet()
        while (running.get()) {
            if (!hasValidatedInternet()) {
                wasWaitingForData = true
                setStatus("Waiting for Data on…")
                try { Thread.sleep(POLL_INTERVAL_MS) } catch (_: InterruptedException) { break }
                continue
            }
            if (wasWaitingForData) {
                wasWaitingForData = false
                setStatus("Shared phone server is online")
            }
            try {
                if (activeJobId != null) {
                    Thread.sleep(500)
                    continue
                }
                val response = VoiceRelayApi.poll(token)
                getSharedPreferences(STATUS_PREFS, MODE_PRIVATE).edit().putLong(LAST_POLL_KEY, System.currentTimeMillis()).apply()
                val job = response.optJSONObject("job")
                if (job != null) {
                    val jobId = job.optString("id")
                    recordEvent("Website request", "Received " + job.optString("job_type").uppercase(Locale.ROOT) + " request", "Request ID: " + jobId)
                    when (job.optString("job_type")) {
                        "tts" -> handleTtsJob(token, jobId, job.optJSONObject("payload") ?: JSONObject())
                        "ai" -> handleAiJob(token, jobId, job.optJSONObject("payload") ?: JSONObject())
                        "stt" -> handleSttJob(token, jobId, job.optJSONObject("payload") ?: JSONObject())
                        else -> runCatching { VoiceRelayApi.fail(token, jobId, "Unsupported voice job type.") }
                    }
                } else {
                    setStatus("Shared phone server is online. Waiting for website requests…")
                }
            } catch (error: Exception) {
                if (error is RelayApiException && error.statusCode == 401) {
                    SecureDeviceTokenStore.clear(this)
                    setStatus("Phone access was revoked or the device token is invalid. Sign in again.")
                    running.set(false)
                    stopSelf()
                    break
                }
                setStatus("Relay reconnecting: ${error.message ?: "network unavailable"}")
            }
            try { Thread.sleep(POLL_INTERVAL_MS) } catch (_: InterruptedException) { break }
        }
    }

    private fun handleSttJob(token: String, jobId: String, payload: JSONObject) {
        if (activeJobId != null) {
            VoiceRelayApi.fail(token, jobId, "Phone is already processing another request.")
            return
        }
        activeJobId = jobId
        Thread {
            try {
                val audioUrl = payload.optString("audio_url")
                if (audioUrl.isBlank()) throw IllegalStateException("Caller audio URL is missing.")
                setStatus("Transcribing caller audio on ChatWork…")
                val audio = VoiceRelayApi.downloadAudio(audioUrl)
                val result = VoiceRelayApi.transcribe(token, audio)
                val transcript = result.optString("text").trim()
                if (transcript.isBlank()) throw IllegalStateException("No speech was detected in the caller audio.")
                VoiceRelayApi.complete(token, jobId, JSONObject()
                    .put("text", transcript.take(4000))
                    .put("languageTag", result.optString("detected_language", "auto")))
                setStatus("Caller speech transcribed by ChatWork. Waiting for next request…")
            } catch (error: Exception) {
                runCatching { VoiceRelayApi.fail(token, jobId, error.message ?: "Caller speech transcription failed.") }
                setStatus("Speech recognition failed: " + (error.message ?: "network error"))
            } finally {
                activeJobId = null
            }
        }.start()
    }

    private fun handleAiJob(token: String, jobId: String, payload: JSONObject) {
        if (activeJobId != null) {
            VoiceRelayApi.fail(token, jobId, "Phone is already processing another request.")
            return
        }
        activeJobId = jobId
        Thread {
            try {
                val request = JSONObject()
                    .put("text", payload.optString("text").take(4000))
                    .put("languageTag", payload.optString("languageTag", "auto"))
                val response = VoiceRelayApi.post("ai-voice-chat", request, deviceToken = token)
                if (response.statusCode !in 200..299) {
                    throw RelayApiException(response.statusCode, response.body.optString("error", "Online AI request failed."))
                }
                val reply = response.body.optString("reply").trim()
                if (reply.isEmpty()) throw IllegalStateException("Online AI returned an empty reply.")
                VoiceRelayApi.complete(token, jobId, JSONObject()
                    .put("reply", reply)
                    .put("languageTag", response.body.optString("languageTag", "auto")))
                setStatus("AI reply delivered to website. Waiting for next request…")
            } catch (error: Exception) {
                runCatching { VoiceRelayApi.fail(token, jobId, error.message ?: "Online AI request failed.") }
                setStatus("AI request failed: " + (error.message ?: "network error"))
            } finally {
                activeJobId = null
            }
        }.start()
    }

    /** Website Text To Voice uses only the two approved offline model families. */
    private fun handleTtsJob(token: String, jobId: String, payload: JSONObject) {
        if (activeJobId != null) {
            VoiceRelayApi.fail(token, jobId, "Phone is already processing another voice request.")
            return
        }
        activeJobId = jobId
        Thread {
            val outputFile = File(cacheDir, "workly-voice-$jobId.wav")
            activeAudioFile = outputFile
            try {
                val text = payload.optString("text").trim()
                require(text.isNotEmpty()) { "TTS request has no text." }
                val languageTag = payload.optString("language", "hi-IN")
                val language = Locale.forLanguageTag(languageTag).language
                val voiceId = payload.optString("voice").trim()
                val requestedModel = payload.optString("model").trim().ifBlank {
                    if (language == "gu") "indic" else "kokoro"
                }
                outputFile.delete()
                when (language) {
                    "gu" -> {
                        require(requestedModel == "indic") {
                            "Gujarati is currently available through Indic Tiny TTS. Select Indic Tiny TTS for Gujarati."
                        }
                        val pack = SpeechModelCatalog.indicTinyTts("gu")
                        check(speechManager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
                            "Indic Tiny TTS Gujarati is not downloaded. Download it from ChatWork → Model Downloads."
                        }
                        val selectedVoice = voiceId.ifBlank { "female" }
                        check(selectedVoice == "female" || selectedVoice == "male") {
                            "Selected Gujarati voice is not available in Indic Tiny TTS."
                        }
                        IndicTinyTtsEngine.create(this, "gu").use { engine ->
                            engine.synthesizeToWav(text, outputFile, selectedVoice)
                        }
                    }
                    "hi", "en" -> {
                        require(requestedModel == "kokoro") {
                            "Hindi and English are currently available through Kokoro-82M. Select Kokoro-82M for these languages."
                        }
                        val pack = SpeechModelCatalog.kokoro82m()
                        check(speechManager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
                            "Kokoro-82M is not downloaded. Download it from ChatWork → Model Downloads."
                        }
                        val defaultVoice = if (language == "hi") "hf_alpha" else "af_heart"
                        val selectedVoice = voiceId.ifBlank { defaultVoice }
                        val engine = kokoroTtsEngine ?: synchronized(this@VoiceRelayService) {
                            kokoroTtsEngine ?: KokoroTtsEngine(this@VoiceRelayService).also { kokoroTtsEngine = it }
                        }
                        engine.synthesizeToWav(
                            pack = pack,
                            modelDirectory = speechManager.modelDirectory(pack),
                            text = text,
                            voiceId = selectedVoice,
                            outputFile = outputFile
                        )
                    }
                    else -> throw IllegalArgumentException("Only Gujarati (Indic Tiny TTS), Hindi and English (Kokoro-82M) are supported.")
                }
                check(outputFile.isFile && outputFile.length() > 44L) { "The selected offline model returned empty audio." }
                VoiceRelayApi.uploadAudio(token, jobId, outputFile.readBytes())
                setStatus("Offline model voice audio delivered to website. Waiting for next request…")
            } catch (error: Exception) {
                runCatching { VoiceRelayApi.fail(token, jobId, error.message ?: "Offline TTS synthesis failed.") }
                setStatus("Voice conversion failed: " + (error.message ?: "unknown error"))
            } finally {
                outputFile.delete()
                activeAudioFile = null
                activeJobId = null
            }
        }.start()
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        running.set(false)
        pollThread?.interrupt()
        getSharedPreferences(STATUS_PREFS, MODE_PRIVATE).edit()
            .putString(STATUS_KEY, "Android stopped the phone server after its foreground-service time limit. Open the app to start it again.")
            .apply()
        stopSelf(startId)
    }

    override fun onDestroy() {
        running.set(false)
        pollThread?.interrupt()
        if (relayWakeLock?.isHeld == true) relayWakeLock?.release()
        relayWakeLock = null
        kokoroTtsEngine?.close()
        kokoroTtsEngine = null
        getSharedPreferences(STATUS_PREFS, MODE_PRIVATE).edit().putString(STATUS_KEY, "Phone server stopped.").apply()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
        else stopForeground(true)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun setStatus(value: String) {
        val prefs = getSharedPreferences(STATUS_PREFS, MODE_PRIVATE)
        val previous = prefs.getString(STATUS_KEY, null)
        prefs.edit().putString(STATUS_KEY, value).apply()
        if (previous != value) recordEvent(
            if (value.contains("failed", true) || value.contains("error", true) || value.contains("reconnect", true)) "Error / connection" else "Server status",
            value
        )
    }

    private fun recordEvent(kind: String, message: String, detail: String = "") {
        val prefs = getSharedPreferences(STATUS_PREFS, MODE_PRIVATE)
        val events = try { org.json.JSONArray(prefs.getString(EVENTS_KEY, "[]") ?: "[]") } catch (_: Exception) { org.json.JSONArray() }
        events.put(org.json.JSONObject().put("at", System.currentTimeMillis()).put("kind", kind).put("message", message).put("detail", detail).put("error", kind.contains("error", true)))
        val trimmed = org.json.JSONArray()
        val cutoff = System.currentTimeMillis() - 86_400_000L
        for (i in 0 until events.length()) {
            val item = events.optJSONObject(i) ?: continue
            if (item.optLong("at") >= cutoff) trimmed.put(item)
        }
        prefs.edit().putString(EVENTS_KEY, trimmed.toString()).apply()
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(message))
    }

    private fun currentConnectionNotificationText(): String =
        if (hasValidatedInternet()) ONLINE_NOTIFICATION_TEXT else WAITING_NOTIFICATION_TEXT

    private fun buildNotification(@Suppress("UNUSED_PARAMETER") message: String): Notification {
        val restoreIntent = Intent(this, VoiceRelayNotificationRestoreReceiver::class.java)
            .setAction(ACTION_RESTORE_NOTIFICATION)
        val restorePendingIntent = PendingIntent.getBroadcast(
            this, NOTIFICATION_ID, restoreIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("ChatWork")
            .setContentText(currentConnectionNotificationText())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setDeleteIntent(restorePendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "ChatWork server", NotificationManager.IMPORTANCE_LOW).apply {
                    setSound(null, null)
                    enableVibration(false)
                    setShowBadge(false)
                }
            )
        }
    }

    companion object {
        const val CHANNEL_ID = "workly_ai_voice_server"
        const val NOTIFICATION_ID = 6401
        const val STATUS_PREFS = "workly_ai_voice_status"
        const val STATUS_KEY = "server_status"
        const val LAST_POLL_KEY = "last_successful_relay_poll"
        const val EVENTS_KEY = "recent_activity_events"
        const val POLL_INTERVAL_MS = 1_000L
        const val ACTION_RESTORE_NOTIFICATION = "com.worklyindia.aivoice.RESTORE_SERVER_NOTIFICATION"
        const val ONLINE_NOTIFICATION_TEXT = "Shared phone server is online."
        const val WAITING_NOTIFICATION_TEXT = "Waiting for Data on..."
    }
}
