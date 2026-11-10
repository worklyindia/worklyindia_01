package com.worklyindia.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.app.RemoteInput
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Mirrors only explicitly allow-listed messaging notifications.
 * Message content is retained on-device only; original tap/reply actions are reused.
 */
class ExternalNotificationListenerService : NotificationListenerService() {
    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName ?: return
        if (packageName == this.packageName || packageName !in ALLOWED_PACKAGES) return
        val source = sbn.notification ?: return
        if (source.flags and Notification.FLAG_ONGOING_EVENT != 0) return

        val extras = source.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val message = (
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
                ?: extras.getCharSequence(Notification.EXTRA_TEXT)
                ?: extras.getCharSequence(Notification.EXTRA_SUB_TEXT)
            )?.toString()?.trim().orEmpty()
        if (title.isBlank() || message.isBlank()) return

        val id = (packageName + ":" + sbn.key).hashCode()
        val originalAction = source.actions?.firstOrNull { action ->
            val inputs = action.remoteInputs
            !inputs.isNullOrEmpty() && inputs.any { it.allowFreeFormInput }
        }
        val originalInputs = originalAction?.remoteInputs
        if (originalAction != null && originalInputs != null) {
            ReplyRegistry.put(id, originalAction.actionIntent, originalInputs)
        }

        saveLocally(id, packageName, title, message, sbn.postTime, originalAction != null)
        postMirror(id, packageName, title, message, source.contentIntent, originalAction, originalInputs)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // Keep the local inbox history; the source app may dismiss notifications after a reply.
    }

    private fun saveLocally(id: Int, source: String, title: String, message: String, time: Long, canReply: Boolean) {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val old = runCatching { JSONArray(prefs.getString(KEY_ITEMS, "[]")) }.getOrDefault(JSONArray())
        val next = JSONArray()
        for (i in 0 until old.length()) {
            val item = old.optJSONObject(i) ?: continue
            if (item.optInt("id") != id) next.put(item)
        }
        next.put(JSONObject()
            .put("id", id)
            .put("source", source)
            .put("title", title.take(160))
            .put("message", message.take(1200))
            .put("time", time)
            .put("canReply", canReply))
        val trimmed = JSONArray()
        for (i in maxOf(0, next.length() - MAX_ITEMS) until next.length()) trimmed.put(next.getJSONObject(i))
        prefs.edit().putString(KEY_ITEMS, trimmed.toString()).apply()
    }

    private fun postMirror(
        id: Int,
        packageName: String,
        title: String,
        message: String,
        contentIntent: PendingIntent?,
        action: Notification.Action?,
        remoteInputs: Array<RemoteInput>?
    ) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setSubText(sourceLabel(packageName))
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setGroup("workly_external_messages")
        if (contentIntent != null) builder.setContentIntent(contentIntent)

        if (action != null && remoteInputs != null && remoteInputs.isNotEmpty()) {
            val input = remoteInputs.firstOrNull { it.allowFreeFormInput } ?: remoteInputs.first()
            val replyIntent = Intent(this, ExternalNotificationReplyReceiver::class.java)
                .setAction(ACTION_REPLY)
                .putExtra(EXTRA_ID, id)
            val replyPendingIntent = PendingIntent.getBroadcast(
                this, id, replyIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            val replyAction = NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send,
                "Reply",
                replyPendingIntent
            ).addRemoteInput(
                androidx.core.app.RemoteInput.Builder(input.resultKey)
                    .setLabel(input.label ?: "Reply")
                    .setAllowFreeFormInput(input.allowFreeFormInput)
                    .setChoices(input.choices)
                    .build()
            ).setAllowGeneratedReplies(true).build()
            builder.addAction(replyAction)
        }
        manager.notify(MIRROR_TAG, id, builder.build())
    }

    private fun sourceLabel(packageName: String): String = when (packageName) {
        "com.whatsapp", "com.whatsapp.w4b" -> "WhatsApp"
        "com.instagram.android" -> "Instagram"
        "com.facebook.orca" -> "Messenger"
        "com.facebook.katana" -> "Facebook"
        else -> "Message"
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "External message shortcuts", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Quick access to supported WhatsApp, Instagram and Facebook messages"
                }
            )
        }
    }

    companion object {
        const val PREFS = "workly_external_notifications"
        const val KEY_ITEMS = "items"
        const val CHANNEL_ID = "workly_external_message_shortcuts"
        const val ACTION_REPLY = "com.worklyindia.app.action.EXTERNAL_NOTIFICATION_REPLY"
        const val EXTRA_ID = "notification_id"
        const val EXTRA_TEXT = "reply_text"
        const val MIRROR_TAG = "workly_external_message"
        const val MAX_ITEMS = 100
        val ALLOWED_PACKAGES = setOf(
            "com.whatsapp", "com.whatsapp.w4b",
            "com.instagram.android", "com.facebook.orca", "com.facebook.katana"
        )
    }
}

internal object ReplyRegistry {
    private data class Target(val pendingIntent: PendingIntent, val remoteInputs: Array<RemoteInput>)
    private val targets = java.util.concurrent.ConcurrentHashMap<Int, Target>()

    fun put(id: Int, pendingIntent: PendingIntent, remoteInputs: Array<RemoteInput>) {
        targets[id] = Target(pendingIntent, remoteInputs)
    }

    fun sendText(context: Context, id: Int, text: String): Boolean {
        val target = targets[id] ?: return false
        val input = target.remoteInputs.firstOrNull { it.allowFreeFormInput } ?: return false
        val results = Bundle().apply { putCharSequence(input.resultKey, text) }
        return send(context, id, results)
    }

    fun send(context: Context, id: Int, results: Bundle): Boolean {
        val target = targets[id] ?: return false
        return try {
            val fillIn = Intent()
            val supplied = Bundle()
            target.remoteInputs.forEach { input ->
                results.getCharSequence(input.resultKey)?.let { supplied.putCharSequence(input.resultKey, it) }
            }
            if (supplied.isEmpty) return false
            RemoteInput.addResultsToIntent(target.remoteInputs, fillIn, supplied)
            target.pendingIntent.send(context, 0, fillIn)
            targets.remove(id)
            true
        } catch (_: Exception) {
            false
        }
    }
}
