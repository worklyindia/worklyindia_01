package com.worklyindia.aivoice

import android.content.Context
import java.io.File
import java.util.concurrent.atomic.AtomicReference

/**
 * Runs the pinned Saient Wan CLI worker bundled by the Android CI workflow.
 * This is a foreground-activity process runner; a dedicated foreground service
 * and remote-device relay remain follow-up integration work.
 */
object WanVideoGenerator {
    private val process = AtomicReference<Process?>(null)
    private const val NEGATIVE = "低质量，低分辨率，模糊，抖动，闪烁，变形，畸形，额外的手指，画得不好的手，画得不好的脸，变形的四肢，融合的手指，多余的腿，整体发灰，过曝"

    fun isRuntimeAvailable(context: Context): Boolean {
        val binary = File(context.applicationInfo.nativeLibraryDir, "libquartz-wan.so")
        return binary.isFile && binary.canExecute() && android.os.Build.SUPPORTED_ABIS.any { it == "arm64-v8a" }
    }

    fun cancel() {
        process.getAndSet(null)?.let { child ->
            child.destroy()
            Thread {
                try {
                    if (!child.waitFor(2, java.util.concurrent.TimeUnit.SECONDS)) child.destroyForcibly()
                } catch (_: Exception) { child.destroyForcibly() }
            }.start()
        }
    }

    fun generate(
        context: Context,
        prompt: String,
        frames: Int = 17,
        steps: Int = 8,
        onProgress: (Int, Int, String) -> Unit
    ): File {
        require(prompt.isNotBlank()) { "Enter a video prompt first." }
        require(frames in 5..41 && (frames - 1) % 4 == 0) { "Frames must be 5–41 in steps of 4." }
        require(steps in 8..20) { "Steps must be between 8 and 20." }
        check(isRuntimeAvailable(context)) { "Saient Wan ARM64 runtime is not bundled in this APK." }
        check(WanVideoModelManager.isReady(context)) { "Download and verify the Wan model pack first." }

        val root = WanVideoModelManager.modelDirectory(context)
        val outputDir = File(context.getExternalFilesDir(null) ?: context.filesDir, "ChatWork/videos")
        if (!outputDir.exists() && !outputDir.mkdirs()) error("Cannot create video output folder.")
        val output = File(outputDir, "saient-wan-${System.currentTimeMillis()}.webm")
        val binary = File(context.applicationInfo.nativeLibraryDir, "libquartz-wan.so")
        val command = listOf(
            binary.absolutePath, "--mode", "vid_gen",
            "--diffusion-model", File(root, WanVideoModelManager.files[0].name).absolutePath,
            "--vae", File(root, WanVideoModelManager.files[2].name).absolutePath,
            "--t5xxl", File(root, WanVideoModelManager.files[1].name).absolutePath,
            "--prompt", prompt, "--negative-prompt", NEGATIVE,
            "--cfg-scale", "6.0", "--sampling-method", "euler",
            "--steps", steps.toString(), "--width", "416", "--height", "240",
            "--video-frames", frames.toString(), "--fps", "8", "--flow-shift", "8.0",
            "--seed", "12345", "--threads", "6", "--diffusion-fa",
            "--backend", "te=cpu,vae=cpu,diffusion=vulkan0",
            "--params-backend", "disk", "--max-vram", "cpu=0.20,vulkan0=0.75",
            "--vae-tiling", "--output", output.absolutePath
        )
        val child = ProcessBuilder(command)
            .directory(context.filesDir)
            .redirectErrorStream(true)
            .apply { environment()["LD_LIBRARY_PATH"] = context.applicationInfo.nativeLibraryDir }
            .start()
        check(process.compareAndSet(null, child)) {
            child.destroyForcibly()
            "A Wan video generation is already running."
        }
        val recent = ArrayDeque<String>()
        try {
            child.inputStream.bufferedReader().useLines { lines ->
                lines.forEach { line ->
                    if (recent.size >= 120) recent.removeFirst()
                    recent.addLast(line)
                    val marker = Regex("SAIENT_WAN_PROGRESS completed=(\\d+) total=(\\d+)").find(line)
                    if (marker != null) {
                        val done = marker.groupValues[1].toInt()
                        val total = marker.groupValues[2].toInt()
                        onProgress(done, total, line)
                    } else if (line.contains("[ERROR", true) || line.contains("failed", true)) {
                        onProgress(0, steps, line.take(240))
                    }
                }
            }
            val exit = child.waitFor()
            if (exit != 0) {
                val detail = recent.lastOrNull { it.contains("[ERROR", true) || it.contains("GGML_ASSERT", true) || it.contains("failed", true) }
                    ?: recent.lastOrNull() ?: "Native Wan process exited with code $exit."
                error(detail)
            }
            check(output.isFile && output.length() > 1024L) { "Wan process finished but no valid video file was created." }
            onProgress(steps, steps, "Video ready")
            return output
        } finally {
            process.compareAndSet(child, null)
            if (child.isAlive) child.destroyForcibly()
        }
    }
}
