package com.worklyindia.aivoice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

class VoiceRelayService : Service(), TextToSpeech.OnInitListener {
    private val running = AtomicBoolean(false)
    @Volatile private var ttsReady = false
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
                setStatus("Speaking a website voice request on this phone…")
            }
            override fun onDone(utteranceId: String?) {
                val jobId = utteranceId ?: return
                val token = activeToken ?: return
                Thread {
                    try {
                        VoiceRelayApi.complete(
                            token,
                            jobId,
                            JSONObject().put("played_on_phone", true)
                                .put("message", "Text was spoken by this phone. No audio file was uploaded.")
                        )
                        setStatus("Phone server is online. Last voice request completed.")
                    } catch (error: Exception) {
                        setStatus("Could not report completed voice request: ${error.message ?: "network error"}")
                    }
                }.start()
            }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                val jobId = utteranceId ?: return
                val token = activeToken ?: return
                Thread {
                    runCatching { VoiceRelayApi.fail(token, jobId, "Android text-to-speech playback failed.") }
                    setStatus("A voice request failed on this phone.")
                }.start()
            }
        })
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val token = SecureDeviceTokenStore.read(this)
        if (token.isNullOrBlank()) {
            setStatus("Phone server stopped: pair this phone first.")
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
                val response = VoiceRelayApi.poll(token)
                val job = response.optJSONObject("job")
                if (job != null) {
                    val jobId = job.optString("id")
                    when (job.optString("job_type")) {
                        "tts" -> handleTtsJob(token, jobId, job.optJSONObject("payload") ?: JSONObject())
                        "stt" -> runCatching {
                            VoiceRelayApi.fail(
                                token,
                                jobId,
                                "Remote audio-file speech-to-text is not implemented yet. The current app microphone recognizer is local to this phone."
                            )
                        }
                        else -> runCatching { VoiceRelayApi.fail(token, jobId, "Unsupported voice job type.") }
                    }
                } else {
                    setStatus("Phone server is online. Waiting for a website request…")
                }
            } catch (error: Exception) {
                if (error is RelayApiException && error.statusCode == 401) {
                    SecureDeviceTokenStore.clear(this)
                    setStatus("Phone access was revoked or the device token is invalid. Pair this phone again.")
                    running.set(false)
                    stopSelf()
                    break
                }
                setStatus("Relay reconnecting: ${error.message ?: "network unavailable"}")
            }
            try { Thread.sleep(POLL_INTERVAL_MS) } catch (_: InterruptedException) { break }
        }
    }

    private fun handleTtsJob(token: String, jobId: String, payload: JSONObject) {
        val text = payload.optString("text").trim()
        if (text.isEmpty()) {
            VoiceRelayApi.fail(token, jobId, "TTS request has no text.")
            return
        }
        if (!ttsReady) {
            VoiceRelayApi.fail(token, jobId, "Android text-to-speech engine is not ready.")
            return
        }
        val tag = payload.optString("language", "hi-IN")
        val locale = Locale.forLanguageTag(tag)
        val engine = tts ?: run {
            VoiceRelayApi.fail(token, jobId, "Android text-to-speech engine is unavailable.")
            return
        }
        if (engine.isLanguageAvailable(locale) < TextToSpeech.LANG_AVAILABLE) {
            VoiceRelayApi.fail(token, jobId, "This phone has no installed TTS voice for $tag.")
            return
        }
        engine.setLanguage(locale)
        engine.speak(text.take(1000), TextToSpeech.QUEUE_ADD, null, jobId)
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
        getSharedPreferences(STATUS_PREFS, MODE_PRIVATE).edit().putString(STATUS_KEY, value).apply()
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(value))
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
        const val POLL_INTERVAL_MS = 15_000L
    }
}
