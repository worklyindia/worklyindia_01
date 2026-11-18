package com.worklyindia.aivoice

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import java.io.File
import java.security.MessageDigest
import java.io.IOException

/** Wi-Fi-only downloader for the optional Kokoro multilingual TTS bundle. */
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

    fun startDownload(): Long {
        val current = snapshot()
        if (current.state == State.READY) return -1L
        if (current.state == State.PENDING || current.state == State.RUNNING || current.state == State.PAUSED) {
            return current.downloadId
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
            .setDescription("Kokoro Hindi and English voice · Wi-Fi only · about 295 MB")
            .setMimeType("application/octet-stream")
            .setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)
            .setAllowedOverMetered(false)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(app, Environment.DIRECTORY_DOWNLOADS, "workly-voice/${KokoroSpeechEngine.MODEL_FILE_NAME}")
        val id = manager.enqueue(request)
        prefs.edit().putLong(KEY_ID, id).apply()
        return id
    }

    fun snapshot(): Snapshot {
        if (modelFile.isFile && modelFile.length() == KokoroSpeechEngine.MODEL_SIZE_BYTES) {
            val verifiedStamp = prefs.getLong(KEY_VERIFIED_STAMP, -1L)
            if (verifiedStamp == modelFile.lastModified()) {
                return Snapshot(State.READY, KokoroSpeechEngine.MODEL_SIZE_BYTES)
            }
            val valid = runCatching { modelFile.sha256Hex() == KokoroSpeechEngine.MODEL_SHA256 }.getOrDefault(false)
            if (valid) {
                prefs.edit().putLong(KEY_VERIFIED_STAMP, modelFile.lastModified()).apply()
                return Snapshot(State.READY, KokoroSpeechEngine.MODEL_SIZE_BYTES)
            }
            modelFile.delete()
            prefs.edit().remove(KEY_VERIFIED_STAMP).apply()
            return Snapshot(State.FAILED)
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

    private fun File.sha256Hex(): String {
        val digest = MessageDigest.getInstance("SHA-256")
        inputStream().buffered().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val KEY_ID = "kokoro_download_id"
        private const val KEY_VERIFIED_STAMP = "kokoro_verified_last_modified"
    }
}
