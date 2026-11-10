package com.worklyindia.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

class ChargingPowerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_POWER_CONNECTED,
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                // Restore the monitor after boot/update only when the device is actually charging.
                val battery = context.registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
                val status = battery?.getIntExtra(android.os.BatteryManager.EXTRA_STATUS, -1) ?: -1
                val isCharging = status == android.os.BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == android.os.BatteryManager.BATTERY_STATUS_FULL
                if (!isCharging) return
                val service = Intent(context, ChargingMonitorService::class.java)
                    .setAction(ChargingMonitorService.ACTION_START)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        ContextCompat.startForegroundService(context, service)
                    } else {
                        context.startService(service)
                    }
                } catch (error: Exception) {
                    android.util.Log.e("WorklyCharging", "Could not restart battery monitor", error)
                }
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
}
