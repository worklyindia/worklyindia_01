package com.worklyindia.aivoice

import android.app.Activity
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.content.Intent
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.speech.tts.TextToSpeech
import java.util.Locale
import java.util.concurrent.Executors

class OfflineAiChatActivity : Activity(), TextToSpeech.OnInitListener {
    private val worker = Executors.newSingleThreadExecutor()
    private val modelManager by lazy { OfflineModelManager(this) }
    private val engine by lazy { OfflineAiEngine() }
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
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val conversationHistory = StringBuilder()
    private var recognizer: SpeechRecognizer? = null

    private data class VoiceLanguage(val label: String, val tag: String, val locale: Locale) {
        override fun toString() = label
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        tts = TextToSpeech(this, this)
        loadModel()
    }

    private fun buildUi() {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(20), dp(18), dp(20))
            setBackgroundColor(0xFFF4F7FB.toInt())
        }
        page.addView(TextView(this).apply {
            text = "Workly AI · Offline Chat"
            textSize = 23f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(0xFF142033.toInt())
        })
        status = text("Loading Qwen model…", 13, 0xFF28734D.toInt())
        page.addView(status)
        languagePicker = Spinner(this).apply {
            adapter = ArrayAdapter(this@OfflineAiChatActivity, android.R.layout.simple_spinner_dropdown_item, languages)
        }
        page.addView(languagePicker)
        transcript = text("Your messages stay on this phone while using Offline AI.", 15, 0xFF142033.toInt())
        transcript.setPadding(dp(12), dp(12), dp(12), dp(12))
        val scroll = ScrollView(this).apply {
            addView(transcript)
        }
        page.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        promptInput = EditText(this).apply {
            hint = "Ask Workly AI anything…"
            minLines = 2
            maxLines = 5
            setTextColor(0xFF142033.toInt())
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        page.addView(promptInput)
        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        micButton = button("🎙 Voice")
        micButton.setOnClickListener { startVoiceInput() }
        actions.addView(micButton, LinearLayout.LayoutParams(0, dp(52), 1f))
        sendButton = button("Send")
        sendButton.isEnabled = false
        sendButton.setOnClickListener { sendPrompt() }
        actions.addView(sendButton, LinearLayout.LayoutParams(0, dp(52), 1f))
        page.addView(actions)
        page.addView(text(
            "Offline voice recognition and speech playback depend on Hindi, English or Gujarati offline speech packs installed on Android.",
            12, 0xFF65748B.toInt()
        ))
        setContentView(page)
    }

    private fun loadModel() {
        sendButton.isEnabled = false
        worker.execute {
            try {
                val snapshot = modelManager.snapshot()
                check(snapshot.state == OfflineModelManager.State.READY) {
                    "Download the Qwen model from the previous screen first."
                }
                val loaded = engine.loadModel(modelManager.modelFile)
                check(loaded) { "Could not load Qwen on this phone. It may not have enough available memory." }
                runOnUiThread {
                    status.text = "Offline AI ready · Qwen2.5-3B-Instruct"
                    sendButton.isEnabled = true
                }
            } catch (error: Exception) {
                runOnUiThread {
                    status.text = error.message ?: "Offline AI could not start."
                }
            }
        }
    }

    private fun sendPrompt() {
        val prompt = promptInput.text?.toString()?.trim().orEmpty()
        if (prompt.isEmpty()) {
            promptInput.error = "Enter a message"
            return
        }
        promptInput.setText("")
        append("\n\nYou: $prompt\n\nWorkly AI: thinking…")
        sendButton.isEnabled = false
        worker.execute {
            val answer = try {
                engine.generate(prompt)
            } catch (error: Exception) {
                "Sorry, offline AI could not answer: ${error.message ?: "please try again"}"
            }
            conversationHistory.append("User: ").append(prompt).append("\\nAssistant: ").append(answer).append("\\n")
            if (conversationHistory.length > 9000) conversationHistory.delete(0, conversationHistory.length - 9000)
            runOnUiThread {
                replaceThinking(answer)
                sendButton.isEnabled = engine.isLoaded
                if (ttsReady) speak(answer)
            }
        }
    }

    private fun startVoiceInput() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            status.text = "No Android speech recognition service is installed."
            return
        }
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(this).also { speech ->
            speech.setRecognitionListener(object : android.speech.RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { status.text = "Listening…"}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { status.text = "Recognizing speech…"}
                override fun onError(error: Int) { status.text = "Voice input failed. Check offline speech pack and try again."}
                override fun onResults(results: Bundle?) {
                    val spoken = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    if (!spoken.isNullOrBlank()) {
                        promptInput.setText(spoken)
                        status.text = "Voice converted to text. Tap Send."
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        val language = languages[languagePicker.selectedItemPosition]
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language.tag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language.tag)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        recognizer?.startListening(intent)
    }

    private fun speak(value: String) {
        val language = languages[languagePicker.selectedItemPosition]
        val voice = tts ?: return
        if (voice.isLanguageAvailable(language.locale) >= TextToSpeech.LANG_AVAILABLE) {
            voice.setLanguage(language.locale)
            voice.speak(value, TextToSpeech.QUEUE_FLUSH, null, "workly-offline-${System.currentTimeMillis()}")
        } else {
            status.text = "Install the ${language.label} offline text-to-speech voice in Android settings."
        }
    }

    override fun onInit(result: Int) {
        ttsReady = result == TextToSpeech.SUCCESS
    }

    private fun append(value: String) {
        transcript.append(value)
    }

    private fun replaceThinking(answer: String) {
        val current = transcript.text.toString()
        val marker = "Workly AI: thinking…"
        val index = current.lastIndexOf(marker)
        transcript.text = if (index >= 0) current.substring(0, index) + "Workly AI: $answer" else "$current\n\nWorkly AI: $answer"
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
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        recognizer?.destroy()
        tts?.stop()
        tts?.shutdown()
        worker.execute { engine.unload() }
        worker.shutdown()
        super.onDestroy()
    }
}
