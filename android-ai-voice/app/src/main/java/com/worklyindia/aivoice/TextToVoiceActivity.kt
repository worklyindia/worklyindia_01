package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.content.ContentValues
import android.content.Intent
import android.speech.RecognizerIntent
import android.content.res.Configuration
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
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
import android.widget.Toast
import java.io.File
import java.util.Locale
import java.util.concurrent.Executors

/** Simple offline text-to-speech workspace. Models are downloaded on demand. */
class TextToVoiceActivity : Activity() {
    private data class Language(val name: String, val code: String, val sample: String)
    private data class ModelChoice(val name: String, val id: String)

    private val manager by lazy { SpeechPackDownloadManager(this) }
    private val executor = Executors.newSingleThreadExecutor()
    private var dark = false
    private var currentOutput: File? = null
    private var player: MediaPlayer? = null
    // Reuse the loaded Indic Tiny ONNX sessions for repeat conversions in this screen.
    private var cachedTinyEngine: IndicTinyTtsEngine? = null
    private var cachedTinyLanguage: String? = null
    private var cachedKokoroEngine: KokoroTtsEngine? = null
    private var cachedKokoroModelPath: String? = null
    private var cachedVitsEngine: SherpaVitsTtsEngine? = null
    private var cachedVitsPackId: String? = null
    private lateinit var modelSpinner: Spinner
    private lateinit var languageSpinner: Spinner
    private lateinit var voiceSpinner: Spinner
    private lateinit var modelStatus: TextView
    private lateinit var downloadButton: Button
    private lateinit var convertButton: Button
    private lateinit var playButton: Button
    private lateinit var saveButton: Button
    private lateinit var textInput: EditText
    private val models = listOf(
        ModelChoice("Kokoro-82M", "kokoro"),
        ModelChoice("Indic Tiny TTS", "indic"),
        ModelChoice("iTantra VITS · Sherpa-ONNX", "itantra")
    )
    private val languages = mapOf(
        "indic" to listOf(
            Language("Gujarati", "gu", "નમસ્તે! આ ગુજરાતી ટેક્સ્ટ ટુ વૉઇસ પરીક્ષણ છે."),
            Language("Hindi", "hi", "नमस्ते! यह इंडिक टाइनी हिंदी आवाज़ का परीक्षण है।"),
            Language("English", "en", "Hello! This is an Indic Tiny English voice test.")
        ),
        "kokoro" to listOf(
            Language("English", "en-US", "Hello! This is a Kokoro English voice test."),
            Language("Hindi", "hi", "नमस्ते! यह कोकोरो हिंदी आवाज़ का परीक्षण है।")
        ),
        "itantra" to listOf(
            Language("Gujarati", "gu", "નમસ્તે! આ iTantra ગુજરાતી અવાજની કસોટી છે."),
            Language("Hindi", "hi", "नमस्ते! यह iTantra हिंदी आवाज़ का परीक्षण है।"),
            Language("English", "en", "Hello! This is the iTantra English voice test.")
        )
    )
    private val kokoroVoices = mapOf(
        "en-US" to listOf("af_heart · Female","af_bella · Female","af_nicole · Female","af_sarah · Female","af_sky · Female","am_adam · Male","am_michael · Male","am_puck · Male"),
        "hi" to listOf("hf_alpha · Female","hf_beta · Female","hm_omega · Male","hm_psi · Male")
    )
    private val background get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        // Use the same stable, always-visible system bars as the Workly India app.
        // The page and its ScrollView are laid out below the status bar, never behind it.
        ChatWorkTheme.applyWindow(this)
        window.statusBarColor = background
        window.navigationBarColor = background
        buildUi()
        updateModel()
    }

    private fun buildUi() {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(this@TextToVoiceActivity.background)
            // Insets are applied once by the decor view below.
        }
        // Compact single-row toolbar: back arrow and page title share one baseline.
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(dp(10),0,dp(16),0); setBackgroundColor(surface) }
        header.addView(Button(this).apply { text = "‹"; textSize=25f; isAllCaps=false; minWidth=0; minimumWidth=0; setPadding(0,0,0,0); setTextColor(primary); setBackgroundColor(surface); contentDescription="Back"; setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(40),dp(42)))
        header.addView(TextView(this).apply { text="Text To Voice"; textSize=18f; gravity=Gravity.CENTER_VERTICAL or Gravity.START; setSingleLine(true); includeFontPadding=false; setTextColor(primary); setTypeface(typeface,android.graphics.Typeface.BOLD) }, LinearLayout.LayoutParams(0,dp(42),1f))
        page.addView(header)
        page.addView(View(this).apply { setBackgroundColor(if(dark) 0x334A5B70 else 0x2234475E) }, LinearLayout.LayoutParams(-1,dp(1)))
        val scroll=ScrollView(this)
        val content=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(18),dp(16),dp(18),dp(24)) }
        scroll.addView(content)
        page.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        content.addView(label("MODEL",12,secondary,true))
        modelSpinner=Spinner(this)
        modelSpinner.adapter=adapter(models.map { it.name })
        content.addView(modelSpinner)
        modelStatus=label("Checking model…",13,secondary,false)
        content.addView(modelStatus)
        downloadButton=Button(this).apply { text="Download Model"; isAllCaps=false; setOnClickListener { downloadSelected() } }
        content.addView(downloadButton)
        content.addView(label("LANGUAGE",12,secondary,true))
        languageSpinner=Spinner(this)
        content.addView(languageSpinner)
        content.addView(label("VOICE",12,secondary,true))
        voiceSpinner=Spinner(this)
        content.addView(voiceSpinner)
        content.addView(label("TEXT",12,secondary,true))
        textInput=EditText(this).apply { minLines=5; maxLines=10; gravity=Gravity.TOP; textSize=16f; hint="Type or paste text here"; setPadding(dp(12),dp(12),dp(12),dp(12)); setBackgroundColor(surface); setTextColor(primary); setHintTextColor(secondary) }
        content.addView(textInput,LinearLayout.LayoutParams(-1,dp(150)))
        val speakTextButton=Button(this).apply {
            text="Speak Text"
            isAllCaps=false
            setOnClickListener { startSpeechInput() }
        }
        content.addView(speakTextButton,LinearLayout.LayoutParams(-1,dp(46)))
        convertButton=Button(this).apply { text="Convert To Voice"; isAllCaps=false; setOnClickListener { convert() } }
        content.addView(convertButton,LinearLayout.LayoutParams(-1,dp(52)))
        val actions=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; gravity=Gravity.CENTER; visibility=View.GONE }
        playButton=Button(this).apply { text="Play"; isAllCaps=false; setOnClickListener { playOutput() } }
        saveButton=Button(this).apply { text="Download Audio"; isAllCaps=false; setOnClickListener { saveOutput() } }
        actions.addView(playButton,LinearLayout.LayoutParams(0,dp(50),1f))
        actions.addView(saveButton,LinearLayout.LayoutParams(0,dp(50),1f))
        content.addView(actions)
        resultActions=actions
        modelSpinner.onItemSelectedListener=selectionListener { updateModel() }
        languageSpinner.onItemSelectedListener=selectionListener { updateLanguage() }
        setContentView(page)
    }

    private lateinit var resultActions: LinearLayout

    private fun updateModel() {
        val key=models[modelSpinner.selectedItemPosition.coerceIn(models.indices)].id
        val list=languages[key] ?: emptyList()
        languageSpinner.adapter=adapter(list.map { it.name })
        updateLanguage()
        currentOutput=null
        resultActions.visibility=View.GONE
        val pack=selectedPack()
        val snap=manager.snapshot(pack)
        val ready=snap.state==SpeechPackDownloadManager.State.COMPLETE
        modelStatus.text=if(ready) "Downloaded · Ready · %.0f MB".format(Locale.US,pack.totalBytes/1e6) else "Not downloaded · %.0f MB required".format(Locale.US,pack.totalBytes/1e6)
        downloadButton.text=if(ready) "Model Downloaded" else "Download Model"
        downloadButton.isEnabled=!ready
        convertButton.isEnabled=ready
    }

    private fun updateLanguage() {
        val key=models[modelSpinner.selectedItemPosition.coerceIn(models.indices)].id
        val langs=languages[key] ?: emptyList()
        if(langs.isEmpty()) return
        val language=langs[languageSpinner.selectedItemPosition.coerceIn(langs.indices)]
        val voices=when(key) {
            "indic" -> listOf("Female","Male")
            "kokoro" -> kokoroVoices[language.code] ?: emptyList()
            "itantra" -> listOf("Default voice")
            else -> emptyList()
        }
        voiceSpinner.adapter=adapter(voices)
        if(textInput.text.isNullOrBlank() || currentOutput==null) textInput.setText(language.sample)
        currentOutput=null
        if(::resultActions.isInitialized) resultActions.visibility=View.GONE
        updateStatusOnly()
    }

    private fun selectedPack(): SpeechModelCatalog.Pack {
        val key=models[modelSpinner.selectedItemPosition.coerceIn(models.indices)].id
        val language=languages[key]!![languageSpinner.selectedItemPosition.coerceIn(languages[key]!!.indices)]
        return when(key) {
            "indic" -> SpeechModelCatalog.indicTinyTts(language.code)
            "kokoro" -> SpeechModelCatalog.kokoro82m()
            "itantra" -> SpeechModelCatalog.itantraVits(language.code)
            else -> SpeechModelCatalog.indicTinyTts(language.code)
        }
    }

    private fun updateStatusOnly() {
        if(!::modelStatus.isInitialized) return
        val pack=selectedPack()
        val ready=runCatching { manager.snapshot(pack).state==SpeechPackDownloadManager.State.COMPLETE }.getOrDefault(false)
        modelStatus.text=if(ready) "Downloaded · Ready" else "Model not downloaded"
        downloadButton.isEnabled=!ready
        downloadButton.text=if(ready) "Model Downloaded" else "Download Model"
        convertButton.isEnabled=ready
    }

    private fun downloadSelected() {
        val pack=selectedPack()
        AlertDialog.Builder(this).setTitle("Download ${pack.title}?")
            .setMessage("Model size: %.0f MB. Wi-Fi is recommended. Allow mobile data?".format(Locale.US,pack.totalBytes/1e6))
            .setNegativeButton("Wi-Fi only") { _,_ -> startDownload(pack,false) }
            .setPositiveButton("Allow mobile data") { _,_ -> startDownload(pack,true) }
            .show()
    }

    private fun startDownload(pack: SpeechModelCatalog.Pack, allowMobile: Boolean) {
        downloadButton.isEnabled=false
        modelStatus.text="Starting model download…"
        executor.execute {
            try {
                manager.start(pack,allowMobile)
                runOnUiThread { refreshDownload(pack) }
            } catch(error:Throwable) {
                runOnUiThread { modelStatus.text=error.message ?: "Download could not start."; downloadButton.isEnabled=true }
            }
        }
    }

    private fun refreshDownload(pack: SpeechModelCatalog.Pack) {
        val snap=manager.snapshot(pack)
        modelStatus.text=when(snap.state) {
            SpeechPackDownloadManager.State.COMPLETE -> "Downloaded · Ready"
            SpeechPackDownloadManager.State.RUNNING -> "Downloading · ${snap.percent}% · %.1f / %.1f MB".format(Locale.US,snap.downloadedBytes/1e6,snap.totalBytes/1e6)
            SpeechPackDownloadManager.State.PENDING -> "Download queued"
            SpeechPackDownloadManager.State.PAUSED -> "Download paused · waiting for network"
            SpeechPackDownloadManager.State.FAILED -> "Download failed · tap Download Model to retry"
            else -> "Not downloaded · %.0f MB".format(Locale.US,pack.totalBytes/1e6)
        }
        val ready=snap.state==SpeechPackDownloadManager.State.COMPLETE
        downloadButton.text=if(ready) "Model Downloaded" else "Download Model"
        downloadButton.isEnabled=!ready
        convertButton.isEnabled=ready
        if(!ready && (snap.state==SpeechPackDownloadManager.State.RUNNING || snap.state==SpeechPackDownloadManager.State.PENDING || snap.state==SpeechPackDownloadManager.State.PAUSED)) {
            downloadButton.postDelayed({ refreshDownload(pack) },1000L)
        }
    }

    private fun startSpeechInput() {
        val language = languages[models[modelSpinner.selectedItemPosition].id]
            ?.getOrNull(languageSpinner.selectedItemPosition)?.code ?: "en-US"
        val locale = when (language) {
            "hi" -> "hi-IN"
            "gu" -> "gu-IN"
            "en-US" -> "en-US"
            else -> language
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak the text you want to convert to voice")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        try {
            startActivityForResult(intent, REQUEST_SPEECH_INPUT)
        } catch (_: android.content.ActivityNotFoundException) {
            Toast.makeText(this, "Speech input service is not available on this phone.", Toast.LENGTH_LONG).show()
        }
    }

    @Deprecated("Use Activity Result API in a future cleanup")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_SPEECH_INPUT && resultCode == RESULT_OK) {
            val spoken = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull().orEmpty()
            if (spoken.isNotBlank()) {
                val existing = textInput.text.toString().trim()
                textInput.setText(if (existing.isBlank()) spoken else "$existing $spoken")
                textInput.setSelection(textInput.text.length)
            } else {
                Toast.makeText(this, "No speech was recognized. Please try again.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun convert() {
        val pack=selectedPack()
        val text=textInput.text.toString().trim()
        if(text.isBlank()) { textInput.error="Enter text to convert"; return }
        if(manager.snapshot(pack).state!=SpeechPackDownloadManager.State.COMPLETE) { updateStatusOnly(); return }
        val model=models[modelSpinner.selectedItemPosition].id
        val language=languages[model]!![languageSpinner.selectedItemPosition]
        val voice=voiceSpinner.selectedItem?.toString().orEmpty()
        convertButton.isEnabled=false
        convertButton.text="Converting…"
        modelStatus.text="Generating audio offline…"
        executor.execute {
            try {
                val output=File(cacheDir,"text_to_voice_${System.currentTimeMillis()}.wav")
                when(model) {
                    "indic" -> {
                        val engine = if (cachedTinyLanguage == language.code && cachedTinyEngine != null) {
                            cachedTinyEngine!!
                        } else {
                            cachedTinyEngine?.close()
                            IndicTinyTtsEngine.create(this, language.code).also {
                                cachedTinyEngine = it
                                cachedTinyLanguage = language.code
                            }
                        }
                        engine.synthesizeToWav(text, output, if (voice.startsWith("Male")) "male" else "female", onProgress = { done, total ->
                            runOnUiThread { if (!isFinishing) modelStatus.text = "Generating audio · ${done * 100 / total}% · $done/$total parts" }
                        })
                    }
                    "itantra" -> {
                        val packId = pack.id
                        val engine = if (cachedVitsPackId == packId && cachedVitsEngine != null) {
                            cachedVitsEngine!!
                        } else {
                            cachedVitsEngine?.close()
                            SherpaVitsTtsEngine.create(this, pack).also {
                                cachedVitsEngine = it
                                cachedVitsPackId = packId
                            }
                        }
                        engine.synthesizeToWav(text, output)
                    }
                    "kokoro" -> {
                        val id = voice.substringBefore(" ·")
                        val modelDirectory = manager.modelDirectory(pack)
                        val modelPath = File(modelDirectory, "kokoro_int8_fp16.litertlm").absolutePath
                        val engine = if (cachedKokoroModelPath == modelPath && cachedKokoroEngine != null) {
                            cachedKokoroEngine!!
                        } else {
                            cachedKokoroEngine?.close()
                            KokoroTtsEngine(this).also {
                                cachedKokoroEngine = it
                                cachedKokoroModelPath = modelPath
                            }
                        }
                        engine.synthesizeToWav(pack, modelDirectory, text, id, output, onProgress = { done, total ->
                            runOnUiThread { if (!isFinishing) modelStatus.text = "Generating audio · ${done * 100 / total}% · $done/$total parts" }
                        })
                    }
                }
                check(output.isFile && output.length()>44L) { "Audio file was not generated." }
                runOnUiThread {
                    currentOutput=output
                    convertButton.isEnabled=true
                    convertButton.text="Convert To Voice"
                    modelStatus.text="Voice ready · ${language.name} · ${output.length()/1024} KB"
                    resultActions.visibility=View.VISIBLE
                }
            } catch(error:Throwable) {
                android.util.Log.e("ChatWorkTTS", "Voice conversion failed for model=$model language=${language.code}", error)
                val details = generateSequence(error as Throwable?) { it.cause }
                    .map { "${it.javaClass.simpleName}: ${it.message ?: "No error message"}" }
                    .take(5)
                    .joinToString("\nCaused by: ")
                runOnUiThread {
                    convertButton.isEnabled=true
                    convertButton.text="Convert To Voice"
                    modelStatus.text="Conversion failed · see error details"
                    AlertDialog.Builder(this)
                        .setTitle("Audio generation failed")
                        .setMessage(details)
                        .setPositiveButton("OK", null)
                        .show()
                }
            }
        }
    }

    private fun playOutput() {
        val file=currentOutput ?: return
        runCatching {
            player?.release()
            player=MediaPlayer().apply {
                setDataSource(file.absolutePath)
                setOnCompletionListener { it.release(); player=null }
                setOnPreparedListener { it.start() }
                prepareAsync()
            }
        }.onFailure { Toast.makeText(this,it.message ?: "Audio playback failed.",Toast.LENGTH_LONG).show() }
    }

    private fun saveOutput() {
        val file=currentOutput ?: return
        try {
            val values=ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME,"ChatWork_TTS_${System.currentTimeMillis()}.wav")
                put(MediaStore.MediaColumns.MIME_TYPE,"audio/wav")
                if(android.os.Build.VERSION.SDK_INT>=29) put(MediaStore.MediaColumns.RELATIVE_PATH,"Download/ChatWork")
            }
            val resolver=contentResolver
            val collection=if(android.os.Build.VERSION.SDK_INT>=29) MediaStore.Downloads.EXTERNAL_CONTENT_URI else MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
            val uri=resolver.insert(collection,values) ?: throw IllegalStateException("Could not create a file in Downloads.")
            resolver.openOutputStream(uri)?.use { output -> file.inputStream().use { it.copyTo(output) } } ?: throw IllegalStateException("Could not write audio file.")
            Toast.makeText(this,"Audio saved to Downloads/ChatWork.",Toast.LENGTH_LONG).show()
        } catch(error:Throwable) {
            Toast.makeText(this,error.message ?: "Audio download failed.",Toast.LENGTH_LONG).show()
        }
    }

    private fun <T> adapter(items: List<T>): ArrayAdapter<T> = ArrayAdapter(this,android.R.layout.simple_spinner_item,items).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
    private fun label(value:String,size:Int,color:Int,bold:Boolean)=TextView(this).apply { text=value; textSize=size.toFloat(); setTextColor(color); if(bold) setTypeface(typeface,android.graphics.Typeface.BOLD); setPadding(0,dp(12),0,dp(5)) }
    private fun dp(value:Int)=(value*resources.displayMetrics.density).toInt()

    companion object { private const val REQUEST_SPEECH_INPUT = 1401 }
    private fun selectionListener(action:()->Unit)=object: android.widget.AdapterView.OnItemSelectedListener {
        override fun onNothingSelected(parent:android.widget.AdapterView<*>?)=Unit
        override fun onItemSelected(parent:android.widget.AdapterView<*>?,view:View?,position:Int,id:Long) { action() }
    }
    override fun onDestroy() { player?.release(); player=null; executor.shutdownNow(); runCatching { cachedTinyEngine?.close() }; cachedTinyEngine=null; cachedTinyLanguage=null; runCatching { cachedKokoroEngine?.close() }; cachedKokoroEngine=null; cachedKokoroModelPath=null; runCatching { cachedVitsEngine?.close() }; cachedVitsEngine=null; cachedVitsPackId=null; super.onDestroy() }
}
