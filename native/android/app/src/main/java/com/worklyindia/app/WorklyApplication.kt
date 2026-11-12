package com.worklyindia.app

import android.app.Application
import android.content.pm.ShortcutManager

class WorklyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Install crash capture before starting background services.
        AppErrorReporter.initialize(this)
        // Keep the launcher menu limited to the three supported static shortcuts.
        // Remove stale dynamic entries and disable old pinned account shortcuts left
        // behind by earlier app versions (for example duplicate personal-name entries).
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N_MR1) {
            runCatching {
                val shortcuts = getSystemService(ShortcutManager::class.java)
                val allowedIds = setOf("workly_jobs", "workly_activity", "workly_profile")
                val obsoleteIds = (shortcuts.dynamicShortcuts + shortcuts.pinnedShortcuts)
                    .map { it.id }.distinct().filterNot { it in allowedIds }
                shortcuts.removeAllDynamicShortcuts()
                if (obsoleteIds.isNotEmpty()) {
                    shortcuts.disableShortcuts(obsoleteIds, "This shortcut is no longer available")
                }
            }
        }
        // Activate the existing lightweight, network-constrained quality monitor
        // on app startup. WorkManager keeps a single periodic instance across launches.
        WorklyNetworkMonitorWorker.schedule(this)
        // Keep the home-screen festival card fresh without opening the website.
        WorklyFestivalSyncWorker.schedule(this)
        // Keep a local snapshot of public jobs for read-only offline browsing.
        WorklyOfflineJobsSyncWorker.schedule(this)
        // Start the native charging monitor if Workly is opened while already plugged in.
        val battery = registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
        val plugged = battery?.getIntExtra(android.os.BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        if (plugged != 0) {
            val monitor = android.content.Intent(this, ChargingMonitorService::class.java)
                .setAction(ChargingMonitorService.ACTION_START)
            runCatching {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    androidx.core.content.ContextCompat.startForegroundService(this, monitor)
                } else {
                    startService(monitor)
                }
            }
        }
    }
}
