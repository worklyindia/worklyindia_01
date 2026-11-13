package com.worklyindia.app

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Native-only conversation surface for Workly owner/employer WhatsApp,
 * Instagram and Facebook notification bubbles. Normal notification taps
 * continue to open MainActivity and the regular Workly web chat.
 *
 * Sending always uses the same authenticated Workly Edge Function actions
 * already used by notification quick replies; no platform credentials or
 * service-role key are stored in this Activity.
 */
class NativeSocialChatBubbleActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var root: LinearLayout
    private lateinit var messagesView: LinearLayout
    private lateinit var composer: EditText
    private lateinit var sendButton: TextView
    private var sending = false
    private var dark = false
    private val history = mutableListOf<JSONObject>()

    private val platform: String by lazy {
        val raw = intent.getStringExtra("platform")?.lowercase().orEmpty()
        when {
            raw == "instagram" || intent.getStringExtra("type") == "instagram_message" -> "instagram"
            raw == "facebook" || intent.getStringExtra("type") == "facebook_message" -> "facebook"
            else -> "whatsapp"
        }
    }

    private val title: String by lazy {
        intent.getStringExtra("chat_title")?.takeIf { it.isNotBlank() }
            ?: intent.getStringExtra("title")?.takeIf { it.isNotBlank() }
            ?: when (platform) {
                "instagram" -> "Instagram chat"
                "facebook" -> "Facebook chat"
                else -> "WhatsApp chat"
            }
    }

    private val pageBackground get() = if (dark) Color.rgb(10, 16, 28) else Color.rgb(246, 248, 251)
    private val surface get() = if (dark) Color.rgb(20, 29, 43) else Color.WHITE
    private val primaryText get() = if (dark) Color.rgb(241, 245, 249) else Color.rgb(15, 23, 42)
    private val secondaryText get() = if (dark) Color.rgb(157, 170, 190) else Color.rgb(100, 116, 139)
    private val accent get() = if (dark) Color.rgb(22, 163, 74) else Color.rgb(22, 163, 74)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        readNotificationHistory()
        buildScreen()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
    }

    private fun label(value: String, size: Float, bold: Boolean = false, color: Int = primaryText) =
        TextView(this).apply {
            text = value
            textSize = size
            setTextColor(color)
            if (bold) setTypeface(typeface, Typeface.BOLD)
        }

    private fun readNotificationHistory() {
        val raw = intent.getStringExtra("messages")
        if (!raw.isNullOrBlank()) {
            runCatching {
                val array = JSONArray(raw)
                for (i in 0 until array.length()) {
                    val item = array.optJSONObject(i) ?: continue
                    val text = item.optString("text", item.optString("message")).trim()
                    if (text.isNotBlank()) history.add(JSONObject(item.toString()).put("_mine", item.optBoolean("is_me", item.optBoolean("from_me", false))))
                }
            }
        }
        if (history.isEmpty()) {
            val body = intent.getStringExtra("chat_body")
                ?: intent.getStringExtra("body")
                ?: intent.getStringExtra("message")
            if (!body.isNullOrBlank()) {
                history.add(JSONObject()
                    .put("text", body)
                    .put("sender_name", intent.getStringExtra("sender_name") ?: title)
                    .put("_mine", false)
                    .put("timestamp", System.currentTimeMillis()))
            }
        }
        intent.getStringExtra("ai_reply")?.takeIf { it.isNotBlank() }?.let {
            history.add(JSONObject().put("text", it).put("sender_name", "You").put("_mine", true).put("timestamp", System.currentTimeMillis()))
        }
    }

    private fun buildScreen() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(pageBackground)
            layoutParams = ViewGroup.LayoutParams(-1, -1)
        }
        setContentView(root)

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(12))
            setBackgroundColor(surface)
        }
        header.addView(label(title, 17f, true))
        val platformLabel = when (platform) {
            "instagram" -> "Instagram"
            "facebook" -> "Facebook"
            else -> "WhatsApp"
        }
        header.addView(label("$platformLabel · Workly India", 12f, false, secondaryText))
        root.addView(header)
        root.addView(View(this).apply { setBackgroundColor(if (dark) 0xff334155.toInt() else 0xffe2e8f0.toInt()) },
            LinearLayout.LayoutParams(-1, dp(1)))

        val scroll = ScrollView(this).apply { isFillViewport = true }
        messagesView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }
        scroll.addView(messagesView)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        renderHistory()

        val composerBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(8), dp(10), dp(8))
            setBackgroundColor(surface)
        }
        composer = EditText(this).apply {
            hint = "Message…"
            textSize = 15f
            setTextColor(primaryText)
            setHintTextColor(secondaryText)
            minLines = 1
            maxLines = 4
            imeOptions = EditorInfo.IME_ACTION_SEND
            setPadding(dp(14), dp(10), dp(14), dp(10))
            background = rounded(pageBackground, 22)
            setOnEditorActionListener { _, action, _ ->
                if (action == EditorInfo.IME_ACTION_SEND) { sendReply(); true } else false
            }
        }
        composerBar.addView(composer, LinearLayout.LayoutParams(0, -2, 1f))
        sendButton = label("Send", 14f, true, Color.WHITE).apply {
            gravity = Gravity.CENTER
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = rounded(accent, 22)
            setOnClickListener { sendReply() }
        }
        composerBar.addView(sendButton, LinearLayout.LayoutParams(-2, -2).apply { leftMargin = dp(8) })
        root.addView(composerBar)

        if (!canReply()) {
            composer.isEnabled = false
            sendButton.isEnabled = false
            sendButton.alpha = 0.45f
            Toast.makeText(this, "Reply details are unavailable. Open the Workly chat to continue.", Toast.LENGTH_LONG).show()
        }
    }

    private fun renderHistory() {
        messagesView.removeAllViews()
        if (history.isEmpty()) {
            messagesView.addView(label("No message preview was included with this notification.", 13f, false, secondaryText).apply {
                gravity = Gravity.CENTER
                setPadding(dp(20))
            })
            return
        }
        history.forEach { item ->
            val body = item.optString("text", item.optString("message")).trim()
            if (body.isBlank()) return@forEach
            val mine = item.optBoolean("_mine", item.optBoolean("is_me", item.optBoolean("from_me", false)))
            val bubble = TextView(this).apply {
                text = body
                textSize = 14f
                setTextColor(if (mine) Color.WHITE else primaryText)
                setPadding(dp(12), dp(9), dp(12), dp(9))
                background = rounded(if (mine) accent else surface, 16)
                maxWidth = (resources.displayMetrics.widthPixels * 0.78f).toInt()
            }
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = if (mine) Gravity.END else Gravity.START
                setPadding(0, dp(3), 0, dp(3))
                addView(bubble)
            }
            messagesView.addView(row, LinearLayout.LayoutParams(-1, -2))
            val stamp = item.optLong("timestamp", 0L)
            if (stamp > 0L) {
                val millis = if (stamp < 10_000_000_000L) stamp * 1000L else stamp
                val time = java.text.SimpleDateFormat("dd MMM, hh:mm a", java.util.Locale.getDefault()).format(java.util.Date(millis))
                messagesView.addView(label(time, 10f, false, secondaryText).apply {
                    gravity = if (mine) Gravity.END else Gravity.START
                    setPadding(dp(4), 0, dp(4), dp(4))
                })
            }
        }
    }

    private fun canReply(): Boolean {
        val type = intent.getStringExtra("type").orEmpty().lowercase()
        return when (platform) {
            "instagram", "facebook" ->
                validToken(intent.getStringExtra("account_id")) &&
                validToken(intent.getStringExtra("sender_id")) &&
                (intent.getStringExtra("audience").orEmpty().isEmpty() || intent.getStringExtra("audience") == "support")
            else -> {
                val employer = intent.getStringExtra("employer_notification") == "true"
                if (employer) validUuid(intent.getStringExtra("conversation_id")) && validToken(intent.getStringExtra("phone_number_id"))
                else intent.getStringExtra("audience") == "customer_service" &&
                    (intent.getStringExtra("phone") ?: intent.getStringExtra("phone_number") ?: intent.getStringExtra("sender_phone"))
                        ?.matches(Regex("[+0-9]{10,16}")) == true &&
                    (type == "whatsapp_message" || type.startsWith("whatsapp_"))
            }
        }
    }

    private fun validToken(value: String?): Boolean = value?.matches(Regex("[A-Za-z0-9_-]{1,100}")) == true
    private fun validUuid(value: String?): Boolean = value?.matches(Regex("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")) == true

    private fun sendReply() {
        val message = composer.text.toString().trim()
        if (message.isBlank() || sending) return
        if (message.length > (if (platform == "whatsapp") 4096 else 2000)) {
            Toast.makeText(this, "Message is too long.", Toast.LENGTH_SHORT).show()
            return
        }
        sending = true
        composer.isEnabled = false
        sendButton.isEnabled = false
        scope.launch {
            val result = runCatching { withContext(Dispatchers.IO) { sendThroughWorkly(message) } }
            sending = false
            composer.isEnabled = true
            sendButton.isEnabled = true
            result.onSuccess {
                history.add(JSONObject().put("text", message).put("_mine", true).put("timestamp", System.currentTimeMillis()))
                composer.setText("")
                renderHistory()
                Toast.makeText(this@NativeSocialChatBubbleActivity, "Message sent.", Toast.LENGTH_SHORT).show()
            }.onFailure {
                Toast.makeText(this@NativeSocialChatBubbleActivity, it.message ?: "Message could not be sent.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun sendThroughWorkly(message: String) {
        val session = NativeAuth.refreshSession(this)
            ?: throw IllegalStateException("Sign in to Workly India again to reply.")
        val base = "https://jubwzelupbntbetpajqb.supabase.co"
        val apiKey = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
        val endpoint: String
        val payload = JSONObject()
        when (platform) {
            "instagram", "facebook" -> {
                endpoint = "$base/functions/v1/email-api"
                payload.put("action", "meta_inline_reply")
                    .put("platform", platform)
                    .put("account_id", intent.getStringExtra("account_id"))
                    .put("recipient_id", intent.getStringExtra("sender_id"))
                    .put("audience", intent.getStringExtra("audience").orEmpty())
                    .put("message", message)
            }
            else -> if (intent.getStringExtra("employer_notification") == "true") {
                endpoint = "$base/functions/v1/workly-india"
                payload.put("scope", "employer")
                    .put("action", "send")
                    .put("conversation_id", intent.getStringExtra("conversation_id"))
                    .put("phone_number_id", intent.getStringExtra("phone_number_id"))
                    .put("message", message)
            } else {
                endpoint = "$base/functions/v1/whatsapp-cloud-api"
                payload.put("action", "send_reply")
                    .put("audience", intent.getStringExtra("audience"))
                    .put("phone_number", intent.getStringExtra("phone") ?: intent.getStringExtra("phone_number") ?: intent.getStringExtra("sender_phone"))
                    .put("message", message)
            }
        }
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 25_000
            setRequestProperty("apikey", apiKey)
            setRequestProperty("Authorization", "Bearer ${session.accessToken}")
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
        }
        try {
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw IllegalStateException("Workly could not send this reply ($status).")
            val result = JSONObject(response)
            if (result.has("success") && !result.optBoolean("success")) {
                throw IllegalStateException(result.optString("error", "The platform rejected this reply."))
            }
        } finally {
            connection.disconnect()
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val nextDark = (newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        if (nextDark != dark) {
            dark = nextDark
            buildScreen()
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
