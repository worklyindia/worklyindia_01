package com.worklyindia.aivoice

import android.app.Activity
import android.content.ContentValues
import android.content.pm.PackageManager
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Uses the same authenticated Workly AI Chat image-generation pipeline as the website. */
class ChatWorkImageActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var prompt: EditText
    private lateinit var status: TextView
    private lateinit var preview: ImageView
    private lateinit var generateButton: Button
    private lateinit var chooseButton: Button
    private lateinit var saveButton: Button
    private lateinit var modelButton: Button
    private lateinit var modelProgress: ProgressBar
    private val modelHandler = Handler(Looper.getMainLooper())
    private var modelPoll: Runnable? = null
    private var lastGeneratedBitmap: Bitmap? = null
    private var referenceImageDataUrl: String? = null
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(12))
            setBackgroundColor(0xFFF4F7FB.toInt())
        }
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        header.addView(Button(this).apply {
            text = "‹"; textSize = 28f; isAllCaps = false
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        header.addView(TextView(this).apply {
            text = "AI Image Studio"; textSize = 21f; setTextColor(0xFF142033.toInt())
        }, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(header)
        status = TextView(this).apply {
            text = "Create a new image or choose a photo to edit."
            textSize = 13f; setTextColor(0xFF65748B.toInt()); setPadding(dp(4), dp(8), dp(4), dp(10))
        }
        root.addView(status)
        modelButton = Button(this).apply {
            isAllCaps = false
            setOnClickListener { startModelDownload() }
        }
        root.addView(modelButton, LinearLayout.LayoutParams(-1, dp(48)))
        modelProgress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            visibility = View.GONE
        }
        root.addView(modelProgress, LinearLayout.LayoutParams(-1, dp(6)))
        preview = ImageView(this).apply {
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(0xFFE5EAF1.toInt())
            visibility = View.GONE
        }
        root.addView(ScrollView(this).apply {
            addView(preview, android.widget.FrameLayout.LayoutParams(-1, -2))
        }, LinearLayout.LayoutParams(-1, 0, 1f))
        saveButton = Button(this).apply {
            text = "Save image to Gallery"
            isAllCaps = false
            visibility = View.GONE
            setOnClickListener { saveImageToGallery() }
        }
        root.addView(saveButton, LinearLayout.LayoutParams(-1, dp(48)))
        prompt = EditText(this).apply {
            hint = "Describe the image or how to edit your photo…"
            minLines = 2; maxLines = 5; textSize = 16f
            setTextColor(0xFF142033.toInt())
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        root.addView(prompt, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        chooseButton = Button(this).apply {
            text = "Photo edit coming soon"; isAllCaps = false
            isEnabled = false
        }
        actions.addView(chooseButton, LinearLayout.LayoutParams(0, dp(50), 1f))
        generateButton = Button(this).apply {
            text = "Create image"; isAllCaps = false
            setOnClickListener { generateImage() }
        }
        actions.addView(generateButton, LinearLayout.LayoutParams(0, dp(50), 1f).apply { leftMargin = dp(8) })
        root.addView(actions)
        setContentView(root)
        updateModelDownloadUi()
    }

    private fun choosePhoto() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
        }
        startActivityForResult(intent, REQUEST_IMAGE)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_IMAGE || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        status.text = "Preparing your photo…"
        worker.execute {
            try {
                val bytes = contentResolver.openInputStream(uri)?.use { input ->
                    val output = ByteArrayOutputStream()
                    val buffer = ByteArray(16 * 1024)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        require(total <= 25 * 1024 * 1024) { "Photo is too large. Choose an image under 25 MB." }
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                } ?: throw IllegalStateException("Could not read the selected photo.")
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Selected file is not a valid image." }
                val sample = maxOf(1, maxOf(bounds.outWidth, bounds.outHeight) / 1800)
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
                    ?: throw IllegalStateException("Could not decode the selected photo.")
                val scaled = if (maxOf(bitmap.width, bitmap.height) > 1600) {
                    val ratio = 1600f / maxOf(bitmap.width, bitmap.height)
                    Bitmap.createScaledBitmap(bitmap, (bitmap.width * ratio).toInt().coerceAtLeast(1), (bitmap.height * ratio).toInt().coerceAtLeast(1), true)
                } else bitmap
                val output = ByteArrayOutputStream()
                scaled.compress(Bitmap.CompressFormat.JPEG, 82, output)
                val encoded = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
                require(encoded.length <= MAX_IMAGE_BASE64_CHARS) { "Photo is too large. Choose a smaller image." }
                val dataUrl = "data:image/jpeg;base64,$encoded"
                runOnUiThread {
                    referenceImageDataUrl = dataUrl
                    preview.setImageBitmap(scaled)
                    preview.visibility = View.VISIBLE
                    status.text = "Photo attached. Describe the changes you want, then tap Create image."
                    chooseButton.text = "Change photo"
                }
            } catch (error: Exception) {
                runOnUiThread { status.text = error.message ?: "Could not prepare this photo." }
            }
        }
    }

    private fun generateImage() {
        val text = prompt.text?.toString()?.trim().orEmpty()
        if (text.isBlank()) {
            prompt.error = "Describe the image you want"
            return
        }
        if (busy) return
        if (!ImageModelManager.isModelReady(this)) {
            status.text = "Download the 1.57 GB local image model over Wi-Fi first."
            startModelDownload()
            return
        }
        busy = true
        generateButton.isEnabled = false
        chooseButton.isEnabled = false
        status.text = "Generating image locally on this phone. No paid image API is used…"
        worker.execute {
            try {
                val bitmap = LocalImageGenerator.generateBitmap(this@ChatWorkImageActivity, text, 512, 512, 8)
                runOnUiThread {
                    lastGeneratedBitmap = bitmap
                    preview.setImageBitmap(bitmap)
                    preview.visibility = View.VISIBLE
                    saveButton.visibility = View.VISIBLE
                    status.text = "Image generated on this phone. Tap Save image to Gallery."
                    prompt.setText("")
                }
            } catch (error: Exception) {
                runOnUiThread { status.text = error.message ?: "Local image generation failed. Please try again." }
            } finally {
                runOnUiThread {
                    busy = false
                    generateButton.isEnabled = true
                    chooseButton.isEnabled = false
                }
            }
        }
    }

    private fun startModelDownload() {
        if (ImageModelManager.isModelReady(this)) {
            modelButton.text = "Local image model ready ✓"
            modelButton.isEnabled = false
            modelProgress.progress = 100
            modelProgress.visibility = View.VISIBLE
            status.text = "Local image model is ready. Image generation runs on this phone."
            return
        }
        try {
            val id = ImageModelManager.startDownload(this)
            if (id <= 0L) {
                updateModelDownloadUi()
                return
            }
            modelButton.text = "Downloading local model…"
            modelButton.isEnabled = false
            modelProgress.visibility = View.VISIBLE
            status.text = "Downloading 1.57 GB model over Wi-Fi. You can keep ChatWork open."
            watchModelDownload()
        } catch (error: Exception) {
            status.text = error.message ?: "Could not start model download."
        }
    }

    private fun watchModelDownload() {
        modelPoll?.let { modelHandler.removeCallbacks(it) }
        val poll = object : Runnable {
            override fun run() {
                val id = ImageModelManager.savedDownloadId(this@ChatWorkImageActivity) ?: return
                val state = ImageModelManager.query(this@ChatWorkImageActivity, id)
                if (state == null) {
                    status.text = "Model download status is unavailable. Check the Android Downloads notification."
                    modelButton.isEnabled = true
                    modelButton.text = "Resume local model download"
                    return
                }
                modelProgress.visibility = View.VISIBLE
                modelProgress.progress = state.progressPercent
                when (state.status) {
                    android.app.DownloadManager.STATUS_SUCCESSFUL -> {
                        if (ImageModelManager.isModelReady(this@ChatWorkImageActivity)) {
                            modelButton.text = "Local image model ready ✓"
                            modelButton.isEnabled = false
                            modelProgress.progress = 100
                            status.text = "Model downloaded and verified by file size. Local image generation is ready."
                        } else {
                            modelButton.text = "Retry model download"
                            modelButton.isEnabled = true
                            status.text = "Downloaded model size did not match the expected file. Please retry."
                        }
                    }
                    android.app.DownloadManager.STATUS_FAILED -> {
                        modelButton.text = "Retry local model download"
                        modelButton.isEnabled = true
                        status.text = "Model download failed (reason ${state.reason}). Check Wi-Fi and free storage."
                    }
                    else -> {
                        modelButton.text = "Downloading local model… ${state.progressPercent}%"
                        modelButton.isEnabled = false
                        status.text = "Downloading local image model: ${state.progressPercent}%"
                        modelHandler.postDelayed(this, 1000)
                    }
                }
            }
        }
        modelPoll = poll
        modelHandler.post(poll)
    }

    private fun updateModelDownloadUi() {
        if (ImageModelManager.isModelReady(this)) {
            modelButton.text = "Local image model ready ✓"
            modelButton.isEnabled = false
            modelProgress.progress = 100
            modelProgress.visibility = View.VISIBLE
        } else {
            modelButton.text = "Download local AI model (1.57 GB · Wi-Fi)"
            modelButton.isEnabled = true
            modelProgress.visibility = View.GONE
            ImageModelManager.savedDownloadId(this)?.let { id ->
                val state = ImageModelManager.query(this, id)
                if (state?.status == android.app.DownloadManager.STATUS_RUNNING ||
                    state?.status == android.app.DownloadManager.STATUS_PENDING ||
                    state?.status == android.app.DownloadManager.STATUS_PAUSED) {
                    watchModelDownload()
                }
            }
        }
    }

    private fun saveImageToGallery() {
        val bitmap = lastGeneratedBitmap ?: run {
            status.text = "Generate an image first."
            return
        }
        if (android.os.Build.VERSION.SDK_INT < 29
            && checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.WRITE_EXTERNAL_STORAGE), REQUEST_SAVE_PERMISSION)
            return
        }
        try {
            val name = "ChatWork-${System.currentTimeMillis()}.png"
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ChatWork")
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
            }
            val uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Could not create a Gallery image file.")
            contentResolver.openOutputStream(uri)?.use { output ->
                if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                    throw IllegalStateException("Could not save the generated image.")
                }
            } ?: throw IllegalStateException("Could not open the Gallery image file.")
            if (android.os.Build.VERSION.SDK_INT >= 29) {
                contentResolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
            }
            Toast.makeText(this, "Image saved in Pictures/ChatWork", Toast.LENGTH_LONG).show()
        } catch (error: Exception) {
            status.text = error.message ?: "Could not save image."
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_SAVE_PERMISSION) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) saveImageToGallery()
            else status.text = "Storage permission was not granted."
        }
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        modelPoll?.let { modelHandler.removeCallbacks(it) }
        worker.shutdownNow()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_IMAGE = 8201
        private const val REQUEST_SAVE_PERMISSION = 8202
        private const val MAX_IMAGE_BASE64_CHARS = 10_000_000
    }
}
