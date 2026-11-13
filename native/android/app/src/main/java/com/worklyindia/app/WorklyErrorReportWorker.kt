package com.worklyindia.app

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/** Uploads local reports when online; only server acknowledgement clears the outbox. */
class WorklyErrorReportWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val pending = WorklyErrorReportStore.pending(applicationContext, 20)
        if (pending.isEmpty()) return Result.success()
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL("$SUPABASE_URL/rest/v1/app_error_reports?on_conflict=event_id").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 12_000
                readTimeout = 20_000
                doOutput = true
                setRequestProperty("apikey", SUPABASE_PUBLISHABLE_KEY)
                // Send the publishable key in Authorization too so PostgREST resolves the anon role.
                setRequestProperty("Authorization", "Bearer $SUPABASE_PUBLISHABLE_KEY")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Prefer", "resolution=ignore-duplicates,return=minimal")
            }
            val rows = JSONArray()
            pending.forEach { (_, payload) -> rows.put(org.json.JSONObject(payload)) }
            connection.outputStream.use { it.write(rows.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            if (status in 200..299) {
                WorklyErrorReportStore.acknowledge(applicationContext, pending.map { it.first })
                if (WorklyErrorReportStore.pendingCount(applicationContext) > 0) enqueue(applicationContext)
                Log.i(TAG, "Uploaded ${pending.size} technical error report(s)")
                Result.success()
            } else {
                val responseBody = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                Log.w(TAG, "Supabase error-report upload returned HTTP $status: ${responseBody.take(500)}")
                Result.retry()
            }
        } catch (error: Exception) {
            Log.w(TAG, "Error-report upload failed; reports remain in local outbox", error)
            Result.retry()
        } finally { connection?.disconnect() }
    }

    companion object {
        private const val TAG = "WorklyErrorUpload"
        private const val SUPABASE_URL = "https://jubwzelupbntbetpajqb.supabase.co"
        private const val SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
        private const val PERIODIC_WORK = "workly-error-report-periodic-upload"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<WorklyErrorReportWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork("workly-error-report-upload", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<WorklyErrorReportWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}
