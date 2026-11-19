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

/** Workly Voice home with one full-width model-download action. */
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
        // It has no separate screen or controls in the app.
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
            setPadding(dp(20), dp(30), dp(20), dp(24))
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

        // All Settings content is displayed directly on Home; no separate Settings page/tab.
        val prefs = getSharedPreferences(VoiceRelayService.STATUS_PREFS, MODE_PRIVATE)
        val tokenReady = !SecureDeviceTokenStore.read(this).isNullOrBlank()
        val status = prefs.getString(VoiceRelayService.STATUS_KEY, "Relay has not reported a status yet.") ?: "Unknown"
        val heartbeat = prefs.getLong(VoiceRelayService.LAST_POLL_KEY, 0L)
        val online = heartbeat > 0 && System.currentTimeMillis() - heartbeat < 60_000L &&
            !status.contains("reconnect", true) && !status.contains("stopped", true)

        fun addSection(title: String, body: String): LinearLayout {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(14), dp(16), dp(14))
                background = rounded(if (dark) 0xFF17243A.toInt() else 0xFFFFFFFF.toInt(), 20)
                elevation = dp(2).toFloat()
            }
            card.addView(TextView(this).apply {
                text = title
                textSize = 17f
                setTextColor(primary)
                setTypeface(typeface, Typeface.BOLD)
            })
            card.addView(TextView(this).apply {
                text = body
                textSize = 13f
                setTextColor(secondary)
                setPadding(0, dp(7), 0, 0)
            })
            page.addView(card, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
            return card
        }

        val connectionCard = addSection(
            "Workly India",
            "Workly India: " + (if (online) "Connected" else "Not Connected") +
                "\nConnection: " + (if (online) "Connected" else "Checking / reconnecting") +
                "\nStatus: " + status +
                "\nLast relay check: " + (if (heartbeat > 0) java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(heartbeat)) else "Not recorded") +
                "\nTransport: HTTPS · Supabase relay · 1-second polling" +
                "\nWebsite setup: automatic. Keep Workly Voice connected for website voice processing."
        )
        connectionCard.addView(TextView(this).apply {
            text = "Refresh connection status"
            textSize = 14f
            setTextColor(0xFF5B7CFA.toInt())
            setPadding(0, dp(10), 0, 0)
            isClickable = true
            isFocusable = true
            setOnClickListener { recreate() }
        })

        val diagnosticsCard = addSection(
            "Connection Checks",
            (if (tokenReady) "✓" else "⚠") + " Workly account registration" +
                "\n" + (if (online) "✓" else "⚠") + " Phone relay: " + (if (online) "Online / recent heartbeat" else "Not confirmed online") +
                "\n✓ Website requests: shown here when received by this phone" +
                "\nAI / speech processing: " + (if (status.contains("error", true) || status.contains("failed", true)) status else "Ready when a website request arrives")
        )
        diagnosticsCard.addView(TextView(this).apply {
            text = "Refresh diagnostics"
            textSize = 14f
            setTextColor(0xFF5B7CFA.toInt())
            setPadding(0, dp(10), 0, 0)
            isClickable = true
            isFocusable = true
            setOnClickListener { recreate() }
        })

        val historyCard = addSection("Logs · Last 24 Hours", "")
        val rawEvents = prefs.getString(VoiceRelayService.EVENTS_KEY, "[]") ?: "[]"
        val events = runCatching {
            val array = org.json.JSONArray(rawEvents)
            (0 until array.length()).mapNotNull { array.optJSONObject(it) }
                .filter { System.currentTimeMillis() - it.optLong("at") <= 86_400_000L }
                .sortedByDescending { it.optLong("at") }
        }.getOrDefault(emptyList())
        historyCard.addView(TextView(this).apply {
            text = if (events.isEmpty()) "No website calls or errors recorded in the last hour." else "${events.size} activity records"
            textSize = 13f
            setTextColor(secondary)
        })
        events.forEach { event ->
            val failed = event.optBoolean("error") ||
                event.optString("message").contains("failed", true) ||
                event.optString("message").contains("error", true)
            historyCard.addView(TextView(this).apply {
                text = (if (failed) "⚠ " else "• ") + event.optString("message") +
                    "\n" + java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(event.optLong("at"))) +
                    (if (event.optString("detail").isNotBlank()) "\n" + event.optString("detail") else "")
                textSize = 13f
                setTextColor(if (failed) 0xFFD97706.toInt() else primary)
                setPadding(0, dp(8), 0, dp(8))
            })
        }
        historyCard.addView(TextView(this).apply {
            text = "Clear activity history"
            textSize = 14f
            setTextColor(0xFF5B7CFA.toInt())
            setPadding(0, dp(10), 0, 0)
            isClickable = true
            isFocusable = true
            setOnClickListener { prefs.edit().remove(VoiceRelayService.EVENTS_KEY).apply(); recreate() }
        })
        scroll.addView(page)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(downloadAction(), LinearLayout.LayoutParams(-1, dp(72)))
        setContentView(root)
    }

    /** Transparent, edge-to-edge download action: the app background remains visible. */
    private fun downloadAction(): View {
        return TextView(this).apply {
            text = "⬇   Download Model"
            textSize = 19f
            gravity = Gravity.CENTER
            setTextColor(if (dark) 0xFF7EA7FF.toInt() else 0xFF2878F0.toInt())
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(8), dp(10), dp(8), dp(10))
            isClickable = true
            isFocusable = true
            setOnClickListener {
                startActivity(Intent(this@MainActivity, SpeechDownloadsActivity::class.java))
            }
            // No button/card background or elevation; full-width touch target.
            background = null
        }
    }

    private fun gradient(colors: IntArray, radius: Int) = GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply { cornerRadius = dp(radius).toFloat() }
    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat() }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
