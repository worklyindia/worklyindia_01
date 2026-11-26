package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.ActivityManager
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.content.res.Configuration
import android.os.Bundle
import android.os.SystemClock
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ImageView
import android.widget.PopupMenu
import android.app.Dialog
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan
import android.text.style.BackgroundColorSpan
import android.graphics.Typeface
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.ColorDrawable
import android.text.TextWatcher
import android.text.StaticLayout
import android.text.Layout
import android.text.Editable
import java.util.Locale
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.util.concurrent.Executors

class OfflineAiChatActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private val modelManager by lazy { QwenModelManager(this) }
    private lateinit var qwenModelPicker: Spinner
    private var selectedQwenModel: QwenModelManager.Model? = null
    private var userHasChosenQwenModel = false
    private val speechPackManager by lazy { SpeechPackDownloadManager(this) }
    private val engine by lazy { OfflineAiEngine() }
    private var tinyTtsEngine: IndicTinyTtsEngine? = null
    private var activeAudioRecord: AudioRecord? = null
    @Volatile private var offlineRecording = false
    @Volatile private var cancelOfflineRecording = false
    private lateinit var recordingWaveform: View
    private var recordingUiActive = false
    private val languages = listOf(
        VoiceLanguage("Hindi · हिन्दी", "hi-IN", Locale.forLanguageTag("hi-IN")),
        VoiceLanguage("English · India", "en-IN", Locale.forLanguageTag("en-IN")),
        VoiceLanguage("Gujarati · ગુજરાતી", "gu-IN", Locale.forLanguageTag("gu-IN"))
    )
    private lateinit var chatMessages: LinearLayout
    private var thinkingBubble: TextView? = null
    private lateinit var promptInput: EditText
    private lateinit var sendButton: Button
    private lateinit var micButton: Button
    private lateinit var composerShell: LinearLayout
    private lateinit var composer: LinearLayout
    private lateinit var composerRow: LinearLayout
    private lateinit var moreButton: ImageView
    private lateinit var thinkHarderChip: TextView
    private var composerExpanded = false
    private var thinkHarderEnabled = false
    private lateinit var status: TextView
    private lateinit var chatScroll: ScrollView
    private val conversationHistory = StringBuilder()
    private var greetingPane: View? = null
    private var currentConversationId: String = java.util.UUID.randomUUID().toString()
    private var dark = false
    @Volatile private var modelLoadInProgress = false
    private var ignoreInitialModelSelection = true
    @Volatile private var loadedModelId: String? = null

    private data class VoiceLanguage(val label: String, val tag: String, val locale: Locale) {
        override fun toString() = label
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dark = isSystemDarkMode()
        // Match Workly India: persistent system bars stay outside scrollable content.
        ChatWorkTheme.applyWindow(this)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        buildUi()
        restoreLastConversation()
        loadModel()
    }

    private val bg get() = if (dark) 0xFF0B1222.toInt() else 0xFFFFFFFF.toInt()
    private val surface get() = if (dark) 0xFF1B293B.toInt() else 0xFFFFFFFF.toInt()
    private val primaryText get() = if (dark) 0xFFE8EEF7.toInt() else 0xFF142033.toInt()
    private val secondaryText get() = if (dark) 0xFFB5C1D1.toInt() else 0xFF65748B.toInt()
    private val accent get() = 0xFF1769C2.toInt()

    private fun buildUi() {
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bg)
            clipToPadding = false
        }

        // Keep model selection available to the existing settings flow, but out of
        // the conversation canvas so the chat matches a clean messenger layout.
        qwenModelPicker = Spinner(this).apply {
            adapter = readableSpinnerAdapter(modelManager.models)
            isEnabled = false
            visibility = View.GONE
            onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
                override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                    if (ignoreInitialModelSelection) {
                        ignoreInitialModelSelection = false
                        return
                    }
                    val selected = modelManager.models[position]
                    qwenModelPicker.visibility = View.GONE
                    selectedQwenModel = selected
                    val selectedReady = modelManager.snapshot(selected).state == QwenModelManager.State.READY
                    if (selectedReady && !modelLoadInProgress && selected.id != loadedModelId) {
                        getSharedPreferences("workly_qwen_models", MODE_PRIVATE).edit()
                            .putString("selected_model_id", selected.id).apply()
                        loadModel()
                    } else {
                        sendButton.isEnabled = engine.isLoaded && selectedReady && selected.id == loadedModelId
                        sendButton.alpha = if (sendButton.isEnabled) 1f else 0.55f
                    }
                }
            }
        }

        root.addView(qwenModelPicker, LinearLayout.LayoutParams(-1, dp(42)))

        status = TextView(this).apply {
            text = "Offline AI"
            textSize = 12f
            setTextColor(secondaryText)
            visibility = View.GONE
        }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), 0, dp(4), 0)
            background = android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT)
        }
        fun headerIcon(drawable: Int, description: String, action: () -> Unit) = ImageView(this).apply {
            setImageResource(drawable)
            setColorFilter(primaryText)
            contentDescription = description
            scaleType = ImageView.ScaleType.CENTER
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setOnClickListener { action() }
        }
        header.addView(headerIcon(R.drawable.ic_chatwork_back, "Back") { finish() },
            LinearLayout.LayoutParams(dp(48), dp(56)))
        val titleBlock = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
        }
        titleBlock.addView(TextView(this).apply {
            text = "ChatWork"
            textSize = 20f
            setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
            setTextColor(primaryText)
        })
        titleBlock.addView(TextView(this).apply {
            text = "AI Assistant"
            textSize = 12f
            setTextColor(secondaryText)
        })
        header.addView(titleBlock, LinearLayout.LayoutParams(0, dp(56), 1f).apply {
            marginStart = dp(4)
        })
        header.addView(headerIcon(R.drawable.ic_chatwork_more, "More options") {
            showChatOptions(header)
        }, LinearLayout.LayoutParams(dp(48), dp(56)))
        root.addView(header, LinearLayout.LayoutParams(-1, dp(56)))
        status.setPadding(dp(16), dp(4), dp(16), dp(4))
        root.addView(status, LinearLayout.LayoutParams(-1, -2))

        chatScroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
            setPadding(dp(10), dp(8), dp(10), dp(12))
            chatMessages = LinearLayout(this@OfflineAiChatActivity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(1), dp(4), dp(1), dp(8))
            }
            addView(chatMessages, ViewGroup.LayoutParams(-1, -2))
        }
        root.addView(chatScroll, LinearLayout.LayoutParams(-1, 0, 1f))
        showGreetingPane()

        // Website chat has no separate welcome/date card.

        composerShell = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(8), dp(6), dp(8), dp(6))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(surface)
                setStroke(dp(1), if (dark) 0xFF3A4658.toInt() else 0xFFD1D5DB.toInt())
                cornerRadius = dp(28).toFloat()
            }
        }
        thinkHarderChip = TextView(this).apply {
            text = "✦  Think harder     ×"
            textSize = 12f
            setTextColor(accent)
            setPadding(dp(10), dp(5), dp(10), dp(5))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(if (dark) 0x332D8CFF else 0x1A1769C2)
                cornerRadius = dp(18).toFloat()
            }
            visibility = View.GONE
            contentDescription = "Think harder enabled. Tap to turn off."
            setOnClickListener {
                thinkHarderEnabled = false
                visibility = View.GONE
            }
        }
        composer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
        }
        composerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        moreButton = ImageView(this).apply {
            setImageResource(R.drawable.ic_chatwork_add)
            setColorFilter(primaryText)
            contentDescription = "More options and attachments"
            setPadding(dp(7), dp(7), dp(7), dp(7))
            setOnClickListener { if (offlineRecording) cancelOfflineVoiceInput() else showAttachmentSheet() }
        }
        promptInput = EditText(this).apply {
            hint = "Message..."
            textSize = 15f
            typeface = android.graphics.Typeface.DEFAULT
            minLines = 1
            maxLines = 6
            setTextColor(primaryText)
            setHintTextColor(secondaryText)
            setPadding(dp(2), dp(7), dp(2), dp(7))
            background = null
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_NONE or
                android.view.inputmethod.EditorInfo.IME_FLAG_NO_EXTRACT_UI
            isVerticalScrollBarEnabled = true
        }
        micButton = Button(this).apply {
            text = ""
            contentDescription = "Voice input"
            background = android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT)
            setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_chatwork_mic, 0, 0, 0)
            compoundDrawableTintList = android.content.res.ColorStateList.valueOf(primaryText)
            setOnClickListener { if (offlineRecording) stopOfflineVoiceInput() else startDownloadedVoiceInput() }
        }
        recordingWaveform = VoiceWaveformView()
        sendButton = Button(this).apply {
            text = ""
            gravity = Gravity.CENTER
            setTextColor(0xFFFFFFFF.toInt())
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(0xFF0A84FF.toInt())
                shape = android.graphics.drawable.GradientDrawable.OVAL
            }
            setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_chatwork_send, 0, 0, 0)
            compoundDrawableTintList = android.content.res.ColorStateList.valueOf(0xFFFFFFFF.toInt())
            isEnabled = false
            alpha = 0.55f
            contentDescription = "Send message"
            setOnClickListener { if (offlineRecording) stopOfflineVoiceInput() else if (promptInput.text.isNullOrBlank()) startDownloadedVoiceInput() else sendPrompt() }
        }
        promptInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                updateComposerLayout(s?.toString().orEmpty())
                val hasText = !s.isNullOrBlank()
                if (!offlineRecording) updateComposerAction(hasText)
                updateComposerAction(hasText)
            }
            override fun afterTextChanged(s: Editable?) {}
        })
        updateComposerLayout("")
        updateComposerAction(false)
        composerShell.addView(thinkHarderChip, LinearLayout.LayoutParams(-2, -2).apply {
            bottomMargin = dp(5)
        })
        composerShell.addView(composer, LinearLayout.LayoutParams(-1, -2))
        root.addView(composerShell, LinearLayout.LayoutParams(-1, -2).apply {
            leftMargin = dp(12); rightMargin = dp(12); topMargin = dp(5); bottomMargin = dp(6)
        })
        setContentView(root)
        // Edge-to-edge windows must explicitly move the composer above the IME.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            if (ime.bottom > 0) chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
            insets
        }
        ViewCompat.requestApplyInsets(root)
        promptInput.setOnFocusChangeListener { _, focused ->
            if (focused) composerShell.postDelayed({ chatScroll.fullScroll(View.FOCUS_DOWN) }, 180)
        }
    }

    private fun updateComposerAction(hasText: Boolean) {
        val recording = offlineRecording
        if (recording) {
            sendButton.setCompoundDrawablesWithIntrinsicBounds(0, 0, 0, 0)
            sendButton.background = android.graphics.drawable.GradientDrawable().apply {
                setColor(0xFFEF4444.toInt()); shape = android.graphics.drawable.GradientDrawable.OVAL
            }
            sendButton.contentDescription = "Stop recording"
            sendButton.isEnabled = true; sendButton.alpha = 1f
        } else {
            sendButton.setCompoundDrawablesWithIntrinsicBounds(
                if (hasText) R.drawable.ic_chatwork_send else R.drawable.ic_chatwork_waveform, 0, 0, 0
            )
            sendButton.background = android.graphics.drawable.GradientDrawable().apply {
                setColor(0xFF0A84FF.toInt()); shape = android.graphics.drawable.GradientDrawable.OVAL
            }
            sendButton.contentDescription = if (hasText) "Send message" else "Start voice input"
            sendButton.isEnabled = if (hasText) engine.isLoaded else true
            sendButton.alpha = if (sendButton.isEnabled) 1f else 0.55f
        }
    }

    private fun showAttachmentSheet() {
        val dialog = Dialog(this)
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(26))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(surface); cornerRadii = floatArrayOf(dp(24).toFloat(),dp(24).toFloat(),dp(24).toFloat(),dp(24).toFloat(),0f,0f,0f,0f)
            }
        }
        val handle = View(this).apply { setBackgroundColor(secondaryText); alpha = .45f }
        panel.addView(handle, LinearLayout.LayoutParams(dp(52), dp(5)).apply { gravity = Gravity.CENTER; bottomMargin = dp(16) })
        panel.addView(TextView(this).apply { text = "Attach"; textSize = 18f; setTypeface(null, Typeface.BOLD); setTextColor(primaryText) }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(14) })
        val tiles = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER; }
        fun tile(emoji: String, label: String, action: () -> Unit) {
            val item = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(8), dp(12), dp(8), dp(8)); isClickable = true; isFocusable = true }
            val icon = TextView(this).apply { text = emoji; textSize = 27f; gravity = Gravity.CENTER; setTextColor(primaryText); background = android.graphics.drawable.GradientDrawable().apply { setColor(if (dark) 0xFF30435E.toInt() else 0xFFEAF1FA.toInt()); cornerRadius = dp(20).toFloat() } }
            item.addView(icon, LinearLayout.LayoutParams(dp(64), dp(64)))
            item.addView(TextView(this).apply { text = label; textSize = 13f; setTextColor(primaryText); gravity = Gravity.CENTER }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
            item.setOnClickListener { dialog.dismiss(); action() }
            tiles.addView(item, LinearLayout.LayoutParams(0, -2, 1f))
        }
        tile("📷", "Camera") { runCatching { startActivity(Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE)) }.onFailure { status.text = "Camera is not available on this device." } }
        tile("🖼️", "Photos") { openAttachmentPicker("image/*") }
        tile("📄", "Files") { openAttachmentPicker("*/*") }
        panel.addView(tiles)
        dialog.setContentView(panel)
        dialog.window?.apply {
            setBackgroundDrawableResource(android.R.color.transparent)
            setLayout(-1, -2); setGravity(Gravity.BOTTOM)
            addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            attributes = attributes.apply { dimAmount = .42f }
        }
        dialog.show()
        dialog.window?.setLayout(-1, -2)
    }

    private fun openAttachmentPicker(type: String) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); this.type = type; putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true) }
        runCatching { startActivityForResult(intent, REQUEST_ATTACHMENT) }.onFailure { status.text = "Could not open attachments." }
    }

    private fun cancelOfflineVoiceInput() {
        cancelOfflineRecording = true
        offlineRecording = false
        runCatching { activeAudioRecord?.let { if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) it.stop() } }
        setRecordingUi(false)
        status.text = "Recording cancelled."
    }

    private fun setRecordingUi(active: Boolean) {
        recordingUiActive = active
        if (!::composer.isInitialized) return
        (promptInput.parent as? ViewGroup)?.removeView(promptInput)
        (recordingWaveform.parent as? ViewGroup)?.removeView(recordingWaveform)
        if (active) {
            composer.removeAllViews(); composerRow.removeAllViews()
            moreButton.setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            moreButton.contentDescription = "Cancel recording"
            composerRow.addView(moreButton, LinearLayout.LayoutParams(dp(36), dp(36)))
            composerRow.addView(recordingWaveform, LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginStart = dp(8) })
            composerRow.addView(micButton, LinearLayout.LayoutParams(dp(36), dp(36)))
            composerRow.addView(sendButton, LinearLayout.LayoutParams(dp(36), dp(36)).apply { marginStart = dp(4) })
            composer.addView(composerRow)
            micButton.setImageResource(android.R.drawable.ic_media_pause)
            micButton.contentDescription = "Stop recording"
            sendButton.setOnClickListener { stopOfflineVoiceInput() }
            updateComposerAction(false)
        } else {
            moreButton.setImageResource(R.drawable.ic_chatwork_add)
            moreButton.contentDescription = "More options and attachments"
            micButton.setImageResource(R.drawable.ic_chatwork_mic)
            micButton.contentDescription = "Voice input"
            sendButton.setOnClickListener { if (promptInput.text.isNullOrBlank()) startDownloadedVoiceInput() else sendPrompt() }
            updateComposerLayout(promptInput.text?.toString().orEmpty())
            updateComposerAction(!promptInput.text.isNullOrBlank())
        }
    }

    /** Mirrors the website AI chat composer: inline for short text, stacked once it wraps. */
    private fun updateComposerLayout(value: String) {
        val screenWidth = resources.displayMetrics.widthPixels
        val inlineControls = dp(36 * 3 + 8 + 8 + 4)
        val availableInlineWidth = (screenWidth - dp(24 + 16) - inlineControls).coerceAtLeast(dp(48))
        val shouldExpand = if (value.isBlank()) {
            false
        } else {
            val measured = StaticLayout.Builder.obtain(
                value, 0, value.length, promptInput.paint, availableInlineWidth
            ).setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(false).build()
            measured.lineCount > 1
        }
        if (shouldExpand == composerExpanded && composer.childCount > 0) return
        composerExpanded = shouldExpand

        (promptInput.parent as? ViewGroup)?.removeView(promptInput)
        (moreButton.parent as? ViewGroup)?.removeView(moreButton)
        (micButton.parent as? ViewGroup)?.removeView(micButton)
        (sendButton.parent as? ViewGroup)?.removeView(sendButton)
        composer.removeAllViews()
        composerRow.removeAllViews()

        val controlSize = dp(36)
        composerRow.addView(moreButton, LinearLayout.LayoutParams(controlSize, controlSize))
        if (composerExpanded) {
            composerRow.addView(View(this), LinearLayout.LayoutParams(0, dp(1), 1f))
            composerRow.addView(micButton, LinearLayout.LayoutParams(controlSize, controlSize))
            composerRow.addView(sendButton, LinearLayout.LayoutParams(controlSize, controlSize).apply { marginStart = dp(4) })
            composer.addView(promptInput, LinearLayout.LayoutParams(-1, -2).apply {
                bottomMargin = dp(3)
            })
            composer.addView(composerRow, LinearLayout.LayoutParams(-1, -2))
        } else {
            composerRow.addView(promptInput, LinearLayout.LayoutParams(0, -2, 1f).apply {
                marginStart = dp(2)
            })
            composerRow.addView(micButton, LinearLayout.LayoutParams(controlSize, controlSize))
            composerRow.addView(sendButton, LinearLayout.LayoutParams(controlSize, controlSize).apply {
                marginStart = dp(4)
            })
            composer.addView(composerRow, LinearLayout.LayoutParams(-1, -2))
        }
        promptInput.maxLines = 6
        promptInput.requestLayout()
    }

    private fun startNewConversation() {
        conversationHistory.clear()
        currentConversationId = java.util.UUID.randomUUID().toString()
        chatMessages.removeAllViews()
        thinkingBubble = null
        greetingPane = null
        showGreetingPane()
        promptInput.setText("")
        status.text = "New chat"
    }

    private fun saveCurrentConversation() {
        val history = conversationHistory.toString()
        if (history.isBlank()) return
        val prefs = getSharedPreferences("chatwork_conversations_v1", MODE_PRIVATE)
        val sessions = runCatching { org.json.JSONArray(prefs.getString("sessions", "[]")) }
            .getOrElse { org.json.JSONArray() }
        val title = Regex("(?m)^User: (.+)$").find(history)?.groupValues?.get(1)
            ?.take(48) ?: "ChatWork conversation"
        val item = org.json.JSONObject()
            .put("id", currentConversationId)
            .put("title", title)
            .put("history", history)
            .put("updatedAt", System.currentTimeMillis())
        var replaced = false
        for (i in 0 until sessions.length()) {
            if (sessions.optJSONObject(i)?.optString("id") == currentConversationId) {
                sessions.put(i, item)
                replaced = true
                break
            }
        }
        if (!replaced) sessions.put(item)
        val bounded = org.json.JSONArray()
        val start = (sessions.length() - 40).coerceAtLeast(0)
        for (i in start until sessions.length()) bounded.put(sessions.getJSONObject(i))
        prefs.edit().putString("sessions", bounded.toString())
            .putString("last_session_id", currentConversationId).apply()
    }

    private fun restoreLastConversation() {
        val prefs = getSharedPreferences("chatwork_conversations_v1", MODE_PRIVATE)
        val id = prefs.getString("last_session_id", null) ?: return
        val sessions = runCatching { org.json.JSONArray(prefs.getString("sessions", "[]")) }
            .getOrElse { return }
        val item = (0 until sessions.length()).mapNotNull { sessions.optJSONObject(it) }
            .firstOrNull { it.optString("id") == id } ?: return
        currentConversationId = id
        conversationHistory.clear()
        conversationHistory.append(item.optString("history"))
        renderSavedConversation(conversationHistory.toString())
    }

    private fun renderSavedConversation(history: String) {
        chatMessages.removeAllViews()
        greetingPane = null
        val markers = Regex("(?m)^(User|Assistant): ")
        val matches = markers.findAll(history).toList()
        matches.forEachIndexed { index, match ->
            val start = match.range.last + 1
            val end = matches.getOrNull(index + 1)?.range?.first ?: history.length
            val content = history.substring(start, end).trimEnd()
            if (content.isNotBlank()) addMessage(content, match.groupValues[1] == "User")
        }
        if (matches.isEmpty()) showGreetingPane()
    }

    private fun showConversationHistory(anchor: View) {
        val prefs = getSharedPreferences("chatwork_conversations_v1", MODE_PRIVATE)
        val sessions = runCatching { org.json.JSONArray(prefs.getString("sessions", "[]")) }
            .getOrElse { org.json.JSONArray() }
        val items = (0 until sessions.length()).mapNotNull { sessions.optJSONObject(it) }
            .sortedByDescending { it.optLong("updatedAt") }
        if (items.isEmpty()) {
            android.widget.Toast.makeText(this, "No saved conversations yet", android.widget.Toast.LENGTH_SHORT).show()
            return
        }
        val labels = items.map { item ->
            val date = java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT, java.text.DateFormat.SHORT)
                .format(java.util.Date(item.optLong("updatedAt")))
            "${item.optString("title", "Conversation")}  ·  $date"
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Recent chats")
            .setItems(labels) { _, which ->
                saveCurrentConversation()
                val selected = items[which]
                currentConversationId = selected.optString("id")
                conversationHistory.clear()
                conversationHistory.append(selected.optString("history"))
                renderSavedConversation(conversationHistory.toString())
                prefs.edit().putString("last_session_id", currentConversationId).apply()
                status.text = "Conversation opened"
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun showGreetingPane() {
        if (chatMessages.childCount > 0) return
        val pane = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(18), dp(42), dp(18), dp(28))
        }
        pane.addView(TextView(this).apply {
            text = "✦"; textSize = 38f; gravity = Gravity.CENTER
            setTextColor(accent); setPadding(0, 0, 0, dp(14))
        }, LinearLayout.LayoutParams(-1, -2))
        pane.addView(TextView(this).apply {
            text = "What can I help with?"; textSize = 25f; gravity = Gravity.CENTER
            setTypeface(Typeface.DEFAULT, Typeface.BOLD); setTextColor(primaryText)
        }, LinearLayout.LayoutParams(-1, -2))
        pane.addView(TextView(this).apply {
            text = "Ask anything. ChatWork AI runs locally on this phone."
            textSize = 14f; gravity = Gravity.CENTER; setTextColor(secondaryText)
            setPadding(dp(12), dp(10), dp(12), dp(24))
        }, LinearLayout.LayoutParams(-1, -2))
        val suggestions = listOf(
            "Explain a topic" to "Explain quantum computing in simple words",
            "Write something" to "Help me write a professional message",
            "Translate text" to "Translate this text into Hindi",
            "Get ideas" to "Give me creative ideas for a new project"
        )
        suggestions.forEach { (label, prompt) ->
            val chip = TextView(this).apply {
                text = "✧   $label"; textSize = 15f; setTextColor(primaryText)
                setPadding(dp(16), dp(13), dp(16), dp(13))
                background = android.graphics.drawable.GradientDrawable().apply {
                    setColor(surface)
                    setStroke(dp(1), if (dark) 0xFF334155.toInt() else 0xFFE2E8F0.toInt())
                    cornerRadius = dp(18).toFloat()
                }
                setOnClickListener {
                    promptInput.setText(prompt)
                    promptInput.setSelection(promptInput.text.length)
                    promptInput.requestFocus()
                }
            }
            pane.addView(chip, LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = dp(7); bottomMargin = dp(2)
            })
        }
        chatMessages.addView(pane, LinearLayout.LayoutParams(-1, -2))
        greetingPane = pane
    }

    private fun showChatOptions(anchor: View) {
        PopupMenu(this, anchor).apply {
            menu.add(if (thinkHarderEnabled) "Disable Think harder" else "Think harder").setOnMenuItemClickListener {
                thinkHarderEnabled = !thinkHarderEnabled
                thinkHarderChip.visibility = if (thinkHarderEnabled) View.VISIBLE else View.GONE
                true
            }
            menu.add("Choose AI model").setOnMenuItemClickListener {
                qwenModelPicker.visibility = View.VISIBLE
                qwenModelPicker.post { qwenModelPicker.performClick() }
                true
            }
            menu.add("Download / test models").setOnMenuItemClickListener {
                startActivity(Intent(this@OfflineAiChatActivity, SpeechDownloadsActivity::class.java)); true
            }
            menu.add("Create / Edit Image").setOnMenuItemClickListener {
                startActivity(Intent(this@OfflineAiChatActivity, ChatWorkImageActivity::class.java)); true
            }
            menu.add("Assistant Tools · Memory / Files / Reminders / Apps").setOnMenuItemClickListener {
                startActivity(Intent(this@OfflineAiChatActivity, AssistantToolsActivity::class.java)); true
            }
            menu.add("Settings").setOnMenuItemClickListener {
                startActivity(Intent(this@OfflineAiChatActivity, SettingsActivity::class.java)); true
            }
            menu.add("New chat").setOnMenuItemClickListener {
                saveCurrentConversation()
                startNewConversation()
                true
            }
            menu.add("Chat history").setOnMenuItemClickListener {
                showConversationHistory(anchor)
                true
            }
            menu.add("Export conversation").setOnMenuItemClickListener {
                exportConversation(); true
            }
            menu.add("Clear conversation").setOnMenuItemClickListener {
                confirmClearConversation(); true
            }
            val wakeEnabled = WakeWordAssistantService.isRunning
            qwenModelPicker.isEnabled = !wakeEnabled
            if (wakeEnabled) {
                menu.add("Disable Hey ChatWork").setOnMenuItemClickListener {
                    stopService(Intent(this@OfflineAiChatActivity, WakeWordAssistantService::class.java))
                    status.text = "Stopping Hey ChatWork microphone service…"
                    waitForWakeServiceStop()
                    true
                }
            } else {
                menu.add("Enable Hey ChatWork").setOnMenuItemClickListener {
                    chooseWakeWordLanguage()
                    true
                }
            }
            show()
        }
    }


    private fun exportConversation() {
        if (conversationHistory.isBlank()) {
            status.text = "There is no completed conversation to export yet."
            return
        }
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "text/plain"
            putExtra(Intent.EXTRA_TITLE, "ChatWork-conversation-${System.currentTimeMillis()}.txt")
        }
        startActivityForResult(intent, REQUEST_EXPORT_CONVERSATION)
    }

    private fun confirmClearConversation() {
        if (!sendButton.isEnabled) {
            status.text = "Wait for the current AI reply before clearing the conversation."
            return
        }
        AlertDialog.Builder(this)
            .setTitle("Clear conversation?")
            .setMessage("This clears the messages shown in this chat and its temporary conversation context. Saved memories and imported files are not deleted.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Clear") { _, _ ->
                conversationHistory.clear()
                chatMessages.removeAllViews()
                thinkingBubble = null
                currentConversationId = java.util.UUID.randomUUID().toString()
                showGreetingPane()
                status.text = "Conversation cleared. Local saved memories are unchanged."
            }
            .show()
    }

    @Deprecated("Legacy result callback for document export compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_EXPORT_CONVERSATION || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        val exportText = "ChatWork offline conversation\nExported: ${java.text.DateFormat.getDateTimeInstance().format(java.util.Date())}\n\n" +
            conversationHistory.toString()
        try {
            contentResolver.openOutputStream(uri, "w")?.use { output ->
                output.write(exportText.toByteArray(Charsets.UTF_8))
                output.flush()
            } ?: throw IllegalStateException("Could not open the selected destination.")
            status.text = "Conversation exported to the location you selected."
        } catch (failure: Exception) {
            status.text = "Conversation export failed: ${failure.message ?: failure.javaClass.simpleName}"
        }
    }

    private fun chooseWakeWordLanguage() {
        val labels = arrayOf("Hindi · हिन्दी", "Gujarati · ગુજરાતી", "English · India")
        val codes = arrayOf("hi", "gu", "en")
        val prefs = getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE)
        val saved = prefs.getString(WakeWordAssistantService.KEY_LANGUAGE, "hi") ?: "hi"
        var selected = codes.indexOf(saved).coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle("Enable Hey ChatWork")
            .setMessage("When enabled, ChatWork continuously listens for the English wake phrase using a visible microphone notification. Wake detection, speech recognition, AI replies and voice output run on this phone. You can stop listening at any time from the notification.")
            .setSingleChoiceItems(labels, selected) { _, which -> selected = which }
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Continue") { _, _ ->
                prefs.edit().putString(WakeWordAssistantService.KEY_LANGUAGE, codes[selected]).apply()
                checkWakeModelsAndPermissions(codes[selected])
            }
            .show()
    }

    private fun checkWakeModelsAndPermissions(language: String) {
        val speechManager = SpeechPackDownloadManager(this)
        val missing = mutableListOf<String>()
        val wakePack = SpeechModelCatalog.chatWorkWakeWord()
        if (!WakeWordEngineFactory.isReady(this)) missing.add("ChatWork Wake Word · English")
        else if (!speechManager.isModelTested(wakePack)) missing.add("Test Model · ChatWork Wake Word")
        if (!OfflineSpeechEngineFactory.isReady(this, SpeechModelCatalog.indicConformer(language))) {
            missing.add("IndicConformer ${language.uppercase(Locale.ROOT)} · Voice to Text")
        }
        if (speechManager.snapshot(SpeechModelCatalog.indicTinyTts(language)).state != SpeechPackDownloadManager.State.COMPLETE) {
            missing.add("Indic Tiny TTS ${language.uppercase(Locale.ROOT)} · Text to Voice")
        }
        val qwenManager = QwenModelManager(this)
        if (qwenManager.models.none { qwenManager.snapshot(it).state == QwenModelManager.State.READY }) {
            missing.add("A Qwen AI model with Test Model passed")
        }
        if (missing.isNotEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("Download required models")
                .setMessage("Before enabling Hey ChatWork, download and test:\n\n" + missing.joinToString("\n"))
                .setNegativeButton("Not now", null)
                .setPositiveButton("Open Download Models") { _, _ ->
                    startActivity(Intent(this, SpeechDownloadsActivity::class.java))
                }
                .show()
            return
        }
        val permissions = mutableListOf<String>()
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (permissions.isNotEmpty()) {
            requestPermissions(permissions.toTypedArray(), REQUEST_WAKE_ASSISTANT)
        } else {
            startWakeWordService()
        }
    }

    private fun waitForWakeServiceStop(attempt: Int = 0) {
        status.postDelayed({
            val prefs = getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE)
            val requested = prefs.getBoolean(WakeWordAssistantService.KEY_ACTIVE, false)
            val active = WakeWordAssistantService.isRunning
            if (active) {
                if (attempt < 20) waitForWakeServiceStop(attempt + 1)
            } else if (requested && attempt < 4) {
                // Allow up to two seconds for Android to create the foreground service.
                waitForWakeServiceStop(attempt + 1)
            } else {
                prefs.edit().putBoolean(WakeWordAssistantService.KEY_ACTIVE, false).apply()
                qwenModelPicker.isEnabled = true
                if (!engine.isLoaded && !modelLoadInProgress) loadModel()
            }
        }, 500L)
    }
    private fun startWakeWordService() {
        try {
            getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE).edit()
                .putBoolean(WakeWordAssistantService.KEY_ACTIVE, true).apply()
            val intent = Intent(this, WakeWordAssistantService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
            qwenModelPicker.isEnabled = false
            status.text = "Starting Hey ChatWork foreground microphone service…"
            waitForWakeServiceStop()
        } catch (error: Exception) {
            getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE).edit()
                .putBoolean(WakeWordAssistantService.KEY_ACTIVE, false).apply()
            qwenModelPicker.isEnabled = true
            status.text = "Could not start Hey ChatWork: ${error.message ?: "permission or Android restriction"}"
        }
    }
    private fun <T> readableSpinnerAdapter(items: List<T>): ArrayAdapter<T> =
        object : ArrayAdapter<T>(this, android.R.layout.simple_spinner_item, items) {
            private fun row(value: T) = TextView(this@OfflineAiChatActivity).apply {
                text = value.toString()
                textSize = 14f
                setTextColor(primaryText)
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(10), dp(8), dp(10), dp(8))
                setBackgroundColor(surface)
            }
            override fun getView(position: Int, convertView: View?, parent: android.view.ViewGroup): View =
                row(getItem(position)!!)
            override fun getDropDownView(position: Int, convertView: View?, parent: android.view.ViewGroup): View =
                row(getItem(position)!!)
        }

    private fun loadModel() {
        if (modelLoadInProgress) return
        modelLoadInProgress = true
        sendButton.isEnabled = false
        sendButton.alpha = 0.55f
        qwenModelPicker.isEnabled = false
        status.text = "Checking Qwen model and phone memory…"
        status.visibility = View.VISIBLE
        worker.execute {
            try {
                val memoryInfo = ActivityManager.MemoryInfo()
                (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memoryInfo)
                val recommended = modelManager.recommendedModel(memoryInfo.availMem)
                val savedId = getSharedPreferences("workly_qwen_models", MODE_PRIVATE).getString("selected_model_id", null)
                val savedModel = modelManager.models.firstOrNull { it.id == savedId }
                val modelDirectory = modelManager.file(modelManager.models.first()).parentFile ?: filesDir
                val budget = AssistantModelPolicy.readBudget(this, modelDirectory)
                val downloadedCandidates = modelManager.models.map { model ->
                    AssistantModelPolicy.Candidate(
                        id = model.id,
                        displayName = model.title,
                        expectedBytes = model.size,
                        minimumAvailableRamBytes = model.minFreeRam,
                        minimumFreeStorageBytes = 256L * 1024L * 1024L,
                        enabled = modelManager.snapshot(model).state == QwenModelManager.State.READY
                    )
                }
                val recommendation = AssistantModelPolicy.recommend(
                    candidates = downloadedCandidates,
                    budget = budget,
                    reserveRamBytes = 512L * 1024L * 1024L,
                    reserveStorageBytes = 256L * 1024L * 1024L
                )
                // Keep a saved model only if it still fits the live RAM budget.
                // Otherwise choose the largest downloaded model that fits with safety reserves.
                val savedReady = savedModel?.takeIf {
                    recommendation.candidate?.id == it.id &&
                        modelManager.snapshot(it).state == QwenModelManager.State.READY
                }
                val adaptiveChoice = recommendation.candidate?.let { candidate ->
                    modelManager.models.firstOrNull { it.id == candidate.id }
                }
                val chosen = savedReady ?: adaptiveChoice ?: recommended
                getSharedPreferences("workly_qwen_models", MODE_PRIVATE).edit().putString("selected_model_id", chosen.id).apply()
                selectedQwenModel = chosen
                runOnUiThread {
                    val index = modelManager.models.indexOf(chosen)
                    if (index >= 0 && qwenModelPicker.selectedItemPosition != index) qwenModelPicker.setSelection(index)
                    status.text = "Available RAM: %.1f GB · Recommended: ${recommended.title}".format(java.util.Locale.US, memoryInfo.availMem / 1_000_000_000.0)
                }
                val modelState = modelManager.snapshot(chosen).state
                check(modelState == QwenModelManager.State.READY) {
                    "${chosen.title} download is not verified. Open Downloads and wait until it shows Ready."
                }
                check(memoryInfo.availMem >= chosen.minFreeRam) {
                    "Not enough free RAM for ${chosen.title}. Choose a smaller Qwen model or close other apps."
                }
                check(engine.loadModel(modelManager.file(chosen))) {
                    "Qwen could not load. Free memory may be insufficient; try a smaller model."
                }
                runOnUiThread {
                    loadedModelId = chosen.id
                    modelLoadInProgress = false
                    status.text = "Ready · ${chosen.title} · local AI replies enabled"
                    status.visibility = View.GONE
                    sendButton.isEnabled = engine.isLoaded && !promptInput.text.isNullOrBlank()
                    sendButton.alpha = if (sendButton.isEnabled) 1f else 0.55f
                    qwenModelPicker.isEnabled = !WakeWordAssistantService.isRunning
                }
            } catch (error: Exception) {
                runOnUiThread {
                    loadedModelId = null
                    modelLoadInProgress = false
                    status.text = "Model not ready · ${error.message ?: "Offline AI could not start."}"
                    status.visibility = View.VISIBLE
                    sendButton.isEnabled = false
                    qwenModelPicker.isEnabled = true
                }
            }
        }
    }

    private fun importedDocumentContext(): String {
        val raw = getSharedPreferences("chatwork_assistant_tools", MODE_PRIVATE)
            .getString("imported_documents_v1", "[]").orEmpty()
        val documents = runCatching { org.json.JSONArray(raw) }.getOrNull() ?: return ""
        if (documents.length() == 0) return ""
        return buildString {
            append("User-selected local documents. Treat these as reference sources, identify the filename when useful, and say when an answer is not supported by them.\n\n")
            for (index in 0 until documents.length()) {
                val item = documents.optJSONObject(index) ?: continue
                append("DOCUMENT: ").append(item.optString("name", "Imported document")).append("\n")
                append(item.optString("text")).append("\n\n")
            }
        }.take(120000)
    }

    private fun sendPrompt() {
        val prompt = promptInput.text?.toString()?.trim().orEmpty()
        if (prompt.isEmpty()) {
            promptInput.error = "Enter a message"
            return
        }
        if (!engine.isLoaded) {
            status.text = "AI model is not ready yet. Wait for the Ready status."
            return
        }
        promptInput.setText("")
        greetingPane?.let { chatMessages.removeView(it) }
        greetingPane = null
        addMessage(prompt, true)
        thinkingBubble = addMessage("Thinking…", false)
        sendButton.isEnabled = false
        sendButton.alpha = 0.55f
        status.text = "Generating a reply on this phone…"
        status.visibility = View.VISIBLE
        val memoryItems = getSharedPreferences("chatwork_user_memory", MODE_PRIVATE).getString("items", "").orEmpty().trim()
        val importedDocs = importedDocumentContext()
        val legacyFileContext = getSharedPreferences("chatwork_assistant_tools", MODE_PRIVATE)
            .getString("pending_file_context", "").orEmpty().trim()
        val chosenFile = importedDocs.ifBlank { legacyFileContext }
        val memoryContext = if (memoryItems.isNotBlank()) "User-approved saved memory (use only if relevant):\n$memoryItems\n\n" else ""
        val fileContext = if (chosenFile.isNotBlank()) "User-selected file content:\n$chosenFile\n\n" else ""
        val thinkingInstruction = if (thinkHarderEnabled) {
            "Think carefully through the problem before answering. Check important details and provide a clear, well-structured answer with a concise summary of the reasoning. Do not expose private internal reasoning.\n\n"
        } else ""
        val contextPrompt = thinkingInstruction + memoryContext + fileContext + (if (conversationHistory.isEmpty()) prompt else
            "Previous conversation:\n$conversationHistory\nCurrent message:\n$prompt")
        val usedModelId = loadedModelId ?: selectedQwenModel?.id
        val usedModel = modelManager.models.firstOrNull { it.id == usedModelId }
        worker.execute {
            val startedAt = SystemClock.elapsedRealtime()
            val answer = try {
                engine.generate(contextPrompt) { partial ->
                    runOnUiThread {
                        thinkingBubble?.text = partial
                        chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
                    }
                }.trim().ifBlank {
                    "AI ne empty response diya. Please shorter message bhejkar dobara try karein."
                }
            } catch (error: Throwable) {
                "AI reply failed: ${error.message ?: error.javaClass.simpleName}. Model ko Settings se reload karke try karein."
            }
            val durationMs = (SystemClock.elapsedRealtime() - startedAt).coerceAtLeast(0L)
            val elapsedSeconds = ((durationMs + 999L) / 1000L).coerceAtLeast(1L)
            if (!answer.startsWith("AI reply failed:")) {
                usedModel?.let { model ->
                    ModelUsageTracker.record(
                        this,
                        "qwen-${model.id}",
                        model.title,
                        "ai",
                        "App",
                        startedAt,
                        contextPrompt.length,
                        answer.toByteArray().size.toLong()
                    )
                }
            }
            conversationHistory.append("User: ").append(prompt).append("\nAssistant: ").append(answer).append("\n")
            if (conversationHistory.length > 9000) conversationHistory.delete(0, conversationHistory.length - 9000)
            saveCurrentConversation()
            runOnUiThread {
                if (!answer.startsWith("AI reply failed:") && chosenFile.isNotBlank()) {
                    val filePrefs = getSharedPreferences("chatwork_assistant_tools", MODE_PRIVATE)
                    if (filePrefs.getString("pending_file_context", "").orEmpty().trim() == chosenFile) {
                        filePrefs.edit().remove("pending_file_context").apply()
                    }
                }
                replaceThinking(answer)
                status.text = "Reply completed in ${elapsedSeconds}s"
                status.visibility = View.GONE
                sendButton.isEnabled = engine.isLoaded
                sendButton.alpha = if (engine.isLoaded) 1f else 0.55f
                if (!answer.startsWith("AI reply failed:")) speakAnswer(answer)
            }
        }
    }

    /** Offline-only voice input using a model already downloaded by the user. */
    private fun startDownloadedVoiceInput() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO)
            return
        }
        val localeCode = Locale.getDefault().language.lowercase()
        val candidates = when (localeCode) {
            "gu" -> listOf(SpeechModelCatalog.indicConformer("gu"), SpeechModelCatalog.indicConformer("hi"), SpeechModelCatalog.indicConformer("en"))
            "hi" -> listOf(SpeechModelCatalog.indicConformer("hi"), SpeechModelCatalog.indicConformer("gu"), SpeechModelCatalog.indicConformer("en"))
            else -> listOf(SpeechModelCatalog.indicConformer("en"), SpeechModelCatalog.indicConformer("hi"), SpeechModelCatalog.indicConformer("gu"))
        }
        val pack = candidates.firstOrNull { OfflineSpeechEngineFactory.isReady(this, it) }
        if (pack == null) {
            status.text = "No downloaded speech-to-text model is ready. Open Settings → Model Downloads and download a voice recognition pack first."
            return
        }
        val minBuffer = AudioRecord.getMinBufferSize(OfflineSpeechRecognizer.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (minBuffer <= 0) { status.text = "This phone does not support 16 kHz microphone recording."; return }
        cancelOfflineRecording = false
        offlineRecording = true
        runOnUiThread { setRecordingUi(true) }
        status.text = "Recording offline with downloaded ${pack.title} · ${pack.languageCode}. Tap Stop when finished."
        worker.execute {
            var recorder: AudioRecord? = null
            var speech: OfflineSpeechRecognizer? = null
            try {
                speech = OfflineSpeechEngineFactory.openIndicConformer(this, pack.languageCode)
                val audio = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, OfflineSpeechRecognizer.SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minBuffer * 2, 8192))
                recorder = audio
                check(audio.state == AudioRecord.STATE_INITIALIZED) { "Could not initialize microphone." }
                activeAudioRecord = audio
                audio.startRecording()
                val buffer = ShortArray(4096)
                val samples = ArrayList<Float>(OfflineSpeechRecognizer.SAMPLE_RATE * 15)
                val maxSamples = OfflineSpeechRecognizer.SAMPLE_RATE * 60
                while (offlineRecording && samples.size < maxSamples) {
                    val count = audio.read(buffer, 0, buffer.size)
                    if (count > 0) for (i in 0 until count) samples.add(buffer[i] / 32768.0f)
                    else if (count < 0) throw IllegalStateException("Microphone read failed ($count).")
                }
                val wasCancelled = cancelOfflineRecording
                offlineRecording = false
                runCatching { if (audio.recordingState == AudioRecord.RECORDSTATE_RECORDING) audio.stop() }
                if (wasCancelled) return@execute
                check(samples.isNotEmpty()) { "No audio was recorded. Tap Voice and speak." }
                runOnUiThread { status.text = "Transcribing offline with downloaded ${pack.title}…" }
                val speechStartedAt = SystemClock.elapsedRealtime()
                val result = speech.transcribe(samples.toFloatArray())
                if (result.isNotBlank()) {
                    ModelUsageTracker.record(this, pack.id, pack.title, "stt", "App", speechStartedAt, samples.size, result.toByteArray().size.toLong())
                }
                runOnUiThread {
                    if (result.isNotBlank()) {
                        promptInput.setText(result); promptInput.setSelection(promptInput.text.length)
                        status.text = "Offline speech recognized using downloaded model. Tap Send to ask Workly AI."
                    } else status.text = "No speech recognized. Speak clearly and try again."
                    setRecordingUi(false); micButton.isEnabled = true
                }
            } catch (error: Exception) {
                runOnUiThread {
                    status.text = "Downloaded speech model error: ${error.message ?: "offline recognition failed"}"
                    setRecordingUi(false); micButton.isEnabled = true
                }
            } finally {
                offlineRecording = false; activeAudioRecord = null
                runCatching { recorder?.release() }; runCatching { speech?.close() }
            }
        }
    }

    private fun stopOfflineVoiceInput() {
        cancelOfflineRecording = false
        offlineRecording = false
        runCatching {
            activeAudioRecord?.let { if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) it.stop() }
        }
        status.text = "Stopping microphone and transcribing…"
        status.text = "Stopping microphone and transcribing…"
    }

    /** Uses downloaded Indic Tiny TTS only; never Android/mobile TTS. */
    private fun speakAnswer(value: String) {
        val language = selectedLanguage(value)
        val code = when { language.tag.startsWith("hi") -> "hi"; language.tag.startsWith("gu") -> "gu"; else -> "en" }
        val pack = SpeechModelCatalog.indicTinyTts(code)
        if (!OfflineSpeechEngineFactory.isReady(this, pack)) {
            status.text = "No downloaded ${language.label} text-to-speech pack. Open Settings → Model Downloads and download Indic Tiny TTS ${code.uppercase()}."
            return
        }
        status.text = "Speaking with downloaded Indic Tiny TTS · ${code.uppercase()}…"
        worker.execute {
            val ttsStartedAt = SystemClock.elapsedRealtime()
            try {
                tinyTtsEngine?.close()
                val tiny = IndicTinyTtsEngine.create(this, code)
                tinyTtsEngine = tiny
                tiny.speak(value)
                ModelUsageTracker.record(this, pack.id, pack.title, "tts", "App", ttsStartedAt, value.length)
                runOnUiThread { status.text = "Spoken using downloaded Indic Tiny TTS · ${code.uppercase()}." }
            } catch (error: Exception) {
                runOnUiThread { status.text = "Downloaded text-to-speech model error: ${error.message ?: "audio generation failed"}. No mobile TTS fallback was used." }
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_ATTACHMENT && resultCode == RESULT_OK && data != null) {
            val uris = mutableListOf<android.net.Uri>()
            data.clipData?.let { clip -> for (i in 0 until clip.itemCount) clip.getItemAt(i).uri?.let(uris::add) }
            data.data?.let { if (uris.isEmpty()) uris.add(it) }
            if (uris.isNotEmpty()) {
                val names = uris.mapNotNull { uri ->
                    runCatching { contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null } }.getOrNull()
                }
                status.text = "Selected: ${names.joinToString().ifBlank { uris.size.toString() + " attachment(s)" }}. Text extraction is available through Assistant Tools → Files."
                uris.forEach { uri -> runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Returning from Downloads must re-check the selected model and load it immediately.
        // Previously the chat only loaded once in onCreate, so a model downloaded while
        // this Activity remained alive never became usable until the app was reopened.
        val savedId = getSharedPreferences("workly_qwen_models", MODE_PRIVATE)
            .getString("selected_model_id", null)
        val wakeActive = WakeWordAssistantService.isRunning
        if (!wakeActive) {
            getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE).edit()
                .putBoolean(WakeWordAssistantService.KEY_ACTIVE, false).apply()
        }
        qwenModelPicker.isEnabled = !wakeActive && !modelLoadInProgress
        if (!wakeActive && !modelLoadInProgress && (!engine.isLoaded || (savedId != null && savedId != loadedModelId))) loadModel()
    }

    // Language follows the device locale; recognition is allowed to detect the spoken language.
    private fun selectedLanguage(sample: String? = null): VoiceLanguage {
        val text = sample.orEmpty()
        val detected = when {
            text.any { it.code in 0x0900..0x097F } -> "hi"
            text.any { it.code in 0x0A80..0x0AFF } -> "gu"
            else -> "en"
        }
        return languages.first { it.tag.startsWith(detected) }
    }

    private fun addMessage(value: String, fromUser: Boolean): TextView {
        val messageColumn = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = if (fromUser) Gravity.END else Gravity.START; setPadding(dp(1), dp(5), dp(1), dp(5)) }
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = if (fromUser) Gravity.END else Gravity.START }
        val bubble = TextView(this).apply {
            text = if (fromUser) value else formatMarkdown(value); textSize = 16f; typeface = android.graphics.Typeface.DEFAULT
            setTextColor(primaryText); setPadding(if (fromUser) dp(16) else 0, if (fromUser) dp(10) else dp(1), if (fromUser) dp(16) else 0, if (fromUser) dp(10) else dp(1))
            maxWidth = (resources.displayMetrics.widthPixels * 0.92f).toInt(); setLineSpacing(dp(5).toFloat(), 1.04f)
            if (fromUser) { setTextColor(if (dark) 0xFFE8EDF5.toInt() else 0xFF172033.toInt()); background = android.graphics.drawable.GradientDrawable().apply { setColor(if (dark) 0xFF202B3F.toInt() else 0xFFF0F0F0.toInt()); cornerRadius = dp(28).toFloat() } } else background = null
        }
        row.addView(bubble, LinearLayout.LayoutParams(-2, -2).apply { if (fromUser) marginStart = dp(44) else marginEnd = dp(2) })
        messageColumn.addView(row, LinearLayout.LayoutParams(-1, -2))
        if (!fromUser) {
            val meta = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.START; setPadding(0, dp(5), 0, 0) }
            val timestamp = java.text.SimpleDateFormat("dd MMMM yyyy hh:mm:ss a", Locale.getDefault()).format(java.util.Date())
            meta.addView(TextView(this).apply { text = timestamp; textSize = 12f; typeface = android.graphics.Typeface.DEFAULT; setTextColor(secondaryText) }, LinearLayout.LayoutParams(-2, -2).apply { bottomMargin = dp(5) })
            val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
            fun actionIcon(drawable: Int, label: String, onTap: () -> Unit) = ImageView(this).apply {
                setImageResource(drawable); setColorFilter(secondaryText); contentDescription = label; scaleType = ImageView.ScaleType.CENTER
                setPadding(dp(6), dp(5), dp(6), dp(5)); setOnClickListener { onTap() }
            }
            actions.addView(actionIcon(R.drawable.ic_chat_copy, "Copy message") {
                val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("ChatWork message", bubble.text))
                android.widget.Toast.makeText(this@OfflineAiChatActivity, "Message copied", android.widget.Toast.LENGTH_SHORT).show()
            }, LinearLayout.LayoutParams(dp(42), dp(34)))
            actions.addView(actionIcon(R.drawable.ic_chat_thumb_up, "Like response") {
                val prefs = getSharedPreferences("chatwork_message_feedback", MODE_PRIVATE)
                prefs.edit().putString("last_feedback", "positive").putLong("last_feedback_at", System.currentTimeMillis()).apply()
                android.widget.Toast.makeText(this@OfflineAiChatActivity, "Thanks for your feedback", android.widget.Toast.LENGTH_SHORT).show()
            }, LinearLayout.LayoutParams(dp(42), dp(34)))
            actions.addView(actionIcon(R.drawable.ic_chat_thumb_down, "Dislike response") {
                val prefs = getSharedPreferences("chatwork_message_feedback", MODE_PRIVATE)
                prefs.edit().putString("last_feedback", "negative").putLong("last_feedback_at", System.currentTimeMillis()).apply()
                android.widget.Toast.makeText(this@OfflineAiChatActivity, "Thanks for your feedback", android.widget.Toast.LENGTH_SHORT).show()
            }, LinearLayout.LayoutParams(dp(42), dp(34)))
            actions.addView(actionIcon(R.drawable.ic_chatwork_mic, "Read aloud") { speakAnswer(bubble.text.toString()) }, LinearLayout.LayoutParams(dp(42), dp(34)))
            actions.addView(actionIcon(android.R.drawable.ic_menu_share, "Share response") {
                val share = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, bubble.text.toString()) }
                startActivity(Intent.createChooser(share, "Share ChatWork response"))
            }, LinearLayout.LayoutParams(dp(42), dp(34)))
            actions.addView(actionIcon(R.drawable.ic_chat_translate, "Translate response") {
                startActivity(Intent(this@OfflineAiChatActivity, ChatWorkTranslatorActivity::class.java)
                    .putExtra("chatwork.translate.text", bubble.text.toString()))
            }, LinearLayout.LayoutParams(dp(42), dp(34)))
            actions.addView(actionIcon(R.drawable.ic_chatwork_more, "More actions") { showChatOptions(actions) }, LinearLayout.LayoutParams(dp(42), dp(34)))
            meta.addView(actions, LinearLayout.LayoutParams(-1, -2)); messageColumn.addView(meta, LinearLayout.LayoutParams(-1, -2))
        } else {
            messageColumn.addView(TextView(this).apply {
                text = java.text.SimpleDateFormat("hh:mm a", Locale.getDefault()).format(java.util.Date())
                textSize = 12f
                setTextColor(secondaryText)
                gravity = Gravity.END
                setPadding(0, dp(4), dp(5), 0)
            }, LinearLayout.LayoutParams(-1, -2))
        }
        chatMessages.addView(messageColumn, LinearLayout.LayoutParams(-1, -2))
        chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
        return bubble
    }
    private fun replaceThinking(answer: String) {
        val bubble = thinkingBubble
        if (bubble != null) bubble.text = formatMarkdown(answer) else addMessage(answer, false)
        thinkingBubble = null
        chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
    }

    private fun formatMarkdown(source: String): CharSequence {
        val normalized = source
            .replace(Regex("(?m)^#{1,6}\\s+"), "")
            .replace(Regex("(?m)^\\s*[-*]\\s+"), "• ")
            .replace(Regex("(?m)^\\s*\\d+\\.\\s+"), "• ")
        val out = SpannableStringBuilder(normalized)
        Regex("\\*\\*(.+?)\\*\\*").findAll(normalized).forEach { match ->
            out.setSpan(StyleSpan(Typeface.BOLD), match.range.first, match.range.last + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        Regex("(?<!\\*)\\*([^*\\n]+)\\*(?!\\*)").findAll(normalized).forEach { match ->
            out.setSpan(StyleSpan(Typeface.ITALIC), match.range.first, match.range.last + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        Regex("\\x60([^\\x60]+)\\x60").findAll(normalized).forEach { match ->
            out.setSpan(TypefaceSpan("monospace"), match.range.first, match.range.last + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            out.setSpan(BackgroundColorSpan(if (dark) 0xFF263449.toInt() else 0xFFF0F2F5.toInt()), match.range.first, match.range.last + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        return out
    }

    private fun text(value: String, size: Int, color: Int) = TextView(this).apply {
        text = value
        textSize = size.toFloat()
        setTextColor(color)
        setPadding(0, dp(8), 0, dp(8))
    }

    private fun button(value: String) = Button(this).apply {
        text = value
        isAllCaps = false
        minHeight = dp(48)
        setTextColor(0xFFFFFFFF.toInt())
        setBackgroundColor(accent)
    }

    private fun isSystemDarkMode(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_AUDIO && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) startDownloadedVoiceInput()
        else if (requestCode == REQUEST_AUDIO) status.text = "Microphone permission denied."
        else if (requestCode == REQUEST_WAKE_ASSISTANT && grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            startWakeWordService()
        } else if (requestCode == REQUEST_WAKE_ASSISTANT) {
            status.text = "Hey ChatWork needs microphone and notification permissions to show its active listening status."
        }
    }

    override fun onDestroy() {
        offlineRecording = false
        activeAudioRecord?.let { runCatching { it.stop() }; it.release() }
        val wakeServiceActive = WakeWordAssistantService.isRunning
        if (!wakeServiceActive) worker.execute { engine.unload() }
        worker.shutdown()
        tinyTtsEngine?.close()
        super.onDestroy()
    }

    private inner class VoiceWaveformView : View(this@OfflineAiChatActivity) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF0A84FF.toInt(); strokeWidth = dp(3).toFloat(); strokeCap = Paint.Cap.ROUND }
        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val count = 25; val gap = width.toFloat() / (count + 1); val phase = (SystemClock.uptimeMillis() / 110L).toInt()
            for (i in 0 until count) {
                val wave = kotlin.math.abs(kotlin.math.sin((i + phase) * .48)).toFloat()
                val h = dp(5) + wave * dp(24)
                val x = gap * (i + 1)
                canvas.drawLine(x, height / 2f - h / 2f, x, height / 2f + h / 2f, paint)
            }
            if (recordingUiActive) postInvalidateDelayed(90)
        }
    }

    companion object {
        private const val REQUEST_AUDIO = 5101
        private const val REQUEST_WAKE_ASSISTANT = 5103
        private const val REQUEST_EXPORT_CONVERSATION = 5105
        private const val REQUEST_ATTACHMENT = 5106
    }
}
