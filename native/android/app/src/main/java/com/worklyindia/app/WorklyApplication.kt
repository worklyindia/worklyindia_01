package com.worklyindia.app

import android.app.Application
import android.content.pm.ShortcutManager
import android.util.Log

class WorklyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Crash capture is useful, but its optional upload worker must not block launch.
        runStartupSafely("crash reporter initialization") { AppErrorReporter.initialize(this) }

        // Clear obsolete launcher shortcuts that may show a personal account name.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N_MR1) {
            runStartupSafely("launcher shortcut cleanup") {
                val shortcuts = getSystemService(ShortcutManager::class.java)
                val allowedIds = setOf("workly_jobs", "workly_activity", "workly_profile", "workly_secure_vault")
                val obsoleteIds = (shortcuts.dynamicShortcuts + shortcuts.pinnedShortcuts)
                    .map { it.id }.distinct().filterNot { it in allowedIds }
                if (obsoleteIds.isNotEmpty()) {
                    shortcuts.removeDynamicShortcuts(obsoleteIds)
                    shortcuts.disableShortcuts(obsoleteIds, "This shortcut is no longer available")
                }
            }
        }

        // Background features are optional. If WorkManager is temporarily unavailable
        // or a scheduler throws on a device, keep the foreground app usable.
        runStartupSafely("network monitor scheduling") { WorklyNetworkMonitorWorker.schedule(this) }
        runStartupSafely("festival sync scheduling") { WorklyFestivalSyncWorker.schedule(this) }
        runStartupSafely("offline jobs sync scheduling") { WorklyOfflineJobsSyncWorker.schedule(this) }

        // Start the charging monitor only when a charging session is already active.
        runStartupSafely("charging monitor restore") {
            val battery = registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
            val plugged = battery?.getIntExtra(android.os.BatteryManager.EXTRA_PLUGGED, 0) ?: 0
            if (plugged != 0) {
                val monitor = android.content.Intent(this, ChargingMonitorService::class.java)
                    .setAction(ChargingMonitorService.ACTION_START)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    androidx.core.content.ContextCompat.startForegroundService(this, monitor)
                } else {
                    startService(monitor)
                }
            }
        }
    }

    private inline fun runStartupSafely(task: String, action: () -> Unit) {
        runCatching(action).onFailure {
            Log.w("WorklyStartup", "Skipping optional $task; continuing app launch", it)
        }
    }
}
