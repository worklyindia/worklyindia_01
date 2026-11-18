package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import java.util.Locale

class MainActivity : Activity(), TextToSpeech.OnInitListener {
    private data class VoiceLanguage(val label: String, val tag: String, val locale: Locale) {
        override fun toString() = label
    }
    private val languages = listOf(
        VoiceLanguage("Hindi · हिन्दी", "hi-IN", Locale.forLanguageTag("hi-IN")),
        VoiceLanguage("English · India", "en-IN", Locale.forLanguageTag("en-IN")),
        VoiceLanguage("Gujarati · ગુજરાતી", "gu-IN", Locale.forLanguageTag("gu-IN"))
    )
    private lateinit var languagePicker: Spinner
    private lateinit var inputText: EditText
    private lateinit var transcriptText: EditText
    private lateinit var statusText: TextView
    private lateinit var listenButton: Button
    private var tts: TextToSpeech? = null
    private var recognizer: SpeechRecognizer? = null
    private var ttsReady = false
    private var listening = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = 0xFF101827.toInt()
        window.navigationBarColor = 0xFF101827.toInt()
        buildScreen()
        tts = TextToSpeech(this, this)
        updateSpeechAvailability()
    }

    private fun buildScreen() {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(24))
            setBackgroundColor(0xFFF4F7FB.toInt())
        }
        val scroll = ScrollView(this).apply { addView(page) }
        page.addView(label("WORKLY INDIA", 12, 0xFF2878D0.toInt(), true))
        page.addView(label("AI Voice Studio", 28, 0xFF142033.toInt(), true).also {
            it.setPadding(0, dp(5), 0, dp(4))
        })
        page.addView(label("Hindi · English · Gujarati", 15, 0xFF65748B.toInt(), false))
        page.addView(space(18))

        val statusCard = card()
        statusText = label("Preparing on-device voice engines…", 14, 0xFF174B36.toInt(), true)
        statusCard.addView(statusText)
        statusCard.addView(label(
            "Voice availability and quality depend on the speech engines installed on this phone.",
            12, 0xFF536276.toInt(), false
        ).also { it.setPadding(0, dp(7), 0, 0) })
        page.addView(statusCard)
        page.addView(space(18))

        page.addView(sectionTitle("1. Text to Voice"))
        languagePicker = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, languages)
        }
        page.addView(languagePicker, matchWrap())
        inputText = EditText(this).apply {
            hint = "Type Hindi, English or Gujarati text…"
            minLines = 3
            maxLines = 6
            gravity = Gravity.TOP or Gravity.START
            setTextColor(0xFF142033.toInt())
            setHintTextColor(0xFF8491A3.toInt())
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(0xFFFFFFFF.toInt())
        }
        page.addView(inputText, matchWrap().also { it.topMargin = dp(10) })
        val speakButton = button("▶  Speak text")
        speakButton.setOnClickListener { speakText() }
        page.addView(speakButton, matchWrap().also { it.topMargin = dp(10) })
        page.addView(button("■  Stop voice").apply {
            setBackgroundColor(0xFFE8EDF4.toInt())
            setTextColor(0xFF26364B.toInt())
            setOnClickListener { tts?.stop(); setStatus("Voice playback stopped.") }
        }, matchWrap().also { it.topMargin = dp(8) })

        page.addView(space(22))
        page.addView(sectionTitle("2. Voice to Text"))
        page.addView(label("Choose the language you will speak, then tap Start listening.", 13, 0xFF65748B.toInt(), false))
        listenButton = button("🎙  Start listening")
        listenButton.setOnClickListener { startListening() }
        page.addView(listenButton, matchWrap().also { it.topMargin = dp(10) })
        transcriptText = EditText(this).apply {
            hint = "Your recognized speech will appear here…"
            minLines = 4
            maxLines = 8
            gravity = Gravity.TOP or Gravity.START
            setTextColor(0xFF142033.toInt())
            setHintTextColor(0xFF8491A3.toInt())
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(0xFFFFFFFF.toInt())
        }
        page.addView(transcriptText, matchWrap().also { it.topMargin = dp(10) })
        page.addView(label(
            "Speech recognition may use your phone's configured recognition provider and may require internet.",
            12, 0xFF65748B.toInt(), false
        ).also { it.setPadding(0, dp(10), 0, 0) })

        page.addView(space(22))
        val notice = card()
        notice.addView(label("Website server connection: not enabled yet", 14, 0xFF8A4B08.toInt(), true))
        notice.addView(label(
            "This first build provides on-phone speech testing. Public Workly website access over mobile data needs a separate secure relay because mobile networks commonly use carrier NAT. No existing Workly app or Cloudflare service is changed.",
            12, 0xFF536276.toInt(), false
        ).also { it.setPadding(0, dp(7), 0, 0) })
        page.addView(notice)
        page.addView(space(10))
        page.addView(label("WORKLY AI VOICE · VERSION 1.0.0", 11, 0xFF8491A3.toInt(), true).also {
            it.gravity = Gravity.CENTER
        })
        setContentView(scroll)
    }

    private fun speakText() {
        val engine = tts
        if (!ttsReady || engine == null) {
            setStatus("Text-to-speech engine is still loading.")
            return
        }
        val text = inputText.text?.toString()?.trim().orEmpty()
        if (text.isEmpty()) {
            inputText.error = "Enter text to speak"
            return
        }
        val lang = selectedLanguage()
        if (engine.isLanguageAvailable(lang.locale) < TextToSpeech.LANG_AVAILABLE) {
            setStatus("Installed voice engine does not support ${lang.label}. Install this voice in Android Text-to-speech settings.")
            return
        }
        engine.setLanguage(lang.locale)
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "workly-${System.currentTimeMillis()}")
        setStatus("Speaking ${lang.label}…")
    }

    private fun startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            setStatus("No speech recognition service is installed on this phone.")
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO)
            return
        }
        stopListening()
        recognizer = SpeechRecognizer.createSpeechRecognizer(this).also { speech ->
            speech.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { setStatus("Listening in ${selectedLanguage().label}…") }
                override fun onBeginningOfSpeech() { listening = true }
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { listening = false; setStatus("Processing speech…") }
                override fun onError(error: Int) {
                    listening = false
                    listenButton.text = "🎙  Start listening"
                    setStatus(recognitionError(error))
                }
                override fun onResults(results: Bundle?) {
                    listening = false
                    listenButton.text = "🎙  Start listening"
                    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                    if (text.isNotBlank()) {
                        transcriptText.setText(text)
                        setStatus("Speech converted to text.")
                    } else setStatus("No speech was recognized. Please try again.")
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val partial = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    if (!partial.isNullOrBlank()) transcriptText.setText(partial)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        val lang = selectedLanguage()
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang.tag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang.tag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        listenButton.text = "■  Stop listening"
        listenButton.setOnClickListener { stopListening(); setStatus("Listening stopped.") }
        recognizer?.startListening(intent)
    }

    private fun stopListening() {
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        listening = false
        if (::listenButton.isInitialized) {
            listenButton.text = "🎙  Start listening"
            listenButton.setOnClickListener { startListening() }
        }
    }

    private fun selectedLanguage() = languages.getOrElse(languagePicker.selectedItemPosition) { languages.first() }

    private fun updateSpeechAvailability() {
        val speech = if (SpeechRecognizer.isRecognitionAvailable(this)) "Speech recognition available" else "Speech recognition service not found"
        setStatus("$speech · Checking text-to-speech engine…")
    }

    override fun onInit(status: Int) {
        ttsReady = status == TextToSpeech.SUCCESS
        if (ttsReady) {
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) { runOnUiThread { setStatus("Voice playback finished.") } }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) { runOnUiThread { setStatus("Voice playback failed.") } }
            })
            setStatus("Text-to-speech engine ready. Select a language to test.")
        } else setStatus("Android text-to-speech engine could not start.")
    }

    private fun recognitionError(code: Int): String = when (code) {
        SpeechRecognizer.ERROR_AUDIO -> "Microphone audio error."
        SpeechRecognizer.ERROR_CLIENT -> "Recognition cancelled. Try again."
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is required."
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network problem in speech recognition provider."
        SpeechRecognizer.ERROR_NO_MATCH -> "No matching speech found. Please try again."
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech service is busy. Try again."
        SpeechRecognizer.ERROR_SERVER -> "Speech recognition provider error."
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected. Try again."
        else -> "Speech recognition failed (code $code)."
    }

    private fun setStatus(message: String) {
        if (::statusText.isInitialized) statusText.text = message
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_AUDIO && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            startListening()
        } else if (requestCode == REQUEST_AUDIO) setStatus("Microphone permission denied.")
    }

    override fun onPause() {
        super.onPause()
        if (listening) stopListening()
    }

    override fun onDestroy() {
        stopListening()
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }

    private fun label(text: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        this.text = text
        textSize = size.toFloat()
        setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    private fun sectionTitle(text: String) = label(text, 19, 0xFF142033.toInt(), true).apply {
        setPadding(0, 0, 0, dp(8))
    }
    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(16), dp(16), dp(16))
        setBackgroundColor(0xFFFFFFFF.toInt())
        elevation = dp(2).toFloat()
    }
    private fun button(text: String) = Button(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 15f
        setTextColor(0xFFFFFFFF.toInt())
        setBackgroundColor(0xFF1769C2.toInt())
        minHeight = dp(50)
    }
    private fun space(height: Int) = View(this).apply { layoutParams = LinearLayout.LayoutParams(1, dp(height)) }
    private fun matchWrap() = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object { private const val REQUEST_AUDIO = 4102 }
}
