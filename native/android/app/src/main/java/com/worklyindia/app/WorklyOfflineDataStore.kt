package com.worklyindia.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Device-local snapshot of public job listings. Never stores private account data. */
object WorklyOfflineDataStore {
    private const val PREFS = "workly_offline_data_v1"
    private const val KEY_JOBS = "public_jobs_json"
    private const val KEY_SYNCED_AT = "public_jobs_synced_at"

    data class Job(
        val id: String,
        val title: String,
        val company: String,
        val location: String,
        val salary: String,
        val employmentType: String
    )

    fun savePublicJobs(context: Context, rows: JSONArray): Boolean {
        if (rows.length() == 0) return false
        val safeRows = JSONArray()
        for (index in 0 until rows.length().coerceAtMost(30)) {
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optString("id").takeIf { it.isNotBlank() } ?: continue
            safeRows.put(JSONObject()
                .put("id", id.take(100))
                .put("title", row.optString("title").take(120))
                .put("company", row.optString("company_name").take(100))
                .put("location", row.optString("location").take(100))
                .put("salary", row.optString("salary_range").take(80))
                .put("employment_type", row.optString("employment_type").take(50)))
        }
        if (safeRows.length() == 0) return false
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_JOBS, safeRows.toString())
            .putLong(KEY_SYNCED_AT, System.currentTimeMillis())
            .commit()
    }

    fun getPublicJobs(context: Context): List<Job> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_JOBS, null) ?: return emptyList()
        return runCatching {
            val rows = JSONArray(raw)
            (0 until rows.length()).mapNotNull { index ->
                val row = rows.optJSONObject(index) ?: return@mapNotNull null
                val id = row.optString("id").takeIf { it.isNotBlank() } ?: return@mapNotNull null
                Job(id, row.optString("title"), row.optString("company"),
                    row.optString("location"), row.optString("salary"),
                    row.optString("employment_type"))
            }
        }.getOrDefault(emptyList())
    }

    fun lastSyncedAt(context: Context): Long =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_SYNCED_AT, 0L)
}
