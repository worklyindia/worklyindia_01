package com.worklyindia.app

import android.app.Application

class WorklyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // WorkManager checks estimated connection quality periodically without
        // running a permanent foreground service or downloading speed-test data.
        WorklyNetworkMonitorWorker.schedule(this)
    }
}
