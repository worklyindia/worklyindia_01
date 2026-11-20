package com.worklyindia.aivoice

import android.app.Activity
import android.os.Bundle
import android.util.Base64
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
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Online translator that uses the same authenticated Workly website translation endpoint. */
class ChatWorkTranslatorActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var sourcePicker: Spinner
    private lateinit var targetPicker: Spinner
    private lateinit var sourceText: EditText
    private lateinit var resultText: TextView
    private lateinit var status: TextView
    private lateinit var translateButton: Button
    private lateinit var progress: ProgressBar

    private data class Language(val code: String, val label: String) {
        override fun toString() = label
    }

    private val languages = listOf(
        Language("auto", "Detect language"),
        Language("en", "English"),
        Language("hi", "Hindi · हिन्दी"),
        Language("gu", "Gujarati · ગુજરાતી"),
        Language("bn", "Bengali · বাংলা"),
        Language("mr", "Marathi · मराठी"),
        Language("ta", "Tamil · தமிழ்"),
        Language("te", "Telugu · తెలుగు"),
        Language("kn", "Kannada · ಕನ್ನಡ"),
        Language("ml", "Malayalam · മലയാളം"),
        Language("pa", "Punjabi · ਪੰਜਾਬੀ"),
        Language("ur", "Urdu · اردو"),
        Language("ne", "Nepali · नेपाली"),
        Language("as", "Assamese"),
        Language("or", "Odia"),
        Language("es", "Spanish"),
        Language("fr", "French"),
        Language("de", "German"),
        Language("it", "Italian"),
        Language("pt", "Portuguese"),
        Language("ru", "Russian"),
        Language("zh", "Chinese"),
        Language("ja", "Japanese"),
        Language("ko", "Korean"),
        Language("ar", "Arabic"),
        Language("tr", "Turkish"),
        Language("id", "Indonesian"),
        Language("vi", "Vietnamese"),
        Language("th", "Thai"),
        Language("fa", "Persian"),
        Language("he", "Hebrew"),
        Language("nl", "Dutch"),
        Language("pl", "Polish"),
        Language("uk", "Ukrainian"),
        Language("sv", "Swedish"),
        Language("ro", "Romanian"),
        Language("sw", "Swahili")
    )

    private val bg = 0xFFF4F7FB.toInt()
    private val ink = 0xFF142033.toInt()
    private val muted = 0xFF65748B.toInt()
    private val blue = 0xFF1769C2.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
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
            text = "Language Translator"; textSize = 21f; setTextColor(ink)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(header)

        status = TextView(this).apply {
            text = "Online translation · Uses Workly website translation service"
            textSize = 12f; setTextColor(muted); setPadding(dp(4), dp(8), dp(4), dp(8))
        }
        root.addView(status)

        sourcePicker = Spinner(this).apply { adapter = languageAdapter() }
        targetPicker = Spinner(this).apply { adapter = languageAdapter(languages.filter { it.code != "auto" }) }
        sourcePicker.setSelection(0)
        targetPicker.setSelection(2) // Gujarati is a useful initial target for the India audience.
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
                setColor(0xFFFFFFFF.toInt()); setStroke(dp(1), 0xFFD8E0EA.toInt()); cornerRadius = dp(12).toFloat()
            }
        }
        root.addView(sourceText, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })

        translateButton = Button(this).apply {
            text = "Translate online"; isAllCaps = false
            setOnClickListener { translate() }
        }
        root.addView(translateButton, LinearLayout.LayoutParams(-1, dp(50)).apply { topMargin = dp(10) })
        progress = ProgressBar(this).apply { visibility = View.GONE }
        root.addView(progress, LinearLayout.LayoutParams(-2, dp(32)).apply { gravity = Gravity.CENTER_HORIZONTAL })
        root.addView(label("Translation"))
        resultText = TextView(this).apply {
            text = "Your translation will appear here."
            textSize = 16f; setTextColor(ink); setPadding(dp(12), dp(12), dp(12), dp(12))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(0xFFFFFFFF.toInt()); setStroke(dp(1), 0xFFD8E0EA.toInt()); cornerRadius = dp(12).toFloat()
            }
        }
        root.addView(ScrollView(this).apply {
            addView(resultText, ViewGroup.LayoutParams(-1, -2))
        }, LinearLayout.LayoutParams(-1, 0, 1f))
        val copy = Button(this).apply {
            text = "Copy translation"; isAllCaps = false
            setOnClickListener {
                val value = resultText.text.toString()
                if (value.isNotBlank() && value != "Your translation will appear here.") {
                    val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Translation", value))
                    status.text = "Translation copied."
                }
            }
        }
        root.addView(copy, LinearLayout.LayoutParams(-1, dp(48)).apply { topMargin = dp(8) })
        setContentView(root)
    }

    private fun label(value: String) = TextView(this).apply {
        text = value; textSize = 13f; setTextColor(muted); setPadding(dp(4), dp(8), dp(4), dp(2))
    }

    private fun languageAdapter(items: List<Language> = languages): ArrayAdapter<Language> =
        ArrayAdapter(this, android.R.layout.simple_spinner_item, items).also {
            it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }

    private fun translate() {
        val input = sourceText.text?.toString()?.trim().orEmpty()
        if (input.isBlank()) {
            sourceText.error = "Enter text to translate"
            return
        }
        if (input.length > 4000) {
            sourceText.error = "Maximum 4,000 characters"
            return
        }
        val source = languages[sourcePicker.selectedItemPosition].code
        val target = (targetPicker.selectedItem as Language).code
        if (target == "auto") {
            status.text = "Choose a target language."
            return
        }
        translateButton.isEnabled = false
        progress.visibility = View.VISIBLE
        status.text = "Translating using Workly online service…"
        worker.execute {
            try {
                val accessToken = getValidAccessToken()
                val payload = JSONObject()
                    .put("text", input)
                    .put("sourceLang", source)
                    .put("targetLang", target)
                val connection = (URL("${BuildConfig.SUPABASE_URL}/functions/v1/ai-career-chat/translate").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"; connectTimeout = 20000; readTimeout = 100000; doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                    setRequestProperty("Authorization", "Bearer $accessToken")
                }
                val result = try {
                    connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                    val code = connection.responseCode
                    val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                    val response = JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty().ifBlank { "{}" })
                    if (code !in 200..299) {
                        throw IllegalStateException(response.optString("error").ifBlank { "Translation request failed (HTTP $code)." })
                    }
                    response.optString("translatedText").trim().also {
                        if (it.isBlank()) throw IllegalStateException("The translation service returned an empty result.")
                    }
                } finally { connection.disconnect() }
                runOnUiThread {
                    resultText.text = result
                    status.text = "Translation complete · Online"
                }
            } catch (error: Exception) {
                runOnUiThread {
                    status.text = error.message ?: "Translation failed. Please try again."
                }
            } finally {
                runOnUiThread {
                    progress.visibility = View.GONE
                    translateButton.isEnabled = true
                }
            }
        }
    }

    private fun getValidAccessToken(): String {
        var access = SecureDeviceTokenStore.readAccessToken(this)
            ?: throw IllegalStateException("Connect your Workly India account in ChatWork Settings first.")
        val refresh = SecureDeviceTokenStore.readRefreshToken(this)
            ?: throw IllegalStateException("Your secure sign-in session is missing. Reconnect your account.")
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
            connection.outputStream.use { it.write(JSONObject().put("refresh_token", refresh).toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val response = JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty().ifBlank { "{}" })
            if (code !in 200..299) throw IllegalStateException("Workly sign-in expired. Reconnect your account.")
            access = response.optString("access_token")
            val nextRefresh = response.optString("refresh_token", refresh)
            if (access.isBlank()) throw IllegalStateException("Could not refresh your Workly sign-in.")
            SecureDeviceTokenStore.saveAuthSession(this, access, nextRefresh)
            return access
        } finally { connection.disconnect() }
    }

    override fun onDestroy() {
        worker.shutdownNow()
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
