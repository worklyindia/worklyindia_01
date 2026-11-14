package com.worklyindia.app

import android.app.Application
import android.content.pm.ShortcutManager

class WorklyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Debug-only StrictMode diagnostics. Log violations without crashing the app.
        // This is excluded from release behavior and helps catch accidental main-thread I/O.
        if (BuildConfig.DEBUG) {
            android.os.StrictMode.setThreadPolicy(
                android.os.StrictMode.ThreadPolicy.Builder()
                    .detectDiskReads()
                    .detectDiskWrites()
                    .detectNetwork()
                    .penaltyLog()
                    .build()
            )
        }
        // Install crash capture before starting background services.
        AppErrorReporter.initialize(this)
        // Clear obsolete launcher shortcuts that may show a personal account name.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N_MR1) {
            runCatching {
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
