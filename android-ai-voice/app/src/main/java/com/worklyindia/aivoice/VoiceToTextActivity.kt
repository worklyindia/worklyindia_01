package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaRecorder
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
import android.widget.Toast
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Offline speech-to-text screen backed by the downloaded AI4Bharat IndicConformer packs. */
class VoiceToTextActivity : Activity() {
    private data class Language(val code: String, val name: String)

    private val languages = listOf(
        Language("as", "Assamese"), Language("bn", "Bengali"), Language("brx", "Bodo"),
        Language("doi", "Dogri"), Language("gu", "Gujarati"), Language("hi", "Hindi"),
        Language("kn", "Kannada"), Language("kok", "Konkani"), Language("ks", "Kashmiri"),
        Language("mai", "Maithili"), Language("ml", "Malayalam"), Language("mni", "Manipuri"),
        Language("mr", "Marathi"), Language("ne", "Nepali"), Language("or", "Odia"),
        Language("pa", "Punjabi"), Language("sa", "Sanskrit"), Language("sat", "Santali"),
        Language("sd", "Sindhi"), Language("ta", "Tamil"), Language("te", "Telugu"),
        Language("ur", "Urdu"), Language("en", "English")
    )

    private val manager by lazy { SpeechPackDownloadManager(this) }
    private val worker = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private var dark = false
    private lateinit var modelSpinner: Spinner
    private lateinit var languageSpinner: Spinner
    private lateinit var downloadButton: Button
    private lateinit var uploadButton: Button
    private lateinit var recordButton: Button
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView
    private lateinit var output: EditText
    @Volatile private var recording = false
    private var recordThread: Thread? = null
    private var pendingMicStart = false

    private val poll = object : Runnable {
        override fun run() {
            refreshPack()
        }
    }

    private val selectedLanguage: Language
        get() = languages.getOrElse(languageSpinner.selectedItemPosition.coerceAtLeast(0)) { languages[0] }

