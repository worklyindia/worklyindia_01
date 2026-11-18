package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.Locale
import java.util.concurrent.Executors

class SettingsActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var pairingCode: EditText
    private lateinit var status: TextView
    private var dark = false
    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primary get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondary get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        if (Build.VERSION.SDK_INT >= 23) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (dark) 0 else
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(24))
            setBackgroundColor(bg)
        }
        page.addView(Button(this).apply {
            text = "‹  Back"
            isAllCaps = false
            setTextColor(primary)
            setBackgroundColor(bg)
            setOnClickListener { finish() }
        })
        page.addView(label("Settings", 28, primary, true))
        val aiModelCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(14))
            setBackgroundColor(surface)
            elevation = dp(2).toFloat()
        }
        aiModelCard.addView(label("AI model downloads", 18, primary, true))
        aiModelCard.addView(label(
            "Download, verify and select the on-device AI model here. Chat stays focused on messaging; language is detected automatically.",
            13, secondary, false
        ))
        aiModelCard.addView(button("Manage AI model downloads").apply {
            setOnClickListener {
                startActivity(Intent(this@SettingsActivity, SpeechDownloadsActivity::class.java))
            }
        })
        page.addView(aiModelCard)
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
            setBackgroundColor(surface)
            elevation = dp(2).toFloat()
        }
        card.addView(label("Secure phone server", 18, primary, true))
        card.addView(label(
            "On the Workly India website, sign in and open AI Voice Server. Generate a one-time pairing code, then enter it below. The code expires after five minutes and can be used once.",
            13, secondary, false
        ))
        pairingCode = EditText(this).apply {
            hint = "24-character pairing code"
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            setTextColor(primary)
            setHintTextColor(secondary)
            setBackgroundColor(if (dark) 0xFF25364A.toInt() else 0xFFF4F7FB.toInt())
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }
        card.addView(pairingCode)
        card.addView(button("Pair this phone").apply { setOnClickListener { pairPhone() } })
        status = label("Loading pairing status…", 13, secondary, true)
        card.addView(status)
        card.addView(button("Start phone server").apply { setOnClickListener { requestNotificationAndStart() } })
        card.addView(button("Stop phone server", secondaryStyle = true).apply {
            setOnClickListener {
                stopService(Intent(this@SettingsActivity, VoiceRelayService::class.java))
                refreshStatus("Phone server stop requested.")
            }
        })
        page.addView(card)
        page.addView(label(
            "The phone uses outbound HTTPS polling; no incoming router port is required. Keep the foreground-service notification visible. Android may limit long-running data-sync services, so reopen the app if Android stops the server.",
            12, secondary, false
        ).apply { setPadding(0, dp(12), 0, 0) })
        setContentView(ScrollView(this).apply { addView(page) })
        refreshStatus()
    }

    private fun pairPhone() {
        val code = pairingCode.text?.toString()?.trim()?.uppercase(Locale.ROOT).orEmpty()
        if (!Regex("^[A-F0-9]{24}$").matches(code)) {
            pairingCode.error = "Enter the 24-character code from Workly website"
            return
        }
        status.text = "Pairing securely…"
        worker.execute {
            try {
                val token = VoiceRelayApi.claimDevice(code, "Workly Voice Android")
                SecureDeviceTokenStore.save(this, token)
                runOnUiThread {
                    pairingCode.setText("")
                    refreshStatus("Phone paired securely. You can start the server.")
                }
            } catch (error: Exception) {
                runOnUiThread { refreshStatus("Pairing failed: ${error.message ?: "Please try again."}") }
            }
        }
    }

    private fun requestNotificationAndStart() {
        if (SecureDeviceTokenStore.read(this).isNullOrBlank()) {
            status.text = "Pair this phone first using a Workly website pairing code."
            return
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            return
        }
        startRelayService()
    }

    private fun startRelayService() {
        val intent = Intent(this, VoiceRelayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
        status.text = "Starting secure phone server…"
    }

    private fun refreshStatus(prefix: String? = null) {
        val paired = !SecureDeviceTokenStore.read(this).isNullOrBlank()
        val service = getSharedPreferences(VoiceRelayService.STATUS_PREFS, MODE_PRIVATE)
            .getString(VoiceRelayService.STATUS_KEY, "Phone server is stopped.")
        status.text = listOfNotNull(if (paired) "Paired phone" else "Not paired", prefix, service).joinToString(" · ")
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS) {
            if (grantResults.firstOrNull() != PackageManager.PERMISSION_GRANTED) {
                status.text = "Notification permission denied. Android may hide the foreground-service notification."
            }
            startRelayService()
        }
    }

    override fun onDestroy() {
        worker.shutdown()
        super.onDestroy()
    }

    private fun label(value: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = value; textSize = size.toFloat(); setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(6), 0, dp(6))
    }

    private fun button(value: String, secondaryStyle: Boolean = false) = Button(this).apply {
        text = value; isAllCaps = false; minHeight = dp(48)
        setTextColor(if (secondaryStyle) primary else 0xFFFFFFFF.toInt())
        setBackgroundColor(if (secondaryStyle) surface else 0xFF1769C2.toInt())
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    companion object { private const val REQUEST_NOTIFICATIONS = 6101 }
}
