package com.worklyindia.aivoice

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions

/** Offline on-device translator. Language packs are downloaded to this phone on first use. */
class ChatWorkTranslatorActivity : Activity() {
    private lateinit var sourcePicker: Spinner
    private lateinit var targetPicker: Spinner
    private lateinit var sourceText: EditText
    private lateinit var resultText: TextView
    private lateinit var status: TextView
    private lateinit var translateButton: Button
    private lateinit var progress: ProgressBar
    private var activeTranslator: Translator? = null

    private data class Language(val code: String, val label: String) {
        override fun toString() = label
    }

    // Only languages supported by ML Kit's on-device translation API.
    private val languages = listOf(
        Language("af", "Afrikaans"), Language("ar", "Arabic · العربية"),
        Language("be", "Belarusian"), Language("bg", "Bulgarian"),
        Language("bn", "Bengali · বাংলা"), Language("ca", "Catalan"),
        Language("cs", "Czech"), Language("cy", "Welsh"), Language("da", "Danish"),
        Language("de", "German"), Language("el", "Greek"), Language("en", "English"),
        Language("eo", "Esperanto"), Language("es", "Spanish"), Language("et", "Estonian"),
        Language("fa", "Persian · فارسی"), Language("fi", "Finnish"), Language("fr", "French"),
        Language("ga", "Irish"), Language("gl", "Galician"), Language("gu", "Gujarati · ગુજરાતી"),
        Language("he", "Hebrew"), Language("hi", "Hindi · हिन्दी"), Language("hr", "Croatian"),
        Language("ht", "Haitian Creole"), Language("hu", "Hungarian"), Language("id", "Indonesian"),
        Language("is", "Icelandic"), Language("it", "Italian"), Language("ja", "Japanese"),
        Language("ka", "Georgian"), Language("kn", "Kannada · ಕನ್ನಡ"), Language("ko", "Korean"),
        Language("lt", "Lithuanian"), Language("lv", "Latvian"), Language("mk", "Macedonian"),
        Language("mr", "Marathi · मराठी"), Language("ms", "Malay"), Language("mt", "Maltese"),
        Language("nl", "Dutch"), Language("no", "Norwegian"), Language("pl", "Polish"),
        Language("pt", "Portuguese"), Language("ro", "Romanian"), Language("ru", "Russian"),
        Language("sk", "Slovak"), Language("sl", "Slovenian"), Language("sq", "Albanian"),
        Language("sv", "Swedish"), Language("sw", "Swahili"), Language("ta", "Tamil · தமிழ்"),
        Language("te", "Telugu · తెలుగు"), Language("th", "Thai"), Language("tl", "Tagalog"),
        Language("tr", "Turkish"), Language("uk", "Ukrainian"), Language("ur", "Urdu · اردو"),
        Language("vi", "Vietnamese"), Language("zh", "Chinese · 中文")
    )

