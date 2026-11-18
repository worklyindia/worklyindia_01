package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import java.util.Locale
import java.util.concurrent.Executors

class OfflineAiChatActivity : Activity(), TextToSpeech.OnInitListener {
    private val worker = Executors.newSingleThreadExecutor()
    private val modelManager by lazy { OfflineModelManager(this) }
    private val kokoroModelManager by lazy { KokoroModelManager(this) }
    private val engine by lazy { OfflineAiEngine() }
    private var kokoroEngine: KokoroSpeechEngine? = null
    private val languages = listOf(
        VoiceLanguage("Hindi · हिन्दी", "hi-IN", Locale.forLanguageTag("hi-IN")),
        VoiceLanguage("English · India", "en-IN", Locale.forLanguageTag("en-IN")),
        VoiceLanguage("Gujarati · ગુજરાતી", "gu-IN", Locale.forLanguageTag("gu-IN"))
    )
    private lateinit var transcript: TextView
    private lateinit var promptInput: EditText
    private lateinit var sendButton: Button
    private lateinit var micButton: Button
    private lateinit var status: TextView
    private lateinit var languagePicker: Spinner
    private lateinit var chatScroll: ScrollView
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val conversationHistory = StringBuilder()
    private var recognizer: SpeechRecognizer? = null
    private var dark = false

