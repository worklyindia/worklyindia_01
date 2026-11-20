package com.worklyindia.aivoice

import android.content.Context
import android.os.StatFs
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * On-device Wan2.1 T2V runtime bridge.
 * Model weights are downloaded separately and verified before atomic installation.
 * The pinned Saient Wan Vulkan executable is packaged as arm64-v8a/libquartz-wan.so.
 */
object WanVideoManager {
    private const val HOST = "saient.co.uk"
    private const val PACK_ID = "wan2.1-t2v-1.3b-q4-v1"
    private const val WIDTH = 416
    private const val HEIGHT = 240
    private const val FPS = 8
    private const val FLOW_SHIFT = "8.0"
    private const val HEADROOM = 134_217_728L
    private const val DEFAULT_NEGATIVE =
        "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，" +
        "JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，" +
        "手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走"

    data class ModelFile(val name: String, val bytes: Long, val sha256: String) {
        val url: String get() = "https://" + HOST + "/models/" + PACK_ID + "/" + name
    }
    data class Snapshot(
        val available: Boolean,
        val installed: Boolean,
        val valid: Boolean,
        val active: Boolean,
        val modelBytes: Long,
        val message: String
    )
    data class DownloadProgress(val completedBytes: Long, val totalBytes: Long, val currentFile: String)
    data class VideoProgress(val completed: Int, val total: Int)
    data class VideoResult(
        val file: File,
        val elapsedSeconds: Double,
        val steps: Int,
        val seed: Long,
        val width: Int,
        val height: Int,
        val frames: Int,
        val fps: Int
    )

    private val files = listOf(
        ModelFile("wan2.1_t2v_1.3B_Q4_K.gguf", 816_061_024L, "65181afff758fba25cf311399ccb0638a746f8e0e6533e07a84a5a23e0c12318"),
        ModelFile("umt5-xxl-encoder-Q4_K_M.gguf", 3_655_145_312L, "17cf97a5bbbc60a646d6105b832b6f657ce904a8a1ad970e4b59df0c67584a40"),
        ModelFile("wan_2.1_vae.safetensors", 253_815_318L, "2fc39d31359a4b0a64f55876d8ff7fa8d780956ae2cb13463b0223e15148976b")
    )
    private val totalBytes = files.sumOf { it.bytes }

    @Volatile private var cancelDownload = false
    @Volatile private var activeConnection: HttpURLConnection? = null
    @Volatile private var activeProcess: Process? = null
    @Volatile private var cancelGeneration = false
    private val lock = Any()

    private fun engine(context: Context) =
        File(context.applicationInfo.nativeLibraryDir, "libquartz-wan.so")

    private fun root(context: Context) = File(context.filesDir, "wan/" + PACK_ID)
    private fun staging(context: Context) = File(context.filesDir, "wan/.download-" + PACK_ID)
    private fun inactiveMarker(context: Context) = File(context.filesDir, "wan/.wan-inactive")
    private fun outputDirectory(context: Context) = File(context.filesDir, "generated-videos")

    fun status(context: Context): Snapshot {
        val binary = engine(context)
        if (!binary.isFile) return Snapshot(false, false, false, false, 0, "Wan Vulkan engine is missing from this build.")
        val dir = root(context)
        if (!dir.isDirectory) return Snapshot(true, false, false, false, 0, "Download the Wan2.1 video model pack.")
        val marker = File(dir, ".verified-pack")
        if (!marker.isFile || marker.readText().trim() != PACK_ID) {
            return Snapshot(true, true, false, false, directoryBytes(dir), "Model pack has not passed integrity verification. Download it again.")
        }
        for (item in files) {
            val f = File(dir, item.name)
            if (!f.isFile || f.length() != item.bytes) {
                return Snapshot(true, true, false, false, directoryBytes(dir), "Model file is missing or has the wrong size: " + item.name)
            }
        }
        val active = !inactiveMarker(context).exists()
        return Snapshot(true, true, true, active, directoryBytes(dir), if (active) "Wan2.1 model is ready on this phone." else "Wan2.1 model is installed but inactive.")
    }

