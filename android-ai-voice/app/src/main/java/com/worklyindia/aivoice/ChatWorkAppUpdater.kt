package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Checks the independently published ChatWork release channel and offers a safe APK update. */
internal class ChatWorkAppUpdater(private val activity: Activity) {
    private val executor = Executors.newSingleThreadExecutor()
    private val checking = AtomicBoolean(false)
    private var downloadId = -1L
    private var pendingInstallUri: Uri? = null
    private var waitingForInstallPermission = false
    private var receiverRegistered = false

    private val downloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
            val completed = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
            if (completed != downloadId) return
            val manager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            manager.query(DownloadManager.Query().setFilterById(completed)).use { cursor ->
                if (!cursor.moveToFirst()) return
                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    pendingInstallUri = manager.getUriForDownloadedFile(completed)
                    if (pendingInstallUri != null) activity.runOnUiThread { installDownloadedUpdate() }
                    else activity.runOnUiThread { Toast.makeText(activity, "Downloaded update could not be opened.", Toast.LENGTH_LONG).show() }
                } else {
                    val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                    activity.runOnUiThread {
                        Toast.makeText(activity, "ChatWork update download failed ($reason). Please try again.", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    init {
        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        if (Build.VERSION.SDK_INT >= 33) {
            activity.registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            activity.registerReceiver(downloadReceiver, filter)
        }
        receiverRegistered = true
    }

    fun checkForUpdate() {
        if (!checking.compareAndSet(false, true)) return
        executor.execute {
            try {
                val base = BuildConfig.SUPABASE_URL.trimEnd('/')
                val endpoint = base + "/rest/v1/chatwork_app_releases" +
                    "?select=version_code,version_name,apk_path,apk_size_bytes,release_notes,min_supported_version_code" +
                    "&is_published=eq.true&order=version_code.desc&limit=1"
                val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 15000
                    readTimeout = 20000
                    setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                    setRequestProperty("Accept", "application/json")
                }
                val payload = try {
                    if (connection.responseCode !in 200..299) throw IllegalStateException("Update check returned HTTP ${connection.responseCode}")
                    connection.inputStream.bufferedReader().use { it.readText() }
                } finally {
                    connection.disconnect()
                }
                val rows = org.json.JSONArray(payload)
                if (rows.length() == 0) return@execute
                val release = rows.getJSONObject(0)
                val targetCode = release.optLong("version_code", 0L)
                val minSupportedCode = release.optLong("min_supported_version_code", 1L)
                val currentCode = if (Build.VERSION.SDK_INT >= 28) {
                    activity.packageManager.getPackageInfo(activity.packageName, 0).longVersionCode
                } else {
                    @Suppress("DEPRECATION")
                    activity.packageManager.getPackageInfo(activity.packageName, 0).versionCode.toLong()
                }
                val apkUrl = release.optString("apk_path", "")
                if (targetCode <= currentCode || !isAllowedReleaseUrl(apkUrl)) return@execute
                activity.runOnUiThread {
                    if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
                    val version = release.optString("version_name", targetCode.toString())
                    val notes = release.optString("release_notes", "").trim()
                    val required = currentCode < minSupportedCode
                    val message = buildString {
                        append("A new ChatWork version is available (v").append(version).append(").")
                        if (notes.isNotEmpty()) append("\n\n").append(notes)
                        append(if (required) "\n\nThis update is required to continue using ChatWork." else "\n\nDownload and install the update now?")
                    }
                    val dialog = AlertDialog.Builder(activity)
                        .setTitle(if (required) "Required ChatWork update" else "ChatWork update available")
                        .setMessage(message)
                        .setPositiveButton("Download update") { _, _ -> downloadUpdate(apkUrl, version) }
                        .create()
                    dialog.setCancelable(!required)
                    if (!required) dialog.setButton(AlertDialog.BUTTON_NEGATIVE, "Later") { _, _ -> }
                    dialog.show()
                }
            } catch (error: Exception) {
                android.util.Log.w("ChatWorkUpdater", "Update check failed", error)
            } finally {
                checking.set(false)
            }
        }
    }

    fun onResume() {
        if (waitingForInstallPermission && Build.VERSION.SDK_INT >= 26 &&
            activity.packageManager.canRequestPackageInstalls()) {
            waitingForInstallPermission = false
            installDownloadedUpdate()
        }
    }

    private fun downloadUpdate(apkUrl: String, version: String) {
        try {
            val request = DownloadManager.Request(Uri.parse(apkUrl))
                .setTitle("ChatWork v$version")
                .setDescription("Downloading ChatWork update")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, "ChatWork-v$version.apk")
            val manager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadId = manager.enqueue(request)
            Toast.makeText(activity, "ChatWork update download started.", Toast.LENGTH_LONG).show()
        } catch (error: Exception) {
            Toast.makeText(activity, error.message ?: "Could not start the update download.", Toast.LENGTH_LONG).show()
        }
    }

    private fun installDownloadedUpdate() {
        val uri = pendingInstallUri ?: return
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            waitingForInstallPermission = true
            val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.packageName))
            activity.startActivity(settingsIntent)
            Toast.makeText(activity, "Allow ChatWork to install updates, then return here.", Toast.LENGTH_LONG).show()
            return
        }
        try {
            val install = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(install)
            pendingInstallUri = null
        } catch (error: Exception) {
            Toast.makeText(activity, error.message ?: "Could not open the Android installer.", Toast.LENGTH_LONG).show()
        }
    }

    private fun isAllowedReleaseUrl(value: String): Boolean = runCatching {
        val uri = Uri.parse(value)
        uri.scheme == "https" &&
            (uri.host == "pub-e8cec40741a24d08bc49bd0c7070f8f3.r2.dev" || uri.host == "downloads.devs.surf") &&
            uri.path?.startsWith("/chatwork/releases/chatwork-v") == true &&
            uri.path?.endsWith("/ChatWork.apk") == true
    }.getOrDefault(false)

    fun close() {
        if (receiverRegistered) {
            runCatching { activity.unregisterReceiver(downloadReceiver) }
            receiverRegistered = false
        }
        executor.shutdownNow()
    }
}
