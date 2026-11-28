package com.worklyindia.aivoice

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.airbnb.lottie.LottieAnimationView
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Hands-free foreground voice conversation. Uses the exact downloaded STT/TTS
 * packs selected in JARVIS Setup; it does not start the background wake-word service.
 */
class JarvisCallActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private val ended = AtomicBoolean(false)
    private val turnRunning = AtomicBoolean(false)
    @Volatile private var activeRecorder: AudioRecord? = null
    private var player: MediaPlayer? = null
    private lateinit var status: TextView
    private lateinit var transcript: TextView
    private lateinit var reply: TextView
    private lateinit var animation: LottieAnimationView
    private val history = StringBuilder(
        "System: You are JARVIS, ChatWork's concise multilingual voice assistant. " +
            "Understand Hindi, Hinglish, Gujarati and English. Reply naturally in the user's language, " +
            "keep spoken answers brief, and do not claim to control phone settings.\\n"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = 0xFF080F1D.toInt()
        window.navigationBarColor = 0xFF080F1D.toInt()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        buildUi()

        val cfg = JarvisSettingsStore.read(this)
        if (cfg.apiKey.isBlank()) {
            status.text = "JARVIS Setup incomplete. Save your AI provider API key first."
            return
        }
        status.text = "Preparing selected speech models…"
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
        } else {
            startListening()
        }
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(18), dp(12), dp(18), dp(16))
            setBackgroundColor(0xFF080F1D.toInt())
        }
        root.addView(TextView(this).apply {
            text = "CHATWORK"
            textSize = 13f
            letterSpacing = .2f
            setTextColor(0xFF8EA7C9.toInt())
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, dp(30)))

        animation = LottieAnimationView(this).apply {
            setAnimation("AI_Chatwork_Jarvis_3D_GIF_v5.json")
            repeatCount = com.airbnb.lottie.LottieDrawable.INFINITE
            scaleType = android.widget.ImageView.ScaleType.FIT_CENTER
            contentDescription = "ChatWork JARVIS 3D animated logo"
        }
        root.addView(animation, LinearLayout.LayoutParams(-1, 0, 1.15f))

        root.addView(TextView(this).apply {
            text = "ChatWork"
            textSize = 28f
            gravity = Gravity.CENTER
            setTextColor(-1)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }, LinearLayout.LayoutParams(-1, dp(44)))

        status = TextView(this).apply {
            text = "Starting voice session…"
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(0xFF9DB1CC.toInt())
            setPadding(dp(8), dp(8), dp(8), dp(14))
        }
        root.addView(status)

        val scrollContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(makeBodyText("You: Waiting for your voice…").also { transcript = it })
            addView(makeBodyText("ChatWork: Your reply will appear here.").also { reply = it })
        }
        root.addView(ScrollView(this).apply { addView(scrollContent) },
            LinearLayout.LayoutParams(-1, 0, 1f))

        root.addView(TextView(this).apply {
            text = "Listening automatically · Speak naturally · No microphone button needed"
            textSize = 12f
            gravity = Gravity.CENTER
            setTextColor(0xFF8EA7C9.toInt())
            setPadding(0, dp(10), 0, dp(10))
        })
        root.addView(android.widget.Button(this).apply {
            text = "End ChatWork Call"
            isAllCaps = false
            setOnClickListener { finishCall() }
        }, LinearLayout.LayoutParams(-1, dp(50)))
        setContentView(root)
        animation.playAnimation()
    }

    private fun makeBodyText(value: String) = TextView(this).apply {
        text = value
        textSize = 16f
        setTextColor(0xFFE4ECF7.toInt())
        setPadding(dp(14), dp(14), dp(14), dp(14))
        setBackgroundColor(0xFF121F32.toInt())
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) }
    }

    private fun startListening() {
        if (ended.get() || isFinishing || !turnRunning.compareAndSet(false, true)) return
        val cfg = JarvisSettingsStore.read(this)
        status.text = "Listening automatically · Speak now"
        executor.execute {
            try {
                val samples = captureUntilSilence()
                if (ended.get()) return@execute
                if (samples.isEmpty()) {
                    turnRunning.set(false)
                    runOnUiThread {
                        if (!ended.get()) {
                            status.text = "I didn't hear anything. Listening again…"
                            status.postDelayed({ startListening() }, 600L)
                        }
                    }
                    return@execute
                }

                val recognizer = OfflineSpeechEngineFactory.openIndicConformer(this, cfg.sttLanguage)
                val spoken = try { recognizer.transcribe(samples) } finally { recognizer.close() }
                if (ended.get()) return@execute
                if (spoken.isBlank()) {
                    turnRunning.set(false)
                    runOnUiThread {
                        if (!ended.get()) {
                            status.text = "Speech not clear. Please speak again…"
                            status.postDelayed({ startListening() }, 600L)
                        }
                    }
                    return@execute
                }

                history.append("User: ").append(spoken).append("\\n")
                runOnUiThread {
                    if (!ended.get()) {
                        transcript.text = "You: $spoken"
                        status.text = "ChatWork is thinking…"
                    }
                }

                val answer = JarvisSettingsStore.generateReply(this, history.toString(), cfg)
                history.append("Assistant: ").append(answer).append("\\n")
                if (ended.get()) return@execute
                val audioFile = synthesizeWithSelectedModel(answer, cfg.ttsModel, cfg.ttsLanguage)
                turnRunning.set(false)
                runOnUiThread {
                    if (!ended.get()) {
                        reply.text = "ChatWork: $answer"
                        playReply(audioFile)
                    }
                }
            } catch (error: Throwable) {
                turnRunning.set(false)
                runOnUiThread {
                    if (!ended.get()) {
                        status.text = "Voice error: ${error.message ?: error.javaClass.simpleName}"
                    }
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun captureUntilSilence(): FloatArray {
        val sampleRate = OfflineSpeechRecognizer.SAMPLE_RATE
        val minBuffer = AudioRecord.getMinBufferSize(
            sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
        check(minBuffer > 0) { "This phone does not support 16 kHz microphone recording (code $minBuffer)." }
        val recorder = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minBuffer, 4096)
        )
        check(recorder.state == AudioRecord.STATE_INITIALIZED) {
            recorder.release()
            "Microphone could not start. Check Android microphone permission."
        }
        activeRecorder = recorder
        val captured = ArrayList<Short>(sampleRate * 8)
        val buffer = ShortArray(2048)
        var speechStarted = false
        var silenceSamples = 0
        val startedAt = android.os.SystemClock.elapsedRealtime()
        try {
            recorder.startRecording()
            while (!ended.get()) {
                val count = recorder.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
                if (count <= 0) break
                var energy = 0.0
                for (i in 0 until count) energy += buffer[i].toDouble() * buffer[i].toDouble()
                val rms = kotlin.math.sqrt(energy / count)
                for (i in 0 until count) captured.add(buffer[i])
                if (rms >= VOICE_RMS_THRESHOLD) {
                    speechStarted = true
                    silenceSamples = 0
                } else if (speechStarted) {
                    silenceSamples += count
                    if (silenceSamples >= sampleRate * SILENCE_SECONDS) break
                }
                if (captured.size >= sampleRate * MAX_UTTERANCE_SECONDS) break
                if (!speechStarted &&
                    android.os.SystemClock.elapsedRealtime() - startedAt >= NO_SPEECH_TIMEOUT_MS) break
            }
        } finally {
            activeRecorder = null
            runCatching { recorder.stop() }
            recorder.release()
        }
        if (!speechStarted || captured.size < sampleRate / 4) return FloatArray(0)
        return FloatArray(captured.size) { captured[it].toFloat() / Short.MAX_VALUE.toFloat() }
    }

    private fun synthesizeWithSelectedModel(text: String, model: String, language: String): File {
        val manager = SpeechPackDownloadManager(this)
        val pack = when (model) {
            "indic" -> SpeechModelCatalog.indicTinyTts(language)
            "kokoro" -> SpeechModelCatalog.kokoro82m()
            else -> SpeechModelCatalog.itantraVits(language)
        }
        check(manager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
            "Selected Text To Voice model is not fully downloaded: ${pack.title}. Open JARVIS Setup."
        }
        val output = File(cacheDir, "chatwork_call_${System.currentTimeMillis()}.wav")
        when (model) {
            "indic" -> IndicTinyTtsEngine.create(this, language).use { engine ->
                engine.synthesizeToWav(text, output)
            }
            "kokoro" -> {
                val voice = if (language == "hi") "hf_alpha" else "af_heart"
                KokoroTtsEngine(this).use { engine ->
                    engine.synthesizeToWav(pack, manager.modelDirectory(pack), text, voice, output)
                }
            }
            else -> SherpaVitsTtsEngine.create(this, pack).use { engine ->
                engine.synthesizeToWav(text, output)
            }
        }
        check(output.isFile && output.length() > 44L) {
            "Selected Text To Voice model generated no playable audio."
        }
        return output
    }

    private fun playReply(file: File) {
        if (ended.get()) return
        status.text = "Speaking with your selected voice model…"
        player?.release()
        player = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            setDataSource(file.absolutePath)
            setOnPreparedListener { mp ->
                if (ended.get()) {
                    mp.release()
                } else {
                    mp.start()
                    status.text = "ChatWork is speaking…"
                }
            }
            setOnCompletionListener { mp ->
                mp.release()
                if (player === mp) player = null
                if (!ended.get()) {
                    status.text = "Listening automatically…"
                    status.postDelayed({ startListening() }, 350L)
                }
            }
            setOnErrorListener { mp, what, extra ->
                mp.release()
                if (player === mp) player = null
                if (!ended.get()) status.text = "Audio playback failed ($what/$extra)."
                true
            }
            prepareAsync()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_MIC) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) startListening()
            else status.text = "Microphone permission is required for a hands-free call."
        }
    }

    private fun finishCall() {
        if (!ended.compareAndSet(false, true)) return
        runCatching { activeRecorder?.stop() }
        player?.release()
        player = null
        animation.cancelAnimation()
        finish()
    }

    override fun onDestroy() {
        ended.set(true)
        runCatching { activeRecorder?.stop() }
        player?.release()
        player = null
        animation.cancelAnimation()
        executor.shutdownNow()
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val REQUEST_MIC = 4401
        private const val VOICE_RMS_THRESHOLD = 550.0
        private const val SILENCE_SECONDS = 1.1
        private const val MAX_UTTERANCE_SECONDS = 18
        private const val NO_SPEECH_TIMEOUT_MS = 8_000L
    }
}
