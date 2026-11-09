package com.worklyindia.app

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject

class WorklyFestivalWidgetBridge(private val context: Context) {
    @JavascriptInterface
    fun cacheFestivals(rawJson: String): Boolean = saveFestivals(context, rawJson)

    companion object {
        const val PREFS = "workly_festival_widget_cache"
        const val KEY_FESTIVALS = "festivals_json"
        const val KEY_SYNCED_AT = "synced_at"
        const val KEY_SYNC_YEAR = "sync_year"

        fun saveFestivals(context: Context, rawJson: String): Boolean = try {
            if (rawJson.length > 262144) return false
            val input = JSONArray(rawJson)
            val clean = JSONArray()
            for (i in 0 until minOf(input.length(), 500)) {
                val row = input.optJSONObject(i) ?: continue
                val date = row.optString("date")
                val name = row.optString("name").trim().take(120)
                if (date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && name.isNotBlank()) {
                    clean.put(JSONObject().put("date", date).put("name", name))
                }
            }
            if (clean.length() == 0) return false
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_FESTIVALS, clean.toString())
                .putLong(KEY_SYNCED_AT, System.currentTimeMillis())
                .commit()
            WorklyDateTimeWidgetProvider.refreshAll(context)
            true
        } catch (e: Exception) {
            android.util.Log.w("WorklyFestivalWidget", "Festival cache sync failed", e)
            false
        }
    }
}
