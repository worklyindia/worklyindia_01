package com.worklyindia.app

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/** Periodically snapshots public active jobs for read-only offline browsing. */
class WorklyOfflineJobsSyncWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        var connection: HttpURLConnection? = null
        return try {
            val endpoint = "$SUPABASE_URL/rest/v1/jobs" +
                "?select=id,title,api_company_name,location,salary_range,job_type,experience_level,category,description,requirements" +
                "&status=eq.active&visibility=eq.public" +
                "&order=published_at.desc.nullslast,created_at.desc&limit=50"
            connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 20_000
                setRequestProperty("apikey", SUPABASE_PUBLISHABLE_KEY)
                setRequestProperty("Authorization", "Bearer $SUPABASE_PUBLISHABLE_KEY")
                setRequestProperty("Accept", "application/json")
            }
            val status = connection.responseCode
            if (status !in 200..299) {
                Log.w(TAG, "Public jobs sync returned HTTP $status")
                return if (status == 429 || status >= 500) Result.retry() else Result.success()
            }
            val rows = JSONArray(connection.inputStream.bufferedReader().use { it.readText() })
            if (rows.length() == 0) return Result.success()
            if (WorklyOfflineDataStore.savePublicJobs(applicationContext, rows)) Result.success()
            else Result.retry()
        } catch (error: Exception) {
            Log.w(TAG, "Offline jobs sync failed; retaining the previous snapshot", error)
            Result.retry()
        } finally {
            connection?.disconnect()
        }
    }

    companion object {
        private const val TAG = "WorklyOfflineJobs"
        private const val SUPABASE_URL = "https://jubwzelupbntbetpajqb.supabase.co"
        private const val SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
        private const val WORK_NAME = "workly-offline-public-jobs-sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            // Periodic sync continues after the user closes Workly; CONNECTED permits Wi-Fi and mobile data.
            // Android may defer the exact run time for battery and data-saver policies.
            val request = PeriodicWorkRequestBuilder<WorklyOfflineJobsSyncWorker>(
                1, TimeUnit.HOURS
            ).setConstraints(constraints).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request
            )
            val initial = androidx.work.OneTimeWorkRequestBuilder<WorklyOfflineJobsSyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "$WORK_NAME-initial", androidx.work.ExistingWorkPolicy.KEEP, initial
            )
        }
    }
}
