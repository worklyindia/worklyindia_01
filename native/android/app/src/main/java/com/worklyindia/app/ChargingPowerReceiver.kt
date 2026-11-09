package com.worklyindia.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

class ChargingPowerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_POWER_CONNECTED -> {
                val service = Intent(context, ChargingMonitorService::class.java)
                    .setAction(ChargingMonitorService.ACTION_START)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        ContextCompat.startForegroundService(context, service)
                    } else {
                        context.startService(service)
                    }
                } catch (error: Exception) {
                    // Keep the failure visible in logcat instead of silently losing
                    // the only event that starts background battery monitoring.
                    android.util.Log.e("WorklyCharging", "Could not start charging monitor", error)
                }
            }
            Intent.ACTION_POWER_DISCONNECTED -> {
                context.getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(ChargingMonitorService.KEY_ALERTED, false)
                    .putBoolean(ChargingMonitorService.KEY_ACKNOWLEDGED, false)
                    .apply()
                context.stopService(Intent(context, ChargingMonitorService::class.java))
                android.util.Log.i("WorklyCharging", "Charger disconnected; next charging alert cycle reset")
            }
        }
    }
}
