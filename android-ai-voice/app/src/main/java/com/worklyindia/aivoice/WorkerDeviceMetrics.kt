package com.worklyindia.aivoice

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.os.Environment
import android.os.StatFs
import org.json.JSONArray
import org.json.JSONObject

/**
 * Privacy-safe device snapshot. Collects only hardware/resource health required
 * for worker scheduling and diagnostics; never reads location, contacts, messages,
 * files, or personal account content.
 */
object WorkerDeviceMetrics {
    private var previousCpuTimeMs = -1L
    private var previousElapsedMs = -1L

    @Synchronized
    private fun appCpuUsagePercent(): Double? {
        val cpuNow = android.os.Process.getElapsedCpuTime()
        val elapsedNow = SystemClock.elapsedRealtime()
        val cpuBefore = previousCpuTimeMs
        val elapsedBefore = previousElapsedMs
        previousCpuTimeMs = cpuNow
        previousElapsedMs = elapsedNow
        if (cpuBefore < 0L || elapsedBefore < 0L || elapsedNow <= elapsedBefore) return null
        return (((cpuNow - cpuBefore).coerceAtLeast(0L) * 100.0) /
            (elapsedNow - elapsedBefore)).coerceIn(0.0, 100.0)
    }

    private fun capture(errors: JSONArray, component: String, action: () -> Unit) {
        try {
            action()
        } catch (_: Exception) {
            // Keep the report useful while making incomplete collection explicit.
            errors.put(component)
        }
    }

    fun snapshot(context: Context): JSONObject {
        val result = JSONObject()
        val errors = JSONArray()

        capture(errors, "device_info") {
            result.put("manufacturer", Build.MANUFACTURER.orEmpty().take(80))
            result.put("device_model", Build.MODEL.orEmpty().take(100))
            result.put("android_version", Build.VERSION.RELEASE ?: "unknown")
            result.put("android_sdk", Build.VERSION.SDK_INT)
            result.put("app_version", BuildConfig.VERSION_NAME)
        }

        capture(errors, "internal_storage") {
            // StatFs reports the Android data partition, not advertised device capacity.
            val storage = StatFs(Environment.getDataDirectory().absolutePath)
            result.put("storage_total_bytes", storage.totalBytes.coerceAtLeast(0L))
            result.put("storage_available_bytes", storage.availableBytes.coerceAtLeast(0L))
        }

        capture(errors, "ram") {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memory = ActivityManager.MemoryInfo()
            manager.getMemoryInfo(memory)
            result.put("ram_total_bytes", memory.totalMem.coerceAtLeast(0L))
            result.put("ram_available_bytes", memory.availMem.coerceAtLeast(0L))
            result.put("low_memory", memory.lowMemory)
        }

        capture(errors, "app_cpu") {
            val cpuUsage = appCpuUsagePercent()
            if (cpuUsage != null) {
                result.put("app_cpu_usage_percent", cpuUsage)
                result.put("app_cpu_sample_status", "ready")
            } else {
                result.put("app_cpu_sample_status", "warming_up")
            }
        }

        capture(errors, "thermal") {
            val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            val thermal = if (supported) {
                when (power.currentThermalStatus) {
                    PowerManager.THERMAL_STATUS_NONE -> "none"
                    PowerManager.THERMAL_STATUS_LIGHT -> "light"
                    PowerManager.THERMAL_STATUS_MODERATE -> "moderate"
                    PowerManager.THERMAL_STATUS_SEVERE -> "severe"
                    PowerManager.THERMAL_STATUS_CRITICAL -> "critical"
                    PowerManager.THERMAL_STATUS_EMERGENCY -> "emergency"
                    PowerManager.THERMAL_STATUS_SHUTDOWN -> "shutdown"
                    else -> "unknown"
                }
            } else "unsupported"
            result.put("thermal_status", thermal)
            result.put("thermal_status_supported", supported)
        }

        capture(errors, "battery") {
            val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            if (battery == null) {
                errors.put("battery_unavailable")
            } else {
                val level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                val percent = if (level >= 0 && scale > 0) {
                    ((level * 100f) / scale).toInt().coerceIn(0, 100)
                } else -1
                val statusCode = battery.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
                val status = when (statusCode) {
                    BatteryManager.BATTERY_STATUS_CHARGING -> "Charging"
                    BatteryManager.BATTERY_STATUS_DISCHARGING -> "Discharging"
                    BatteryManager.BATTERY_STATUS_FULL -> "Full"
                    BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "Not charging"
                    else -> "Unknown"
                }
                val healthCode = battery.getIntExtra(BatteryManager.EXTRA_HEALTH, BatteryManager.BATTERY_HEALTH_UNKNOWN)
                val health = when (healthCode) {
                    BatteryManager.BATTERY_HEALTH_GOOD -> "Good"
                    BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Overheat"
                    BatteryManager.BATTERY_HEALTH_DEAD -> "Dead"
                    BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Over voltage"
                    BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "Unspecified failure"
                    BatteryManager.BATTERY_HEALTH_COLD -> "Cold"
                    else -> "Unknown"
                }
                val temperatureTenths = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1)
                val voltageMv = battery.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1)
                val plugged = battery.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
                val pluggedType = when (plugged) {
                    BatteryManager.BATTERY_PLUGGED_AC -> "AC"
                    BatteryManager.BATTERY_PLUGGED_USB -> "USB"
                    BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Wireless"
                    0 -> "Unplugged"
                    else -> "Other"
                }
                result.put("battery_percent", percent)
                result.put("battery_status", status)
                result.put("battery_health", health)
                result.put("battery_plugged_type", pluggedType)
                result.put("is_charging", statusCode == BatteryManager.BATTERY_STATUS_CHARGING ||
                    statusCode == BatteryManager.BATTERY_STATUS_FULL || plugged != 0)
                if (temperatureTenths >= 0) {
                    // Android exposes battery temperature, not CPU/SoC temperature.
                    result.put("battery_temperature_c", temperatureTenths / 10.0)
                }
                if (voltageMv >= 0) result.put("battery_voltage_mv", voltageMv)
            }
        }

        result.put("collection_errors", errors)
        result.put("collection_status", if (errors.length() == 0) "complete" else "partial")
        result.put("captured_at", System.currentTimeMillis())
        return result
    }
}