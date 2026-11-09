package com.worklyindia.app

import android.app.Application

class WorklyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Activate the existing lightweight, network-constrained quality monitor
        // on app startup. WorkManager keeps a single periodic instance across launches.
        WorklyNetworkMonitorWorker.schedule(this)
        // Keep the home-screen festival card fresh without opening the website.
        WorklyFestivalSyncWorker.schedule(this)
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
