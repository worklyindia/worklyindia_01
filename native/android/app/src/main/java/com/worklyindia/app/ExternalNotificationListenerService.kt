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
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Mirrors only explicitly allow-listed messaging notifications.
 * Message content stays local unless cloud sync is explicitly enabled; source app tap/reply actions are reused.
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
            ReplyRegistry.put(id, originalAction.actionIntent, originalInputs, packageName, title, sbn.key, sbn.postTime)
        }

        saveLocally(id, packageName, title, message, sbn.postTime, originalAction != null)
        ExternalMessageCloudSync.sync(
            this, packageName, title, message, sbn.key, sbn.postTime, id, "incoming"
        )
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
    private data class Target(val pendingIntent: PendingIntent, val remoteInputs: Array<RemoteInput>, val sourcePackage: String, val title: String, val notificationKey: String, val postedAt: Long)
    private val targets = java.util.concurrent.ConcurrentHashMap<Int, Target>()

    fun put(id: Int, pendingIntent: PendingIntent, remoteInputs: Array<RemoteInput>, sourcePackage: String, title: String, notificationKey: String, postedAt: Long) {
        targets[id] = Target(pendingIntent, remoteInputs, sourcePackage, title, notificationKey, postedAt)
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
            val replyText = target.remoteInputs.firstNotNullOfOrNull { supplied.getCharSequence(it.resultKey)?.toString() }?.trim().orEmpty()
            if (replyText.isNotBlank()) {
                ExternalMessageCloudSync.sync(
                    context, target.sourcePackage, target.title, replyText,
                    target.notificationKey, System.currentTimeMillis(), id, "outgoing"
                )
            }
            targets.remove(id)
            true
        } catch (_: Exception) {
            false
        }
    }
}


/**
 * Cloud sync is separately opt-in. Notification access alone never uploads
 * private message text. Uses the signed-in user's Supabase session, never a
 * service-role key in the Android app.
 */
internal object ExternalMessageCloudSync {
    private const val PREFS = "workly_external_notifications"
    private const val ENABLED = "cloud_sync_enabled"
    private const val API_URL = "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-social-api"
    private const val API_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
    private val executor = Executors.newSingleThreadExecutor()

    fun setEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, enabled).apply()
    }

    fun isEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ENABLED, false)

    fun sync(
        context: Context,
        sourcePackage: String,
        displayName: String,
        message: String,
        notificationKey: String,
        timestamp: Long,
        notificationId: Int,
        direction: String
    ) {
        if (!isEnabled(context) || message.isBlank()) return
        val appContext = context.applicationContext
        executor.execute {
            runCatching {
                var session = NativeAuth.session(appContext) ?: return@runCatching
                var response = sendRequest(
                    session.accessToken, sourcePackage, displayName, message,
                    notificationKey, timestamp, notificationId, direction
                )
                if (response == 401) {
                    session = NativeAuth.refreshWebSession(appContext) ?: return@runCatching
                    response = sendRequest(
                        session.accessToken, sourcePackage, displayName, message,
                        notificationKey, timestamp, notificationId, direction
                    )
                }
                if (response !in 200..299) {
                    android.util.Log.w("WorklyExternalSync", "Message sync failed with HTTP $response")
                }
            }.onFailure {
                android.util.Log.w("WorklyExternalSync", "Message sync failed", it)
            }
        }
    }

    private fun sendRequest(
        accessToken: String,
        sourcePackage: String,
        displayName: String,
        message: String,
        notificationKey: String,
        timestamp: Long,
        notificationId: Int,
        direction: String
    ): Int {
        val platform = when (sourcePackage) {
            "com.whatsapp" -> "whatsapp"
            "com.whatsapp.w4b" -> "whatsapp_business"
            "com.instagram.android" -> "instagram"
            "com.facebook.orca" -> "messenger"
            "com.facebook.katana" -> "facebook"
            else -> return 400
        }
        val conversationKey = "$sourcePackage:${displayName.trim().lowercase()}"
        val messageKey = "$platform:$notificationKey:$timestamp:$direction"
        val payload = JSONObject()
            .put("action", "external_message_sync")
            .put("platform", platform)
            .put("conversation_key", conversationKey)
            .put("message_key", messageKey)
            .put("source_package", sourcePackage)
            .put("display_name", displayName.take(160))
            .put("message", message.take(4000))
            .put("created_at_ms", timestamp)
            .put("notification_id", notificationId.toString())
            .put("direction", direction)
        val connection = URL(API_URL).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 10000
        connection.readTimeout = 10000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("apikey", API_KEY)
        connection.setRequestProperty("Authorization", "Bearer $accessToken")
        connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val responseBody = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()
        if (status !in 200..299) return status
        return if (runCatching { JSONObject(responseBody).optBoolean("success", false) }.getOrDefault(false)) status else 500
    }
}
