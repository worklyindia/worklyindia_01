package com.worklyindia.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// Festival names are read from the annual Supabase-backed local cache; show them only on the festival day.
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
  val todayEvents = mutableListOf<String>()
  for (i in 0 until rows.length()) {
   val row = rows.optJSONObject(i) ?: continue
   if (row.optString("date") != today) continue
   val name = row.optString("name").trim()
   if (name.isNotBlank() && name !in todayEvents) todayEvents.add(name)
  }
  todayEvents.sort()

  ids.forEach { id ->
   val views = RemoteViews(context.packageName, R.layout.workly_datetime_widget)
   views.setTextViewText(R.id.workly_datetime_greeting, greeting)
   views.setString(R.id.workly_datetime_time, "setTimeZone", "Asia/Kolkata")
   views.setString(R.id.workly_datetime_seconds, "setTimeZone", "Asia/Kolkata")
   views.setString(R.id.workly_datetime_date, "setTimeZone", "Asia/Kolkata")

   // No upcoming-festival placeholder: the festival area stays hidden on ordinary days.
   views.setViewVisibility(R.id.workly_festival_row_1, if (todayEvents.isNotEmpty()) View.VISIBLE else View.GONE)
   views.setViewVisibility(R.id.workly_festival_row_2, if (todayEvents.size > 1) View.VISIBLE else View.GONE)
   if (todayEvents.isNotEmpty()) {
    views.setTextViewText(R.id.workly_festival_name, todayEvents[0])
    views.setViewVisibility(R.id.workly_festival_date, View.GONE)
   }
   if (todayEvents.size > 1) {
    views.setTextViewText(R.id.workly_festival_name_2, todayEvents[1])
    views.setViewVisibility(R.id.workly_festival_date_2, View.GONE)
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
