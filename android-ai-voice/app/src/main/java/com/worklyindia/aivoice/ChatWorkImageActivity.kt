package com.worklyindia.aivoice

import android.app.Activity
import android.content.ContentValues
import android.content.pm.PackageManager
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.Environment
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
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
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/** Uses the same authenticated ChatWork AI Chat image-generation pipeline as the website. */
class ChatWorkImageActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var prompt: EditText
    private lateinit var status: TextView
    private lateinit var preview: ImageView
    private lateinit var generateButton: Button
    private lateinit var chooseButton: Button
    private lateinit var saveButton: Button
    private var lastGeneratedBitmap: Bitmap? = null
    private var referenceImageDataUrl: String? = null
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        ChatWorkTheme.applyWindow(this)
        val dark = ChatWorkTheme.isDark(this)
        val bg = ChatWorkTheme.color(this, 0xFFF4F7FB.toInt())
        val surface = ChatWorkTheme.color(this, 0xFFFFFFFF.toInt())
        val ink = ChatWorkTheme.color(this, 0xFF142033.toInt())
        val muted = ChatWorkTheme.color(this, 0xFF65748B.toInt())
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(12))
            setBackgroundColor(bg)
        }
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        header.addView(Button(this).apply {
            text = "‹"; textSize = 28f; isAllCaps = false
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        header.addView(TextView(this).apply {
            text = "AI Image Studio"; textSize = 21f; setTextColor(ink)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(header)
        status = TextView(this).apply {
            text = "On-device image generation is not supported on this phone yet. No remote image service is used."
            textSize = 13f; setTextColor(muted); setPadding(dp(4), dp(8), dp(4), dp(10))
        }
        root.addView(status)
        preview = ImageView(this).apply {
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(ChatWorkTheme.color(this@ChatWorkImageActivity, 0xFFE5EAF1.toInt()))
            visibility = View.GONE
        }
        root.addView(ScrollView(this).apply {
            addView(preview, ViewGroup.LayoutParams(-1, -2))
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
            setTextColor(ink)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            setHintTextColor(muted)
            setBackgroundColor(surface)
        }
        root.addView(prompt, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        chooseButton = Button(this).apply {
            text = "Add photo"; isAllCaps = false; visibility = View.GONE
            setOnClickListener { choosePhoto() }
        }
        actions.addView(chooseButton, LinearLayout.LayoutParams(0, dp(50), 1f))
        generateButton = Button(this).apply {
            text = "Not available on this phone"; isAllCaps = false; isEnabled = false
            setOnClickListener { generateImage() }
        }
        actions.addView(generateButton, LinearLayout.LayoutParams(0, dp(50), 1f).apply { leftMargin = dp(8) })
        root.addView(actions)
        setContentView(root)
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
        status.text = "Image generation is disabled: this phone does not have a supported on-device image model."
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
        worker.shutdownNow()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_IMAGE = 8201
        private const val REQUEST_SAVE_PERMISSION = 8202
        private const val MAX_IMAGE_BASE64_CHARS = 10_000_000
    }
}
