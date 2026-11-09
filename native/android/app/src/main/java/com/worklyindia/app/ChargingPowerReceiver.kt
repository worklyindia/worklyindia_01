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
                val service = Intent(context, ChargingMonitorService::class.java).setAction(ChargingMonitorService.ACTION_START)
                runCatching {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ContextCompat.startForegroundService(context, service)
                    else context.startService(service)
                }
            }
            Intent.ACTION_POWER_DISCONNECTED -> {
                context.getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(ChargingMonitorService.KEY_ALERTED, false)
                    .putBoolean(ChargingMonitorService.KEY_ACKNOWLEDGED, false)
                    .apply()
                context.stopService(Intent(context, ChargingMonitorService::class.java))
            }
        }
    }
}
