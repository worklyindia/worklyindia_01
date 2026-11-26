package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.google.firebase.messaging.FirebaseMessaging
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

        // Register this installation's push token after the owner device is paired.
        val deviceToken = SecureDeviceTokenStore.read(this)
        if (!deviceToken.isNullOrBlank()) {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { fcmToken ->
                Thread {
                    runCatching { VoiceRelayApi.registerFcmToken(deviceToken, fcmToken) }
                }.start()
            }
        }

        // Keep the website relay worker active; it is required for website voice processing.
        val relayIntent = Intent(this, VoiceRelayService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(relayIntent)
        } else {
            startService(relayIntent)
        }

        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        ChatWorkTheme.applyWindow(this)

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
            text = "ChatWork"
            textSize = 27f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFFFFFFFF.toInt() else 0xFF142033.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(8), dp(2), dp(8), dp(4))
            contentDescription = "ChatWork"
        }, LinearLayout.LayoutParams(-1, dp(44)))

        root.addView(TextView(this).apply {
            text = "Text To Voice"
            textSize = 19f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFF7EA7FF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(8), dp(8), dp(8), dp(8))
            isClickable = true
            isFocusable = true
            background = null
            setOnClickListener {
                startActivity(Intent(this@MainActivity, TextToVoiceActivity::class.java))
            }
        }, LinearLayout.LayoutParams(-1, dp(58)))

        root.addView(TextView(this).apply {
            text = "Voice To Text"
            textSize = 19f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFF7EA7FF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(8), dp(8), dp(8), dp(8))
            isClickable = true
            isFocusable = true
            background = null
            setOnClickListener { startActivity(Intent(this@MainActivity, VoiceToTextActivity::class.java)) }
        }, LinearLayout.LayoutParams(-1, dp(58)))

        root.addView(TextView(this).apply {
            text = "AI Assistant"
            textSize = 19f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFF7EA7FF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(8), dp(8), dp(8), dp(8))
            isClickable = true
            isFocusable = true
            background = null
            setOnClickListener {
                startActivity(Intent(this@MainActivity, OfflineAiChatActivity::class.java))
            }
        }, LinearLayout.LayoutParams(-1, dp(58)))

        root.addView(TextView(this).apply {
            text = "Download Model"
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

        root.addView(TextView(this).apply {
            text = "ChatWork Data Collection"
            textSize = 17f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFF7EA7FF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(8), dp(8), dp(8), dp(8))
            isClickable = true
            isFocusable = true
            background = null
            setOnClickListener {
                startActivity(Intent(this@MainActivity, DataCollectionActivity::class.java))
            }
        }, LinearLayout.LayoutParams(-1, dp(64)))

        setContentView(root)
        signalAnimation.playAnimation()
        // Direct-channel update notices open the official download in the browser.
        // The app never requests permission to silently install another APK.
        if (BuildConfig.FLAVOR == "direct") {
            ChatWorkAppUpdater(this).checkForUpdate()
        }
        // Ask for notifications at first launch on Android 13+.
        // Microphone permission is requested only when the user taps Start Speaking.
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        }
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

    companion object { private const val REQUEST_NOTIFICATIONS = 2101 }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
