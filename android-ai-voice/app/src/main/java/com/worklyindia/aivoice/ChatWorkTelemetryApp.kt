package com.worklyindia.aivoice

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Sends privacy-minimal Android app session telemetry through the existing
 * record_android_app_session RPC. No schema changes or new tables are used.
 */
class ChatWorkTelemetryApp : Application(), Application.ActivityLifecycleCallbacks {
    private val io = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private var startedActivities = 0
    private var sessionId: String? = null
    private var heartbeat: Runnable? = null

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityStarted(activity: Activity) {
        startedActivities++
        if (startedActivities == 1) startTracking()
    }

    override fun onActivityStopped(activity: Activity) {
        startedActivities = (startedActivities - 1).coerceAtLeast(0)
        if (startedActivities == 0) {
            handler.postDelayed({
                if (startedActivities == 0) stopTracking()
            }, 900)
        }
    }

    private fun startTracking() {
        if (sessionId == null) sessionId = UUID.randomUUID().toString()
        sendSession(end = false)
        heartbeat?.let(handler::removeCallbacks)
        val task = object : Runnable {
            override fun run() {
                if (startedActivities > 0) {
                    sendSession(end = false)
                    handler.postDelayed(this, HEARTBEAT_MS)
                }
            }
        }
        heartbeat = task
        handler.postDelayed(task, HEARTBEAT_MS)
    }

    private fun stopTracking() {
        heartbeat?.let(handler::removeCallbacks)
        heartbeat = null
        sendSession(end = true)
        sessionId = null
    }

    private fun sendSession(end: Boolean) {
        val currentSession = sessionId ?: return
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        var installationId = prefs.getString(INSTALLATION_ID, null)
        if (installationId.isNullOrBlank()) {
            installationId = UUID.randomUUID().toString()
            prefs.edit().putString(INSTALLATION_ID, installationId).apply()
        }
        val appVersion = runCatching {
            @Suppress("DEPRECATION")
            packageManager.getPackageInfo(packageName, 0).versionName ?: "Unknown"
        }.getOrDefault("Unknown")
        val device = listOf(Build.MANUFACTURER, Build.MODEL).filter { it.isNotBlank() }.joinToString(" ").take(120)
        val values = JSONObject()
            .put("p_session_id", currentSession)
            .put("p_installation_id", installationId)
            .put("p_device_model", device.ifBlank { "Android device" })
            .put("p_os_version", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            .put("p_app_version", appVersion)
            .put("p_end_session", end)
        val accessToken = SecureDeviceTokenStore.readAccessToken(this)
        io.execute {
            runCatching {
                val connection = (URL("${BuildConfig.SUPABASE_URL}/rest/v1/rpc/record_android_app_session").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10_000
                    readTimeout = 15_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                    setRequestProperty("Authorization", "Bearer ${accessToken ?: BuildConfig.SUPABASE_PUBLISHABLE_KEY}")
                }
                try {
                    connection.outputStream.use { it.write(values.toString().toByteArray(Charsets.UTF_8)) }
                    val status = connection.responseCode
                    if (status !in 200..299) {
                        val detail = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        android.util.Log.w(TAG, "Session telemetry rejected ($status): ${detail.take(200)}")
                    }
                } finally { connection.disconnect() }

                // Refresh the existing model_capabilities JSON through the
                // current relay action. This records installed/removed relay-ready
                // models without adding a database table or column.
                val deviceToken = SecureDeviceTokenStore.read(this)
                if (!deviceToken.isNullOrBlank()) {
                    val workerPrefs = getSharedPreferences(VoiceWorkerCapabilityRegistry.WORKER_PREFS, MODE_PRIVATE)
                    val enabled = workerPrefs.getBoolean(VoiceWorkerCapabilityRegistry.WORKER_ENABLED_KEY, false)
                    val capabilities = VoiceWorkerCapabilityRegistry.downloadedRelayCapabilities(this)
                    VoiceRelayApi.setWorkerState(deviceToken, enabled, capabilities)
                }
            }.onFailure { android.util.Log.w(TAG, "Session/model telemetry failed", it) }
        }
    }

    override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
    override fun onActivityResumed(activity: Activity) = Unit
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit

    companion object {
        private const val TAG = "ChatWorkTelemetry"
        private const val PREFS = "chatwork_telemetry"
        private const val INSTALLATION_ID = "installation_id"
        private const val HEARTBEAT_MS = 15 * 60 * 1000L
    }
}
