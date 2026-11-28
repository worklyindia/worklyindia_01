package com.worklyindia.aivoice

// Keep this file covered by the ChatWork Android pull-request build.

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import com.google.firebase.crashlytics.FirebaseCrashlytics
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Private local-only JARVIS diagnostic log. Never records prompts or API keys. */
object JarvisDiagnostics {
    private val lock = Any()
    private fun logFile(context: Context): File =
        File(context.getExternalFilesDir(null) ?: context.filesDir, "jarvis-diagnostics/jarvis-diagnostic.log")
            .apply { parentFile?.mkdirs() }

    fun record(context: Context, event: String, detail: String? = null) {
        synchronized(lock) {
            runCatching {
                val file = logFile(context)
                if (file.exists() && file.length() > 512 * 1024)
                    file.writeText(file.readLines().takeLast(1200).joinToString("\n") + "\n")
                val stamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(Date())
                val safe = (detail ?: "").replace(Regex("(?i)(api[_ -]?key|authorization|bearer)\\s*[:=]\\s*[^\\s,;]+"), "[REDACTED]")
                // Send bounded, redacted JARVIS lifecycle breadcrumbs to Crashlytics.
                // Never send prompts, user messages, or API keys.
                runCatching {
                    val crashlytics = FirebaseCrashlytics.getInstance()
                    crashlytics.log("JARVIS_EVENT=" + event + (if (safe.isNotBlank()) " · " + safe.take(3000) else ""))
                    crashlytics.setCustomKey("jarvis_last_event", event.take(64))
                }
                file.appendText("[" + stamp + "] " + event + (if (safe.isNotBlank()) " · " + safe else "") + "\n")
            }
        }
    }

