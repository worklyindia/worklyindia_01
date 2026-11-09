package com.worklyindia.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Home-screen clock and calendar card, always rendered in India Standard Time. */
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
        val timeFormat = SimpleDateFormat("hh:mm:ss a", Locale.ENGLISH).apply { timeZone = indiaTimeZone() }
        val dateFormat = SimpleDateFormat("EEEE, dd MMMM yyyy", Locale.ENGLISH).apply { timeZone = indiaTimeZone() }
        val greetingFormat = SimpleDateFormat("HH", Locale.ENGLISH).apply { timeZone = indiaTimeZone() }
        val now = Date()
        val hour = greetingFormat.format(now).toIntOrNull() ?: 12
        val greeting = when (hour) {
            in 5..11 -> "Good Morning"
            in 12..16 -> "Good Afternoon"
            in 17..19 -> "Good Evening"
            else -> "Good Night"
        }
        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.workly_datetime_widget)
            views.setTextViewText(R.id.workly_datetime_greeting, greeting)
            views.setTextViewText(R.id.workly_datetime_time, timeFormat.format(now))
            views.setTextViewText(R.id.workly_datetime_date, dateFormat.format(now))
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

    private fun scheduleNextMinute(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val tick = Intent(context, WorklyDateTimeWidgetProvider::class.java).setAction(ACTION_MINUTE_TICK)
        val pending = PendingIntent.getBroadcast(
            context, 7001, tick,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val nextMinute = (System.currentTimeMillis() / 60_000L + 1L) * 60_000L
        alarmManager.setInexactRepeating(
            AlarmManager.RTC, nextMinute, 60_000L, pending
        )
    }

    private fun indiaTimeZone(): TimeZone = TimeZone.getTimeZone("Asia/Kolkata")

    companion object {
        private const val ACTION_MINUTE_TICK = "com.worklyindia.app.ACTION_DATETIME_WIDGET_TICK"
    }
}
