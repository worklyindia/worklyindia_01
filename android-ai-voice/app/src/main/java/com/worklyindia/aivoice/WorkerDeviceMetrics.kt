package com.worklyindia.aivoice

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Environment
import android.os.StatFs
import org.json.JSONObject

/** Lightweight, privacy-safe device resource snapshot for worker scheduling and diagnostics. */
object WorkerDeviceMetrics {
    fun snapshot(context: Context): JSONObject {
        val result = JSONObject()
        runCatching {
            val storage = StatFs(Environment.getDataDirectory().absolutePath)
            result.put("storage_total_bytes", storage.totalBytes.coerceAtLeast(0L))
            result.put("storage_available_bytes", storage.availableBytes.coerceAtLeast(0L))
        }

        runCatching {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memory = ActivityManager.MemoryInfo()
            manager.getMemoryInfo(memory)
            result.put("ram_total_bytes", memory.totalMem.coerceAtLeast(0L))
            result.put("ram_available_bytes", memory.availMem.coerceAtLeast(0L))
            result.put("low_memory", memory.lowMemory)
        }

        runCatching {
            val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            if (battery != null) {
                val level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                val percent = if (level >= 0 && scale > 0) ((level * 100f) / scale).toInt().coerceIn(0, 100) else -1
                val statusCode = battery.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
                val status = when (statusCode) {
                    BatteryManager.BATTERY_STATUS_CHARGING -> "Charging"
                    BatteryManager.BATTERY_STATUS_DISCHARGING -> "Discharging"
                    BatteryManager.BATTERY_STATUS_FULL -> "Full"
                    BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "Not charging"
                    else -> "Unknown"
                }
                val temperatureTenths = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1)
                val plugged = battery.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
                result.put("battery_percent", percent)
                result.put("battery_status", status)
                result.put("is_charging", statusCode == BatteryManager.BATTERY_STATUS_CHARGING ||
                    statusCode == BatteryManager.BATTERY_STATUS_FULL || plugged != 0)
                if (temperatureTenths >= 0) result.put("battery_temperature_c", temperatureTenths / 10.0)
            }
        }
        result.put("captured_at", System.currentTimeMillis())
        return result
    }
}
