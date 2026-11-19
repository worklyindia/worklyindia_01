package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Settings for downloaded models and the automatically connected Workly phone server. */
class SettingsActivity : Activity() {
    private var dark = false
    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        if (Build.VERSION.SDK_INT >= 23) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (dark) 0 else View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(24))
            setBackgroundColor(bg)
        }
        page.addView(Button(this).apply {
            text = "‹  Back"; isAllCaps = false; setTextColor(primary); setBackgroundColor(bg)
            setOnClickListener { finish() }
        })
        page.addView(label("Settings", 28, primary, true))
        val models = card(page)
        models.addView(label("AI model downloads", 18, primary, true))
        models.addView(label("Download, verify and select your on-device AI models here.", 13, secondary, false))
        models.addView(button("Manage AI model downloads").apply {
            setOnClickListener { startActivity(Intent(this@SettingsActivity, SpeechDownloadsActivity::class.java)) }
        })
        val server = card(page)
        server.addView(label("Workly India account connection", 18, primary, true))
        server.addView(label("This phone connects automatically using the Workly India account you signed into. No pairing code or website setup is needed.", 13, secondary, false))
        server.addView(label("The website can send image requests to this phone. Download the 1.57 GB local image model in AI Image Studio first; keep the phone server running.", 13, secondary, false))
        server.addView(button("Open AI Image Studio").apply {
            setOnClickListener { startActivity(Intent(this@SettingsActivity, ChatWorkImageActivity::class.java)) }
        })
        val connected = !SecureDeviceTokenStore.read(this).isNullOrBlank()
        server.addView(label(if (connected) "Account connection: Securely registered" else "Account connection: Sign in required", 14, secondary, true))
        server.addView(label(
            getSharedPreferences(VoiceRelayService.STATUS_PREFS, MODE_PRIVATE)
                .getString(VoiceRelayService.STATUS_KEY, "Phone server will start automatically when the app opens.") ?: "Phone server will start automatically when the app opens.",
            13, secondary, false
        ))
        server.addView(button("Stop phone server", true).apply {
            setOnClickListener {
                stopService(Intent(this@SettingsActivity, VoiceRelayService::class.java))
            }
        })
        page.addView(label("The phone server uses outbound HTTPS for voice and image jobs. Android may limit long-running background services; reopen Workly Voice to reconnect when Android stops it. Image generation uses CPU, so it can take time and use battery.", 12, secondary, false))
        setContentView(ScrollView(this).apply { addView(page) })
    }

    private fun card(parent: LinearLayout) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(16), dp(16), dp(16))
        setBackgroundColor(surface)
        elevation = dp(2).toFloat()
        parent.addView(this, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(14) })
    }

    private fun label(value: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = value; textSize = size.toFloat(); setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(6), 0, dp(6))
    }

    private fun button(value: String, secondaryStyle: Boolean = false) = Button(this).apply {
        text = value; isAllCaps = false; minHeight = dp(48)
        setTextColor(if (secondaryStyle) primary else 0xFFFFFFFF.toInt())
        setBackgroundColor(if (secondaryStyle) surface else 0xFF1769C2.toInt())
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
