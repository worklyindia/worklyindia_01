package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.content.ContentValues
import android.content.Intent
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
        ModelChoice("Indic Tiny TTS", "indic"),
        ModelChoice("Kokoro-82M", "kokoro"),
        ModelChoice("Chatterbox Multilingual", "chatterbox"),
        ModelChoice("CosyVoice 3", "cosy"),
        ModelChoice("MOSS-TTS-Nano", "moss"),
        ModelChoice("Qwen3-TTS", "qwen")
    )
    private val languages = mapOf(
        "indic" to listOf(
            Language("Hindi", "hi", "नमस्ते! यह हिंदी टेक्स्ट टू वॉइस परीक्षण है।"),
            Language("Gujarati", "gu", "નમસ્તે! આ ગુજરાતી ટેક્સ્ટ ટુ વૉઇસ પરીક્ષણ છે."),
            Language("English", "en", "Hello! This is an offline text to voice test.")
        ),
        "kokoro" to listOf(
            Language("English (US)", "en-US", "Hello! This is a Kokoro voice test."),
            Language("English (UK)", "en-GB", "Hello! This is a British English voice test."),
            Language("Hindi", "hi", "नमस्ते! यह कोकोरो हिंदी आवाज़ का परीक्षण है।"),
            Language("Spanish", "es", "¡Hola! Esta es una prueba de voz."),
            Language("French", "fr-FR", "Bonjour ! Ceci est un test vocal."),
            Language("Italian", "it", "Ciao! Questo è un test vocale."),
            Language("Portuguese (Brazil)", "pt-BR", "Olá! Este é um teste de voz."),
            Language("Chinese", "zh-CN", "你好！这是语音测试。"),
            Language("Japanese", "ja", "こんにちは！これは音声テストです。")
        ),
        "chatterbox" to listOf(
            Language("Arabic","ar","مرحباً، هذا اختبار صوتي."),
            Language("Danish","da","Hej, dette er en stemmetest."),
            Language("German","de","Hallo, dies ist ein Sprachtest."),
            Language("Greek","el","Γεια σας, αυτή είναι μια δοκιμή φωνής."),
            Language("English","en","Hello! This is a multilingual voice test."),
            Language("Spanish","es","Hola, esta es una prueba de voz."),
            Language("Finnish","fi","Hei, tämä on äänitesti."),
            Language("French","fr","Bonjour, ceci est un test vocal."),
            Language("Hebrew","he","שלום, זוהי בדיקת קול."),
            Language("Hindi","hi","नमस्ते! यह हिंदी आवाज़ का परीक्षण है।"),
            Language("Italian","it","Ciao, questo è un test vocale."),
            Language("Japanese","ja","こんにちは、これは音声テストです。"),
            Language("Korean","ko","안녕하세요, 음성 테스트입니다."),
            Language("Malay","ms","Hai, ini ujian suara."),
            Language("Dutch","nl","Hallo, dit is een stemtest."),
            Language("Norwegian","no","Hei, dette er en stemmetest."),
            Language("Polish","pl","Cześć, to jest test głosu."),
            Language("Portuguese","pt","Olá, este é um teste de voz."),
            Language("Russian","ru","Здравствуйте, это проверка голоса."),
            Language("Swedish","sv","Hej, det här är ett rösttest."),
            Language("Swahili","sw","Habari, huu ni mtihani wa sauti."),
            Language("Turkish","tr","Merhaba, bu bir ses testidir."),
            Language("Chinese","zh","你好，这是语音测试。")
        ),
        "cosy" to listOf(
            Language("Chinese","zh","你好，这是语音测试。"),
            Language("English","en","Hello! This is an offline voice test."),
            Language("Japanese","ja","こんにちは、音声テストです。"),
            Language("Korean","ko","안녕하세요, 음성 테스트입니다."),
            Language("German","de","Hallo, dies ist ein Sprachtest."),
            Language("French","fr","Bonjour, ceci est un test vocal."),
            Language("Russian","ru","Здравствуйте, это проверка голоса."),
            Language("Spanish","es","Hola, esta es una prueba de voz."),
            Language("Italian","it","Ciao, questo è un test vocale.")
        ),
        "moss" to listOf(Language("English","en","Hello! This is MOSS offline text to speech."), Language("Chinese","zh","你好！这是 MOSS 离线语音测试。")),
        "qwen" to listOf(Language("English","en","Hello! This is Qwen3 offline text to speech."))
    )
    private val kokoroVoices = mapOf(
        "en-US" to listOf("af_heart · Female","af_bella · Female","af_nicole · Female","af_sarah · Female","af_sky · Female","am_adam · Male","am_michael · Male","am_puck · Male"),
        "en-GB" to listOf("bf_alice · Female","bf_emma · Female","bf_isabella · Female","bf_lily · Female","bm_daniel · Male","bm_george · Male","bm_lewis · Male"),
        "hi" to listOf("hf_alpha · Female","hf_beta · Female","hm_omega · Male","hm_psi · Male"),
        "es" to listOf("ef_dora · Female","em_alex · Male","em_santa · Male"),
        "fr-FR" to listOf("ff_siwis · Female"),
        "it" to listOf("if_sara · Female","im_nicola · Male"),
        "pt-BR" to listOf("pf_dora · Female","pm_alex · Male","pm_santa · Male"),
        "zh-CN" to listOf("zf_xiaobei · Female","zf_xiaoni · Female","zf_xiaoxiao · Female","zf_xiaoyi · Female","zm_yunjian · Male","zm_yunxi · Male","zm_yunxia · Male","zm_yunyang · Male"),
        "ja" to listOf("jf_alpha · Female","jf_gongitsune · Female","jf_nezumi · Female","jf_tebukuro · Female","jm_kumo · Male")
    )
    private val background get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = background
        window.navigationBarColor = background
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = if (dark) 0 else View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        buildUi()
        updateModel()
    }

    private fun buildUi() {
        val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(this@TextToVoiceActivity.background) }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(dp(18),dp(8),dp(18),dp(8)); setBackgroundColor(surface) }
        header.addView(Button(this).apply { text = "‹"; textSize=28f; isAllCaps=false; setTextColor(primary); setBackgroundColor(surface); setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(48),dp(52)))
        header.addView(TextView(this).apply { text="Text To Voice"; textSize=20f; setTextColor(primary); setTypeface(typeface,android.graphics.Typeface.BOLD) }, LinearLayout.LayoutParams(0,dp(52),1f))
        page.addView(header)
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
            "moss" -> listOf("Junhao · Built-in")
            "qwen" -> listOf("Ryan · English")
            "chatterbox" -> listOf("Built-in multilingual voice")
            "cosy" -> listOf("Bundled reference voice")
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
            "chatterbox" -> SpeechModelCatalog.chatterboxMultilingual()
            "cosy" -> SpeechModelCatalog.cosyVoice3()
            "moss" -> SpeechModelCatalog.mossTtsNano()
            else -> SpeechModelCatalog.qwen3Tts()
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
                    "indic" -> IndicTinyTtsEngine.create(this,language.code).use { it.synthesizeToWav(text,output,if(voice.startsWith("Male")) "male" else "female") }
                    "kokoro" -> {
                        val id=voice.substringBefore(" ·")
                        KokoroTtsEngine(this).use { it.synthesizeToWav(pack,manager.modelDirectory(pack),text,id,output) }
                    }
                    "moss" -> MossTtsOnnxEngine(manager.modelDirectory(pack),cacheDir,2).use { it.synthesize(text,outputFile=output,voice="Junhao",maxFrames=160,seed=1234L) }
                    "qwen" -> Qwen3TtsEngine(manager.modelDirectory(pack),2).use { engine -> engine.load(); engine.synthesizeToWav(text,output,"Ryan") }
                    "chatterbox" -> QvacTtsEngine.create(QvacTtsEngine.CHATTERBOX,manager.modelDirectory(pack),modelA=File(manager.modelDirectory(pack),"chatterbox-t3-q4_k.gguf"),modelB=File(manager.modelDirectory(pack),"chatterbox-s3gen-q4_k.gguf"),language=language.code,threads=2).use { it.synthesizeToWav(text,output) }
                    "cosy" -> QvacTtsEngine.create(QvacTtsEngine.COSYVOICE3,manager.modelDirectory(pack),modelA=File(manager.modelDirectory(pack),"vocab.json"),modelB=File(manager.modelDirectory(pack),"merges.txt"),referenceAudio=File(manager.modelDirectory(pack),"zero_shot_prompt.wav"),referenceText="",language=language.code,threads=2).use { it.synthesizeToWav(text,output) }
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
                runOnUiThread {
                    convertButton.isEnabled=true
                    convertButton.text="Convert To Voice"
                    modelStatus.text=error.message ?: "Voice conversion failed."
                    Toast.makeText(this,"Audio generation failed.",Toast.LENGTH_LONG).show()
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
    private fun selectionListener(action:()->Unit)=object: android.widget.AdapterView.OnItemSelectedListener {
        override fun onNothingSelected(parent:android.widget.AdapterView<*>?)=Unit
        override fun onItemSelected(parent:android.widget.AdapterView<*>?,view:View?,position:Int,id:Long) { action() }
    }
    override fun onDestroy() { player?.release(); player=null; executor.shutdownNow(); super.onDestroy() }
}
