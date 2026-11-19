package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Minimal Workly Voice home: animated ready signal and one download action. */
class MainActivity : Activity() {
    private var dark = false
    private val bg get() = if (dark) 0xFF0B1220.toInt() else 0xFFF4F7FF.toInt()
    private val primary get() = if (dark) 0xFFF4F7FF.toInt() else 0xFF14213D.toInt()
    private val secondary get() = if (dark) 0xFFB6C3D8.toInt() else 0xFF66748D.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (SecureDeviceTokenStore.read(this).isNullOrBlank()) {
            startActivity(Intent(this, WorklyAccountActivity::class.java))
            finish()
            return
        }

        // Required background worker: website voice requests are processed through this phone.
        val relayIntent = Intent(this, VoiceRelayService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) startForegroundService(relayIntent) else startService(relayIntent)

        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = if (dark) 0 else
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg) }
        val scroll = ScrollView(this).apply { isFillViewport = true; clipToPadding = false; overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS }
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(22), dp(34), dp(22), dp(24))
            setBackgroundColor(bg)
        }
        page.addView(TextView(this).apply {
            text = "WORKLY INDIA  ✦  COMPANION"
            textSize = 12f; letterSpacing = .12f
            setTextColor(0xFF718BFF.toInt())
            setTypeface(typeface, Typeface.BOLD)
        })
        page.addView(TextView(this).apply {
            text = "Workly Voice"
            textSize = 34f; setTextColor(primary)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(12), 0, dp(4))
        })
        page.addView(TextView(this).apply {
            text = "Your website voice companion"
            textSize = 15f; setTextColor(secondary)
        })

        val signalPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(42), dp(20), dp(42))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(0xFF536DFE.toInt(), 0xFF875CF6.toInt(), 0xFFE449A7.toInt())
            ).apply { cornerRadius = dp(30).toFloat() }
            elevation = dp(7).toFloat()
        }
        val signal = TextView(this).apply {
            text = "◉"
            textSize = 76f
            gravity = Gravity.CENTER
            setTextColor(0xFFFFFFFF.toInt())
            setShadowLayer(dp(18).toFloat(), 0f, 0f, 0xCCFFFFFF.toInt())
            contentDescription = "Workly Voice ready signal animation"
        }
        signalPanel.addView(signal, LinearLayout.LayoutParams(-1, dp(118)))
        ObjectAnimator.ofPropertyValuesHolder(
            signal,
            PropertyValuesHolder.ofFloat("alpha", .62f, 1f),
            PropertyValuesHolder.ofFloat("scaleX", .88f, 1.12f),
            PropertyValuesHolder.ofFloat("scaleY", .88f, 1.12f)
        ).apply {
            duration = 1450L
            repeatCount = ObjectAnimator.INFINITE
            repeatMode = ObjectAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }
        page.addView(signalPanel, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(42); bottomMargin = dp(28)
        })
        scroll.addView(page)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(TextView(this).apply {
            text = "↓   Download Model"
            textSize = 19f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFF7EA7FF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(8), dp(10), dp(8), dp(10))
            isClickable = true
            isFocusable = true
            background = null
            setOnClickListener { startActivity(Intent(this@MainActivity, SpeechDownloadsActivity::class.java)) }
        }, LinearLayout.LayoutParams(-1, dp(72)))
        setContentView(root)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
