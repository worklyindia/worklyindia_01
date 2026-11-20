package com.worklyindia.aivoice

import android.app.Activity
import android.app.ActivityManager
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.VideoView
import java.io.File

class ChatWorkVideoActivity : Activity() {
    private val blue = 0xFF1769C2.toInt()
    private val ink = 0xFF142033.toInt()
    private val muted = 0xFF65748B.toInt()
    private lateinit var status: TextView
    private lateinit var prompt: EditText
    private lateinit var download: Button
    private lateinit var generate: Button
    private lateinit var player: VideoView

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
            text = "AI Video · Saient Wan 2.1"; textSize = 20f
            setTextColor(ink); setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        root.addView(header)
        root.addView(TextView(this).apply {
            text = "Generate a video from your text prompt on a compatible Android phone."
            textSize = 14f; setTextColor(muted); setPadding(0, dp(10), 0, dp(12))
        })
        val info = devicePreflight()
        root.addView(TextView(this).apply {
            text = "DEVICE CHECK\nVulkan: ${if (info.first) "Available" else "Not detected"}  •  Available RAM: ${info.second} MB\nFree app storage: ${info.third} GB  •  ABI: ${info.fourth}"
            textSize = 13f; setTextColor(ink); setPadding(dp(12), dp(12), dp(12), dp(12))
            setBackgroundColor(0xFFFFFFFF.toInt())
        })
        prompt = EditText(this).apply {
            hint = "Describe the video you want to create…"
            minLines = 3; maxLines = 5; textSize = 15f
            gravity = Gravity.TOP
        }
        root.addView(prompt, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(14) })
        status = TextView(this).apply {
            text = runtimeStatus(); textSize = 13f; setTextColor(muted)
            setPadding(0, dp(10), 0, dp(10))
        }
        root.addView(status)
        download = Button(this).apply {
            text = "Download Wan model (about 4.73 GB)"
            isAllCaps = false; setTextColor(0xFFFFFFFF.toInt()); setBackgroundColor(blue)
            setOnClickListener { downloadModel() }
        }
        root.addView(download, LinearLayout.LayoutParams(-1, dp(50)))
        generate = Button(this).apply {
            text = "Generate video"; isAllCaps = false
            setTextColor(0xFFFFFFFF.toInt()); setBackgroundColor(0xFF16834A.toInt())
            setOnClickListener { generateVideo() }
        }
        root.addView(generate, LinearLayout.LayoutParams(-1, dp(50)).apply { topMargin = dp(8) })
        root.addView(Button(this).apply {
            text = "Cancel current task"; isAllCaps = false
            setOnClickListener { WanVideoModelManager.cancel(); WanVideoGenerator.cancel(); status.text = "Cancellation requested." }
        }, LinearLayout.LayoutParams(-1, dp(46)).apply { topMargin = dp(8) })
        player = VideoView(this)
        root.addView(player, LinearLayout.LayoutParams(-1, dp(220)).apply { topMargin = dp(14) })
        root.addView(TextView(this).apply {
            text = "Model files stay on this phone. Wan generation needs a compatible 64-bit ARM Vulkan device and around 4.73 GB model storage. This first version generates locally; second-phone pairing and ChatWork website video transfer are not connected yet."
            textSize = 12f; setTextColor(muted); setPadding(0, dp(12), 0, 0)
        })
        setContentView(ScrollView(this).apply { addView(root) })
        refreshButtons()
    }

    private fun downloadModel() {
        setBusy(true)
        Thread {
            try {
                WanVideoModelManager.download(this) { done, total, file ->
                    runOnUiThread {
                        status.text = "Downloading $file • ${(done * 100 / total).coerceIn(0, 100)}%"
                    }
                }
                runOnUiThread { status.text = "Wan model pack verified and installed."; setBusy(false); refreshButtons() }
            } catch (e: Exception) {
                runOnUiThread { status.text = "Download failed: ${e.message}"; setBusy(false); refreshButtons() }
            }
        }.start()
    }

    private fun generateVideo() {
        val text = prompt.text.toString().trim()
        if (text.isEmpty()) { prompt.error = "Enter a video prompt"; return }
        setBusy(true)
        Thread {
            try {
                val output = WanVideoGenerator.generate(this, text) { done, total, message ->
                    runOnUiThread {
                        status.text = if (message.startsWith("SAIENT_WAN_PROGRESS")) {
                            "Generating video • ${(done * 100 / total).coerceIn(0, 100)}%"
                        } else message
                    }
                }
                runOnUiThread {
                    status.text = "Video created: ${output.name}"
                    player.setVideoURI(Uri.fromFile(output))
                    player.setOnPreparedListener { it.isLooping = true; player.start() }
                    setBusy(false); refreshButtons()
                }
            } catch (e: Exception) {
                runOnUiThread { status.text = "Generation failed: ${e.message}"; setBusy(false); refreshButtons() }
            }
        }.start()
    }

    private fun runtimeStatus(): String = when {
        !WanVideoGenerator.isRuntimeAvailable(this) -> "Wan native runtime is not present in this installed APK yet. Build the PR to bundle it."
        WanVideoModelManager.isReady(this) -> "Wan model pack: Ready"
        else -> "Wan model pack: Not downloaded"
    }

    private fun refreshButtons() {
        download.isEnabled = false
        generate.isEnabled = false
        Thread {
            val runtime = WanVideoGenerator.isRuntimeAvailable(this)
            val ready = WanVideoModelManager.isReady(this)
            runOnUiThread {
                download.isEnabled = !ready
                generate.isEnabled = runtime && ready
                status.text = when {
                    !runtime -> "Wan native runtime is not present in this installed APK yet. Build the PR to bundle it."
                    ready -> "Wan model pack: Ready"
                    else -> "Wan model pack: Not downloaded"
                }
            }
        }.start()
    }

    private fun setBusy(busy: Boolean) {
        download.isEnabled = !busy
        generate.isEnabled = !busy
    }

    private fun devicePreflight(): Quad {
        val memory = ActivityManager.MemoryInfo()
        (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
        val storage = filesDir.usableSpace / (1024L * 1024L * 1024L)
        val vulkan = packageManager.hasSystemFeature("android.hardware.vulkan.level", 0) ||
            packageManager.hasSystemFeature("android.hardware.vulkan.version", 0)
        val abi = android.os.Build.SUPPORTED_ABIS.firstOrNull() ?: "Unknown"
        return Quad(vulkan, memory.availMem / (1024L * 1024L), storage, abi)
    }

    private data class Quad(val first: Boolean, val second: Long, val third: Long, val fourth: String)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
