package com.worklyindia.aivoice

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import java.io.File
import java.io.IOException

/** User-consented Wi-Fi/mobile downloader for the optional Kokoro multilingual TTS bundle. */
class KokoroModelManager(context: Context) {
    enum class State { NOT_DOWNLOADED, PENDING, RUNNING, PAUSED, FAILED, READY }
    data class Snapshot(
        val state: State,
        val downloadedBytes: Long = 0L,
        val totalBytes: Long = KokoroSpeechEngine.MODEL_SIZE_BYTES,
        val downloadId: Long = -1L
    ) {
        val progressPercent: Int
            get() = if (totalBytes > 0L) ((downloadedBytes * 100L) / totalBytes).toInt().coerceIn(0, 100) else 0
    }

    private val app = context.applicationContext
    private val manager = app.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private val prefs = app.getSharedPreferences("workly_kokoro_model", Context.MODE_PRIVATE)
    private val directory: File
        get() = File(
            app.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: throw IOException("App-specific model storage is unavailable."),
            "workly-voice"
        )
    val modelFile: File get() = File(directory, KokoroSpeechEngine.MODEL_FILE_NAME)

    fun startDownload(allowMobileData: Boolean = false): Long {
        val current = snapshot()
        if (current.state == State.READY) return -1L
        if (current.state == State.RUNNING || current.state == State.PENDING || current.state == State.PAUSED) {
            val savedNetworkChoice = preferences.getBoolean(KEY_ALLOW_MOBILE_DATA, false)
            if (savedNetworkChoice == allowMobileData) return current.downloadId
            if (current.downloadId > 0L) manager.remove(current.downloadId)
            preferences.edit().remove(KEY_ID).apply()
        }
        if (!directory.exists() && !directory.mkdirs()) {
            throw IOException("Could not create the Kokoro model folder.")
        }
        val available = StatFs(directory.absolutePath).availableBytes
        val required = KokoroSpeechEngine.MODEL_SIZE_BYTES + 512L * 1024L * 1024L
        if (available < required) {
            throw IOException("Not enough free storage for Kokoro. Need about 0.9 GB including temporary space.")
        }
        modelFile.delete()
        val request = DownloadManager.Request(Uri.parse(KokoroSpeechEngine.MODEL_URL))
            .setTitle("Workly Voice · Kokoro speech model")
            .setDescription(if (allowMobileData) "Kokoro Hindi and English voice · Wi-Fi or mobile data · about 295 MB" else "Kokoro Hindi and English voice · Wi-Fi only · about 295 MB")
            .setMimeType("application/octet-stream")
            .setAllowedNetworkTypes(if (allowMobileData) DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE else DownloadManager.Request.NETWORK_WIFI)
            .setAllowedOverMetered(allowMobileData)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(app, Environment.DIRECTORY_DOWNLOADS, "workly-voice/${KokoroSpeechEngine.MODEL_FILE_NAME}")
        val id = manager.enqueue(request)
        prefs.edit().putLong(KEY_ID, id).putBoolean(KEY_ALLOW_MOBILE_DATA, allowMobileData).apply()
        return id
    }

    fun snapshot(): Snapshot {
        if (modelFile.isFile && modelFile.length() == KokoroSpeechEngine.MODEL_SIZE_BYTES) {
            return Snapshot(State.READY, KokoroSpeechEngine.MODEL_SIZE_BYTES)
        }
        val id = prefs.getLong(KEY_ID, -1L)
        if (id <= 0L) return Snapshot(State.NOT_DOWNLOADED)
        val cursor = manager.query(DownloadManager.Query().setFilterById(id))
            ?: return Snapshot(State.FAILED, downloadId = id)
        cursor.use {
            if (!it.moveToFirst()) return Snapshot(State.NOT_DOWNLOADED, downloadId = id)
            val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val bytes = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).coerceAtLeast(0L)
            val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                .takeIf { value -> value > 0L } ?: KokoroSpeechEngine.MODEL_SIZE_BYTES
            val state = when (status) {
                DownloadManager.STATUS_PENDING -> State.PENDING
                DownloadManager.STATUS_RUNNING -> State.RUNNING
                DownloadManager.STATUS_PAUSED -> State.PAUSED
                DownloadManager.STATUS_SUCCESSFUL ->
                    if (modelFile.isFile && modelFile.length() == KokoroSpeechEngine.MODEL_SIZE_BYTES) State.READY else State.FAILED
                else -> State.FAILED
            }
            return Snapshot(state, bytes, total, id)
        }
    }

    fun cancelAndDelete() {
        val id = prefs.getLong(KEY_ID, -1L)
        if (id > 0L) manager.remove(id)
        modelFile.delete()
        prefs.edit().remove(KEY_ID).apply()
    }


    companion object {
        private const val KEY_ID = "kokoro_download_id"
        private const val KEY_ALLOW_MOBILE_DATA = "allow_mobile_data_for_kokoro"
    }
}
