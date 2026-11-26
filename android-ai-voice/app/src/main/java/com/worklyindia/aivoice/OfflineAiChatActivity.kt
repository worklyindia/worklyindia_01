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
import android.widget.PopupMenu
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import java.util.Locale
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
    private lateinit var status: TextView
    private lateinit var chatScroll: ScrollView
    private val conversationHistory = StringBuilder()
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
        loadModel()
    }

    private val bg get() = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
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

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(4), 0, dp(4))
        }
        header.addView(Button(this).apply {
            text = "‹"
            textSize = 30f
            isAllCaps = false
            setTextColor(primaryText)
            setBackgroundColor(bg)
            contentDescription = "Back"
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        header.addView(TextView(this).apply {
            text = if (intent.getBooleanExtra(EXTRA_VOICE_TEST_MODE, false)) "🎙  AI Chat · Voice Test" else "⚡  AI Chat"
            textSize = 19f
            setTextColor(primaryText)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        header.addView(Button(this).apply {
            text = "⋮"
            textSize = 24f
            isAllCaps = false
            setTextColor(primaryText)
            setBackgroundColor(bg)
            contentDescription = "Chat settings"
            setOnClickListener { showChatOptions(this) }
        }, LinearLayout.LayoutParams(dp(44), dp(48)))
        root.addView(header, LinearLayout.LayoutParams(-1, dp(58)))

        status = TextView(this).apply {
            text = "Checking offline AI model…"
            textSize = 12f
            setTextColor(secondaryText)
            setPadding(dp(8), dp(3), dp(8), dp(7))
            maxLines = 2
        }
        root.addView(status, LinearLayout.LayoutParams(-1, -2))

        qwenModelPicker = Spinner(this).apply {
            adapter = readableSpinnerAdapter(modelManager.models)
            isEnabled = false
            onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
                override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                    if (ignoreInitialModelSelection) {
                        ignoreInitialModelSelection = false
                        return
                    }
                    val selected = modelManager.models[position]
                    selectedQwenModel = selected
                    val selectedState = modelManager.snapshot(selected).state
                    val selectedReady = selectedState == QwenModelManager.State.READY
                    if (selectedReady && !modelLoadInProgress && selected.id != loadedModelId) {
                        getSharedPreferences("workly_qwen_models", MODE_PRIVATE).edit()
                            .putString("selected_model_id", selected.id).apply()
                        loadModel()
                    } else {
                        sendButton.isEnabled = engine.isLoaded && selectedReady && selected.id == loadedModelId
                        sendButton.alpha = if (sendButton.isEnabled) 1f else 0.55f
                        if (!selectedReady) status.text = if (selectedState == QwenModelManager.State.NEEDS_TEST) {
                            "Run Test Model for this downloaded Qwen model before using it."
                        } else {
                            "Download this Qwen model from Download Models before using it."
                        }
                    }
                }
            }
        }

        root.addView(qwenModelPicker, LinearLayout.LayoutParams(-1, dp(42)))

        chatScroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
            setPadding(dp(2), dp(6), dp(2), dp(10))
            chatMessages = LinearLayout(this@OfflineAiChatActivity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(2), dp(4), dp(2), dp(8))
            }
            addView(chatMessages, ViewGroup.LayoutParams(-1, -2))
        }
        root.addView(chatScroll, LinearLayout.LayoutParams(-1, 0, 1f))
        addMessage(if (intent.getBooleanExtra(EXTRA_VOICE_TEST_MODE, false)) "Voice test: tap 🎙 and speak, tap Stop recording, then tap Send. ChatWork AI will answer aloud. Status messages show each stage." else "Welcome to Workly AI. Ask me in Hindi, English or Gujarati. Your chat runs locally on this phone.", false)

        val composer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), dp(4), dp(5), dp(4))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(surface)
                setStroke(dp(1), if (dark) 0xFF344257.toInt() else 0xFFD8E0EA.toInt())
                cornerRadius = dp(32).toFloat()
            }
        }
        val moreButton = Button(this).apply {
            text = "+"
            textSize = 27f
            isAllCaps = false
            setTextColor(secondaryText)
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            contentDescription = "More chat options"
            setOnClickListener { showChatOptions(this) }
        }
        composer.addView(moreButton, LinearLayout.LayoutParams(dp(42), dp(48)))
        promptInput = EditText(this).apply {
            hint = "Message…"
            textSize = 16f
            minLines = 1
            maxLines = 4
            setTextColor(primaryText)
            setHintTextColor(secondaryText)
            setPadding(dp(5), dp(9), dp(5), dp(9))
            background = null
            imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_SEND
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEND) { sendPrompt(); true } else false
            }
        }
        composer.addView(promptInput, LinearLayout.LayoutParams(0, -2, 1f))
        micButton = Button(this).apply {
            text = "🎙"
            textSize = 20f
            isAllCaps = false
            setTextColor(primaryText)
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            contentDescription = "Voice input"
            setOnClickListener { if (offlineRecording) stopOfflineVoiceInput() else startDownloadedVoiceInput() }
        }
        composer.addView(micButton, LinearLayout.LayoutParams(dp(44), dp(48)))
        sendButton = Button(this).apply {
            text = "➤"
            textSize = 22f
            isAllCaps = false
            setTextColor(0xFFFFFFFF.toInt())
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(accent)
                shape = android.graphics.drawable.GradientDrawable.OVAL
            }
            isEnabled = false
            alpha = 0.55f
            contentDescription = "Send message"
            setOnClickListener { sendPrompt() }
        }
        composer.addView(sendButton, LinearLayout.LayoutParams(dp(48), dp(48)).apply { leftMargin = dp(4) })
        root.addView(composer, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(5)
            bottomMargin = dp(6)
        })
        setContentView(root)
    }

    private fun showChatOptions(anchor: View) {
        PopupMenu(this, anchor).apply {
            menu.add("Create / Edit Image").setOnMenuItemClickListener {
                startActivity(Intent(this@OfflineAiChatActivity, ChatWorkImageActivity::class.java)); true
            }
            menu.add("Assistant Tools · Memory / Files / Reminders / Apps").setOnMenuItemClickListener {
                startActivity(Intent(this@OfflineAiChatActivity, AssistantToolsActivity::class.java)); true
            }
            menu.add("Settings").setOnMenuItemClickListener {
                startActivity(Intent(this@OfflineAiChatActivity, SettingsActivity::class.java)); true
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
                    sendButton.isEnabled = true
                    sendButton.alpha = 1f
                    qwenModelPicker.isEnabled = !WakeWordAssistantService.isRunning
                }
            } catch (error: Exception) {
                runOnUiThread {
                    loadedModelId = null
                    modelLoadInProgress = false
                    status.text = "Model not ready · ${error.message ?: "Offline AI could not start."}"
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
        addMessage(prompt, true)
        thinkingBubble = addMessage("Thinking…", false)
        sendButton.isEnabled = false
        sendButton.alpha = 0.55f
        status.text = "Generating a reply on this phone…"
        val memoryItems = getSharedPreferences("chatwork_user_memory", MODE_PRIVATE).getString("items", "").orEmpty().trim()
        val importedDocs = importedDocumentContext()
        val legacyFileContext = getSharedPreferences("chatwork_assistant_tools", MODE_PRIVATE)
            .getString("pending_file_context", "").orEmpty().trim()
        val chosenFile = importedDocs.ifBlank { legacyFileContext }
        val memoryContext = if (memoryItems.isNotBlank()) "User-approved saved memory (use only if relevant):\n$memoryItems\n\n" else ""
        val fileContext = if (chosenFile.isNotBlank()) "User-selected file content:\n$chosenFile\n\n" else ""
        val contextPrompt = memoryContext + fileContext + (if (conversationHistory.isEmpty()) prompt else
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
            runOnUiThread {
                if (!answer.startsWith("AI reply failed:") && chosenFile.isNotBlank()) {
                    val filePrefs = getSharedPreferences("chatwork_assistant_tools", MODE_PRIVATE)
                    if (filePrefs.getString("pending_file_context", "").orEmpty().trim() == chosenFile) {
                        filePrefs.edit().remove("pending_file_context").apply()
                    }
                }
                replaceThinking(answer)
                status.text = "Reply completed in ${elapsedSeconds}s"
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
        offlineRecording = true
        micButton.text = "■ Stop recording"
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
                offlineRecording = false
                runCatching { if (audio.recordingState == AudioRecord.RECORDSTATE_RECORDING) audio.stop() }
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
                    micButton.text = "🎙"; micButton.isEnabled = true
                }
            } catch (error: Exception) {
                runOnUiThread {
                    status.text = "Downloaded speech model error: ${error.message ?: "offline recognition failed"}"
                    micButton.text = "🎙"; micButton.isEnabled = true
                }
            } finally {
                offlineRecording = false; activeAudioRecord = null
                runCatching { recorder?.release() }; runCatching { speech?.close() }
            }
        }
    }

    private fun stopOfflineVoiceInput() {
        offlineRecording = false
        runCatching {
            activeAudioRecord?.let { if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) it.stop() }
        }
        micButton.isEnabled = false
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
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = if (fromUser) Gravity.END else Gravity.START
            setPadding(dp(2), dp(3), dp(2), dp(3))
        }
        val bubble = TextView(this).apply {
            text = value
            textSize = 16f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL)
            setTextColor(if (fromUser) 0xFFFFFFFF.toInt() else primaryText)
            setPadding(dp(14), dp(10), dp(14), dp(10))
            maxWidth = (resources.displayMetrics.widthPixels * 0.82f).toInt()
            setLineSpacing(dp(2).toFloat(), 1.04f)
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(if (fromUser) 0xFF1769C2.toInt() else surface)
                cornerRadius = dp(19).toFloat()
            }
        }
        val params = LinearLayout.LayoutParams(-2, -2).apply {
            if (fromUser) marginStart = dp(42) else marginEnd = dp(28)
        }
        row.addView(bubble, params)
        chatMessages.addView(row, LinearLayout.LayoutParams(-1, -2))
        chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
        return bubble
    }

    private fun replaceThinking(answer: String) {
        val bubble = thinkingBubble
        if (bubble != null) bubble.text = answer else addMessage(answer, false)
        thinkingBubble = null
        chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
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

    companion object {
        const val EXTRA_VOICE_TEST_MODE = "com.worklyindia.aivoice.EXTRA_VOICE_TEST_MODE"
        private const val REQUEST_AUDIO = 5101
        private const val REQUEST_WAKE_ASSISTANT = 5103
        private const val REQUEST_EXPORT_CONVERSATION = 5105
    }
}
