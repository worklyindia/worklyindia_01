package com.worklyindia.aivoice

import android.content.Context
import android.os.StatFs
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Resumable, SHA-256-verified installer for Saient's pinned Wan 2.1 mobile pack.
 * Downloads to a staging directory and swaps it into place only after all files verify.
 */
object WanVideoModelManager {
    const val PACK_ID = "wan2.1-t2v-1.3b-q4-v1"
    private const val BASE_URL = "https://saient.co.uk/models/$PACK_ID/"
    private const val HEADROOM_BYTES = 128L * 1024L * 1024L
    private const val PREFS = "chatwork_saient_wan"
    private const val KEY_PROGRESS = "download_progress"

    data class ModelFile(val name: String, val size: Long, val sha256: String)

    val files = listOf(
        ModelFile("wan2.1_t2v_1.3B_Q4_K.gguf", 816_061_024L, "65181afff758fba25cf311399ccb0638a746f8e0e6533e07a84a5a23e0c12318"),
        ModelFile("umt5-xxl-encoder-Q4_K_M.gguf", 3_655_145_312L, "17cf97a5bbbc60a646d6105b832b6f657ce904a8a1ad970e4b59df0c67584a40"),
        ModelFile("wan_2.1_vae.safetensors", 253_815_318L, "2fc39d31359a4b0a64f55876d8ff7fa8d780956ae2cb13463b0223e15148976b")
    )

    private val cancelled = AtomicBoolean(false)

    fun modelDirectory(context: Context): File =
        File(context.getExternalFilesDir(null) ?: context.filesDir, "ChatWork/models/$PACK_ID")

    fun isReady(context: Context): Boolean {
        val dir = modelDirectory(context)
        if (!File(dir, ".verified-pack").isFile || File(dir, ".verified-pack").readText().trim() != PACK_ID) return false
        return files.all { model ->
            val file = File(dir, model.name)
            file.isFile && file.length() == model.size && sha256(file) == model.sha256
        }
    }

    fun cancel() { cancelled.set(true) }

    fun download(context: Context, onProgress: (Long, Long, String) -> Unit) {
        cancelled.set(false)
        val parent = modelDirectory(context).parentFile ?: error("Model directory is unavailable.")
        if (!parent.exists() && !parent.mkdirs()) error("Cannot create model storage directory.")
        val target = modelDirectory(context)
        val staging = File(parent, ".$PACK_ID.download")
        val backup = File(parent, ".$PACK_ID.backup")
        val total = files.sumOf { it.size }
        val free = StatFs(parent.absolutePath).availableBytes
        val existing = files.sumOf { model ->
            val part = File(staging, "${model.name}.part")
            val ready = File(staging, model.name)
            when {
                ready.isFile && ready.length() == model.size -> model.size
                part.isFile -> part.length().coerceAtMost(model.size)
                else -> 0L
            }
        }
        if (free < (total - existing) + HEADROOM_BYTES) {
            error("Wan model needs about 4.73 GB plus 128 MB free storage. Free up space and retry.")
        }
        if (!staging.exists() && !staging.mkdirs()) error("Cannot create model download folder.")

        try {
            files.forEach { model ->
                checkCancelled()
                val destination = File(staging, model.name)
                if (destination.isFile && destination.length() == model.size && sha256(destination) == model.sha256) {
                    onProgress(files.sumOf { it.size } - files.dropWhile { it != model }.sumOf { it.size } + model.size, total, model.name)
                    return@forEach
                }
                destination.delete()
                val part = File(staging, "${model.name}.part")
                var attempt = 0
                var verified = false
                while (attempt < 4 && !verified) {
                    checkCancelled()
                    try {
                        downloadOne(model, part) { downloaded ->
                            val doneBefore = files.takeWhile { it != model }.sumOf { it.size }
                            onProgress(doneBefore + downloaded.coerceAtMost(model.size), total, model.name)
                        }
                        if (part.length() != model.size || sha256(part) != model.sha256) {
                            part.delete()
                            error("SHA-256 or file-size verification failed for ${model.name}.")
                        }
                        if (!part.renameTo(destination)) error("Could not finalize ${model.name}.")
                        verified = true
                    } catch (error: Exception) {
                        attempt++
                        if (attempt >= 4 || error.message?.contains("cancel", true) == true) throw error
                        Thread.sleep(1000L * attempt)
                    }
                }
            }
            checkCancelled()
            File(staging, ".verified-pack").writeText(PACK_ID)
            if (backup.exists()) backup.deleteRecursively()
            if (target.exists() && !target.renameTo(backup)) error("Could not preserve the existing Wan model pack.")
            if (!staging.renameTo(target)) {
                if (backup.exists()) backup.renameTo(target)
                error("Could not install the verified Wan model pack.")
            }
            backup.deleteRecursively()
            onProgress(total, total, "Verified")
        } catch (error: Exception) {
            // Keep .part files so the next attempt can resume safely.
            throw error
        }
    }

    private fun downloadOne(model: ModelFile, part: File, progress: (Long) -> Unit) {
        var offset = if (part.isFile) part.length() else 0L
        if (offset > model.size) { part.delete(); offset = 0L }
        val connection = (URL(BASE_URL + model.name).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20_000
            readTimeout = 60_000
            requestMethod = "GET"
            if (offset > 0) setRequestProperty("Range", "bytes=$offset-")
        }
        try {
            val code = connection.responseCode
            if (offset > 0 && code == HttpURLConnection.HTTP_OK) {
                part.delete()
                offset = 0L
            } else if (code != HttpURLConnection.HTTP_PARTIAL && code != HttpURLConnection.HTTP_OK) {
                error("Wan model server returned HTTP $code.")
            }
            val append = offset > 0 && code == HttpURLConnection.HTTP_PARTIAL
            var downloaded = if (append) offset else 0L
            connection.inputStream.use { input ->
                FileOutputStream(part, append).use { output ->
                    val buffer = ByteArray(1024 * 1024)
                    while (true) {
                        checkCancelled()
                        val count = input.read(buffer)
                        if (count < 0) break
                        downloaded += count
                        if (downloaded > model.size) error("Server sent too much data for ${model.name}.")
                        output.write(buffer, 0, count)
                        progress(downloaded)
                    }
                    output.fd.sync()
                }
            }
            if (downloaded != model.size) error("Incomplete download for ${model.name}.")
        } finally {
            connection.disconnect()
        }
    }

    private fun checkCancelled() {
        if (cancelled.get() || Thread.currentThread().isInterrupted) error("Wan model download cancelled.")
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
