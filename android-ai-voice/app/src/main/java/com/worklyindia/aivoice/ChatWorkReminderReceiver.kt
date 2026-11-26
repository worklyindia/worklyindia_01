package com.worklyindia.aivoice

import android.app.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class ChatWorkReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "ChatWork reminder"
        val id = intent.getIntExtra("id", 0)
        val prefs = context.getSharedPreferences("chatwork_assistant_tools", Context.MODE_PRIVATE)
        val ids = prefs.getStringSet("reminder_ids", emptySet()).orEmpty().toMutableSet()
        ids.remove(id.toString())
        prefs.edit().remove("reminder_title_$id").remove("reminder_at_$id")
            .putStringSet("reminder_ids", ids).apply()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(
                NotificationChannel("chatwork_reminders", "ChatWork reminders", NotificationManager.IMPORTANCE_HIGH)
            )
        }
        val open = PendingIntent.getActivity(
            context, id, Intent(context, OfflineAiChatActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) {
            Notification.Builder(context, "chatwork_reminders")
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
        }
        val notification = builder.setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title).setContentText("Reminder from ChatWork")
            .setAutoCancel(true).setContentIntent(open).build()
        manager.notify(id, notification)
    }
}
