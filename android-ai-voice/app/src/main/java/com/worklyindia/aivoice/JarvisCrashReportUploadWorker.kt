package com.worklyindia.aivoice

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPOutputStream
import android.util.Base64

/** Keeps reports locally until Supabase acknowledges them. Technical diagnostics only. */
object JarvisCrashReportOutbox {
    private const val PREFS = "jarvis_supabase_crash_reports"
    private const val OUTBOX_DIR = "jarvis-crash-outbox"
    private const val UNIQUE_WORK = "chatwork-jarvis-crash-upload"

    fun enqueue(context: Context, timestamp: Long, reason: String, status: Int, details: String, nativeTrace: ByteArray? = null) {
        runCatching {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val lastQueued = prefs.getLong("last_queued_exit_timestamp", 0L)
            if (timestamp <= lastQueued) return

            val installationId = prefs.getString("installation_id", null)
                ?: UUID.randomUUID().toString().also {
                    prefs.edit().putString("installation_id", it).apply()
                }
            val eventId = UUID.nameUUIDFromBytes((installationId + ":" + timestamp).toByteArray(Charsets.UTF_8)).toString()
            val info = runCatching { context.packageManager.getPackageInfo(context.packageName, 0) }.getOrNull()
            val versionCode = if (android.os.Build.VERSION.SDK_INT >= 28) info?.longVersionCode
                else info?.versionCode?.toLong()
            val message = "Previous Android process exit: " + reason + "; status=" + status + "; " + details.take(800)
            val stack = JarvisDiagnostics.buildReport(context).takeLast(10_000)
            val payload = JSONObject()
                .put("event_id", eventId)
                .put("installation_id", installationId)
                .put("app_version", (info?.versionName ?: "unknown") + " (" + (versionCode ?: -1) + ")")
                .put("android_version", android.os.Build.VERSION.RELEASE ?: "unknown")
                .put("device_model", (android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL).take(120))
                .put("component", "JARVIS")
                .put("severity", if (reason == "ANR") "error" else "fatal")
                .put("error_type", (reason + "_STATUS_" + status).take(120))
                .put("message", message.take(1200))
                .put("stack_trace", stack)
                .put("context", JSONObject().put("source", "chatwork_android_jarvis"))

            // Preserve the actual Android binary tombstone, not only its byte count.
            // Compress before Base64 so the trace can travel safely through PostgREST.
            nativeTrace?.takeIf { it.isNotEmpty() && it.size <= 4_194_304 }?.let { trace ->
                val compressed = ByteArrayOutputStream().use { output ->
                    GZIPOutputStream(output).use { gzip -> gzip.write(trace) }
                    output.toByteArray()
                }
                val encoded = Base64.encodeToString(compressed, Base64.NO_WRAP)
                if (encoded.length <= 1_800_000) {
                    payload.put("native_trace_gzip_base64", encoded)
                    payload.put("native_trace_bytes", trace.size)
                }
            }

            val directory = File(context.filesDir, OUTBOX_DIR).apply { mkdirs() }
            val target = File(directory, eventId + ".json")
            if (!target.exists()) {
                val temporary = File(directory, eventId + ".tmp")
                temporary.writeText(payload.toString(), Charsets.UTF_8)
                check(temporary.renameTo(target)) { "Could not save pending JARVIS crash report" }
            }
            prefs.edit().putLong("last_queued_exit_timestamp", timestamp).apply()
            JarvisDiagnostics.record(context, "SUPABASE_CRASH_REPORT_QUEUED",
                "reason=" + reason + "; timestamp=" + timestamp + "; event=" + eventId)
            schedule(context)
        }.onFailure {
            JarvisDiagnostics.record(context, "SUPABASE_CRASH_REPORT_QUEUE_FAILED",
                it.javaClass.simpleName + ": " + (it.message ?: "unknown"))
        }
    }

    internal fun pendingFiles(context: Context): List<File> =
        File(context.filesDir, OUTBOX_DIR).listFiles()
            ?.filter { it.isFile && it.extension == "json" }
            ?.sortedBy { it.name }
            .orEmpty()

