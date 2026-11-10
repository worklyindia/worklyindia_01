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
            Intent.ACTION_BOOT_COMPLETED -> {
                // Normally the persistent service is already running. This is a
                // recovery path after boot or if Android stopped the process.
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
                // Reset this charge cycle, but KEEP the foreground monitor alive.
                // Stopping here would leave the next plug-in dependent on a
                // background foreground-service launch that Android may block.
                context.getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(ChargingMonitorService.KEY_ALERTED, false)
                    .putBoolean(ChargingMonitorService.KEY_ACKNOWLEDGED, false)
                    .apply()
                android.util.Log.i("WorklyCharging", "Charger disconnected; alert cycle reset, monitor remains active")
            }
        }
    }
}
