package com.worklyindia.aivoice

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import java.io.File

/**
 * Downloads optional offline speech packs without bundling model weights in the APK.
 *
 * Call start() only after the user has accepted the app's existing mobile-data
 * consent. DownloadManager persists transfers across process restarts.
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
        val existing = snapshot(pack)
        if (existing.state == State.COMPLETE) return existing
        if (existing.files.any { it.state == State.PENDING || it.state == State.RUNNING || it.state == State.PAUSED }) {
            return existing
        }

        val ids = mutableSetOf<String>()
        pack.files.forEachIndexed { index, modelFile ->
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
            ids += manager.enqueue(request).toString()
        }
        prefs.edit().putStringSet(packKey(pack.id), ids).apply()
        return snapshot(pack)
    }

    fun snapshot(pack: SpeechModelCatalog.Pack): Snapshot {
        val ids = prefs.getStringSet(packKey(pack.id), emptySet()).orEmpty()
        if (ids.isEmpty()) return Snapshot(pack.id, State.NOT_DOWNLOADED, 0L, pack.totalBytes, emptyList())

        val rows = mutableListOf<FileStatus>()
        val orderedIds = ids.mapNotNull { it.toLongOrNull() }.sorted()
        orderedIds.forEachIndexed { index, id ->
            val file = pack.files.getOrNull(index) ?: return@forEachIndexed
            val query = DownloadManager.Query().setFilterById(id)
            manager.query(query).use { cursor ->
                if (!cursor.moveToFirst()) {
                    rows += FileStatus(file.relativePath, State.FAILED, 0L, file.expectedBytes)
                } else {
                    val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                    val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                    val state = when (status) {
                        DownloadManager.STATUS_PENDING -> State.PENDING
                        DownloadManager.STATUS_RUNNING -> State.RUNNING
                        DownloadManager.STATUS_PAUSED -> State.PAUSED
                        DownloadManager.STATUS_SUCCESSFUL -> {
                            val target = File(
                                appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                                "workly-voice-models/${pack.id}/${file.relativePath}"
                            )
                            if (target.isFile && target.length() == file.expectedBytes) State.COMPLETE else State.FAILED
                        }
                        else -> State.FAILED
                    }
                    rows += FileStatus(file.relativePath, state, downloaded.coerceAtLeast(0L),
                        if (total > 0L) total else file.expectedBytes)
                }
            }
        }
        val downloaded = rows.sumOf { it.downloadedBytes }
        val total = pack.totalBytes
        val state = when {
            rows.size == pack.files.size && rows.all { it.state == State.COMPLETE } -> State.COMPLETE
            rows.any { it.state == State.FAILED } -> State.FAILED
            rows.any { it.state == State.RUNNING } -> State.RUNNING
            rows.any { it.state == State.PENDING } -> State.PENDING
            rows.any { it.state == State.PAUSED } -> State.PAUSED
            else -> State.NOT_DOWNLOADED
        }
        return Snapshot(pack.id, state, downloaded, total, rows)
    }

    fun cancel(pack: SpeechModelCatalog.Pack) {
        val ids = prefs.getStringSet(packKey(pack.id), emptySet()).orEmpty()
        ids.mapNotNull { it.toLongOrNull() }.toLongArray().takeIf { it.isNotEmpty() }?.let(manager::remove)
        prefs.edit().remove(packKey(pack.id)).apply()
    }

    fun modelDirectory(pack: SpeechModelCatalog.Pack): File {
        return File(
            appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            "workly-voice-models/${pack.id}"
        )
    }

    private fun packKey(id: String) = "download_ids_$id"
}
