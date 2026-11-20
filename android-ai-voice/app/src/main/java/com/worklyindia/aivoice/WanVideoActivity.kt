package com.worklyindia.aivoice

import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.MediaController
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.VideoView
import android.widget.Toast
import java.io.File
import java.util.Locale
import java.util.concurrent.Executors

class WanVideoActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var dark = false
    private var busy = false
    private var selectedSteps = 8
    private var selectedFrames = 5
    private var currentResult: WanVideoManager.VideoResult? = null
    private var currentStatus: WanVideoManager.Snapshot? = null

    private lateinit var content: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var ramText: TextView
    private lateinit var downloadProgress: ProgressBar
    private lateinit var downloadProgressText: TextView
    private lateinit var downloadButton: Button
    private lateinit var cancelDownloadButton: Button
    private lateinit var promptInput: EditText
    private lateinit var negativeInput: EditText
    private lateinit var generateButton: Button
    private lateinit var generationProgress: ProgressBar
    private lateinit var generationProgressText: TextView
    private lateinit var cancelGenerationButton: Button
    private lateinit var videoView: VideoView
    private lateinit var saveButton: Button
    private lateinit var stepButtons: List<Button>
    private lateinit var frameButtons: List<Button>

    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()
    private val accent get() = 0xFF2878F0.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        buildUi()
        refreshStatus()
    }

    private fun buildUi() {
        val scroll = ScrollView(this).apply { setBackgroundColor(bg); clipToPadding = false }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(12), dp(18), dp(28))
            setBackgroundColor(bg)
        }
        scroll.addView(content)
        setContentView(scroll)

        content.addView(Button(this).apply {
            text = "‹  Back"; isAllCaps = false; setTextColor(primary); setBackgroundColor(bg)
            setOnClickListener { finish() }
        })
        content.addView(label("AI Video Studio", 28, primary, true))
        content.addView(label("Saient · Wan2.1 T2V 1.3B · On-device Vulkan", 13, secondary, false))

        val ramCard = card()
        ramText = label("Checking device memory…", 13, secondary, true)
        ramCard.addView(ramText)
        ramCard.addView(label("This is an experimental mobile model. 8 GB RAM is recommended; generation can be slow and may fail on 6 GB phones.", 12, secondary, false))
        content.addView(ramCard)

        val modelCard = card()
        modelCard.addView(label("Wan2.1 video model", 18, primary, true))
        statusText = label("Checking model…", 13, secondary, false)
        modelCard.addView(statusText)
        modelCard.addView(label("One-time download: 4.73 GB · Keep at least 4.9 GB free storage. After setup, generation works offline.", 12, secondary, false))
        downloadProgress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE }
        modelCard.addView(downloadProgress)
        downloadProgressText = label("", 11, secondary, false)
        modelCard.addView(downloadProgressText)
        downloadButton = button("Download Wan model")
        downloadButton.setOnClickListener { startDownload() }
        modelCard.addView(downloadButton)
        cancelDownloadButton = secondaryButton("Cancel download").apply { visibility = View.GONE; setOnClickListener { WanVideoManager.cancelDownload() } }
        modelCard.addView(cancelDownloadButton)
        val modelActions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val activateButton = secondaryButton("Activate")
        activateButton.setOnClickListener { changeModelActive(true) }
        val removeButton = secondaryButton("Remove model")
        removeButton.setOnClickListener {
            AlertDialog.Builder(this).setTitle("Remove Wan model?")
                .setMessage("This deletes the downloaded 4.73 GB model. Generated videos are kept.")
                .setNegativeButton("Keep", null)
                .setPositiveButton("Remove") { _, _ -> removeModel() }.show()
        }
        modelActions.addView(activateButton, LinearLayout.LayoutParams(0, dp(46), 1f))
        modelActions.addView(removeButton, LinearLayout.LayoutParams(0, dp(46), 1f).apply { leftMargin = dp(8) })
        modelCard.addView(modelActions)
        content.addView(modelCard)

        content.addView(label("Motion prompt", 14, primary, true).apply { setPadding(0, dp(10), 0, dp(6)) })
        promptInput = EditText(this).apply {
            hint = "A red fox turns toward the camera as snow falls…"
            minLines = 3; maxLines = 6; textSize = 15f
            setTextColor(primary); setHintTextColor(secondary)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = rounded(surface, if (dark) 0xFF344257.toInt() else 0xFFD8E0EA.toInt())
            gravity = Gravity.TOP
        }
        content.addView(promptInput, LinearLayout.LayoutParams(-1, -2))
        content.addView(label("Avoid (optional)", 13, secondary, true).apply { setPadding(0, dp(12), 0, dp(5)) })
        negativeInput = EditText(this).apply {
            hint = "blurry, distorted, static, text"
            singleLine = true; textSize = 14f
            setTextColor(primary); setHintTextColor(secondary)
            setPadding(dp(12), dp(8), dp(12), dp(8))
            background = rounded(surface, if (dark) 0xFF344257.toInt() else 0xFFD8E0EA.toInt())
        }
        content.addView(negativeInput, LinearLayout.LayoutParams(-1, dp(48)))

        content.addView(label("Quality", 14, primary, true).apply { setPadding(0, dp(14), 0, dp(6)) })
        val stepsRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        stepButtons = listOf(8, 12, 20).map { value ->
            val b = secondaryButton(when (value) { 8 -> "Standard · 8"; 12 -> "High · 12"; else -> "Max · 20" })
            b.setOnClickListener { selectedSteps = value; updatePresets() }
            stepsRow.addView(b, LinearLayout.LayoutParams(0, dp(46), 1f).apply { if (value != 8) marginStart = dp(6) })
            b
        }
        content.addView(stepsRow)

        content.addView(label("Video length · 8 fps", 14, primary, true).apply { setPadding(0, dp(14), 0, dp(6)) })
        val framesRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        frameButtons = listOf(5, 17, 41).map { value ->
            val b = secondaryButton(when (value) { 5 -> "0.6 sec"; 17 -> "2 sec"; else -> "5 sec" })
            b.setOnClickListener { selectedFrames = value; updatePresets() }
            framesRow.addView(b, LinearLayout.LayoutParams(0, dp(46), 1f).apply { if (value != 5) marginStart = dp(6) })
            b
        }
        content.addView(framesRow)
        content.addView(label("Start with Standard and 5 frames. Longer clips and higher steps use much more memory, battery and time.", 11, secondary, false))

        generationProgress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE }
        content.addView(generationProgress)
        generationProgressText = label("", 12, secondary, false)
        content.addView(generationProgressText)
        generateButton = button("Generate on this phone")
        generateButton.setOnClickListener { confirmAndGenerate() }
        content.addView(generateButton)
        cancelGenerationButton = secondaryButton("Stop generation").apply {
            visibility = View.GONE
            setOnClickListener { WanVideoManager.cancelGeneration(); text = "Stopping…" ; isEnabled = false }
        }
        content.addView(cancelGenerationButton)

        videoView = VideoView(this).apply { visibility = View.GONE }
        content.addView(videoView, LinearLayout.LayoutParams(-1, dp(220)))
        saveButton = secondaryButton("Save video to Gallery").apply {
            visibility = View.GONE
            setOnClickListener { saveVideoToGallery() }
        }
        content.addView(saveButton)
        content.addView(label("Engine: Saient Quartz Wan · 416×240 · 8 fps · Vulkan GPU + CPU. Model weights are stored separately from the APK.", 11, secondary, false).apply { setPadding(0, dp(18), 0, 0) })
        updatePresets()
    }

    private fun refreshStatus() {
        val memory = ActivityManager.MemoryInfo()
        (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
        val totalGb = memory.totalMem / 1_000_000_000.0
        ramText.text = String.format(Locale.US, "Device RAM: %.1f GB total · %.1f GB currently available", totalGb, memory.availMem / 1_000_000_000.0)
        if (totalGb < 8.0) ramText.setTextColor(0xFFD97706.toInt())
        worker.execute {
            val snapshot = runCatching { WanVideoManager.status(this) }.getOrElse {
                WanVideoManager.Snapshot(false, false, false, false, 0, it.message ?: "Could not check Wan model.")
            }
            main.post {
                currentStatus = snapshot
                statusText.text = snapshot.message
                statusText.setTextColor(if (snapshot.valid && snapshot.active) 0xFF22A06B.toInt() else 0xFFD97706.toInt())
                downloadButton.visibility = if (snapshot.valid) View.GONE else View.VISIBLE
                downloadButton.isEnabled = snapshot.available && !busy
                downloadButton.text = if (snapshot.installed) "Verify / Download again" else "Download Wan model · 4.73 GB"
                generateButton.isEnabled = snapshot.valid && snapshot.active && !busy
                if (!snapshot.available) downloadButton.isEnabled = false
            }
        }
    }

    private fun startDownload() {
        if (busy) return
        busy = true
        downloadButton.isEnabled = false
        cancelDownloadButton.visibility = View.VISIBLE
        downloadProgress.visibility = View.VISIBLE
        downloadProgress.progress = 0
        downloadProgressText.text = "Starting secure download…"
        worker.execute {
            try {
                val snapshot = WanVideoManager.download(this) { progress ->
                    val percent = if (progress.totalBytes > 0) (progress.completedBytes * 100 / progress.totalBytes).toInt().coerceIn(0, 100) else 0
                    main.post {
                        downloadProgress.progress = percent
                        downloadProgressText.text = String.format(Locale.US, "%d%% · %.2f / %.2f GB · %s", percent, progress.completedBytes / 1e9, progress.totalBytes / 1e9, progress.currentFile)
                    }
                }
                main.post {
                    busy = false
                    cancelDownloadButton.visibility = View.GONE
                    downloadProgress.visibility = View.GONE
                    currentStatus = snapshot
                    refreshStatus()
                    Toast.makeText(this, if (snapshot.valid) "Wan2.1 model downloaded and verified." else snapshot.message, Toast.LENGTH_LONG).show()
                }
            } catch (error: Exception) {
                main.post {
                    busy = false
                    cancelDownloadButton.visibility = View.GONE
                    downloadProgress.visibility = View.GONE
                    downloadProgressText.text = error.message ?: "Wan model download failed."
                    downloadButton.isEnabled = true
                    refreshStatus()
                }
            }
        }
    }

    private fun changeModelActive(active: Boolean) {
        if (busy) return
        busy = true
        worker.execute {
            val result = runCatching { WanVideoManager.setActive(this, active) }
            main.post {
                busy = false
                result.onFailure { Toast.makeText(this, it.message ?: "Could not update model state.", Toast.LENGTH_LONG).show() }
                refreshStatus()
            }
        }
    }

    private fun removeModel() {
        if (busy) return
        busy = true
        worker.execute {
            val result = runCatching { WanVideoManager.remove(this) }
            main.post {
                busy = false
                result.onFailure { Toast.makeText(this, it.message ?: "Could not remove model.", Toast.LENGTH_LONG).show() }
                refreshStatus()
            }
        }
    }

    private fun confirmAndGenerate() {
        val prompt = promptInput.text?.toString()?.trim().orEmpty()
        if (prompt.isBlank()) { promptInput.error = "Describe the video you want"; return }
        val memory = ActivityManager.MemoryInfo()
        (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
        if (memory.availMem < 3_500_000_000L) {
            Toast.makeText(this, "Close other apps and free at least 3.5 GB RAM before generating.", Toast.LENGTH_LONG).show()
            return
        }
        if (memory.totalMem < 8_000_000_000L) {
            AlertDialog.Builder(this)
                .setTitle("Low-memory device")
                .setMessage("Wan2.1 is recommended for phones with 8 GB RAM or more. Your phone has " +
                    String.format(Locale.US, "%.1f GB", memory.totalMem / 1_000_000_000.0) +
                    ". Generation may be very slow or Android may close ChatWork. Try only a short 5-frame video. Continue?")
                .setNegativeButton("Not now", null)
                .setPositiveButton("Continue") { _, _ -> startGeneration() }
                .show()
        } else startGeneration()
    }

    private fun startGeneration() {
        if (busy) return
        val prompt = promptInput.text?.toString()?.trim().orEmpty()
        val negative = negativeInput.text?.toString()?.trim().orEmpty()
        val seed = (System.currentTimeMillis() and 0x7FFFFFFF).coerceAtLeast(1L)
        busy = true
        currentResult = null
        videoView.stopPlayback()
        videoView.visibility = View.GONE
        saveButton.visibility = View.GONE
        generateButton.isEnabled = false
        generationProgress.visibility = View.VISIBLE
        generationProgress.progress = 0
        generationProgressText.text = "Loading Wan model…"
        cancelGenerationButton.visibility = View.VISIBLE
        cancelGenerationButton.isEnabled = true
        cancelGenerationButton.text = "Stop generation"
        worker.execute {
            try {
                val result = WanVideoManager.generate(this, prompt, negative, selectedSteps, selectedFrames, seed) { progress ->
                    val percent = if (progress.total > 0) (progress.completed * 100 / progress.total).coerceIn(0, 100) else 0
                    main.post {
                        generationProgress.progress = percent
                        generationProgressText.text = "Generating video · " + progress.completed + " / " + progress.total + " steps · " + percent + "%"
                    }
                }
                main.post {
                    busy = false
                    currentResult = result
                    generationProgress.visibility = View.GONE
                    cancelGenerationButton.visibility = View.GONE
                    generateButton.isEnabled = true
                    generationProgressText.text = String.format(Locale.US, "Completed in %.1f seconds · %d frames · seed %d", result.elapsedSeconds, result.frames, result.seed)
                    videoView.visibility = View.VISIBLE
                    val controller = MediaController(this)
                    controller.setAnchorView(videoView)
                    videoView.setMediaController(controller)
                    videoView.setVideoURI(Uri.fromFile(result.file))
                    videoView.setOnPreparedListener { it.isLooping = true; videoView.start() }
                    saveButton.visibility = View.VISIBLE
                }
            } catch (error: Exception) {
                main.post {
                    busy = false
                    generationProgress.visibility = View.GONE
                    cancelGenerationButton.visibility = View.GONE
                    generateButton.isEnabled = currentStatus?.valid == true && currentStatus?.active == true
                    generationProgressText.text = error.message ?: "Video generation failed."
                }
            }
        }
    }

    private fun saveVideoToGallery() {
        val result = currentResult ?: return
        if (Build.VERSION.SDK_INT < 29) {
            Toast.makeText(this, "Gallery export requires Android 10 or later.", Toast.LENGTH_LONG).show()
            return
        }
        worker.execute {
            var uri: Uri? = null
            try {
                val values = ContentValues().apply {
                    put(MediaStore.Video.Media.DISPLAY_NAME, result.file.name)
                    put(MediaStore.Video.Media.MIME_TYPE, "video/webm")
                    put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/ChatWork")
                    put(MediaStore.Video.Media.IS_PENDING, 1)
                }
                uri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("Gallery could not create a video file.")
                contentResolver.openOutputStream(uri!!)?.use { output ->
                    result.file.inputStream().buffered().use { input -> input.copyTo(output) }
                } ?: throw IllegalStateException("Gallery output stream is unavailable.")
                val done = ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }
                contentResolver.update(uri!!, done, null, null)
                main.post { Toast.makeText(this, "Video saved to Movies/ChatWork.", Toast.LENGTH_LONG).show() }
            } catch (error: Exception) {
                uri?.let { contentResolver.delete(it, null, null) }
                main.post { Toast.makeText(this, error.message ?: "Could not save video.", Toast.LENGTH_LONG).show() }
            }
        }
    }

    private fun updatePresets() {
        if (!::stepButtons.isInitialized) return
        listOf(8, 12, 20).forEachIndexed { index, value ->
            stepButtons[index].setTextColor(if (selectedSteps == value) accent else primary)
            stepButtons[index].alpha = if (selectedSteps == value) 1f else 0.75f
        }
        listOf(5, 17, 41).forEachIndexed { index, value ->
            frameButtons[index].setTextColor(if (selectedFrames == value) accent else primary)
            frameButtons[index].alpha = if (selectedFrames == value) 1f else 0.75f
        }
    }

    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(13), dp(14), dp(13))
        background = rounded(surface, if (dark) 0xFF344257.toInt() else 0xFFD8E0EA.toInt())
        elevation = dp(1).toFloat()
        content.addView(this, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
    }

    private fun label(value: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = value; textSize = size.toFloat(); setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(4), 0, dp(4))
    }

    private fun button(value: String) = Button(this).apply {
        text = value; isAllCaps = false; minHeight = dp(48); setTextColor(0xFFFFFFFF.toInt())
        setBackgroundColor(accent)
    }

    private fun secondaryButton(value: String) = Button(this).apply {
        text = value; isAllCaps = false; minHeight = dp(44); setTextColor(primary)
    }

    private fun rounded(color: Int, stroke: Int) = android.graphics.drawable.GradientDrawable().apply {
        setColor(color); setStroke(dp(1), stroke); cornerRadius = dp(12).toFloat()
    }

    override fun onResume() { super.onResume(); if (::statusText.isInitialized) refreshStatus() }

    override fun onDestroy() {
        if (busy) {
            WanVideoManager.cancelDownload()
            WanVideoManager.cancelGeneration()
        }
        runCatching { videoView.stopPlayback() }
        worker.shutdownNow()
        main.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}