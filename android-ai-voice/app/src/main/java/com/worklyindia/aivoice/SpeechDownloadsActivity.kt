package com.worklyindia.aivoice

import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.content.res.Configuration
import android.content.Intent
import android.net.Uri
import android.media.MediaPlayer
import android.os.Bundle
import android.os.SystemClock
import android.os.Handler
import android.os.Looper
import android.os.Environment
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.ArrayAdapter
import android.widget.TextView
import java.util.Locale
import java.io.File
import java.util.concurrent.Executors

class SpeechDownloadsActivity : Activity() {
    private val speechManager by lazy { SpeechPackDownloadManager(this) }
    private val qwenManager by lazy { QwenModelManager(this) }
    private val handler = Handler(Looper.getMainLooper())
    private val ttsExecutor = Executors.newSingleThreadExecutor()
    private val rows = mutableListOf<DownloadRow>()
    private var dark = false
    private var choiceShowing = false
    private var availableRam = 0L
    private var activeMossPlayer: MediaPlayer? = null
    private data class DownloadRow(val status: TextView, val progress: ProgressBar, val action: Button, val refresh: () -> Unit)
    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()
    private val poll = object : Runnable { override fun run() { rows.forEach { it.refresh() }; if (rows.any { it.status.text.contains("Downloading") || it.status.text.contains("Waiting") || it.status.text.contains("Paused") }) handler.postDelayed(this, 1000L) } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val info = ActivityManager.MemoryInfo()
        (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
        availableRam = info.availMem
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = bg; window.navigationBarColor = bg
        if (android.os.Build.VERSION.SDK_INT >= 23) { @Suppress("DEPRECATION") window.decorView.systemUiVisibility = if (dark) 0 else View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR }
        buildUi()
        refreshAll()
    }

    private fun buildUi() {
        val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg) }
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = android.view.Gravity.CENTER_VERTICAL; setPadding(dp(14), dp(10), dp(14), dp(10)); setBackgroundColor(bg) }
        header.addView(TextView(this).apply { text = "‹"; textSize = 36f; gravity = android.view.Gravity.CENTER; translationY = -dp(4).toFloat(); setTextColor(primary); setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(42), dp(48)))
        header.addView(TextView(this).apply { text = "Download Models"; textSize = 18f; typeface = android.graphics.Typeface.DEFAULT_BOLD; gravity = android.view.Gravity.CENTER_VERTICAL; setTextColor(primary) }, LinearLayout.LayoutParams(0, -2, 1f))
        page.addView(header)
        page.addView(View(this).apply { setBackgroundColor(if (dark) 0xFF29384D.toInt() else 0x2234475E) }, LinearLayout.LayoutParams(-1, dp(1)))
        ensureCommunityWorkerEnabled()
        val scroll=ScrollView(this).apply {
            isFillViewport = false
            isHorizontalScrollBarEnabled = false
            isVerticalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
        }
        val list=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(12), dp(14), dp(12), dp(28)) }
        scroll.addView(list)
        page.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        list.addView(label("WAKE WORD · CHATWORK ASSISTANT",16,if(dark) 0xFF82B1FF.toInt() else 0xFF245FC7.toInt(),true).apply { setPadding(dp(2),dp(16),dp(2),dp(8)) })
        addSpeechPack(list,"Hey ChatWork · English Wake Word","Offline keyword spotting model · downloaded separately · requires microphone permission and a visible foreground notification when listening",SpeechModelCatalog.chatWorkWakeWord())
        list.addView(label("OFFLINE AI CHAT",16,if(dark) 0xFF82B1FF.toInt() else 0xFF245FC7.toInt(),true).apply { setPadding(dp(2),dp(18),dp(2),dp(8)) })
        qwenManager.models.forEach { addQwenCard(list,it) }
        list.addView(label("VOICE TO TEXT",16,if(dark) 0xFF82B1FF.toInt() else 0xFF245FC7.toInt(),true).apply { setPadding(dp(2),dp(18),dp(2),dp(8)) })
        val recognitionLanguages = listOf(
            "as" to "Assamese", "bn" to "Bengali", "brx" to "Bodo", "doi" to "Dogri",
            "gu" to "Gujarati", "hi" to "Hindi", "kn" to "Kannada", "kok" to "Konkani",
            "ks" to "Kashmiri", "mai" to "Maithili", "ml" to "Malayalam", "mni" to "Manipuri",
            "mr" to "Marathi", "ne" to "Nepali", "or" to "Odia", "pa" to "Punjabi",
            "sa" to "Sanskrit", "sat" to "Santali", "sd" to "Sindhi", "ta" to "Tamil",
            "te" to "Telugu", "ur" to "Urdu", "en" to "English"
        )
        recognitionLanguages.forEach { (code, language) ->
            addSpeechPack(list,"IndicConformer · $language","AI4Bharat IndicConformer INT8 · $language offline speech-to-text",SpeechModelCatalog.indicConformer(code))
        }
        list.addView(label("TEXT TO VOICE",16,if(dark) 0xFF82B1FF.toInt() else 0xFF245FC7.toInt(),true).apply { setPadding(dp(2),dp(18),dp(2),dp(8)) })
        addSpeechPack(list,"Indic Tiny TTS · Gujarati","Gujarati offline text-to-speech",SpeechModelCatalog.indicTinyTts("gu"))
        addSpeechPack(list,"Indic Tiny TTS · Hindi","Hindi offline text-to-speech",SpeechModelCatalog.indicTinyTts("hi"))
        addSpeechPack(list,"Indic Tiny TTS · English","English offline text-to-speech",SpeechModelCatalog.indicTinyTts("en"))
        addSpeechPack(list,"iTantra VITS · Gujarati","Sherpa-ONNX · Mimic3/CMU-Indic · offline voice",SpeechModelCatalog.itantraVits("gu"))
        addSpeechPack(list,"iTantra VITS · Hindi","Sherpa-ONNX · Piper Pratham · offline voice",SpeechModelCatalog.itantraVits("hi"))
        addSpeechPack(list,"iTantra VITS · English","Sherpa-ONNX · Piper Lessac · offline voice",SpeechModelCatalog.itantraVits("en"))
        addSpeechPack(list,"Kokoro-82M · Hindi & English","Hindi and English · selectable female and male voices · approximately 295 MB · offline LiteRT",SpeechModelCatalog.kokoro82m())
        
        list.addView(label("ON-DEVICE AI · MOBILE ONLY",16,primary,true).apply { setPadding(dp(2),dp(22),dp(2),dp(8)) })
        addLocalOnlyCard(list,"Image Generation","No verified lightweight image model is configured for this phone. Image generation stays unavailable until a compatible on-device model is integrated.")
        addLocalOnlyCard(list,"Wan 2.1 Text-to-Video 1.3B","Not supported on this phone: Wan needs a multi-gigabyte model pack and substantially more RAM. Download is disabled to prevent storage and memory failures.")
        addLocalOnlyCard(list,"Offline Translation · ML Kit","Lightweight language packs are downloaded to this phone on first use (about 30 MB per language). Translation runs on-device; no translation server is used.")
        
        setContentView(page)
    }
    /**
     * Automatically enables the relay for a signed-in, paired installation.
     * If the encrypted device token is missing but the saved Supabase session
     * remains available, pair the device again before publishing capabilities.
     */
    private fun ensureCommunityWorkerEnabled() {
        getSharedPreferences(VoiceWorkerCapabilityRegistry.WORKER_PREFS, MODE_PRIVATE).edit()
            .putBoolean(VoiceWorkerCapabilityRegistry.WORKER_ENABLED_KEY, true).apply()
        ttsExecutor.execute {
            try {
                var deviceToken = SecureDeviceTokenStore.read(this)
                if (deviceToken.isNullOrBlank()) {
                    val accessToken = SecureDeviceTokenStore.readAccessToken(this)
                    if (accessToken.isNullOrBlank()) {
                        android.util.Log.w("ChatWorkWorker", "No saved account session; worker pairing will retry after sign-in.")
                        return@execute
                    }
                    deviceToken = VoiceRelayApi.registerDevice(accessToken, WorkerDeviceMetrics.deviceDisplayName(this))
                    SecureDeviceTokenStore.save(this, deviceToken)
                }
                val capabilities = VoiceWorkerCapabilityRegistry.downloadedRelayCapabilities(this)
                VoiceRelayApi.setWorkerState(deviceToken, true, capabilities)
            } catch (error: Exception) {
                android.util.Log.w("ChatWorkWorker", "Automatic community-worker setup will retry.", error)
            }
        }
    }

    private fun addLocalOnlyCard(parent:LinearLayout,title:String,reason:String) {
        val c=card(parent,title,reason)
        c.addView(label("On-device · Not available",12,secondary,true))
        c.addView(Button(this).apply { text="Not supported on this phone"; isAllCaps=false; isEnabled=false })
    }
    private fun addServerModelCard(parent:LinearLayout,title:String,subtitle:String,downloadUrl:String) {
        val c=card(parent,title,subtitle)
        c.addView(label("Official model source · Runtime compatibility required",12,secondary,true))
        c.addView(Button(this).apply {
            text="Open Model Download"
            isAllCaps=false
            setOnClickListener {
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl))) }
                    .onFailure { Toast.makeText(this@SpeechDownloadsActivity,"Could not open model source.",Toast.LENGTH_SHORT).show() }
            }
        })
    }
    private fun addQwenCard(parent: LinearLayout, model: QwenModelManager.Model) {
        val modelCard = card(parent, model.title + if (model.premium) " · PREMIUM" else "", "")
        val status = label("", 12, secondary, false).apply {
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        val action = Button(this).apply { isAllCaps = false; minHeight = dp(46) }
        val test = Button(this).apply { text = "Test Model"; isAllCaps = false; minHeight = dp(42); visibility = View.GONE }
        modelCard.addView(status)
        modelCard.addView(progress)
        modelCard.addView(action)
        modelCard.addView(test)
        val row = DownloadRow(status, progress, action) {
            val snapshot = runCatching { qwenManager.snapshot(model) }.getOrNull() ?: return@DownloadRow
            val storageOk = availableStorageBytes() >= model.size + 512L * 1024L * 1024L
            val ramOk = qwenManager.isSupported(model, availableRam)
            val supported = storageOk && ramOk
            progress.progress = snapshot.progressPercent
            progress.visibility = if (snapshot.state == QwenModelManager.State.RUNNING) View.VISIBLE else View.GONE
            test.visibility = if (snapshot.state == QwenModelManager.State.READY) View.VISIBLE else View.GONE
            when (snapshot.state) {
                QwenModelManager.State.READY -> {
                    status.visibility = View.GONE
                    action.text = "Delete"
                    action.isEnabled = true
                    action.setOnClickListener {
                        if (getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE).getBoolean(WakeWordAssistantService.KEY_ACTIVE, false)) {
                            Toast.makeText(this, "Stop Hey ChatWork before deleting an AI model.", Toast.LENGTH_LONG).show()
                            return@setOnClickListener
                        }
                        AlertDialog.Builder(this).setTitle("Delete ${model.title}?")
                            .setMessage("This removes the downloaded model file from this phone.")
                            .setNegativeButton("Cancel", null)
                            .setPositiveButton("Delete") { _, _ ->
                                qwenManager.cancelAndDelete(model)
                                ModelUsageTracker.clear(this, "qwen-" + model.id)
                                refreshAll()
                            }
                            .show()
                    }
                    test.setOnClickListener { runQwenModelTest(model, status, test, action) }
                }
                QwenModelManager.State.NEEDS_TEST -> {
                    status.visibility = View.VISIBLE
                    status.text = "Download complete · Run the local inference test before this model can be used."
                    action.text = "Test Model"
                    action.isEnabled = true
                    action.setOnClickListener { runQwenModelTest(model, status, action, test) }
                }
                QwenModelManager.State.RUNNING, QwenModelManager.State.PENDING, QwenModelManager.State.PAUSED -> {
                    status.visibility = View.VISIBLE
                    status.text = when (snapshot.state) {
                        QwenModelManager.State.RUNNING -> "Downloading · ${snapshot.progressPercent}%"
                        QwenModelManager.State.PENDING -> "Waiting for network"
                        else -> "Paused · waiting for network"
                    }
                    action.text = "Downloading · ${snapshot.progressPercent}%"
                    action.isEnabled = false
                }
                else -> {
                    status.visibility = View.VISIBLE
                    status.text = when {
                        !storageOk -> "Not supported on this phone · Requires ${formatModelSize(model.size + 512L * 1024L * 1024L)} free storage; available ${formatModelSize(availableStorageBytes())}."
                        !ramOk -> "Not supported on this phone · Requires ${formatModelSize(model.minFreeRam)} free RAM; available ${formatModelSize(availableRam)}."
                        snapshot.state == QwenModelManager.State.FAILED -> "Download failed · Check internet and retry."
                        else -> ""
                    }
                    if (supported && snapshot.state == QwenModelManager.State.NOT_DOWNLOADED) status.visibility = View.GONE
                    action.text = if (!supported) "Unlock Model" else if (snapshot.state == QwenModelManager.State.FAILED) "Retry · ${formatModelSize(model.size)}" else "Download · ${formatModelSize(model.size)}"
                    action.isEnabled = true
                    action.setOnClickListener {
                        if (!supported) {
                            val guidance = if (!storageOk) "Free up at least ${formatModelSize(model.size + 512L * 1024L * 1024L)} of phone storage, then reopen Download Models." else "Close background apps to free at least ${formatModelSize(model.minFreeRam)} RAM, then reopen Download Models."
                            AlertDialog.Builder(this).setTitle("Unlock ${model.title}").setMessage(guidance).setPositiveButton("OK", null).show()
                            return@setOnClickListener
                        }
                        withNetworkChoice { allow ->
                            runCatching { qwenManager.startDownload(model, allow); refreshAll() }
                                .onFailure { status.visibility = View.VISIBLE; status.text = it.message ?: "Download failed." }
                        }
                    }
                }
            }
        }
        rows.add(row)
        row.refresh()
    }

    private fun runQwenModelTest(model: QwenModelManager.Model, status: TextView, trigger: Button, other: Button) {
        if (getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE).getBoolean(WakeWordAssistantService.KEY_ACTIVE, false)) {
            Toast.makeText(this, "Stop Hey ChatWork before testing another AI model.", Toast.LENGTH_LONG).show()
            return
        }
        trigger.isEnabled = false
        other.isEnabled = false
        status.visibility = View.VISIBLE
        status.text = "Loading model and running a local inference smoke test…"
        ttsExecutor.execute {
            val engine = OfflineAiEngine()
            val result = runCatching {
                check(engine.loadModel(qwenManager.file(model))) { "Native engine could not load this model." }
                engine.generate("Reply with a short greeting and confirm that the offline model is working.")
            }
            runCatching { engine.unload() }
            if (result.isSuccess && !result.getOrNull().isNullOrBlank()) {
                qwenManager.markTested(model, true)
                runOnUiThread {
                    status.text = "Test passed · Local model load and inference succeeded."
                    refreshAll()
                }
            } else {
                qwenManager.markTested(model, false)
                runOnUiThread {
                    status.text = "Test failed · ${result.exceptionOrNull()?.message ?: "The model returned an empty response."}"
                    trigger.isEnabled = true
                    other.isEnabled = true
                    refreshAll()
                }
            }
        }
    }

    private fun addSpeechPack(parent: LinearLayout, title: String, subtitle: String, pack: SpeechModelCatalog.Pack) {
        val modelCard = card(parent, title, "")
        val status = label("", 12, secondary, false).apply {
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        val action = Button(this).apply { isAllCaps = false; minHeight = dp(46) }
        val isTts = pack.id.startsWith("indic-tiny-tts-")
        val isSherpaVits = pack.id.startsWith("itantra-vits-")
        val isKokoro = pack.id == "kokoro-82m"
        val isWakeWord = pack.id == "chatwork-wake-word-en"
        val test = Button(this).apply {
            text = "Test Model"
            isAllCaps = false
            minHeight = dp(42)
            visibility = View.GONE
        }
        modelCard.addView(status)
        modelCard.addView(progress)
        modelCard.addView(action)
        modelCard.addView(test)
        test.setOnClickListener {
            when {
                isKokoro -> showKokoroTest(pack)
                isSherpaVits -> showSherpaVitsTest(pack)
                isWakeWord -> showWakeWordTest()
                else -> showTtsTest(pack)
            }
        }
        val row = DownloadRow(status, progress, action) {
            val snapshot = runCatching { speechManager.snapshot(pack) }.getOrNull() ?: return@DownloadRow
            val supportedReason = speechPackSupportReason(pack)
            val installed = snapshot.state == SpeechPackDownloadManager.State.COMPLETE
            progress.progress = snapshot.percent
            progress.visibility = if (snapshot.state == SpeechPackDownloadManager.State.RUNNING) View.VISIBLE else View.GONE
            test.visibility = if (installed && (isTts || isSherpaVits || isKokoro || isWakeWord)) View.VISIBLE else View.GONE
            if (installed) {
                status.visibility = View.GONE
                action.text = "Delete"
                action.isEnabled = true
                action.setOnClickListener {
                    if (getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE).getBoolean(WakeWordAssistantService.KEY_ACTIVE, false)) {
                        Toast.makeText(this, "Stop Hey ChatWork before deleting a speech model.", Toast.LENGTH_LONG).show()
                        return@setOnClickListener
                    }
                    AlertDialog.Builder(this).setTitle("Delete ${pack.title}?")
                        .setMessage("This removes the downloaded model files from this phone.")
                        .setNegativeButton("Cancel", null)
                        .setPositiveButton("Delete") { _, _ ->
                            speechManager.delete(pack)
                            if (isWakeWord) File(speechManager.modelDirectory(pack), "model").deleteRecursively()
                            ModelUsageTracker.clear(this, pack.id)
                            refreshAll()
                        }
                        .show()
                }
            } else {
                status.text = when {
                    supportedReason != null -> supportedReason
                    snapshot.state == SpeechPackDownloadManager.State.RUNNING -> "Downloading · ${snapshot.percent}%"
                    snapshot.state == SpeechPackDownloadManager.State.PENDING -> "Waiting for network"
                    snapshot.state == SpeechPackDownloadManager.State.PAUSED -> "Paused · waiting for network"
                    snapshot.state == SpeechPackDownloadManager.State.FAILED -> "Download failed · check internet and retry."
                    else -> ""
                }
                status.visibility = if (supportedReason != null ||
                    snapshot.state == SpeechPackDownloadManager.State.RUNNING ||
                    snapshot.state == SpeechPackDownloadManager.State.PENDING ||
                    snapshot.state == SpeechPackDownloadManager.State.PAUSED ||
                    snapshot.state == SpeechPackDownloadManager.State.FAILED) View.VISIBLE else View.GONE
                action.text = when {
                    supportedReason != null -> "Unlock Model"
                    snapshot.state == SpeechPackDownloadManager.State.RUNNING -> "Downloading · ${snapshot.percent}%"
                    snapshot.state == SpeechPackDownloadManager.State.PENDING -> "Waiting…"
                    snapshot.state == SpeechPackDownloadManager.State.PAUSED -> "Paused"
                    snapshot.state == SpeechPackDownloadManager.State.FAILED -> "Retry · ${formatModelSize(pack.totalBytes)}"
                    else -> "Download · ${formatModelSize(pack.totalBytes)}"
                }
                action.isEnabled = snapshot.state != SpeechPackDownloadManager.State.RUNNING &&
                    snapshot.state != SpeechPackDownloadManager.State.PENDING &&
                    snapshot.state != SpeechPackDownloadManager.State.PAUSED
                action.setOnClickListener {
                    if (supportedReason != null) {
                        AlertDialog.Builder(this).setTitle("Unlock $title")
                            .setMessage(supportedReason)
                            .setPositiveButton("OK", null).show()
                        return@setOnClickListener
                    }
                    withNetworkChoice { allow ->
                        runCatching { speechManager.start(pack, allow); refreshAll() }
                            .onFailure { status.visibility = View.VISIBLE; status.text = it.message ?: "Download could not start." }
                    }
                }
            }
        }
        rows.add(row)
        row.refresh()
    }

    private fun availableStorageBytes(): Long =
        runCatching { android.os.StatFs((getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir).absolutePath).availableBytes }.getOrDefault(0L)

    private fun speechPackSupportReason(pack: SpeechModelCatalog.Pack): String? {
        val requiredStorage = pack.totalBytes + maxOf(256L * 1024L * 1024L, pack.totalBytes / 10L)
        val freeStorage = availableStorageBytes()
        if (freeStorage < requiredStorage) {
            return "Not supported on this phone · Requires ${formatModelSize(requiredStorage)} free storage; available ${formatModelSize(freeStorage)}."
        }
        val requiredRam = when {
            pack.id == "kokoro-82m" -> 1_200L * 1024L * 1024L
            pack.id.startsWith("indicconformer-") -> 512L * 1024L * 1024L
            pack.id.startsWith("indic-tiny-tts-") -> 512L * 1024L * 1024L
            pack.id.startsWith("itantra-vits-") -> 512L * 1024L * 1024L
            else -> 1_000L * 1024L * 1024L
        }
        if (availableRam < requiredRam) {
            return "Not supported on this phone · Requires ${formatModelSize(requiredRam)} free RAM; available ${formatModelSize(availableRam)}."
        }
        return null
    }

    private fun formatModelSize(bytes: Long): String = if (bytes >= 1_000_000_000L) {
        "%.1f GB".format(Locale.US, bytes / 1_000_000_000.0)
    } else {
        "%.0f MB".format(Locale.US, bytes / 1_000_000.0)
    }

    private fun showWakeWordTest() {
        Toast.makeText(this, "Loading the offline Hey ChatWork keyword model…", Toast.LENGTH_SHORT).show()
        ttsExecutor.execute {
            val result = runCatching {
                WakeWordEngineFactory.open(this).use { }
            }
            SpeechPackDownloadManager(this).markModelTested(SpeechModelCatalog.chatWorkWakeWord(), result.isSuccess)
            runOnUiThread {
                if (result.isSuccess) {
                    AlertDialog.Builder(this)
                        .setTitle("Wake Word Model Ready")
                        .setMessage("The offline English keyword model and Hey ChatWork phrase loaded successfully. Enable listening from AI Assistant to start the microphone foreground service.")
                        .setPositiveButton("OK", null)
                        .show()
                } else {
                    AlertDialog.Builder(this)
                        .setTitle("Wake Word Test Failed")
                        .setMessage(result.exceptionOrNull()?.message ?: "Could not initialize the wake-word model.")
                        .setPositiveButton("OK", null)
                        .show()
                }
            }
        }
    }
    private fun showSherpaVitsTest(pack: SpeechModelCatalog.Pack) {
        val language = pack.languageCode
        val sample = when (language) {
            "gu" -> "નમસ્તે! આ iTantra ગુજરાતી અવાજની કસોટી છે."
            "hi" -> "नमस्ते! यह iTantra हिंदी आवाज़ का परीक्षण है।"
            else -> "Hello! This is the iTantra English voice test."
        }
        val input = EditText(this).apply {
            setText(sample)
            minLines = 3
            maxLines = 6
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        AlertDialog.Builder(this)
            .setTitle("Test ${pack.title}")
            .setMessage("Generate a short sample locally with the downloaded VITS voice.")
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Generate & Play") { _, _ ->
                val textToSpeak = input.text.toString().trim()
                if (textToSpeak.isBlank()) {
                    Toast.makeText(this, "Enter test text.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                ttsExecutor.execute {
                    val startedAt = SystemClock.elapsedRealtime()
                    val output = File(cacheDir, "itantra_vits_test_${System.currentTimeMillis()}.wav")
                    try {
                        SherpaVitsTtsEngine.create(this, pack).use { it.synthesizeToWav(textToSpeak, output) }
                        ModelUsageTracker.record(this, pack.id, pack.title, "tts", "Model test", startedAt, textToSpeak.length, output.length())
                        runOnUiThread {
                            if (isFinishing || !output.isFile) return@runOnUiThread
                            activeMossPlayer?.release()
                            activeMossPlayer = MediaPlayer().apply {
                                setDataSource(output.absolutePath)
                                setOnCompletionListener { it.release(); activeMossPlayer = null }
                                setOnPreparedListener { it.start() }
                                prepareAsync()
                            }
                        }
                    } catch (error: Throwable) {
                        runOnUiThread {
                            Toast.makeText(this, error.message ?: "VITS test failed.", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
            .show()
    }

    private data class KokoroVoice(val id: String, val label: String)
    private data class KokoroLanguage(val label: String, val code: String, val sample: String, val voices: List<KokoroVoice>)

    private val kokoroLanguages by lazy {
        listOf(
            KokoroLanguage("English", "en-IN", "Hello! This is an English Kokoro offline voice test.", listOf(
                KokoroVoice("af_heart", "Heart · Female"), KokoroVoice("af_alloy", "Alloy · Female"),
                KokoroVoice("af_aoede", "Aoede · Female"), KokoroVoice("af_bella", "Bella · Female"),
                KokoroVoice("af_jessica", "Jessica · Female"), KokoroVoice("af_kore", "Kore · Female"),
                KokoroVoice("af_nicole", "Nicole · Female"), KokoroVoice("af_nova", "Nova · Female"),
                KokoroVoice("af_river", "River · Female"), KokoroVoice("af_sarah", "Sarah · Female"),
                KokoroVoice("af_sky", "Sky · Female"), KokoroVoice("am_adam", "Adam · Male"),
                KokoroVoice("am_echo", "Echo · Male"), KokoroVoice("am_eric", "Eric · Male"),
                KokoroVoice("am_fenrir", "Fenrir · Male"), KokoroVoice("am_liam", "Liam · Male"),
                KokoroVoice("am_michael", "Michael · Male"), KokoroVoice("am_onyx", "Onyx · Male"),
                KokoroVoice("am_puck", "Puck · Male"), KokoroVoice("am_santa", "Santa · Male")
            )),
            KokoroLanguage("Hindi", "hi-IN", "नमस्ते! यह कोकोरो हिंदी आवाज़ का परीक्षण है।", listOf(
                KokoroVoice("hf_alpha", "Alpha · Female"), KokoroVoice("hf_beta", "Beta · Female"),
                KokoroVoice("hm_omega", "Omega · Male"), KokoroVoice("hm_psi", "Psi · Male")
            ))
        )
    }

    private fun showKokoroTest(pack: SpeechModelCatalog.Pack) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(8), dp(18), dp(4))
        }
        layout.addView(label("LANGUAGE", 12, secondary, true))
        val languageSpinner = Spinner(this)
        languageSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, kokoroLanguages.map { it.label }).also {
            it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        layout.addView(languageSpinner)
        layout.addView(label("VOICE · AVAILABLE MODEL VOICES", 12, secondary, true))
        val voiceSpinner = Spinner(this)
        layout.addView(voiceSpinner)
        val input = EditText(this).apply {
            minLines = 3
            maxLines = 6
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        layout.addView(label("TEST TEXT", 12, secondary, true))
        layout.addView(input)

        fun updateLanguage(position: Int) {
            val language = kokoroLanguages[position]
            voiceSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, language.voices.map { it.label }).also {
                it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            }
            input.setText(language.sample)
        }
        languageSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                updateLanguage(position)
            }
        }
        updateLanguage(0)

        AlertDialog.Builder(this)
            .setTitle("Test Kokoro-82M · Hindi & English Voices")
            .setMessage("Choose Hindi or English and a voice, then generate speech offline. Gujarati voice is provided by Indic Tiny TTS.")
            .setView(layout)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Generate & Play") { _, _ ->
                val selectedLanguage = kokoroLanguages[languageSpinner.selectedItemPosition]
                val selectedVoice = selectedLanguage.voices[voiceSpinner.selectedItemPosition]
                val text = input.text.toString().trim()
                if (text.isBlank()) {
                    Toast.makeText(this, "Enter text to test.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                statusToast("Generating " + selectedLanguage.label + " · " + selectedVoice.label + " offline…")
                ttsExecutor.execute {
                    val startedAt = SystemClock.elapsedRealtime()
                    try {
                        val output = KokoroTtsEngine(this).use { engine ->
                            engine.synthesizeToWav(
                                pack = pack,
                                modelDirectory = speechManager.modelDirectory(pack),
                                text = text,
                                voiceId = selectedVoice.id,
                                outputFile = java.io.File(cacheDir, "kokoro_tts_test.wav")
                            )
                        }
                        ModelUsageTracker.record(this, pack.id, pack.title, "tts", "Model test", startedAt, text.length, output.length())
                        runOnUiThread {
                            try {
                                activeMossPlayer?.release()
                                activeMossPlayer = MediaPlayer().apply {
                                    setDataSource(output.absolutePath)
                                    setOnCompletionListener { player ->
                                        player.release()
                                        if (activeMossPlayer === player) activeMossPlayer = null
                                    }
                                    setOnErrorListener { player, _, _ ->
                                        player.release()
                                        if (activeMossPlayer === player) activeMossPlayer = null
                                        Toast.makeText(this@SpeechDownloadsActivity, "Kokoro audio playback failed.", Toast.LENGTH_LONG).show()
                                        true
                                    }
                                    setOnPreparedListener { it.start() }
                                    prepareAsync()
                                }
                                Toast.makeText(this, "Playing " + selectedLanguage.label + " · " + selectedVoice.label, Toast.LENGTH_LONG).show()
                            } catch (error: Throwable) {
                                Toast.makeText(this, error.message ?: "Could not play Kokoro audio.", Toast.LENGTH_LONG).show()
                            }
                        }
                    } catch (error: Throwable) {
                        runOnUiThread {
                            AlertDialog.Builder(this)
                                .setTitle("Kokoro voice test failed")
                                .setMessage(error.message ?: "Could not load or run the selected Kokoro voice.")
                                .setPositiveButton("OK", null)
                                .show()
                        }
                    }
                }
            }
            .show()
    }

    private fun showTtsTest(pack: SpeechModelCatalog.Pack) {
        val language = pack.languageCode
        val sample = when (language) {
            "hi" -> "नमस्ते! यह हिंदी टेक्स्ट टू स्पीच मॉडल का परीक्षण है।"
            "gu" -> "નમસ્તે! આ ગુજરાતી ટેક્સ્ટ ટુ સ્પીચ મોડેલની કસોટી છે."
            else -> "Hello! This is an offline text to speech model test."
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(4))
        }
        layout.addView(label("LANGUAGE", 12, secondary, true))
        layout.addView(label(when (language) { "hi" -> "Hindi"; "gu" -> "Gujarati"; else -> "English" }, 15, primary, true))
        layout.addView(label("VOICE", 12, secondary, true))
        val voiceSpinner = Spinner(this)
        voiceSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, listOf("Female voice", "Male voice")).also {
            it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        layout.addView(voiceSpinner)
        layout.addView(label("TEST TEXT", 12, secondary, true))
        val input=EditText(this).apply { setText(sample); minLines=3; maxLines=6; setPadding(dp(12),dp(10),dp(12),dp(10)) }
        layout.addView(input)
        AlertDialog.Builder(this).setTitle("Test ${pack.title}")
            .setMessage("Select a voice and enter your own text in this language.")
            .setView(layout)
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Generate & Play") { _,_ ->
                val text=input.text.toString().trim()
                val voice = if (voiceSpinner.selectedItemPosition == 1) "male" else "female"
                if(text.isBlank()) { Toast.makeText(this,"Enter text to test.",Toast.LENGTH_SHORT).show(); return@setPositiveButton }
                statusToast("Generating " + voice + " voice offline…")
                ttsExecutor.execute {
                    val startedAt = SystemClock.elapsedRealtime()
                    try {
                        IndicTinyTtsEngine.create(this,language).use { it.speak(text, voice = voice) }
                        ModelUsageTracker.record(this, pack.id, pack.title, "tts", "Model test", startedAt, text.length)
                        runOnUiThread { Toast.makeText(this,"Voice test finished.",Toast.LENGTH_SHORT).show() }
                    } catch(error:Throwable) {
                        runOnUiThread { AlertDialog.Builder(this).setTitle("Voice test failed").setMessage(error.message ?: "Could not generate speech.").setPositiveButton("OK",null).show() }
                    }
                }
            }.show()
    }




    private data class TtsLanguageChoice(val label: String, val code: String, val sample: String)

    private fun showQvacTest(pack: SpeechModelCatalog.Pack, kind: Int) {
        val isChatterbox = kind == QvacTtsEngine.CHATTERBOX
        val title = if (isChatterbox) "Test Chatterbox Multilingual" else "Test CosyVoice 3"
        val languages = if (isChatterbox) listOf(
            TtsLanguageChoice("Arabic", "ar", "مرحباً، هذا اختبار صوتي."),
            TtsLanguageChoice("Danish", "da", "Hej, dette er en stemmetest."),
            TtsLanguageChoice("German", "de", "Hallo, dies ist ein Sprachtest."),
            TtsLanguageChoice("Greek", "el", "Γεια σας, αυτή είναι μια δοκιμή φωνής."),
            TtsLanguageChoice("English", "en", "Hello! This is a Chatterbox multilingual voice test."),
            TtsLanguageChoice("Spanish", "es", "Hola, esta es una prueba de voz."),
            TtsLanguageChoice("Finnish", "fi", "Hei, tämä on äänitesti."),
            TtsLanguageChoice("French", "fr", "Bonjour, ceci est un test vocal."),
            TtsLanguageChoice("Hebrew", "he", "שלום, זוהי בדיקת קול."),
            TtsLanguageChoice("Hindi", "hi", "नमस्ते! यह हिंदी आवाज़ का परीक्षण है।"),
            TtsLanguageChoice("Italian", "it", "Ciao, questo è un test vocale."),
            TtsLanguageChoice("Japanese", "ja", "こんにちは、これは音声テストです。"),
            TtsLanguageChoice("Korean", "ko", "안녕하세요, 음성 테스트입니다."),
            TtsLanguageChoice("Malay", "ms", "Hai, ini ujian suara."),
            TtsLanguageChoice("Dutch", "nl", "Hallo, dit is een stemtest."),
            TtsLanguageChoice("Norwegian", "no", "Hei, dette er en stemmetest."),
            TtsLanguageChoice("Polish", "pl", "Cześć, to jest test głosu."),
            TtsLanguageChoice("Portuguese", "pt", "Olá, este é um teste de voz."),
            TtsLanguageChoice("Russian", "ru", "Здравствуйте, это проверка голоса."),
            TtsLanguageChoice("Swedish", "sv", "Hej, det här är ett rösttest."),
            TtsLanguageChoice("Swahili", "sw", "Habari, huu ni mtihani wa sauti."),
            TtsLanguageChoice("Turkish", "tr", "Merhaba, bu bir ses testidir."),
            TtsLanguageChoice("Chinese", "zh", "你好，这是语音测试。")
        ) else listOf(
            TtsLanguageChoice("Chinese", "zh", "你好，这是 CosyVoice 离线语音测试。"),
            TtsLanguageChoice("English", "en", "Hello! This is a CosyVoice offline voice test."),
            TtsLanguageChoice("Japanese", "ja", "こんにちは、これは CosyVoice の音声テストです。"),
            TtsLanguageChoice("Korean", "ko", "안녕하세요, CosyVoice 음성 테스트입니다."),
            TtsLanguageChoice("German", "de", "Hallo, dies ist ein CosyVoice Sprachtest."),
            TtsLanguageChoice("French", "fr", "Bonjour, ceci est un test vocal CosyVoice."),
            TtsLanguageChoice("Russian", "ru", "Здравствуйте, это тест голоса CosyVoice."),
            TtsLanguageChoice("Spanish", "es", "Hola, esta es una prueba de voz de CosyVoice."),
            TtsLanguageChoice("Italian", "it", "Ciao, questo è un test vocale CosyVoice.")
        )
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(4))
        }
        layout.addView(label("LANGUAGE", 12, secondary, true))
        val languageSpinner = Spinner(this)
        languageSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, languages.map { it.label }).also {
            it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        layout.addView(languageSpinner)
        layout.addView(label(if (isChatterbox) "BUILT-IN VOICE" else "REFERENCE VOICE", 12, secondary, true))
        layout.addView(label(if (isChatterbox) "Model voice conditioning" else "Bundled reference voice · zero_shot_prompt.wav", 14, primary, false))
        layout.addView(label("TEST TEXT", 12, secondary, true))
        val input = EditText(this).apply {
            minLines = 3
            maxLines = 6
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        layout.addView(input)
        input.setText(languages.first().sample)
        languageSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                input.setText(languages[position].sample)
            }
        }
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage("Select a supported language. Speech generation runs locally; voice identity comes from the model or bundled reference audio.")
            .setView(layout)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Generate & Play") { _, _ ->
                val selectedLanguage = languages[languageSpinner.selectedItemPosition]
                val text = input.text.toString().trim()
                if (text.isBlank()) {
                    Toast.makeText(this, "Enter text to test.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                statusToast("Loading native model · " + selectedLanguage.label + "…")
                ttsExecutor.execute {
                    try {
                        val directory = speechManager.modelDirectory(pack)
                        val output = java.io.File(cacheDir, if (isChatterbox) "chatterbox_native_test.wav" else "cosyvoice3_native_test.wav")
                        val sampleRate = if (isChatterbox) {
                            QvacTtsEngine.create(
                                kind = QvacTtsEngine.CHATTERBOX,
                                modelDirectory = directory,
                                modelA = java.io.File(directory, "chatterbox-t3-q4_k.gguf"),
                                modelB = java.io.File(directory, "chatterbox-s3gen-q4_k.gguf"),
                                language = selectedLanguage.code,
                                threads = 2
                            ).use { it.synthesizeToWav(text, output) }
                        } else {
                            QvacTtsEngine.create(
                                kind = QvacTtsEngine.COSYVOICE3,
                                modelDirectory = directory,
                                modelA = java.io.File(directory, "vocab.json"),
                                modelB = java.io.File(directory, "merges.txt"),
                                referenceAudio = java.io.File(directory, "zero_shot_prompt.wav"),
                                referenceText = "",
                                language = selectedLanguage.code,
                                threads = 2
                            ).use { it.synthesizeToWav(text, output) }
                        }
                        runOnUiThread {
                            try {
                                activeMossPlayer?.release()
                                activeMossPlayer = MediaPlayer().apply {
                                    setDataSource(output.absolutePath)
                                    setOnCompletionListener { player ->
                                        player.release()
                                        if (activeMossPlayer === player) activeMossPlayer = null
                                    }
                                    setOnErrorListener { player, _, _ ->
                                        player.release()
                                        if (activeMossPlayer === player) activeMossPlayer = null
                                        Toast.makeText(this@SpeechDownloadsActivity, "Native TTS audio playback failed.", Toast.LENGTH_LONG).show()
                                        true
                                    }
                                    setOnPreparedListener { it.start() }
                                    prepareAsync()
                                }
                                Toast.makeText(this, "Playing " + selectedLanguage.label + " · " + sampleRate + " Hz", Toast.LENGTH_LONG).show()
                            } catch (error: Throwable) {
                                Toast.makeText(this, error.message ?: "Could not play generated audio.", Toast.LENGTH_LONG).show()
                            }
                        }
                    } catch (error: Throwable) {
                        runOnUiThread {
                            AlertDialog.Builder(this)
                                .setTitle("Native TTS test failed")
                                .setMessage(error.message ?: "Could not load or run this on-device speech model.")
                                .setPositiveButton("OK", null)
                                .show()
                        }
                    }
                }
            }
            .show()
    }


    private fun showMossTest(pack: SpeechModelCatalog.Pack) {
        val languages = listOf(
            TtsLanguageChoice("English", "en", "Hello! This is MOSS text to speech running offline on Android."),
            TtsLanguageChoice("Chinese (Mandarin)", "zh", "你好！这是 MOSS 离线语音测试。")
        )
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(4))
        }
        layout.addView(label("LANGUAGE", 12, secondary, true))
        val languageSpinner = Spinner(this)
        languageSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, languages.map { it.label }).also {
            it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        layout.addView(languageSpinner)
        layout.addView(label("VOICE", 12, secondary, true))
        layout.addView(label("Junhao · built-in model voice", 14, primary, false))
        layout.addView(label("TEST TEXT", 12, secondary, true))
        val input = EditText(this).apply {
            setText(languages.first().sample)
            minLines = 3
            maxLines = 6
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        layout.addView(input)
        languageSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                input.setText(languages[position].sample)
            }
        }
        AlertDialog.Builder(this)
            .setTitle("Test MOSS-TTS-Nano")
            .setMessage("Select English or Chinese and enter your own text. This pack exposes one built-in voice preset.")
            .setView(layout)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Generate & Play") { _, _ ->
                val selectedLanguage = languages[languageSpinner.selectedItemPosition]
                val text = input.text.toString().trim()
                if (text.isBlank()) {
                    Toast.makeText(this, "Enter text to test.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                statusToast("Generating " + selectedLanguage.label + " speech on this phone…")
                ttsExecutor.execute {
                    try {
                        val result = MossTtsOnnxEngine(
                            modelRoot = speechManager.modelDirectory(pack),
                            outputDir = cacheDir,
                            cpuThreads = 2
                        ).use { engine ->
                            engine.synthesize(
                                text = text,
                                outputFile = java.io.File(cacheDir, "moss_tts_nano_test.wav"),
                                voice = "Junhao",
                                maxFrames = 160,
                                seed = 1234L
                            )
                        }
                        runOnUiThread {
                            try {
                                activeMossPlayer?.release()
                                activeMossPlayer = MediaPlayer().apply {
                                    setDataSource(result.outputFile.absolutePath)
                                    setOnCompletionListener { player ->
                                        player.release()
                                        if (activeMossPlayer === player) activeMossPlayer = null
                                    }
                                    setOnErrorListener { player, _, _ ->
                                        player.release()
                                        if (activeMossPlayer === player) activeMossPlayer = null
                                        Toast.makeText(this@SpeechDownloadsActivity, "MOSS audio playback failed.", Toast.LENGTH_LONG).show()
                                        true
                                    }
                                    setOnPreparedListener { it.start() }
                                    prepareAsync()
                                }
                                Toast.makeText(this, "MOSS speech generated · " + selectedLanguage.label + " · " + result.durationMs + " ms", Toast.LENGTH_LONG).show()
                            } catch (error: Throwable) {
                                Toast.makeText(this, error.message ?: "Could not play generated audio.", Toast.LENGTH_LONG).show()
                            }
                        }
                    } catch (error: Throwable) {
                        runOnUiThread {
                            AlertDialog.Builder(this)
                                .setTitle("MOSS voice test failed")
                                .setMessage(error.message ?: "Could not tokenize text or run the local ONNX model.")
                                .setPositiveButton("OK", null)
                                .show()
                        }
                    }
                }
            }
            .show()
    }

    private fun statusToast(message:String) { Toast.makeText(this,message,Toast.LENGTH_SHORT).show() }

    private fun withNetworkChoice(action:(Boolean)->Unit) {
        val prefs=getSharedPreferences("workly_model_download_preferences",MODE_PRIVATE)
        if(prefs.contains("allow_mobile_data")) { action(prefs.getBoolean("allow_mobile_data",false)); return }
        if(choiceShowing) return
        choiceShowing=true
        AlertDialog.Builder(this).setTitle("Allow mobile data for model downloads?").setMessage("AI models can use 0.5–2.1 GB each. Wi-Fi only avoids mobile data charges.")
            .setNegativeButton("Wi-Fi only") { _,_-> prefs.edit().putBoolean("allow_mobile_data",false).apply();choiceShowing=false;action(false) }
            .setPositiveButton("Allow mobile data") { _,_-> prefs.edit().putBoolean("allow_mobile_data",true).apply();choiceShowing=false;action(true) }
            .setOnCancelListener { choiceShowing=false }.show()
    }
    private fun refreshAll() { rows.forEach { it.refresh() }; handler.removeCallbacks(poll); handler.postDelayed(poll,1000L) }
    private fun card(parent:LinearLayout,title:String,subtitle:String):LinearLayout {
        val stroke = if (dark) 0xFF34465F.toInt() else 0xFFDCE5F0.toInt()
        val c=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(dp(16),dp(15),dp(16),dp(15))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(surface)
                cornerRadius = dp(18).toFloat()
                setStroke(dp(1), stroke)
            }
            elevation=dp(2).toFloat()
        }
        c.addView(label(title,16,primary,true))
        if (subtitle.isNotBlank()) {
            c.addView(label(subtitle,13,secondary,false).apply { setPadding(0,dp(5),0,dp(9)) })
        }
        parent.addView(c,LinearLayout.LayoutParams(-1,-2).apply { bottomMargin=dp(12) })
        return c
    }
    private fun label(value:String,size:Int,color:Int,bold:Boolean)=TextView(this).apply { text=value;textSize=size.toFloat();setTextColor(color);if(bold)setTypeface(typeface,android.graphics.Typeface.BOLD);setPadding(0,dp(5),0,dp(5)) }
    override fun onResume() {
        super.onResume()
        val info = ActivityManager.MemoryInfo()
        (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
        availableRam = info.availMem
        refreshAll()
    }
    override fun onDestroy(){handler.removeCallbacksAndMessages(null);ttsExecutor.shutdownNow();activeMossPlayer?.release();activeMossPlayer=null;super.onDestroy()}
    private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
}