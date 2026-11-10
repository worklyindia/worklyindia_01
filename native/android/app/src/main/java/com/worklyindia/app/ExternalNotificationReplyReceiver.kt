package com.worklyindia.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.NotificationManager
import android.widget.Toast

class ExternalNotificationReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(ExternalNotificationListenerService.EXTRA_ID, Int.MIN_VALUE)
        if (id == Int.MIN_VALUE) return
        val results = android.app.RemoteInput.getResultsFromIntent(intent)
        val sent = results != null && ReplyRegistry.send(context, id, results)
        if (sent) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(ExternalNotificationListenerService.MIRROR_TAG, id)
        } else {
            Toast.makeText(context, "Reply is no longer available. Open the original app to respond.", Toast.LENGTH_LONG).show()
        }
    }
}
