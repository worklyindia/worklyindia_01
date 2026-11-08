package com.worklyindia.app

import android.app.Application

class WorklyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Activate the existing lightweight, network-constrained quality monitor
        // on app startup. WorkManager keeps a single periodic instance across launches.
        WorklyNetworkMonitorWorker.schedule(this)
    }
}
