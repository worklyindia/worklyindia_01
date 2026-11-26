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
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Mobile-friendly diagnostics and connection settings for ChatWork. */
class SettingsActivity : Activity() {
    private var dark = false
    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()
    private lateinit var content: LinearLayout\n    private var updateCheckStarted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        if (Build.VERSION.SDK_INT >= 29) {
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = if (dark) 0 else View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        val scroll = ScrollView(this).apply { setBackgroundColor(bg); clipToPadding = false }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(10), dp(18), dp(28))
            setBackgroundColor(bg)
        }
        scroll.addView(content)
        setContentView(scroll)
        render()
    }

    override fun onResume() {\n        super.onResume()\n        if (::content.isInitialized) render()\n        if (!updateCheckStarted && BuildConfig.FLAVOR == "direct") {\n            updateCheckStarted = true\n            runCatching { ChatWorkAppUpdater(this).checkForUpdate() }\n                .onFailure { android.util.Log.e("ChatWorkSettings", "Update check could not start", it) }\n        }\n    }

    private fun render() {
        content.removeAllViews()
        content.addView(Button(this).apply {
            text = "‹  Back"; isAllCaps = false; setTextColor(primary); setBackgroundColor(bg)
            setOnClickListener { finish() }
        })
        content.addView(label("AI Settings", 30, primary, true))
        content.addView(label("Manage your offline AI assistant, voice models and background listening from one place.", 14, secondary, false))

        val aiDashboard = card()
        aiDashboard.addView(label("AI Assistant", 19, primary, true))
        aiDashboard.addView(label("Open your AI chat and use the ⋮ menu → Enable Hey ChatWork to start background wake-word listening. The app will check the required models and permissions first.", 13, secondary, false))
        aiDashboard.addView(Button(this).apply {
            text = "Open AI Assistant & Background Voice"
            isAllCaps = false
            setOnClickListener { startActivity(Intent(this@SettingsActivity, OfflineAiChatActivity::class.java)) }
        })
        aiDashboard.addView(Button(this).apply {
            text = "Download / Manage AI Models"
            isAllCaps = false
            setOnClickListener { startActivity(Intent(this@SettingsActivity, SpeechDownloadsActivity::class.java)) }
        })
        aiDashboard.addView(Button(this).apply {
            text = "Text to Voice · Test Voice"
            isAllCaps = false
            setOnClickListener { startActivity(Intent(this@SettingsActivity, TextToVoiceActivity::class.java)) }
        })
        aiDashboard.addView(Button(this).apply {
            text = "Voice to Text"
            isAllCaps = false
            setOnClickListener { startActivity(Intent(this@SettingsActivity, VoiceToTextActivity::class.java)) }
        })
        aiDashboard.addView(Button(this).apply {
            text = "Assistant Tools · Memory / Files / Reminders"
            isAllCaps = false
            setOnClickListener { startActivity(Intent(this@SettingsActivity, AssistantToolsActivity::class.java)) }
        })
        aiDashboard.addView(Button(this).apply {
            text = "AI Agent"
            isAllCaps = false
            setOnClickListener { startActivity(Intent(this@SettingsActivity, ChatWorkAgentActivity::class.java)) }
        })
        aiDashboard.addView(Button(this).apply {
            text = "Mobile Control"
            isAllCaps = false
            setOnClickListener { startActivity(Intent(this@SettingsActivity, MobileControlActivity::class.java)) }
        })
        val micAllowed = checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val notificationsAllowed = Build.VERSION.SDK_INT < 33 || checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
        aiDashboard.addView(label("Microphone permission: " + if (micAllowed) "Allowed" else "Not allowed yet", 13, if (micAllowed) 0xFF22A06B.toInt() else 0xFFD97706.toInt(), true))
        aiDashboard.addView(label("Notifications permission: " + if (notificationsAllowed) "Allowed" else "Not allowed yet", 13, if (notificationsAllowed) 0xFF22A06B.toInt() else 0xFFD97706.toInt(), true))
        // card() attaches the dashboard card to content; do not add it a second time.
        content.addView(label("Connection & Diagnostics", 22, primary, true))

        val prefs = getSharedPreferences(VoiceRelayService.STATUS_PREFS, MODE_PRIVATE)
        val tokenReady = !SecureDeviceTokenStore.read(this).isNullOrBlank()
        val status = prefs.getString(VoiceRelayService.STATUS_KEY, "Phone server has not reported a status yet.") ?: "Unknown"
        val heartbeat = prefs.getLong(VoiceRelayService.LAST_POLL_KEY, 0L)
        val online = heartbeat > 0 && System.currentTimeMillis() - heartbeat < 60_000L && !status.contains("reconnect", true) && !status.contains("stopped", true)

        val connection = card()
        connection.addView(label("Workly India account", 19, primary, true))
        connection.addView(label(if (tokenReady) "✓ Secure account registration active" else "⚠ Sign-in required", 15, if (tokenReady) 0xFF22A06B.toInt() else 0xFFD97706.toInt(), true))
        connection.addView(label("Connection: " + if (online) "Connected" else "Checking / reconnecting", 16, if (online) 0xFF22A06B.toInt() else 0xFFD97706.toInt(), true))
        connection.addView(label(status, 14, secondary, false))
        connection.addView(label("Last successful relay check: " + if (heartbeat > 0) time(heartbeat) + " (" + age(heartbeat) + ")" else "Not recorded yet", 13, secondary, false))
        connection.addView(label("Transport: outbound HTTPS · Relay: Supabase · Poll interval: 1 second", 12, secondary, false))
        connection.addView(label("Website setup: automatic. This phone uses the signed-in Workly India account; no pairing code is needed.", 13, secondary, false))
        connection.addView(Button(this).apply {
            text = "Refresh connection status"; isAllCaps = false; setOnClickListener { render() }
        })

        val diagnostics = card()
        diagnostics.addView(label("Connection checks", 19, primary, true))
        diagnostics.addView(checkLine("Workly account token", if (tokenReady) "Registered securely" else "Missing — sign in again", tokenReady))
        diagnostics.addView(checkLine("Phone relay service", if (online) "Online / recent heartbeat" else "Not confirmed online", online))
        diagnostics.addView(checkLine("Website requests", "Requests appear below when received by this phone", true))
        diagnostics.addView(checkLine("AI / speech processing", if (status.contains("failed", true) || status.contains("error", true)) status else "Ready when a website request arrives", !status.contains("failed", true) && !status.contains("error", true)))
        diagnostics.addView(label("If a request fails, open its entry below for the recorded error message and time. Share that detail with support; never share account tokens.", 12, secondary, false))

        val history = card()
        history.addView(label("Recent activity · Last 1 hour", 19, primary, true))
        val events = readEvents().filter { System.currentTimeMillis() - it.optLong("at") <= 3_600_000L }.sortedByDescending { it.optLong("at") }
        history.addView(label(if (events.isEmpty()) "No website calls or errors recorded in the last hour." else "${events.size} activity records", 13, secondary, false))
        events.forEach { event ->
            val failed = event.optBoolean("error") || event.optString("message").contains("failed", true) || event.optString("message").contains("error", true)
            val item = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(10), dp(9), dp(10), dp(9))
                setBackgroundColor(if (failed) 0x22D97706 else bg)
            }
            item.addView(label((if (failed) "⚠ " else "• ") + event.optString("message"), 14, if (failed) 0xFFD97706.toInt() else primary, true))
            item.addView(label(time(event.optLong("at")) + "  ·  " + event.optString("kind", "Status"), 12, secondary, false))
            val detail = event.optString("detail")
            if (detail.isNotBlank()) item.addView(label(detail, 12, secondary, false))
            history.addView(item)
            history.addView(divider())
        }
        history.addView(Button(this).apply {
            text = "Refresh activity"; isAllCaps = false; setOnClickListener { render() }
        })
        history.addView(Button(this).apply {
            text = "Clear activity history"; isAllCaps = false; setOnClickListener {
                prefs.edit().remove(VoiceRelayService.EVENTS_KEY).apply(); render()
            }
        })
        content.addView(connection)
        content.addView(diagnostics)
        content.addView(history)
        content.addView(label("Privacy & reliability", 17, primary, true))
        content.addView(label("Only connection and request status/error summaries are kept on this device for this activity list. The list automatically shows the most recent hour. Android can restrict background services; keep ChatWork open if the phone server disconnects.", 12, secondary, false))
    }

    private fun readEvents(): List<JSONObject> {
        val raw = getSharedPreferences(VoiceRelayService.STATUS_PREFS, MODE_PRIVATE).getString(VoiceRelayService.EVENTS_KEY, "[]") ?: "[]"
        return runCatching {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { array.optJSONObject(it) }
        }.getOrDefault(emptyList())
    }

    private fun checkLine(name: String, value: String, ok: Boolean) = label((if (ok) "✓  " else "⚠  ") + name + ": " + value, 13, if (ok) 0xFF22A06B.toInt() else 0xFFD97706.toInt(), false)
    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(15), dp(16), dp(15))
        setBackgroundColor(surface)
        elevation = dp(2).toFloat()
        content.addView(this, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(14) })
    }
    private fun label(value: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = value; textSize = size.toFloat(); setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(5), 0, dp(5))
    }
    private fun button(value: String, secondaryStyle: Boolean = false) = Button(this).apply {
        text = value; isAllCaps = false; minHeight = dp(48)
        setTextColor(if (secondaryStyle) primary else 0xFFFFFFFF.toInt())
    }
    private fun divider() = View(this).apply {
        setBackgroundColor(if (dark) 0x334B5B70 else 0x22304760)
        layoutParams = LinearLayout.LayoutParams(-1, dp(1))
    }
    private fun time(at: Long) = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(at))
    private fun age(at: Long): String {
        val seconds = ((System.currentTimeMillis() - at).coerceAtLeast(0) / 1000)
        return if (seconds < 60) "${seconds}s ago" else "${seconds / 60}m ago"
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
