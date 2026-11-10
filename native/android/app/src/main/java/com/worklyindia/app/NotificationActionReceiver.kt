package com.worklyindia.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationManagerCompat

class NotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_ACK_CHARGING_ALERT) {
            val serviceIntent = Intent(context, ChargingMonitorService::class.java).apply {
                action = ChargingMonitorService.ACTION_ACKNOWLEDGE
            }
            runCatching { context.startService(serviceIntent) }
                .onFailure { android.util.Log.e("WorklyCharging", "Could not stop battery alarm from notification", it) }
            return
        }

        val tag = intent.getStringExtra(EXTRA_TAG) ?: return
        val id = intent.getIntExtra(EXTRA_ID, tag.hashCode())
        when (intent.action) {
            ACTION_MARK_READ -> NotificationManagerCompat.from(context).cancel(tag, id)
            ACTION_MUTE -> {
                val settings = Intent().apply {
                    action = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS
                    } else {
                        android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS
                    }
                    putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        putExtra(android.provider.Settings.EXTRA_CHANNEL_ID, "workly_updates_v2")
                    }
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                runCatching { context.startActivity(settings) }
            }
        }
    }

    companion object {
        const val ACTION_MARK_READ = "com.worklyindia.app.ACTION_MARK_READ"
        const val ACTION_MUTE = "com.worklyindia.app.ACTION_MUTE"
        const val ACTION_ACK_CHARGING_ALERT = "com.worklyindia.app.ACTION_ACK_CHARGING_ALERT"
        private const val EXTRA_TAG = "notification_tag"
        private const val EXTRA_ID = "notification_id"

        fun pendingIntent(
            context: Context,
            action: String,
            tag: String,
            id: Int,
            requestCode: Int
        ): PendingIntent {
            val intent = Intent(context, NotificationActionReceiver::class.java).apply {
                this.action = action
                putExtra(EXTRA_TAG, tag)
                putExtra(EXTRA_ID, id)
            }
            return PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}
