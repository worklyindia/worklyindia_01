package com.worklyindia.aivoice

import android.content.Context
import android.os.Build
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
                file.appendText("[" + stamp + "] " + event + (if (safe.isNotBlank()) " · " + safe else "") + "\n")
            }
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