    /** Re-enqueue any durable reports on every app process start, even if a prior enqueue failed. */
    fun schedulePending(context: Context) {
        val pendingCount = pendingFiles(context).size
        if (pendingCount == 0) return
        JarvisDiagnostics.record(context, "SUPABASE_CRASH_REPORT_PENDING_FOUND", "count=" + pendingCount)
        schedule(context)
    }

    internal fun schedule(context: Context) {
        runCatching {
            val request = OneTimeWorkRequestBuilder<JarvisCrashReportUploadWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_WORK, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }.onFailure {
            JarvisDiagnostics.record(context, "SUPABASE_CRASH_REPORT_SCHEDULE_FAILED",
                it.javaClass.simpleName + ": " + (it.message ?: "unknown") +
                    "; pending=" + pendingFiles(context).size)
        }
    }
}

class JarvisCrashReportUploadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val pending = JarvisCrashReportOutbox.pendingFiles(applicationContext).take(20)
        if (pending.isEmpty()) return Result.success()

        var connection: HttpURLConnection? = null
        return try {
            val rows = JSONArray()
            val nativeTraces = JSONArray()
            pending.forEach { file ->
                val report = JSONObject(file.readText(Charsets.UTF_8))
                val encodedTrace = report.optString("native_trace_gzip_base64")
                if (encodedTrace.isNotBlank()) {
                    nativeTraces.put(JSONObject()
                        .put("event_id", report.getString("event_id"))
                        .put("installation_id", report.getString("installation_id"))
                        .put("app_version", report.getString("app_version"))
                        .put("device_model", report.getString("device_model"))
                        .put("trace_format", "android-native-tombstone-gzip-base64")
                        .put("trace_bytes", report.optInt("native_trace_bytes"))
                        .put("trace_gzip_base64", encodedTrace))
                }
                report.remove("native_trace_gzip_base64")
                report.remove("native_trace_bytes")
                rows.put(report)
            }
            val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/') + "/rest/v1/"
            connection = (URL(baseUrl + "app_error_reports?on_conflict=event_id").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 12_000
                readTimeout = 20_000
                doOutput = true
                setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                // Publishable keys are not JWTs: send only apikey, never Authorization: Bearer.
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Prefer", "resolution=ignore-duplicates,return=minimal")
            }
            connection.outputStream.use { it.write(rows.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            if (code !in 200..299) {
                val response = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                JarvisDiagnostics.record(applicationContext, "SUPABASE_CRASH_REPORT_UPLOAD_FAILED",
                    "http=" + code + "; response=" + response.take(500))
                return Result.retry()
            }
            connection.disconnect()
            connection = null

            // Upload native tombstones separately so the normal report table stays small
            // and the owner-only table can retain the original binary trace for analysis.
            if (nativeTraces.length() > 0) {
                connection = (URL(baseUrl + "app_error_report_native_traces?on_conflict=event_id").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 12_000
                    readTimeout = 30_000
                    doOutput = true
                    setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Prefer", "resolution=ignore-duplicates,return=minimal")
                }
                connection.outputStream.use { it.write(nativeTraces.toString().toByteArray(Charsets.UTF_8)) }
                val traceCode = connection.responseCode
                if (traceCode !in 200..299) {
                    val response = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                    JarvisDiagnostics.record(applicationContext, "SUPABASE_NATIVE_TRACE_UPLOAD_FAILED",
                        "http=" + traceCode + "; response=" + response.take(500))
                    return Result.retry()
                }
                JarvisDiagnostics.record(applicationContext, "SUPABASE_NATIVE_TRACES_UPLOADED",
                    "count=" + nativeTraces.length() + "; http=" + traceCode)
            }
            pending.forEach { it.delete() }
            JarvisDiagnostics.record(applicationContext, "SUPABASE_CRASH_REPORTS_UPLOADED",
                "count=" + pending.size + "; http=" + code + "; nativeTraces=" + nativeTraces.length())
            if (JarvisCrashReportOutbox.pendingFiles(applicationContext).isNotEmpty()) {
                JarvisCrashReportOutbox.schedule(applicationContext)
            }
            Result.success()
        } catch (error: Exception) {
            JarvisDiagnostics.record(applicationContext, "SUPABASE_CRASH_REPORT_UPLOAD_EXCEPTION",
                error.javaClass.simpleName + ": " + (error.message ?: "unknown"))
            Result.retry()
        } finally {
            connection?.disconnect()
        }
    }
}
