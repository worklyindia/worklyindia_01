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
        // Battery monitoring/audio do not require full-screen-intent access.
        // The service checks that permission only before launching the 100% screen.
        when (intent.action) {
            Intent.ACTION_POWER_CONNECTED -> {
                // POWER_CONNECTED is the authoritative edge-trigger. Do not gate this
                // on ACTION_BATTERY_CHANGED: immediately after plugging in, some devices
                // still report the previous (not charging) sticky status for a short time.
                // Starting the foreground service here makes it independent of screen
                // state, app visibility and lock-screen state.
                // Pass the physical edge to the service itself. It commits the
                // session state before reading Android's sticky battery snapshot.
                startMonitor(
                    context,
                    "charger connected",
                    ChargingMonitorService.ACTION_POWER_CONNECTED
                )
            }
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                // Keep exactly one ongoing monitor notification across reboot and app updates.
                startMonitor(context, "boot/update")
            }
            Intent.ACTION_POWER_DISCONNECTED -> {
                // Keep the same foreground service and notification; only change its state to Battery.
                context.sendBroadcast(Intent(ChargingCompleteActivity.ACTION_CLOSE_ON_UNPLUG).setPackage(context.packageName))
                startMonitor(context, "charger disconnected", ChargingMonitorService.ACTION_POWER_DISCONNECTED)
                android.util.Log.i("WorklyCharging", "Charger disconnected; persistent Workly notification changed to Battery")
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
            .setContentText("Monitoring while your phone is not charging")
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openIntent)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(false)
            .setSilent(true)
            .build()
        manager.notify(PROTECTION_NOTIFICATION_ID, notification)
    }

    private fun startMonitor(
        context: Context,
        reason: String,
        action: String = ChargingMonitorService.ACTION_START
    ) {
        val service = Intent(context, ChargingMonitorService::class.java)
            .setAction(action)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, service)
            } else {
                context.startService(service)
            }
            android.util.Log.i("WorklyCharging", "Starting foreground battery monitor: $reason")
        } catch (error: Exception) {
            android.util.Log.e("WorklyCharging", "Could not start battery monitor: $reason", error)
            AppErrorReporter.capture(context, "charging_power_receiver", "error", error, source = reason)
        }
    }

    companion object {
        private const val PROTECTION_CHANNEL = "workly_battery_protection"
        private const val PROTECTION_NOTIFICATION_ID = 8209
        private const val PROTECTION_REQUEST_CODE = 8209
    }
}
