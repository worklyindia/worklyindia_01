package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import android.os.Build
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import java.util.Locale
import java.util.concurrent.Executors

class VoiceActivity : Activity(), TextToSpeech.OnInitListener {
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
    private lateinit var offlineSpeechEnginePicker: Spinner
    private lateinit var pairingCodeInput: EditText
    private lateinit var relayStatusText: TextView
    private var tinyTtsEngine: IndicTinyTtsEngine? = null
    private val tinyTtsExecutor = Executors.newSingleThreadExecutor()
    private lateinit var speechPackStatusText: TextView
    private val speechPackManager by lazy { SpeechPackDownloadManager(this) }
    private val relayExecutor = Executors.newSingleThreadExecutor()
    private val offlineSpeechExecutor = Executors.newSingleThreadExecutor()
    @Volatile private var offlineRecording = false
    @Volatile private var activeAudioRecord: AudioRecord? = null
    private var tts: TextToSpeech? = null
    private var recognizer: SpeechRecognizer? = null
    private var ttsReady = false
    private var listening = false
    private var downloadNetworkChoiceShowing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val dark = isSystemDarkMode()

        // Keep Android's normal status bar (time, signal, data and battery) visible.
        // Clear any fullscreen/immersive window flag and let the system reserve its inset.
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(true)
        }
        window.statusBarColor = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
        window.navigationBarColor = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
        if (Build.VERSION.SDK_INT >= 23) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (dark) 0 else
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
        buildScreen()
        tts = TextToSpeech(this, this)
        updateSpeechAvailability()
    }

    private fun buildScreen() {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(24))
            setBackgroundColor(adaptColor(0xFFF4F7FB.toInt()))
        }
        val scroll = ScrollView(this).apply { addView(page) }
        page.addView(label("WORKLY INDIA", 12, 0xFF2878D0.toInt(), true))
        page.addView(label("ChatWork", 28, 0xFF142033.toInt(), true).also {
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
            adapter = ArrayAdapter(this@VoiceActivity, android.R.layout.simple_spinner_dropdown_item, languages)
        }
        page.addView(languagePicker, matchWrap())
        inputText = EditText(this).apply {
            hint = "Type Hindi, English or Gujarati text…"
            minLines = 3
            maxLines = 6
            gravity = Gravity.TOP or Gravity.START
            setTextColor(adaptColor(0xFF142033.toInt()))
            setHintTextColor(adaptColor(0xFF8491A3.toInt()))
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(adaptColor(0xFFFFFFFF.toInt()))
        }
        page.addView(inputText, matchWrap().also { it.topMargin = dp(10) })
        val speakButton = button("▶  Speak text")
        speakButton.setOnClickListener { speakText() }
        page.addView(speakButton, matchWrap().also { it.topMargin = dp(10) })
        page.addView(button("■  Stop voice").apply {
            setBackgroundColor(adaptColor(0xFFE8EDF4.toInt()))
            setTextColor(adaptColor(0xFF26364B.toInt()))
            setOnClickListener { tts?.stop(); tinyTtsEngine?.stop(); setStatus("Voice playback stopped.") }
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
            setTextColor(adaptColor(0xFF142033.toInt()))
            setHintTextColor(adaptColor(0xFF8491A3.toInt()))
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(adaptColor(0xFFFFFFFF.toInt()))
        }
        page.addView(transcriptText, matchWrap().also { it.topMargin = dp(10) })
        page.addView(label(
            "Choose the speech engine. Android provider may require internet; downloaded Sherpa engines run locally.",
            12, 0xFF65748B.toInt(), false
        ).also { it.setPadding(0, dp(10), 0, 0) })
        offlineSpeechEnginePicker = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@VoiceActivity,
                android.R.layout.simple_spinner_dropdown_item,
                listOf("AI4Bharat IndicConformer INT8 · offline")
            )
        }
        page.addView(offlineSpeechEnginePicker, matchWrap().also { it.topMargin = dp(8) })
        val offlineSpeechCard = card()
        offlineSpeechCard.addView(label("Offline Hindi / English / Gujarati recognition", 16, 0xFF142033.toInt(), true))
        speechPackStatusText = label("Optional model packs are not downloaded.", 12, 0xFF536276.toInt(), false)
        offlineSpeechCard.addView(speechPackStatusText)
        offlineSpeechCard.addView(button("Download selected language · IndicConformer").apply {
            setOnClickListener { downloadSelectedSpeechPack() }
        }, matchWrap().also { it.topMargin = dp(8) })
        offlineSpeechCard.addView(label(
            "Choose Hindi, English or Gujarati above first. Downloads use your saved Wi-Fi/mobile-data permission. Once downloaded, Start listening uses this offline engine.",
            12, 0xFF65748B.toInt(), false
        ).also { it.setPadding(0, dp(8), 0, 0) })
        page.addView(offlineSpeechCard)

        page.addView(space(22))

        page.addView(space(10))
        page.addView(label("CHATWORK · VERSION 1.0.0", 11, 0xFF8491A3.toInt(), true).also {
            it.gravity = Gravity.CENTER
        })
        setContentView(scroll)
    }



    private fun requestNotificationAndStart() {
        if (SecureDeviceTokenStore.read(this).isNullOrBlank()) {
            relayStatusText.text = "Pair this phone first using a Workly website pairing code."
            return
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            return
        }
        startRelayService()
    }

    private fun startRelayService() {
        val intent = Intent(this, VoiceRelayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
        relayStatusText.text = "Starting secure phone server…"
    }

    private fun refreshRelayStatus() {
        relayStatusText.text = getSharedPreferences(VoiceRelayService.STATUS_PREFS, MODE_PRIVATE)
            .getString(VoiceRelayService.STATUS_KEY, "Phone server is stopped.")
    }

    private fun speakText() {
        val text = inputText.text?.toString()?.trim().orEmpty()
        if (text.isEmpty()) { inputText.error = "Enter text to speak"; return }
        val lang = selectedLanguage()
        val code = when {
            lang.tag.startsWith("hi") -> "hi"
            lang.tag.startsWith("gu") -> "gu"
            else -> "en"
        }
        val tinyPack = SpeechModelCatalog.indicTinyTts(code)
        val tinyReady = runCatching { speechPackManager.snapshot(tinyPack).state == SpeechPackDownloadManager.State.COMPLETE }.getOrDefault(false)
        if (tinyReady) {
            setStatus("Loading downloaded Indic Tiny TTS for ${lang.label}…")
            tinyTtsExecutor.execute {
                try {
                    tinyTtsEngine?.close()
                    val engine = IndicTinyTtsEngine.create(this, code)
                    tinyTtsEngine = engine
                    engine.speak(text, "female")
                    runOnUiThread { setStatus("Speech generated by downloaded Indic Tiny TTS (${code.uppercase()}).") }
                } catch (error: Exception) {
                    runOnUiThread { setStatus("Downloaded Indic Tiny TTS failed: ${error.message ?: "inference error"}. No other voice was substituted.") }
                }
            }
            return
        }
        speakWithAndroidTts(text, lang, "Offline model is not downloaded for this language; using the installed Android voice.")
    }

    private fun speakWithAndroidTts(text: String, lang: VoiceLanguage, prefix: String? = null) {
        val engine = tts
        if (!ttsReady || engine == null) { setStatus("Text-to-speech engine is still loading."); return }
        if (engine.isLanguageAvailable(lang.locale) < TextToSpeech.LANG_AVAILABLE) {
            setStatus("Installed voice engine does not support ${lang.label}. Install this voice in Android text-to-speech settings."); return
        }
        engine.setLanguage(lang.locale)
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "workly-${System.currentTimeMillis()}")
        setStatus("${prefix?.let { "$it " } ?: ""}Speaking ${lang.label}…")
    }

    private fun selectedSpeechLanguageCode(): String = when {
        selectedLanguage().tag.startsWith("hi") -> "hi"
        selectedLanguage().tag.startsWith("en") -> "en"
        selectedLanguage().tag.startsWith("gu") -> "gu"
        else -> error("Select Hindi, English or Gujarati.")
    }

    private fun downloadSelectedSpeechPack() {
        val language = runCatching { selectedSpeechLanguageCode() }.getOrElse {
            setStatus(it.message ?: "Select a supported language.")
            return
        }
        val pack = runCatching { SpeechModelCatalog.indicConformer(language) }.getOrElse {
            setStatus(it.message ?: "Could not prepare speech model.")
            return
        }
        requestDownloadNetworkChoice { allowMobile ->
            runCatching {
                val snapshot = speechPackManager.start(pack, allowMobile)
                speechPackStatusText.text = "${pack.title} · ${language.uppercase()} · ${snapshot.state} · about ${snapshot.totalBytes / 1_000_000} MB"
                setStatus("Offline speech model download queued.")
            }.onFailure {
                speechPackStatusText.text = it.message ?: "Speech model download failed to start."
            }
        }
    }

    private fun requestDownloadNetworkChoice(action: (Boolean) -> Unit) {
        val prefs = getSharedPreferences(DOWNLOAD_PREFS, MODE_PRIVATE)
        if (prefs.contains(KEY_ALLOW_MOBILE_DATA)) {
            action(prefs.getBoolean(KEY_ALLOW_MOBILE_DATA, false))
            return
        }
        if (downloadNetworkChoiceShowing) return
        downloadNetworkChoiceShowing = true
        AlertDialog.Builder(this)
            .setTitle("Allow mobile data for speech downloads?")
            .setMessage("Speech model downloads can use a large amount of data. Choose Wi-Fi only to avoid mobile data charges.")
            .setNegativeButton("Wi-Fi only") { _, _ ->
                prefs.edit().putBoolean(KEY_ALLOW_MOBILE_DATA, false).apply()
                downloadNetworkChoiceShowing = false
                action(false)
            }
            .setPositiveButton("Allow mobile data") { _, _ ->
                prefs.edit().putBoolean(KEY_ALLOW_MOBILE_DATA, true).apply()
                downloadNetworkChoiceShowing = false
                action(true)
            }
            .setOnCancelListener { downloadNetworkChoiceShowing = false }
            .show()
    }

    private fun refreshSpeechPackStatus() {
        if (!::speechPackStatusText.isInitialized) return
        val language = runCatching { selectedSpeechLanguageCode() }.getOrNull() ?: return
        val pack = SpeechModelCatalog.indicConformer(language)
        val snapshot = speechPackManager.snapshot(pack)
        speechPackStatusText.text = "IndicConformer ${language.uppercase()}: ${snapshot.state} (${snapshot.percent}%)"
    }

    private fun startOfflineListening() {
        val language = when {
            selectedLanguage().tag.startsWith("hi") -> "hi"
            selectedLanguage().tag.startsWith("gu") -> "gu"
            else -> {
                setStatus("Select Hindi, English or Gujarati for offline recognition.")
                return
            }
        }
        val pack = runCatching {
            SpeechModelCatalog.indicConformer(language)
        }.getOrElse {
            setStatus(it.message ?: "Could not select offline speech model.")
            return
        }
        if (!OfflineSpeechEngineFactory.isReady(this, pack)) {
            setStatus("${pack.title} is not fully downloaded yet. Download it below first.")
            return
        }
        val minBuffer = AudioRecord.getMinBufferSize(
            OfflineSpeechRecognizer.SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBuffer <= 0) {
            setStatus("This phone does not support 16 kHz microphone capture.")
            return
        }
        stopListening()
        offlineRecording = true
        listening = true
        listenButton.text = "■  Stop offline listening"
        listenButton.setOnClickListener { stopListening(); setStatus("Stopping offline recording…") }
        offlineSpeechExecutor.execute {
            var recorder: AudioRecord? = null
            var engine: OfflineSpeechRecognizer? = null
            try {
                val speechEngine = OfflineSpeechEngineFactory.openIndicConformer(this, language)
                engine = speechEngine
                val audio = AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    OfflineSpeechRecognizer.SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    maxOf(minBuffer * 2, 8192)
                )
                recorder = audio
                check(audio.state == AudioRecord.STATE_INITIALIZED) { "Could not initialize the microphone." }
                activeAudioRecord = audio
                audio.startRecording()
                runOnUiThread { setStatus("Recording offline in ${selectedLanguage().label}. Tap Stop when finished (maximum 90 seconds).") }
                val buffer = ShortArray(4096)
                val samples = ArrayList<Float>(OfflineSpeechRecognizer.SAMPLE_RATE * 20)
                val maxSamples = OfflineSpeechRecognizer.SAMPLE_RATE * 90
                while (offlineRecording && samples.size < maxSamples) {
                    val count = audio.read(buffer, 0, buffer.size)
                    if (count > 0) {
                        for (i in 0 until count) samples.add(buffer[i] / 32768.0f)
                    } else if (count < 0) {
                        throw IllegalStateException("Microphone read failed ($count).")
                    }
                }
                offlineRecording = false
                runCatching { if (audio.recordingState == AudioRecord.RECORDSTATE_RECORDING) audio.stop() }
                if (samples.isEmpty()) throw IllegalStateException("No audio was recorded.")
                runOnUiThread { setStatus("Transcribing locally with ${pack.title}…") }
                val result = speechEngine.transcribe(samples.toFloatArray())
                runOnUiThread {
                    if (result.isNotBlank()) {
                        transcriptText.setText(result)
                        setStatus("Offline transcription complete · ${pack.title}.")
                    } else setStatus("No speech recognized. Try speaking more clearly.")
                }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Offline speech recognition failed.") }
            } finally {
                offlineRecording = false
                activeAudioRecord = null
                runCatching { recorder?.release() }
                runCatching { engine?.close() }
                listening = false
                runOnUiThread {
                    listenButton.text = "🎙  Start listening"
                    listenButton.setOnClickListener { startListening() }
                }
            }
        }
    }

    private fun startListening() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO)
            return
        }
        when (offlineSpeechEnginePicker.selectedItemPosition) {
            0 -> { startOfflineListening(); return }
        }
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
        offlineRecording = false
        runCatching {
            activeAudioRecord?.let { audio ->
                if (audio.recordingState == AudioRecord.RECORDSTATE_RECORDING) audio.stop()
            }
        }
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
        if (requestCode == REQUEST_NOTIFICATIONS) {
            if (grantResults.firstOrNull() != PackageManager.PERMISSION_GRANTED) {
                relayStatusText.text = "Notification permission denied. Starting service; its notification may be hidden."
            }
            startRelayService()
        }
    }

    override fun onResume() {
        super.onResume()
        if (::relayStatusText.isInitialized) refreshRelayStatus()
        if (::speechPackStatusText.isInitialized) refreshSpeechPackStatus()
    }

    override fun onPause() {
        super.onPause()
        if (listening) stopListening()
    }

    override fun onDestroy() {
        stopListening()
        tts?.stop()
        tts?.shutdown()
        tinyTtsEngine?.close()
        tinyTtsExecutor.shutdownNow()
        relayExecutor.shutdownNow()
        offlineSpeechExecutor.shutdownNow()
        super.onDestroy()
    }

    private fun isSystemDarkMode(): Boolean =
        (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES

    private fun adaptColor(color: Int): Int {
        if (!isSystemDarkMode()) return color
        return when (color) {
            0xFFF4F7FB.toInt(), 0xFFFFFFFF.toInt(), 0xFFE8EDF4.toInt() -> 0xFF1B2636.toInt()
            0xFF142033.toInt(), 0xFF26364B.toInt() -> 0xFFE8EEF7.toInt()
            0xFF65748B.toInt(), 0xFF536276.toInt(), 0xFF8491A3.toInt() -> 0xFFAFBBCB.toInt()
            else -> color
        }
    }

    private fun label(text: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        this.text = text
        textSize = size.toFloat()
        setTextColor(adaptColor(color))
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    private fun sectionTitle(text: String) = label(text, 19, 0xFF142033.toInt(), true).apply {
        setPadding(0, 0, 0, dp(8))
    }
    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(16), dp(16), dp(16))
        setBackgroundColor(adaptColor(0xFFFFFFFF.toInt()))
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

    companion object { private const val REQUEST_AUDIO = 4102; private const val REQUEST_NOTIFICATIONS = 4103; private const val DOWNLOAD_PREFS = "workly_model_download_preferences"; private const val KEY_ALLOW_MOBILE_DATA = "allow_mobile_data" }
}
