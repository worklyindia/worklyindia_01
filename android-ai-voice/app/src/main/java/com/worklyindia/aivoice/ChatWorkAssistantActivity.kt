package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.TextToSpeech.QUEUE_FLUSH
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.max

/** On-device, push-to-talk assistant. Continuous wake-word listening is a separate opt-in service. */
class ChatWorkAssistantActivity : Activity(), TextToSpeech.OnInitListener {
    private data class Language(val label: String, val code: String, val locale: Locale) {
        override fun toString() = label
    }

    private val languages = listOf(
        Language("Hindi · हिन्दी", "hi", Locale.forLanguageTag("hi-IN")),
        Language("Gujarati · ગુજરાતી", "gu", Locale.forLanguageTag("gu-IN")),
        Language("English · India", "en", Locale.forLanguageTag("en-IN"))
    )
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val modelManager by lazy { QwenModelManager(this) }
    private val speechManager by lazy { SpeechPackDownloadManager(this) }
    private val ai = OfflineAiEngine()
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var activeRecorder: AudioRecord? = null
    @Volatile private var recording = false
    private val conversation = StringBuilder()
    private lateinit var transcript: TextView
    private lateinit var status: TextView
    private lateinit var message: EditText
    private lateinit var languagePicker: Spinner
    private lateinit var sendButton: Button
    private lateinit var micButton: Button
    private var modelReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ChatWorkTheme.applyWindow(this)
        tts = TextToSpeech(this, this)
        buildUi()
        loadBestAvailableModel()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(10), dp(16), dp(14))
            setBackgroundColor(0xFFF4F7FB.toInt())
        }
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        header.addView(TextView(this).apply {
            text = "‹"; textSize = 34f; gravity = Gravity.CENTER; setTextColor(0xFF142033.toInt())
            contentDescription = "Back"; setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(42), dp(48)))
        header.addView(TextView(this).apply {
            text = "ChatWork AI Assistant"; textSize = 20f; setTextColor(0xFF142033.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        root.addView(header)
        status = TextView(this).apply {
            text = "Checking downloaded offline AI models…"; textSize = 13f
            setTextColor(0xFF52647A.toInt()); setPadding(dp(4), dp(8), dp(4), dp(10))
        }
        root.addView(status)
        languagePicker = Spinner(this).apply {
            adapter = ArrayAdapter(this@ChatWorkAssistantActivity, android.R.layout.simple_spinner_dropdown_item, languages)
            setSelection(0)
        }
        root.addView(languagePicker, LinearLayout.LayoutParams(-1, dp(48)))
        val scroll = ScrollView(this)
        transcript = TextView(this).apply {
            text = "ChatWork: Download an offline AI model and a matching speech-to-text model from Download Models.\n"
            textSize = 16f; setTextColor(0xFF142033.toInt()); setTextIsSelectable(true)
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }
        scroll.addView(transcript)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        message = EditText(this).apply {
            hint = "Message ChatWork…"; minLines = 2; maxLines = 4; textSize = 16f
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        root.addView(message, LinearLayout.LayoutParams(-1, -2))
        sendButton = Button(this).apply {
            text = "Send"; isAllCaps = false
            setOnClickListener { sendMessage() }
        }
        root.addView(sendButton, LinearLayout.LayoutParams(-1, dp(48)))
        micButton = Button(this).apply {
            text = "🎙  Start speaking"; isAllCaps = false
            setOnClickListener { if (recording) stopRecording() else startRecording() }
        }
        root.addView(micButton, LinearLayout.LayoutParams(-1, dp(48)))
        root.addView(Button(this).apply {
            text = "Stop voice"; isAllCaps = false
            setOnClickListener { tts?.stop() }
        }, LinearLayout.LayoutParams(-1, dp(44)))
        setContentView(root)
    }

    private fun loadBestAvailableModel() {
        worker.execute {
            try {
                val memory = ActivityManager.MemoryInfo()
                (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
                val model = modelManager.models
                    .filter { modelManager.snapshot(it).state == QwenModelManager.State.READY }
                    .filter { modelManager.isSupported(it, memory.availMem) }
                    .maxByOrNull { it.size }
                if (model == null) {
                    main.post { status.text = "No compatible downloaded AI model. Open Download Models and download a supported Qwen model." }
                    return@execute
                }
                val loaded = ai.loadModel(modelManager.file(model))
                modelReady = loaded
                main.post {
                    status.text = if (loaded) "Offline AI ready · ${model.title}" else "Could not load ${model.title}. Free memory and retry."
                }
            } catch (error: Exception) {
                main.post { status.text = "Offline AI unavailable: ${error.message ?: "model load failed"}" }
            }
        }
    }

    private fun sendMessage() {
        val question = message.text?.toString()?.trim().orEmpty()
        if (question.isBlank()) { message.error = "Enter a message"; return }
        if (!modelReady) { status.text = "Download and activate a compatible Qwen model first."; return }
        message.setText("")
        append("You: $question")
        sendButton.isEnabled = false
        status.text = "Thinking offline…"
        worker.execute {
            try {
                conversation.append("User: ").append(question).append("\n")
                val prompt = conversation.takeLast(MAX_HISTORY_CHARS)
                val answer = ai.generate(prompt) { partial ->
                    main.post { status.text = "Thinking… ${partial.takeLast(100)}" }
                }
                conversation.append("Assistant: ").append(answer).append("\n")
                main.post {
                    append("ChatWork: $answer")
                    status.text = "Offline answer ready."
                    sendButton.isEnabled = true
                    if (ttsReady) tts?.speak(answer, QUEUE_FLUSH, null, "chatwork-answer")
                }
            } catch (error: Exception) {
                main.post {
                    status.text = "AI error: ${error.message ?: "Try again."}"
                    sendButton.isEnabled = true
                }
            }
        }
    }

    private fun startRecording() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
            return
        }
        if (!modelReady) { status.text = "Download a compatible Qwen AI model first."; return }
        val language = languages[languagePicker.selectedItemPosition]
        val pack = SpeechModelCatalog.indicConformer(language.code)
        worker.execute {
            try {
                if (speechManager.snapshot(pack).state != SpeechPackDownloadManager.State.COMPLETE) {
                    main.post { status.text = "Download IndicConformer · ${language.label} in Download Models first." }
                    return@execute
                }
                val minBytes = AudioRecord.getMinBufferSize(
                    OfflineSpeechRecognizer.SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )
                check(minBytes > 0) { "Microphone audio format is not supported." }
                val recorder = AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    OfflineSpeechRecognizer.SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    max(minBytes, 6400)
                )
                check(recorder.state == AudioRecord.STATE_INITIALIZED) { "Could not start the microphone." }
                activeRecorder = recorder
                val chunks = ArrayList<FloatArray>()
                val buffer = ShortArray(1600)
                var totalSamples = 0
                recording = true
                recorder.startRecording()
                main.post {
                    micButton.text = "■  Stop speaking"
                    status.text = "Listening… Tap Stop speaking when you finish (max 30 seconds)."
                }
                while (recording && totalSamples < MAX_RECORD_SECONDS * OfflineSpeechRecognizer.SAMPLE_RATE) {
                    val count = recorder.read(buffer, 0, buffer.size)
                    if (count > 0) {
                        val floats = FloatArray(count) { buffer[it] / 32768.0f }
                        chunks.add(floats)
                        totalSamples += count
                    }
                }
                runCatching { recorder.stop() }
                recorder.release()
                activeRecorder = null
                recording = false
                main.post { micButton.text = "🎙  Start speaking"; status.text = "Converting speech offline…" }
                if (totalSamples == 0) throw IllegalStateException("No speech was recorded.")
                val samples = FloatArray(totalSamples)
                var offset = 0
                chunks.forEach { it.copyInto(samples, offset); offset += it.size }
                OfflineSpeechEngineFactory.openIndicConformer(this, language.code).use { recognizer ->
                    val text = recognizer.transcribe(samples)
                    main.post {
                        if (text.isBlank()) status.text = "No speech recognized. Try again."
                        else { message.setText(text); status.text = "Speech converted offline. Tap Send." }
                    }
                }
            } catch (error: Exception) {
                recording = false
                activeRecorder?.let { runCatching { it.release() } }
                activeRecorder = null
                main.post {
                    micButton.text = "🎙  Start speaking"
                    status.text = "Microphone / speech error: ${error.message ?: "Try again."}"
                }
            }
        }
    }

    private fun stopRecording() {
        recording = false
        activeRecorder?.let { runCatching { it.stop() } }
        micButton.text = "🎙  Start speaking"
        status.text = "Stopping microphone…"
    }

    private fun append(line: String) {
        transcript.append("\n$line\n")
    }

    override fun onInit(result: Int) {
        ttsReady = result == TextToSpeech.SUCCESS
        if (ttsReady) {
            val lang = languages.getOrNull(languagePicker.selectedItemPosition) ?: languages.first()
            tts?.language = lang.locale
        }
    }

    override fun onDestroy() {
        recording = false
        activeRecorder?.let { runCatching { it.stop() }; runCatching { it.release() } }
        activeRecorder = null
        worker.execute { runCatching { ai.unload() } }
        worker.shutdown()
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_MIC && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) startRecording()
        else if (requestCode == REQUEST_MIC) status.text = "Microphone permission is required only when you tap Start speaking."
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val REQUEST_MIC = 5102
        private const val MAX_RECORD_SECONDS = 30
        private const val MAX_HISTORY_CHARS = 2500
    }
}
