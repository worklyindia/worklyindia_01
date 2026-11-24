package com.worklyindia.aivoice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.util.Locale
import java.util.concurrent.Executors
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

class VoiceRelayService : Service() {
    private val running = AtomicBoolean(false)
    private val diagnosticsExecutor = Executors.newSingleThreadExecutor()
    @Volatile private var activeJobId: String? = null
    @Volatile private var activeAudioFile: File? = null
    private val speechManager by lazy { SpeechPackDownloadManager(this) }
    // Keep the 295 MB Kokoro runtime alive between website jobs. Recreating it
    // for every request forces the model to reload and makes Hindi/English slow.
    @Volatile private var kokoroTtsEngine: KokoroTtsEngine? = null
    // Keep Qwen loaded between website requests so repeat replies do not reload a 1+ GB GGUF file.
    private val relayAiEngine by lazy { OfflineAiEngine() }
    private val relayAiEngineLock = Any()
    @Volatile private var relayAiModelId: String? = null
    private var pollThread: Thread? = null
    private var activeToken: String? = null
    private var relayWakeLock: PowerManager.WakeLock? = null
    @Volatile private var networkCallback: ConnectivityManager.NetworkCallback? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val token = SecureDeviceTokenStore.read(this)
        if (token.isNullOrBlank()) {
            setStatus("Phone server stopped: connect the owner account first.")
            stopSelf()
            return START_NOT_STICKY
        }
        activeToken = token
        // Community worker mode is automatic for every paired ChatWork install.
        // The relay loop immediately publishes only models that are fully downloaded
        // and have a working local inference adapter.
        getSharedPreferences(VoiceWorkerCapabilityRegistry.WORKER_PREFS, MODE_PRIVATE)
            .edit().putBoolean(VoiceWorkerCapabilityRegistry.WORKER_ENABLED_KEY, true).apply()
        val initialStatus = currentConnectionNotificationText()
        startForeground(NOTIFICATION_ID, buildNotification(initialStatus))
        registerNetworkCallback()
        setStatus(if (hasValidatedInternet()) "Worker service started • online" else initialStatus)
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        relayWakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:WorklyVoiceRelay").apply {
            setReferenceCounted(false)
            acquire()
        }
        if (running.compareAndSet(false, true)) {
            // Warm the selected local model while the worker is idle, before the first website message arrives.
            preloadRelayAiModel()
            pollThread = Thread { pollLoop(token) }.apply {
                name = "WorklyVoiceRelay"
                start()
            }
        }
        return START_STICKY
    }

    private fun registerNetworkCallback() {
        if (networkCallback != null) return
        val manager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { publishNetworkState() }
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) { publishNetworkState() }
            override fun onLost(network: Network) { publishNetworkState() }
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                manager.registerDefaultNetworkCallback(callback)
            } else {
                @Suppress("DEPRECATION")
                manager.registerNetworkCallback(
                    android.net.NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(),
                    callback
                )
            }
            networkCallback = callback
        } catch (error: Exception) {
            recordEvent("Error / connection", "Could not monitor network changes", error.message.orEmpty())
        }
    }

    private fun publishNetworkState() {
        val online = hasValidatedInternet()
        val message = if (online) ONLINE_NOTIFICATION_TEXT else WAITING_NOTIFICATION_TEXT
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(message))
        setStatus(if (online) "Shared phone server is online. Waiting for website requests…" else WAITING_NOTIFICATION_TEXT)
        val token = activeToken
        if (online && !token.isNullOrBlank()) {
            diagnosticsExecutor.execute {
                runCatching {
                    val enabled = getSharedPreferences(VoiceWorkerCapabilityRegistry.WORKER_PREFS, MODE_PRIVATE)
                        .getBoolean(VoiceWorkerCapabilityRegistry.WORKER_ENABLED_KEY, false)
                    val capabilities = if (enabled) VoiceWorkerCapabilityRegistry.downloadedRelayCapabilities(this) else org.json.JSONArray()
                    VoiceRelayApi.setWorkerState(token, enabled, capabilities, WorkerDeviceMetrics.snapshot(this))
                }.onFailure { error ->
                    setStatus("Relay reconnecting: " + (error.message ?: "network unavailable"))
                }
            }
        }
    }

    private fun hasValidatedInternet(): Boolean {
        val manager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun pollLoop(token: String) {
        setStatus(if (hasValidatedInternet()) "Connecting to Supabase relay…" else "Waiting for Data on…")
        var wasWaitingForData = !hasValidatedInternet()
        var idlePollDelayMs = POLL_INTERVAL_MS
        var lastCapabilityRefresh = 0L
        var lastMetricsRefresh = 0L
        var capabilitiesSnapshot = org.json.JSONArray()
        while (running.get()) {
            if (!hasValidatedInternet()) {
                wasWaitingForData = true
                setStatus("Waiting for Data on…")
                try { Thread.sleep(POLL_INTERVAL_MS) } catch (_: InterruptedException) { break }
                continue
            }
            if (wasWaitingForData) {
                wasWaitingForData = false
                setStatus("Shared phone server is online")
            }
            try {
                val workerPrefs = getSharedPreferences(VoiceWorkerCapabilityRegistry.WORKER_PREFS, MODE_PRIVATE)
                val workerEnabled = workerPrefs.getBoolean(VoiceWorkerCapabilityRegistry.WORKER_ENABLED_KEY, false)
                val refreshNow = System.currentTimeMillis()
                if (workerEnabled) {
                    val capabilitiesChanged = refreshNow - lastCapabilityRefresh >= WORKER_CAPABILITY_REFRESH_MS
                    if (capabilitiesChanged) {
                        capabilitiesSnapshot = VoiceWorkerCapabilityRegistry.downloadedRelayCapabilities(this)
                        lastCapabilityRefresh = refreshNow
                    }
                    if (capabilitiesChanged || refreshNow - lastMetricsRefresh >= WORKER_METRICS_REFRESH_MS) {
                        VoiceRelayApi.setWorkerState(
                            token,
                            true,
                            capabilitiesSnapshot,
                            WorkerDeviceMetrics.snapshot(this)
                        )
                        lastMetricsRefresh = refreshNow
                    }
                }
                if (activeJobId != null) {
                    Thread.sleep(500)
                    continue
                }
                val response = VoiceRelayApi.poll(token)
                getSharedPreferences(STATUS_PREFS, MODE_PRIVATE).edit().putLong(LAST_POLL_KEY, System.currentTimeMillis()).apply()
                val job = response.optJSONObject("job")
                if (job != null) {
                    idlePollDelayMs = POLL_INTERVAL_MS
                    val jobId = job.optString("id")
                    val requestPayload = job.optJSONObject("payload")
                    val requestModel = requestPayload?.optString("pack_id")?.takeIf { it.isNotBlank() }
                        ?: requestPayload?.optString("model").orEmpty()
                    recordEvent("Website request", "Received " + job.optString("job_type").uppercase(Locale.ROOT) + " request", "Request ID: " + jobId, requestModel)
                    when (job.optString("job_type")) {
                        "tts" -> handleTtsJob(token, jobId, job.optJSONObject("payload") ?: JSONObject())
                        "ai" -> handleAiJob(token, jobId, job.optJSONObject("payload") ?: JSONObject())
                        "stt" -> handleSttJob(token, jobId, job.optJSONObject("payload") ?: JSONObject())
                        "translate" -> handleTranslationJob(token, jobId, job.optJSONObject("payload") ?: JSONObject())
                        else -> runCatching { VoiceRelayApi.fail(token, jobId, "Unsupported voice job type.") }
                    }
                } else {
                    idlePollDelayMs = (idlePollDelayMs * 3 / 2).coerceAtMost(5_000L)
                    setStatus("Shared phone server is online. Waiting for website requests…")
                }
            } catch (error: Exception) {
                if (error is RelayApiException && error.statusCode == 401) {
                    SecureDeviceTokenStore.clear(this)
                    setStatus("Phone access was revoked or the device token is invalid. Sign in again.")
                    diagnosticsExecutor.shutdown()
        running.set(false)
                    stopSelf()
                    break
                }
                idlePollDelayMs = (idlePollDelayMs * 2).coerceAtMost(10_000L)
                setStatus("Relay reconnecting: ${error.message ?: "network unavailable"}")
            }
            try { Thread.sleep(idlePollDelayMs) } catch (_: InterruptedException) { break }
        }
    }

    private fun handleSttJob(token: String, jobId: String, payload: JSONObject) {
        if (activeJobId != null) {
            VoiceRelayApi.fail(token, jobId, "Phone is already processing another request.")
            return
        }
        activeJobId = jobId
        Thread {
            var recognizer: OfflineSpeechRecognizer? = null
            try {
                val audioUrl = payload.optString("audio_url")
                if (audioUrl.isBlank()) throw IllegalStateException("Caller audio URL is missing.")
                val requestedModel = payload.optString("model")
                val language = payload.optString("language").lowercase().substringBefore("-")
                    .takeIf { it.isNotBlank() && it != "auto" }
                    ?: requestedModel.removePrefix("indicconformer-")
                require(requestedModel == "indicconformer-" + language) {
                    "This phone was not assigned a compatible IndicConformer model."
                }
                val pack = SpeechModelCatalog.indicConformer(language)
                check(OfflineSpeechEngineFactory.isReady(this, pack)) {
                    "The assigned IndicConformer model is no longer available on this phone."
                }
                setStatus("Transcribing audio locally with IndicConformer " + language.uppercase(Locale.ROOT) + "…")
                val audio = VoiceRelayApi.downloadAudio(audioUrl)
                val samples = decodePcm16MonoWav(audio)
                recognizer = OfflineSpeechEngineFactory.openIndicConformer(this, language)
                val transcript = recognizer.transcribe(samples).trim()
                if (transcript.isBlank()) throw IllegalStateException("No speech was detected in the caller audio.")
                VoiceRelayApi.complete(token, jobId, JSONObject()
                    .put("text", transcript.take(4000))
                    .put("languageTag", language + "-IN")
                    .put("provider", "local-indicconformer"))
                setStatus("Speech transcribed locally by IndicConformer. Waiting for next request…")
            } catch (error: Exception) {
                runCatching { VoiceRelayApi.fail(token, jobId, error.message ?: "Local speech transcription failed.") }
                setStatus("Speech recognition failed: " + (error.message ?: "model or audio error"))
            } finally {
                runCatching { recognizer?.close() }
                activeJobId = null
            }
        }.start()
    }

    /** Accepts only standard PCM16, mono, 16 kHz WAV to avoid silently mis-decoding audio. */
    private fun decodePcm16MonoWav(bytes: ByteArray): FloatArray {
        require(bytes.size >= 44) { "Recorded audio is too short to be a WAV file." }
        val buffer = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        fun fourCc(offset: Int) = String(bytes, offset, 4, Charsets.US_ASCII)
        require(fourCc(0) == "RIFF" && fourCc(8) == "WAVE") { "Audio must be a standard WAV file." }
        var offset = 12
        var channels = 0
        var sampleRate = 0
        var bitsPerSample = 0
        var audioFormat = 0
        var dataOffset = -1
        var dataLength = 0
        while (offset + 8 <= bytes.size) {
            val chunkId = fourCc(offset)
            val chunkSize = buffer.getInt(offset + 4).toLong() and 0xffffffffL
            val start = offset + 8
            val end = start.toLong() + chunkSize
            if (end > bytes.size || chunkSize > Int.MAX_VALUE) break
            when (chunkId) {
                "fmt " -> if (chunkSize >= 16) {
                    audioFormat = buffer.getShort(start).toInt() and 0xffff
                    channels = buffer.getShort(start + 2).toInt() and 0xffff
                    sampleRate = buffer.getInt(start + 4)
                    bitsPerSample = buffer.getShort(start + 14).toInt() and 0xffff
                }
                "data" -> { dataOffset = start; dataLength = chunkSize.toInt(); break }
            }
            offset = (end.toInt() + (chunkSize.toInt() and 1))
        }
        require(audioFormat == 1 && channels == 1 && sampleRate == 16000 && bitsPerSample == 16) {
            "This worker accepts PCM16 mono 16 kHz WAV audio only."
        }
        require(dataOffset >= 0 && dataLength >= 2 && dataLength % 2 == 0) { "WAV audio data chunk is missing or invalid." }
        val count = dataLength / 2
        return FloatArray(count) { index ->
            (buffer.getShort(dataOffset + index * 2).toInt() / 32768.0f).coerceIn(-1.0f, 1.0f)
        }
    }

    /** Load Qwen once and retain it in RAM for subsequent website requests. */
    private fun preloadRelayAiModel() {
        Thread {
            try {
                val manager = QwenModelManager(this)
                val memoryInfo = android.app.ActivityManager.MemoryInfo()
                (getSystemService(ACTIVITY_SERVICE) as android.app.ActivityManager).getMemoryInfo(memoryInfo)
                val selectedId = getSharedPreferences("workly_qwen_models", MODE_PRIVATE)
                    .getString("selected_model_id", null)
                val selected = manager.models.firstOrNull { it.id == selectedId }
                val model = selected?.takeIf {
                    manager.snapshot(it).state == QwenModelManager.State.READY &&
                        manager.isSupported(it, memoryInfo.availMem)
                } ?: manager.recommendedModel(memoryInfo.availMem).takeIf {
                    manager.snapshot(it).state == QwenModelManager.State.READY &&
                        manager.isSupported(it, memoryInfo.availMem)
                }
                if (model != null && running.get()) {
                    synchronized(relayAiEngineLock) {
                        if (running.get() && (relayAiModelId != model.id || !relayAiEngine.isLoaded)) {
                            if (relayAiEngine.isLoaded) relayAiEngine.unload()
                            check(relayAiEngine.loadModel(manager.file(model))) { "Qwen warm-up could not load the downloaded model." }
                            relayAiModelId = model.id
                        }
                    }
                }
            } catch (error: Exception) {
                setStatus("Local AI warm-up skipped: " + (error.message ?: "model unavailable"))
            }
        }.apply { name = "WorklyQwenWarmup"; isDaemon = true }.start()
    }

    private fun handleAiJob(token: String, jobId: String, payload: JSONObject) {
        if (activeJobId != null) {
            VoiceRelayApi.fail(token, jobId, "Phone is already processing another request.")
            return
        }
        activeJobId = jobId
        Thread {
            try {
                val requestedModel = payload.optString("model")
                val manager = QwenModelManager(this)
                val model = manager.models.firstOrNull { "qwen-" + it.id == requestedModel }
                    ?: throw IllegalStateException("The assigned Qwen model is not supported by this app version.")
                check(manager.snapshot(model).state == QwenModelManager.State.READY) {
                    "The assigned Qwen model is no longer downloaded on this phone."
                }
                synchronized(relayAiEngineLock) {
                    // Check free RAM only when loading a model. A warmed model itself
                    // consumes RAM, so checking the original threshold on every turn
                    // would incorrectly reject the already-loaded model.
                    if (relayAiModelId != model.id || !relayAiEngine.isLoaded) {
                        val memoryInfo = android.app.ActivityManager.MemoryInfo()
                        (getSystemService(ACTIVITY_SERVICE) as android.app.ActivityManager).getMemoryInfo(memoryInfo)
                        check(manager.isSupported(model, memoryInfo.availMem)) {
                            "There is not enough free memory to safely run the assigned Qwen model."
                        }
                        if (relayAiEngine.isLoaded) relayAiEngine.unload()
                        check(relayAiEngine.loadModel(manager.file(model))) { "Qwen could not load the downloaded model." }
                        relayAiModelId = model.id
                    }
                }
                val rawText = payload.optString("text").trim()
                val userMarker = rawText.lastIndexOf("\\nUser:")
                val assistantMarker = rawText.lastIndexOf("\\nAssistant:")
                val userText = if (userMarker >= 0) {
                    val start = userMarker + "\\nUser:".length
                    val end = if (assistantMarker > userMarker) assistantMarker else rawText.length
                    rawText.substring(start, end).trim()
                } else rawText
                require(userText.isNotBlank()) { "AI request text is empty." }
                setStatus("Generating AI reply locally with " + model.title + "…")
                // OfflineAiEngine already owns the full Qwen system prompt; pass only
                // the user's latest text to avoid tokenizing duplicate instructions.
                val reply = relayAiEngine.generate(userText.take(4000)).trim()
                if (reply.isBlank()) throw IllegalStateException("Qwen returned an empty reply.")
                VoiceRelayApi.complete(token, jobId, JSONObject()
                    .put("reply", reply.take(6000))
                    .put("languageTag", payload.optString("languageTag", "auto"))
                    .put("provider", "local-qwen"))
                setStatus("AI reply generated locally by Qwen. Waiting for next request…")
            } catch (error: Exception) {
                runCatching { VoiceRelayApi.fail(token, jobId, error.message ?: "Local Qwen inference failed.") }
                setStatus("Local AI request failed: " + (error.message ?: "model error"))
            } finally {
                // Deliberately keep the loaded model in memory for the next request.
                activeJobId = null
            }
        }.apply { name = "WorklyQwenRelay"; isDaemon = true }.start()
    }

    /** Offline ML Kit translation worker; only already-downloaded language pairs are accepted. */
    private fun handleTranslationJob(token: String, jobId: String, payload: JSONObject) {
        if (activeJobId != null) {
            VoiceRelayApi.fail(token, jobId, "Phone is already processing another request.")
            return
        }
        activeJobId = jobId
        Thread {
            var translator: com.google.mlkit.nl.translate.Translator? = null
            try {
                val text = payload.optString("text").trim()
                require(text.isNotBlank() && text.length <= 4000) { "Translation text must contain 1–4,000 characters." }
                require(payload.optString("model") == "mlkit-translation") { "This phone was not assigned the ML Kit translation adapter." }
                val sourceTag = payload.optString("source_language").trim()
                val targetTag = payload.optString("target_language").trim()
                val source = com.google.mlkit.nl.translate.TranslateLanguage.fromLanguageTag(sourceTag)
                    ?: throw IllegalArgumentException("Unsupported source language: " + sourceTag)
                val target = com.google.mlkit.nl.translate.TranslateLanguage.fromLanguageTag(targetTag)
                    ?: throw IllegalArgumentException("Unsupported target language: " + targetTag)
                require(source != target) { "Choose two different languages to translate." }
                setStatus("Translating locally with downloaded ML Kit language packs…")
                translator = com.google.mlkit.nl.translate.Translation.getClient(
                    com.google.mlkit.nl.translate.TranslatorOptions.Builder()
                        .setSourceLanguage(source)
                        .setTargetLanguage(target)
                        .build()
                )
                val translated = com.google.android.gms.tasks.Tasks.await(translator.translate(text)).trim()
                if (translated.isBlank()) throw IllegalStateException("The offline translation model returned an empty result.")
                VoiceRelayApi.complete(token, jobId, JSONObject()
                    .put("translated_text", translated.take(8000))
                    .put("source_language", sourceTag)
                    .put("target_language", targetTag)
                    .put("provider", "local-mlkit"))
                setStatus("Text translated locally. Waiting for next request…")
            } catch (error: Exception) {
                runCatching { VoiceRelayApi.fail(token, jobId, error.message ?: "Offline translation failed.") }
                setStatus("Translation failed: " + (error.message ?: "model or language error"))
            } finally {
                runCatching { translator?.close() }
                activeJobId = null
            }
        }.start()
    }

    /** Website Text To Voice uses only the two approved offline model families. */
    private fun handleTtsJob(token: String, jobId: String, payload: JSONObject) {
        if (activeJobId != null) {
            VoiceRelayApi.fail(token, jobId, "Phone is already processing another voice request.")
            return
        }
        activeJobId = jobId
        Thread {
            val outputFile = File(cacheDir, "workly-voice-$jobId.wav")
            activeAudioFile = outputFile
            try {
                val text = payload.optString("text").trim()
                require(text.isNotEmpty()) { "TTS request has no text." }
                val languageTag = payload.optString("language", "hi-IN")
                val language = Locale.forLanguageTag(languageTag).language
                val voiceId = payload.optString("voice").trim()
                val requestedModel = payload.optString("model").trim().ifBlank {
                    if (language == "gu") "indic" else "kokoro"
                }
                outputFile.delete()
                when (language) {
                    "gu" -> {
                        when (requestedModel) {
                            "indic" -> {
                                val pack = SpeechModelCatalog.indicTinyTts("gu")
                                check(speechManager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
                                    "Indic Tiny TTS Gujarati is not downloaded. Download it from ChatWork → Model Downloads."
                                }
                                val selectedVoice = voiceId.ifBlank { "female" }
                                check(selectedVoice == "female" || selectedVoice == "male") {
                                    "Selected Gujarati voice is not available in Indic Tiny TTS."
                                }
                                IndicTinyTtsEngine.create(this, "gu").use { engine ->
                                    engine.synthesizeToWav(text, outputFile, selectedVoice)
                                }
                            }
                            "itantra" -> {
                                val pack = SpeechModelCatalog.itantraVits("gu")
                                check(speechManager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
                                    "iTantra VITS model files are not fully downloaded. Check ChatWork → Model Downloads."
                                }
                                SherpaVitsTtsEngine.create(this, pack).use { engine ->
                                    engine.synthesizeToWav(text, outputFile)
                                }
                            }
                            else -> throw IllegalArgumentException("Select Indic Tiny TTS or iTantra VITS for Gujarati.")
                        }
                    }
                    "hi", "en" -> {
                        when (requestedModel) {
                            "indic" -> {
                                val pack = SpeechModelCatalog.indicTinyTts(language)
                                check(speechManager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
                                    "Indic Tiny TTS ${language.uppercase()} is not downloaded. Download it from ChatWork → Model Downloads."
                                }
                                val selectedVoice = voiceId.ifBlank { "female" }.lowercase()
                                check(selectedVoice == "female" || selectedVoice == "male") {
                                    "Select Female or Male for Indic Tiny TTS."
                                }
                                IndicTinyTtsEngine.create(this@VoiceRelayService, language).use { engine ->
                                    engine.synthesizeToWav(text, outputFile, selectedVoice)
                                }
                            }
                            "kokoro" -> {
                                val pack = SpeechModelCatalog.kokoro82m()
                                check(speechManager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
                                    "Kokoro-82M is not downloaded. Download it from ChatWork → Model Downloads."
                                }
                                val defaultVoice = if (language == "hi") "hf_alpha" else "af_heart"
                                val selectedVoice = voiceId.ifBlank { defaultVoice }
                                val engine = kokoroTtsEngine ?: synchronized(this@VoiceRelayService) {
                                    kokoroTtsEngine ?: KokoroTtsEngine(this@VoiceRelayService).also { kokoroTtsEngine = it }
                                }
                                engine.synthesizeToWav(
                                    pack = pack,
                                    modelDirectory = speechManager.modelDirectory(pack),
                                    text = text,
                                    voiceId = selectedVoice,
                                    outputFile = outputFile
                                )
                            }
                            "itantra" -> {
                                val pack = SpeechModelCatalog.itantraVits(language)
                                check(speechManager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
                                    "iTantra VITS model files are not fully downloaded. Check ChatWork → Model Downloads."
                                }
                                SherpaVitsTtsEngine.create(this@VoiceRelayService, pack).use { engine ->
                                    engine.synthesizeToWav(text, outputFile)
                                }
                            }
                            else -> throw IllegalArgumentException("Select Kokoro-82M, Indic Tiny TTS or iTantra VITS for Hindi and English.")
                        }
                    }
                    else -> throw IllegalArgumentException("Only Gujarati (Indic Tiny TTS), Hindi and English (Kokoro-82M) are supported.")
                }
                check(outputFile.isFile && outputFile.length() > 44L) { "The selected offline model returned empty audio." }
                VoiceRelayApi.uploadAudio(token, jobId, outputFile.readBytes())
                setStatus("Offline model voice audio delivered to website. Waiting for next request…")
            } catch (error: Exception) {
                runCatching { VoiceRelayApi.fail(token, jobId, error.message ?: "Offline TTS synthesis failed.") }
                setStatus("Voice conversion failed: " + (error.message ?: "unknown error"))
            } finally {
                outputFile.delete()
                activeAudioFile = null
                activeJobId = null
            }
        }.start()
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        running.set(false)
        pollThread?.interrupt()
        getSharedPreferences(STATUS_PREFS, MODE_PRIVATE).edit()
            .putString(STATUS_KEY, "Android stopped the phone server after its foreground-service time limit. Open the app to start it again.")
            .apply()
        stopSelf(startId)
    }

    override fun onDestroy() {
        running.set(false)
        pollThread?.interrupt()
        networkCallback?.let { callback ->
            runCatching { (getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(callback) }
        }
        networkCallback = null
        if (relayWakeLock?.isHeld == true) relayWakeLock?.release()
        relayWakeLock = null
        kokoroTtsEngine?.close()
        kokoroTtsEngine = null
        synchronized(relayAiEngineLock) {
            runCatching { relayAiEngine.unload() }
            relayAiModelId = null
        }
        getSharedPreferences(STATUS_PREFS, MODE_PRIVATE).edit().putString(STATUS_KEY, "Phone server stopped.").apply()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
        else stopForeground(true)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun setStatus(value: String) {
        val prefs = getSharedPreferences(STATUS_PREFS, MODE_PRIVATE)
        val previous = prefs.getString(STATUS_KEY, null)
        prefs.edit().putString(STATUS_KEY, value).apply()
        if (previous != value) recordEvent(
            if (value.contains("failed", true) || value.contains("error", true) || value.contains("reconnect", true)) "Error / connection" else "Server status",
            value
        )
    }

    private fun recordEvent(kind: String, message: String, detail: String = "", model: String = "") {
        val prefs = getSharedPreferences(STATUS_PREFS, MODE_PRIVATE)
        val events = try { org.json.JSONArray(prefs.getString(EVENTS_KEY, "[]") ?: "[]") } catch (_: Exception) { org.json.JSONArray() }
        events.put(org.json.JSONObject().put("at", System.currentTimeMillis()).put("kind", kind).put("message", message).put("detail", detail).put("error", kind.contains("error", true)))
        val trimmed = org.json.JSONArray()
        val cutoff = System.currentTimeMillis() - 86_400_000L
        for (i in 0 until events.length()) {
            val item = events.optJSONObject(i) ?: continue
            if (item.optLong("at") >= cutoff) trimmed.put(item)
        }
        prefs.edit().putString(EVENTS_KEY, trimmed.toString()).apply()
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(message))
        val token = activeToken
        if (!token.isNullOrBlank()) {
            diagnosticsExecutor.execute {
                runCatching { VoiceRelayApi.reportDiagnostic(token, kind, message, detail, model) }
            }
        }
    }

    private fun currentConnectionNotificationText(): String =
        if (hasValidatedInternet()) ONLINE_NOTIFICATION_TEXT else WAITING_NOTIFICATION_TEXT

    private fun buildNotification(@Suppress("UNUSED_PARAMETER") message: String): Notification {
        val restoreIntent = Intent(this, VoiceRelayNotificationRestoreReceiver::class.java)
            .setAction(ACTION_RESTORE_NOTIFICATION)
        val restorePendingIntent = PendingIntent.getBroadcast(
            this, NOTIFICATION_ID, restoreIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("ChatWork")
            .setContentText(currentConnectionNotificationText())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setDeleteIntent(restorePendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "ChatWork server", NotificationManager.IMPORTANCE_LOW).apply {
                    setSound(null, null)
                    enableVibration(false)
                    setShowBadge(false)
                }
            )
        }
    }

    companion object {
        const val CHANNEL_ID = "workly_ai_voice_server"
        const val NOTIFICATION_ID = 6401
        const val STATUS_PREFS = "workly_ai_voice_status"
        const val STATUS_KEY = "server_status"
        const val LAST_POLL_KEY = "last_successful_relay_poll"
        const val EVENTS_KEY = "recent_activity_events"
        const val POLL_INTERVAL_MS = 1_000L
        const val WORKER_CAPABILITY_REFRESH_MS = 5 * 60 * 1_000L
        const val WORKER_METRICS_REFRESH_MS = 30 * 1_000L
        const val ACTION_RESTORE_NOTIFICATION = "com.worklyindia.aivoice.RESTORE_SERVER_NOTIFICATION"
        const val ONLINE_NOTIFICATION_TEXT = "Shared phone server is online."
        const val WAITING_NOTIFICATION_TEXT = "Waiting for Data on..."
    }
}
