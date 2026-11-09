package com.worklyindia.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** A single, system-theme-aware India date and time widget. TextClock handles live seconds. */
class WorklyDateTimeWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        updateWidgets(context, manager, ids)
    }

    private fun updateWidgets(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val greetingFormat = SimpleDateFormat("HH", Locale.ENGLISH).apply {
            timeZone = indiaTimeZone()
        }
        val dateFormat = SimpleDateFormat("EEEE, dd MMMM yyyy", Locale.ENGLISH).apply {
            timeZone = indiaTimeZone()
        }
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
            views.setTextViewText(R.id.workly_datetime_date, dateFormat.format(now))
            views.setString(R.id.workly_datetime_time, "setTimeZone", "Asia/Kolkata")

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

    private fun indiaTimeZone(): TimeZone = TimeZone.getTimeZone("Asia/Kolkata")
}