    private fun selectedPack() = SpeechModelCatalog.indicConformer(selectedLanguage.code)

    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
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
        refreshPack()
    }

    private fun buildUi() {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(18))
            setBackgroundColor(bg)
        }
        page.addView(Button(this).apply {
            text = "‹  Back"
            isAllCaps = false
            gravity = Gravity.START or Gravity.CENTER_VERTICAL
            setTextColor(primary)
            setBackgroundColor(bg)
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(-1, dp(44)))

        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(content)
        page.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))

        content.addView(label("Voice To Text", 23, primary, true).apply {
            setPadding(0, dp(4), 0, dp(12))
        })
        content.addView(label("SELECT MODEL", 12, secondary, true))
        modelSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@VoiceToTextActivity,
                android.R.layout.simple_spinner_item,
                listOf("AI4Bharat IndicConformer · Offline")
            ).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
        }
        content.addView(modelSpinner, LinearLayout.LayoutParams(-1, dp(48)))

        content.addView(label("SELECT LANGUAGE", 12, secondary, true).apply {
            setPadding(0, dp(12), 0, dp(2))
        })
        languageSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@VoiceToTextActivity,
                android.R.layout.simple_spinner_item,
                languages.map { it.name }
            ).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
            onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
                override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                    refreshPack()
                }
            }
        }
        content.addView(languageSpinner, LinearLayout.LayoutParams(-1, dp(48)))

        content.addView(label("MODEL DOWNLOAD", 12, secondary, true).apply {
            setPadding(0, dp(14), 0, dp(4))
        })
        status = label("Checking model…", 13, secondary, false)
        content.addView(status)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        content.addView(progress, LinearLayout.LayoutParams(-1, dp(6)))
        downloadButton = Button(this).apply {
            isAllCaps = false
            text = "Download Model"
            setOnClickListener { askNetworkChoice() }
        }
        content.addView(downloadButton, LinearLayout.LayoutParams(-1, dp(48)))

        content.addView(label("TRANSCRIBE AUDIO", 12, secondary, true).apply {
            setPadding(0, dp(20), 0, dp(6))
        })
        content.addView(label("Choose an audio file from your phone, or record your voice directly.", 13, secondary, false))
        uploadButton = Button(this).apply {
            text = "Upload Audio"
            isAllCaps = false
            setOnClickListener {
                if (isModelReady()) chooseAudio()
                else showNeedModel()
            }
        }
        content.addView(uploadButton, LinearLayout.LayoutParams(-1, dp(50)))

        recordButton = Button(this).apply {
            text = "●  Start Speaking"
            isAllCaps = false
            setOnClickListener { onRecordClicked() }
        }
        content.addView(recordButton, LinearLayout.LayoutParams(-1, dp(50)))

        content.addView(label("CONVERTED TEXT", 12, secondary, true).apply {
            setPadding(0, dp(20), 0, dp(6))
        })
        output = EditText(this).apply {
            minLines = 5
            maxLines = 12
            gravity = Gravity.TOP or Gravity.START
            hint = "Your transcribed text will appear here…"
            textSize = 16f
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setTextColor(primary)
            setHintTextColor(secondary)
            setBackgroundColor(surface)
        }
        content.addView(output, LinearLayout.LayoutParams(-1, dp(170)))
        val copy = Button(this).apply {
            text = "Copy Text"
            isAllCaps = false
            setOnClickListener {
                val value = output.text.toString().trim()
                if (value.isNotEmpty()) {
                    val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Transcribed text", value))
                    Toast.makeText(this@VoiceToTextActivity, "Text copied.", Toast.LENGTH_SHORT).show()
                }
            }
        }
        content.addView(copy, LinearLayout.LayoutParams(-1, dp(46)))
        content.addView(label("After the model is downloaded, audio transcription runs offline on this phone.", 12, secondary, false).apply {
            setPadding(0, dp(12), 0, dp(4))
        })

        setContentView(page)
    }

    private fun refreshPack() {
        if (!::status.isInitialized) return
        val pack = selectedPack()
        val snap = runCatching { manager.snapshot(pack) }.getOrNull()
        if (snap == null) {
            status.text = "Could not read model status."
            return
        }
        status.text = when (snap.state) {
            SpeechPackDownloadManager.State.COMPLETE -> "Downloaded · Ready · 100%"
            SpeechPackDownloadManager.State.RUNNING -> "Downloading · ${snap.percent}% · ${formatMb(snap.downloadedBytes)} / ${formatMb(snap.totalBytes)} MB"
            SpeechPackDownloadManager.State.PENDING -> "Waiting for network…"
            SpeechPackDownloadManager.State.PAUSED -> "Paused · waiting for network"
            SpeechPackDownloadManager.State.FAILED -> "Download failed · You can retry"
            else -> "Not downloaded · ${formatMb(snap.totalBytes)} MB"
        }
        progress.progress = snap.percent
        progress.visibility = if (snap.state == SpeechPackDownloadManager.State.RUNNING) View.VISIBLE else View.GONE
        downloadButton.text = if (snap.state == SpeechPackDownloadManager.State.COMPLETE) "Model Downloaded" else if (
            snap.state == SpeechPackDownloadManager.State.RUNNING ||
            snap.state == SpeechPackDownloadManager.State.PENDING ||
            snap.state == SpeechPackDownloadManager.State.PAUSED
        ) "Downloading…" else if (snap.state == SpeechPackDownloadManager.State.FAILED) "Retry Download" else "Download Model"
        downloadButton.isEnabled = snap.state != SpeechPackDownloadManager.State.RUNNING &&
            snap.state != SpeechPackDownloadManager.State.PENDING &&
            snap.state != SpeechPackDownloadManager.State.PAUSED &&
            snap.state != SpeechPackDownloadManager.State.COMPLETE
        uploadButton.isEnabled = snap.state == SpeechPackDownloadManager.State.COMPLETE
        recordButton.isEnabled = snap.state == SpeechPackDownloadManager.State.COMPLETE || recording
        if (snap.state == SpeechPackDownloadManager.State.RUNNING ||
            snap.state == SpeechPackDownloadManager.State.PENDING ||
            snap.state == SpeechPackDownloadManager.State.PAUSED) {
            handler.removeCallbacks(poll)
            handler.postDelayed(poll, 1000L)
        }
    }

    private fun askNetworkChoice() {
        AlertDialog.Builder(this)
            .setTitle("Download ${selectedLanguage.name} speech model?")
            .setMessage("The selected offline model is about ${formatMb(selectedPack().totalBytes)} MB. Choose Wi-Fi only or allow mobile data.")
            .setNegativeButton("Cancel", null)
            .setNeutralButton("Wi-Fi only") { _, _ -> startDownload(false) }
            .setPositiveButton("Allow mobile data") { _, _ -> startDownload(true) }
            .show()
    }

    private fun startDownload(allowMobile: Boolean) {
        runCatching { manager.start(selectedPack(), allowMobile) }
            .onSuccess { refreshPack(); Toast.makeText(this, "Model download started.", Toast.LENGTH_SHORT).show() }
            .onFailure { Toast.makeText(this, it.message ?: "Could not start model download.", Toast.LENGTH_LONG).show() }
    }

    private fun isModelReady(): Boolean = runCatching {
        OfflineSpeechEngineFactory.isReady(this, selectedPack())
    }.getOrDefault(false)

    private fun showNeedModel() {
        AlertDialog.Builder(this)
            .setTitle("Download model first")
            .setMessage("Download the selected language model before converting audio. The model will then work offline.")
            .setPositiveButton("OK", null)
            .show()
    }

    private fun chooseAudio() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "audio/*"
        }
        startActivityForResult(intent, REQUEST_AUDIO)
    }

    @Deprecated("Use Activity Result API in a future cleanup")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_AUDIO && resultCode == RESULT_OK) {
            val uri = data?.data ?: return
            transcribeUri(uri)
        }
    }

    private fun transcribeUri(uri: Uri) {
        setBusy(true, "Reading audio file…")
        worker.execute {
            try {
                val samples = decodeAudio(uri)
                transcribeSamples(samples)
            } catch (error: Throwable) {
                showError(error.message ?: "Could not read this audio file.")
            }
        }
    }

    private fun decodeAudio(uri: Uri): FloatArray {
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null
        val pcm = ByteArrayOutputStream()
        var sampleRate = 16_000
        var channels = 1
        var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT
        try {
            extractor.setDataSource(this, uri, null)
            var audioTrack = -1
            var inputFormat: android.media.MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(android.media.MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) {
                    audioTrack = i
                    inputFormat = format
                    break
                }
            }
            check(audioTrack >= 0 && inputFormat != null) { "No supported audio track was found." }
            extractor.selectTrack(audioTrack)
            sampleRate = inputFormat.getInteger(android.media.MediaFormat.KEY_SAMPLE_RATE)
            channels = inputFormat.getInteger(android.media.MediaFormat.KEY_CHANNEL_COUNT)
            val mime = inputFormat.getString(android.media.MediaFormat.KEY_MIME)!!
            codec = MediaCodec.createDecoderByType(mime)
            codec.configure(inputFormat, null, null, 0)
            codec.start()
            val info = MediaCodec.BufferInfo()
            var inputDone = false
            var outputDone = false
            var format = inputFormat
            while (!outputDone) {
                if (!inputDone) {
                    val inputIndex = codec.dequeueInputBuffer(10_000)
                    if (inputIndex >= 0) {
                        val inputBuffer = codec.getInputBuffer(inputIndex)!!
                        inputBuffer.clear()
                        val size = extractor.readSampleData(inputBuffer, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(inputIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            codec.queueInputBuffer(inputIndex, 0, size, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }
                val outputIndex = codec.dequeueOutputBuffer(info, 10_000)
                when {
                    outputIndex >= 0 -> {
                        val outputBuffer = codec.getOutputBuffer(outputIndex)
                        if (info.size > 0 && outputBuffer != null) {
                            outputBuffer.position(info.offset)
                            outputBuffer.limit(info.offset + info.size)
                            val chunk = ByteArray(info.size)
                            outputBuffer.get(chunk)
                            pcm.write(chunk)
                        }
                        outputDone = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                        codec.releaseOutputBuffer(outputIndex, false)
                    }
                    outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        format = codec.outputFormat
                        sampleRate = format.getInteger(android.media.MediaFormat.KEY_SAMPLE_RATE)
                        channels = format.getInteger(android.media.MediaFormat.KEY_CHANNEL_COUNT)
                        pcmEncoding = if (format.containsKey(android.media.MediaFormat.KEY_PCM_ENCODING)) {
                            format.getInteger(android.media.MediaFormat.KEY_PCM_ENCODING)
                        } else AudioFormat.ENCODING_PCM_16BIT
                    }
                }
            }
            return pcmTo16kMono(pcm.toByteArray(), sampleRate, channels, pcmEncoding)
        } finally {
            runCatching { codec?.stop() }
            runCatching { codec?.release() }
            extractor.release()
        }
    }

    private fun pcmTo16kMono(bytes: ByteArray, sampleRate: Int, channels: Int, encoding: Int): FloatArray {
        require(bytes.isNotEmpty()) { "The selected audio file contains no decoded audio." }
        require(sampleRate > 0 && channels > 0) { "The audio format is not supported." }
        val bytesPerSample = if (encoding == AudioFormat.ENCODING_PCM_FLOAT) 4 else 2
        val frameSize = bytesPerSample * channels
        val frames = bytes.size / frameSize
        require(frames > 0) { "The audio file is empty." }
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        val mono = FloatArray(frames)
        for (frame in 0 until frames) {
            var total = 0f
            repeat(channels) {
                total += if (encoding == AudioFormat.ENCODING_PCM_FLOAT) {
                    buffer.float
                } else {
                    buffer.short / 32768f
                }
            }
            mono[frame] = (total / channels).coerceIn(-1f, 1f)
        }
        if (sampleRate == OfflineSpeechRecognizer.SAMPLE_RATE) return mono
        val outputCount = max(1, (frames.toDouble() * OfflineSpeechRecognizer.SAMPLE_RATE / sampleRate).toInt())
        val resampled = FloatArray(outputCount)
        for (i in 0 until outputCount) {
            val source = i.toDouble() * sampleRate / OfflineSpeechRecognizer.SAMPLE_RATE
            val left = floor(source).toInt().coerceIn(0, frames - 1)
            val right = min(left + 1, frames - 1)
            val fraction = (source - left).toFloat()
            resampled[i] = mono[left] * (1f - fraction) + mono[right] * fraction
        }
        return resampled
    }

    private fun onRecordClicked() {
        if (recording) {
            recording = false
            recordButton.text = "Finishing recording…"
            recordButton.isEnabled = false
            return
        }
        if (!isModelReady()) {
            showNeedModel()
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingMicStart = true
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
            return
        }
        startRecording()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_MIC) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED && pendingMicStart) {
                pendingMicStart = false
                startRecording()
            } else {
                pendingMicStart = false
                Toast.makeText(this, "Microphone permission is required to record speech.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun startRecording() {
        recording = true
        recordButton.text = "■  Stop & Convert"
        recordButton.isEnabled = true
        status.text = "Recording… Speak clearly, then tap Stop & Convert."
        recordThread = Thread {
            var recorder: AudioRecord? = null
            try {
                val minimum = AudioRecord.getMinBufferSize(
                    OfflineSpeechRecognizer.SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )
                check(minimum > 0) { "This phone does not support 16 kHz microphone recording." }
                recorder = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    OfflineSpeechRecognizer.SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    max(minimum, 4096)
                )
                check(recorder.state == AudioRecord.STATE_INITIALIZED) { "Could not start the microphone." }
                recorder.startRecording()
                val bytes = ByteArrayOutputStream()
                val chunk = ByteArray(max(minimum, 4096))
                val maximumBytes = OfflineSpeechRecognizer.SAMPLE_RATE * 2 * 600
                while (recording && bytes.size() < maximumBytes) {
                    val count = recorder.read(chunk, 0, chunk.size)
                    if (count > 0) bytes.write(chunk, 0, count)
                }
                recording = false
                recorder.stop()
                recorder.release()
                recorder = null
                val raw = bytes.toByteArray()
                val shortBuffer = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
                val samples = FloatArray(shortBuffer.remaining()) { shortBuffer.get() / 32768f }
                if (samples.isEmpty()) throw IllegalStateException("No speech was recorded.")
                transcribeSamples(samples)
            } catch (error: Throwable) {
                recording = false
                showError(error.message ?: "Microphone recording failed.")
            } finally {
                runCatching { recorder?.stop() }
                runCatching { recorder?.release() }
                runOnUiThread {
                    recordButton.text = "●  Start Speaking"
                    recordButton.isEnabled = isModelReady()
                }
            }
        }.apply { name = "VoiceToTextRecorder"; start() }
    }

    private fun transcribeSamples(samples: FloatArray) {
        runOnUiThread { setBusy(true, "Converting speech to text offline…") }
        try {
            val text = OfflineSpeechEngineFactory.openIndicConformer(this, selectedLanguage.code).use { engine ->
                engine.transcribe(samples)
            }
            runOnUiThread {
                output.setText(text)
                setBusy(false, if (text.isBlank()) "No speech detected. Try a clearer recording." else "Transcription complete · Offline")
            }
        } catch (error: Throwable) {
            showError(error.message ?: "Speech-to-text conversion failed.")
        }
    }

    private fun setBusy(busy: Boolean, message: String) {
        runOnUiThread {
            status.text = message
            uploadButton.isEnabled = !busy && isModelReady()
            downloadButton.isEnabled = !busy && !isModelReady()
            recordButton.isEnabled = !busy && isModelReady()
            if (busy) progress.visibility = View.VISIBLE else refreshPack()
        }
    }

    private fun showError(message: String) {
        runOnUiThread {
            setBusy(false, message)
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
    }

    private fun label(value: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = value
        textSize = size.toFloat()
        setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    private fun formatMb(bytes: Long) = String.format(Locale.US, "%.1f", bytes / 1_000_000.0)

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        recording = false
        handler.removeCallbacksAndMessages(null)
        worker.shutdownNow()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_AUDIO = 1201
        private const val REQUEST_MIC = 1202
    }
}
