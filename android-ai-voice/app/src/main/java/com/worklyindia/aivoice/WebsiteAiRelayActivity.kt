package com.worklyindia.aivoice

import android.app.Activity
import android.app.ActivityManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.widget.TextView
import java.util.concurrent.Executors

/**
 * Receives a one-turn request from Workly India's mobile website, runs the
 * already-downloaded Qwen model in ChatWork, then returns to the same web chat.
 * No account tokens, model files, or private app storage are exposed over IPC.
 */
class WebsiteAiRelayActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    @Volatile private var handled = false
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        status = TextView(this).apply {
            text = "Preparing your local AI reply…"
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
        }
        setContentView(status)
        handleRequest(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handled = false
        handleRequest(intent)
    }

    private fun handleRequest(request: Intent?) {
        if (handled) return
        val data = request?.data ?: run {
            finish()
            return
        }
        if (data.scheme != "worklychat" || data.host != "ai") {
            finish()
            return
        }
        val prompt = data.getQueryParameter("prompt")?.trim().orEmpty()
        val requestId = data.getQueryParameter("requestId")?.trim().orEmpty()
        val returnUrl = data.getQueryParameter("returnUrl").orEmpty()
        if (prompt.isBlank() || prompt.length > 4000 || requestId.isBlank() || requestId.length > 128 || !isAllowedReturnUrl(returnUrl)) {
            finish()
            return
        }
        handled = true
        status.text = "Generating reply with your downloaded Qwen model…"
        worker.execute {
            val engine = OfflineAiEngine()
            try {
                val manager = QwenModelManager(this)
                val memory = ActivityManager.MemoryInfo()
                (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
                val savedId = getSharedPreferences("workly_qwen_models", MODE_PRIVATE)
                    .getString("selected_model_id", null)
                val saved = manager.models.firstOrNull { it.id == savedId }
                    ?.takeIf { manager.snapshot(it).state == QwenModelManager.State.READY && manager.isSupported(it, memory.availMem) }
                val chosen = saved ?: manager.models
                    .filter { manager.snapshot(it).state == QwenModelManager.State.READY }
                    .filter { manager.isSupported(it, memory.availMem) }
                    .maxByOrNull { it.size }
                    ?: throw IllegalStateException("No downloaded Qwen model is ready or enough free memory is unavailable.")
                check(engine.loadModel(manager.file(chosen))) { "Qwen could not load the downloaded model." }
                val reply = engine.generate(prompt).trim()
                check(reply.isNotBlank()) { "Qwen returned an empty reply." }
                returnToWebsite(returnUrl, requestId, reply.take(6000), null)
            } catch (error: Throwable) {
                returnToWebsite(returnUrl, requestId, null, error.message ?: "Local Qwen inference failed.")
            } finally {
                runCatching { engine.unload() }
                runOnUiThread { finish() }
            }
        }
    }

    private fun isAllowedReturnUrl(value: String): Boolean = runCatching {
        val uri = Uri.parse(value)
        uri.scheme == "https" &&
            uri.host == "worklyindia.devs.surf" &&
            uri.path == "/ai-assistant"
    }.getOrDefault(false)

    private fun returnToWebsite(baseUrl: String, requestId: String, reply: String?, error: String?) {
        val callback = Uri.parse(baseUrl).buildUpon()
            .appendQueryParameter("localAiRequestId", requestId)
        if (!reply.isNullOrBlank()) {
            callback.appendQueryParameter("localAiReply", reply)
        } else {
            callback.appendQueryParameter("localAiFallback", "1")
        }
        runOnUiThread {
            startActivity(Intent(Intent.ACTION_VIEW, callback.build()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    override fun onDestroy() {
        worker.shutdownNow()
        super.onDestroy()
    }
}
