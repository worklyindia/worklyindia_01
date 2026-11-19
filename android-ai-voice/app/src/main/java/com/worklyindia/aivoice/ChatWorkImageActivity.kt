package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
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
        preview = ImageView(this).apply {
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(0xFFE5EAF1.toInt())
            visibility = View.GONE
        }
        root.addView(ScrollView(this).apply {
            addView(preview, ScrollView.LayoutParams(-1, -2))
        }, LinearLayout.LayoutParams(-1, 0, 1f))
        prompt = EditText(this).apply {
            hint = "Describe the image or how to edit your photo…"
            minLines = 2; maxLines = 5; textSize = 16f
            setTextColor(0xFF142033.toInt())
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        root.addView(prompt, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        chooseButton = Button(this).apply {
            text = "Add photo"; isAllCaps = false
            setOnClickListener { choosePhoto() }
        }
        actions.addView(chooseButton, LinearLayout.LayoutParams(0, dp(50), 1f))
        generateButton = Button(this).apply {
            text = "Create image"; isAllCaps = false
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
                val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: throw IllegalStateException("Could not read the selected photo.")
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
        busy = true
        generateButton.isEnabled = false
        chooseButton.isEnabled = false
        status.text = if (referenceImageDataUrl == null) "Creating image with Workly AI…" else "Editing your photo with Workly AI…"
        worker.execute {
            try {
                val token = getValidAccessToken()
                val content = JSONArray().put(JSONObject().put("type", "text").put("text", text))
                referenceImageDataUrl?.let { dataUrl ->
                    content.put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", dataUrl)))
                }
                val userMessage = JSONObject().put("role", "user").put("content", content)
                val body = JSONObject()
                    .put("messages", JSONArray().put(userMessage))
                    .put("hasImages", referenceImageDataUrl != null)
                    .put("current_domain", "worklyindia.devs.surf")
                    .put("currentPage", "ChatWork Android AI Image Studio")
                val imageUrl = callWorklyAiImage(token, body)
                val bitmap = downloadGeneratedImage(imageUrl)
                runOnUiThread {
                    preview.setImageBitmap(bitmap)
                    preview.visibility = View.VISIBLE
                    status.text = "Image ready. You can save or share it from the image."
                    prompt.setText("")
                    referenceImageDataUrl = null
                    chooseButton.text = "Add photo"
                }
            } catch (error: Exception) {
                runOnUiThread { status.text = error.message ?: "Image generation failed. Please try again." }
            } finally {
                runOnUiThread {
                    busy = false
                    generateButton.isEnabled = true
                    chooseButton.isEnabled = true
                }
            }
        }
    }

    private fun getValidAccessToken(): String {
        var access = SecureDeviceTokenStore.readAccessToken(this)
            ?: throw IllegalStateException("Connect your Workly India account in ChatWork Settings first.")
        val refresh = SecureDeviceTokenStore.readRefreshToken(this)
            ?: throw IllegalStateException("Your secure sign-in session is missing. Reconnect your Workly India account.")
        val expiresAt = runCatching {
            val part = access.split(".")[1]
            val payload = String(Base64.decode(part, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING), Charsets.UTF_8)
            JSONObject(payload).optLong("exp", 0L)
        }.getOrDefault(0L)
        if (expiresAt > System.currentTimeMillis() / 1000L + 90L) return access
        val connection = (URL("${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"; connectTimeout = 15000; readTimeout = 20000; doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
        }
        try {
            connection.outputStream.use {
                it.write(JSONObject().put("refresh_token", refresh).toString().toByteArray(Charsets.UTF_8))
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val result = JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty().ifBlank { "{}" })
            if (code !in 200..299) throw IllegalStateException("Workly sign-in expired. Reconnect your account in ChatWork Settings.")
            access = result.optString("access_token")
            val nextRefresh = result.optString("refresh_token", refresh)
            if (access.isBlank()) throw IllegalStateException("Could not refresh your Workly sign-in.")
            SecureDeviceTokenStore.saveAuthSession(this, access, nextRefresh)
            return access
        } finally { connection.disconnect() }
    }

    private fun callWorklyAiImage(accessToken: String, body: JSONObject): String {
        val connection = (URL("${BuildConfig.SUPABASE_URL}/functions/v1/ai-career-chat").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"; connectTimeout = 30000; readTimeout = 180000; doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "text/event-stream, application/json")
            setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val reader = stream?.bufferedReader() ?: throw IllegalStateException("Workly AI returned an empty response.")
            if (code !in 200..299) {
                val error = reader.use { it.readText() }
                throw IllegalStateException(runCatching { JSONObject(error).optString("error", error) }.getOrDefault(error).take(300))
            }
            var imageUrl: String? = null
            var streamError: String? = null
            reader.useLines { lines ->
                lines.forEach { line ->
                    if (!line.startsWith("data: ")) return@forEach
                    val payload = line.removePrefix("data: ").trim()
                    if (payload.isBlank() || payload == "[DONE]") return@forEach
                    runCatching {
                        val event = JSONObject(payload)
                        when (event.optString("type")) {
                            "image" -> imageUrl = event.optString("url").takeIf { it.startsWith("https://") }
                            "error" -> streamError = event.optString("message").ifBlank { "Workly AI could not create the image." }
                            "status" -> runOnUiThread { status.text = event.optString("text").ifBlank { "Creating image…" } }
                        }
                    }
                }
            }
            if (!imageUrl.isNullOrBlank()) return imageUrl!!
            if (!streamError.isNullOrBlank()) throw IllegalStateException(streamError)
            throw IllegalStateException("Workly AI finished without returning an image. Please try again.")
        } finally { connection.disconnect() }
    }

    private fun downloadGeneratedImage(imageUrl: String): Bitmap {
        require(imageUrl.startsWith("https://")) { "AI returned an unsafe image link." }
        val connection = (URL(imageUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20000; readTimeout = 30000; requestMethod = "GET"
        }
        try {
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("Generated image could not be downloaded.")
            val bytes = connection.inputStream.use { it.readBytes() }
            require(bytes.isNotEmpty() && bytes.size <= 15 * 1024 * 1024) { "Generated image is empty or too large." }
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                ?: throw IllegalStateException("Generated image format is not supported.")
        } finally { connection.disconnect() }
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        worker.shutdownNow()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_IMAGE = 8201
        private const val MAX_IMAGE_BASE64_CHARS = 10_000_000
    }
}
