package com.worklyindia.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/** A single, system-theme-aware India date and time widget. TextClock handles live seconds/date. */
class WorklyDateTimeWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.workly_datetime_widget)
            views.setString(R.id.workly_datetime_time, "setTimeZone", "Asia/Kolkata")
            views.setString(R.id.workly_datetime_date, "setTimeZone", "Asia/Kolkata")

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
}
