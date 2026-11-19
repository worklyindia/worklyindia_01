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

/** Simple Workly Voice companion home: only Downloads and Settings are user-facing destinations. */
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

        // This background relay is intentionally kept for the WEBSITE's voice calls.
        // It has no separate screen or controls in the app; Downloads and Settings are the only tabs.
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

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bg)
        }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
        }
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(22), dp(20), dp(24))
            setBackgroundColor(bg)
        }
        page.addView(TextView(this).apply {
            text = "WORKLY INDIA  ✦  COMPANION"
            textSize = 12f
            letterSpacing = .12f
            setTextColor(0xFF5B7CFA.toInt())
            setTypeface(typeface, Typeface.BOLD)
        })
        page.addView(TextView(this).apply {
            text = "Workly Voice"
            textSize = 34f
            setTextColor(primary)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(9), 0, dp(2))
        })
        page.addView(TextView(this).apply {
            text = "Your website voice companion"
            textSize = 15f
            setTextColor(secondary)
        })

        val hero = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(22), dp(28), dp(22), dp(28))
            background = gradient(intArrayOf(0xFF536DFE.toInt(), 0xFF8B5CF6.toInt(), 0xFFEC4899.toInt()), 28)
            elevation = dp(7).toFloat()
        }
        val orb = TextView(this).apply {
            text = "◉"
            textSize = 58f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setShadowLayer(dp(16).toFloat(), 0f, 0f, 0xAAFFFFFF.toInt())
        }
        hero.addView(orb, LinearLayout.LayoutParams(-1, dp(82)))
        ObjectAnimator.ofPropertyValuesHolder(
            orb,
            PropertyValuesHolder.ofFloat("alpha", .78f, 1f),
            PropertyValuesHolder.ofFloat("scaleX", .96f, 1.04f),
            PropertyValuesHolder.ofFloat("scaleY", .96f, 1.04f)
        ).apply {
            duration = 1800L
            repeatCount = ObjectAnimator.INFINITE
            repeatMode = ObjectAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }
        hero.addView(TextView(this).apply {
            text = "Made for your website"
            textSize = 21f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(10), 0, dp(5))
        })
        hero.addView(TextView(this).apply {
            text = "Keep Workly Voice ready. Your website can use this phone for voice processing when the companion is connected."
            textSize = 13f
            setTextColor(0xFFF2F3FF.toInt())
            gravity = Gravity.CENTER
            setLineSpacing(dp(3).toFloat(), 1f)
        })
        page.addView(hero, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(28); bottomMargin = dp(22) })

        val info = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(15), dp(16), dp(15))
            background = rounded(if (dark) 0xFF17243A.toInt() else 0xFFFFFFFF.toInt(), 20)
            elevation = dp(2).toFloat()
        }
        info.addView(TextView(this).apply {
            text = "Simple. Secure. Ready."
            textSize = 17f
            setTextColor(primary)
            setTypeface(typeface, Typeface.BOLD)
        })
        info.addView(TextView(this).apply {
            text = "Only two app sections: Downloads and Settings. No separate chat or calling screens."
            textSize = 13f
            setTextColor(secondary)
            setPadding(0, dp(6), 0, 0)
        })
        page.addView(info, LinearLayout.LayoutParams(-1, -2))
        page.addView(TextView(this).apply {
            text = "HINDI  •  ENGLISH  •  GUJARATI"
            textSize = 11f
            letterSpacing = .08f
            gravity = Gravity.CENTER
            setTextColor(secondary)
            setPadding(0, dp(26), 0, dp(12))
        })
        scroll.addView(page)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(bottomNavigation(), LinearLayout.LayoutParams(-1, dp(76)))
        setContentView(root)
    }

    private fun bottomNavigation(): View {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(14), dp(8), dp(14), dp(8))
            background = rounded(if (dark) 0xFF17243A.toInt() else 0xFFFFFFFF.toInt(), 22)
            elevation = dp(12).toFloat()
        }
        bar.addView(navItem("⬇", "Downloads", intArrayOf(0xFF2878F0.toInt(), 0xFF24B8C7.toInt())) {
            startActivity(Intent(this, SpeechDownloadsActivity::class.java))
        }, LinearLayout.LayoutParams(0, -1, 1f).apply { rightMargin = dp(6) })
        bar.addView(navItem("⚙", "Settings", intArrayOf(0xFF8B5CF6.toInt(), 0xFFEC4899.toInt())) {
            startActivity(Intent(this, SettingsActivity::class.java))
        }, LinearLayout.LayoutParams(0, -1, 1f).apply { leftMargin = dp(6) })
        return bar
    }

    private fun navItem(icon: String, title: String, colors: IntArray, click: () -> Unit): View {
        val item = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(8), dp(8), dp(8))
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                if (dark) intArrayOf(0xFF24334E.toInt(), 0xFF2C3458.toInt()) else intArrayOf(0xFFEAF1FF.toInt(), 0xFFF4EAFE.toInt())
            ).apply { cornerRadius = dp(17).toFloat() }
            isClickable = true
            isFocusable = true
            setOnClickListener { click() }
        }
        val iconView = TextView(this).apply {
            text = icon
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(colors[0])
        }
        item.addView(iconView, LinearLayout.LayoutParams(dp(34), -1))
        item.addView(TextView(this).apply {
            text = title
            textSize = 15f
            setTextColor(primary)
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER_VERTICAL
        })
        return item
    }

    private fun gradient(colors: IntArray, radius: Int) = GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply { cornerRadius = dp(radius).toFloat() }
    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat() }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
