package com.worklyindia.app

import android.app.AlarmManager
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
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Native date, live clock and Indian festival widget. */
class WorklyDateTimeWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        updateWidgets(context, manager, ids)
        refreshFestivalData(context)
        scheduleNextMinute(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_MINUTE_TICK || intent.action in SYSTEM_REFRESH_ACTIONS) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, WorklyDateTimeWidgetProvider::class.java)
            )
            updateWidgets(context, manager, ids)
            if (intent.action == ACTION_MINUTE_TICK) scheduleNextMinute(context)
        }
    }

    private fun updateWidgets(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val zone = indiaTimeZone()
        val dateFormat = SimpleDateFormat("EEEE, dd MMMM yyyy", Locale.ENGLISH).apply { timeZone = zone }
        val now = Date()
        val calendar = Calendar.getInstance(zone).apply { time = now }
        val hour24 = calendar.get(Calendar.HOUR_OF_DAY)
        val greeting = when (hour24) {
            in 5..11 -> "Good Morning"
            in 12..16 -> "Good Afternoon"
            in 17..19 -> "Good Evening"
            else -> "Good Night"
        }
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone }.format(now)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val festivalName = prefs.getString(KEY_FESTIVAL_NAME, null)
        val festivalDate = prefs.getString(KEY_FESTIVAL_DATE, null)
        val validFestival = !festivalName.isNullOrBlank() && !festivalDate.isNullOrBlank() && festivalDate >= today

        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.workly_datetime_widget)
            views.setTextViewText(R.id.workly_datetime_greeting, greeting)
            // TextClock updates on the launcher itself, independently for hours/minutes
            // and seconds. Both clocks are explicitly pinned to India Standard Time.
            views.setString(R.id.workly_datetime_time, "setTimeZone", "Asia/Kolkata")
            views.setString(R.id.workly_datetime_seconds, "setTimeZone", "Asia/Kolkata")
            views.setTextViewText(R.id.workly_datetime_ampm, if (hour24 >= 12) "PM" else "AM")
            views.setTextViewText(R.id.workly_datetime_date, dateFormat.format(now))

            if (validFestival) {
                val isToday = festivalDate == today
                views.setTextViewText(
                    R.id.workly_datetime_festival_label,
                    if (isToday) "TODAY'S FESTIVAL" else "UPCOMING FESTIVAL"
                )
                views.setTextViewText(R.id.workly_datetime_festival_name, festivalName)
                views.setTextViewText(
                    R.id.workly_datetime_festival_when,
                    if (isToday) "Today" else formatFestivalDate(festivalDate!!)
                )
            } else {
                views.setTextViewText(R.id.workly_datetime_festival_label, "INDIAN FESTIVALS")
                views.setTextViewText(R.id.workly_datetime_festival_name, "Explore the festival calendar")
                views.setTextViewText(R.id.workly_datetime_festival_when, "Open")
            }

            val open = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val rootPending = PendingIntent.getActivity(
                context, id + 7000, open,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.workly_datetime_root, rootPending)
            setInternalLink(context, views, R.id.workly_datetime_calendar, id + 7004, "/festivals")
            setInternalLink(context, views, R.id.workly_datetime_festival_row, id + 7005, "/festivals")
            manager.updateAppWidget(id, views)
        }
    }

    private fun setInternalLink(
        context: Context,
        views: RemoteViews,
        viewId: Int,
        requestCode: Int,
        path: String
    ) {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("https://worklyindia.devs.surf$path")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(viewId, pending)
    }

    /**
     * Read the same public calendar record used by the website's Festivals page.
     * Cache it locally so minute clock refreshes never cause repeated API calls.
     */
    private fun refreshFestivalData(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val lastFetch = prefs.getLong(KEY_LAST_FETCH, 0L)
        if (now - lastFetch < FESTIVAL_REFRESH_INTERVAL_MS) return
        // Persist before starting IO to prevent duplicate concurrent refreshes.
        prefs.edit().putLong(KEY_LAST_FETCH, now).apply()

        CoroutineScope(Dispatchers.IO).launch {
            var connection: HttpURLConnection? = null
            try {
                val url = URL(
                    "$SUPABASE_URL/rest/v1/google_calendar_api" +
                        "?select=data&name=eq.Google%20Calendar%20API%20JSON"
                )
                connection = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 10000
                    readTimeout = 10000
                    setRequestProperty("apikey", SUPABASE_PUBLISHABLE_KEY)
                    setRequestProperty("Authorization", "Bearer $SUPABASE_PUBLISHABLE_KEY")
                    setRequestProperty("Accept", "application/json")
                }
                if (connection.responseCode !in 200..299) {
                    throw IllegalStateException("Festival calendar request failed: ${connection.responseCode}")
                }
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val rows = JSONArray(body)
                val source = rows.optJSONObject(0)?.optJSONObject("data")
                    ?.optJSONArray("festivals") ?: JSONArray()
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                    .apply { timeZone = indiaTimeZone() }.format(Date())
                val upcoming = (0 until source.length()).mapNotNull { index ->
                    source.optJSONObject(index)?.let { item ->
                        val date = item.optString("date")
                        val name = item.optString("name")
                        if (date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && name.isNotBlank() && date >= today) {
                            date to name
                        } else null
                    }
                }.sortedBy { it.first }.firstOrNull()

                if (upcoming != null) {
                    prefs.edit()
                        .putString(KEY_FESTIVAL_DATE, upcoming.first)
                        .putString(KEY_FESTIVAL_NAME, upcoming.second)
                        .apply()
                } else {
                    prefs.edit().remove(KEY_FESTIVAL_DATE).remove(KEY_FESTIVAL_NAME).apply()
                }
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(
                    android.content.ComponentName(context, WorklyDateTimeWidgetProvider::class.java)
                )
                updateWidgets(context, manager, ids)
            } catch (error: Exception) {
                android.util.Log.w(TAG, "Could not refresh festival widget data", error)
                // Allow retry after a shorter backoff if the API is temporarily unavailable.
                prefs.edit().putLong(KEY_LAST_FETCH, System.currentTimeMillis() - RETRY_AFTER_FAILURE_MS).apply()
            } finally {
                connection?.disconnect()
            }
        }
    }

    private fun formatFestivalDate(isoDate: String): String {
        return try {
            val parsed = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                isLenient = false
                timeZone = indiaTimeZone()
            }.parse(isoDate)
            if (parsed == null) isoDate
            else SimpleDateFormat("dd MMM", Locale.ENGLISH).apply { timeZone = indiaTimeZone() }.format(parsed)
        } catch (_: Exception) {
            isoDate
        }
    }

    private fun scheduleNextMinute(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val tick = Intent(context, WorklyDateTimeWidgetProvider::class.java).setAction(ACTION_MINUTE_TICK)
        val pending = PendingIntent.getBroadcast(
            context, 7001, tick,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val nextMinute = (System.currentTimeMillis() / 60_000L + 1L) * 60_000L
        alarmManager.setInexactRepeating(AlarmManager.RTC, nextMinute, 60_000L, pending)
    }

    private fun indiaTimeZone(): TimeZone = TimeZone.getTimeZone("Asia/Kolkata")

    companion object {
        private const val TAG = "WorklyFestivalWidget"
        private const val ACTION_MINUTE_TICK = "com.worklyindia.app.ACTION_DATETIME_WIDGET_TICK"
        private val SYSTEM_REFRESH_ACTIONS = setOf(
            Intent.ACTION_CONFIGURATION_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_DATE_CHANGED
        )
        private const val PREFS = "workly_home_widget"
        private const val KEY_FESTIVAL_NAME = "festival_name"
        private const val KEY_FESTIVAL_DATE = "festival_date"
        private const val KEY_LAST_FETCH = "festival_last_fetch"
        private const val FESTIVAL_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000L
        private const val RETRY_AFTER_FAILURE_MS = 30 * 60 * 1000L
        private const val SUPABASE_URL = "https://jubwzelupbntbetpajqb.supabase.co"
        private const val SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
    }
}
