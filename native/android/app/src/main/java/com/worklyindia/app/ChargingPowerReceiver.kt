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
                // Recover after boot, app update, or a charging event if Android
                // previously stopped the process. The persistent service handles
                // subsequent charge cycles without needing another background start.
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
                // Stop the foreground monitor on unplug so its ongoing notification
                // disappears. The next POWER_CONNECTED event starts it again.
                context.getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE).edit()
                    .putBoolean(ChargingMonitorService.KEY_ALERTED, false)
                    .putBoolean(ChargingMonitorService.KEY_ACKNOWLEDGED, false)
                    .apply()
                context.getSystemService(android.app.NotificationManager::class.java).cancel(8211)
                context.stopService(Intent(context, ChargingMonitorService::class.java))
                android.util.Log.i("WorklyCharging", "Charger disconnected; charging monitor stopped and notification cleared")
            }
        }
    }
}
