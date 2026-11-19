package com.worklyindia.aivoice

import android.app.Activity
import android.app.ActivityManager
import android.os.Bundle
import android.os.Environment
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File

/**
 * ChatWork Saient/Wan video entry point.
 *
 * This screen intentionally performs a device capability preflight only. The
 * Saient Wan native runtime is not yet bundled in this Android project, so it
 * must not offer a model download or pretend that generation is available.
 */
class ChatWorkVideoActivity : Activity() {
    private val blue = 0xFF1769C2.toInt()
    private val ink = 0xFF142033.toInt()
    private val muted = 0xFF65748B.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(18))
            setBackgroundColor(0xFFF4F7FB.toInt())
        }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(Button(this).apply {
            text = "‹"; textSize = 28f; isAllCaps = false
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        header.addView(TextView(this).apply {
            text = "AI Video · Saient Wan 2.1"
            textSize = 20f; setTextColor(ink); setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        root.addView(header)

        root.addView(TextView(this).apply {
            text = "On-device text-to-video"
            textSize = 16f; setTextColor(blue); setPadding(0, dp(12), 0, dp(4))
        })
        root.addView(TextView(this).apply {
            text = "Saient Wan 2.1 is planned to generate video locally on this phone. The model pack is about 4.73 GB and is downloaded separately."
            textSize = 14f; setTextColor(muted)
        })

        val info = devicePreflight()
        root.addView(TextView(this).apply {
            text = buildString {
                appendLine("DEVICE COMPATIBILITY CHECK")
                appendLine("Vulkan: ${if (info.vulkan) "Available" else "Not detected"}")
                appendLine("RAM available now: ${info.availableRamMb} MB")
                appendLine("Free storage: ${info.freeStorageGb} GB")
                appendLine("CPU ABI: ${info.abi}")
                appendLine()
                append("These checks do not guarantee that Wan 2.1 will run. A real native-runtime test is still required.")
            }
            textSize = 14f; setTextColor(ink); setPadding(dp(14), dp(14), dp(14), dp(14))
            setBackgroundColor(0xFFFFFFFF.toInt())
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(18) })

        root.addView(TextView(this).apply {
            text = "Setup status: Native Saient Wan runtime is not yet included in this Workly build. Video generation and model download are therefore not enabled yet."
            textSize = 14f; setTextColor(0xFF8A4B00.toInt()); setPadding(0, dp(16), 0, dp(12))
        })

        root.addView(Button(this).apply {
            text = "Check device again"
            isAllCaps = false
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(blue)
            setOnClickListener { recreate() }
        }, LinearLayout.LayoutParams(-1, dp(50)))
        root.addView(TextView(this).apply {
            text = "No cloud video API is used by this preflight screen. No large model files are downloaded."
            textSize = 12f; setTextColor(muted); setPadding(0, dp(12), 0, 0)
        })

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private data class Preflight(val vulkan: Boolean, val availableRamMb: Long, val freeStorageGb: Long, val abi: String)

    private fun devicePreflight(): Preflight {
        val memory = ActivityManager.MemoryInfo()
        (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
        val storage = filesDir.usableSpace / (1024L * 1024L * 1024L)
        val vulkan = packageManager.hasSystemFeature("android.hardware.vulkan.level", 0) ||
            packageManager.hasSystemFeature("android.hardware.vulkan.version", 0)
        val abi = android.os.Build.SUPPORTED_ABIS.firstOrNull() ?: "Unknown"
        return Preflight(vulkan, memory.availMem / (1024L * 1024L), storage, abi)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
