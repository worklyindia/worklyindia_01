package com.worklyindia.aivoice

import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.content.res.Configuration
import android.content.Intent
import android.net.Uri
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import java.util.Locale
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
    private data class DownloadRow(val status: TextView, val progress: ProgressBar, val action: Button, var lastBytes: Long = 0L, var lastAt: Long = 0L, val refresh: () -> Unit)
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
        val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(18),dp(12),dp(18),dp(20)); setBackgroundColor(bg) }
        page.addView(Button(this).apply { text="‹  Back to ChatWork"; isAllCaps=false; setTextColor(primary); setBackgroundColor(bg); gravity=android.view.Gravity.START or android.view.Gravity.CENTER_VERTICAL; setOnClickListener { finish() } })
        val scroll=ScrollView(this); val list=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL }; scroll.addView(list); page.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        list.addView(label("OFFLINE AI CHAT · CHOOSE ONE MODEL",16,primary,true))
        qwenManager.models.forEach { addQwenCard(list,it) }
        list.addView(label("VOICE RECOGNITION · OFFLINE SPEECH TO TEXT",16,primary,true).apply { setPadding(0,dp(18),0,dp(5)) })
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
        list.addView(label("TEXT TO SPEECH · OFFLINE",16,primary,true).apply { setPadding(0,dp(18),0,dp(5)) })
        addSpeechPack(list,"Indic Tiny TTS Hindi","Indic Tiny TTS · Hindi offline text-to-speech",SpeechModelCatalog.indicTinyTts("hi"))
        addSpeechPack(list,"Indic Tiny TTS Gujarati","Indic Tiny TTS · Gujarati offline text-to-speech",SpeechModelCatalog.indicTinyTts("gu"))
        addSpeechPack(list,"Indic Tiny TTS English","Indic Tiny TTS · English offline text-to-speech",SpeechModelCatalog.indicTinyTts("en"))
        addSpeechPack(list,"MOSS-TTS-Nano 100M","Native Android ONNX runtime + SentencePiece · approximately 717 MB download · custom English text test",SpeechModelCatalog.mossTtsNano())
        addSpeechPack(list,"Qwen3-TTS 0.6B Base · Q4_K_M","Native C++/GGML Android engine · approximately 884 MB download · arm64 / Android 12+",SpeechModelCatalog.qwen3Tts())
        addSpeechPack(list,"Chatterbox Multilingual · Q4_K","Native QVAC C++ Android engine · Hindi included · approximately 637 MB",SpeechModelCatalog.chatterboxMultilingual())
        addSpeechPack(list,"CosyVoice 3 · Q4/Q8","Native QVAC C++ Android engine · approximately 950 MB · includes reference voice assets",SpeechModelCatalog.cosyVoice3())
        list.addView(label("ADDITIONAL TTS MODELS",16,primary,true).apply { setPadding(0,dp(22),0,dp(5)) })
        addServerModelCard(list,"AI4Bharat IndicF5","Indian-language TTS including Hindi and Gujarati. Requires a compatible inference backend.","https://huggingface.co/ai4bharat/IndicF5")
        addServerModelCard(list,"Indic Parler-TTS","Indian-language preset voices and style control. Requires a compatible inference backend.","https://huggingface.co/ai4bharat/indic-parler-tts")
        addServerModelCard(list,"Fish Speech","Advanced expressive speech generation. Check model licence and runtime requirements.","https://github.com/fishaudio/fish-speech")
        addServerModelCard(list,"Kokoro-82M","Compact English-focused TTS. Browser test is available on the Workly India website; native Android engine is not integrated yet.","https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX")
        list.addView(label("IndicF5, Indic Parler-TTS, Fish Speech and Kokoro are source links only; they are not downloaded, installed or playable native engines. Native Download/Test/Delete controls are provided separately for supported local model packs, but each still requires a successful build and phone inference test before being marked verified.",12,secondary,false).apply { setPadding(0,dp(8),0,dp(16)) })
        list.addView(label("ON-DEVICE AI · MOBILE ONLY",16,primary,true).apply { setPadding(0,dp(22),0,dp(5)) })
        addLocalOnlyCard(list,"Image Generation","No verified lightweight image model is configured for this phone. Image generation stays unavailable until a compatible on-device model is integrated.")
        addLocalOnlyCard(list,"Wan 2.1 Text-to-Video 1.3B","Not supported on this phone: Wan needs a multi-gigabyte model pack and substantially more RAM. Download is disabled to prevent storage and memory failures.")
        addLocalOnlyCard(list,"Offline Translation · ML Kit","Lightweight language packs are downloaded to this phone on first use (about 30 MB per language). Translation runs on-device; no translation server is used.")
        list.addView(label("Model files are downloaded from their listed repositories. Supported speech inference runs on-device; these native engines do not send text to a remote AI inference server.",12,secondary,false).apply { setPadding(0,dp(8),0,dp(16)) })
        setContentView(page)
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
        val card=card(parent,model.title + if(model.premium) " · PREMIUM" else "","Download: " + "%.0f MB".format(Locale.US,model.size/1e6) + " · Requires about %.1f GB free RAM".format(Locale.US,model.minFreeRam/1e9))
        val status=label("Checking model…",13,secondary,true)
        val progress=ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply { max=100; visibility=View.GONE }
        val action=Button(this).apply { isAllCaps=false }
        val delete=Button(this).apply { text="Delete Model"; isAllCaps=false; visibility=View.GONE }
        card.addView(status); card.addView(progress); card.addView(action); card.addView(delete)
        delete.setOnClickListener {
            AlertDialog.Builder(this).setTitle("Delete ${model.title}?")
                .setMessage("This removes the downloaded model file from this app's storage.")
                .setNegativeButton("Cancel",null)
                .setPositiveButton("Delete") { _,_ -> qwenManager.cancelAndDelete(model); refreshAll() }
                .show()
        }
        var lastBytes = 0L
        var lastAt = 0L
        val row=DownloadRow(status,progress,action) {
            val snap=runCatching { qwenManager.snapshot(model) }.getOrNull() ?: return@DownloadRow
            val supported=qwenManager.isSupported(model,availableRam)
            val now=android.os.SystemClock.elapsedRealtime()
            val speed=if(lastAt>0 && now>lastAt && snap.downloaded>=lastBytes) (snap.downloaded-lastBytes)*1000L/(now-lastAt) else 0L
            lastAt=now; lastBytes=snap.downloaded
            val transferred="%.1f / %.1f MB".format(Locale.US,snap.downloaded/1e6,snap.total/1e6)
            val speedText=if(snap.state==QwenModelManager.State.RUNNING && speed>0) " · " + "%.1f MB/s".format(Locale.US,speed/1e6) else ""
            status.text=when(snap.state) {
                QwenModelManager.State.READY -> "Downloaded · Ready · " + transferred
                QwenModelManager.State.RUNNING -> "Downloading · " + snap.progressPercent + "% · " + transferred + speedText
                QwenModelManager.State.PENDING -> "Waiting for network · " + transferred
                QwenModelManager.State.PAUSED -> "Paused · " + transferred
                QwenModelManager.State.FAILED -> "Download failed · " + transferred + " · Retry"
                else -> if(supported) "Not downloaded · " + transferred else "Not supported · need more free RAM"
            }
            progress.progress=snap.progressPercent
            progress.visibility=if(snap.state==QwenModelManager.State.RUNNING) View.VISIBLE else View.GONE
            delete.visibility=if(snap.state==QwenModelManager.State.READY || snap.downloaded>0L) View.VISIBLE else View.GONE
            action.isEnabled=supported && snap.state!=QwenModelManager.State.RUNNING && snap.state!=QwenModelManager.State.PENDING && snap.state!=QwenModelManager.State.PAUSED
            action.text=when { !supported -> "Not supported on this phone"; snap.state==QwenModelManager.State.READY -> "Use this model in Chat"; snap.state==QwenModelManager.State.FAILED -> "Retry download"; else -> "Download " + model.title.substringAfter("Qwen 2.5 ") }
            action.setOnClickListener {
                if(snap.state==QwenModelManager.State.READY) {
                    getSharedPreferences("workly_qwen_models",MODE_PRIVATE).edit().putString("selected_model_id",model.id).apply()
                    status.text="Selected for Offline AI Chat. Only this model will be loaded."
                } else withNetworkChoice { allow -> runCatching { qwenManager.startDownload(model,allow); refreshAll() }.onFailure { status.text=it.message ?: "Download failed." } }
            }
        }
        rows.add(row); row.refresh()
    }
    private fun addSpeechPack(parent: LinearLayout,title:String,subtitle:String,pack:SpeechModelCatalog.Pack) {
        val card=card(parent,title,subtitle); val status=label("Checking saved files…",13,secondary,true)
        val progress=ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply { max=100; visibility=View.GONE }
        val action=Button(this).apply { isAllCaps=false; text="Download"; setOnClickListener { withNetworkChoice { allow -> runCatching { speechManager.start(pack,allow); refreshAll() }.onFailure { status.text=it.message ?: "Download could not start." } } } }
        val isTts = pack.id.startsWith("indic-tiny-tts-")
        val isMoss = pack.id == "moss-tts-nano"
        val isQwen = pack.id == "qwen3-tts-06b-q4"
        val isQvacChatterbox = pack.id == "qvac-chatterbox-multilingual"
        val isQvacCosyVoice = pack.id == "qvac-cosyvoice3"
        val test=Button(this).apply { text="Test Model"; isAllCaps=false; visibility=View.GONE }
        val delete=Button(this).apply { text="Delete Model"; isAllCaps=false; visibility=View.GONE }
        card.addView(status);card.addView(progress);card.addView(action);card.addView(test);card.addView(delete)
        test.setOnClickListener { when { isMoss -> showMossTest(pack); isQwen -> showQwenTest(pack); isQvacChatterbox -> showQvacTest(pack, QvacTtsEngine.CHATTERBOX); isQvacCosyVoice -> showQvacTest(pack, QvacTtsEngine.COSYVOICE3); else -> showTtsTest(pack) } }
        delete.setOnClickListener {
            AlertDialog.Builder(this).setTitle("Delete ${pack.title}?")
                .setMessage("This removes this model's downloaded files from ChatWork storage.")
                .setNegativeButton("Cancel",null)
                .setPositiveButton("Delete") { _,_ -> speechManager.delete(pack); refreshAll() }
                .show()
        }
        var lastBytes = 0L
        var lastAt = 0L
        val row=DownloadRow(status,progress,action) {
            val s=runCatching { speechManager.snapshot(pack) }.getOrNull() ?: return@DownloadRow
            val now=android.os.SystemClock.elapsedRealtime()
            val speed=if(lastAt>0 && now>lastAt && s.downloadedBytes>=lastBytes) (s.downloadedBytes-lastBytes)*1000L/(now-lastAt) else 0L
            lastAt=now; lastBytes=s.downloadedBytes
            val speedText=if(s.state==SpeechPackDownloadManager.State.RUNNING && speed>0) " · " + "%.1f MB/s".format(Locale.US,speed/1e6) else ""
            status.text=when(s.state) {
                SpeechPackDownloadManager.State.COMPLETE -> "Ready · installed"
                SpeechPackDownloadManager.State.RUNNING -> "Downloading · ${s.percent}% · ${"%.1f".format(Locale.US,s.downloadedBytes/1e6)} / ${"%.1f".format(Locale.US,s.totalBytes/1e6)} MB" + speedText
                SpeechPackDownloadManager.State.PENDING -> "Waiting for network…"
                SpeechPackDownloadManager.State.PAUSED -> "Paused · waiting for network"
                SpeechPackDownloadManager.State.FAILED -> "Download failed · tap Retry"
                else -> "Not downloaded · ${s.totalBytes/1_000_000} MB"
            }
            progress.progress=s.percent; progress.visibility=if(s.state==SpeechPackDownloadManager.State.RUNNING) View.VISIBLE else View.GONE
            val installed=s.state==SpeechPackDownloadManager.State.COMPLETE
            action.visibility=if(installed || s.state==SpeechPackDownloadManager.State.RUNNING || s.state==SpeechPackDownloadManager.State.PENDING || s.state==SpeechPackDownloadManager.State.PAUSED) View.GONE else View.VISIBLE
            action.text=if(s.state==SpeechPackDownloadManager.State.FAILED) "Retry download" else "Download"
            test.visibility=if((isTts || isMoss || isQwen || isQvacChatterbox || isQvacCosyVoice) && installed) View.VISIBLE else View.GONE
            delete.visibility=if(installed || s.downloadedBytes>0L) View.VISIBLE else View.GONE
        }
        rows.add(row)
        row.refresh()
    }
    private fun showTtsTest(pack: SpeechModelCatalog.Pack) {
        val language = pack.languageCode
        val sample = when (language) {
            "hi" -> "नमस्ते! यह हिंदी टेक्स्ट टू स्पीच मॉडल का परीक्षण है।"
            "gu" -> "નમસ્તે! આ ગુજરાતી ટેક્સ્ટ ટુ સ્પીચ મોડેલની કસોટી છે."
            else -> "Hello! This is an offline text to speech model test."
        }
        val input=EditText(this).apply { setText(sample); minLines=3; maxLines=6; setPadding(dp(12),dp(10),dp(12),dp(10)) }
        AlertDialog.Builder(this).setTitle("Test ${pack.title}")
            .setMessage("Enter text in the selected model language.")
            .setView(input)
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Generate & Play") { _,_ ->
                val text=input.text.toString().trim()
                if(text.isBlank()) { Toast.makeText(this,"Enter text to test.",Toast.LENGTH_SHORT).show(); return@setPositiveButton }
                statusToast("Generating offline speech…")
                ttsExecutor.execute {
                    try {
                        IndicTinyTtsEngine.create(this,language).use { it.speak(text) }
                        runOnUiThread { Toast.makeText(this,"Voice test finished.",Toast.LENGTH_SHORT).show() }
                    } catch(error:Throwable) {
                        runOnUiThread { AlertDialog.Builder(this).setTitle("Voice test failed").setMessage(error.message ?: "Could not generate speech.").setPositiveButton("OK",null).show() }
                    }
                }
            }.show()
    }



    private fun showQvacTest(pack: SpeechModelCatalog.Pack, kind: Int) {
        val isChatterbox = kind == QvacTtsEngine.CHATTERBOX
        val title = if (isChatterbox) "Test Chatterbox Multilingual" else "Test CosyVoice 3"
        val sample = if (isChatterbox) {
            "नमस्ते! यह Chatterbox का हिंदी ऑफलाइन वॉइस टेस्ट है।"
        } else {
            "Hello! This is CosyVoice three running locally on Android."
        }
        val input = EditText(this).apply {
            setText(sample)
            minLines = 3
            maxLines = 6
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage("This model runs on-device. First load and generation can take time and use substantial RAM.")
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Generate & Play") { _, _ ->
                val text = input.text.toString().trim()
                if (text.isBlank()) {
                    Toast.makeText(this, "Enter text to test.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                statusToast("Loading native model and generating speech…")
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
                                language = "hi",
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
                                language = "en",
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
                                Toast.makeText(this, "Speech generated · ${sampleRate} Hz", Toast.LENGTH_LONG).show()
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

    private fun showQwenTest(pack: SpeechModelCatalog.Pack) {
        if (android.os.Build.VERSION.SDK_INT < 31) {
            Toast.makeText(this, "Qwen3-TTS requires Android 12 or newer.", Toast.LENGTH_LONG).show()
            return
        }
        val input = EditText(this).apply {
            setText("Hello! This is Qwen three text to speech running locally on Android.")
            minLines = 3
            maxLines = 6
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        AlertDialog.Builder(this)
            .setTitle("Test Qwen3-TTS")
            .setMessage("Enter English text. The 0.6B Q4 model runs locally on this phone and may take time on CPU.")
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Generate & Play") { _, _ ->
                val text = input.text.toString().trim()
                if (text.isBlank()) {
                    Toast.makeText(this, "Enter text to test.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                statusToast("Loading Qwen3-TTS and generating offline speech…")
                ttsExecutor.execute {
                    try {
                        val output = Qwen3TtsEngine(speechManager.modelDirectory(pack), 2).use { engine ->
                            engine.load()
                            engine.synthesizeToWav(text, java.io.File(cacheDir, "qwen3_tts_test.wav"))
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
                                        Toast.makeText(this@SpeechDownloadsActivity, "Qwen3 audio playback failed.", Toast.LENGTH_LONG).show()
                                        true
                                    }
                                    setOnPreparedListener { it.start() }
                                    prepareAsync()
                                }
                                Toast.makeText(this, "Qwen3 speech generated successfully.", Toast.LENGTH_LONG).show()
                            } catch (error: Throwable) {
                                Toast.makeText(this, error.message ?: "Could not play Qwen3 audio.", Toast.LENGTH_LONG).show()
                            }
                        }
                    } catch (error: Throwable) {
                        runOnUiThread {
                            AlertDialog.Builder(this)
                                .setTitle("Qwen3 voice test failed")
                                .setMessage(error.message ?: "Could not load or run the native Qwen3 model.")
                                .setPositiveButton("OK", null)
                                .show()
                        }
                    }
                }
            }
            .show()
    }

    private fun showMossTest(pack: SpeechModelCatalog.Pack) {
        val input = EditText(this).apply {
            setText("Hello! This is MOSS text to speech running offline on Android.")
            minLines = 3
            maxLines = 6
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        AlertDialog.Builder(this)
            .setTitle("Test MOSS-TTS-Nano")
            .setMessage("Enter English text. SentencePiece tokenization and ONNX speech generation run locally.")
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Generate & Play") { _, _ ->
                val text = input.text.toString().trim()
                if (text.isBlank()) {
                    Toast.makeText(this, "Enter text to test.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                statusToast("Tokenizing text and generating speech on this phone…")
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
                                Toast.makeText(this, "MOSS speech generated · ${result.durationMs} ms", Toast.LENGTH_LONG).show()
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
        val c=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL;setPadding(dp(14),dp(12),dp(14),dp(12));setBackgroundColor(surface);elevation=dp(2).toFloat() }
        c.addView(label(title,16,primary,true));c.addView(label(subtitle,12,secondary,false));parent.addView(c,LinearLayout.LayoutParams(-1,-2).apply { bottomMargin=dp(10) });return c
    }
    private fun label(value:String,size:Int,color:Int,bold:Boolean)=TextView(this).apply { text=value;textSize=size.toFloat();setTextColor(color);if(bold)setTypeface(typeface,android.graphics.Typeface.BOLD);setPadding(0,dp(5),0,dp(5)) }
    override fun onResume(){super.onResume();refreshAll()}
    override fun onDestroy(){handler.removeCallbacksAndMessages(null);ttsExecutor.shutdownNow();activeMossPlayer?.release();activeMossPlayer=null;super.onDestroy()}
    private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
}