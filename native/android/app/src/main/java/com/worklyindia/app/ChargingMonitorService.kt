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
import android.media.RingtoneManager
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class ChargingMonitorService : Service() {
    private var batteryReceiverRegistered = false

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_BATTERY_CHANGED) {
                handleBatteryChanged(intent)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannels()
        startForeground(MONITOR_NOTIFICATION_ID, buildMonitorNotification())
        registerBatteryReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        // Re-check the sticky battery snapshot on every service start. This covers
        // the case where the app/service starts after charging is already at 100%.
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
        // Do not rely only on a future battery percentage change. Android's
        // ACTION_BATTERY_CHANGED is sticky; process its current value immediately.
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
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        if (charging && percent >= 100) showChargeCompleteAlert()
    }

    private fun showChargeCompleteAlert() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_ALERTED, false)) return

        // A notification permission denial must not consume this charging cycle.
        // If permission is enabled while still plugged in, the next battery update
        // or service start can then deliver the alert.
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            android.util.Log.w(TAG, "Full-charge alert skipped: app notifications are disabled")
            return
        }

        // Android 8+ lets users disable an individual notification channel while
        // leaving the app's master notification switch enabled. Do not mark this
        // charging cycle as alerted when the battery-alert channel is blocked.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = getSystemService(NotificationManager::class.java)
                .getNotificationChannel(ALERT_CHANNEL)
            if (channel == null || channel.importance == NotificationManager.IMPORTANCE_NONE) {
                android.util.Log.w(TAG, "Full-charge alert skipped: battery alert channel is disabled")
                return
            }
        }

        val openIntent = Intent(this, ChargingCompleteActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, ALERT_REQUEST_CODE, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notificationBuilder = NotificationCompat.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_workly)
            .setContentTitle("Battery fully charged")
            .setContentText("Your phone has reached 100%. Unplug it whenever you are ready.")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(fullScreenPendingIntent)
            .setAutoCancel(true)
            .setOngoing(false)

        // Android 14+ may require the user to allow full-screen alerts in Special
        // App Access. The high-priority, audible notification remains the fallback.
        if (Build.VERSION.SDK_INT < 34 ||
            getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
        ) {
            notificationBuilder.setFullScreenIntent(fullScreenPendingIntent, true)
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            notificationBuilder.setSound(alarmSound)
                .setDefaults(Notification.DEFAULT_VIBRATE)
        }

        try {
            getSystemService(NotificationManager::class.java)
                .notify(ALERT_NOTIFICATION_ID, notificationBuilder.build())
            // Persist only after notification posting succeeds, so a transient
            // posting error cannot permanently suppress this charging cycle.
            prefs.edit().putBoolean(KEY_ALERTED, true).putBoolean(KEY_ACKNOWLEDGED, false).apply()
        } catch (error: SecurityException) {
            android.util.Log.e(TAG, "Could not post full-charge notification", error)
        }
    }

    private fun buildMonitorNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, MONITOR_REQUEST_CODE, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, MONITOR_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_workly)
            .setContentTitle("Workly battery protection")
            .setContentText("Monitoring while your phone is charging")
            .setContentIntent(openIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_MIN)
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
                    description = "Keeps the battery completion monitor active while charging"
                    setShowBadge(false)
                    setSound(null, null)
                }
            )
            val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            manager.createNotificationChannel(
                NotificationChannel(ALERT_CHANNEL, "Battery fully charged", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Audible alert once when the phone reaches 100% while charging"
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 350, 250, 350)
                    setSound(
                        alarmSound,
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                }
            )
        }
    }

    override fun onDestroy() {
        if (batteryReceiverRegistered) runCatching { unregisterReceiver(batteryReceiver) }
        batteryReceiverRegistered = false
        getSystemService(NotificationManager::class.java).cancel(MONITOR_NOTIFICATION_ID)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val PREFS = "workly_charging_alert"
        const val KEY_ALERTED = "alerted_this_charge"
        const val KEY_ACKNOWLEDGED = "alert_acknowledged"
        const val ACTION_START = "com.worklyindia.app.CHARGING_MONITOR_START"
        const val ACTION_STOP = "com.worklyindia.app.CHARGING_MONITOR_STOP"
        private const val TAG = "WorklyCharging"
        private const val MONITOR_CHANNEL = "workly_charging_monitor"
        const val ALERT_CHANNEL = "workly_battery_full_alert"
        private const val MONITOR_NOTIFICATION_ID = 8210
        private const val ALERT_NOTIFICATION_ID = 8211
        private const val MONITOR_REQUEST_CODE = 8212
        private const val ALERT_REQUEST_CODE = 8213
    }
}
