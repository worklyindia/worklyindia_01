package com.worklyindia.aivoice

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile

/**
 * On-demand downloader for Workly's offline language model.
 *
 * The GGUF file is stored in app-specific external storage, never in the APK
 * and never in the user's public Downloads folder.
 */
class OfflineModelManager(context: Context) {
    enum class State { NOT_DOWNLOADED, PENDING, RUNNING, PAUSED, FAILED, READY }

    data class Snapshot(
        val state: State,
        val downloadedBytes: Long = 0L,
        val totalBytes: Long = MODEL_SIZE_BYTES,
        val reason: Int = 0,
        val downloadId: Long = -1L
    ) {
        val progressPercent: Int
            get() = if (totalBytes > 0L) ((downloadedBytes * 100L) / totalBytes).toInt().coerceIn(0, 100) else 0
    }

    private val appContext = context.applicationContext
    private val downloadManager =
        appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private val preferences = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val downloadDirectory: File
        get() = File(
            appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: throw IOException("App-specific download storage is unavailable."),
            "workly-ai"
        )

    val modelFile: File
        get() = File(downloadDirectory, MODEL_FILENAME)

    @Throws(IOException::class)
    fun startDownload(): Long {
        val current = snapshot()
        if (current.state == State.READY) return -1L
        if (current.state == State.RUNNING || current.state == State.PENDING || current.state == State.PAUSED) {
            return current.downloadId
        }

        val directory = downloadDirectory
        if (!directory.exists() && !directory.mkdirs()) {
            throw IOException("Could not create the Workly AI model folder.")
        }

        val availableBytes = StatFs(directory.absolutePath).availableBytes
        val requiredBytes = MODEL_SIZE_BYTES + MIN_FREE_SPACE_AFTER_DOWNLOAD
        if (availableBytes < requiredBytes) {
            val requiredGb = requiredBytes / 1_000_000_000.0
            val availableGb = availableBytes / 1_000_000_000.0
            throw IOException(
                "Not enough free storage. Need about %.1f GB; available %.1f GB."
                    .format(java.util.Locale.US, requiredGb, availableGb)
            )
        }

        modelFile.delete()
        val request = DownloadManager.Request(Uri.parse(MODEL_URL))
            .setTitle("Workly AI offline model")
            .setDescription("Automatic Wi-Fi download · Qwen2.5-3B-Instruct (about 2.1 GB)")
            .setMimeType("application/octet-stream")
            .setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)
            .setAllowedOverMetered(false)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(
                appContext,
                Environment.DIRECTORY_DOWNLOADS,
                "workly-ai/$MODEL_FILENAME"
            )

        val id = downloadManager.enqueue(request)
        preferences.edit().putLong(KEY_DOWNLOAD_ID, id).apply()
        return id
    }

    fun snapshot(): Snapshot {
        if (isValidModelFile(modelFile)) {
            return Snapshot(State.READY, MODEL_SIZE_BYTES, MODEL_SIZE_BYTES)
        }

        val id = preferences.getLong(KEY_DOWNLOAD_ID, -1L)
        if (id <= 0L) return Snapshot(State.NOT_DOWNLOADED)

        val cursor = downloadManager.query(DownloadManager.Query().setFilterById(id))
            ?: return Snapshot(State.FAILED, downloadId = id)
        cursor.use {
            if (!it.moveToFirst()) return Snapshot(State.NOT_DOWNLOADED, downloadId = id)
            val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val downloaded = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                .coerceAtLeast(0L)
            val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                .takeIf { value -> value > 0L } ?: MODEL_SIZE_BYTES
            val reason = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
            val state = when (status) {
                DownloadManager.STATUS_PENDING -> State.PENDING
                DownloadManager.STATUS_RUNNING -> State.RUNNING
                DownloadManager.STATUS_PAUSED -> State.PAUSED
                DownloadManager.STATUS_SUCCESSFUL -> {
                    if (isValidModelFile(modelFile)) State.READY else State.FAILED
                }
                DownloadManager.STATUS_FAILED -> State.FAILED
                else -> State.FAILED
            }
            return Snapshot(state, downloaded, total, reason, id)
        }
    }

    fun cancelAndDelete() {
        val id = preferences.getLong(KEY_DOWNLOAD_ID, -1L)
        if (id > 0L) downloadManager.remove(id)
        modelFile.delete()
        preferences.edit().remove(KEY_DOWNLOAD_ID).apply()
    }

    fun deleteDownloadedModel() = cancelAndDelete()

    private fun isValidModelFile(file: File): Boolean {
        if (!file.isFile || file.length() != MODEL_SIZE_BYTES) return false
        return try {
            RandomAccessFile(file, "r").use { input ->
                val magic = ByteArray(4)
                input.readFully(magic)
                magic.contentEquals(byteArrayOf('G'.code.toByte(), 'G'.code.toByte(), 'U'.code.toByte(), 'F'.code.toByte()))
            }
        } catch (_: Exception) {
            false
        }
    }

    companion object {
        const val MODEL_SIZE_BYTES = 2_104_932_768L
        const val MODEL_URL =
            "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf"
        const val MODEL_FILENAME = "qwen2.5-3b-instruct-q4_k_m.gguf"

        private const val PREFS_NAME = "workly_offline_ai_model"
        private const val KEY_DOWNLOAD_ID = "qwen25_3b_download_id"
        private const val MIN_FREE_SPACE_AFTER_DOWNLOAD = 512L * 1024L * 1024L
    }
}
