package com.worklyindia.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

/** Live snapshot of the latest public Workly jobs for the Android home screen. */
class WorklyJobsWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val jobs = fetchLatestJobs()
                ids.forEach { renderWidget(context, manager, it, jobs) }
            } catch (_: Exception) {
                ids.forEach { renderWidget(context, manager, it, emptyList(), failed = true) }
            } finally {
                pendingResult.finish()
            }
        }
    }

    private data class JobItem(val id: String, val title: String, val location: String, val salary: String)

    private fun fetchLatestJobs(): List<JobItem> {
        val endpoint = "https://jubwzelupbntbetpajqb.supabase.co/rest/v1/jobs" +
            "?select=id,title,location,salary_range&status=eq.active&visibility=eq.public" +
            "&order=published_at.desc.nullslast,created_at.desc&limit=3"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 10000
            setRequestProperty("apikey", SUPABASE_PUBLISHABLE_KEY)
            setRequestProperty("Authorization", "Bearer $SUPABASE_PUBLISHABLE_KEY")
            setRequestProperty("Accept", "application/json")
        }
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IllegalStateException("Jobs endpoint returned HTTP $status")
            val array = JSONArray(connection.inputStream.bufferedReader().use { it.readText() })
            return (0 until array.length()).mapNotNull { index ->
                val row = array.optJSONObject(index) ?: return@mapNotNull null
                val id = row.optString("id").takeIf { it.isNotBlank() } ?: return@mapNotNull null
                JobItem(id, row.optString("title", "Latest opportunity").take(90),
                    row.optString("location", "India").take(70), row.optString("salary_range").take(55))
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun renderWidget(context: Context, manager: AppWidgetManager, widgetId: Int,
        jobs: List<JobItem>, failed: Boolean = false) {
        val views = RemoteViews(context.packageName, R.layout.workly_jobs_widget)
        views.setTextViewText(R.id.workly_widget_status, when {
            failed -> "Couldn't refresh jobs • Tap to browse"
            jobs.isEmpty() -> "No public jobs available right now"
            else -> "Latest opportunities • ${jobs.size} shown"
        })
        val titleIds = listOf(R.id.workly_job_1_title, R.id.workly_job_2_title, R.id.workly_job_3_title)
        val metaIds = listOf(R.id.workly_job_1_meta, R.id.workly_job_2_meta, R.id.workly_job_3_meta)
        val rowIds = listOf(R.id.workly_job_1, R.id.workly_job_2, R.id.workly_job_3)
        titleIds.indices.forEach { index ->
            val job = jobs.getOrNull(index)
            if (job == null) {
                views.setTextViewText(titleIds[index], if (index == 0 && jobs.isEmpty()) "Browse all jobs" else "")
                views.setTextViewText(metaIds[index], "")
                views.setViewVisibility(rowIds[index],
                    if (index == 0 && jobs.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE)
            } else {
                views.setTextViewText(titleIds[index], job.title)
                views.setTextViewText(metaIds[index],
                    listOf(job.location, job.salary).filter { it.isNotBlank() }.joinToString("  •  "))
                views.setViewVisibility(rowIds[index], android.view.View.VISIBLE)
                val intent = Intent(context, MainActivity::class.java).apply {
                    action = Intent.ACTION_VIEW
                    data = Uri.parse("https://worklyindia.devs.surf/job/${job.id}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                views.setOnClickPendingIntent(rowIds[index], PendingIntent.getActivity(context,
                    widgetId * 10 + index + 1, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            }
        }
        val browse = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("https://worklyindia.devs.surf/jobs/latest")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        views.setOnClickPendingIntent(R.id.workly_widget_button, PendingIntent.getActivity(context,
            widgetId * 10, browse, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        val refresh = Intent(context, WorklyJobsWidgetProvider::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(widgetId))
        }
        views.setOnClickPendingIntent(R.id.workly_widget_refresh, PendingIntent.getBroadcast(context,
            widgetId * 100, refresh, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        manager.updateAppWidget(widgetId, views)
    }

    companion object {
        private const val SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
    }
}
