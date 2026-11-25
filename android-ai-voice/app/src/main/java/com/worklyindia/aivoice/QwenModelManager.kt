package com.worklyindia.aivoice

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile

class QwenModelManager(context: Context) {
    data class Model(val id: String, val title: String, val size: Long, val url: String, val fileName: String, val minFreeRam: Long, val premium: Boolean = false) {
        override fun toString() = title + " · " + (size / 1_000_000) + " MB" + if (premium) " · Premium" else ""
    }
    enum class State { NOT_DOWNLOADED, PENDING, RUNNING, PAUSED, FAILED, NEEDS_TEST, READY }
    data class Snapshot(val state: State, val downloaded: Long = 0, val total: Long, val downloadId: Long = -1) {
        val progressPercent get() = if (total > 0) (downloaded * 100 / total).toInt().coerceIn(0,100) else 0
    }
    private val app = context.applicationContext
    private val dm = app.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private val prefs = app.getSharedPreferences("workly_qwen_models", Context.MODE_PRIVATE)
    private val dir get() = File(app.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: throw IOException("App storage unavailable"), "workly-ai")
    val models = listOf(
        Model("0.5b", "Qwen 2.5 0.5B Q4_K_M", 491400032L, "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf", "qwen2.5-0.5b-instruct-q4_k_m.gguf", 900L*1024*1024),
        Model("1.5b", "Qwen 2.5 1.5B Q4_K_M", 1117320736L, "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf", "qwen2.5-1.5b-instruct-q4_k_m.gguf", 1900L*1024*1024),
        Model("3b", "Qwen 2.5 3B Q4_K_M", 2104932768L, "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf", "qwen2.5-3b-instruct-q4_k_m.gguf", 3500L*1024*1024, true),
        Model("qwen3-0.6b", "Qwen3 0.6B Q8_0", 639446688L, "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q8_0.gguf", "qwen3-0.6b-q8_0.gguf", 1400L*1024*1024)
    )
    fun file(model: Model) = File(dir, model.fileName)
    fun recommendedModel(availableRam: Long): Model = models.filter { availableRam >= it.minFreeRam }.maxByOrNull { it.minFreeRam } ?: models.first()
    fun isSupported(model: Model, availableRam: Long) = availableRam >= model.minFreeRam
    fun snapshot(model: Model): Snapshot {
        val f=file(model)
        if (valid(f, model)) {
            if (!prefs.contains("installed_at_" + model.id)) {
                val stamp = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }.format(java.util.Date())
                prefs.edit().putString("installed_at_" + model.id, stamp).apply()
            }
            val tested = prefs.getBoolean("tested_" + model.id, false)
            return Snapshot(if (tested) State.READY else State.NEEDS_TEST, model.size, model.size)
        }
        val id=prefs.getLong("download_" + model.id, -1)
        if (id <= 0) return Snapshot(State.NOT_DOWNLOADED, total=model.size)
        val c=dm.query(DownloadManager.Query().setFilterById(id)) ?: return Snapshot(State.FAILED,total=model.size,downloadId=id)
        c.use {
            if (!it.moveToFirst()) return Snapshot(State.NOT_DOWNLOADED,total=model.size,downloadId=id)
            val status=it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val bytes=it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).coerceAtLeast(0)
            val total=it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).takeIf { n -> n>0 } ?: model.size
            val state=when(status) {
                DownloadManager.STATUS_PENDING -> State.PENDING
                DownloadManager.STATUS_RUNNING -> State.RUNNING
                DownloadManager.STATUS_PAUSED -> State.PAUSED
                DownloadManager.STATUS_SUCCESSFUL -> if(valid(f,model)) State.READY else State.FAILED
                else -> State.FAILED
            }
            return Snapshot(state,bytes,total,id)
        }
    }
    fun installedAt(model: Model): String? {
        if (snapshot(model).state !in setOf(State.READY, State.NEEDS_TEST)) return null
        return prefs.getString("installed_at_" + model.id, null)
    }

    @Throws(IOException::class)
    fun startDownload(model: Model, allowMobileData: Boolean = false): Long {
        val s=snapshot(model)
        if(s.state==State.READY || s.state==State.NEEDS_TEST) return -1
        if(s.state==State.RUNNING || s.state==State.PENDING || s.state==State.PAUSED) return s.downloadId
        if(!dir.exists() && !dir.mkdirs()) throw IOException("Cannot create model folder")
        val available=StatFs(dir.absolutePath).availableBytes
        val required=model.size+512L*1024*1024
        if(available<required) throw IOException("Need %.1f GB free storage".format(java.util.Locale.US,required/1e9))
        file(model).delete()
        val request=DownloadManager.Request(Uri.parse(model.url))
            .setTitle("Workly AI · " + model.title)
            .setDescription("Downloading offline AI model")
            .setAllowedNetworkTypes(if (allowMobileData) DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE else DownloadManager.Request.NETWORK_WIFI)
            .setAllowedOverMetered(allowMobileData)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(app,Environment.DIRECTORY_DOWNLOADS,"workly-ai/" + model.fileName)
        val id=dm.enqueue(request)
        prefs.edit().remove("tested_" + model.id).putLong("download_" + model.id,id).apply()
        return id
    }
    fun markTested(model: Model, passed: Boolean) {
        prefs.edit().putBoolean("tested_" + model.id, passed).apply()
    }

    fun cancelAndDelete(model: Model) {
        val id=prefs.getLong("download_" + model.id,-1)
        if(id>0) dm.remove(id)
        file(model).delete()
        prefs.edit().remove("download_" + model.id).remove("installed_at_" + model.id)
            .remove("tested_" + model.id).apply()
    }
    fun valid(file: File, model: Model): Boolean {
        if(!file.isFile || file.length()!=model.size) return false
        return try { RandomAccessFile(file,"r").use { val b=ByteArray(4); it.readFully(b); b.contentEquals(byteArrayOf(71,71,85,70)) } } catch(_:Exception){false}
    }
}