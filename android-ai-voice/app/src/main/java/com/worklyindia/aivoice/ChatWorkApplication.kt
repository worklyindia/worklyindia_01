package com.worklyindia.aivoice

import android.app.Activity
import android.app.Application
import android.os.Bundle

/**
 * Applies the same visible status/navigation bars and safe content insets to
 * every ChatWork Activity, including screens added in future updates.
 */
class ChatWorkApplication : Application(), Application.ActivityLifecycleCallbacks {
    override fun onCreate() {
        super.onCreate()
        JarvisDiagnostics.installUncaughtHandler(this)
        // Retry durable crash reports before scanning historical process exits.
        // This recovers reports whose previous WorkManager enqueue failed.
        JarvisCrashReportOutbox.schedulePending(this)
        JarvisDiagnostics.recordPreviousProcessExit(this)
        JarvisDiagnostics.record(this, "APP_PROCESS_CREATED")
        registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        ChatWorkTheme.applyWindow(activity)
    }

    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityResumed(activity: Activity) {
        ChatWorkTheme.applyContentInsets(activity)
    }
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit
}
