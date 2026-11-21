package com.worklyindia.aivoice

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import java.io.File
import java.security.MessageDigest

/**
 * Downloads optional offline speech packs without bundling model weights in the APK.
 * Each file is tracked independently so completed files survive app updates/reboots
 * and retries enqueue only missing or invalid files.
 */
class SpeechPackDownloadManager(context: Context) {
    enum class State { NOT_DOWNLOADED, PENDING, RUNNING, PAUSED, COMPLETE, FAILED }

    data class FileStatus(
        val relativePath: String,
        val state: State,
        val downloadedBytes: Long,
        val totalBytes: Long
    )

    data class Snapshot(
        val packId: String,
        val state: State,
        val downloadedBytes: Long,
        val totalBytes: Long,
        val files: List<FileStatus>
    ) {
        val percent: Int
            get() = if (totalBytes <= 0L) 0 else
                ((downloadedBytes.coerceAtMost(totalBytes) * 100L) / totalBytes).toInt()
    }

    private val appContext = context.applicationContext
    private val manager = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private val prefs = appContext.getSharedPreferences("speech_pack_downloads", Context.MODE_PRIVATE)

    fun start(pack: SpeechModelCatalog.Pack, allowMobileData: Boolean): Snapshot {
        pack.files.forEachIndexed { index, modelFile ->
            val target = targetFile(pack, modelFile.relativePath)
            if (isCompleteFile(target, modelFile)) return@forEachIndexed

            val savedId = prefs.getLong(fileKey(pack.id, modelFile.relativePath), -1L)
            if (isActiveDownload(savedId)) return@forEachIndexed

            val request = DownloadManager.Request(Uri.parse(modelFile.url))
                .setTitle("${pack.title} (${index + 1}/${pack.files.size})")
                .setDescription("Downloading offline speech model")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setAllowedNetworkTypes(
                    if (allowMobileData) DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE
                    else DownloadManager.Request.NETWORK_WIFI
                )
                .setAllowedOverMetered(allowMobileData)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalFilesDir(
                    appContext,
                    Environment.DIRECTORY_DOWNLOADS,
                    "workly-voice-models/${pack.id}/${modelFile.relativePath}"
                )
            val id = manager.enqueue(request)
            prefs.edit().putLong(fileKey(pack.id, modelFile.relativePath), id).apply()
        }
        return snapshot(pack)
    }

    fun snapshot(pack: SpeechModelCatalog.Pack): Snapshot {
        val rows = pack.files.map { file ->
            val target = targetFile(pack, file.relativePath)
            if (isCompleteFile(target, file)) {
                return@map FileStatus(file.relativePath, State.COMPLETE, file.expectedBytes, file.expectedBytes)
            }

            val id = prefs.getLong(fileKey(pack.id, file.relativePath), -1L)
            if (id <= 0L) return@map FileStatus(file.relativePath, State.NOT_DOWNLOADED, 0L, file.expectedBytes)

            val cursor = manager.query(DownloadManager.Query().setFilterById(id))
                ?: return@map FileStatus(file.relativePath, State.FAILED, 0L, file.expectedBytes)
            cursor.use {
                if (!it.moveToFirst()) {
                    FileStatus(file.relativePath, State.NOT_DOWNLOADED, 0L, file.expectedBytes)
                } else {
                    val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    val downloaded = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).coerceAtLeast(0L)
                    val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                    val state = when (status) {
                        DownloadManager.STATUS_PENDING -> State.PENDING
                        DownloadManager.STATUS_RUNNING -> State.RUNNING
                        DownloadManager.STATUS_PAUSED -> State.PAUSED
                        DownloadManager.STATUS_SUCCESSFUL -> if (isCompleteFile(target, file)) State.COMPLETE else State.FAILED
                        else -> State.FAILED
                    }
                    FileStatus(file.relativePath, state, downloaded, if (total > 0L) total else file.expectedBytes)
                }
            }
        }

        val downloaded = rows.sumOf { it.downloadedBytes }
        val state = when {
            rows.all { it.state == State.COMPLETE } -> State.COMPLETE
            rows.any { it.state == State.FAILED } -> State.FAILED
            rows.any { it.state == State.RUNNING } -> State.RUNNING
            rows.any { it.state == State.PENDING } -> State.PENDING
            rows.any { it.state == State.PAUSED } -> State.PAUSED
            else -> State.NOT_DOWNLOADED
        }
        return Snapshot(pack.id, state, downloaded, pack.totalBytes, rows)
    }

    /** Stops active transfers but deliberately keeps completed model files. */
    fun cancel(pack: SpeechModelCatalog.Pack) {
        pack.files.forEach { file ->
            val id = prefs.getLong(fileKey(pack.id, file.relativePath), -1L)
            if (id > 0L) manager.remove(id)
            prefs.edit().remove(fileKey(pack.id, file.relativePath)).apply()
        }
    }

    /** Explicitly delete saved model files when the user chooses Delete. */
    fun delete(pack: SpeechModelCatalog.Pack) {
        cancel(pack)
        pack.files.forEach { file -> targetFile(pack, file.relativePath).delete() }
    }

    fun modelDirectory(pack: SpeechModelCatalog.Pack): File =
        File(
            appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            "workly-voice-models/${pack.id}"
        )

    private fun targetFile(pack: SpeechModelCatalog.Pack, relativePath: String): File =
        File(modelDirectory(pack), relativePath)

    private fun isCompleteFile(file: File, modelFile: SpeechModelCatalog.ModelFile): Boolean {
        if (!file.isFile || file.length() != modelFile.expectedBytes) return false
        val expectedSha = modelFile.sha256?.takeIf { it.isNotBlank() } ?: return true
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        val actualSha = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        return actualSha.equals(expectedSha, ignoreCase = true)
    }

    private fun isActiveDownload(id: Long): Boolean {
        if (id <= 0L) return false
        val cursor = manager.query(DownloadManager.Query().setFilterById(id)) ?: return false
        cursor.use {
            if (!it.moveToFirst()) return false
            return when (it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
                DownloadManager.STATUS_PENDING, DownloadManager.STATUS_RUNNING, DownloadManager.STATUS_PAUSED -> true
                else -> false
            }
        }
    }

    private fun fileKey(packId: String, relativePath: String) = "download_id_${packId}_${relativePath}"
}
