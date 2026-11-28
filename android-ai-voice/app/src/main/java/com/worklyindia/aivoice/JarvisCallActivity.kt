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
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.Locale
import java.util.concurrent.Executors

/** Manual, user-started JARVIS voice test. Does not start the always-on wake-word service. */
class JarvisCallActivity : Activity(), TextToSpeech.OnInitListener {
    private val executor = Executors.newSingleThreadExecutor()
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var callEnded = false
    private lateinit var status: TextView
    private lateinit var transcript: TextView
    private lateinit var reply: TextView
    private lateinit var mic: Button
    private var history = StringBuilder("System: You are JARVIS, ChatWork’s concise multilingual voice assistant. Understand Hindi, Hinglish, Gujarati and English. Reply naturally in the user’s language, keep spoken answers brief, and do not claim to control phone settings.\n")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = 0xFF080F1D.toInt()
        window.navigationBarColor = 0xFF080F1D.toInt()
        buildUi()
        tts = TextToSpeech(this, this)
        val cfg = JarvisSettingsStore.read(this)
        if (cfg.apiKey.isBlank()) {
            status.text = "JARVIS setup incomplete · Save your Groq or Gemini API key first."
            mic.isEnabled = false
        } else {
            status.text = "Ready · ${cfg.provider.uppercase(Locale.ROOT)} · ${cfg.sttLanguage.uppercase(Locale.ROOT)}"
        }
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(22), dp(24), dp(22), dp(20))
            setBackgroundColor(0xFF080F1D.toInt())
        }
        root.addView(TextView(this).apply {
            text = "JARVIS VOICE"
            textSize = 13f
            letterSpacing = .18f
            setTextColor(0xFF8EA7C9.toInt())
        })
        root.addView(TextView(this).apply {
            text = "ChatWork"
            textSize = 30f
            setTextColor(-1)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, dp(5), 0, dp(6))
        })
        status = TextView(this).apply {
            text = "Preparing voice session…"
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(0xFF9DB1CC.toInt())
            setPadding(0, dp(8), 0, dp(20))
        }
        root.addView(status)
        root.addView(View(this).apply { setBackgroundColor(0xFF17263B.toInt()) },
            LinearLayout.LayoutParams(dp(190), dp(1)))
        mic = Button(this).apply {
            text = "🎙\n\nTap to speak"
            textSize = 18f
            isAllCaps = false
            setTextColor(-1)
            setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xFF2563EB.toInt()))
            setOnClickListener { startListening() }
        }
        root.addView(mic, LinearLayout.LayoutParams(dp(190), dp(190)).apply {
            gravity = Gravity.CENTER
            topMargin = dp(34)
            bottomMargin = dp(22)
        })
        transcript = bodyText("You: Your speech will appear here.")
        reply = bodyText("JARVIS: Your AI reply will appear here.")
        val scrollContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(transcript)
            addView(reply)
        }
        root.addView(ScrollView(this).apply { addView(scrollContent) }, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(Button(this).apply {
            text = "End voice chat"
            isAllCaps = false
            setOnClickListener { finishCall() }
        }, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(14) })
        setContentView(root)
    }

    private fun bodyText(value: String) = TextView(this).apply {
        text = value
        textSize = 16f
        setTextColor(0xFFE4ECF7.toInt())
        setPadding(dp(14), dp(14), dp(14), dp(14))
        setBackgroundColor(0xFF121F32.toInt())
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) }
    }

    private fun startListening() {
        if (callEnded) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 4401)
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            status.text = "Speech recognition service is not available on this phone."
            return
        }
        val cfg = JarvisSettingsStore.read(this)
        val locale = when (cfg.sttLanguage) { "gu" -> "gu-IN"; "hi" -> "hi-IN"; else -> "en-IN" }
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(this).also { sr ->
            sr.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    status.text = "Listening… Speak now"
                    mic.text = "🔴\n\nListening…"
                }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { status.text = "Thinking with ${cfg.provider.uppercase(Locale.ROOT)}…" }
                override fun onError(error: Int) {
                    status.text = "Speech recognition error ($error). Tap to try again."
                    mic.text = "🎙\n\nTap to speak"
                }
                override fun onResults(results: Bundle?) {
                    val spoken = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                    mic.text = "🎙\n\nTap to speak"
                    if (spoken.isBlank()) {
                        status.text = "No speech detected. Tap to try again."
                        return
                    }
                    transcript.text = "You: $spoken"
                    history.append("User: ").append(spoken).append("\n")
                    status.text = "JARVIS is thinking…"
                    executor.execute {
                        try {
                            val answer = JarvisSettingsStore.generateReply(this@JarvisCallActivity, history.toString(), cfg)
                            history.append("Assistant: ").append(answer).append("\n")
                            runOnUiThread {
                                if (callEnded) return@runOnUiThread
                                reply.text = "JARVIS: $answer"
                                status.text = "JARVIS replied · Tap the microphone to continue."
                                speak(answer, cfg.ttsLanguage)
                            }
                        } catch (e: Exception) {
                            runOnUiThread {
                                if (!callEnded) status.text = "AI error: ${e.message ?: "Request failed"}"
                            }
                        }
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            sr.startListening(intent)
        }
    }

    private fun speak(text: String, language: String) {
        val locale = when (language) {
            "gu" -> Locale.forLanguageTag("gu-IN")
            "hi" -> Locale.forLanguageTag("hi-IN")
            else -> Locale.forLanguageTag("en-IN")
        }
        val engine = tts
        if (!ttsReady || engine == null) {
            status.text = "JARVIS replied · Android voice is still loading."
            return
        }
        if (engine.isLanguageAvailable(locale) < TextToSpeech.LANG_AVAILABLE) {
            status.text = "JARVIS replied · This phone has no installed ${language.uppercase(Locale.ROOT)} voice."
            return
        }
        engine.language = locale
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "jarvis-call-${System.currentTimeMillis()}")
    }

    override fun onInit(result: Int) { ttsReady = result == TextToSpeech.SUCCESS }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 4401 && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) startListening()
        else if (requestCode == 4401) status.text = "Microphone permission is required for voice chat."
    }

    private fun finishCall() {
        callEnded = true
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        tts?.stop()
        finish()
    }

    override fun onDestroy() {
        callEnded = true
        recognizer?.destroy()
        tts?.stop()
        tts?.shutdown()
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
