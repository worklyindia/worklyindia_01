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
    private lateinit var offlineSpeechEnginePicker: Spinner
    private lateinit var pairingCodeInput: EditText
    private lateinit var relayStatusText: TextView
    private lateinit var offlineModelStatusText: TextView
    private lateinit var offlineModelProgressBar: ProgressBar
    private lateinit var offlineModelActionButton: Button
    private lateinit var offlineModelChatButton: Button
    private val offlineModelManager by lazy { OfflineModelManager(this) }
    private val kokoroModelManager by lazy { KokoroModelManager(this) }
    private var kokoroEngine: KokoroSpeechEngine? = null
    private var tinyTtsEngine: IndicTinyTtsEngine? = null
    private val kokoroExecutor = Executors.newSingleThreadExecutor()
    private lateinit var kokoroModelStatusText: TextView
    private lateinit var kokoroModelProgressBar: ProgressBar
    private lateinit var kokoroModelActionButton: Button
    private lateinit var speechPackStatusText: TextView
    private val speechPackManager by lazy { SpeechPackDownloadManager(this) }
    private var kokoroAutoDownloadAttempted = false
    private var downloadChoicePromptShowing = false
    private val offlineModelHandler = Handler(Looper.getMainLooper())
    private val offlineModelPoll = object : Runnable {
        override fun run() {
            refreshOfflineModelUi()
            val state = runCatching { offlineModelManager.snapshot().state }.getOrNull()
            val kokoroState = runCatching { kokoroModelManager.snapshot().state }.getOrNull()
            if (state == OfflineModelManager.State.RUNNING || state == OfflineModelManager.State.PENDING ||
                state == OfflineModelManager.State.PAUSED || kokoroState == KokoroModelManager.State.RUNNING ||
                kokoroState == KokoroModelManager.State.PENDING || kokoroState == KokoroModelManager.State.PAUSED
            ) offlineModelHandler.postDelayed(this, 1000L)
        }
    }
    private val relayExecutor = Executors.newSingleThreadExecutor()
    private val offlineSpeechExecutor = Executors.newSingleThreadExecutor()
    @Volatile private var offlineRecording = false
    @Volatile private var activeAudioRecord: AudioRecord? = null
    private var tts: TextToSpeech? = null
    private var recognizer: SpeechRecognizer? = null
    private var ttsReady = false
    private var listening = false

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
        // Ask once whether large model downloads may use metered mobile data.
        // The saved choice is reused for Qwen and the later Kokoro download.
        offlineModelHandler.postDelayed({ ensureAutomaticOfflineModelDownload() }, 1200L)
    }

    private fun buildScreen() {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(24))
            setBackgroundColor(adaptColor(0xFFF4F7FB.toInt()))
        }
        val scroll = ScrollView(this).apply { addView(page) }
        page.addView(label("WORKLY INDIA", 12, 0xFF2878D0.toInt(), true))
        page.addView(label("Workly Voice", 28, 0xFF142033.toInt(), true).also {
            it.setPadding(0, dp(5), 0, dp(4))
        })
        page.addView(label("Hindi · English · Gujarati", 15, 0xFF65748B.toInt(), false))
        val quickActions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        quickActions.addView(button("Model downloads").apply {
            setOnClickListener { startActivity(Intent(this@MainActivity, SpeechDownloadsActivity::class.java)) }
        }, LinearLayout.LayoutParams(0, dp(48), 1f).also { it.rightMargin = dp(6) })
        quickActions.addView(button("Offline AI Chat").apply {
            setOnClickListener { startActivity(Intent(this@MainActivity, OfflineAiChatActivity::class.java)) }
        }, LinearLayout.LayoutParams(0, dp(48), 1f).also { it.leftMargin = dp(6) })
        page.addView(quickActions, matchWrap().also { it.topMargin = dp(12) })
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
            setOnClickListener { tts?.stop(); kokoroEngine?.stop(); tinyTtsEngine?.stop(); setStatus("Voice playback stopped.") }
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
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                listOf("Android speech provider", "AI4Bharat IndicConformer INT8 · offline", "Shruti ONNX · offline")
            )
        }
        page.addView(offlineSpeechEnginePicker, matchWrap().also { it.topMargin = dp(8) })
        val offlineSpeechCard = card()
        offlineSpeechCard.addView(label("Offline Hindi / Gujarati recognition", 16, 0xFF142033.toInt(), true))
        speechPackStatusText = label("Optional model packs are not downloaded.", 12, 0xFF536276.toInt(), false)
        offlineSpeechCard.addView(speechPackStatusText)
        offlineSpeechCard.addView(button("Download AI4Bharat IndicConformer INT8").apply {
            setOnClickListener { downloadSelectedSpeechPack(shruti = false) }
        }, matchWrap().also { it.topMargin = dp(8) })
        offlineSpeechCard.addView(button("Download Shruti ONNX").apply {
            setOnClickListener { downloadSelectedSpeechPack(shruti = true) }
        }, matchWrap().also { it.topMargin = dp(8) })
        offlineSpeechCard.addView(label(
            "Choose Hindi or Gujarati above first. Downloads use your saved Wi-Fi/mobile-data permission. The Android online/offline provider remains the active microphone path until native audio capture is connected and tested.",
            12, 0xFF65748B.toInt(), false
        ).also { it.setPadding(0, dp(8), 0, 0) })
        page.addView(offlineSpeechCard)

        page.addView(space(22))

        page.addView(space(22))
        page.addView(sectionTitle("3. Offline Workly AI"))
        val offlineCard = card()
        offlineCard.addView(label("Qwen2.5-3B-Instruct · Q4_K_M", 16, 0xFF142033.toInt(), true))
        offlineCard.addView(label(
            "Automatic first-launch download · about 2.1 GB. Wi-Fi or mobile data can be used based on your saved choice. The model stays in app storage, not inside the APK.",
            12, 0xFF536276.toInt(), false
        ).also { it.setPadding(0, dp(7), 0, dp(10)) })
        offlineModelStatusText = label("Checking offline model…", 13, 0xFF174B36.toInt(), true)
        offlineCard.addView(offlineModelStatusText)
        offlineModelProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            visibility = View.GONE
        }
        offlineCard.addView(offlineModelProgressBar, matchWrap().also { it.topMargin = dp(10) })
        offlineModelActionButton = button("Automatic download")
        offlineModelActionButton.setOnClickListener { onOfflineModelAction() }
        offlineCard.addView(offlineModelActionButton, matchWrap().also { it.topMargin = dp(10) })
        offlineModelChatButton = button("Open offline AI chat").apply {
            isEnabled = false
            setOnClickListener { startActivity(Intent(this@MainActivity, OfflineAiChatActivity::class.java)) }
        }
        offlineCard.addView(offlineModelChatButton, matchWrap().also { it.topMargin = dp(8) })
        offlineCard.addView(label(
            "After the model is downloaded, open Offline AI Chat to run Qwen on this phone. Chat runs locally. Voice input asks Android for offline speech recognition; offline language packs must be installed. Voice playback uses the installed Android TTS voice.",
            12, 0xFF65748B.toInt(), false
        ).also { it.setPadding(0, dp(10), 0, 0) })
        page.addView(offlineCard)

        val kokoroCard = card()
        kokoroCard.addView(label("Kokoro 82M · Hindi + English", 16, 0xFF142033.toInt(), true))
        kokoroCard.addView(label("Automatic download · about 295 MB. Wi-Fi or approved mobile data can be used. Kokoro provides on-device Hindi and English speech. Gujarati uses the Android voice until Indic Tiny TTS is integrated.", 12, 0xFF536276.toInt(), false).also { it.setPadding(0, dp(7), 0, dp(10)) })
        kokoroModelStatusText = label("Waiting for Qwen download to finish…", 13, 0xFF174B36.toInt(), true)
        kokoroCard.addView(kokoroModelStatusText)
        kokoroModelProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE }
        kokoroCard.addView(kokoroModelProgressBar, matchWrap().also { it.topMargin = dp(10) })
        kokoroModelActionButton = button("Automatic download")
        kokoroModelActionButton.setOnClickListener { onKokoroModelAction() }
        kokoroCard.addView(kokoroModelActionButton, matchWrap().also { it.topMargin = dp(10) })
        page.addView(kokoroCard)

        page.addView(space(22))
        page.addView(sectionTitle("4. Connect this phone as a voice server"))
        val relayCard = card()
        relayCard.addView(label("Secure Workly phone pairing", 16, 0xFF142033.toInt(), true))
        relayCard.addView(label(
            "Sign in to Workly India on the website, open AI Voice Server, generate a one-time pairing code, then enter it below. The code expires after 5 minutes and can be used once.",
            12, 0xFF536276.toInt(), false
        ).also { it.setPadding(0, dp(7), 0, dp(10)) })
        pairingCodeInput = EditText(this).apply {
            hint = "24-character pairing code"
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            setTextColor(adaptColor(0xFF142033.toInt()))
            setHintTextColor(adaptColor(0xFF8491A3.toInt()))
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(adaptColor(0xFFF4F7FB.toInt()))
        }
        relayCard.addView(pairingCodeInput, matchWrap())
        relayCard.addView(button("Pair this phone securely").apply {
            setOnClickListener { pairPhone() }
        }, matchWrap().also { it.topMargin = dp(10) })
        relayStatusText = label(
            getSharedPreferences(VoiceRelayService.STATUS_PREFS, MODE_PRIVATE)
                .getString(VoiceRelayService.STATUS_KEY, "Phone is not paired.") ?: "Phone is not paired.",
            13, 0xFF174B36.toInt(), true
        ).also { it.setPadding(0, dp(14), 0, dp(8)) }
        relayCard.addView(relayStatusText)
        relayCard.addView(button("Start phone server").apply {
            setOnClickListener { requestNotificationAndStart() }
        }, matchWrap())
        relayCard.addView(button("Stop phone server").apply {
            setBackgroundColor(adaptColor(0xFFE8EDF4.toInt()))
            setTextColor(adaptColor(0xFF26364B.toInt()))
            setOnClickListener {
                stopService(Intent(this@MainActivity, VoiceRelayService::class.java))
                refreshRelayStatus()
            }
        }, matchWrap().also { it.topMargin = dp(8) })
        relayCard.addView(label(
            "The phone makes outbound HTTPS connections, so Jio mobile CGNAT does not need an incoming port. Keep this foreground service notification visible while the phone is serving. The service holds a partial wake lock to keep its relay polling responsive, which can increase battery use. On Android 15 and newer, data-sync foreground services have a 6-hour total limit per 24 hours; after that Android stops this server until you open the app again. Website TTS jobs currently play on this phone; remote audio-file STT and audio-file return are not ready yet.",
            12, 0xFF536276.toInt(), false
        ).also { it.setPadding(0, dp(10), 0, 0) })
        page.addView(relayCard)
        page.addView(space(10))
        page.addView(label("WORKLY VOICE · VERSION 1.0.0", 11, 0xFF8491A3.toInt(), true).also {
            it.gravity = Gravity.CENTER
        })
        setContentView(scroll)
    }



    private fun ensureAutomaticOfflineModelDownload() {
        if (!::offlineModelStatusText.isInitialized) return
        try {
            val snapshot = offlineModelManager.snapshot()
            val downloadPrefs = getSharedPreferences(DOWNLOAD_PREFS, MODE_PRIVATE)
            if (!downloadPrefs.contains(KEY_ALLOW_MOBILE_DATA)) {
                requestDownloadNetworkChoice { allowMobile ->
                    startOfflineModelDownload(allowMobile)
                }
            } else if (snapshot.state == OfflineModelManager.State.NOT_DOWNLOADED ||
                snapshot.state == OfflineModelManager.State.FAILED
            ) {
                startOfflineModelDownload(isMobileDataDownloadAllowed())
            } else {
                refreshOfflineModelUi()
                if (snapshot.state == OfflineModelManager.State.PENDING ||
                    snapshot.state == OfflineModelManager.State.RUNNING ||
                    snapshot.state == OfflineModelManager.State.PAUSED
                ) startOfflineModelPolling()
            }
        } catch (error: Exception) {
            setOfflineModelStatus(error.message ?: "Automatic AI download could not start. Tap retry.")
            offlineModelActionButton.text = "Retry automatic download"
        }
    }

    private fun isMobileDataDownloadAllowed(): Boolean =
        getSharedPreferences(DOWNLOAD_PREFS, MODE_PRIVATE).getBoolean(KEY_ALLOW_MOBILE_DATA, false)

    private fun requestDownloadNetworkChoice(onChoice: (Boolean) -> Unit) {
        val prefs = getSharedPreferences(DOWNLOAD_PREFS, MODE_PRIVATE)
        if (prefs.contains(KEY_ALLOW_MOBILE_DATA)) {
            onChoice(prefs.getBoolean(KEY_ALLOW_MOBILE_DATA, false))
            return
        }
        if (downloadChoicePromptShowing || isFinishing) return
        downloadChoicePromptShowing = true
        AlertDialog.Builder(this)
            .setTitle("Allow mobile data for AI downloads?")
            .setMessage("Workly Voice downloads Qwen (about 2.1 GB) and Kokoro (about 295 MB). Allowing mobile data may use your data pack and may cause carrier charges. Choose Wi-Fi only to avoid mobile-data usage.")
            .setNegativeButton("Wi-Fi only") { _, _ ->
                prefs.edit().putBoolean(KEY_ALLOW_MOBILE_DATA, false).apply()
                downloadChoicePromptShowing = false
                onChoice(false)
            }
            .setPositiveButton("Allow mobile data") { _, _ ->
                prefs.edit().putBoolean(KEY_ALLOW_MOBILE_DATA, true).apply()
                downloadChoicePromptShowing = false
                onChoice(true)
            }
            .setOnCancelListener { downloadChoicePromptShowing = false }
            .show()
    }

    private fun onOfflineModelAction() {
        val state = try {
            offlineModelManager.snapshot().state
        } catch (error: Exception) {
            setOfflineModelStatus(error.message ?: "Offline model storage is unavailable.")
            return
        }
        when (state) {
            OfflineModelManager.State.READY -> {
                offlineModelManager.deleteDownloadedModel()
                setOfflineModelStatus("Downloaded model deleted. You can download it again whenever needed.")
                refreshOfflineModelUi()
            }
            OfflineModelManager.State.PENDING,
            OfflineModelManager.State.RUNNING,
            OfflineModelManager.State.PAUSED -> {
                offlineModelManager.cancelAndDelete()
                setOfflineModelStatus("Model download cancelled.")
                refreshOfflineModelUi()
            }
            else -> requestDownloadNetworkChoice { allowMobile ->
                startOfflineModelDownload(allowMobile)
            }
        }
    }

    private fun startOfflineModelDownload(allowMobileData: Boolean = isMobileDataDownloadAllowed()) {
        try {
            offlineModelManager.startDownload(allowMobileData)
            setOfflineModelStatus("Starting download from the official Hugging Face model repository…")
            refreshOfflineModelUi()
            startOfflineModelPolling()
        } catch (error: Exception) {
            setOfflineModelStatus(error.message ?: "Could not start model download.")
        }
    }

    private fun refreshOfflineModelUi() {
        if (!::offlineModelStatusText.isInitialized) return
        try {
            val snapshot = offlineModelManager.snapshot()
            val active = snapshot.state == OfflineModelManager.State.RUNNING ||
                snapshot.state == OfflineModelManager.State.PENDING ||
                snapshot.state == OfflineModelManager.State.PAUSED
            offlineModelProgressBar.visibility = if (active || snapshot.state == OfflineModelManager.State.READY) View.VISIBLE else View.GONE
            offlineModelProgressBar.progress = snapshot.progressPercent
            offlineModelChatButton.isEnabled = snapshot.state == OfflineModelManager.State.READY
            when (snapshot.state) {
                OfflineModelManager.State.NOT_DOWNLOADED -> {
                    offlineModelStatusText.text = "Waiting for an allowed network · about 2.1 GB required"
                    offlineModelActionButton.text = "Retry automatic download"
                }
                OfflineModelManager.State.PENDING -> {
                    offlineModelStatusText.text = "Download queued… ${snapshot.progressPercent}%"
                    offlineModelActionButton.text = "Cancel download"
                }
                OfflineModelManager.State.RUNNING -> {
                    val downloaded = snapshot.downloadedBytes / 1_000_000_000.0
                    val total = snapshot.totalBytes / 1_000_000_000.0
                    offlineModelStatusText.text = "Downloading… ${snapshot.progressPercent}% (%.2f / %.2f GB)".format(java.util.Locale.US, downloaded, total)
                    offlineModelActionButton.text = "Cancel download"
                }
                OfflineModelManager.State.PAUSED -> {
                    offlineModelStatusText.text = "Download paused by Android/network. It may resume automatically when the connection is available."
                    offlineModelActionButton.text = "Cancel download"
                }
                OfflineModelManager.State.FAILED -> {
                    offlineModelStatusText.text = "Download failed or file verification failed. Try again."
                    offlineModelActionButton.text = "Retry download"
                }
                OfflineModelManager.State.READY -> {
                    offlineModelStatusText.text = "Model downloaded and GGUF file verified · 2.1 GB. Offline AI chat is ready to open."
                    offlineModelActionButton.text = "Delete downloaded model"
                }
            }
            ensureAutomaticKokoroModelDownload()
            refreshKokoroModelUi()
        } catch (error: Exception) {
            offlineModelStatusText.text = error.message ?: "Offline model storage is unavailable."
            offlineModelActionButton.text = "Try again"
        }
    }

    // Queue Kokoro only after the larger Qwen download completes, keeping model transfers sequential.
    private fun ensureAutomaticKokoroModelDownload() {
        if (!::kokoroModelStatusText.isInitialized) return
        if (Build.SUPPORTED_ABIS.none { it == "arm64-v8a" }) {
            kokoroModelStatusText.text = "Kokoro requires a 64-bit ARM device. Android TTS remains available."
            kokoroModelActionButton.isEnabled = false
            return
        }
        if (offlineModelManager.snapshot().state != OfflineModelManager.State.READY) return
        if (kokoroAutoDownloadAttempted) return
        kokoroAutoDownloadAttempted = true
        val prefs = getSharedPreferences("workly_kokoro_model", MODE_PRIVATE)
        if (prefs.getBoolean("auto_attempted", false)) return
        prefs.edit().putBoolean("auto_attempted", true).apply()
        if (kokoroModelManager.snapshot().state == KokoroModelManager.State.NOT_DOWNLOADED) {
            runCatching { kokoroModelManager.startDownload(isMobileDataDownloadAllowed()) }
                .onFailure { kokoroModelStatusText.text = it.message ?: "Kokoro download could not start. Tap retry." }
        }
        startOfflineModelPolling()
    }

    private fun refreshKokoroModelUi() {
        if (!::kokoroModelStatusText.isInitialized) return
        val snapshot = kokoroModelManager.snapshot()
        val active = snapshot.state == KokoroModelManager.State.PENDING || snapshot.state == KokoroModelManager.State.RUNNING || snapshot.state == KokoroModelManager.State.PAUSED
        kokoroModelProgressBar.visibility = if (active || snapshot.state == KokoroModelManager.State.READY) View.VISIBLE else View.GONE
        kokoroModelProgressBar.progress = snapshot.progressPercent
        when (snapshot.state) {
            KokoroModelManager.State.NOT_DOWNLOADED -> {
                kokoroModelStatusText.text = if (offlineModelManager.snapshot().state == OfflineModelManager.State.READY) "Ready to download · Wi-Fi or approved mobile data" else "Waiting for Qwen download to finish…"
                kokoroModelActionButton.text = "Download Kokoro"
            }
            KokoroModelManager.State.PENDING -> { kokoroModelStatusText.text = "Kokoro download queued… ${snapshot.progressPercent}%"; kokoroModelActionButton.text = "Cancel Kokoro download" }
            KokoroModelManager.State.RUNNING -> { kokoroModelStatusText.text = "Downloading Kokoro… ${snapshot.progressPercent}%"; kokoroModelActionButton.text = "Cancel Kokoro download" }
            KokoroModelManager.State.PAUSED -> { kokoroModelStatusText.text = "Kokoro download paused until an allowed network is available."; kokoroModelActionButton.text = "Cancel Kokoro download" }
            KokoroModelManager.State.FAILED -> { kokoroModelStatusText.text = "Kokoro download failed or file is incomplete. Tap retry."; kokoroModelActionButton.text = "Retry Kokoro download" }
            KokoroModelManager.State.READY -> { kokoroModelStatusText.text = "Kokoro model downloaded and file size verified. Hindi and English offline TTS ready."; kokoroModelActionButton.text = "Delete Kokoro model" }
        }
    }

    private fun onKokoroModelAction() {
        if (Build.SUPPORTED_ABIS.none { it == "arm64-v8a" }) {
            kokoroModelStatusText.text = "Kokoro requires a 64-bit ARM device. Android TTS remains available."
            return
        }
        when (kokoroModelManager.snapshot().state) {
            KokoroModelManager.State.READY -> {
                kokoroEngine?.close(); kokoroEngine = null
                kokoroModelManager.cancelAndDelete()
                getSharedPreferences("workly_kokoro_model", MODE_PRIVATE).edit().putBoolean("auto_attempted", true).apply()
            }
            KokoroModelManager.State.PENDING, KokoroModelManager.State.RUNNING, KokoroModelManager.State.PAUSED -> {
                kokoroModelManager.cancelAndDelete()
                getSharedPreferences("workly_kokoro_model", MODE_PRIVATE).edit().putBoolean("auto_attempted", true).apply()
            }
            else -> {
                getSharedPreferences("workly_kokoro_model", MODE_PRIVATE).edit().putBoolean("auto_attempted", true).apply()
                requestDownloadNetworkChoice { allowMobile ->
                    runCatching { kokoroModelManager.startDownload(allowMobile) }
                        .onFailure { kokoroModelStatusText.text = it.message ?: "Could not start Kokoro download." }
                    startOfflineModelPolling()
                }
            }
        }
        refreshKokoroModelUi()
    }

    private fun setOfflineModelStatus(message: String) {
        if (::offlineModelStatusText.isInitialized) offlineModelStatusText.text = message
    }

    private fun startOfflineModelPolling() {
        offlineModelHandler.removeCallbacks(offlineModelPoll)
        offlineModelHandler.post(offlineModelPoll)
    }

    private fun pairPhone() {
        val code = pairingCodeInput.text?.toString()?.trim()?.uppercase(Locale.ROOT).orEmpty()
        if (!Regex("^[A-F0-9]{24}$").matches(code)) {
            pairingCodeInput.error = "Enter the 24-character code from Workly website"
            return
        }
        relayStatusText.text = "Pairing securely…"
        relayExecutor.execute {
            try {
                val token = VoiceRelayApi.claimDevice(code, "Workly Voice Android")
                SecureDeviceTokenStore.save(this, token)
                runOnUiThread {
                    pairingCodeInput.setText("")
                    relayStatusText.text = "Phone paired securely. Tap Start phone server."
                }
            } catch (error: Exception) {
                runOnUiThread {
                    relayStatusText.text = "Pairing failed: ${error.message ?: "Please try again."}"
                }
            }
        }
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
            kokoroExecutor.execute {
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
        val kokoroReady = runCatching { kokoroModelManager.snapshot().state == KokoroModelManager.State.READY }.getOrDefault(false)
        if (kokoroReady && (code == "hi" || code == "en")) {
            val voiceId = if (code == "hi") KokoroSpeechEngine.HINDI_VOICE else KokoroSpeechEngine.ENGLISH_US_VOICE
            setStatus("Preparing downloaded Kokoro voice for ${lang.label}…")
            kokoroExecutor.execute {
                try {
                    val engine = kokoroEngine ?: KokoroSpeechEngine.create(this, kokoroModelManager.modelFile).also { kokoroEngine = it }
                    engine.speak(text, voiceId)
                    runOnUiThread { setStatus("Speech generated by downloaded Kokoro.") }
                } catch (error: Exception) {
                    runOnUiThread { setStatus("Downloaded Kokoro failed: ${error.message ?: "inference error"}. Android TTS was not substituted.") }
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

    private fun downloadSelectedSpeechPack(shruti: Boolean) {
        val language = when {
            selectedLanguage().tag.startsWith("hi") -> "hi"
            selectedLanguage().tag.startsWith("gu") -> "gu"
            else -> {
                setStatus("Select Hindi or Gujarati to download this offline recognition model.")
                return
            }
        }
        val pack = runCatching {
            if (shruti) SpeechModelCatalog.shruti(language) else SpeechModelCatalog.indicConformer(language)
        }.getOrElse {
            setStatus(it.message ?: "Could not prepare speech model.")
            return
        }
        requestDownloadNetworkChoice { allowMobile ->
            runCatching {
                val snapshot = speechPackManager.start(pack, allowMobile)
                speechPackStatusText.text = "${pack.title}: ${snapshot.state} · about ${snapshot.totalBytes / 1_000_000} MB"
                setStatus("Offline speech model download queued. Android will show transfer progress.")
            }.onFailure {
                speechPackStatusText.text = it.message ?: "Speech model download failed to start."
            }
        }
    }

    private fun refreshSpeechPackStatus() {
        if (!::speechPackStatusText.isInitialized) return
        val language = when {
            selectedLanguage().tag.startsWith("hi") -> "hi"
            selectedLanguage().tag.startsWith("gu") -> "gu"
            else -> return
        }
        val packs = listOf(
            SpeechModelCatalog.indicConformer(language),
            SpeechModelCatalog.shruti(language)
        )
        speechPackStatusText.text = packs.joinToString(" · ") { pack ->
            val snapshot = speechPackManager.snapshot(pack)
            "${if (pack.id.startsWith("shruti")) "Shruti" else "IndicConformer"}: ${snapshot.state} (${snapshot.percent}%)"
        }
    }

    private fun startOfflineListening(shruti: Boolean) {
        val language = when {
            selectedLanguage().tag.startsWith("hi") -> "hi"
            selectedLanguage().tag.startsWith("gu") -> "gu"
            else -> {
                setStatus("Offline IndicConformer and Shruti currently have Hindi and Gujarati packs only.")
                return
            }
        }
        val pack = runCatching {
            if (shruti) SpeechModelCatalog.shruti(language) else SpeechModelCatalog.indicConformer(language)
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
                val speechEngine = if (shruti) OfflineSpeechEngineFactory.openShruti(this, language)
                    else OfflineSpeechEngineFactory.openIndicConformer(this, language)
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
            1 -> { startOfflineListening(shruti = false); return }
            2 -> { startOfflineListening(shruti = true); return }
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
        if (::offlineModelStatusText.isInitialized) {
            refreshOfflineModelUi()
            val qwenState = runCatching { offlineModelManager.snapshot().state }.getOrNull()
            val kokoroState = runCatching { kokoroModelManager.snapshot().state }.getOrNull()
            if (qwenState == OfflineModelManager.State.PENDING || qwenState == OfflineModelManager.State.RUNNING ||
                qwenState == OfflineModelManager.State.PAUSED || kokoroState == KokoroModelManager.State.PENDING ||
                kokoroState == KokoroModelManager.State.RUNNING || kokoroState == KokoroModelManager.State.PAUSED
            ) startOfflineModelPolling()
        }
    }

    override fun onPause() {
        super.onPause()
        offlineModelHandler.removeCallbacks(offlineModelPoll)
        if (listening) stopListening()
    }

    override fun onDestroy() {
        offlineModelHandler.removeCallbacksAndMessages(null)
        stopListening()
        tts?.stop()
        tts?.shutdown()
        kokoroEngine?.close()
        tinyTtsEngine?.close()
        kokoroExecutor.shutdownNow()
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
