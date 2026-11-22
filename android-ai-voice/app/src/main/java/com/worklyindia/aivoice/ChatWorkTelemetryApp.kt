package com.worklyindia.aivoice

import android.app.Application
import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Event-driven telemetry for the existing app_sessions/app_installations tables.
 * Network changes are reported by VoiceRelayService; no periodic heartbeat runs here.
 */
class ChatWorkTelemetryApp : Application() {
    override fun onCreate() {
        super.onCreate()
    }

    companion object {
        private const val TAG = "ChatWorkTelemetry"
        private const val PREFS = "chatwork_telemetry"
        private const val INSTALLATION_ID = "installation_id"
        private const val SESSION_ID = "session_id"
        private const val ONLINE_REPORTED = "online_reported"
        private const val PENDING_END = "pending_end"
        private val io = Executors.newSingleThreadExecutor()

        @Synchronized
        fun onRelayServiceStarted(context: Context, internetAvailable: Boolean) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            var sessionId = prefs.getString(SESSION_ID, null)
            if (sessionId.isNullOrBlank()) {
                sessionId = UUID.randomUUID().toString()
                prefs.edit().putString(SESSION_ID, sessionId).apply()
            }

            // If Android stopped the service while offline, close the previous
            // session once connectivity returns, then begin a fresh session.
            if (internetAvailable && prefs.getBoolean(PENDING_END, false)) {
                sendSession(context, sessionId, end = true)
                sessionId = UUID.randomUUID().toString()
                prefs.edit()
                    .putString(SESSION_ID, sessionId)
                    .putBoolean(PENDING_END, false)
                    .putBoolean(ONLINE_REPORTED, false)
                    .apply()
            }
            if (internetAvailable) {
                sendSession(context, sessionId, end = false)
                prefs.edit().putBoolean(ONLINE_REPORTED, true).apply()
            } else {
                prefs.edit().putBoolean(ONLINE_REPORTED, false).apply()
            }
        }

        @Synchronized
        fun onNetworkLost(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean(ONLINE_REPORTED, false)
                .apply()
            // No request is attempted while the phone has no validated internet.
        }

        @Synchronized
        fun onNetworkRestored(context: Context) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(ONLINE_REPORTED, false)) return
            var sessionId = prefs.getString(SESSION_ID, null)
            if (sessionId.isNullOrBlank()) {
                sessionId = UUID.randomUUID().toString()
                prefs.edit().putString(SESSION_ID, sessionId).apply()
            }
            if (prefs.getBoolean(PENDING_END, false)) {
                sendSession(context, sessionId, end = true)
                sessionId = UUID.randomUUID().toString()
                prefs.edit()
                    .putString(SESSION_ID, sessionId)
                    .putBoolean(PENDING_END, false)
                    .apply()
            }
            sendSession(context, sessionId, end = false)
            prefs.edit().putBoolean(ONLINE_REPORTED, true).apply()
        }

        @Synchronized
        fun onRelayServiceStopped(context: Context, internetAvailable: Boolean) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val sessionId = prefs.getString(SESSION_ID, null) ?: return
            if (internetAvailable) {
                sendSession(context, sessionId, end = true)
                prefs.edit()
                    .remove(SESSION_ID)
                    .putBoolean(ONLINE_REPORTED, false)
                    .putBoolean(PENDING_END, false)
                    .apply()
            } else {
                // Save the end event locally; deliver it when internet is back.
                prefs.edit()
                    .putBoolean(PENDING_END, true)
                    .putBoolean(ONLINE_REPORTED, false)
                    .apply()
            }
        }

        private fun sendSession(context: Context, sessionId: String, end: Boolean) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            var installationId = prefs.getString(INSTALLATION_ID, null)
            if (installationId.isNullOrBlank()) {
                installationId = UUID.randomUUID().toString()
                prefs.edit().putString(INSTALLATION_ID, installationId).apply()
            }
            val appVersion = runCatching {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "Unknown"
            }.getOrDefault("Unknown")
            val device = listOf(Build.MANUFACTURER, Build.MODEL)
                .filter { it.isNotBlank() }.joinToString(" ").take(120)
            val values = JSONObject()
                .put("p_event_id", UUID.randomUUID().toString())
                .put("p_session_id", sessionId)
                .put("p_installation_id", installationId)
                .put("p_native_installation_id", installationId)
                .put("p_device_model", device.ifBlank { "Android device" })
                .put("p_os_version", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
                .put("p_app_version", appVersion)
                .put("p_end_session", end)
            val accessToken = SecureDeviceTokenStore.readAccessToken(context)
            val appContext = context.applicationContext
            io.execute {
                runCatching {
                    val connection = (URL("${BuildConfig.SUPABASE_URL}/rest/v1/rpc/record_android_app_session")
                        .openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 10_000
                        readTimeout = 15_000
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                        setRequestProperty(
                            "Authorization",
                            "Bearer ${accessToken ?: BuildConfig.SUPABASE_PUBLISHABLE_KEY}"
                        )
                    }
                    try {
                        connection.outputStream.use {
                            it.write(values.toString().toByteArray(Charsets.UTF_8))
                        }
                        val status = connection.responseCode
                        if (status !in 200..299) {
                            val detail = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                            android.util.Log.w(TAG, "Session telemetry rejected ($status): ${detail.take(200)}")
                        }
                    } finally {
                        connection.disconnect()
                    }
                }.onFailure {
                    android.util.Log.w(TAG, "Session telemetry failed", it)
                }
            }
        }
    }
}
