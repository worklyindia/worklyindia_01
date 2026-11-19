package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import com.airbnb.lottie.LottieAnimationView
import com.airbnb.lottie.LottieDrawable

/** Centered animated signal home screen with a fixed Download Model action. */
class MainActivity : Activity() {
    private var dark = false
    private var signalAnimationView: LottieAnimationView? = null
    private val bg get() = if (dark) 0xFF0B1220.toInt() else 0xFFF4F7FF.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (SecureDeviceTokenStore.read(this).isNullOrBlank()) {
            startActivity(Intent(this, WorklyAccountActivity::class.java))
            finish()
            return
        }

        // Keep the website relay worker active; it is required for website voice processing.
        val relayIntent = Intent(this, VoiceRelayService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(relayIntent)
        } else {
            startService(relayIntent)
        }

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
            gravity = Gravity.CENTER
            setBackgroundColor(bg)
        }

        // Center animation occupies the free space between system bars and bottom action.
        val signalAnimation = LottieAnimationView(this).apply {
            setAnimation("Signals.json")
            repeatCount = LottieDrawable.INFINITE
            repeatMode = LottieDrawable.RESTART
            scaleType = android.widget.ImageView.ScaleType.FIT_CENTER
            setPadding(dp(18), dp(12), dp(18), dp(12))
            setBackgroundColor(bg)
            contentDescription = "Animated signal"
        }
        signalAnimationView = signalAnimation
        root.addView(signalAnimation, LinearLayout.LayoutParams(-1, 0, 1f))

        root.addView(TextView(this).apply {
            text = "🎨   AI Image Studio"
            textSize = 18f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFF7EA7FF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(8), dp(8), dp(8), dp(8))
            isClickable = true
            isFocusable = true
            contentDescription = "Create or edit an image with Workly AI"
            background = null
            setOnClickListener {
                startActivity(Intent(this@MainActivity, ChatWorkImageActivity::class.java))
            }
        }, LinearLayout.LayoutParams(-1, dp(64)))

        root.addView(TextView(this).apply {
            text = "↓   Download Model"
            textSize = 19f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFF7EA7FF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(8), dp(10), dp(8), dp(10))
            isClickable = true
            isFocusable = true
            background = null
            setOnClickListener {
                startActivity(Intent(this@MainActivity, SpeechDownloadsActivity::class.java))
            }
        }, LinearLayout.LayoutParams(-1, dp(72)))

        setContentView(root)
        signalAnimation.playAnimation()
    }

    override fun onResume() {
        super.onResume()
        signalAnimationView?.resumeAnimation()
    }

    override fun onPause() {
        signalAnimationView?.pauseAnimation()
        super.onPause()
    }

    override fun onDestroy() {
        signalAnimationView?.cancelAnimation()
        signalAnimationView = null
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