    fun download(context: Context, onProgress: (DownloadProgress) -> Unit): Snapshot {
        synchronized(lock) {
            check(activeProcess?.isAlive != true) { "Stop video generation before downloading the model." }
            check(activeConnection == null) { "A Wan model download is already running." }
            cancelDownload = false
        }
        val parent = File(context.filesDir, "wan").apply { if (!exists() && !mkdirs()) throw IOException("Cannot create model folder.") }
        val work = staging(context).apply { if (!exists() && !mkdirs()) throw IOException("Cannot create model staging folder.") }
        try {
            var completed = 0L
            var partial = 0L
            val verified = mutableSetOf<String>()
            for (item in files) {
                val target = File(work, item.name)
                val part = File(target.path + ".part")
                if (target.isFile && target.length() == item.bytes && sha256(target) == item.sha256) {
                    completed += item.bytes
                    verified += item.name
                } else {
                    target.delete()
                    if (part.length() > item.bytes) part.delete()
                    partial += part.length()
                }
            }
            val remaining = (totalBytes - completed - partial).coerceAtLeast(0)
            if (StatFs(parent.path).availableBytes < remaining + HEADROOM) {
                throw IOException("Not enough free storage. Need " + formatGb(remaining + HEADROOM) + " GB more space.")
            }
            for (item in files) {
                if (cancelDownload) throw IOException("Wan model download cancelled.")
                val target = File(work, item.name)
                if (item.name in verified) {
                    onProgress(DownloadProgress(completed, totalBytes, item.name))
                    continue
                }
                val part = File(target.path + ".part")
                downloadFile(item, part, completed, onProgress)
                if (part.length() != item.bytes) throw IOException(item.name + " downloaded with the wrong size.")
                if (sha256(part) != item.sha256) {
                    part.delete()
                    throw IOException(item.name + " failed SHA-256 verification.")
                }
                target.delete()
                if (!part.renameTo(target)) throw IOException("Could not finalize " + item.name + ".")
                completed += item.bytes
                onProgress(DownloadProgress(completed, totalBytes, item.name))
            }
            File(work, ".verified-pack").writeText(PACK_ID)
            val old = root(context)
            val backup = File(parent, ".backup-" + UUID.randomUUID())
            if (old.exists() && !old.renameTo(backup)) throw IOException("Could not stage the existing Wan model.")
            if (!work.renameTo(old)) {
                if (backup.exists()) backup.renameTo(old)
                throw IOException("Could not install the verified Wan model.")
            }
            backup.deleteRecursively()
            inactiveMarker(context).delete()
            return status(context)
        } finally {
            synchronized(lock) {
                activeConnection?.disconnect()
                activeConnection = null
                cancelDownload = false
            }
        }
    }

