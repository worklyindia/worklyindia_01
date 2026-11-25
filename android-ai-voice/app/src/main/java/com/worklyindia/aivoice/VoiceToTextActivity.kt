package com.worklyindia.aivoice

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

/** Audio-file transcription workspace using the authenticated Workly Voice STT endpoint. */
class VoiceToTextActivity : Activity() {
    private data class Choice(val label: String, val value: String) { override fun toString() = label }
    private val worker = Executors.newSingleThreadExecutor()
    private var dark = false
    private var selectedAudio: Uri? = null
    private lateinit var modelSpinner: Spinner
    private lateinit var languageSpinner: Spinner
    private lateinit var fileName: TextView
    private lateinit var status: TextView
    private lateinit var convertButton: Button
    private lateinit var resultText: android.widget.EditText
    private lateinit var copyButton: Button
    private val models = listOf(Choice("Auto · Recommended", "auto"), Choice("AssemblyAI", "assemblyai"), Choice("GPT-4o mini Transcribe", "gpt-4o-mini"))
    private val languages = listOf(Choice("Auto Detect", "auto"), Choice("Hindi", "hi"), Choice("Gujarati", "gu"), Choice("English", "en"))
    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val ink get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val muted get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        ChatWorkTheme.applyWindow(this)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        buildUi()
    }

    private fun buildUi() {
        val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg) }
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(14), dp(10), dp(14), dp(10)) }
        header.addView(TextView(this).apply {
            text = "‹"; textSize = 36f; gravity = Gravity.CENTER; translationY = -dp(4).toFloat()
            setTextColor(ink); contentDescription = "Back"; setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(42), dp(48)))
        header.addView(TextView(this).apply {
            text = "Voice To Text"; textSize = 18f; gravity = Gravity.CENTER_VERTICAL
            setTextColor(ink); setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        page.addView(header)
        page.addView(View(this).apply { setBackgroundColor(if (dark) 0xFF29384D.toInt() else 0x2234475E) }, LinearLayout.LayoutParams(-1, dp(1)))
        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(16), dp(18), dp(28)) }
        scroll.addView(content)
        page.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        content.addView(label("MODEL"))
        modelSpinner = Spinner(this); modelSpinner.adapter = adapter(models)
        content.addView(modelSpinner, fieldParams())
        content.addView(label("LANGUAGE"))
        languageSpinner = Spinner(this); languageSpinner.adapter = adapter(languages)
        content.addView(languageSpinner, fieldParams())
        content.addView(label("AUDIO FILE"))
        content.addView(Button(this).apply { text = "Upload Audio"; isAllCaps = false; setOnClickListener { chooseAudio() } }, LinearLayout.LayoutParams(-1, dp(50)))
        fileName = TextView(this).apply { text = "No audio selected"; textSize = 13f; setTextColor(muted); setPadding(0, dp(7), 0, dp(12)) }
        content.addView(fileName)
        convertButton = Button(this).apply { text = "Convert To Text"; isAllCaps = false; setOnClickListener { convertAudio() } }
        content.addView(convertButton, LinearLayout.LayoutParams(-1, dp(52)))
        status = TextView(this).apply { text = "Select an audio file, then tap Convert To Text."; textSize = 13f; setTextColor(muted); setPadding(0, dp(12), 0, dp(14)); setTextIsSelectable(true) }
        content.addView(status)
        content.addView(label("CONVERTED TEXT"))
        resultText = android.widget.EditText(this).apply {
            minLines = 7; maxLines = 18; gravity = Gravity.TOP; textSize = 16f
            hint = "Your converted text will appear here…"; setPadding(dp(12), dp(12), dp(12), dp(12))
            setBackgroundColor(surface); setTextColor(ink); setHintTextColor(muted)
        }
        content.addView(resultText, LinearLayout.LayoutParams(-1, dp(210)))
        copyButton = Button(this).apply { text = "Copy Text"; isAllCaps = false; isEnabled = false; setOnClickListener { copyResult() } }
        content.addView(copyButton, LinearLayout.LayoutParams(-1, dp(48)))
        setContentView(page)
    }

    private fun chooseAudio() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE); type = "audio/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/aac", "audio/ogg", "audio/webm", "audio/3gpp"))
        }
        startActivityForResult(intent, REQUEST_AUDIO)
    }

    @Deprecated("Use Activity Result API in a future cleanup")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_AUDIO || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        selectedAudio = uri
        fileName.text = queryDisplayName(uri) ?: "Selected audio"
        status.text = "Audio selected. Ready to convert."
        resultText.setText(""); copyButton.isEnabled = false
    }

    private fun queryDisplayName(uri: Uri): String? = runCatching {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }.getOrNull()

    private fun convertAudio() {
        val uri = selectedAudio
        if (uri == null) { Toast.makeText(this, "Please upload an audio file first.", Toast.LENGTH_LONG).show(); return }
        val deviceToken = SecureDeviceTokenStore.read(this)
        if (deviceToken.isNullOrBlank()) { status.text = "Connect this phone to your Workly account first."; return }
        convertButton.isEnabled = false; convertButton.text = "Converting…"
        status.text = "Uploading audio and converting speech to text…"
        resultText.setText(""); copyButton.isEnabled = false
        val model = models[modelSpinner.selectedItemPosition.coerceIn(models.indices)].value
        val language = languages[languageSpinner.selectedItemPosition.coerceIn(languages.indices)].value
        worker.execute {
            try {
                val bytes = contentResolver.openInputStream(uri)?.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(16 * 1024)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > MAX_AUDIO_BYTES) throw IllegalArgumentException("Audio file is too large. Please choose a file under 1.3 MB.")
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                } ?: throw IllegalStateException("Could not open the selected audio file.")
                if (bytes.isEmpty()) throw IllegalArgumentException("The selected audio file is empty.")
                val response = VoiceRelayApi.transcribe(deviceToken, bytes, model, language)
                val transcript = response.optString("text").trim()
                if (transcript.isBlank()) throw IllegalStateException("No speech was detected in this audio.")
                runOnUiThread {
                    if (isFinishing) return@runOnUiThread
                    resultText.setText(transcript); copyButton.isEnabled = true
                    status.text = "Conversion complete · ${response.optString("detected_language", "unknown").uppercase()} · ${response.optString("provider", "automatic")}"
                    convertButton.isEnabled = true; convertButton.text = "Convert To Text"
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    if (isFinishing) return@runOnUiThread
                    status.text = error.message ?: "Audio conversion failed. Please try again."
                    convertButton.isEnabled = true; convertButton.text = "Convert To Text"
                }
            }
        }
    }

    private fun copyResult() {
        val text = resultText.text.toString().trim()
        if (text.isBlank()) return
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Voice transcription", text))
        Toast.makeText(this, "Text copied.", Toast.LENGTH_SHORT).show()
    }

    private fun label(value: String) = TextView(this).apply {
        text = value; textSize = 12f; setTextColor(muted)
        setTypeface(typeface, android.graphics.Typeface.BOLD); setPadding(0, dp(12), 0, dp(5))
    }
    private fun fieldParams() = LinearLayout.LayoutParams(-1, dp(52)).apply { bottomMargin = dp(8) }
    private fun <T> adapter(items: List<T>) = ArrayAdapter(this, android.R.layout.simple_spinner_item, items).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    override fun onDestroy() { worker.shutdownNow(); super.onDestroy() }

    companion object { private const val REQUEST_AUDIO = 2401; private const val MAX_AUDIO_BYTES = 1_300_000 }
}
