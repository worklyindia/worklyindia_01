package com.worklyindia.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.NotificationManager
import android.widget.Toast

class ExternalNotificationReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(ExternalNotificationListenerService.EXTRA_ID, Int.MIN_VALUE)
        val text = android.app.RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence("reply")?.toString()?.trim().orEmpty()
        if (id == Int.MIN_VALUE || text.isBlank()) return
        val sent = ReplyRegistry.send(context, id, text)
        if (sent) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(ExternalNotificationListenerService.MIRROR_TAG, id)
        } else {
            Toast.makeText(context, "Reply is no longer available. Open the original app to respond.", Toast.LENGTH_LONG).show()
        }
    }
}