    private data class VoiceLanguage(val label: String, val tag: String, val locale: Locale) {
        override fun toString() = label
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = isSystemDarkMode()
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        if (android.os.Build.VERSION.SDK_INT >= 23) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (dark) 0 else
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
        buildUi()
        tts = TextToSpeech(this, this)
        loadModel()
    }

    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primaryText get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondaryText get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()
    private val accent get() = 0xFF1769C2.toInt()

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(12), dp(18), dp(12))
            setBackgroundColor(bg)
        }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(Button(this).apply {
            text = "‹"
            textSize = 28f
            isAllCaps = false
            setTextColor(primaryText)
            setBackgroundColor(bg)
            contentDescription = "Back"
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        header.addView(TextView(this).apply {
            text = "Workly AI · Offline Chat"
            textSize = 21f
            setTextColor(primaryText)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(header)

        status = text("Loading Qwen model…", 13, 0xFF2E9D72.toInt())
        root.addView(status)
        languagePicker = Spinner(this).apply {
            adapter = ArrayAdapter(this@OfflineAiChatActivity, android.R.layout.simple_spinner_dropdown_item, languages)
        }
        root.addView(languagePicker, LinearLayout.LayoutParams(-1, -2))

        transcript = text("Welcome to Workly AI.\n\nType a message below and tap Send. Your text chat runs locally on this phone.", 15, primaryText)
        transcript.setPadding(dp(14), dp(14), dp(14), dp(14))
        chatScroll = ScrollView(this).apply {
            isFillViewport = true
            addView(transcript)
        }
        root.addView(chatScroll, LinearLayout.LayoutParams(-1, 0, 1f))

        promptInput = EditText(this).apply {
            hint = "Ask in Hindi, English or Gujarati…"
            minLines = 2
            maxLines = 5
            setTextColor(primaryText)
            setHintTextColor(secondaryText)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(surface)
        }
        root.addView(promptInput, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) })

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        micButton = button("🎙 Voice")
        micButton.setOnClickListener { startVoiceInput() }
        actions.addView(micButton, LinearLayout.LayoutParams(0, dp(52), 1f).apply { rightMargin = dp(6) })
        sendButton = button("Send")
        sendButton.isEnabled = false
        sendButton.setOnClickListener { sendPrompt() }
        actions.addView(sendButton, LinearLayout.LayoutParams(0, dp(52), 1f).apply { leftMargin = dp(6) })
        root.addView(actions)

        root.addView(text(
            "AI text generation runs offline. Voice recognition uses your Android speech service; availability may depend on its installed language pack and network support.",
            12, secondaryText
        ))
        setContentView(root)
    }

    private fun loadModel() {
        sendButton.isEnabled = false
        status.text = "Checking Qwen model and phone memory…"
        worker.execute {
            try {
                val memoryInfo = ActivityManager.MemoryInfo()
                (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memoryInfo)
                check(memoryInfo.totalMem >= 6L * 1024L * 1024L * 1024L) {
                    "Qwen 3B needs a phone with at least 6 GB RAM. Close other apps and try again."
                }
                check(modelManager.snapshot().state == OfflineModelManager.State.READY) {
                    "Qwen is not downloaded. Open Downloads on the previous screen and finish the download."
                }
                check(engine.loadModel(modelManager.modelFile)) {
                    "Qwen could not load. The phone may not have enough free RAM."
                }
                runOnUiThread {
                    status.text = "Ready · Qwen2.5-3B runs on this phone"
                    sendButton.isEnabled = true
                }
            } catch (error: Exception) {
                runOnUiThread { status.text = error.message ?: "Offline AI could not start." }
            }
        }
    }

    private fun sendPrompt() {
        val prompt = promptInput.text?.toString()?.trim().orEmpty()
        if (prompt.isEmpty()) {
            promptInput.error = "Enter a message"
            return
        }
        if (!engine.isLoaded) {
            status.text = "AI model is not ready yet. Wait for the Ready status."
            return
        }
        promptInput.setText("")
        append("\n\nYou: $prompt\n\nWorkly AI: thinking…")
        sendButton.isEnabled = false
        val contextPrompt = if (conversationHistory.isEmpty()) prompt else
            "Previous conversation:\n$conversationHistory\nCurrent message:\n$prompt"
        worker.execute {
            val answer = try {
                engine.generate(contextPrompt)
            } catch (error: Exception) {
                "Sorry, offline AI could not answer: ${error.message ?: "please try again"}"
            }
            conversationHistory.append("User: ").append(prompt).append("\nAssistant: ").append(answer).append("\n")
            if (conversationHistory.length > 9000) conversationHistory.delete(0, conversationHistory.length - 9000)
            runOnUiThread {
                replaceThinking(answer)
                sendButton.isEnabled = engine.isLoaded
                speakAnswer(answer)
            }
        }
    }

    private fun startVoiceInput() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO)
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            status.text = "No speech recognition service is installed. Install or enable one in Android settings."
            return
        }
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(this).also { speech ->
            speech.setRecognitionListener(object : android.speech.RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { status.text = "Listening in ${selectedLanguage().label}…" }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { status.text = "Recognizing speech…" }
                override fun onError(error: Int) {
                    status.text = when (error) {
                        SpeechRecognizer.ERROR_AUDIO -> "Microphone audio error. Check microphone access."
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is required."
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Speech service needs a network connection or an installed offline language pack."
                        SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized. Speak clearly and try again."
                        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech service is busy. Try again."
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected. Tap Voice and speak."
                        else -> "Speech recognition failed (code $error). Check the Android speech service and language pack."
                    }
                    micButton.isEnabled = true
                }
                override fun onResults(results: Bundle?) {
                    val spoken = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    if (!spoken.isNullOrBlank()) {
                        promptInput.setText(spoken)
                        promptInput.setSelection(promptInput.text.length)
                        status.text = "Voice converted to text. Tap Send to ask Workly AI."
                    } else status.text = "No speech recognized. Try again."
                    micButton.isEnabled = true
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val partial = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    if (!partial.isNullOrBlank()) status.text = "Hearing: $partial"
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        val language = selectedLanguage()
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language.tag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language.tag)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            // Do not force EXTRA_PREFER_OFFLINE: some Android speech providers reject
            // the request even when they can otherwise recognize the selected language.
        }
        micButton.isEnabled = false
        status.text = "Starting microphone…"
        recognizer?.startListening(intent)
    }

    private fun speakAnswer(value: String) {
        val language = selectedLanguage()
        val isKokoroLanguage = language.tag.startsWith("hi") || language.tag.startsWith("en")
        if (isKokoroLanguage && runCatching { kokoroModelManager.snapshot().state == KokoroModelManager.State.READY }.getOrDefault(false)) {
            status.text = "Generating speech with downloaded Kokoro…"
            worker.execute {
                try {
                    val kokoro = kokoroEngine ?: KokoroSpeechEngine.create(this, kokoroModelManager.modelFile).also { kokoroEngine = it }
                    val voiceId = if (language.tag.startsWith("hi")) KokoroSpeechEngine.HINDI_VOICE else KokoroSpeechEngine.ENGLISH_US_VOICE
                    kokoro.speak(value, voiceId)
                    runOnUiThread { status.text = "Spoken with downloaded Kokoro voice." }
                } catch (error: Exception) {
                    runOnUiThread { status.text = "Downloaded Kokoro could not play: ${error.message ?: "engine error"}. Android TTS was not substituted." }
                }
            }
            return
        }
        val voice = tts
        if (!ttsReady || voice == null) {
            status.text = "Speech output is not ready. Install the selected Android voice or download Kokoro for Hindi/English."
            return
        }
        if (voice.isLanguageAvailable(language.locale) >= TextToSpeech.LANG_AVAILABLE) {
            voice.setLanguage(language.locale)
            voice.speak(value, TextToSpeech.QUEUE_FLUSH, null, "workly-chat-${System.currentTimeMillis()}")
            status.text = if (language.tag.startsWith("gu")) "Gujarati is using Android TTS; Indic Tiny TTS is not integrated yet." else
                "Kokoro is not downloaded for this language; using Android TTS."
        } else status.text = "No installed TTS voice supports ${language.label}."
    }

    private fun selectedLanguage() = languages.getOrElse(languagePicker.selectedItemPosition) { languages.first() }

    override fun onInit(result: Int) { ttsReady = result == TextToSpeech.SUCCESS }

    private fun append(value: String) {
        transcript.append(value)
        chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
    }

    private fun replaceThinking(answer: String) {
        val current = transcript.text.toString()
        val marker = "Workly AI: thinking…"
        val index = current.lastIndexOf(marker)
        transcript.text = if (index >= 0) current.substring(0, index) + "Workly AI: $answer" else "$current\n\nWorkly AI: $answer"
        chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
    }

    private fun text(value: String, size: Int, color: Int) = TextView(this).apply {
        text = value
        textSize = size.toFloat()
        setTextColor(color)
        setPadding(0, dp(8), 0, dp(8))
    }

    private fun button(value: String) = Button(this).apply {
        text = value
        isAllCaps = false
        minHeight = dp(48)
        setTextColor(0xFFFFFFFF.toInt())
        setBackgroundColor(accent)
    }

    private fun isSystemDarkMode(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_AUDIO && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) startVoiceInput()
        else if (requestCode == REQUEST_AUDIO) status.text = "Microphone permission denied."
    }

    override fun onDestroy() {
        recognizer?.destroy()
        tts?.stop()
        tts?.shutdown()
        worker.execute { engine.unload() }
        worker.shutdown()
        kokoroEngine?.close()
        super.onDestroy()
    }

    companion object { private const val REQUEST_AUDIO = 5101 }
}