    private val bg get() = ChatWorkTheme.color(this, 0xFFF4F7FB.toInt())
    private val ink get() = ChatWorkTheme.color(this, 0xFF142033.toInt())
    private val muted get() = ChatWorkTheme.color(this, 0xFF65748B.toInt())
    private val surface get() = ChatWorkTheme.color(this, 0xFFFFFFFF.toInt())
    private val border get() = ChatWorkTheme.color(this, 0xFFD8E0EA.toInt())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        ChatWorkTheme.applyWindow(this)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(10), dp(16), dp(16))
            setBackgroundColor(bg)
        }
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        header.addView(Button(this).apply {
            text = "‹"; textSize = 28f; isAllCaps = false
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        header.addView(TextView(this).apply {
            text = "Offline Language Translator"; textSize = 20f; setTextColor(ink)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(header)

        status = TextView(this).apply {
            text = "On-device translation · Your text stays on this phone"
            textSize = 12f; setTextColor(muted); setPadding(dp(4), dp(8), dp(4), dp(4))
        }
        root.addView(status)
        root.addView(TextView(this).apply {
            text = "First use: download the language model over Wi-Fi (about 30 MB per language). After download, translation runs offline on your phone."
            textSize = 12f; setTextColor(muted); setPadding(dp(4), dp(2), dp(4), dp(10))
        })

        sourcePicker = Spinner(this).apply { adapter = languageAdapter() }
        targetPicker = Spinner(this).apply { adapter = languageAdapter() }
        sourcePicker.setSelection(languages.indexOfFirst { it.code == "en" })
        targetPicker.setSelection(languages.indexOfFirst { it.code == "gu" })
        root.addView(label("Translate from"))
        root.addView(sourcePicker, LinearLayout.LayoutParams(-1, dp(52)))
        root.addView(label("Translate to"))
        root.addView(targetPicker, LinearLayout.LayoutParams(-1, dp(52)))

        sourceText = EditText(this).apply {
            hint = "Enter text to translate"
            textSize = 16f; minLines = 4; maxLines = 8
            gravity = Gravity.TOP or Gravity.START
            setTextColor(ink); setHintTextColor(muted)
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(surface); setStroke(dp(1), border); cornerRadius = dp(12).toFloat()
            }
        }
        root.addView(sourceText, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })

        translateButton = Button(this).apply {
            text = "Translate offline"; isAllCaps = false
            setOnClickListener { translateOffline() }
        }
        root.addView(translateButton, LinearLayout.LayoutParams(-1, dp(50)).apply { topMargin = dp(10) })
        progress = ProgressBar(this).apply { visibility = View.GONE }
        root.addView(progress, LinearLayout.LayoutParams(-2, dp(32)).apply { gravity = Gravity.CENTER_HORIZONTAL })
        root.addView(label("Translation"))
        resultText = TextView(this).apply {
            text = "Your translation will appear here."
            textSize = 16f; setTextColor(ink); setPadding(dp(12), dp(12), dp(12), dp(12))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(surface); setStroke(dp(1), border); cornerRadius = dp(12).toFloat()
            }
        }
        root.addView(ScrollView(this).apply {
            addView(resultText, ViewGroup.LayoutParams(-1, -2))
        }, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(Button(this).apply {
            text = "Copy translation"; isAllCaps = false
            setOnClickListener {
                val value = resultText.text.toString()
                if (value.isNotBlank() && value != "Your translation will appear here.") {
                    val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Translation", value))
                    status.text = "Translation copied."
                }
            }
        }, LinearLayout.LayoutParams(-1, dp(48)).apply { topMargin = dp(8) })
        setContentView(root)
    }

    private fun label(value: String) = TextView(this).apply {
        text = value; textSize = 13f; setTextColor(muted); setPadding(dp(4), dp(8), dp(4), dp(2))
    }

    private fun languageAdapter(): ArrayAdapter<Language> =
        ArrayAdapter(this, android.R.layout.simple_spinner_item, languages).also {
            it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }

    private fun translateOffline() {
        val input = sourceText.text?.toString()?.trim().orEmpty()
        if (input.isBlank()) { sourceText.error = "Enter text to translate"; return }
        if (input.length > 4000) { sourceText.error = "Maximum 4,000 characters"; return }
        val source = languages[sourcePicker.selectedItemPosition].code
        val target = languages[targetPicker.selectedItemPosition].code
        if (source == target) { resultText.text = input; status.text = "Source and target languages are the same."; return }

        val sourceLanguage = TranslateLanguage.fromLanguageTag(source)
        val targetLanguage = TranslateLanguage.fromLanguageTag(target)
        if (sourceLanguage == null || targetLanguage == null) {
            status.text = "This language pair is not supported by the offline model."
            return
        }
        translateButton.isEnabled = false
        progress.visibility = View.VISIBLE
        status.text = "Preparing offline language model…"
        activeTranslator?.close()
        val translator = Translation.getClient(
            TranslatorOptions.Builder()
                .setSourceLanguage(sourceLanguage)
                .setTargetLanguage(targetLanguage)
                .build()
        )
        activeTranslator = translator
        val conditions = DownloadConditions.Builder().requireWifi().build()
        translator.downloadModelIfNeeded(conditions)
            .addOnSuccessListener {
                if (isFinishing || isDestroyed) return@addOnSuccessListener
                status.text = "Translating on this phone…"
                translator.translate(input)
                    .addOnSuccessListener { translated ->
                        if (!isFinishing && !isDestroyed) {
                            resultText.text = translated
                            status.text = "Translation complete · Offline on-device"
                        }
                        finishOperation(translator)
                    }
                    .addOnFailureListener { error ->
                        if (!isFinishing && !isDestroyed) status.text = error.localizedMessage ?: "Offline translation failed."
                        finishOperation(translator)
                    }
            }
            .addOnFailureListener { error ->
                if (!isFinishing && !isDestroyed) {
                    status.text = error.localizedMessage ?: "Could not download the language model. Connect to Wi-Fi and retry."
                }
                finishOperation(translator)
            }
    }

    private fun finishOperation(translator: Translator) {
        if (activeTranslator === translator) activeTranslator = null
        translator.close()
        if (!isFinishing && !isDestroyed) {
            progress.visibility = View.GONE
            translateButton.isEnabled = true
        }
    }

    override fun onDestroy() {
        activeTranslator?.close()
        activeTranslator = null
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