    /**
     * Android keeps the previous process exit reason outside the app process.
     * Read it on the next launch so native crashes and LMK kills are distinguishable
     * even when no Java/Kotlin uncaught exception handler can run.
     */
    fun recordPreviousProcessExit(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        runCatching {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val exits = manager.getHistoricalProcessExitReasons(context.packageName, 0, 5).sortedBy { it.timestamp }
            exits.forEach { exit ->
                val reason = when (exit.reason) {
                    ApplicationExitInfo.REASON_ANR -> "ANR"
                    ApplicationExitInfo.REASON_CRASH -> "JAVA_CRASH"
                    ApplicationExitInfo.REASON_CRASH_NATIVE -> "NATIVE_CRASH"
                    ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
                    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE_USAGE"
                    ApplicationExitInfo.REASON_USER_REQUESTED -> "USER_REQUESTED"
                    ApplicationExitInfo.REASON_USER_STOPPED -> "USER_STOPPED"
                    ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
                    ApplicationExitInfo.REASON_FREEZER -> "FREEZER"
                    ApplicationExitInfo.REASON_PACKAGE_STATE_CHANGE -> "PACKAGE_STATE_CHANGE"
                    ApplicationExitInfo.REASON_PACKAGE_UPDATED -> "PACKAGE_UPDATED"
                    ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "PERMISSION_CHANGE"
                    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INITIALIZATION_FAILURE"
                    ApplicationExitInfo.REASON_SIGNALED -> "SIGNALED"
                    else -> "OTHER_${exit.reason}"
                }
                val details = StringBuilder()
                    .append("reason=").append(reason)
                    .append("; status=").append(exit.status)
                    .append("; process=").append(exit.processName)
                    .append("; time=").append(exit.timestamp)
                    .append("; pssKb=").append(exit.pss)
                    .append("; rssKb=").append(exit.rss)
                    .append("; description=").append(exit.description ?: "none")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    (exit.reason == ApplicationExitInfo.REASON_CRASH_NATIVE ||
                     exit.reason == ApplicationExitInfo.REASON_ANR)) {
                    runCatching {
                        exit.traceInputStream?.use { stream ->
                            // Android native tombstones are protobuf/binary, not UTF-8 text.
                            // Keep the shared report readable and record whether a trace exists.
                            val byteCount = stream.readBytes().size
                            details.append("; nativeTraceBytes=").append(byteCount)
                            details.append("; nativeTraceFormat=binary-tombstone")
                        }
                    }
                }
                record(context, "ANDROID_PREVIOUS_PROCESS_EXIT", details.toString())

                // Queue fatal process exits for Supabase upload on the next app launch.
                // WorkManager keeps the report locally until the server acknowledges it.
                if (exit.reason == ApplicationExitInfo.REASON_CRASH_NATIVE ||
                    exit.reason == ApplicationExitInfo.REASON_ANR ||
                    exit.reason == ApplicationExitInfo.REASON_CRASH) {
                    JarvisCrashReportOutbox.enqueue(context, exit.timestamp, reason, exit.status, details.toString())
                }

                // Android reports native crashes after the process has died. Convert each
                // newly observed native crash/ANR into a Crashlytics non-fatal event on
                // next launch, because no in-process handler can report the original crash.
                // This is diagnostic metadata, not the original native tombstone/stack.
                if (exit.reason == ApplicationExitInfo.REASON_CRASH_NATIVE ||
                    exit.reason == ApplicationExitInfo.REASON_ANR) {
                    runCatching {
                        val prefs = context.getSharedPreferences("jarvis_crash_reporting", Context.MODE_PRIVATE)
                        val key = "last_reported_exit_timestamp"
                        val lastReported = prefs.getLong(key, 0L)
                        if (exit.timestamp > lastReported) {
                            FirebaseCrashlytics.getInstance().recordException(
                                IllegalStateException("Previous ChatWork process exit: " + details.toString().take(3000))
                            )
                            prefs.edit().putLong(key, exit.timestamp).apply()
                            record(context, "PREVIOUS_PROCESS_EXIT_SENT_TO_CRASHLYTICS",
                                "reason=" + reason + "; time=" + exit.timestamp)
                        }
                    }.onFailure {
                        record(context, "PREVIOUS_PROCESS_EXIT_CRASHLYTICS_FAILED",
                            it.javaClass.simpleName + ": " + (it.message ?: "unknown"))
                    }
                }
            }
        }.onFailure {
            record(context, "ANDROID_EXIT_INFO_UNAVAILABLE", it.javaClass.simpleName + ": " + (it.message ?: "unknown"))
        }
    }

    fun installUncaughtHandler(context: Context) {
        val appContext = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            record(appContext, "UNCAUGHT_EXCEPTION", "thread=" + thread.name + "; " + error.stackTraceToString().take(12000))
            previous?.uncaughtException(thread, error)
        }
    }

    fun buildReport(context: Context): String {
        val prefs = context.getSharedPreferences(WakeWordAssistantService.PREFS, Context.MODE_PRIVATE)
        val info = runCatching { context.packageManager.getPackageInfo(context.packageName, 0) }.getOrNull()
        val versionCode = if (Build.VERSION.SDK_INT >= 28) info?.longVersionCode else info?.versionCode?.toLong()
        val header = listOf(
            "ChatWork · JARVIS Diagnostic Report",
            "Generated: " + SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", Locale.US).format(Date()),
            "App version: " + (info?.versionName ?: "unknown") + " (" + (versionCode ?: -1) + ")",
            "Device: " + Build.MANUFACTURER + " " + Build.MODEL,
            "Android: " + Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + ")",
            "JARVIS saved active: " + prefs.getBoolean(WakeWordAssistantService.KEY_ACTIVE, false),
            "Last status: " + (prefs.getString(WakeWordAssistantService.KEY_STATUS, "unknown") ?: "unknown"),
            "Last status message: " + (prefs.getString(WakeWordAssistantService.KEY_STATUS_MESSAGE, "unknown") ?: "unknown"),
            "Last error: " + (prefs.getString(WakeWordAssistantService.KEY_ERROR, "none") ?: "none"),
            "", "--- Recent local diagnostic events ---"
        ).joinToString("\n")
        val body = runCatching { logFile(context).takeIf { it.exists() }?.readText()?.takeLast(40000) ?: "No diagnostic events recorded yet." }
            .getOrDefault("Could not read local diagnostic log.")
        return header + "\n" + body
    }
}
