package com.worklyindia.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Room-backed, device-local snapshot of public job data only. */
object WorklyOfflineDataStore {
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

    fun savePublicJobs(context: Context, rows: JSONArray): Boolean = runCatching {
        val safeRows = ArrayList<OfflinePublicJobEntity>()
        for (index in 0 until rows.length().coerceAtMost(50)) {
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optString("id").takeIf { it.isNotBlank() } ?: continue
            safeRows += OfflinePublicJobEntity(
                id = id.take(100),
                title = row.optString("title").take(120),
                company = row.optString("api_company_name").take(100),
                location = row.optString("location").take(100),
                salary = row.optString("salary_range").take(80),
                jobType = row.optString("job_type").take(60),
                experience = row.optString("experience_level").take(60),
                category = row.optString("category").take(80),
                description = row.optString("description").take(5000),
                requirements = row.optString("requirements").take(2500)
            )
        }
        if (safeRows.isEmpty()) return false
        OfflineJobsDatabase.getInstance(context).publicJobsDao().replaceAll(safeRows)
        // Remove the legacy snapshot only after the Room transaction succeeds.
        context.getSharedPreferences("workly_offline_data_v1", Context.MODE_PRIVATE)
            .edit().clear().apply()
        true
    }.getOrDefault(false)

    fun getPublicJobs(context: Context): List<Job> = runCatching {
        val database = OfflineJobsDatabase.getInstance(context)
        var rows = database.publicJobsDao().getAll()
        if (rows.isEmpty()) {
            // One-time migration preserves the existing SharedPreferences cache on upgrade.
            val legacy = context.getSharedPreferences("workly_offline_data_v1", Context.MODE_PRIVATE)
            val legacyJson = legacy.getString("public_jobs_json", null)
            if (!legacyJson.isNullOrBlank()) {
                val legacyRows = JSONArray(legacyJson)
                if (savePublicJobs(context, legacyRows)) {
                    val oldTimestamp = legacy.getLong("public_jobs_synced_at", 0L)
                    if (oldTimestamp > 0L) WorklyAppSettings.setLastPublicJobsSyncAt(context, oldTimestamp)
                    rows = database.publicJobsDao().getAll()
                }
            }
        }
        rows.map { row ->
            Job(row.id, row.title, row.company, row.location, row.salary,
                row.jobType, row.experience, row.category, row.description, row.requirements)
        }
    }.getOrDefault(emptyList())

    fun lastSyncedAt(context: Context): Long {
        val stored = WorklyAppSettings.lastPublicJobsSyncAt(context)
        if (stored > 0L) return stored
        val legacy = context.getSharedPreferences("workly_offline_data_v1", Context.MODE_PRIVATE)
            .getLong("public_jobs_synced_at", 0L)
        if (legacy > 0L) WorklyAppSettings.setLastPublicJobsSyncAt(context, legacy)
        return legacy
    }
}
