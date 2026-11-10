package com.worklyindia.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import android.widget.RemoteViews
import org.json.JSONArray

// Mirrors the website's festival selection: show every event on today, otherwise every event on the next festival date.
class WorklyDateTimeWidgetProvider : AppWidgetProvider() {
 override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
  val tz = TimeZone.getTimeZone("Asia/Kolkata")
  val calendar = java.util.Calendar.getInstance(tz)
  val hour = calendar.get(java.util.Calendar.HOUR_OF_DAY)
  val greeting = when (hour) {
   in 5..11 -> "☀  Good Morning"
   in 12..16 -> "☀  Good Afternoon"
   in 17..20 -> "☾  Good Evening"
   else -> "☾  Good Night"
  }
  val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = tz }.format(Date())
  val raw = context.getSharedPreferences(WorklyFestivalWidgetBridge.PREFS, Context.MODE_PRIVATE)
   .getString(WorklyFestivalWidgetBridge.KEY_FESTIVALS, null)
  val rows = runCatching { JSONArray(raw ?: "[]") }.getOrDefault(JSONArray())
  val events = mutableListOf<Pair<String, String>>()
  for (i in 0 until rows.length()) {
   val row = rows.optJSONObject(i) ?: continue
   val date = row.optString("date")
   val name = row.optString("name").trim()
   if (date >= today && date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && name.isNotBlank()) {
    events.add(date to name)
   }
  }
  events.sortWith(compareBy<Pair<String, String>> { it.first }.thenBy { it.second })
  val todayEvents = events.filter { it.first == today }
  val selectedDate = todayEvents.firstOrNull()?.first ?: events.firstOrNull()?.first
  val selected = if (selectedDate == null) emptyList() else events.filter { it.first == selectedDate }.take(2)
  val formattedDate = selectedDate?.let { date ->
   runCatching {
    val parsed = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = tz }.parse(date)
    parsed?.let { SimpleDateFormat("EEE, dd MMM yyyy", Locale.ENGLISH).apply { timeZone = tz }.format(it) }
   }.getOrNull()
  } ?: "Festival calendar"

  ids.forEach { id ->
   val views = RemoteViews(context.packageName, R.layout.workly_datetime_widget)
   views.setTextViewText(R.id.workly_datetime_greeting, greeting)
   views.setString(R.id.workly_datetime_time, "setTimeZone", "Asia/Kolkata")
   views.setString(R.id.workly_datetime_seconds, "setTimeZone", "Asia/Kolkata")
   views.setString(R.id.workly_datetime_date, "setTimeZone", "Asia/Kolkata")
   if (selected.isNotEmpty()) {
    views.setViewVisibility(R.id.workly_festival_row_1, View.VISIBLE)
    views.setTextViewText(R.id.workly_festival_name, selected[0].second)
    views.setTextViewText(R.id.workly_festival_date, formattedDate)
    if (selected.size > 1) {
     views.setViewVisibility(R.id.workly_festival_row_2, View.VISIBLE)
     views.setTextViewText(R.id.workly_festival_name_2, selected[1].second)
     views.setTextViewText(R.id.workly_festival_date_2, formattedDate)
    } else {
     views.setViewVisibility(R.id.workly_festival_row_2, View.GONE)
    }
   } else {
    views.setViewVisibility(R.id.workly_festival_row_1, View.VISIBLE)
    views.setViewVisibility(R.id.workly_festival_row_2, View.GONE)
    views.setTextViewText(R.id.workly_festival_name, "No upcoming festival")
    views.setTextViewText(R.id.workly_festival_date, "")
   }
   val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://worklyindia.devs.surf/festivals")).apply {
    setPackage(context.packageName)
    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
   }
   val pending = PendingIntent.getActivity(
    context, id + 7100, intent,
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
   )
   views.setOnClickPendingIntent(R.id.workly_festival_open, pending)
   manager.updateAppWidget(id, views)
  }
 }
 companion object {
  fun refreshAll(context: Context) {
   val manager = AppWidgetManager.getInstance(context)
   val ids = manager.getAppWidgetIds(ComponentName(context, WorklyDateTimeWidgetProvider::class.java))
   if (ids.isNotEmpty()) WorklyDateTimeWidgetProvider().onUpdate(context, manager, ids)
  }
 }
}
