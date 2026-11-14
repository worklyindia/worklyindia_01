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
        OfflineJobsDatabase.getInstance(context).runInTransaction {
            OfflineJobsDatabase.getInstance(context).publicJobsDao().replaceAll(safeRows)
        }
        true
    }.getOrDefault(false)

    fun getPublicJobs(context: Context): List<Job> = runCatching {
        OfflineJobsDatabase.getInstance(context).publicJobsDao().getAll().map { row ->
            Job(row.id, row.title, row.company, row.location, row.salary,
                row.jobType, row.experience, row.category, row.description, row.requirements)
        }
    }.getOrDefault(emptyList())

    fun lastSyncedAt(context: Context): Long = WorklyAppSettings.lastPublicJobsSyncAt(context)
}
