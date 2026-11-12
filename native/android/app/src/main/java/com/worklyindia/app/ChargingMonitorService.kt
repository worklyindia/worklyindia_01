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
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class ChargingMonitorService : Service() {
    private var batteryReceiverRegistered = false
    private var alertRingtone: Ringtone? = null
    private var chargingStartPlayer: MediaPlayer? = null
    private var chargingStoppedPlayer: MediaPlayer? = null
    private var fullChargeVoicePlayer: MediaPlayer? = null
    @Volatile private var serviceDestroyed = false

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_BATTERY_CHANGED) handleBatteryChanged(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannels()
        if (hasFullScreenAccess(this)) {
            startForeground(MONITOR_NOTIFICATION_ID, buildMonitorNotification())
            registerBatteryReceiver()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Monitoring is explicitly tied to Android's full-screen notification access.
        // If the user turns it off in Settings, remove every battery-protection
        // notification and stop the service instead of silently continuing.
        if (!hasFullScreenAccess(this)) {
            stopChargingStartPlayback()
            stopFullChargeVoice()
            stopAlertAlarm()
            getSystemService(NotificationManager::class.java).apply {
                cancel(MONITOR_NOTIFICATION_ID)
                cancel(ALERT_NOTIFICATION_ID)
                cancel(PROTECTION_NOTIFICATION_ID)
            }
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        when (intent?.action) {
            ACTION_STOP -> {
                stopChargingStartPlayback()
                stopFullChargeVoice()
                stopAlertAlarm()
                getSystemService(NotificationManager::class.java).apply {
                    cancel(MONITOR_NOTIFICATION_ID)
                    cancel(ALERT_NOTIFICATION_ID)
                    cancel(PROTECTION_NOTIFICATION_ID)
                }
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_POWER_DISCONNECTED -> {
                val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val hadActiveChargingSession = prefs.getBoolean(KEY_CHARGING_SESSION_ACTIVE, false)
                stopFullChargeVoice()
                stopAlertAlarm()
                if (hadActiveChargingSession) playChargingStoppedAnnouncement()
                resetChargeCycleAndStopAlert()
                readCurrentBatteryState()
                return START_STICKY
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
        stopFullChargeVoice()
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ALERTED, false)
            .putBoolean(KEY_ACKNOWLEDGED, false)
            // A new plug-in after this unplug is a fresh charging session.
            .putBoolean(KEY_CHARGING_SESSION_ACTIVE, false)
            .putBoolean(KEY_STARTED_ANNOUNCED, false)
            .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, false)
            .apply()
        getSystemService(NotificationManager::class.java).cancel(ALERT_NOTIFICATION_ID)
    }

    /**
     * Plays the bundled charging-start MP3 directly. No device TTS engine,
     * language pack, or network connection is required.
     */
    private fun playChargingStartAnnouncementOnce() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_START_ANNOUNCEMENT_PENDING, false) ||
            prefs.getBoolean(KEY_STARTED_ANNOUNCED, false) ||
            chargingStartPlayer != null
        ) return

        runCatching {
            val player = MediaPlayer.create(applicationContext, R.raw.charging_started)
                ?: throw IllegalStateException("Could not load bundled charging-start audio")
            chargingStartPlayer = player
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            player.setOnCompletionListener { completed ->
                prefs.edit()
                    .putBoolean(KEY_STARTED_ANNOUNCED, true)
                    .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, false)
                    .apply()
                android.util.Log.i(TAG, "Bundled charging-start audio completed")
                completed.release()
                if (chargingStartPlayer === completed) chargingStartPlayer = null
            }
            player.setOnErrorListener { failed, what, extra ->
                android.util.Log.e(TAG, "Bundled charging-start audio failed: what=$what extra=$extra")
                prefs.edit()
                    .putBoolean(KEY_STARTED_ANNOUNCED, false)
                    .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, true)
                    .apply()
                failed.release()
                if (chargingStartPlayer === failed) chargingStartPlayer = null
                true
            }
            player.start()
            android.util.Log.i(TAG, "Bundled charging-start MP3 playback started")
        }.onFailure { error ->
            android.util.Log.e(TAG, "Could not play bundled charging-start MP3", error)
            prefs.edit()
                .putBoolean(KEY_STARTED_ANNOUNCED, false)
                .putBoolean(KEY_START_ANNOUNCEMENT_PENDING, true)
                .apply()
            stopChargingStartPlayback()
        }
    }

    private fun stopChargingStartPlayback() {
        runCatching { chargingStartPlayer?.stop() }
        runCatching { chargingStartPlayer?.release() }
        chargingStartPlayer = null
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
        startFullChargeVoice()
    }

    /** Repeats the bundled 100% voice together with the device alarm until stopped. */
    private fun startFullChargeVoice() {
        if (fullChargeVoicePlayer?.isPlaying == true) return
        stopFullChargeVoice()
        runCatching {
            val player = MediaPlayer.create(applicationContext, R.raw.battery_fully_charged)
                ?: throw IllegalStateException("Could not load bundled full-charge audio")
            fullChargeVoicePlayer = player
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            player.isLooping = true
            player.setOnErrorListener { failed, what, extra ->
                android.util.Log.e(TAG, "Full-charge voice failed: what=$what extra=$extra")
                failed.release()
                if (fullChargeVoicePlayer === failed) fullChargeVoicePlayer = null
                true
            }
            player.start()
            android.util.Log.i(TAG, "Full-charge voice loop started")
        }.onFailure { error ->
            android.util.Log.e(TAG, "Could not play full-charge voice", error)
            stopFullChargeVoice()
        }
    }

    private fun stopFullChargeVoice() {
        runCatching { fullChargeVoicePlayer?.stop() }
        runCatching { fullChargeVoicePlayer?.release() }
        fullChargeVoicePlayer = null
    }

    /** Plays the disconnect MP3 once after a genuine active charging session ends. */
    private fun playChargingStoppedAnnouncement() {
        runCatching {
            runCatching { chargingStoppedPlayer?.stop() }
            runCatching { chargingStoppedPlayer?.release() }
            val player = MediaPlayer.create(applicationContext, R.raw.charging_stopped)
                ?: throw IllegalStateException("Could not load bundled charging-stopped audio")
            chargingStoppedPlayer = player
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            player.setOnCompletionListener { completed ->
                completed.release()
                if (chargingStoppedPlayer === completed) chargingStoppedPlayer = null
            }
            player.setOnErrorListener { failed, what, extra ->
                android.util.Log.e(TAG, "Charging-stopped audio failed: what=$what extra=$extra")
                failed.release()
                if (chargingStoppedPlayer === failed) chargingStoppedPlayer = null
                true
            }
            player.start()
            android.util.Log.i(TAG, "Charging-stopped MP3 playback started")
        }.onFailure { error ->
            android.util.Log.e(TAG, "Could not play charging-stopped MP3", error)
        }
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
            startFullChargeVoice()
        }
    }

    private fun stopAlertAlarm() {
        runCatching { alertRingtone?.stop() }
        alertRingtone = null
    }

    private fun acknowledgeAlert() {
        stopAlertAlarm()
        stopFullChargeVoice()
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACKNOWLEDGED, true).apply()
        getSystemService(NotificationManager::class.java).cancel(ALERT_NOTIFICATION_ID)
    }

    private fun buildMonitorNotification(percent: Int = -1, charging: Boolean = true): Notification {
        val openIntent = PendingIntent.getActivity(
            this, MONITOR_REQUEST_CODE, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val batteryText = if (percent in 0..100) "Monitoring Your Battery $percent%🔋" else "Monitoring Your Battery 🔋"
        val notificationTitle = "Workly India Battery Protection"
        val notificationText = batteryText
        val expandedText = batteryText
        val publicNotification = NotificationCompat.Builder(this, MONITOR_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_workly)
            .setContentTitle(notificationTitle)
            .setContentText(notificationText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(expandedText))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .build()
            .apply {
                // Keep Clear all from removing the public/lock-screen copy.
                flags = flags or Notification.FLAG_NO_CLEAR
            }

        return NotificationCompat.Builder(this, MONITOR_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_workly)
            .setContentTitle(notificationTitle)
            .setContentText(notificationText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(expandedText))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPublicVersion(publicNotification)
            .setContentIntent(openIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
            .apply {
                // Prevent accidental removal through Clear all where Android permits it.
                flags = flags or Notification.FLAG_NO_CLEAR
            }
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
        runCatching { chargingStoppedPlayer?.stop() }
        runCatching { chargingStoppedPlayer?.release() }
        chargingStoppedPlayer = null
        stopFullChargeVoice()
        stopAlertAlarm()
        if (batteryReceiverRegistered) runCatching { unregisterReceiver(batteryReceiver) }
        batteryReceiverRegistered = false
        getSystemService(NotificationManager::class.java).apply {
            cancel(MONITOR_NOTIFICATION_ID)
            cancel(ALERT_NOTIFICATION_ID)
            cancel(PROTECTION_NOTIFICATION_ID)
        }
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // When the user swipes Workly India away from Android Recents, treat it
        // as a deliberate force-close: next manual launch starts at website Home.
        // Ordinary backgrounding/locking does not remove this saved route.
        getSharedPreferences("workly_navigation", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("force_home_next_launch", true)
            .remove("last_route")
            .commit()
        super.onTaskRemoved(rootIntent)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val PREFS = "workly_charging_alert"
        const val KEY_ALERTED = "alerted_this_charge"
        const val KEY_ACKNOWLEDGED = "alert_acknowledged"
        const val KEY_STARTED_ANNOUNCED = "charging_start_announced"
        const val KEY_START_ANNOUNCEMENT_PENDING = "charging_start_announcement_pending"
        const val KEY_CHARGING_SESSION_ACTIVE = "charging_session_active"
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
        const val PROTECTION_NOTIFICATION_ID = 8209

        fun hasFullScreenAccess(context: Context): Boolean {
            return Build.VERSION.SDK_INT < 34 ||
                context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
        }

        fun stopMonitoring(context: Context) {
            context.stopService(Intent(context, ChargingMonitorService::class.java))
            context.getSystemService(NotificationManager::class.java).apply {
                cancel(MONITOR_NOTIFICATION_ID)
                cancel(ALERT_NOTIFICATION_ID)
                cancel(PROTECTION_NOTIFICATION_ID)
            }
        }
        private const val MONITOR_REQUEST_CODE = 8212
        private const val ALERT_REQUEST_CODE = 8213
        private const val STOP_ALERT_REQUEST_CODE = 8214
    }
}
