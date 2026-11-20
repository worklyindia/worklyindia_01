package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.content.res.Configuration
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * ChatWork model catalogue. AI models are intended to run on Workly's website
 * infrastructure, not on the Android device. Download actions stay unavailable
 * until the corresponding server-side model host and API are configured.
 */
class SpeechDownloadsActivity : Activity() {
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
            window.decorView.systemUiVisibility = if (dark) 0 else View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
        buildUi()
    }

    private fun buildUi() {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(bg)
            clipToPadding = false
        }
        val list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(24), dp(18), dp(28))
        }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(TextView(this).apply {
            text = "‹"
            textSize = 38f
            setTextColor(primary)
            gravity = Gravity.CENTER
            setPadding(0, 0, dp(12), 0)
            isClickable = true
            isFocusable = true
            contentDescription = "Back"
            setOnClickListener { finish() }
        })
        header.addView(label("Download Model", 26, primary, true))
        list.addView(header)
        list.addView(label(
            "Download AI models to Workly website servers. Models will run on the website, not on this phone.",
            14, secondary, false
        ).apply { setPadding(0, dp(8), 0, dp(18)) })

        list.addView(label("AI IMAGE GENERATION", 14, primary, true).apply { setPadding(0, dp(8), 0, dp(6)) })
        addServerModelCard(
            list,
            "Image Generation Model",
            "Website image generation · Model files stored on the server"
        )

        list.addView(label("AI VIDEO GENERATION", 14, primary, true).apply { setPadding(0, dp(18), 0, dp(6)) })
        addServerModelCard(
            list,
            "Wan 2.1 Text-to-Video 1.3B",
            "Video generation model pack · Approximately 4.73 GB"
        )

        list.addView(label("LANGUAGE TRANSLATION", 14, primary, true).apply { setPadding(0, dp(18), 0, dp(6)) })
        addServerModelCard(
            list,
            "MADLAD-400 3B Translation",
            "Multilingual translation model · Downloaded and cached by the translation server"
        )

        list.addView(label(
            "Server connection is not configured yet. These model downloads will be enabled after the website model host and secure download API are deployed.",
            12, secondary, false
        ).apply { setPadding(0, dp(16), 0, 0) })

        setContentView(scroll.apply { addView(list) })
    }

    private fun addServerModelCard(parent: LinearLayout, title: String, description: String) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(surface)
            elevation = dp(2).toFloat()
        }
        card.addView(label(title, 16, primary, true))
        card.addView(label(description, 12, secondary, false))
        card.addView(label("Website server · Not downloaded", 12, secondary, true))
        card.addView(Button(this).apply {
            text = "Server setup required"
            isAllCaps = false
            isEnabled = false
        })
        parent.addView(card, LinearLayout.LayoutParams(-1, -2).apply {
            bottomMargin = dp(10)
        })
    }

    private fun label(value: String, size: Int, color: Int, bold: Boolean) =
        TextView(this).apply {
            text = value
            textSize = size.toFloat()
            setTextColor(color)
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, dp(5), 0, dp(5))
        }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
