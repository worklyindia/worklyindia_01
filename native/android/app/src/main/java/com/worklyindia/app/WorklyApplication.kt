package com.worklyindia.app

import android.app.Application
import java.util.concurrent.Executors

class WorklyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Fetch Firebase's public client config and initialize crash reporting
        // away from the UI thread so cold-start rendering is never blocked.
        Executors.newSingleThreadExecutor().execute {
            NativePushManager.initializeCrashReporting(applicationContext)
        }
    }
}
