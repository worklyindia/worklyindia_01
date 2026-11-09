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
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/** Background sync: does not launch WebView or open the Festivals page. */
class WorklyFestivalSyncWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        var connection: HttpURLConnection? = null
        return try {
            val filter = URLEncoder.encode("Google Calendar API JSON", "UTF-8")
            val endpoint = "$SUPABASE_URL/rest/v1/google_calendar_api?select=data&name=eq.$filter&limit=1"
            connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 12_000
                readTimeout = 12_000
                setRequestProperty("apikey", SUPABASE_PUBLISHABLE_KEY)
                setRequestProperty("Accept", "application/json")
            }
            val status = connection.responseCode
            if (status !in 200..299) {
                Log.w(TAG, "Supabase festival sync returned HTTP $status")
                return if (status >= 500 || status == 429) Result.retry() else Result.success()
            }
            val response = JSONArray(connection.inputStream.bufferedReader().use { it.readText() })
            if (response.length() == 0) return Result.retry()
            val row = response.optJSONObject(0) ?: return Result.retry()
            val data = row.optJSONObject("data")
                ?: runCatching { JSONObject(row.optString("data")) }.getOrNull()
                ?: return Result.retry()
            val source = data.optJSONArray("festivals") ?: return Result.retry()
            val expanded = expandFestivalDays(source)
            if (expanded.length() == 0) return Result.retry()
            if (WorklyFestivalWidgetBridge.saveFestivals(applicationContext, expanded.toString())) Result.success()
            else Result.retry()
        } catch (e: Exception) {
            Log.w(TAG, "Background festival sync failed; keeping offline cache", e)
            Result.retry()
        } finally {
            connection?.disconnect()
        }
    }

    private fun expandFestivalDays(source: JSONArray): JSONArray {
        val output = LinkedHashMap<String, JSONObject>()
        for (i in 0 until source.length().coerceAtMost(500)) {
            val item = source.optJSONObject(i) ?: continue
            val date = item.optString("date")
            val name = item.optString("name").trim()
            if (!date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) || name.isBlank()) continue
            val isStart = name.contains("navratri", true) &&
                !Regex("\\b(last|end|day\\s*[2-9])\\b", RegexOption.IGNORE_CASE).containsMatchIn(name)
            if (!isStart) {
                output["$date|${name.lowercase(Locale.ROOT)}"] = JSONObject().put("date", date).put("name", name)
                continue
            }
            val base = name.replace(Regex("^first\\s+day\\s+of\\s+", RegexOption.IGNORE_CASE), "")
                .replace(Regex("\\s+day\\s*1\\s*$", RegexOption.IGNORE_CASE), "").trim()
            val parts = date.split("-").map { it.toInt() }
            val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
                set(parts[0], parts[1] - 1, parts[2], 0, 0, 0)
                set(Calendar.MILLISECOND, 0)
            }
            for (day in 1..9) {
                if (day > 1) calendar.add(Calendar.DAY_OF_MONTH, 1)
                val dayDate = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }.format(calendar.time)
                val dayName = "$base Day $day"
                output["$dayDate|${dayName.lowercase(Locale.ROOT)}"] =
                    JSONObject().put("date", dayDate).put("name", dayName)
            }
        }
        return JSONArray().also { array -> output.values.sortedBy { it.optString("date") }.forEach(array::put) }
    }

    companion object {
        private const val TAG = "WorklyFestivalSync"
        private const val SUPABASE_URL = "https://jubwzelupbntbetpajqb.supabase.co"
        private const val SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
        private const val WORK_NAME = "workly-festival-calendar-sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
            val periodic = PeriodicWorkRequestBuilder<WorklyFestivalSyncWorker>(12, TimeUnit.HOURS)
                .setConstraints(constraints).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, periodic
            )
            val initial = androidx.work.OneTimeWorkRequestBuilder<WorklyFestivalSyncWorker>()
                .setConstraints(constraints).build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "$WORK_NAME-initial", androidx.work.ExistingWorkPolicy.KEEP, initial
            )
        }
    }
}
