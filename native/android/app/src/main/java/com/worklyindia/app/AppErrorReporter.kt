package com.worklyindia.app

import android.content.Context
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.util.UUID

/** Stores technical-only reports locally until Supabase confirms the upload. */
object AppErrorReporter {
    private const val TAG = "WorklyErrorReporter"
    private const val PREFS = "workly_error_reporter"
    private const val KEY_INSTALLATION_ID = "installation_id"
    @Volatile private var initialized = false

    @Synchronized
    fun initialize(context: Context) {
        if (initialized) return
        initialized = true
        val appContext = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        if (previous !is WorklyUncaughtExceptionHandler) {
            Thread.setDefaultUncaughtExceptionHandler(WorklyUncaughtExceptionHandler(appContext, previous))
        }
        WorklyErrorReportWorker.schedule(appContext)
    }

    fun capture(context: Context, component: String, severity: String, error: Throwable, source: String? = null, httpStatus: Int? = null) {
        capture(context, component, severity, error.javaClass.simpleName.ifBlank { "Exception" },
            error.message ?: "", Log.getStackTraceString(error), source, httpStatus)
    }

    fun capture(
        context: Context, component: String, severity: String, errorType: String,
        message: String, stackTrace: String = "", source: String? = null, httpStatus: Int? = null
    ) {
        runCatching {
            val app = context.applicationContext
            val id = UUID.randomUUID().toString()
            val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val installationId = prefs.getString(KEY_INSTALLATION_ID, null) ?: UUID.randomUUID().toString().also {
                prefs.edit().putString(KEY_INSTALLATION_ID, it).commit()
            }
            val packageInfo = app.packageManager.getPackageInfo(app.packageName, 0)
            val safeContext = JSONObject()
            if (!source.isNullOrBlank()) safeContext.put("source", sanitize(source, 120))
            if (httpStatus != null) safeContext.put("http_status", httpStatus)
            val report = JSONObject()
                .put("event_id", id)
                .put("installation_id", installationId)
                .put("app_version", sanitize(packageInfo.versionName ?: "unknown", 40))
                .put("android_version", sanitize(Build.VERSION.RELEASE ?: "unknown", 40))
                .put("device_model", listOf(Build.MANUFACTURER, Build.MODEL).filter { it.isNotBlank() }.distinct().joinToString(" ").take(80))
                .put("component", sanitize(component, 80).ifBlank { "unknown" })
                .put("severity", severity.takeIf { it in setOf("warning", "error", "fatal") } ?: "error")
                .put("error_type", sanitize(errorType, 120).ifBlank { "UnknownError" })
                .put("message", sanitize(message, 1200))
                .put("stack_trace", sanitize(stackTrace, 10000))
                .put("context", safeContext)
            WorklyErrorReportStore.enqueue(app, id, report.toString())
            WorklyErrorReportWorker.enqueue(app)
        }.onFailure { Log.w(TAG, "Could not save technical error report locally", it) }
    }

    private fun sanitize(value: String, max: Int): String = value
        .replace(Regex("(?i)Bearer\\s+[A-Za-z0-9._~+/-]+=*"), "Bearer [REDACTED]")
        .replace(Regex("(?i)(access_token|refresh_token|password|authorization|api[_-]?key)\\s*[:=]\\s*[^\\s,;]+"), "$1=[REDACTED]")
        .replace(Regex("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", RegexOption.IGNORE_CASE), "[EMAIL]")
        .replace(Regex("\\+?\\d[\\d\\s().-]{7,}\\d"), "[PHONE]")
        .replace(Regex("(https?://[^\\s?]+)\\?[^\\s]+", RegexOption.IGNORE_CASE), "$1?[REDACTED]")
        .take(max)

    private class WorklyUncaughtExceptionHandler(
        private val context: Context, private val previous: Thread.UncaughtExceptionHandler?
    ) : Thread.UncaughtExceptionHandler {
        override fun uncaughtException(thread: Thread, error: Throwable) {
            capture(context, "android_process", "fatal", error)
            try {
                previous?.uncaughtException(thread, error)
            } finally {
                android.os.Process.killProcess(android.os.Process.myPid())
                kotlin.system.exitProcess(10)
            }
        }
    }
}
