package com.worklyindia.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Device-local, read-only snapshot of public job data. No applicant/employer account data is stored. */
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
        val jobType: String,
        val experience: String,
        val category: String,
        val description: String,
        val requirements: String
    )

    fun savePublicJobs(context: Context, rows: JSONArray): Boolean {
        if (rows.length() == 0) return false
        val safeRows = JSONArray()
        for (index in 0 until rows.length().coerceAtMost(50)) {
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optString("id").takeIf { it.isNotBlank() } ?: continue
            safeRows.put(JSONObject()
                .put("id", id.take(100))
                .put("title", row.optString("title").take(120))
                .put("company", row.optString("api_company_name").take(100))
                .put("location", row.optString("location").take(100))
                .put("salary", row.optString("salary_range").take(80))
                .put("job_type", row.optString("job_type").take(60))
                .put("experience", row.optString("experience_level").take(60))
                .put("category", row.optString("category").take(80))
                .put("description", row.optString("description").take(5000))
                .put("requirements", row.optString("requirements").take(2500)))
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
                    row.optString("job_type"), row.optString("experience"),
                    row.optString("category"), row.optString("description"),
                    row.optString("requirements"))
            }
        }.getOrDefault(emptyList())
    }

    fun lastSyncedAt(context: Context): Long =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_SYNCED_AT, 0L)
}
