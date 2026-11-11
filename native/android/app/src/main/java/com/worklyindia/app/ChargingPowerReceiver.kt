package com.worklyindia.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import androidx.core.content.ContextCompat

class ChargingPowerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_POWER_CONNECTED -> {
                // POWER_CONNECTED is the authoritative edge-trigger. Do not gate this
                // on ACTION_BATTERY_CHANGED: immediately after plugging in, some devices
                // still report the previous (not charging) sticky status for a short time.
                // Starting the foreground service here makes it independent of screen
                // state, app visibility and lock-screen state.
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
                if (isCharging) startMonitor(context, "boot/update while charging")
            }
            Intent.ACTION_POWER_DISCONNECTED -> {
                // Reset this charge cycle and stop the foreground service on unplug.
                context.getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE).edit()
                    .putBoolean(ChargingMonitorService.KEY_ALERTED, false)
                    .putBoolean(ChargingMonitorService.KEY_ACKNOWLEDGED, false)
                    .apply()
                context.getSystemService(android.app.NotificationManager::class.java).cancel(8211)
                context.sendBroadcast(Intent(ChargingCompleteActivity.ACTION_CLOSE_ON_UNPLUG).setPackage(context.packageName))
                context.stopService(Intent(context, ChargingMonitorService::class.java))
                android.util.Log.i("WorklyCharging", "Charger disconnected; charging monitor stopped and notification cleared")
            }
        }
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
}
