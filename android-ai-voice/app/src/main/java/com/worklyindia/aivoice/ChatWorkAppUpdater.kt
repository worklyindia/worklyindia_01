package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Checks the published ChatWork release channel. Updates are opened in the
 * browser/system package installer; ChatWork never requests install-packages
 * permission or installs downloaded APKs itself.
 */
internal class ChatWorkAppUpdater(private val activity: Activity) {
    private val executor = Executors.newSingleThreadExecutor()
    private val checking = AtomicBoolean(false)

    fun checkForUpdate() {
        if (!checking.compareAndSet(false, true)) return
        executor.execute {
            try {
                val base = BuildConfig.SUPABASE_URL.trimEnd('/')
                val endpoint = base + "/rest/v1/chatwork_app_releases" +
                    "?select=version_code,version_name,apk_path,release_notes,min_supported_version_code" +
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
                val currentCode = if (android.os.Build.VERSION.SDK_INT >= 28) {
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
                        append(if (required) "\n\nThis update is required. Download it to continue." else "\n\nOpen the official download page?")
                    }
                    val dialog = AlertDialog.Builder(activity)
                        .setTitle(if (required) "Required ChatWork update" else "ChatWork update available")
                        .setMessage(message)
                        .setPositiveButton("Open download") { _, _ -> openDownload(apkUrl) }
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

    private fun openDownload(apkUrl: String) {
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl)))
        } catch (error: Exception) {
            Toast.makeText(activity, error.message ?: "Could not open the official ChatWork download.", Toast.LENGTH_LONG).show()
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
        executor.shutdownNow()
    }
}
