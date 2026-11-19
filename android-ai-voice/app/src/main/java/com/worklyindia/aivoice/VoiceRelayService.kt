package com.worklyindia.aivoice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

class VoiceRelayService : Service(), TextToSpeech.OnInitListener {
    private val running = AtomicBoolean(false)
    @Volatile private var ttsReady = false
    @Volatile private var activeJobId: String? = null
    @Volatile private var activeAudioFile: File? = null
    private var tts: TextToSpeech? = null
    private var pollThread: Thread? = null
    private var activeToken: String? = null
    private var relayWakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        tts = TextToSpeech(this, this)
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                setStatus("Generating voice audio for a website user…")
            }
            override fun onDone(utteranceId: String?) {
                val jobId = utteranceId ?: return
                val token = activeToken ?: return
                val audioFile = activeAudioFile
                Thread {
                    try {
                        if (audioFile == null || !audioFile.isFile || audioFile.length() == 0L) {
                            throw IllegalStateException("Android did not create the voice audio file.")
                        }
                        VoiceRelayApi.uploadAudio(token, jobId, audioFile.readBytes())
                        setStatus("Voice audio delivered to website user. Processing next request…")
                    } catch (error: Exception) {
                        runCatching { VoiceRelayApi.fail(token, jobId, error.message ?: "Voice audio upload failed.") }
                        setStatus("Could not deliver voice audio: " + (error.message ?: "network error"))
                    } finally {
                        audioFile?.delete()
                        activeAudioFile = null
                        activeJobId = null
                    }
                }.start()
            }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                val jobId = utteranceId ?: return
                val token = activeToken ?: return
                Thread {
                    runCatching { VoiceRelayApi.fail(token, jobId, "Android offline text-to-speech synthesis failed.") }
                    activeAudioFile?.delete()
                    activeAudioFile = null
                    activeJobId = null
                    setStatus("A voice request failed on this phone.")
                }.start()
            }
        })
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val token = SecureDeviceTokenStore.read(this)
        if (token.isNullOrBlank()) {
            setStatus("Phone server stopped: connect the owner account first.")
            stopSelf()
            return START_NOT_STICKY
        }
        activeToken = token
        startForeground(NOTIFICATION_ID, buildNotification("Connecting to secure relay…"))
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

    private fun pollLoop(token: String) {
        setStatus("Connecting to Supabase relay…")
        while (running.get()) {
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
                setStatus("Transcribing caller audio on Workly Voice…")
                val audio = VoiceRelayApi.downloadAudio(audioUrl)
                val result = VoiceRelayApi.transcribe(token, audio)
                val transcript = result.optString("text").trim()
                if (transcript.isBlank()) throw IllegalStateException("No speech was detected in the caller audio.")
                VoiceRelayApi.complete(token, jobId, JSONObject()
                    .put("text", transcript.take(4000))
                    .put("languageTag", result.optString("detected_language", "auto")))
                setStatus("Caller speech transcribed by Workly Voice. Waiting for next request…")
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

    private fun handleTtsJob(token: String, jobId: String, payload: JSONObject) {
        if (activeJobId != null) {
            VoiceRelayApi.fail(token, jobId, "Phone is already processing another voice request.")
            return
        }
        activeJobId = jobId
        val text = payload.optString("text").trim()
        if (text.isEmpty()) {
            VoiceRelayApi.fail(token, jobId, "TTS request has no text.")
            activeJobId = null
            return
        }
        if (!ttsReady) {
            VoiceRelayApi.fail(token, jobId, "Android text-to-speech engine is not ready.")
            activeJobId = null
            return
        }
        val tag = payload.optString("language", "hi-IN")
        val locale = Locale.forLanguageTag(tag)
        val engine = tts ?: run {
            VoiceRelayApi.fail(token, jobId, "Android text-to-speech engine is unavailable.")
            activeJobId = null
            return
        }
        val matchingVoices = engine.voices
            ?.filter { voice -> voice.locale.language == locale.language }
            .orEmpty()
        // Prefer an online voice for natural cloud-connected call audio, while
        // retaining an installed offline voice as a resilience option.
        // Prefer an installed on-device voice for low-latency calls.
        // Use a network voice only when no offline voice exists for this language.
        val selectedVoice = matchingVoices
            .maxByOrNull { voice ->
                (if (voice.locale == locale) 2 else 1) + (if (!voice.isNetworkConnectionRequired) 4 else 0)
            }
        if (selectedVoice == null) {
            VoiceRelayApi.fail(token, jobId, "No installed Android TTS voice is available for $tag. Install a Hindi, Gujarati or English voice in Android language settings.")
            activeJobId = null
            return
        }
        engine.voice = selectedVoice
        val outputFile = File(cacheDir, "workly-voice-" + jobId + ".wav")
        activeAudioFile?.delete()
        activeAudioFile = outputFile
        val result = engine.synthesizeToFile(text.take(1000), Bundle(), outputFile, jobId)
        if (result == TextToSpeech.ERROR) {
            VoiceRelayApi.fail(token, jobId, "Android could not synthesize voice audio.")
            outputFile.delete()
            activeAudioFile = null
            activeJobId = null
        }
    }

    override fun onInit(status: Int) {
        ttsReady = status == TextToSpeech.SUCCESS
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
        tts?.stop()
        tts?.shutdown()
        if (relayWakeLock?.isHeld == true) relayWakeLock?.release()
        relayWakeLock = null
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
        val cutoff = System.currentTimeMillis() - 3_600_000L
        for (i in 0 until events.length()) {
            val item = events.optJSONObject(i) ?: continue
            if (item.optLong("at") >= cutoff) trimmed.put(item)
        }
        prefs.edit().putString(EVENTS_KEY, trimmed.toString()).apply()
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(message))
    }

    private fun buildNotification(message: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Workly Voice server")
            .setContentText(message.take(120))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Workly Voice server", NotificationManager.IMPORTANCE_LOW).apply {
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
    }
}
