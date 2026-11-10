package com.worklyindia.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import android.app.RemoteInput
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

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

        if (intent.action == ACTION_REPLY_CHAT) {
            val pending = goAsync()
            Thread {
                try {
                    val reply = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(EXTRA_REPLY)?.toString()?.trim().orEmpty()
                    val conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID).orEmpty()
                    if (reply.isNotBlank() && reply.length <= 5000 && conversationId.matches(Regex("[0-9a-fA-F-]{36}"))) {
                        sendAuthenticatedChatReply(context, conversationId, reply)
                    }
                } catch (error: Exception) {
                    android.util.Log.e("WorklyChatReply", "Inline reply failed", error)
                } finally { pending.finish() }
            }.start()
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

    private fun sendAuthenticatedChatReply(context: Context, conversationId: String, message: String) {
        val session = NativeAuth.session(context) ?: throw IllegalStateException("Sign in required")
        val base = "https://jubwzelupbntbetpajqb.supabase.co"
        val apiKey = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
        fun request(path: String, method: String, body: String? = null): String {
            val connection = URL(base + "/rest/v1/" + path).openConnection() as HttpURLConnection
            connection.requestMethod = method
            connection.connectTimeout = 10000
            connection.readTimeout = 15000
            connection.setRequestProperty("apikey", apiKey)
            connection.setRequestProperty("Authorization", "Bearer " + session.accessToken)
            connection.setRequestProperty("Content-Type", "application/json")
            if (body != null) {
                connection.setRequestProperty("Prefer", "return=minimal")
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            connection.disconnect()
            if (status !in 200..299) throw IllegalStateException("Supabase rejected inline reply [" + status + "]: " + response)
            return response
        }
        val rows = org.json.JSONArray(request("conversations?id=eq." + conversationId + "&select=id,employer_id,applicant_id&limit=1", "GET"))
        if (rows.length() != 1) throw SecurityException("Conversation not found")
        val conversation = rows.getJSONObject(0)
        val senderType = when (session.userId) {
            conversation.getString("employer_id") -> "employer"
            conversation.getString("applicant_id") -> "applicant"
            else -> throw SecurityException("Not a conversation participant")
        }
        val payload = JSONObject().put("conversation_id", conversationId).put("sender_id", session.userId).put("sender_type", senderType).put("message", message)
        request("chat_messages", "POST", payload.toString())
    }

    companion object {
        const val ACTION_REPLY_CHAT = "com.worklyindia.app.ACTION_REPLY_CHAT"
        private const val EXTRA_REPLY = "workly_chat_reply"
        private const val EXTRA_CONVERSATION_ID = "conversation_id"
        const val ACTION_MARK_READ = "com.worklyindia.app.ACTION_MARK_READ"
        const val ACTION_MUTE = "com.worklyindia.app.ACTION_MUTE"
        const val ACTION_ACK_CHARGING_ALERT = "com.worklyindia.app.ACTION_ACK_CHARGING_ALERT"
        private const val EXTRA_TAG = "notification_tag"
        private const val EXTRA_ID = "notification_id"

        fun replyPendingIntent(context: Context, conversationId: String, requestCode: Int): PendingIntent {
            val intent = Intent(context, NotificationActionReceiver::class.java).apply {
                action = ACTION_REPLY_CHAT
                putExtra(EXTRA_CONVERSATION_ID, conversationId)
            }
            return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE)
        }

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
