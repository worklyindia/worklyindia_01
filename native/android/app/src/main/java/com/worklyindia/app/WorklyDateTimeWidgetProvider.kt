package com.worklyindia.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import java.util.Calendar
import java.util.TimeZone

/** Home-screen date, live clock and festival shortcut. TextClock updates seconds itself. */
class WorklyDateTimeWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val hour = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata")).get(Calendar.HOUR_OF_DAY)
        val greeting = when (hour) {
            in 5..11 -> "☀  Good Morning"
            in 12..16 -> "☀  Good Afternoon"
            in 17..20 -> "☾  Good Evening"
            else -> "☾  Good Night"
        }

        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.workly_datetime_widget)
            views.setTextViewText(R.id.workly_datetime_greeting, greeting)
            views.setString(R.id.workly_datetime_time, "setTimeZone", "Asia/Kolkata")
            views.setString(R.id.workly_datetime_seconds, "setTimeZone", "Asia/Kolkata")
            views.setString(R.id.workly_datetime_date, "setTimeZone", "Asia/Kolkata")

            val festivalPage = Intent(Intent.ACTION_VIEW,
                Uri.parse("https://worklyindia.devs.surf/festivals")).apply {
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openFestival = PendingIntent.getActivity(
                context, id + 7100, festivalPage,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.workly_festival_open, openFestival)
            manager.updateAppWidget(id, views)
        }
    }
}
