package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
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

/** Lets the user choose clearly between cloud-based and on-device voice workflows. */
class VoiceModeActivity : Activity() {
    private var dark = false
    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()
    private val accent get() = if (dark) 0xFF8DB5FF.toInt() else 0xFF2878F0.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = if (dark) 0 else View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bg)
        }
        val header = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(8))
            setBackgroundColor(surface)
        }
        header.addView(Button(this).apply {
            text = "‹"
            textSize = 28f
            isAllCaps = false
            minWidth = 0
            minimumWidth = 0
            setTextColor(primary)
            setBackgroundColor(surface)
            contentDescription = "Back"
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(44), dp(48)))
        header.addView(TextView(this).apply {
            text = "Voice Studio"
            textSize = 20f
            gravity = Gravity.CENTER_VERTICAL
            setTextColor(primary)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        page.addView(header)

        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(22), dp(18), dp(28))
        }
        scroll.addView(content)
        page.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))

        content.addView(TextView(this).apply {
            text = "Choose how you want to create or convert a voice."
            textSize = 16f
            setTextColor(primary)
            setPadding(0, 0, 0, dp(18))
        })

        content.addView(modeCard(
            title = "Online AI Voice",
            tag = "CLOUD · INTERNET REQUIRED",
            description = "Cloud-based natural voice generation and voice conversion. Can use a connected AI voice provider for more expressive results.",
            detail = "Online provider connection is not configured yet. Your audio will not be uploaded until a provider is connected and you choose to use Online mode.",
            actionText = "Online mode · Setup required",
            enabled = false
        ))
        content.addView(View(this).apply { setBackgroundColor(0x00000000) }, LinearLayout.LayoutParams(1, dp(14)))
        content.addView(modeCard(
            title = "Offline Voice",
            tag = "ON THIS PHONE · NO INTERNET FOR INFERENCE",
            description = "Use downloaded Hindi and English Kokoro voices and Gujarati Indic Tiny TTS. Processing stays on this phone.",
            detail = "Offline text-to-speech is available with installed models. Audio-to-voice conversion currently uses a speech-to-text then speech-generation workflow; the original recording remains unchanged.",
            actionText = "Open Offline Voice",
            enabled = true
        ) {
            startActivity(Intent(this, TextToVoiceActivity::class.java))
        })

        content.addView(TextView(this).apply {
            text = "Online and Offline are separate modes. Downloaded offline models are managed from Download Model on the home screen."
            textSize = 13f
            setTextColor(secondary)
            setPadding(2, dp(16), 2, 0)
        })
        setContentView(page)
    }

    private fun modeCard(
        title: String,
        tag: String,
        description: String,
        detail: String,
        actionText: String,
        enabled: Boolean,
        onClick: (() -> Unit)? = null
    ): LinearLayout {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
            setBackgroundColor(surface)
        }
        card.addView(TextView(this).apply {
            text = tag
            textSize = 11f
            setTextColor(accent)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        card.addView(TextView(this).apply {
            text = title
            textSize = 21f
            setTextColor(primary)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, dp(7), 0, dp(7))
        })
        card.addView(TextView(this).apply {
            text = description
            textSize = 14f
            setTextColor(secondary)
        })
        card.addView(TextView(this).apply {
            text = detail
            textSize = 12f
            setTextColor(secondary)
            setPadding(0, dp(10), 0, dp(4))
        })
        card.addView(Button(this).apply {
            text = actionText
            isAllCaps = false
            isEnabled = enabled
            setOnClickListener { onClick?.invoke() }
        }, LinearLayout.LayoutParams(-1, dp(48)))
        return card
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
