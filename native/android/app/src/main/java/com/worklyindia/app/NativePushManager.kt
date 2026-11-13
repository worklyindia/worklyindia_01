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
import android.content.pm.ShortcutInfo
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
    private const val CHANNEL_ID = "workly_updates_v3"

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

    fun clearActiveNotifications(context: Context) {
        val manager = NotificationManagerCompat.from(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.activeNotifications
                .filter { it.notification.channelId == CHANNEL_ID }
                .forEach { manager.cancel(it.tag, it.id) }
        }
    }

    fun showNotification(context: Context, data: Map<String, String>) {
        val activeSession = NativeAuth.session(context) ?: return
        val targetUserId = data["user_id"] ?: data["recipient_user_id"] ?: data["target_user_id"]
        if (!targetUserId.isNullOrBlank() && targetUserId != activeSession.userId) return
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
        // Prefer explicit conversation destinations over generic notification URLs.
        val notificationUrl = sequenceOf(
            "chat_url", "chatUrl", "conversation_url", "conversationUrl",
            "chat_path", "chatPath", "conversation_path", "conversationPath",
            "deep_link", "deepLink", "action_url", "actionUrl", "link", "url", "route", "path"
        )
            .mapNotNull { key -> trustedNotificationUrl(data[key]) }
            .firstOrNull()
            ?: data["job_id"]?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{1,100}")) }
                ?.let { "https://worklyindia.devs.surf/job/${Uri.encode(it)}" }
            ?: "https://worklyindia.devs.surf/notifications"
        // Reuse one notification identity for every message in the same inbox thread.
        // notify(tag, id, ...) then replaces the previous alert instead of stacking.
        val sourceKey = listOf("platform", "source", "channel", "integration", "provider")
            .firstNotNullOfOrNull { key -> data[key]?.takeIf { it.isNotBlank() }?.lowercase() }
            ?: data["type"]?.substringBefore("_")?.lowercase()
            ?: "workly"
        val conversationKey = listOf("conversation_id", "conversationId", "thread_id", "threadId", "contact_id", "contactId", "sender_id", "senderId", "phone", "phone_number")
            .firstNotNullOfOrNull { key -> data[key]?.takeIf { it.matches(Regex("[A-Za-z0-9_+\\-]{1,120}")) } }
        val stableConversationTag = conversationKey?.let { "workly-$sourceKey-$it" }
        val tag = data["tag"]?.takeIf { it.isNotBlank() }
            ?: stableConversationTag
            ?: "workly-${System.currentTimeMillis()}"

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

        // Chat notifications must open the compact native bubble activity, not
        // MainActivity's general website notification handler. Keep the exact
        // trusted conversation URL and its role-specific route.
        fun bubbleActivityPendingIntent(url: String, requestCode: Int): PendingIntent {
            val openIntent = Intent(context, ChatBubbleActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                this.data = Uri.parse(url)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("chat_url", url)
                putExtra("chat_title", title)
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

        // Show the actual sender's profile photo when supplied. If unavailable,
        // use a neutral generic person avatar; never substitute a platform or
        // connected business/account logo for the person who sent the message.
        fun defaultPersonAvatar(isSelf: Boolean): Bitmap {
            val size = (96 * context.resources.displayMetrics.density).toInt().coerceAtLeast(96)
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
            paint.color = if (isSelf) android.graphics.Color.rgb(222, 232, 248) else android.graphics.Color.rgb(244, 228, 216)
            canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
            paint.color = if (isSelf) android.graphics.Color.rgb(62, 105, 168) else android.graphics.Color.rgb(160, 105, 72)
            canvas.drawCircle(size / 2f, size * 0.36f, size * 0.16f, paint)
            val body = android.graphics.RectF(size * 0.22f, size * 0.58f, size * 0.78f, size * 1.02f)
            canvas.drawRoundRect(body, size * 0.28f, size * 0.28f, paint)
            return bitmap
        }
        val senderAvatarUrl = data["sender_avatar_url"]?.takeIf { it.startsWith("https://") }
            ?: data["profile_picture_url"]?.takeIf { it.startsWith("https://") }
            ?: data["picture_url"]?.takeIf { it.startsWith("https://") }
        val senderAvatar = senderAvatarUrl?.let { avatarUrl ->
            runCatching {
                val connection = URL(avatarUrl).openConnection() as HttpURLConnection
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
                        if (total > 512 * 1024) throw IllegalStateException("Sender avatar exceeds 512 KB")
                        output.write(buffer, 0, count)
                    }
                    BitmapFactory.decodeByteArray(output.toByteArray(), 0, total)
                }
                connection.disconnect()
                bitmap
            }.getOrNull()
        }
        // Crop every real/fallback profile image into a true circle. Android's
        // MessagingStyle does not guarantee circular masking for bitmap Person icons.
        fun circularAvatar(source: Bitmap): Bitmap {
            val diameter = minOf(source.width, source.height).coerceAtLeast(1)
            val left = (source.width - diameter) / 2
            val top = (source.height - diameter) / 2
            val output = Bitmap.createBitmap(diameter, diameter, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(output)
            val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.FILTER_BITMAP_FLAG)
            val shader = android.graphics.BitmapShader(source, android.graphics.Shader.TileMode.CLAMP, android.graphics.Shader.TileMode.CLAMP)
            val matrix = android.graphics.Matrix()
            matrix.setTranslate(-left.toFloat(), -top.toFloat())
            shader.setLocalMatrix(matrix)
            paint.shader = shader
            canvas.drawCircle(diameter / 2f, diameter / 2f, diameter / 2f, paint)
            return output
        }
        fun loadAvatar(url: String?): Bitmap? {
            if (url.isNullOrBlank() || !url.startsWith("https://")) return null
            return runCatching {
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.connectTimeout = 4000
                connection.readTimeout = 5000
                connection.instanceFollowRedirects = true
                connection.setRequestProperty("User-Agent", "WorklyIndia-Android")
                val bytes = connection.inputStream.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(4096)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > 512 * 1024) throw IllegalStateException("Avatar exceeds 512 KB")
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                }
                connection.disconnect()
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            }.getOrNull()
        }
        val incomingAvatar = circularAvatar(senderAvatar ?: defaultPersonAvatar(isSelf = false))
        // The account's own profile photo is distinct from the sender's photo.
        // Payloads may include it for WhatsApp, Facebook or Instagram; otherwise
        // retain the blue "You" person avatar (never a platform app icon).
        val ownAvatarUrl = listOf(
            "own_avatar_url", "account_avatar_url", "account_profile_picture_url",
            "connected_account_picture_url", "business_profile_picture_url",
            "page_profile_picture_url", "instagram_profile_picture_url",
            "whatsapp_profile_picture_url", "facebook_profile_picture_url"
        ).firstNotNullOfOrNull { key -> data[key]?.takeIf { it.startsWith("https://") } }
        val ownAvatar = circularAvatar(loadAvatar(ownAvatarUrl) ?: defaultPersonAvatar(isSelf = true))
        // Standard Workly update notifications use the app's launcher logo as the
        // large icon (the right-side avatar in Android's notification card).
        // Social/chat notifications switch back to the actual sender photo below.
        val appLargeIcon = runCatching {
            val drawable = context.packageManager.getApplicationIcon(context.packageName)
            val size = (96 * context.resources.displayMetrics.density).toInt().coerceAtLeast(96)
            Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).also { bitmap ->
                val canvas = android.graphics.Canvas(bitmap)
                drawable.setBounds(0, 0, size, size)
                drawable.draw(canvas)
            }
        }.getOrNull()
        builder.setLargeIcon(appLargeIcon ?: incomingAvatar)

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

        // Native app chat and website chat can serialize the same conversation
        // identifier with different key casing. Normalize all supported aliases
        // before deciding whether this is a Workly conversation notification.
        val internalConversationId = listOf(
            "conversation_id", "conversationId", "thread_id", "threadId",
            "chat_id", "chatId", "room_id", "roomId"
        ).firstNotNullOfOrNull { key ->
            data[key]?.takeIf { it.matches(Regex("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")) }
        }
        val isInternalWorklyChat = !isSocialInboxNotification && internalConversationId != null
        // Route every conversation-style message through the same Android Bubble surface:
        // Workly owner/employee chats, employer chats, and connected social inboxes.
        // Keep ordinary job, billing, and account notifications as regular notifications.
        val chatEventText = listOf(
            "type", "notification_type", "category", "event", "kind", "message_type"
        ).mapNotNull { key -> data[key]?.takeIf { it.isNotBlank() }?.lowercase() }
            .joinToString(" ")
        val isChatMessageEvent = listOf(
            "chat_message", "message_received", "new_message", "employee_message",
            "employer_message", "owner_message", "conversation_message", "whatsapp_message",
            "instagram_message", "facebook_message", "messenger_message"
        ).any { marker -> marker in chatEventText } ||
            (("chat" in chatEventText || "message" in chatEventText) &&
                ("job" !in chatEventText && "billing" !in chatEventText))

        val isChatNotification = isSocialInboxNotification || isInternalWorklyChat || isChatMessageEvent

        // If the payload is misclassified as an ordinary notification, record that
        // reason too; otherwise the exact failure path would never reach Bubble code.
        if (!isChatNotification) {
            val skippedDiagnostic = "social=$isSocialInboxNotification internal=$isInternalWorklyChat " +
                "chatEvent=$isChatMessageEvent eventTypes=${chatEventText.take(160)} " +
                "urlPresent=${!notificationUrl.isNullOrBlank()} sdk=${Build.VERSION.SDK_INT}"
            android.util.Log.i("WorklyPush", "Bubble skipped before chat branch: $skippedDiagnostic")
            AppErrorReporter.capture(
                context, "bubble", "warning", "BubbleClassificationSkipped",
                skippedDiagnostic, source = "bubble"
            )
        }

        if (isChatNotification) {
            // Preserve sender-photo behavior for conversations; only ordinary
            // Workly update notifications use the Workly launcher logo above.
            builder.setLargeIcon(incomingAvatar)
            val chatUrl = notificationUrl ?: "https://worklyindia.devs.surf/"
            // A bubble is only for a real, deep-linked conversation notification.
            // The notification card tap remains MainActivity -> website chat route.
            // Only Android's dedicated bubble affordance launches ChatBubbleActivity.
            val chatPath = runCatching { Uri.parse(chatUrl).path.orEmpty().lowercase() }.getOrDefault("")
            // Support role-specific Workly chats and connected social inbox routes.
            // Only explicit chat/message/inbox paths are eligible; generic notification,
            // jobs, billing and account pages must never become conversation bubbles.
            val hasConversationDestination =
                notificationUrl != null &&
                (chatPath.startsWith("/employer/workly-chat") ||
                 chatPath.startsWith("/owner-portal/whatsapp/chat") ||
                 chatPath.contains("/chat/") ||
                 chatPath.endsWith("/chat") ||
                 chatPath.contains("/messages/") ||
                 chatPath.contains("/inbox/") ||
                 chatPath.contains("/social-inbox"))
            // Social inbox and authenticated Workly conversations already carry
            // enough identity to open their native conversation surface. Do not
            // suppress their Android bubble merely because the push payload's
            // website URL points to a generic notifications page or another
            // valid route. Keep path validation for generic chat-like events.
            val hasBubbleConversationIdentity =
                isSocialInboxNotification || isInternalWorklyChat
            val shouldPublishBubble =
                hasBubbleConversationIdentity || (isChatMessageEvent && hasConversationDestination)

            // Capture the eligibility decision even when Android rejects the bubble
            // before a shortcut or bubble metadata can be published. Never include
            // message text, sender details, URLs, or conversation identifiers.
            val notificationManager = context.getSystemService(NotificationManager::class.java)
            val appNotificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
            val appBubblesAllowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                notificationManager.areBubblesAllowed()
            } else false
            val channelState = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                notificationManager.getNotificationChannel(CHANNEL_ID)?.let {
                    "canBubble=${it.canBubble()},importance=${it.importance}"
                } ?: "missing"
            } else "pre-Android-10"
            val bubbleDiagnostic = "social=$isSocialInboxNotification internal=$isInternalWorklyChat " +
                "chatEvent=$isChatMessageEvent destination=$hasConversationDestination " +
                "publish=$shouldPublishBubble appNotificationsEnabled=$appNotificationsEnabled " +
                "appBubblesAllowed=$appBubblesAllowed channel={$channelState} sdk=${Build.VERSION.SDK_INT}"
            android.util.Log.i("WorklyPush", "Bubble decision: $bubbleDiagnostic")
            AppErrorReporter.capture(
                context, "bubble", "warning", "BubbleDiagnostic", bubbleDiagnostic, source = "bubble"
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && shouldPublishBubble) {
                val conversationKey = listOf("conversation_id", "conversationId", "thread_id", "threadId", "contact_id", "contactId").firstNotNullOfOrNull { key -> data[key]?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{1,100}")) } } ?: tag
                val shortcutId = "workly-chat-$conversationKey"
                // Social inbox bubbles use a fully native Activity. Normal notification
                // card taps above still open MainActivity and its regular website chat.
                val bubbleActivityClass = if (isSocialInboxNotification) {
                    NativeSocialChatBubbleActivity::class.java
                } else {
                    ChatBubbleActivity::class.java
                }
                val bubbleIntent = Intent(context, bubbleActivityClass).apply {
                    action = Intent.ACTION_VIEW
                    this.data = Uri.parse(chatUrl)
                    putExtra("chat_url", chatUrl)
                    putExtra("chat_title", title)
                    if (isSocialInboxNotification) {
                        putExtra("platform", data["platform"] ?: data["source"] ?: data["channel"])
                        putExtra("type", data["type"] ?: data["notification_type"])
                        putExtra("chat_body", body)
                        listOf(
                            "employer_notification", "phone", "phone_number", "sender_phone",
                            "audience", "conversation_id", "phone_number_id", "account_id",
                            "sender_id", "messages", "sender_name", "ai_reply"
                        ).forEach { key -> data[key]?.let { putExtra(key, it) } }
                    } else if (isInternalWorklyChat) {
                        putExtra("conversation_id", internalConversationId)
                    }
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_MULTIPLE_TASK
                }
                val shortcut = ShortcutInfoCompat.Builder(context, shortcutId)
                    .setShortLabel(title.take(25).ifBlank { "Workly chat" })
                    .setLongLabel(title.take(100).ifBlank { "Workly India conversation" })
                    .setIcon(IconCompat.createWithResource(context, R.mipmap.ic_launcher))
                    .setIntent(bubbleIntent)
                    .setPerson(Person.Builder().setName(title).build())
                    // Android 11+ only accepts a conversation shortcut as a Bubble target
                    // when it is explicitly categorized as a conversation.
                    .setCategories(setOf(ShortcutInfo.SHORTCUT_CATEGORY_CONVERSATION))
                    // Associate the dynamic shortcut with the actual resizable bubble Activity.
                    // Without this, Android may publish the shortcut but fail to open its chat surface.
                    .setActivity(android.content.ComponentName(context, bubbleActivityClass))
                    .setLongLived(true)
                    .build()
                runCatching {
                    ShortcutManagerCompat.pushDynamicShortcut(context, shortcut)
                    android.util.Log.i("WorklyPush", "Published conversation shortcut id=$shortcutId activity=${bubbleActivityClass.simpleName}")
                }.onFailure {
                    android.util.Log.e("WorklyPush", "Could not publish chat bubble shortcut id=$shortcutId", it)
                    AppErrorReporter.capture(context, "bubble", "error", it, source = "bubble")
                }
                builder.setShortcutId(shortcutId).setBubbleMetadata(BubbleMetadata.Builder(shortcutId).setDesiredHeight(640).build())
            }
            // Render inbox notifications as native Android conversations, not plain
            // BigText cards. If the push includes recent message history, preserve it;
            // otherwise show the current message as a single conversation entry.
            val conversationStyle = NotificationCompat.MessagingStyle(
                // The conversation's local user is the connected Instagram/Facebook
                // business account. Use its resolved profile photo for the "You" identity.
                Person.Builder().setName("You").setIcon(IconCompat.createWithBitmap(ownAvatar)).build()
            ).setConversationTitle(title)
            val history = data["messages"]?.let { raw ->
                runCatching { org.json.JSONArray(raw) }.getOrNull()
            }
            if (history != null && history.length() > 0) {
                for (index in 0 until history.length()) {
                    val item = history.optJSONObject(index) ?: continue
                    val text = item.optString("text", item.optString("message")).take(5000)
                    if (text.isBlank()) continue
                    val senderName = item.optString("sender_name", item.optString("sender", title))
                    val isMe = item.optBoolean("is_me", item.optBoolean("from_me", false))
                    val rawTimestamp = item.optLong("timestamp", System.currentTimeMillis())
                    val timestamp = if (rawTimestamp in 1..9_999_999_999L) rawTimestamp * 1000L else rawTimestamp
                    val person = Person.Builder()
                        .setName(if (isMe) "You" else senderName)
                        .setIcon(IconCompat.createWithBitmap(if (isMe) ownAvatar else incomingAvatar))
                        .build()
                    conversationStyle.addMessage(text, timestamp, person)
                }
            }
            if (history == null || history.length() == 0) {
                val senderName = data["sender_name"] ?: data["sender"] ?: title
                conversationStyle.addMessage(
                    body,
                    System.currentTimeMillis(),
                    Person.Builder().setName(senderName).setIcon(IconCompat.createWithBitmap(incomingAvatar)).build()
                )
            }
            // When the backend has sent an AI auto-reply, show that exact sent text
            // as a separate "You" message in the expanded notification.
            data["ai_reply"]?.takeIf { it.isNotBlank() }?.let { aiReply ->
                conversationStyle.addMessage(
                    aiReply.take(5000),
                    System.currentTimeMillis() + 1,
                    Person.Builder().setName("You").setIcon(IconCompat.createWithBitmap(ownAvatar)).build()
                )
            }
            builder.setStyle(conversationStyle)
            if (isInternalWorklyChat && internalConversationId != null) {
                val remoteInput = androidx.core.app.RemoteInput.Builder("workly_chat_reply")
                    .setLabel("Type a reply")
                    .build()
                val replyAction = NotificationCompat.Action.Builder(
                    android.R.drawable.ic_menu_send,
                    "Reply",
                    NotificationActionReceiver.replyPendingIntent(context, internalConversationId, tag, tag.hashCode(), tag.hashCode() + 1)
                ).addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build()
                builder.addAction(replyAction)
            } else {
                val notificationType = data["type"].orEmpty().lowercase()
                val whatsappPhone = (data["phone"] ?: data["phone_number"] ?: data["sender_phone"])
                    ?.takeIf { it.matches(Regex("[+0-9]{10,16}")) }
                val whatsappAudience = data["audience"].orEmpty()
                val employerConversationId = data["conversation_id"].orEmpty()
                val employerPhoneNumberId = data["phone_number_id"].orEmpty()
                val isEmployerWhatsApp = notificationType == "whatsapp_message" &&
                    data["employer_notification"] == "true" &&
                    employerConversationId.matches(Regex("[0-9a-fA-F-]{36}")) &&
                    employerPhoneNumberId.matches(Regex("[A-Za-z0-9_-]{5,100}"))
                val isOwnerSupportWhatsApp = notificationType == "whatsapp_message" &&
                    whatsappAudience == "customer_service" && whatsappPhone != null
                val metaPlatform = when {
                    notificationType == "instagram_message" || data["platform"] == "instagram" -> "instagram"
                    notificationType == "facebook_message" || data["platform"] == "facebook" -> "facebook"
                    else -> ""
                }
                val metaAccountId = data["account_id"].orEmpty()
                val metaRecipientId = data["sender_id"].orEmpty()
                val metaAudience = data["audience"].orEmpty()
                val isMetaInboxMessage = notificationType in setOf("instagram_message", "facebook_message") &&
                    metaPlatform.isNotBlank() &&
                    metaAccountId.matches(Regex("[A-Za-z0-9_-]{1,100}")) &&
                    metaRecipientId.matches(Regex("[A-Za-z0-9_-]{1,100}")) &&
                    (metaAudience.isEmpty() || metaAudience == "support")
                if (isEmployerWhatsApp) {
                    val remoteInput = androidx.core.app.RemoteInput.Builder("workly_employer_whatsapp_reply")
                        .setLabel("Reply to customer")
                        .build()
                    val replyAction = NotificationCompat.Action.Builder(
                        android.R.drawable.ic_menu_send,
                        "Reply",
                        NotificationActionReceiver.employerWhatsAppReplyPendingIntent(
                            context, employerConversationId, employerPhoneNumberId, tag, tag.hashCode(), tag.hashCode() + 31
                        )
                    ).addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build()
                    builder.addAction(replyAction)
                } else if (isOwnerSupportWhatsApp) {
                    val remoteInput = androidx.core.app.RemoteInput.Builder("workly_whatsapp_reply")
                        .setLabel("Reply on WhatsApp")
                        .build()
                    val replyAction = NotificationCompat.Action.Builder(
                        android.R.drawable.ic_menu_send,
                        "Reply",
                        NotificationActionReceiver.whatsappReplyPendingIntent(context, whatsappPhone!!, whatsappAudience, tag, tag.hashCode(), tag.hashCode() + 11)
                    ).addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build()
                    builder.addAction(replyAction)
                } else if (isMetaInboxMessage) {
                    val remoteInput = androidx.core.app.RemoteInput.Builder("workly_meta_reply")
                        .setLabel("Reply on " + if (metaPlatform == "instagram") "Instagram" else "Messenger")
                        .build()
                    val replyAction = NotificationCompat.Action.Builder(
                        android.R.drawable.ic_menu_send,
                        "Reply",
                        NotificationActionReceiver.metaReplyPendingIntent(
                            context, metaPlatform, metaAccountId, metaRecipientId, metaAudience, tag, tag.hashCode(), tag.hashCode() + 21
                        )
                    ).addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build()
                    builder.addAction(replyAction)
                }
                val platformActionLabel = when {
                    metaPlatform == "instagram" || notificationType.startsWith("instagram_") -> "Instagram"
                    metaPlatform == "facebook" || notificationType.startsWith("facebook_") -> "Facebook"
                    notificationType.startsWith("whatsapp_") -> "WhatsApp"
                    else -> "Open chat"
                }
                builder.addAction(
                    android.R.drawable.ic_menu_view,
                    platformActionLabel,
                    activityPendingIntent(chatUrl, tag.hashCode() + 1)
                )
            }
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
