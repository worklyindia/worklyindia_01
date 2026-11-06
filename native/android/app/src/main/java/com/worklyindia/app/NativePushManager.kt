package com.worklyindia.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
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
    private const val CHANNEL_ID = "workly_updates"

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Workly India updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Jobs, applications, messages and account updates"
                enableVibration(true)
            }
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    suspend fun register(context: Context, session: NativeSession): Boolean = withContext(Dispatchers.IO) {
        try {
            // Initialize explicitly as a safety net for fresh installs and OEM startup timing.
            if (FirebaseApp.getApps(context).isEmpty() && FirebaseApp.initializeApp(context) == null) {
                android.util.Log.e("WorklyPush", "Firebase default app could not initialize; check google-services.json")
                return@withContext false
            }
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
                .put("user_role", "jobseeker")
                .put("fcm_token", token)
                .put("platform", "android")
                .put("device_info", info)
                .put("enabled", true)
                .put("last_seen_at", java.time.Instant.now().toString())

            val connection = (URL("$SUPABASE_URL/rest/v1/push_subscriptions?on_conflict=fcm_token").openConnection() as HttpURLConnection)
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 20000
            connection.setRequestProperty("apikey", SUPABASE_KEY)
            connection.setRequestProperty("Authorization", "Bearer ${session.accessToken}")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
            connection.doOutput = true
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            connection.disconnect()
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
            if (FirebaseApp.getApps(context).isEmpty()) return@withContext
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
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notification_url", data["url"])
            putExtra("notification_type", data["type"])
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            (data["tag"] ?: title).hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_workly_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .build()
        NotificationManagerCompat.from(context).notify(
            data["tag"] ?: "workly-${System.currentTimeMillis()}",
            (data["tag"] ?: title).hashCode(),
            notification
        )
    }
}
