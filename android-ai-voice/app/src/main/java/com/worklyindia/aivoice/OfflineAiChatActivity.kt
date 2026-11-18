package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
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
    private val modelManager by lazy { QwenModelManager(this) }
    private lateinit var qwenModelPicker: Spinner
    private lateinit var downloadModelButton: Button
    private var selectedQwenModel: QwenModelManager.Model? = null
    private val kokoroModelManager by lazy { KokoroModelManager(this) }
    private val speechPackManager by lazy { SpeechPackDownloadManager(this) }
    private val engine by lazy { OfflineAiEngine() }
    private var kokoroEngine: KokoroSpeechEngine? = null
    private var tinyTtsEngine: IndicTinyTtsEngine? = null
    private var activeAudioRecord: AudioRecord? = null
    @Volatile private var offlineRecording = false
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
    private lateinit var speechEnginePicker: Spinner
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
        qwenModelPicker = Spinner(this).apply {
            adapter = ArrayAdapter(this@OfflineAiChatActivity, android.R.layout.simple_spinner_dropdown_item, modelManager.models)
            onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
                override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                    selectedQwenModel = modelManager.models[position]
                    sendButton.isEnabled = engine.isLoaded && selectedQwenModel?.let { modelManager.snapshot(it).state == QwenModelManager.State.READY } == true
                }
            }
        }
        root.addView(qwenModelPicker, LinearLayout.LayoutParams(-1, -2))
        downloadModelButton = button("Download selected AI model")
        downloadModelButton.setOnClickListener {
            val selected = selectedQwenModel ?: modelManager.models[0]
            worker.execute {
                try {
                    modelManager.startDownload(selected)
                    runOnUiThread { status.text = "Downloading ${selected.title} over Wi-Fi. Check notification for progress." }
                } catch (error: Exception) {
                    runOnUiThread { status.text = error.message ?: "Could not start model download." }
                }
            }
        }
        root.addView(downloadModelButton, LinearLayout.LayoutParams(-1, dp(48)))
        languagePicker = Spinner(this).apply {
            adapter = ArrayAdapter(this@OfflineAiChatActivity, android.R.layout.simple_spinner_dropdown_item, languages)
        }
        root.addView(languagePicker, LinearLayout.LayoutParams(-1, -2))
        speechEnginePicker = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@OfflineAiChatActivity,
                android.R.layout.simple_spinner_dropdown_item,
                listOf("Android speech service", "AI4Bharat IndicConformer · offline", "Shruti ONNX · offline")
            )
        }
        root.addView(speechEnginePicker, LinearLayout.LayoutParams(-1, -2))

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
        micButton.setOnClickListener { if (offlineRecording) stopOfflineVoiceInput() else startVoiceInput() }
        actions.addView(micButton, LinearLayout.LayoutParams(0, dp(52), 1f).apply { rightMargin = dp(6) })
        sendButton = button("Send")
        sendButton.isEnabled = false
        sendButton.setOnClickListener { sendPrompt() }
        actions.addView(sendButton, LinearLayout.LayoutParams(0, dp(52), 1f).apply { leftMargin = dp(6) })
        root.addView(actions)

        root.addView(text(
            "Select Android speech or a downloaded offline model. IndicConformer and Shruti recognize speech locally; choose Hindi or Gujarati and install the pack from Downloads first.",
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
                val recommended = modelManager.recommendedModel(memoryInfo.availMem)
                val chosen = selectedQwenModel ?: recommended
                runOnUiThread {
                    val index = modelManager.models.indexOf(chosen)
                    if (index >= 0 && qwenModelPicker.selectedItemPosition != index) qwenModelPicker.setSelection(index)
                    status.text = "Available RAM: %.1f GB · Recommended: ${recommended.title}".format(java.util.Locale.US, memoryInfo.availMem / 1_000_000_000.0)
                }
                check(modelManager.snapshot(chosen).state == QwenModelManager.State.READY) {
                    "${chosen.title} is not downloaded. Select a model and tap Download selected AI model."
                }
                check(memoryInfo.availMem >= chosen.minFreeRam) {
                    "Not enough free RAM for ${chosen.title}. Choose a smaller Qwen model or close other apps."
                }
                check(engine.loadModel(modelManager.file(chosen))) {
                    "Qwen could not load. Free memory may be insufficient; try a smaller model."
                }
                runOnUiThread {
                    status.text = "Ready · ${chosen.title} running locally"
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
        when (speechEnginePicker.selectedItemPosition) {
            1 -> { startOfflineVoiceInput(shruti = false); return }
            2 -> { startOfflineVoiceInput(shruti = true); return }
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

    private fun startOfflineVoiceInput(shruti: Boolean) {
        val language = when {
            selectedLanguage().tag.startsWith("hi") -> "hi"
            selectedLanguage().tag.startsWith("gu") -> "gu"
            else -> {
                status.text = "Downloaded offline IndicConformer/Shruti packs support Hindi and Gujarati. Choose one of those languages."
                return
            }
        }
        val pack = if (shruti) SpeechModelCatalog.shruti(language) else SpeechModelCatalog.indicConformer(language)
        if (!OfflineSpeechEngineFactory.isReady(this, pack)) {
            status.text = "${pack.title} is not installed. Open Model Downloads and download this language pack first."
            return
        }
        val minBuffer = AudioRecord.getMinBufferSize(
            OfflineSpeechRecognizer.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBuffer <= 0) {
            status.text = "This phone does not support 16 kHz microphone recording."
            return
        }
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        offlineRecording = true
        micButton.text = "■ Stop recording"
        status.text = "Recording offline in ${selectedLanguage().label}. Tap Stop when finished (maximum 60 seconds)."
        worker.execute {
            var recorder: AudioRecord? = null
            var speech: OfflineSpeechRecognizer? = null
            try {
                speech = if (shruti) OfflineSpeechEngineFactory.openShruti(this, language)
                    else OfflineSpeechEngineFactory.openIndicConformer(this, language)
                val audio = AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    OfflineSpeechRecognizer.SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    maxOf(minBuffer * 2, 8192)
                )
                recorder = audio
                check(audio.state == AudioRecord.STATE_INITIALIZED) { "Could not initialize microphone." }
                activeAudioRecord = audio
                audio.startRecording()
                val buffer = ShortArray(4096)
                val samples = ArrayList<Float>(OfflineSpeechRecognizer.SAMPLE_RATE * 15)
                val maxSamples = OfflineSpeechRecognizer.SAMPLE_RATE * 60
                while (offlineRecording && samples.size < maxSamples) {
                    val count = audio.read(buffer, 0, buffer.size)
                    if (count > 0) for (i in 0 until count) samples.add(buffer[i] / 32768.0f)
                    else if (count < 0) throw IllegalStateException("Microphone read failed ($count).")
                }
                offlineRecording = false
                runCatching { if (audio.recordingState == AudioRecord.RECORDSTATE_RECORDING) audio.stop() }
                check(samples.isNotEmpty()) { "No audio was recorded. Tap Voice and speak." }
                runOnUiThread { status.text = "Transcribing locally with ${pack.title}…" }
                val result = speech.transcribe(samples.toFloatArray())
                runOnUiThread {
                    if (result.isNotBlank()) {
                        promptInput.setText(result)
                        promptInput.setSelection(promptInput.text.length)
                        status.text = "Offline speech recognized. Tap Send to ask Workly AI."
                    } else status.text = "No speech recognized. Speak clearly and try again."
                    micButton.text = "🎙 Voice"
                    micButton.isEnabled = true
                }
            } catch (error: Exception) {
                runOnUiThread {
                    status.text = error.message ?: "Offline speech recognition failed."
                    micButton.text = "🎙 Voice"
                    micButton.isEnabled = true
                }
            } finally {
                offlineRecording = false
                activeAudioRecord = null
                runCatching { recorder?.release() }
                runCatching { speech?.close() }
            }
        }
    }

    private fun stopOfflineVoiceInput() {
        offlineRecording = false
        runCatching {
            activeAudioRecord?.let { if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) it.stop() }
        }
        micButton.isEnabled = false
        status.text = "Stopping microphone and transcribing…"
    }

    private fun speakAnswer(value: String) {
        val language = selectedLanguage()
        val code = when {
            language.tag.startsWith("hi") -> "hi"
            language.tag.startsWith("gu") -> "gu"
            else -> "en"
        }
        val tinyPack = SpeechModelCatalog.indicTinyTts(code)
        val tinyReady = runCatching { speechPackManager.snapshot(tinyPack).state == SpeechPackDownloadManager.State.COMPLETE }.getOrDefault(false)
        if (tinyReady) {
            status.text = "Generating reply with downloaded Indic Tiny TTS…"
            worker.execute {
                try {
                    tinyTtsEngine?.close()
                    val tiny = IndicTinyTtsEngine.create(this, code)
                    tinyTtsEngine = tiny
                    tiny.speak(value)
                    runOnUiThread { status.text = "Reply spoken with downloaded Indic Tiny TTS." }
                } catch (error: Exception) {
                    runOnUiThread { status.text = "Downloaded Indic Tiny TTS failed: ${error.message ?: "inference error"}. No fallback voice was substituted." }
                }
            }
            return
        }
        val isKokoroLanguage = code == "hi" || code == "en"
        if (isKokoroLanguage && runCatching { kokoroModelManager.snapshot().state == KokoroModelManager.State.READY }.getOrDefault(false)) {
            status.text = "Generating speech with downloaded Kokoro…"
            worker.execute {
                try {
                    val kokoro = kokoroEngine ?: KokoroSpeechEngine.create(this, kokoroModelManager.modelFile).also { kokoroEngine = it }
                    val voiceId = if (code == "hi") KokoroSpeechEngine.HINDI_VOICE else KokoroSpeechEngine.ENGLISH_US_VOICE
                    kokoro.speak(value, voiceId)
                    runOnUiThread { status.text = "Spoken with downloaded Kokoro voice." }
                } catch (error: Exception) {
                    runOnUiThread { status.text = "Downloaded Kokoro failed: ${error.message ?: "engine error"}. Android TTS was not substituted." }
                }
            }
            return
        }
        val voice = tts
        if (!ttsReady || voice == null) {
            status.text = "Speech output is not ready. Download the selected Indic Tiny TTS pack."
            return
        }
        if (voice.isLanguageAvailable(language.locale) >= TextToSpeech.LANG_AVAILABLE) {
            voice.setLanguage(language.locale)
            voice.speak(value, TextToSpeech.QUEUE_FLUSH, null, "workly-chat-${System.currentTimeMillis()}")
            status.text = "Using installed Android TTS. Download Indic Tiny TTS to use its offline voice."
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
        offlineRecording = false
        activeAudioRecord?.let { runCatching { it.stop() }; it.release() }
        recognizer?.destroy()
        tts?.stop()
        tts?.shutdown()
        worker.execute { engine.unload() }
        worker.shutdown()
        kokoroEngine?.close()
        tinyTtsEngine?.close()
        super.onDestroy()
    }

    companion object { private const val REQUEST_AUDIO = 5101 }
}
