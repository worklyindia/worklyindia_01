package com.worklyindia.aivoice

import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import java.util.Locale

class SpeechDownloadsActivity : Activity() {
    private val speechManager by lazy { SpeechPackDownloadManager(this) }
    private val qwenManager by lazy { QwenModelManager(this) }
    private val handler = Handler(Looper.getMainLooper())
    private val rows = mutableListOf<DownloadRow>()
    private var dark = false
    private var choiceShowing = false
    private var availableRam = 0L
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
        page.addView(label("Model Downloads",27,primary,true))
        page.addView(label("Phone available RAM: %.1f GB. Unsupported models are locked on this device. Download progress shows transferred size and live network speed.".format(Locale.US,availableRam/1e9),13,secondary,false))
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
        list.addView(label("ADDITIONAL VOICE RECOGNITION MODELS",16,primary,true).apply { setPadding(0,dp(18),0,dp(5)) })
        addSpeechPack(list,"Shruti ONNX · Hindi","Moonshine-based offline speech recognition · Hindi",SpeechModelCatalog.shruti("hi"))
        addSpeechPack(list,"Shruti ONNX · Gujarati","Moonshine-based offline speech recognition · Gujarati",SpeechModelCatalog.shruti("gu"))
        list.addView(label("TEXT TO SPEECH · OFFLINE",16,primary,true).apply { setPadding(0,dp(18),0,dp(5)) })
        addSpeechPack(list,"Indic Tiny TTS Hindi","Indic Tiny TTS · Hindi offline text-to-speech",SpeechModelCatalog.indicTinyTts("hi"))
        addSpeechPack(list,"Indic Tiny TTS Gujarati","Indic Tiny TTS · Gujarati offline text-to-speech",SpeechModelCatalog.indicTinyTts("gu"))
        addSpeechPack(list,"Indic Tiny TTS English","Indic Tiny TTS · English offline text-to-speech",SpeechModelCatalog.indicTinyTts("en"))
        list.addView(label("AI IMAGE GENERATION · WEBSITE SERVER",16,primary,true).apply { setPadding(0,dp(22),0,dp(5)) })
        addServerModelCard(list,"Image Generation Model","Stored and run on the Workly website model server.")
        list.addView(label("AI VIDEO GENERATION · WEBSITE SERVER",16,primary,true).apply { setPadding(0,dp(18),0,dp(5)) })
        addServerModelCard(list,"Wan 2.1 Text-to-Video 1.3B","Model weights are stored on the server; website requests run inference there.")
        list.addView(label("LANGUAGE TRANSLATION · WEBSITE SERVER",16,primary,true).apply { setPadding(0,dp(18),0,dp(5)) })
        addServerModelCard(list,"MADLAD-400 3B Translation","Multilingual model cached on the translation server.")
        list.addView(label("Website server deployment is not yet connected. Server model downloads will be enabled only after the GPU host, secure API and health checks are configured.",12,secondary,false).apply { setPadding(0,dp(8),0,dp(16)) })
        setContentView(page)
    }
    private fun addServerModelCard(parent:LinearLayout,title:String,subtitle:String) {
        val c=card(parent,title,subtitle)
        c.addView(label("Website server · Not deployed",12,secondary,true))
        c.addView(Button(this).apply { text="Deployment pending"; isAllCaps=false; isEnabled=false })
    }
    private fun addQwenCard(parent: LinearLayout, model: QwenModelManager.Model) {
        val card=card(parent,model.title + if(model.premium) " · PREMIUM" else "","Download: " + "%.0f MB".format(Locale.US,model.size/1e6) + " · Requires about %.1f GB free RAM".format(Locale.US,model.minFreeRam/1e9))
        val status=label("Checking model…",13,secondary,true)
        val progress=ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply { max=100; visibility=View.GONE }
        val action=Button(this).apply { isAllCaps=false }
        card.addView(status); card.addView(progress); card.addView(action)
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
        card.addView(status);card.addView(progress);card.addView(action)
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
            action.visibility=if(s.state==SpeechPackDownloadManager.State.COMPLETE || s.state==SpeechPackDownloadManager.State.RUNNING || s.state==SpeechPackDownloadManager.State.PENDING || s.state==SpeechPackDownloadManager.State.PAUSED) View.GONE else View.VISIBLE
            action.text=if(s.state==SpeechPackDownloadManager.State.FAILED) "Retry download" else "Download"
        }
        rows.add(row)
        row.refresh()
    }
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
    override fun onDestroy(){handler.removeCallbacksAndMessages(null);super.onDestroy()}
    private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
}