package com.worklyindia.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Live jobs from the Workly India backend (public, read-only publishable key). */
data class Job(
    val id: String,
    val title: String,
    val company: String,
    val logoUrl: String?,
    val location: String,
    val salary: String,
    val type: String,
    val category: String,
    val experience: String,
    val description: String,
    val requirements: String,
    val benefits: String,
    val skills: List<String>,
    val openings: Int,
    val featured: Boolean,
    val externalApplyUrl: String?,
    val createdAt: String,
) {
    val webUrl: String get() = "${JobsApi.SITE}/job/$id"
}

object JobsApi {
    const val SITE = "https://worklyindia.devs.surf"
    private const val BASE = "https://jubwzelupbntbetpajqb.supabase.co/rest/v1"
    private const val KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
    private const val SELECT =
        "id,title,location,city,state,job_type,category,department,experience_level,salary_range," +
            "description,requirements,benefits,skills,openings,is_featured,external_apply_url,created_at," +
            "api_company_name,companies(company_name,logo_url)"

    suspend fun fetchJobs(search: String = "", category: String? = null, limit: Int = 50): List<Job> =
        withContext(Dispatchers.IO) {
            val q = StringBuilder("$BASE/jobs?select=${enc(SELECT)}&status=eq.active&visibility=eq.public")
            q.append("&order=is_featured.desc,created_at.desc&limit=$limit")
            if (!category.isNullOrBlank()) q.append("&category=eq.${enc(category)}")
            val s = search.trim().replace(Regex("[,()*%]"), " ").trim()
            if (s.isNotEmpty()) {
                val p = enc("*$s*")
                q.append("&or=(title.ilike.$p,location.ilike.$p,category.ilike.$p,api_company_name.ilike.$p)")
            }
            parse(JSONArray(get(q.toString())))
        }

    suspend fun fetchCategories(): List<String> = withContext(Dispatchers.IO) {
        val arr = JSONArray(get("$BASE/jobs?select=category&status=eq.active&visibility=eq.public&limit=500"))
        (0 until arr.length()).mapNotNull { arr.getJSONObject(it).optStr("category") }
            .groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.map { it.key }
    }

    private fun get(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15000; c.readTimeout = 20000
        c.setRequestProperty("apikey", KEY)
        c.setRequestProperty("Accept", "application/json")
        try {
            val code = c.responseCode
            val body = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.readText().orEmpty()
            if (code !in 200..299) throw IllegalStateException("Server error $code")
            return body
        } finally { c.disconnect() }
    }

    private fun parse(arr: JSONArray): List<Job> = (0 until arr.length()).map { i ->
        val o = arr.getJSONObject(i)
        val co = o.optJSONObject("companies")
        val loc = o.optStr("location") ?: listOfNotNull(o.optStr("city"), o.optStr("state")).joinToString(", ")
        Job(
            id = o.getString("id"),
            title = o.optStr("title") ?: "Job",
            company = co?.optStr("company_name") ?: o.optStr("api_company_name") ?: "Workly India",
            logoUrl = co?.optStr("logo_url"),
            location = loc.ifBlank { "India" },
            salary = o.optStr("salary_range") ?: "Salary not disclosed",
            type = o.optStr("job_type") ?: "Full Time",
            category = o.optStr("category") ?: o.optStr("department") ?: "",
            experience = o.optStr("experience_level") ?: "",
            description = htmlToText(o.optStr("description")),
            requirements = htmlToText(o.optStr("requirements")),
            benefits = htmlToText(o.optStr("benefits")),
            skills = parseSkills(o.opt("skills")),
            openings = o.optInt("openings", 1),
            featured = o.optBoolean("is_featured"),
            externalApplyUrl = o.optStr("external_apply_url"),
            createdAt = o.optStr("created_at") ?: "",
        )
    }

    private fun parseSkills(v: Any?): List<String> = when (v) {
        is JSONArray -> (0 until v.length()).map { v.getString(it) }
        is String -> v.trim('[', ']').split(",").map { it.trim().trim('\'', '"') }
        else -> emptyList()
    }.filter { it.isNotBlank() }

    fun htmlToText(html: String?): String {
        if (html.isNullOrBlank()) return ""
        return html
            .replace(Regex("(?i)<li[^>]*>"), "\n• ")
            .replace(Regex("(?i)</(p|h[1-6]|div|ul|ol)>|<br\\s*/?>"), "\n")
            .replace(Regex("<[^>]+>"), "")
            .replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<")
            .replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
            .replace(Regex("\n{3,}"), "\n\n").trim()
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")
    private fun JSONObject.optStr(k: String): String? =
        if (isNull(k)) null else optString(k).takeIf { it.isNotBlank() && it != "null" }
}
