package com.worklyindia.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Home-screen clock and quick links, rendered in India Standard Time. */
class WorklyDateTimeWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        updateWidgets(context, manager, ids)
        scheduleNextMinute(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_MINUTE_TICK) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, WorklyDateTimeWidgetProvider::class.java)
            )
            updateWidgets(context, manager, ids)
            scheduleNextMinute(context)
        }
    }

    private fun updateWidgets(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val zone = indiaTimeZone()
        val dateFormat = SimpleDateFormat("EEEE, dd MMMM yyyy", Locale.ENGLISH).apply { timeZone = zone }
        val now = Date()
        val calendar = Calendar.getInstance(zone).apply { time = now }
        val hour24 = calendar.get(Calendar.HOUR_OF_DAY)
        val hour12 = calendar.get(Calendar.HOUR).let { if (it == 0) 12 else it }
        val minute = calendar.get(Calendar.MINUTE)
        val second = calendar.get(Calendar.SECOND)
        val greeting = when (hour24) {
            in 5..11 -> "Good Morning"
            in 12..16 -> "Good Afternoon"
            in 17..19 -> "Good Evening"
            else -> "Good Night"
        }
        // Chronometer runs locally on the launcher every second; no one-second
        // background alarms or repeated widget broadcasts are required.
        val elapsedAtClockTime = (((hour12 * 60L + minute) * 60L + second) * 1000L) +
            calendar.get(Calendar.MILLISECOND)
        val chronometerBase = SystemClock.elapsedRealtime() - elapsedAtClockTime

        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.workly_datetime_widget)
            views.setTextViewText(R.id.workly_datetime_greeting, greeting)
            views.setChronometer(R.id.workly_datetime_time, chronometerBase, "%s", true)
            views.setTextViewText(R.id.workly_datetime_ampm,
                if (hour24 >= 12) "PM" else "AM")
            views.setTextViewText(R.id.workly_datetime_date, dateFormat.format(now))

            setQuickLink(context, views, R.id.workly_datetime_jobs, id + 7101, "/jobs/latest")
            setQuickLink(context, views, R.id.workly_datetime_activity, id + 7102, "/activity")
            setQuickLink(context, views, R.id.workly_datetime_alerts, id + 7103, "/job-alerts")

            val open = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pending = PendingIntent.getActivity(
                context, id + 7000, open,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.workly_datetime_root, pending)
            manager.updateAppWidget(id, views)
        }
    }

    private fun setQuickLink(context: Context, views: RemoteViews, viewId: Int, requestCode: Int, path: String) {
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
        private const val ACTION_MINUTE_TICK = "com.worklyindia.app.ACTION_DATETIME_WIDGET_TICK"
    }
}
