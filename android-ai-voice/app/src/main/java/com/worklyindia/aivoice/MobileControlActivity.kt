package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/** User-visible controls limited to Android global navigation and scroll actions. */
class MobileControlActivity : Activity() {
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(24, 24, 24, 24)
        }
        root.addView(TextView(this).apply {
            text = "Mobile Control"
            textSize = 24f
        })
        root.addView(TextView(this).apply {
            text = "ChatWork only performs the navigation and scroll actions you choose here. Accessibility permission is optional and can be disabled anytime."
            setPadding(0, 16, 0, 16)
        })
        status = TextView(this).apply { setPadding(0, 8, 0, 16) }
        root.addView(status)
        button(root, "Enable / Review Accessibility permission") {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
        button(root, "Back") { performGlobal(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK) }
        button(root, "Home") { performGlobal(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME) }
        button(root, "Recent apps") { performGlobal(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS) }
        button(root, "Scroll screen down") { scroll(true) }
        button(root, "Scroll screen up") { scroll(false) }
        button(root, "Wi-Fi settings") { startActivity(Intent(Settings.ACTION_WIFI_SETTINGS)) }
        button(root, "Bluetooth settings") { startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }
        button(root, "Display settings") { startActivity(Intent(Settings.ACTION_DISPLAY_SETTINGS)) }
        button(root, "Back to Assistant Tools") { finish() }
        setContentView(root)
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) refreshStatus()
    }

    private fun button(root: LinearLayout, label: String, action: () -> Unit) {
        root.addView(Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        })
    }

    private fun refreshStatus() {
        status.text = if (ChatWorkMobileControlService.enabled(this) &&
            MobileControlServiceRegistry.service != null
        ) {
            "Accessibility control: enabled and connected"
        } else if (ChatWorkMobileControlService.enabled(this)) {
            "Accessibility permission is enabled. Waiting for Android to connect the service."
        } else {
            "Accessibility control: disabled"
        }
    }

    private fun performGlobal(action: Int) {
        val service = MobileControlServiceRegistry.service
        if (service == null || !service.performGlobalAction(action)) {
            Toast.makeText(this, "Enable ChatWork Mobile Control in Accessibility settings first.", Toast.LENGTH_LONG).show()
        }
        refreshStatus()
    }

    private fun scroll(forward: Boolean) {
        val service = MobileControlServiceRegistry.service
        if (service == null) {
            Toast.makeText(this, "Enable ChatWork Mobile Control in Accessibility settings first.", Toast.LENGTH_LONG).show()
        } else {
            val sent = runCatching { service.scrollCurrentScreen(forward) }.getOrDefault(false)
            Toast.makeText(this, if (sent) "Scroll action sent." else "No scrollable area found.", Toast.LENGTH_SHORT).show()
        }
        refreshStatus()
    }
}
