package com.worklyindia.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class ChargingMonitorService : Service() {
    private var batteryReceiverRegistered = false
    private var alertRingtone: Ringtone? = null
    private var chargingTts: TextToSpeech? = null
    private var chargingTtsInitializing = false
    @Volatile private var serviceDestroyed = false

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_BATTERY_CHANGED) handleBatteryChanged(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannels()
        startForeground(MONITOR_NOTIFICATION_ID, buildMonitorNotification())
        registerBatteryReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopAlertAlarm()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_POWER_DISCONNECTED -> {
                resetChargeCycleAndStopAlert()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_ACKNOWLEDGE -> {
                acknowledgeAlert()
                return START_STICKY
            }
        }
        resumeAlarmIfNeeded()
        readCurrentBatteryState()
        return START_STICKY
    }

    private fun registerBatteryReceiver() {
        if (batteryReceiverRegistered) return
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val sticky = if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(batteryReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(batteryReceiver, filter)
        }
        batteryReceiverRegistered = true
        sticky?.let(::handleBatteryChanged)
    }

    private fun readCurrentBatteryState() {
        val sticky = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        sticky?.let(::handleBatteryChanged)
    }

    private fun handleBatteryChanged(intent: Intent) {
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100).coerceAtLeast(1)
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val percent = if (level >= 0) (level * 100 / scale) else -1
        val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL ||
            (plugged && status != BatteryManager.BATTERY_STATUS_DISCHARGING)

        // Keep the ongoing foreground notification current for the lock screen
        // and notification shade, even while the app UI is closed.
        getSystemService(NotificationManager::class.java)
            .notify(MONITOR_NOTIFICATION_ID, buildMonitorNotification(percent, charging))

        // A charger connected at 100% (or Android's FULL status) must not
        // trigger the charging-start voice. Consume the pending announcement
        // so a later battery snapshot cannot play it unexpectedly.
        if (charging && (percent >= 100 || status == BatteryManager.BATTERY_STATUS_FULL)) {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, false)
                .apply()
        } else if (charging && percent in 0..99) {
            playChargingStartAnnouncementOnce()
        }
        if (charging && percent >= 100) {
            showChargeCompleteAlert()
        }
        // Do not reset the charge cycle from a possibly stale BATTERY_CHANGED
        // snapshot. ACTION_POWER_DISCONNECTED is the authoritative unplug edge.
    }

    private fun resetChargeCycleAndStopAlert() {
        stopAlertAlarm()
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ALERTED, false)
            .putBoolean(KEY_ACKNOWLEDGED, false)
            .apply()
        getSystemService(NotificationManager::class.java).cancel(ALERT_NOTIFICATION_ID)
    }

    /**
     * Uses Android's own TextToSpeech engine. Prefer an installed offline
     * English voice, but allow the engine's English fallback if needed.
     * A transient initialization/speech error must never permanently disable
     * TTS for future charging sessions.
     */
    private fun playChargingStartAnnouncementOnce() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_START_ANNOUNCEMENT_PENDING, false) ||
            prefs.getBoolean(KEY_STARTED_ANNOUNCED, false) ||
            chargingTts != null || chargingTtsInitializing
        ) return

        chargingTtsInitializing = true
        try {
            chargingTts = TextToSpeech(applicationContext) { status ->
                chargingTtsInitializing = false
                val engine = chargingTts
                if (status != TextToSpeech.SUCCESS || engine == null || serviceDestroyed) {
                    android.util.Log.e(TAG, "TextToSpeech initialization failed: status=$status")
                    prefs.edit()
                        .putBoolean(KEY_STARTED_ANNOUNCED, false)
                        .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, true)
                        .putBoolean(KEY_TTS_UNAVAILABLE, false)
                        .apply()
                    engine?.shutdown()
                    if (chargingTts === engine) chargingTts = null
                    return@TextToSpeech
                }

                runCatching {
                    val englishVoices = engine.voices.orEmpty().filter {
                        it.locale.language.equals("en", ignoreCase = true)
                    }
                    val preferredVoice = englishVoices.firstOrNull {
                        it.locale.country.equals("IN", ignoreCase = true) &&
                            !it.isNetworkConnectionRequired
                    } ?: englishVoices.firstOrNull {
                        !it.isNetworkConnectionRequired
                    } ?: englishVoices.firstOrNull {
                        it.locale.country.equals("IN", ignoreCase = true)
                    } ?: englishVoices.firstOrNull()

                    val languageResult = if (preferredVoice != null) {
                        engine.setVoice(preferredVoice)
                        engine.setLanguage(preferredVoice.locale)
                    } else {
                        engine.setLanguage(java.util.Locale("en", "IN")).let { result ->
                            if (result == TextToSpeech.LANG_MISSING_DATA ||
                                result == TextToSpeech.LANG_NOT_SUPPORTED
                            ) engine.setLanguage(java.util.Locale.US) else result
                        }
                    }

                    if (languageResult == TextToSpeech.LANG_MISSING_DATA ||
                        languageResult == TextToSpeech.LANG_NOT_SUPPORTED
                    ) {
                        android.util.Log.e(TAG, "No usable English TTS language data; install an English voice in Android Text-to-speech settings")
                        prefs.edit()
                            .putBoolean(KEY_STARTED_ANNOUNCED, false)
                            .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, true)
                            .putBoolean(KEY_TTS_UNAVAILABLE, false)
                            .apply()
                        engine.shutdown()
                        if (chargingTts === engine) chargingTts = null
                        return@runCatching
                    }

                    engine.setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    engine.setSpeechRate(1.0f)
                    engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {
                            prefs.edit()
                                .putBoolean(KEY_STARTED_ANNOUNCED, true)
                                .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, false)
                                .putBoolean(KEY_TTS_UNAVAILABLE, false)
                                .apply()
                            android.util.Log.i(TAG, "Charging-start TTS speech started")
                        }

                        override fun onDone(utteranceId: String?) {
                            android.util.Log.i(TAG, "Charging-start TTS completed")
                            engine.shutdown()
                            if (chargingTts === engine) chargingTts = null
                        }

                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            handleChargingTtsError(engine, prefs, "TTS utterance failed")
                        }

                        override fun onError(utteranceId: String?, errorCode: Int) {
                            handleChargingTtsError(engine, prefs, "TTS utterance failed: $errorCode")
                        }
                    })

                    val result = engine.speak(
                        "Charging started",
                        TextToSpeech.QUEUE_FLUSH,
                        Bundle(),
                        "workly-charging-start"
                    )
                    if (result == TextToSpeech.ERROR) {
                        handleChargingTtsError(engine, prefs, "TextToSpeech.speak returned ERROR")
                    }
                }.onFailure { error ->
                    android.util.Log.e(TAG, "Could not configure or start charging TTS", error)
                    handleChargingTtsError(engine, prefs, "TTS setup exception")
                }
            }
        } catch (error: Exception) {
            chargingTtsInitializing = false
            android.util.Log.e(TAG, "Could not create TextToSpeech engine", error)
            prefs.edit()
                .putBoolean(KEY_STARTED_ANNOUNCED, false)
                .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, true)
                .putBoolean(KEY_TTS_UNAVAILABLE, false)
                .apply()
            chargingTts?.shutdown()
            chargingTts = null
        }
    }

    private fun handleChargingTtsError(
        engine: TextToSpeech,
        prefs: android.content.SharedPreferences,
        reason: String
    ) {
        android.util.Log.e(TAG, reason)
        prefs.edit()
            .putBoolean(KEY_STARTED_ANNOUNCED, false)
            .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, true)
            .putBoolean(KEY_TTS_UNAVAILABLE, false)
            .apply()
        runCatching { engine.stop() }
        engine.shutdown()
        if (chargingTts === engine) chargingTts = null
    }

    private fun stopChargingStartPlayback() {
        runCatching { chargingTts?.stop() }
        runCatching { chargingTts?.shutdown() }
        chargingTts = null
        chargingTtsInitializing = false
    }

    private fun showChargeCompleteAlert() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_ALERTED, false)) return

        val notificationManager = getSystemService(NotificationManager::class.java)
        val notificationsEnabled = NotificationManagerCompat.from(this).areNotificationsEnabled()
        val channelEnabled = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            notificationManager.getNotificationChannel(ALERT_CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE

        if (!notificationsEnabled) {
            android.util.Log.w(TAG, "Full-charge notification unavailable: app notifications are disabled; alarm will still be attempted")
        } else if (!channelEnabled) {
            android.util.Log.w(TAG, "Full-charge notification unavailable: battery alert channel is disabled; alarm will still be attempted")
        } else {
            val openIntent = Intent(this, ChargingCompleteActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            val alertActivityPendingIntent = PendingIntent.getActivity(
                this, ALERT_REQUEST_CODE, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val stopIntent = Intent(this, NotificationActionReceiver::class.java).apply {
                action = NotificationActionReceiver.ACTION_ACK_CHARGING_ALERT
            }
            val stopPendingIntent = PendingIntent.getBroadcast(
                this, STOP_ALERT_REQUEST_CODE, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notificationBuilder = NotificationCompat.Builder(this, ALERT_CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_workly)
                .setContentTitle("100% BATTERY")
                .setContentText("Your battery is fully charged!")
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(alertActivityPendingIntent)
                .addAction(R.drawable.ic_stat_workly, "OK, GOT IT", stopPendingIntent)
                .setAutoCancel(false)
                .setOngoing(true)

            if (Build.VERSION.SDK_INT < 34 || notificationManager.canUseFullScreenIntent()) {
                notificationBuilder.setFullScreenIntent(alertActivityPendingIntent, true)
            } else {
                android.util.Log.w(TAG, "Full-screen access is off; Android will show the regular battery notification")
            }

            runCatching {
                notificationManager.notify(ALERT_NOTIFICATION_ID, notificationBuilder.build())
            }.onFailure {
                android.util.Log.e(TAG, "Could not post full-charge notification", it)
            }
        }

        // Do not let a disabled notification channel suppress the independent alarm sound.
        prefs.edit().putBoolean(KEY_ALERTED, true).putBoolean(KEY_ACKNOWLEDGED, false).apply()
        startAlarmLoop()
    }

    private fun startAlarmLoop() {
        if (alertRingtone?.isPlaying == true) return
        stopAlertAlarm()
        runCatching {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            if (uri == null) {
                android.util.Log.w(TAG, "No alarm, ringtone, or notification sound is configured on this device")
                return@runCatching
            }
            alertRingtone = RingtoneManager.getRingtone(this, uri)?.apply {
                // Alarm usage is independent of the normal ringtone/notification stream,
                // so the alert can sound when the phone's ringer mode is Silent.
                // Android Do Not Disturb policies may still suppress alarms.
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) isLooping = true
                play()
            }
        }.onFailure { android.util.Log.e(TAG, "Could not start repeating battery alarm", it) }
    }

    private fun resumeAlarmIfNeeded() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_ALERTED, false) && !prefs.getBoolean(KEY_ACKNOWLEDGED, false)) {
            startAlarmLoop()
        }
    }

    private fun stopAlertAlarm() {
        runCatching { alertRingtone?.stop() }
        alertRingtone = null
    }

    private fun acknowledgeAlert() {
        stopAlertAlarm()
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACKNOWLEDGED, true).apply()
        getSystemService(NotificationManager::class.java).cancel(ALERT_NOTIFICATION_ID)
    }

    private fun buildMonitorNotification(percent: Int = -1, charging: Boolean = true): Notification {
        val openIntent = PendingIntent.getActivity(
            this, MONITOR_REQUEST_CODE, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val statusText = when {
            percent in 0..100 && charging -> "Charging • $percent% • Monitoring active"
            percent in 0..100 -> "Charging paused • $percent% • Monitoring active"
            else -> "Checking charging status…"
        }
        return NotificationCompat.Builder(this, MONITOR_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_workly)
            .setContentTitle("Workly charging monitor")
            .setContentText(statusText)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPublicVersion(
                NotificationCompat.Builder(this, MONITOR_CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat_workly)
                    .setContentTitle("Workly charging monitor")
                    .setContentText(statusText)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .build()
            )
            .setContentIntent(openIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .build()
    }

    private fun createChannels() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(MONITOR_CHANNEL, "Charging monitor", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Shows live charging status on the lock screen and notification shade"
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    setShowBadge(false)
                    setSound(null, null)
                }
            )
            manager.createNotificationChannel(
                NotificationChannel(ALERT_CHANNEL, "Battery fully charged", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Repeating alarm and persistent notification when the phone reaches 100% while charging"
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 500, 300, 500, 300, 500)
                    setSound(null, null)
                }
            )
        }
    }

    override fun onDestroy() {
        serviceDestroyed = true
        stopChargingStartPlayback()
        stopAlertAlarm()
        if (batteryReceiverRegistered) runCatching { unregisterReceiver(batteryReceiver) }
        batteryReceiverRegistered = false
        getSystemService(NotificationManager::class.java).cancel(MONITOR_NOTIFICATION_ID)
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // When the user swipes Workly India away from Android Recents, treat it
        // as a deliberate force-close: next manual launch starts at website Home.
        // Ordinary backgrounding/locking does not remove this saved route.
        getSharedPreferences("workly_navigation", Context.MODE_PRIVATE)
            .edit()
            .remove("last_route")
            .apply()
        super.onTaskRemoved(rootIntent)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val PREFS = "workly_charging_alert"
        const val KEY_ALERTED = "alerted_this_charge"
        const val KEY_ACKNOWLEDGED = "alert_acknowledged"
        const val KEY_STARTED_ANNOUNCED = "charging_start_announced"
        const val KEY_START_ANNOUNCEMENT_PENDING = "charging_start_announcement_pending"
        const val KEY_TTS_UNAVAILABLE = "charging_offline_tts_unavailable"
        const val ACTION_START = "com.worklyindia.app.CHARGING_MONITOR_START"
        const val ACTION_STOP = "com.worklyindia.app.CHARGING_MONITOR_STOP"
        const val ACTION_ACKNOWLEDGE = "com.worklyindia.app.CHARGING_ALERT_ACKNOWLEDGE"
        const val ACTION_POWER_DISCONNECTED = "com.worklyindia.app.CHARGING_POWER_DISCONNECTED"
        private const val TAG = "WorklyCharging"
        private const val MONITOR_CHANNEL = "workly_charging_monitor"
        const val ALERT_CHANNEL = "workly_battery_full_alert"
        const val MONITOR_NOTIFICATION_ID = 8210
        const val ALERT_NOTIFICATION_ID = 8211
        private const val MONITOR_REQUEST_CODE = 8212
        private const val ALERT_REQUEST_CODE = 8213
        private const val STOP_ALERT_REQUEST_CODE = 8214
    }
}
