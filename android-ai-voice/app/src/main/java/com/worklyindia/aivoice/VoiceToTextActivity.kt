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

/** On-device audio-file transcription using the same downloaded IndicConformer packs as Download Models. */
class VoiceToTextActivity : Activity() {
    private data class Choice(val label: String, val value: String) { override fun toString() = label }
    private val worker = Executors.newSingleThreadExecutor()
    private val speechManager by lazy { SpeechPackDownloadManager(this) }
    private var dark = false
    private var selectedAudio: Uri? = null
    private lateinit var modelSpinner: Spinner
    private lateinit var languageSpinner: Spinner
    private lateinit var fileName: TextView
    private lateinit var status: TextView
    private lateinit var convertButton: Button
    private lateinit var resultText: android.widget.EditText
    private lateinit var copyButton: Button
    private val models = listOf(Choice("AI4Bharat IndicConformer INT8 · Offline", "indicconformer"))
    private val supportedLanguages = listOf(
        "as" to "Assamese", "bn" to "Bengali", "brx" to "Bodo", "doi" to "Dogri",
        "gu" to "Gujarati", "hi" to "Hindi", "kn" to "Kannada", "kok" to "Konkani",
        "ks" to "Kashmiri", "mai" to "Maithili", "ml" to "Malayalam", "mni" to "Manipuri",
        "mr" to "Marathi", "ne" to "Nepali", "or" to "Odia", "pa" to "Punjabi",
        "sa" to "Sanskrit", "sat" to "Santali", "sd" to "Sindhi", "ta" to "Tamil",
        "te" to "Telugu", "ur" to "Urdu", "en" to "English"
    ).map { Choice(it.second, it.first) }
    private var languages: List<Choice> = supportedLanguages
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
        languages = downloadedLanguages()
        buildUi()
        refreshModelStatus()
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
        content.addView(label("OFFLINE MODEL"))
        modelSpinner = Spinner(this); modelSpinner.adapter = adapter(models)
        content.addView(modelSpinner, fieldParams())
        content.addView(label("LANGUAGE"))
        languageSpinner = Spinner(this); languageSpinner.adapter = adapter(languages)
        languageSpinner.setSelection(languages.indexOfFirst { it.value == "hi" }.coerceAtLeast(0))
        languageSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) { refreshModelStatus() }
        }
        content.addView(languageSpinner, fieldParams())
        content.addView(label("AUDIO FILE"))
        content.addView(Button(this).apply { text = "Choose Audio File"; isAllCaps = false; setOnClickListener { chooseAudio() } }, LinearLayout.LayoutParams(-1, dp(50)))
        fileName = TextView(this).apply { text = "No audio selected"; textSize = 13f; setTextColor(muted); setPadding(0, dp(7), 0, dp(12)) }
        content.addView(fileName)
        convertButton = Button(this).apply { text = "Convert Offline"; isAllCaps = false; setOnClickListener { convertAudio() } }
        content.addView(convertButton, LinearLayout.LayoutParams(-1, dp(52)))
        status = TextView(this).apply { text = "Select a downloaded speech model and an audio file."; textSize = 13f; setTextColor(muted); setPadding(0, dp(12), 0, dp(14)); setTextIsSelectable(true) }
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
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "audio/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(intent, REQUEST_AUDIO)
    }

    @Deprecated("Use Activity Result API in a future cleanup")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_AUDIO || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        selectedAudio = uri
        runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        fileName.text = queryDisplayName(uri) ?: "Selected audio"
        status.text = "Audio selected. It will be processed on this phone; no audio upload or internet is used."
        resultText.setText(""); copyButton.isEnabled = false
    }

    private fun queryDisplayName(uri: Uri): String? = runCatching {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }.getOrNull()

    private fun downloadedLanguages(): List<Choice> = supportedLanguages.filter { choice ->
        runCatching {
            val pack = SpeechModelCatalog.indicConformer(choice.value)
            speechManager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE &&
                OfflineSpeechEngineFactory.isReady(this, pack)
        }.getOrDefault(false)
    }

    private fun selectedLanguage(): Choice? = languages.getOrNull(languageSpinner.selectedItemPosition)

    private fun refreshDownloadedLanguages() {
        if (!::languageSpinner.isInitialized || isFinishing) return
        val selected = selectedLanguage()?.value
        val available = downloadedLanguages()
        if (available.map { it.value } == languages.map { it.value }) return
        languages = available
        languageSpinner.adapter = adapter(languages)
        val selectedIndex = languages.indexOfFirst { it.value == selected }
        if (languages.isNotEmpty()) languageSpinner.setSelection(if (selectedIndex >= 0) selectedIndex else 0)
    }

    private fun refreshModelStatus() {
        if (!::status.isInitialized || !::convertButton.isInitialized || isFinishing) return
        val choice = selectedLanguage()
        if (choice == null) {
            status.text = "No downloaded speech model is available. Download a language model in Download Models first."
            convertButton.isEnabled = false
            return
        }
        val language = choice.value
        val pack = SpeechModelCatalog.indicConformer(language)
        val snapshot = runCatching { speechManager.snapshot(pack) }.getOrNull()
        val ready = snapshot?.state == SpeechPackDownloadManager.State.COMPLETE && OfflineSpeechEngineFactory.isReady(this, pack)
        status.text = if (ready) {
            "Model ready · ${choice.label} · Offline on this phone. Internet is not required."
        } else {
            "Model not downloaded for ${choice.label}. Open Download Models and download AI4Bharat IndicConformer INT8 · ${choice.label} first (about ${pack.totalBytes / 1_000_000} MB)."
        }
        convertButton.isEnabled = ready && selectedAudio != null
    }

    private fun convertAudio() {
        val uri = selectedAudio
        if (uri == null) { Toast.makeText(this, "Please choose an audio file first.", Toast.LENGTH_LONG).show(); return }
        val choice = selectedLanguage()
        if (choice == null) {
            status.text = "No downloaded speech model is available. Download a language model in Download Models first."
            return
        }
        val language = choice.value
        val pack = SpeechModelCatalog.indicConformer(language)
        if (!OfflineSpeechEngineFactory.isReady(this, pack)) {
            status.text = "Download the ${choice.label} offline model first."
            convertButton.isEnabled = false
            return
        }
        convertButton.isEnabled = false
        convertButton.text = "Converting…"
        status.text = "Decoding audio and transcribing locally on this phone…"
        resultText.setText("")
        copyButton.isEnabled = false
        worker.execute {
            try {
                val samples = AudioFileDecoder.decode(this, uri)
                check(samples.isNotEmpty()) { "The selected audio contains no decodable sound." }
                val engine = OfflineSpeechEngineFactory.openIndicConformer(this, language)
                val transcript = try { engine.transcribe(samples) } finally { engine.close() }
                if (transcript.isBlank()) throw IllegalStateException("No speech was detected in this audio.")
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    resultText.setText(transcript)
                    copyButton.isEnabled = true
                    status.text = "Offline conversion complete · ${choice.label} · AI4Bharat IndicConformer · processed on this phone."
                    convertButton.isEnabled = true
                    convertButton.text = "Convert Offline"
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    status.text = error.message ?: "Offline audio conversion failed."
                    convertButton.isEnabled = OfflineSpeechEngineFactory.isReady(this, pack) && selectedAudio != null
                    convertButton.text = "Convert Offline"
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

    override fun onResume() {
        super.onResume()
        refreshDownloadedLanguages()
        refreshModelStatus()
    }
    private fun label(value: String) = TextView(this).apply {
        text = value; textSize = 12f; setTextColor(muted)
        setTypeface(typeface, android.graphics.Typeface.BOLD); setPadding(0, dp(12), 0, dp(5))
    }
    private fun fieldParams() = LinearLayout.LayoutParams(-1, dp(52)).apply { bottomMargin = dp(8) }
    private fun <T> adapter(items: List<T>) = ArrayAdapter(this, android.R.layout.simple_spinner_item, items).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    override fun onDestroy() { worker.shutdownNow(); super.onDestroy() }

    companion object { private const val REQUEST_AUDIO = 2401 }
}
