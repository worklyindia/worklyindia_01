package com.worklyindia.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.os.BatteryManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationCompat

class ChargingPowerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_POWER_CONNECTED -> {
                // POWER_CONNECTED is the authoritative edge-trigger. Do not gate this
                // on ACTION_BATTERY_CHANGED: immediately after plugging in, some devices
                // still report the previous (not charging) sticky status for a short time.
                // Starting the foreground service here makes it independent of screen
                // state, app visibility and lock-screen state.
                context.getSystemService(NotificationManager::class.java).cancel(PROTECTION_NOTIFICATION_ID)
                val prefs = context.getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE)
                // Arm one announcement for this physical plug-in edge only.
                // Duplicate broadcasts cannot replay after the first announcement.
                if (!prefs.getBoolean(ChargingMonitorService.KEY_STARTED_ANNOUNCED, false)) {
                    prefs.edit()
                        .putBoolean(ChargingMonitorService.KEY_START_ANNOUNCEMENT_PENDING, true)
                        .putBoolean(ChargingMonitorService.KEY_TTS_UNAVAILABLE, false)
                        .apply()
                }
                startMonitor(context, "charger connected")
            }
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                // Restore after reboot/update only if the charger is currently connected.
                val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
                val status = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
                val plugged = battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
                val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL ||
                    plugged != 0
                if (isCharging) {
                    context.getSystemService(NotificationManager::class.java).cancel(PROTECTION_NOTIFICATION_ID)
                    startMonitor(context, "boot/update while charging")
                } else {
                    showProtectionNotification(context)
                }
            }
            Intent.ACTION_POWER_DISCONNECTED -> {
                // Reset this charge cycle and stop the foreground service on unplug.
                context.getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE).edit()
                    .putBoolean(ChargingMonitorService.KEY_ALERTED, false)
                    .putBoolean(ChargingMonitorService.KEY_ACKNOWLEDGED, false)
                    .putBoolean(ChargingMonitorService.KEY_STARTED_ANNOUNCED, false)
                    .putBoolean(ChargingMonitorService.KEY_START_ANNOUNCEMENT_PENDING, false)
                    .putBoolean(ChargingMonitorService.KEY_TTS_UNAVAILABLE, false)
                    .apply()
                context.getSystemService(android.app.NotificationManager::class.java).cancel(8211)
                context.getSystemService(NotificationManager::class.java).cancel(PROTECTION_NOTIFICATION_ID)
                context.sendBroadcast(Intent(ChargingCompleteActivity.ACTION_CLOSE_ON_UNPLUG).setPackage(context.packageName))
                context.stopService(Intent(context, ChargingMonitorService::class.java))
                showProtectionNotification(context)
                android.util.Log.i("WorklyCharging", "Charger disconnected; charging monitor stopped and notification cleared")
            }
        }
    }

    private fun showProtectionNotification(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    PROTECTION_CHANNEL,
                    "Battery protection",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Shows that Workly battery protection is ready while the phone is not charging"
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    setShowBadge(false)
                    setSound(null, null)
                }
            )
        }
        val openIntent = PendingIntent.getActivity(
            context,
            PROTECTION_REQUEST_CODE,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, PROTECTION_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_workly)
            .setContentTitle("Workly battery protection")
            .setContentText("Monitoring while your phone is charging")
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openIntent)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(false)
            .setSilent(true)
            .build()
        manager.notify(PROTECTION_NOTIFICATION_ID, notification)
    }

    private fun startMonitor(context: Context, reason: String) {
        val service = Intent(context, ChargingMonitorService::class.java)
            .setAction(ChargingMonitorService.ACTION_START)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, service)
            } else {
                context.startService(service)
            }
            android.util.Log.i("WorklyCharging", "Starting foreground battery monitor: $reason")
        } catch (error: Exception) {
            android.util.Log.e("WorklyCharging", "Could not start battery monitor: $reason", error)
        }
    }

    companion object {
        private const val PROTECTION_CHANNEL = "workly_battery_protection"
        private const val PROTECTION_NOTIFICATION_ID = 8209
        private const val PROTECTION_REQUEST_CODE = 8209
    }
}
