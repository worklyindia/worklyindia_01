package com.worklyindia.aivoice

import android.app.Activity
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

class SpeechDownloadsActivity : Activity() {
    private val speechManager by lazy { SpeechPackDownloadManager(this) }
    private val qwenManager by lazy { OfflineModelManager(this) }
    private val kokoroManager by lazy { KokoroModelManager(this) }
    private val handler = Handler(Looper.getMainLooper())
    private val rows = mutableListOf<DownloadRow>()
    private var dark = false
    private var choiceShowing = false

    private data class DownloadRow(
        val id: String,
        val title: String,
        val subtitle: String,
        val status: TextView,
        val progress: ProgressBar,
        val action: Button,
        val refresh: () -> Unit
    )

    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()

    private val poll = object : Runnable {
        override fun run() {
            rows.forEach { it.refresh() }
            if (rows.any { it.status.text.contains("Downloading") || it.status.text.contains("Waiting") || it.status.text.contains("Paused") }) {
                handler.postDelayed(this, 1200L)
            }
        }
    }

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
        refreshAll()
    }

    private fun buildUi() {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(12), dp(18), dp(20))
            setBackgroundColor(bg)
        }
        page.addView(Button(this).apply {
            text = "‹  Back to Workly Voice"
            isAllCaps = false
            setTextColor(primary)
            setBackgroundColor(bg)
            gravity = android.view.Gravity.START or android.view.Gravity.CENTER_VERTICAL
            setOnClickListener { finish() }
        })
        page.addView(label("Model Downloads", 27, primary, true))
        page.addView(label("All available speech and AI packs. A model already installed on this phone will show Ready and will not be downloaded again.", 14, secondary, false))
        val scroll = ScrollView(this)
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(list)
        page.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))

        list.addView(label("VOICE RECOGNITION", 17, primary, true).apply { setPadding(0, dp(12), 0, dp(6)) })
        addSpeechPack(list, "IndicConformer Hindi", "AI4Bharat IndicConformer INT8 · Hindi offline speech-to-text", SpeechModelCatalog.indicConformer("hi"))
        addSpeechPack(list, "IndicConformer Gujarati", "AI4Bharat IndicConformer INT8 · Gujarati offline speech-to-text", SpeechModelCatalog.indicConformer("gu"))
        addSpeechPack(list, "Shruti Hindi", "Shruti ONNX · Hindi offline speech-to-text", SpeechModelCatalog.shruti("hi"))
        addSpeechPack(list, "Shruti Gujarati", "Shruti ONNX · Gujarati offline speech-to-text", SpeechModelCatalog.shruti("gu"))

        list.addView(label("TEXT TO SPEECH", 17, primary, true).apply { setPadding(0, dp(16), 0, dp(6)) })
        addSpeechPack(list, "Indic Tiny TTS Hindi", "Indic Tiny TTS · Hindi offline text-to-speech", SpeechModelCatalog.indicTinyTts("hi"))
        addSpeechPack(list, "Indic Tiny TTS Gujarati", "Indic Tiny TTS · Gujarati offline text-to-speech", SpeechModelCatalog.indicTinyTts("gu"))
        addSpeechPack(list, "Indic Tiny TTS English", "Indic Tiny TTS · English offline text-to-speech", SpeechModelCatalog.indicTinyTts("en"))
        addKokoroCard(list)
        list.addView(label("OFFLINE AI CHAT", 17, primary, true).apply { setPadding(0, dp(16), 0, dp(6)) })
        addQwenCard(list)
        setContentView(page)
    }

    private fun addSpeechPack(parent: LinearLayout, title: String, subtitle: String, pack: SpeechModelCatalog.Pack, inferencePending: Boolean = false) {
        val card = card(parent, title, subtitle)
        val status = label("Checking saved files…", 13, secondary, true)
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE }
        val action = Button(this).apply {
            isAllCaps = false
            text = "Download"
            setOnClickListener { withNetworkChoice { allow -> runCatching { speechManager.start(pack, allow); refreshAll() }.onFailure { status.text = it.message ?: "Download could not start." } } }
        }
        card.addView(status)
        card.addView(progress)
        card.addView(action)
        rows.add(DownloadRow(pack.id, title, subtitle, status, progress, action) {
            val snapshot = runCatching { speechManager.snapshot(pack) }.getOrNull()
            if (snapshot == null) {
                status.text = "Could not read model status"
                action.visibility = View.VISIBLE
            } else {
                val ready = snapshot.state == SpeechPackDownloadManager.State.COMPLETE
                status.text = when (snapshot.state) {
                    SpeechPackDownloadManager.State.COMPLETE -> "Ready · already installed"
                    SpeechPackDownloadManager.State.RUNNING -> "Downloading · ${snapshot.percent}%"
                    SpeechPackDownloadManager.State.PENDING -> "Waiting for network…"
                    SpeechPackDownloadManager.State.PAUSED -> "Paused · waiting for Wi-Fi/network"
                    SpeechPackDownloadManager.State.FAILED -> "Download failed · tap Retry"
                    else -> "Not downloaded · ${snapshot.totalBytes / 1_000_000} MB"
                }
                progress.visibility = if (snapshot.state == SpeechPackDownloadManager.State.RUNNING) View.VISIBLE else View.GONE
                progress.progress = snapshot.percent
                action.visibility = if (ready || snapshot.state == SpeechPackDownloadManager.State.RUNNING || snapshot.state == SpeechPackDownloadManager.State.PENDING || snapshot.state == SpeechPackDownloadManager.State.PAUSED) View.GONE else View.VISIBLE
                action.text = if (snapshot.state == SpeechPackDownloadManager.State.FAILED) "Retry download" else "Download"
            }
        })
    }

    private fun addKokoroCard(parent: LinearLayout) {
        val card = card(parent, "Kokoro 82M", "Hindi + English offline speech generation · about 295 MB")
        val status = label("Checking saved file…", 13, secondary, true)
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE }
        val action = Button(this).apply { isAllCaps = false; text = "Download"; setOnClickListener { withNetworkChoice { allow -> runCatching { kokoroManager.startDownload(allow); refreshAll() }.onFailure { status.text = it.message ?: "Download failed." } } } }
        card.addView(status); card.addView(progress); card.addView(action)
        rows.add(DownloadRow("kokoro", "Kokoro", "", status, progress, action) {
            val s = runCatching { kokoroManager.snapshot() }.getOrNull() ?: return@DownloadRow
            status.text = when (s.state) {
                KokoroModelManager.State.READY -> "Ready · already installed"
                KokoroModelManager.State.RUNNING -> "Downloading · ${s.progressPercent}%"
                KokoroModelManager.State.PENDING -> "Waiting for network…"
                KokoroModelManager.State.PAUSED -> "Paused · waiting for network"
                KokoroModelManager.State.FAILED -> "Download failed · tap Retry"
                else -> "Not downloaded · about 295 MB"
            }
            progress.progress = s.progressPercent
            progress.visibility = if (s.state == KokoroModelManager.State.RUNNING) View.VISIBLE else View.GONE
            action.visibility = if (s.state == KokoroModelManager.State.READY || s.state == KokoroModelManager.State.RUNNING || s.state == KokoroModelManager.State.PENDING || s.state == KokoroModelManager.State.PAUSED) View.GONE else View.VISIBLE
            action.text = if (s.state == KokoroModelManager.State.FAILED) "Retry download" else "Download"
        })
    }

    private fun addQwenCard(parent: LinearLayout) {
        val card = card(parent, "Qwen 2.5 3B · Q4_K_M", "Offline AI chat model · about 2.1 GB")
        val status = label("Checking saved file…", 13, secondary, true)
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE }
        val action = Button(this).apply { isAllCaps = false; text = "Download"; setOnClickListener { withNetworkChoice { allow -> runCatching { qwenManager.startDownload(allow); refreshAll() }.onFailure { status.text = it.message ?: "Download failed." } } } }
        card.addView(status); card.addView(progress); card.addView(action)
        rows.add(DownloadRow("qwen", "Qwen", "", status, progress, action) {
            val s = runCatching { qwenManager.snapshot() }.getOrNull() ?: return@DownloadRow
            status.text = when (s.state) {
                OfflineModelManager.State.READY -> "Ready · already installed"
                OfflineModelManager.State.RUNNING -> "Downloading · ${s.progressPercent}%"
                OfflineModelManager.State.PENDING -> "Waiting for network…"
                OfflineModelManager.State.PAUSED -> "Paused · waiting for network"
                OfflineModelManager.State.FAILED -> "Download failed · tap Retry"
                else -> "Not downloaded · about 2.1 GB"
            }
            progress.progress = s.progressPercent
            progress.visibility = if (s.state == OfflineModelManager.State.RUNNING) View.VISIBLE else View.GONE
            action.visibility = if (s.state == OfflineModelManager.State.READY || s.state == OfflineModelManager.State.RUNNING || s.state == OfflineModelManager.State.PENDING || s.state == OfflineModelManager.State.PAUSED) View.GONE else View.VISIBLE
            action.text = if (s.state == OfflineModelManager.State.FAILED) "Retry download" else "Download"
        })
    }

    private fun withNetworkChoice(action: (Boolean) -> Unit) {
        val prefs = getSharedPreferences("workly_model_download_preferences", MODE_PRIVATE)
        if (prefs.contains("allow_mobile_data")) {
            action(prefs.getBoolean("allow_mobile_data", false))
            return
        }
        if (choiceShowing) return
        choiceShowing = true
        AlertDialog.Builder(this)
            .setTitle("Allow mobile data for model downloads?")
            .setMessage("Large AI and speech packs may use several GB. Wi-Fi only avoids mobile data charges.")
            .setNegativeButton("Wi-Fi only") { _, _ -> prefs.edit().putBoolean("allow_mobile_data", false).apply(); choiceShowing = false; action(false) }
            .setPositiveButton("Allow mobile data") { _, _ -> prefs.edit().putBoolean("allow_mobile_data", true).apply(); choiceShowing = false; action(true) }
            .setOnCancelListener { choiceShowing = false }
            .show()
    }

    private fun refreshAll() { rows.forEach { it.refresh() }; handler.removeCallbacks(poll); handler.postDelayed(poll, 1200L) }

    private fun card(parent: LinearLayout, title: String, subtitle: String): LinearLayout {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(surface)
            elevation = dp(2).toFloat()
        }
        card.addView(label(title, 16, primary, true))
        card.addView(label(subtitle, 12, secondary, false))
        parent.addView(card, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) })
        return card
    }

    private fun label(value: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = value; textSize = size.toFloat(); setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(5), 0, dp(5))
    }

    override fun onResume() { super.onResume(); refreshAll() }
    override fun onDestroy() { handler.removeCallbacksAndMessages(null); super.onDestroy() }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
