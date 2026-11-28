package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.graphics.Canvas
import android.graphics.Movie
import android.graphics.Paint
import android.graphics.RectF
import android.widget.LinearLayout
import android.widget.TextView
import com.google.firebase.messaging.FirebaseMessaging

/** ChatWork Home screen with the bundled Mr3W GIF animation. */
class MainActivity : Activity() {
    private var dark = false
    private var signalAnimationView: AssetGifView? = null
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

        root.addView(TextView(this).apply {
            text = "JARVIS"; textSize = 18f; gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFFFFFFFF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD); setPadding(dp(12), dp(12), dp(12), dp(12))
            isClickable = true; isFocusable = true
            setOnClickListener { startActivity(Intent(this@MainActivity, JarvisSetupActivity::class.java)) }
        }, LinearLayout.LayoutParams(-1, dp(58)))
        // Center animation occupies the free space between system bars and bottom action.
        val signalAnimation = AssetGifView(this, "Mr3W.gif").apply {
            setPadding(dp(18), dp(12), dp(18), dp(12))
            contentDescription = "ChatWork animated home graphic"
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
            text = "AI Model Downloads"
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
        signalAnimation.startAnimation()
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
        signalAnimationView?.startAnimation()
    }

    override fun onPause() {
        signalAnimationView?.pauseAnimation()
        super.onPause()
    }

    override fun onDestroy() {
        signalAnimationView?.stopAnimation()
        signalAnimationView = null
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_NOTIFICATIONS = 2101
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}


/** Lightweight, offline GIF renderer for the bundled Home screen animation. */
private class AssetGifView(context: android.content.Context, assetName: String) : View(context) {
    private val gif: Movie? = runCatching {
        context.assets.open(assetName).use { Movie.decodeStream(it) }
    }.getOrNull()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val destination = RectF()
    private var startedAt = 0L
    private var running = false

    fun startAnimation() {
        if (gif == null || running) return
        running = true
        startedAt = android.os.SystemClock.uptimeMillis()
        invalidate()
    }

    fun pauseAnimation() {
        running = false
        invalidate()
    }

    fun stopAnimation() {
        running = false
        startedAt = 0L
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val movie = gif ?: return
        val frameWidth = movie.width().toFloat()
        val frameHeight = movie.height().toFloat()
        if (frameWidth <= 0f || frameHeight <= 0f || width <= 0 || height <= 0) return

        val availableWidth = (width - paddingLeft - paddingRight).coerceAtLeast(1).toFloat()
        val availableHeight = (height - paddingTop - paddingBottom).coerceAtLeast(1).toFloat()
        val scale = minOf(availableWidth / frameWidth, availableHeight / frameHeight)
        val drawWidth = frameWidth * scale
        val drawHeight = frameHeight * scale
        val left = paddingLeft + (availableWidth - drawWidth) / 2f
        val top = paddingTop + (availableHeight - drawHeight) / 2f
        destination.set(left, top, left + drawWidth, top + drawHeight)

        val duration = movie.duration().takeIf { it > 0 } ?: 1000
        val elapsed = if (running) (android.os.SystemClock.uptimeMillis() - startedAt).coerceAtLeast(0L) else 0L
        movie.setTime((elapsed % duration).toInt())
        canvas.save()
        canvas.clipRect(paddingLeft, paddingTop, width - paddingRight, height - paddingBottom)
        movie.draw(canvas, destination.left, destination.top, paint)
        canvas.restore()

        if (running) postInvalidateDelayed(16L)
    }
}
