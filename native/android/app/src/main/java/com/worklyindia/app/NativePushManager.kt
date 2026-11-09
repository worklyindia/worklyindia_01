package com.worklyindia.app

import android.Manifest
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.NotificationCompat.BubbleMetadata
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.FirebaseOptions
import com.google.android.gms.tasks.Tasks
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

object NativePushManager {
    private const val SUPABASE_URL = "https://jubwzelupbntbetpajqb.supabase.co"
    private const val SUPABASE_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
    private const val CHANNEL_ID = "workly_updates_v2"

    /**
     * Native Firebase config is loaded from the same public push-config action
     * used by the website. The checked-in google-services.json in this repo
     * does not contain an api_key block, so FirebaseApp.initializeApp(context)
     * alone cannot create Firebase Installations / FCM tokens on a fresh APK.
     */
    private fun getFirebaseApp(context: Context, suppliedConfig: JSONObject? = null): FirebaseApp? {
        val existing = FirebaseApp.getApps(context)
            .firstOrNull { it.name == FirebaseApp.DEFAULT_APP_NAME }
        if (existing != null && !existing.options.apiKey.isNullOrBlank()) return existing
        if (existing != null) {
            android.util.Log.w("WorklyPush", "Replacing incomplete default Firebase options")
            existing.delete()
        }

        // Prefer the Firebase config already fetched by the signed-in website.
        // This avoids a second unauthenticated Edge Function request from Android.
        val config = suppliedConfig ?: run {
            val connection = (URL("$SUPABASE_URL/functions/v1/email-api").openConnection() as HttpURLConnection)
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 20000
            connection.setRequestProperty("apikey", SUPABASE_KEY)
            connection.setRequestProperty("Authorization", "Bearer $SUPABASE_KEY")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            connection.outputStream.use {
                it.write(JSONObject().put("action", "push_config").toString().toByteArray(Charsets.UTF_8))
            }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            connection.disconnect()
            if (status !in 200..299) {
                android.util.Log.e("WorklyPush", "Firebase push-config failed [$status]: $response")
                return null
            }
            val root = JSONObject(response)
            if (!root.optBoolean("configured")) {
                android.util.Log.e("WorklyPush", "Firebase web push configuration is incomplete")
                return null
            }
            root.optJSONObject("config") ?: return null
        }

        val apiKey = config.optString("apiKey")
        val appId = config.optString("appId")
        val projectId = config.optString("projectId")
        val senderId = config.optString("messagingSenderId")
        if (apiKey.isBlank() || appId.isBlank() || projectId.isBlank() || senderId.isBlank()) {
            android.util.Log.e("WorklyPush", "Firebase push-config response is missing required native fields")
            return null
        }
        val options = FirebaseOptions.Builder()
            .setApiKey(apiKey)
            .setApplicationId(appId)
            .setProjectId(projectId)
            .setGcmSenderId(senderId)
            .build()
        return FirebaseApp.initializeApp(context, options)
    }

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Workly India updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Jobs, applications, messages and account updates"
                setShowBadge(true)
                enableVibration(true)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) setAllowBubbles(true)
            }
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    suspend fun register(context: Context, session: NativeSession, firebaseConfig: JSONObject? = null): Boolean = withContext(Dispatchers.IO) {
        try {
            // Initialize with the live public Firebase config. The repository's
            // google-services.json omits api_key, so the standard resource-based
            // initializer returns null on a clean install.
            val firebaseApp = getFirebaseApp(context, firebaseConfig) ?: return@withContext false
            // Register the device token even when notification permission is currently denied.
            // Android will suppress display until the user grants POST_NOTIFICATIONS, but the
            // token is ready immediately after they enable it in system settings.
            createChannel(context)
            val token = Tasks.await(FirebaseMessaging.getInstance().token)
            if (token.isNullOrBlank()) return@withContext false

            val info = JSONObject()
                .put("platform", "android")
                .put("manufacturer", Build.MANUFACTURER)
                .put("model", Build.MODEL)
                .put("androidVersion", Build.VERSION.RELEASE)
                .put("sdkInt", Build.VERSION.SDK_INT)

            val body = JSONObject()
                .put("user_id", session.userId)
                .put("user_role", session.userRole)
                .put("fcm_token", token)
                .put("platform", "android")
                .put("device_info", info)
                .put("enabled", true)
                .put("last_seen_at", java.time.Instant.now().toString())

            // Upsert on (user_id, platform) atomically replaces this account's
            // previous Android token. A separate DELETE is redundant and can
            // make subscription fail when PostgREST is briefly unavailable.
            var status = 0
            var response = ""
            // Supabase PostgREST can briefly return gateway/timeout failures.
            // Each retry uses a fresh connection and repeats the idempotent upsert.
            for (attempt in 1..3) {
                val connection = (URL("$SUPABASE_URL/rest/v1/push_subscriptions?on_conflict=user_id,platform").openConnection() as HttpURLConnection)
                connection.requestMethod = "POST"
                connection.connectTimeout = 15000
                connection.readTimeout = 20000
                connection.setRequestProperty("apikey", SUPABASE_KEY)
                connection.setRequestProperty("Authorization", "Bearer ${session.accessToken}")
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
                connection.doOutput = true
                try {
                    connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                    status = connection.responseCode
                    response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                        ?.bufferedReader()?.use { it.readText() }.orEmpty()
                } catch (error: Exception) {
                    status = 0
                    response = error.message ?: error.javaClass.simpleName
                } finally {
                    connection.disconnect()
                }
                if (status in 200..299) break
                if (attempt < 3) Thread.sleep(500L * attempt)
            }
            if (status !in 200..299) {
                android.util.Log.e("WorklyPush", "Token registration failed [$status]: $response")
                return@withContext false
            }
            createChannel(context)
            android.util.Log.i("WorklyPush", "Native Android FCM token registered")
            true
        } catch (error: Exception) {
            android.util.Log.e("WorklyPush", "Registration failed", error)
            false
        }
    }

    suspend fun unregister(context: Context, session: NativeSession) = withContext(Dispatchers.IO) {
        try {
            val firebaseApp = getFirebaseApp(context) ?: return@withContext
            val token = Tasks.await(FirebaseMessaging.getInstance().token)
            if (token.isNullOrBlank()) return@withContext
            val encoded = URLEncoder.encode(token, "UTF-8")
            val connection = (URL("$SUPABASE_URL/rest/v1/push_subscriptions?user_id=eq.${session.userId}&fcm_token=eq.$encoded").openConnection() as HttpURLConnection)
            connection.requestMethod = "DELETE"
            connection.connectTimeout = 15000
            connection.readTimeout = 20000
            connection.setRequestProperty("apikey", SUPABASE_KEY)
            connection.setRequestProperty("Authorization", "Bearer ${session.accessToken}")
            connection.setRequestProperty("Prefer", "return=minimal")
            val status = connection.responseCode
            if (status !in 200..299) {
                val response = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                android.util.Log.e("WorklyPush", "Token removal failed [$status]: $response")
            }
            connection.disconnect()
        } catch (error: Exception) {
            android.util.Log.w("WorklyPush", "Token cleanup failed during logout", error)
        }
    }

    fun showNotification(context: Context, data: Map<String, String>) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

        createChannel(context)
        val title = data["title"]?.takeIf { it.isNotBlank() } ?: "Workly India"
        val body = data["body"]?.takeIf { it.isNotBlank() } ?: "You have a new update."
        // Resolve only Workly-owned destinations. Push payloads can contain an
        // absolute URL, a relative route, or entity IDs; never allow an external
        // URL to be opened inside the authenticated app WebView.
        fun trustedNotificationUrl(raw: String?): String? {
            if (raw.isNullOrBlank()) return null
            val parsed = runCatching {
                val candidate = if (raw.startsWith("/")) Uri.parse("https://worklyindia.devs.surf$raw") else Uri.parse(raw)
                candidate.takeIf {
                    it.scheme == "https" &&
                    it.host.equals("worklyindia.devs.surf", ignoreCase = true) &&
                    candidate.userInfo == null
                }?.toString()
            }.getOrNull()
            return parsed
        }
        val notificationUrl = sequenceOf("url", "action_url", "actionUrl", "deep_link", "deepLink", "link")
            .mapNotNull { key -> trustedNotificationUrl(data[key]) }
            .firstOrNull()
            ?: data["job_id"]?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{1,100}")) }
                ?.let { "https://worklyindia.devs.surf/job/${Uri.encode(it)}" }
            ?: "https://worklyindia.devs.surf/notifications"
        val tag = data["tag"]?.takeIf { it.isNotBlank() } ?: "workly-${System.currentTimeMillis()}"

        fun activityPendingIntent(url: String?, requestCode: Int): PendingIntent {
            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("notification_url", url)
                putExtra("notification_type", data["type"])
            }
            return PendingIntent.getActivity(
                context, requestCode, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        // Android launchers derive the app-icon badge from active notifications.
        // setNumber supplies the aggregate count on launchers that support numeric badges.
        val notificationManager = NotificationManagerCompat.from(context)
        val activeNotifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            notificationManager.activeNotifications
        } else {
            emptyList()
        }
        // Count only Workly notifications in the current badge-enabled channel.
        // A new channel ID is used so Android recreates the channel with badges
        // enabled even on devices where the old channel was created with badges off.
        val worklyActive = activeNotifications.filter { it.notification.channelId == CHANNEL_ID }
        val alreadyActive = worklyActive.any { it.tag == tag && it.id == tag.hashCode() }
        val badgeCount = (worklyActive.size + if (alreadyActive) 0 else 1).coerceAtLeast(1)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setNumber(badgeCount)
            .setSmallIcon(R.drawable.ic_stat_workly)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(activityPendingIntent(notificationUrl, tag.hashCode()))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)

        // Show the originating platform logo as the large notification icon,
        // while keeping the Workly India monochrome app icon in the status bar.
        val source = listOf("source", "platform", "channel", "integration", "provider", "type")
            .mapNotNull { data[it]?.lowercase() }
            .joinToString(" ")
        val platformIconUrl = data["platform_icon"]?.takeIf { it.startsWith("https://") }
            ?: data["source_icon"]?.takeIf { it.startsWith("https://") }
            ?: when {
                "whatsapp" in source -> "https://img.icons8.com/color/96/whatsapp--v1.png"
                "instagram" in source -> "https://img.icons8.com/fluency/96/instagram-new.png"
                "messenger" in source -> "https://img.icons8.com/color/96/facebook-messenger--v1.png"
                "facebook" in source -> "https://img.icons8.com/color/96/facebook-new.png"
                else -> null
            }
        if (platformIconUrl != null) {
            runCatching {
                val connection = URL(platformIconUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 4000
                connection.readTimeout = 5000
                connection.instanceFollowRedirects = true
                connection.setRequestProperty("User-Agent", "WorklyIndia-Android")
                val bitmap = connection.inputStream.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(4096)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > 512 * 1024) throw IllegalStateException("Platform icon exceeds 512 KB")
                        output.write(buffer, 0, count)
                    }
                    BitmapFactory.decodeByteArray(output.toByteArray(), 0, total)
                }
                connection.disconnect()
                bitmap
            }.getOrNull()?.let { builder.setLargeIcon(it) }
        }

        // Download the optional rich-media image with strict time/size limits.
        val imageUrl = data["image"]?.takeIf { it.startsWith("https://") }
        if (imageUrl != null) {
            runCatching {
                val connection = URL(imageUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 7000
                connection.instanceFollowRedirects = true
                connection.setRequestProperty("User-Agent", "WorklyIndia-Android")
                connection.connect()
                val bitmap = connection.inputStream.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > 2 * 1024 * 1024) throw IllegalStateException("Notification image exceeds 2 MB")
                        output.write(buffer, 0, count)
                    }
                    BitmapFactory.decodeByteArray(output.toByteArray(), 0, total)
                }
                connection.disconnect()
                bitmap
            }.getOrNull()?.let { bitmap ->
                builder.setStyle(
                    NotificationCompat.BigPictureStyle()
                        .bigPicture(bitmap)
                        .setSummaryText(body)
                )
            }
        }

        // Detect social inbox notifications from structured source fields and icon URLs.
        // Providers have used several payload key names across the website and edge function.
        val socialSourceText = listOf(
            "source", "platform", "channel", "integration", "provider", "type",
            "notification_type", "category", "platform_icon", "source_icon", "icon", "image"
        ).mapNotNull { key -> data[key]?.takeIf { it.isNotBlank() }?.lowercase() }
            .joinToString(" ")
        val isSocialInboxNotification = listOf(
            "whatsapp", "instagram", "facebook", "messenger",
            "social_inbox", "social-inbox", "instagram_comment", "facebook_comment",
            "whatsapp_message", "instagram_message", "facebook_message"
        ).any { marker -> marker in socialSourceText }

        if (isSocialInboxNotification) {
            val chatUrl = notificationUrl ?: "https://worklyindia.devs.surf/"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val conversationKey = listOf("conversation_id", "conversationId", "thread_id", "threadId", "contact_id", "contactId").firstNotNullOfOrNull { key -> data[key]?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{1,100}")) } } ?: tag
                val shortcutId = "workly-chat-$conversationKey"
                val bubbleIntent = Intent(context, ChatBubbleActivity::class.java).apply {
                    action = Intent.ACTION_VIEW
                    data = Uri.parse(chatUrl)
                    putExtra("chat_url", chatUrl)
                    putExtra("chat_title", title)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val shortcut = ShortcutInfoCompat.Builder(context, shortcutId)
                    .setShortLabel(title.take(25).ifBlank { "Workly chat" })
                    .setLongLabel(title.take(100).ifBlank { "Workly India conversation" })
                    .setIcon(IconCompat.createWithResource(context, R.mipmap.ic_launcher))
                    .setIntent(bubbleIntent)
                    .setPerson(Person.Builder().setName(title).build())
                    .setLongLived(true)
                    .build()
                runCatching { ShortcutManagerCompat.pushDynamicShortcut(context, shortcut) }
                    .onFailure { android.util.Log.w("WorklyPush", "Could not publish chat bubble shortcut", it) }
                builder.setShortcutId(shortcutId).setBubbleMetadata(BubbleMetadata.Builder(shortcutId).setDesiredHeight(640).build())
            }
            // Re-apply BigTextStyle after optional image handling so the expanded
            // notification has a consistent readable body and visible action row.
            builder.setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(body)
                    .setBigContentTitle(title)
            )
            builder.addAction(
                android.R.drawable.ic_menu_send,
                "Reply",
                activityPendingIntent(chatUrl, tag.hashCode() + 1)
            )
            builder.addAction(
                android.R.drawable.ic_menu_view,
                "Mark as read",
                NotificationActionReceiver.pendingIntent(
                    context, NotificationActionReceiver.ACTION_MARK_READ,
                    tag, tag.hashCode(), tag.hashCode() + 2
                )
            )
            builder.addAction(
                android.R.drawable.ic_lock_silent_mode,
                "Mute",
                NotificationActionReceiver.pendingIntent(
                    context, NotificationActionReceiver.ACTION_MUTE,
                    tag, tag.hashCode(), tag.hashCode() + 3
                )
            )
        } else {
            // Non-social notifications continue to use the owner-configured CTA.
            val actionJson = data["actions"] ?: data["buttons"] ?: data["web_buttons"] ?: "[]"
            val parsedActions = mutableListOf<Pair<String, String>>()
            runCatching {
                val actions = org.json.JSONArray(actionJson)
                for (index in 0 until minOf(actions.length(), 3)) {
                    val action = actions.optJSONObject(index) ?: continue
                    val label = action.optString("title").takeIf { it.isNotBlank() }
                        ?: action.optString("text").takeIf { it.isNotBlank() }
                        ?: continue
                    val actionUrl = trustedNotificationUrl(action.optString("url"))
                        ?: notificationUrl
                    parsedActions.add(label to actionUrl)
                }
            }.onFailure {
                android.util.Log.w("WorklyPush", "Could not parse notification actions", it)
            }
            parsedActions.take(3).forEachIndexed { index, action ->
                builder.addAction(
                    0,
                    action.first,
                    activityPendingIntent(action.second, tag.hashCode() + index + 1)
                )
            }
        }

        NotificationManagerCompat.from(context).notify(tag, tag.hashCode(), builder.build())
    }
}
