package com.worklyindia.app

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.setPadding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Native employee/employer Workly conversation bubble.
 * Uses the same encrypted website Supabase session and the existing RLS policies.
 * The website remains the source of truth; messages are read/written through PostgREST.
 */
class NativeChatBubbleActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val handler = Handler(Looper.getMainLooper())
    private var root: LinearLayout? = null
    private var listContainer: LinearLayout? = null
    private var messageContainer: LinearLayout? = null
    private var composer: EditText? = null
    private var selectedConversation: JSONObject? = null
    private var conversations = JSONArray()
    private var messages = JSONArray()
    private var session: NativeSession? = null
    private var loading = false
    private var sending = false
    private var dark = false
    private var lastMessageId: String? = null
    private val conversationIdFromIntent: String? by lazy {
        val extra = intent.getStringExtra("conversation_id")
        val fromUrl = intent.data?.getQueryParameter("conversation_id")
            ?: intent.data?.getQueryParameter("conversationId")
        (extra ?: fromUrl)?.takeIf { UUID_REGEX.matches(it) }
    }

    private val poll = object : Runnable {
        override fun run() {
            if (isFinishing || isDestroyed) return
            if (selectedConversation != null) loadMessages(silent = true) else loadConversations(silent = true)
            handler.postDelayed(this, if (selectedConversation != null) 4_000L else 12_000L)
        }
    }

    private fun isDarkMode(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    private val background get() = if (dark) Color.rgb(10, 16, 28) else Color.rgb(248, 250, 252)
    private val surface get() = if (dark) Color.rgb(20, 29, 43) else Color.WHITE
    private val foreground get() = if (dark) Color.rgb(241, 245, 249) else Color.rgb(15, 23, 42)
    private val muted get() = if (dark) Color.rgb(157, 170, 190) else Color.rgb(100, 116, 139)
    private val accent get() = if (dark) Color.rgb(34, 197, 94) else Color.rgb(22, 163, 74)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = isDarkMode()
        session = NativeAuth.refreshSession(this)
        if (session == null) {
            showMessage("Sign in to Workly India to open your chats.")
            return
        }
        if (session?.userRole !in listOf("employer", "jobseeker")) {
            showMessage("This account does not have access to employee/employer conversations.")
            return
        }
        buildBase()
        val target = conversationIdFromIntent
        if (target != null) {
            loadConversation(target)
        } else {
            showConversationList()
            loadConversations()
        }
        handler.postDelayed(poll, 4_000L)
    }

    private fun buildBase() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(background)
            layoutParams = ViewGroup.LayoutParams(-1, -1)
        }
        setContentView(root)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun text(value: String, size: Float = 14f, bold: Boolean = false, color: Int = foreground): TextView =
        TextView(this).apply {
            this.text = value
            textSize = size
            setTextColor(color)
            if (bold) setTypeface(typeface, Typeface.BOLD)
        }

    private fun rounded(color: Int, radius: Float): GradientDrawable =
        GradientDrawable().apply { setColor(color); cornerRadius = dp(radius.toInt()).toFloat() }

    private fun buildHeader(title: String, subtitle: String? = null, back: Boolean = false) {
        root?.removeAllViews()
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(10), dp(12), dp(10))
            setBackgroundColor(surface)
        }
        if (back) {
            val backView = text("‹", 32f, false, foreground).apply {
                gravity = Gravity.CENTER
                setOnClickListener {
                    selectedConversation = null
                    messages = JSONArray()
                    showConversationList()
                    loadConversations()
                }
            }
            header.addView(backView, LinearLayout.LayoutParams(dp(38), dp(44)))
        }
        val titles = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        titles.addView(text(title, 17f, true))
        if (!subtitle.isNullOrBlank()) titles.addView(text(subtitle, 12f, false, muted))
        header.addView(titles, LinearLayout.LayoutParams(0, -2, 1f))
        root?.addView(header)
        val divider = View(this).apply { setBackgroundColor(if (dark) Color.rgb(45, 55, 72) else Color.rgb(226, 232, 240)) }
        root?.addView(divider, LinearLayout.LayoutParams(-1, dp(1)))
    }

    private fun showConversationList() {
        buildHeader("Workly Chat", if (session?.userRole == "employer") "Employer inbox" else "Employee inbox")
        val scroll = ScrollView(this)
        listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10))
        }
        scroll.addView(listContainer)
        root?.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        listContainer?.addView(text("Loading conversations…", 14f, false, muted).apply {
            gravity = Gravity.CENTER
            setPadding(dp(24))
        })
    }

    private fun loadConversations(silent: Boolean = false) {
        val current = session ?: return
        if (loading) return
        loading = true
        scope.launch {
            val result = runCatching {
                val column = if (current.userRole == "employer") "employer_id" else "applicant_id"
                val url = REST + "/conversations?select=id,job_id,employer_id,applicant_id,status,last_message_at&" +
                    column + "=eq." + enc(current.userId) + "&order=last_message_at.desc&limit=100"
                requestJson("GET", url, null) as? JSONArray ?: JSONArray()
            }
            loading = false
            result.onSuccess {
                conversations = it
                if (selectedConversation == null) renderConversations()
            }.onFailure {
                if (!silent) showError("Could not load chats. Check your connection and try again.")
            }
        }
    }

    private fun renderConversations() {
        val container = listContainer ?: return
        container.removeAllViews()
        if (conversations.length() == 0) {
            container.addView(text("No conversations yet", 16f, true).apply {
                gravity = Gravity.CENTER
                setPadding(dp(30))
            })
            container.addView(text("Chats with your job applicants or employer will appear here.", 13f, false, muted).apply {
                gravity = Gravity.CENTER
            })
            return
        }
        for (index in 0 until conversations.length()) {
            val conv = conversations.optJSONObject(index) ?: continue
            val id = conv.optString("id")
            val otherId = if (session?.userRole == "employer") conv.optString("applicant_id") else conv.optString("employer_id")
            val title = if (session?.userRole == "employer") "Employee" else "Employer"
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14))
                background = rounded(surface, 14f)
                setOnClickListener { loadConversation(id) }
            }
            row.addView(text(title, 15f, true))
            row.addView(text("Conversation · ${id.take(8)}", 12f, false, muted))
            val jobId = conv.optString("job_id")
            if (jobId.isNotBlank()) row.addView(text("Job reference: ${jobId.take(8)}", 11f, false, muted))
            container.addView(row, LinearLayout.LayoutParams(-1, -2).apply {
                bottomMargin = dp(8)
            })
        }
    }

    private fun loadConversation(id: String) {
        if (!UUID_REGEX.matches(id)) {
            showError("Invalid conversation link.")
            return
        }
        val current = session ?: return
        scope.launch {
            val result = runCatching {
                val roleColumn = if (current.userRole == "employer") "employer_id" else "applicant_id"
                val url = REST + "/conversations?select=id,job_id,employer_id,applicant_id,status,last_message_at&id=eq." +
                    enc(id) + "&" + roleColumn + "=eq." + enc(current.userId) + "&limit=1"
                (requestJson("GET", url, null) as? JSONArray)?.optJSONObject(0)
                    ?: throw IllegalStateException("This conversation is not available for your account.")
            }
            result.onSuccess {
                selectedConversation = it
                showMessageScreen()
                loadMessages()
            }.onFailure {
                showError(it.message ?: "Could not open this conversation.")
            }
        }
    }

    private fun showMessageScreen() {
        val conv = selectedConversation ?: return
        val otherTitle = if (session?.userRole == "employer") "Employee chat" else "Employer chat"
        buildHeader(otherTitle, "Messages sync with Workly India", back = true)
        val scroll = ScrollView(this).apply { isFillViewport = true }
        messageContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12))
        }
        scroll.addView(messageContainer)
        root?.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        val composerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(8), dp(10), dp(8))
            setBackgroundColor(surface)
        }
        composer = EditText(this).apply {
            hint = "Type a message…"
            textSize = 15f
            setTextColor(foreground)
            setHintTextColor(muted)
            maxLines = 4
            minLines = 1
            imeOptions = EditorInfo.IME_ACTION_SEND
            setPadding(dp(14), dp(10), dp(14), dp(10))
            background = rounded(background, 22f)
            setOnEditorActionListener { _, action, _ ->
                if (action == EditorInfo.IME_ACTION_SEND) { sendMessage(); true } else false
            }
        }
        composerRow.addView(composer, LinearLayout.LayoutParams(0, -2, 1f))
        val send = text("Send", 14f, true, Color.WHITE).apply {
            gravity = Gravity.CENTER
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = rounded(accent, 22f)
            setOnClickListener { sendMessage() }
        }
        composerRow.addView(send, LinearLayout.LayoutParams(-2, -2).apply { leftMargin = dp(8) })
        root?.addView(composerRow)
    }

    private fun loadMessages(silent: Boolean = false) {
        val conv = selectedConversation ?: return
        val current = session ?: return
        val id = conv.optString("id")
        scope.launch {
            val result = runCatching {
                val url = REST + "/chat_messages?select=id,conversation_id,sender_id,sender_type,message,message_type,is_read,created_at&conversation_id=eq." +
                    enc(id) + "&order=created_at.asc&limit=500"
                requestJson("GET", url, null) as? JSONArray ?: JSONArray()
            }
            result.onSuccess { data ->
                val newest = data.optJSONObject(data.length() - 1)?.optString("id")
                if (newest != lastMessageId || !silent) {
                    messages = data
                    lastMessageId = newest
                    renderMessages()
                }
                markMessagesRead(id, current.userId)
            }.onFailure {
                if (!silent) showError("Could not load messages.")
            }
        }
    }

    private fun renderMessages() {
        val container = messageContainer ?: return
        container.removeAllViews()
        if (messages.length() == 0) {
            container.addView(text("Start the conversation", 14f, false, muted).apply {
                gravity = Gravity.CENTER
                setPadding(dp(24))
            })
            return
        }
        for (index in 0 until messages.length()) {
            val item = messages.optJSONObject(index) ?: continue
            val mine = item.optString("sender_id") == session?.userId
            val bubble = TextView(this).apply {
                text = item.optString("message")
                textSize = 14f
                setTextColor(if (mine) Color.WHITE else foreground)
                setPadding(dp(12), dp(9), dp(12), dp(9))
                background = rounded(if (mine) accent else surface, 16f)
                maxWidth = (resources.displayMetrics.widthPixels * 0.78f).toInt()
            }
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = if (mine) Gravity.END else Gravity.START
                setPadding(0, dp(3), 0, dp(3))
                addView(bubble)
            }
            container.addView(row, LinearLayout.LayoutParams(-1, -2))
        }
    }

    private fun markMessagesRead(id: String, userId: String) {
        scope.launch(Dispatchers.IO) {
            runCatching {
                requestJson(
                    "PATCH",
                    REST + "/chat_messages?conversation_id=eq." + enc(id) + "&sender_id=neq." + enc(userId) + "&is_read=eq.false",
                    JSONObject().put("is_read", true)
                )
            }
        }
    }

    private fun sendMessage() {
        val body = composer?.text?.toString()?.trim().orEmpty()
        val conv = selectedConversation ?: return
        val current = session ?: return
        if (body.isBlank() || sending) return
        sending = true
        composer?.isEnabled = false
        scope.launch {
            val result = runCatching {
                val payload = JSONObject()
                    .put("conversation_id", conv.getString("id"))
                    .put("sender_id", current.userId)
                    .put("sender_type", if (current.userRole == "employer") "employer" else "applicant")
                    .put("message", body)
                    .put("message_type", "text")
                    .put("is_read", false)
                requestJson("POST", REST + "/chat_messages", payload)
            }
            sending = false
            composer?.isEnabled = true
            result.onSuccess {
                composer?.setText("")
                loadMessages()
            }.onFailure {
                showError(it.message ?: "Message could not be sent.")
            }
        }
    }

    private fun requestJson(method: String, endpoint: String, body: JSONObject?): Any? {
        val current = session ?: throw IllegalStateException("Please sign in again.")
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("apikey", SUPABASE_ANON_KEY)
            setRequestProperty("Authorization", "Bearer ${current.accessToken}")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            if (method == "POST") setRequestProperty("Prefer", "return=minimal")
            if (method == "PATCH") setRequestProperty("Prefer", "return=minimal")
            if (body != null) {
                doOutput = true
                outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
        }
        try {
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(response).optString("message") }.getOrNull()
                throw IllegalStateException(message?.takeIf { it.isNotBlank() } ?: "Chat service error ($status).")
            }
            if (response.isBlank()) return JSONObject()
            return if (response.trimStart().startsWith("[")) JSONArray(response) else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun showMessage(message: String) {
        buildBase()
        root?.addView(text("Workly Chat", 19f, true).apply { setPadding(dp(18)) })
        root?.addView(text(message, 14f, false, muted).apply { setPadding(dp(18)) })
    }

    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val newDark = isDarkMode()
        if (newDark != dark) {
            dark = newDark
            if (selectedConversation == null) {
                showConversationList()
                renderConversations()
            } else {
                showMessageScreen()
                renderMessages()
            }
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val REST = "https://jubwzelupbntbetpajqb.supabase.co/rest/v1"
        private const val SUPABASE_ANON_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
        private val UUID_REGEX = Regex("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    }
}
