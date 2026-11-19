package com.worklyindia.aivoice

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import java.io.File

/** Downloads the pinned, quantized SD 1.5 model once; inference remains on this phone. */
object ImageModelManager {
    const val MODEL_FILE_NAME = "stable-diffusion-v1-5-pruned-emaonly-Q4_0.gguf"
    const val MODEL_SIZE_BYTES = 1_566_768_416L
    const val MODEL_URL = "https://huggingface.co/second-state/stable-diffusion-v1-5-GGUF/resolve/main/stable-diffusion-v1-5-pruned-emaonly-Q4_0.gguf?download=true"
    private const val PREFS = "chatwork_local_image_model"
    private const val DOWNLOAD_ID_KEY = "download_id"

    data class DownloadState(
        val status: Int,
        val downloadedBytes: Long,
        val totalBytes: Long,
        val reason: Int = 0
    ) {
        val progressPercent: Int
            get() = if (totalBytes > 0) ((downloadedBytes * 100) / totalBytes).toInt().coerceIn(0, 100) else 0
    }

    fun modelFile(context: Context): File {
        val downloads = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
        return File(downloads, "ChatWork/models/$MODEL_FILE_NAME")
    }

    fun isModelReady(context: Context): Boolean {
        val file = modelFile(context)
        return file.isFile && file.length() == MODEL_SIZE_BYTES
    }

    fun startDownload(context: Context): Long {
        if (isModelReady(context)) return -1L
        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val oldId = savedDownloadId(context)
        if (oldId != null) {
            val oldState = query(context, oldId)
            if (oldState != null && (oldState.status == DownloadManager.STATUS_PENDING ||
                    oldState.status == DownloadManager.STATUS_RUNNING ||
                    oldState.status == DownloadManager.STATUS_PAUSED)) return oldId
            if (oldState?.status == DownloadManager.STATUS_FAILED) manager.remove(oldId)
        }
        val target = modelFile(context)
        target.parentFile?.mkdirs()
        if (target.exists() && target.length() != MODEL_SIZE_BYTES) target.delete()
        val request = DownloadManager.Request(Uri.parse(MODEL_URL))
            .setTitle("ChatWork local image AI model")
            .setDescription("Downloading Stable Diffusion 1.5 Q4 model (1.57 GB). Wi-Fi only.")
            .setMimeType("application/octet-stream")
            .setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)
            .setAllowedOverMetered(false)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(
                context,
                Environment.DIRECTORY_DOWNLOADS,
                "ChatWork/models/$MODEL_FILE_NAME"
            )
        val id = manager.enqueue(request)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(DOWNLOAD_ID_KEY, id).apply()
        return id
    }

    fun savedDownloadId(context: Context): Long? {
        val value = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(DOWNLOAD_ID_KEY, -1L)
        return value.takeIf { it > 0L }
    }

    fun query(context: Context, id: Long): DownloadState? {
        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val cursor = manager.query(DownloadManager.Query().setFilterById(id)) ?: return null
        cursor.use {
            if (!it.moveToFirst()) return null
            fun longColumn(name: String): Long {
                val index = it.getColumnIndex(name)
                return if (index >= 0) it.getLong(index) else 0L
            }
            return DownloadState(
                status = longColumn(DownloadManager.COLUMN_STATUS).toInt(),
                downloadedBytes = longColumn(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR),
                totalBytes = longColumn(DownloadManager.COLUMN_TOTAL_SIZE_BYTES),
                reason = longColumn(DownloadManager.COLUMN_REASON).toInt()
            )
        }
    }

    fun cancel(context: Context) {
        val id = savedDownloadId(context) ?: return
        (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).remove(id)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(DOWNLOAD_ID_KEY).apply()
        modelFile(context).delete()
    }
}