    private fun downloadFile(
        item: ModelFile,
        part: File,
        completed: Long,
        onProgress: (DownloadProgress) -> Unit
    ) {
        var failures = 0
        while (part.length() < item.bytes) {
            if (cancelDownload) throw IOException("Wan model download cancelled.")
            val offset = part.length()
            val connection = (URL(item.url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 20_000
                readTimeout = 45_000
                if (offset > 0) setRequestProperty("Range", "bytes=" + offset + "-")
            }
            synchronized(lock) { activeConnection = connection }
            try {
                val response = connection.responseCode
                if (offset > 0 && response == HttpURLConnection.HTTP_OK) {
                    part.delete()
                    failures = 0
                    continue
                }
                if (response != HttpURLConnection.HTTP_OK && response != HttpURLConnection.HTTP_PARTIAL) {
                    throw IOException("Model server returned HTTP " + response + ".")
                }
                if (offset == 0L && response == HttpURLConnection.HTTP_PARTIAL) {
                    throw IOException("Model server returned an unexpected partial response.")
                }
                FileOutputStream(part, offset > 0).buffered(1024 * 1024).use { output ->
                    connection.inputStream.buffered(1024 * 1024).use { input ->
                        val buffer = ByteArray(1024 * 1024)
                        var lastUpdate = 0L
                        while (true) {
                            if (cancelDownload) throw IOException("Wan model download cancelled.")
                            val count = input.read(buffer)
                            if (count < 0) break
                            output.write(buffer, 0, count)
                            if (part.length() > item.bytes) throw IOException("Download exceeded the expected file size.")
                            val now = System.nanoTime()
                            if (now - lastUpdate > 250_000_000L) {
                                onProgress(DownloadProgress(completed + part.length(), totalBytes, item.name))
                                lastUpdate = now
                            }
                        }
                    }
                }
                if (part.length() < item.bytes) throw IOException("Download ended early.")
                failures = 0
            } catch (error: IOException) {
                if (cancelDownload) throw IOException("Wan model download cancelled.", error)
                failures++
                if (failures >= 4) throw error
                Thread.sleep(500L * failures)
            } finally {
                connection.disconnect()
                synchronized(lock) { if (activeConnection === connection) activeConnection = null }
            }
        }
    }

    fun cancelDownload(): Boolean {
        cancelDownload = true
        activeConnection?.disconnect()
        return true
    }

    fun setActive(context: Context, active: Boolean): Snapshot {
        synchronized(lock) {
            check(activeProcess?.isAlive != true) { "Stop video generation before changing model state." }
            check(activeConnection == null) { "Wait for the model download to finish." }
        }
        if (active) {
            check(status(context).valid) { "Wan model is not valid. Download it again." }
            inactiveMarker(context).delete()
        } else {
            inactiveMarker(context).apply { parentFile?.mkdirs(); writeText("1") }
        }
        return status(context)
    }

    fun remove(context: Context): Snapshot {
        synchronized(lock) {
            check(activeProcess?.isAlive != true) { "Stop video generation before removing the model." }
            check(activeConnection == null) { "Wait for the model download to finish." }
        }
        root(context).deleteRecursively()
        staging(context).deleteRecursively()
        inactiveMarker(context).delete()
        return status(context)
    }

    fun generate(
        context: Context,
        promptValue: String,
        negativeValue: String,
        steps: Int,
        frames: Int,
        seed: Long,
        onProgress: (VideoProgress) -> Unit
    ): VideoResult {
        val prompt = promptValue.trim()
        val userNegative = negativeValue.trim()
        require(prompt.isNotEmpty() && prompt.length <= 1_000 && userNegative.length <= 1_000) { "Prompt must be between 1 and 1,000 characters." }
        require(steps in 8..20) { "Wan supports 8 to 20 steps for usable output." }
        require(frames in 5..41 && (frames - 1) % 4 == 0) { "Choose 5, 17 or 41 frames." }
        val snapshot = status(context)
        check(snapshot.valid && snapshot.active) { "Download and activate the Wan2.1 model first." }
        synchronized(lock) {
            check(activeConnection == null) { "Wait for the Wan model download to finish." }
            check(activeProcess?.isAlive != true) { "A video is already generating." }
            cancelGeneration = false
        }
        val modelDir = root(context)
        val outputDir = outputDirectory(context).apply { mkdirs() }
        val output = File(outputDir, "chatwork-video-" + System.currentTimeMillis() + ".webm")
        val negative = if (userNegative.isEmpty()) DEFAULT_NEGATIVE else DEFAULT_NEGATIVE + "，" + userNegative
        val args = listOf(
            engine(context).absolutePath,
            "--mode", "vid_gen",
            "--diffusion-model", File(modelDir, files[0].name).absolutePath,
            "--vae", File(modelDir, files[2].name).absolutePath,
            "--t5xxl", File(modelDir, files[1].name).absolutePath,
            "--prompt", prompt,
            "--negative-prompt", negative,
            "--cfg-scale", "6.0",
            "--sampling-method", "euler",
            "--steps", steps.toString(),
            "--width", WIDTH.toString(),
            "--height", HEIGHT.toString(),
            "--video-frames", frames.toString(),
            "--fps", FPS.toString(),
            "--flow-shift", FLOW_SHIFT,
            "--seed", seed.toString(),
            "--threads", "6",
            "--diffusion-fa",
            "--backend", "te=cpu,vae=cpu,diffusion=vulkan0",
            "--params-backend", "disk",
            "--max-vram", "cpu=0.20,vulkan0=0.75",
            "--vae-tiling",
            "--output", output.absolutePath
        )
        val started = System.nanoTime()
        val logs = ArrayDeque<String>()
        try {
            val process = ProcessBuilder(args).redirectErrorStream(true).apply {
                environment()["RAYON_NUM_THREADS"] = "6"
            }.start()
            synchronized(lock) {
                activeProcess = process
                if (cancelGeneration) process.destroy()
            }
            val pattern = Regex("SAIENT_WAN_PROGRESS completed=(\\d+) total=(\\d+)")
            process.inputStream.bufferedReader().useLines { lines ->
                lines.forEach { line ->
                    if (logs.size >= 120) logs.removeFirst()
                    logs.addLast(line.take(1_000))
                    val match = pattern.matchEntire(line.trim())
                    if (match != null && match.groupValues[2].toIntOrNull() == steps) {
                        onProgress(VideoProgress(match.groupValues[1].toInt(), steps))
                    }
                }
            }
            val exitCode = process.waitFor()
            if (cancelGeneration) throw IOException("Video generation cancelled.")
            if (exitCode != 0) {
                val errors = logs.filter { it.contains("[ERROR", true) }
                val diagnostic = errors.takeLast(6).joinToString("\n").ifBlank {
                    logs.reversed().firstOrNull { it.contains("GGML_ASSERT") || it.contains("failed", true) } ?: logs.lastOrNull().orEmpty()
                }
                throw IOException(diagnostic.ifBlank { "Wan engine exited with code " + exitCode + "." })
            }
            if (!output.isFile || output.length() < 1_000) throw IOException("Wan finished without a valid video file.")
            return VideoResult(output, (System.nanoTime() - started) / 1_000_000_000.0, steps, seed, WIDTH, HEIGHT, frames, FPS)
        } catch (error: Exception) {
            output.delete()
            if (cancelGeneration) throw IOException("Video generation cancelled.", error)
            throw error
        } finally {
            synchronized(lock) {
                activeProcess = null
                cancelGeneration = false
            }
        }
    }

    fun cancelGeneration(): Boolean {
        cancelGeneration = true
        val process = activeProcess ?: return false
        runCatching {
            process.destroy()
            if (!process.waitFor(2, TimeUnit.SECONDS)) process.destroyForcibly()
        }
        return true
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered(1024 * 1024).use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }

    private fun directoryBytes(dir: File): Long =
        dir.walkTopDown().filter { it.isFile }.fold(0L) { total, file -> total + file.length() }

    private fun formatGb(bytes: Long) = "%.2f".format(java.util.Locale.US, bytes / 1_000_000_000.0)
}