package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Lightweight home screen. Voice, chat, downloads and settings are separate destinations. */
class MainActivity : Activity() {
    private var dark = false
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
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(22), dp(20), dp(24))
            setBackgroundColor(bg)
        }
        page.addView(label("WORKLY INDIA", 13, 0xFF2878D0.toInt(), true))
        page.addView(label("Workly Voice", 32, primary, true).apply { setPadding(0, dp(8), 0, dp(2)) })
        page.addView(label("Hindi · English · Gujarati", 16, secondary, false))
        page.addView(label("Choose what you want to do", 15, secondary, false).apply { setPadding(0, dp(24), 0, dp(12)) })
        addDestination(page, "Voice", "Text to speech and speech to text", VoiceActivity::class.java)
        addDestination(page, "AI Chat", "Chat with offline Qwen AI and use voice input", OfflineAiChatActivity::class.java)
        addDestination(page, "Downloads", "Manage AI4Bharat, Indic Tiny TTS, Kokoro, Shruti and Qwen models", SpeechDownloadsActivity::class.java)
        addDestination(page, "Settings", "Pair this phone and manage the secure voice server", SettingsActivity::class.java)
        page.addView(label("WORKLY VOICE · VERSION 1.0.0", 11, secondary, true).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, 0)
        })
        setContentView(ScrollView(this).apply { addView(page) })
    }

    private fun addDestination(parent: LinearLayout, title: String, subtitle: String, target: Class<*>) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(14))
            setBackgroundColor(surface)
            elevation = dp(2).toFloat()
        }
        card.addView(label(title, 19, primary, true))
        card.addView(label(subtitle, 13, secondary, false))
        card.addView(Button(this).apply {
            text = "Open $title"
            isAllCaps = false
            minHeight = dp(48)
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFF1769C2.toInt())
            setOnClickListener { startActivity(Intent(this@MainActivity, target)) }
        }, LinearLayout.LayoutParams(-1, dp(48)).apply { topMargin = dp(10) })
        parent.addView(card, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
    }

    private fun label(value: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = value
        textSize = size.toFloat()
        setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
