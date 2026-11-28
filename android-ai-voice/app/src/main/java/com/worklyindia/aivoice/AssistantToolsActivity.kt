package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlarmManager
import android.app.AlertDialog
import android.app.PendingIntent
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Build
import java.util.Locale
import android.widget.Button
import android.widget.DatePicker
import android.widget.TimePicker
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Spinner
import android.widget.ArrayAdapter
import android.widget.Toast
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.Calendar

/** User-controlled local memory, selected text-file context, reminders and app shortcuts. */
class AssistantToolsActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("chatwork_user_memory", MODE_PRIVATE) }
    private val toolsPrefs by lazy { getSharedPreferences("chatwork_assistant_tools", MODE_PRIVATE) }
    private lateinit var root: LinearLayout
    private lateinit var assistantToggleButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 24, 24, 24)
        }
        root.addView(TextView(this).apply {
            text = "ChatWork Assistant Tools"
            textSize = 22f
        })
        root.addView(TextView(this).apply {
            text = "Memories are stored locally. Files are only read after you choose them."
            setPadding(0, 12, 0, 12)
        })
        assistantToggleButton = addButton(assistantToggleLabel()) { toggleAssistant() }
        addButton("AI Settings / Model Downloads") { startActivity(Intent(this, SpeechDownloadsActivity::class.java)) }
        addButton("Add memory") { addMemory() }
        addButton("Review / edit / delete / clear memory") { reviewMemory() }
        addButton("Import multiple text files / PDFs (up to 5)") { chooseFile() }
        addButton("Manage imported documents") { manageImportedDocuments() }
        addButton("AI Agent - Plan & Approval History") { startActivity(Intent(this, ChatWorkAgentActivity::class.java)) }
        addButton("Schedule phone reminder") { scheduleReminder() }
        addButton("Manage / cancel reminders") { manageReminders() }
        addButton("Add event to phone calendar") { addCalendarEvent() }
        addButton("Mobile Control") { startActivity(Intent(this, MobileControlActivity::class.java)) }
        addButton("Open an installed app") { showApps() }
        addButton("Back") { finish() }
        setContentView(root)
        when {
            intent.getBooleanExtra("open_reminder_editor", false) -> scheduleReminder()
            intent.getBooleanExtra("open_calendar_editor", false) -> addCalendarEvent()
        }
    }


    override fun onResume() {
        super.onResume()
        if (::assistantToggleButton.isInitialized) refreshAssistantToggle()
    }

    private fun assistantToggleLabel(): String {
        val active = WakeWordAssistantService.isRunning ||
            getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE)
                .getBoolean(WakeWordAssistantService.KEY_ACTIVE, false)
        return if (active) "AI Active · ON — Tap to turn OFF"
        else "AI Active · OFF — Tap to enable"
    }

    private fun refreshAssistantToggle() {
        assistantToggleButton.text = assistantToggleLabel()
    }

    private fun toggleAssistant() {
        val prefs = getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE)
        if (WakeWordAssistantService.isRunning || prefs.getBoolean(WakeWordAssistantService.KEY_ACTIVE, false)) {
            prefs.edit().putBoolean(WakeWordAssistantService.KEY_ACTIVE, false).apply()
            val stop = Intent(this, WakeWordAssistantService::class.java).setAction(WakeWordAssistantService.ACTION_STOP)
            runCatching { startService(stop) }.onFailure {
                stopService(Intent(this, WakeWordAssistantService::class.java))
            }
            Toast.makeText(this, "Hey ChatWork stopping…", Toast.LENGTH_SHORT).show()
            assistantToggleButton.text = "AI Active · OFF — Tap to enable"
            return
        }
        // The existing setup flow checks language, downloaded/tested models and microphone permissions.
        chooseAssistantLanguage()
    }

    private fun chooseAssistantLanguage() {
        val labels = arrayOf("Hindi · हिन्दी", "Gujarati · ગુજરાતી", "English · India")
        val codes = arrayOf("hi", "gu", "en")
        val prefs = getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE)
        var selected = codes.indexOf(prefs.getString(WakeWordAssistantService.KEY_LANGUAGE, "hi")).coerceAtLeast(0)
        AlertDialog.Builder(this).setTitle("Enable Hey ChatWork")
            .setMessage("Listening uses the microphone with a visible foreground notification. Processing stays on this phone.")
            .setSingleChoiceItems(labels, selected) { _, which -> selected = which }
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Continue") { _, _ -> checkAssistantReady(codes[selected]) }.show()
    }

    private fun checkAssistantReady(language: String) {
        val packs = SpeechPackDownloadManager(this)
        val missing = mutableListOf<String>()
        val wakePack = SpeechModelCatalog.chatWorkWakeWord()
        if (!WakeWordEngineFactory.isReady(this)) missing.add("ChatWork Wake Word · English")
        else if (!packs.isModelTested(wakePack)) missing.add("Test Model · ChatWork Wake Word")
        if (!OfflineSpeechEngineFactory.isReady(this, SpeechModelCatalog.indicConformer(language)))
            missing.add("IndicConformer ${language.uppercase(Locale.ROOT)} · Voice to Text")
        if (packs.snapshot(SpeechModelCatalog.indicTinyTts(language)).state != SpeechPackDownloadManager.State.COMPLETE)
            missing.add("Indic Tiny TTS ${language.uppercase(Locale.ROOT)} · Text to Voice")
        val qwen = QwenModelManager(this)
        if (qwen.models.none { qwen.snapshot(it).state == QwenModelManager.State.READY })
            missing.add("A downloaded and tested Qwen AI model")
        if (missing.isNotEmpty()) {
            AlertDialog.Builder(this).setTitle("Models required")
                .setMessage("Download and test these first:\n\n" + missing.joinToString("\n"))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Open Download Models") { _, _ ->
                    startActivity(Intent(this, SpeechDownloadsActivity::class.java))
                }.show()
            return
        }
        getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE).edit()
            .putString(WakeWordAssistantService.KEY_LANGUAGE, language).apply()
        val requested = mutableListOf<String>()
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            requested.add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requested.add(Manifest.permission.POST_NOTIFICATIONS)
        if (requested.isNotEmpty()) requestPermissions(requested.toTypedArray(), 6104)
        else startWakeAssistant()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != 6104) return
        if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) startWakeAssistant()
        else Toast.makeText(this, "Microphone and notification permissions are required to enable the assistant.", Toast.LENGTH_LONG).show()
    }

    private fun startWakeAssistant() {
        val pref = getSharedPreferences(WakeWordAssistantService.PREFS, MODE_PRIVATE)
        pref.edit()
            .putBoolean(WakeWordAssistantService.KEY_ACTIVE, true)
            .putString(WakeWordAssistantService.KEY_LAST_ERROR, "")
            .apply()
        try {
            val intent = Intent(this, WakeWordAssistantService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
            Toast.makeText(this, "Starting Hey ChatWork…", Toast.LENGTH_SHORT).show()
            assistantToggleButton.text = "AI Active · STARTING…"
            assistantToggleButton.isEnabled = false
            assistantToggleButton.postDelayed({
                assistantToggleButton.isEnabled = true
                val active = WakeWordAssistantService.isRunning ||
                    pref.getBoolean(WakeWordAssistantService.KEY_ACTIVE, false)
                assistantToggleButton.text = if (active) {
                    "AI Active · ON — Tap to turn OFF"
                } else {
                    "AI Active · OFF — Tap to enable"
                }
                if (!active) {
                    val reason = pref.getString(WakeWordAssistantService.KEY_LAST_ERROR, "").orEmpty()
                    AlertDialog.Builder(this)
                        .setTitle("Hey ChatWork could not start")
                        .setMessage(reason.ifBlank { "The microphone service stopped before listening started. Check model readiness and permissions, then try again." })
                        .setPositiveButton("OK", null)
                        .setNeutralButton("Open Model Downloads") { _, _ -> startActivity(Intent(this, SpeechDownloadsActivity::class.java)) }
                        .show()
                }
            }, 2500)
        } catch (e: Exception) {
            pref.edit().putBoolean(WakeWordAssistantService.KEY_ACTIVE, false)
                .putString(WakeWordAssistantService.KEY_LAST_ERROR, e.message ?: "Could not start the foreground service.")
                .apply()
            Toast.makeText(this, "Could not start assistant: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun addButton(label: String, action: () -> Unit): Button {
        val button = Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        }
        root.addView(button)
        return button
    }

    private fun addMemory() {
        val edit = EditText(this).apply { hint = "Memory (avoid sensitive information)" }
        AlertDialog.Builder(this).setTitle("Save local memory").setView(edit)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ ->
                val value = edit.text.toString().trim()
                if (value.isNotBlank()) {
                    val old = prefs.getString("items", "").orEmpty()
                    prefs.edit().putString("items", if (old.isBlank()) value else old + "\n" + value).apply()
                    reviewMemory()
                }
            }.show()
    }

    private fun reviewMemory() {
        val items = prefs.getString("items", "").orEmpty().split("\n").filter { it.isNotBlank() }
        val dialog = AlertDialog.Builder(this).setTitle("Saved memories")
        if (items.isEmpty()) {
            dialog.setMessage("No saved memories.").setPositiveButton("OK", null).show()
            return
        }
        dialog.setItems(items.toTypedArray()) { _, index -> memoryActions(items, index) }
            .setNeutralButton("Clear all") { _, _ ->
                AlertDialog.Builder(this).setMessage("Delete all saved memory?")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Clear") { _, _ -> prefs.edit().remove("items").apply() }
                    .show()
            }
            .setPositiveButton("Done", null).show()
    }

    private fun memoryActions(items: List<String>, index: Int) {
        AlertDialog.Builder(this).setMessage(items[index]).setTitle("Memory")
            .setNeutralButton("Edit") { _, _ ->
                val input = EditText(this).apply { setText(items[index]) }
                AlertDialog.Builder(this).setTitle("Edit memory").setView(input)
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Save") { _, _ ->
                        val newValue = input.text.toString().trim()
                        val revised = items.toMutableList()
                        if (newValue.isBlank()) revised.removeAt(index) else revised[index] = newValue
                        prefs.edit().putString("items", revised.joinToString("\n")).apply()
                        reviewMemory()
                    }.show()
            }
            .setNegativeButton("Delete") { _, _ ->
                prefs.edit().putString(
                    "items", items.filterIndexed { i, _ -> i != index }.joinToString("\n")
                ).apply()
                reviewMemory()
            }
            .setPositiveButton("Close", null).show()
    }

    private fun chooseFile() {
        startActivityForResult(
            Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                type = "*/*"
                putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/plain", "application/pdf"))
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                addCategory(Intent.CATEGORY_OPENABLE)
            }, 7201
        )
    }

    private fun importedDocuments(): org.json.JSONArray {
        val raw = toolsPrefs.getString("imported_documents_v1", "[]").orEmpty()
        return runCatching { org.json.JSONArray(raw) }.getOrElse { org.json.JSONArray() }
    }

    private fun saveImportedDocuments(documents: org.json.JSONArray) {
        val combined = buildString {
            for (index in 0 until documents.length()) {
                val item = documents.optJSONObject(index) ?: continue
                append("DOCUMENT: ").append(item.optString("name", "Imported document")).append("\n")
                append(item.optString("text")).append("\n\n")
            }
        }
        toolsPrefs.edit()
            .putString("imported_documents_v1", documents.toString())
            .putString("pending_file_context", if (combined.isBlank()) "" else
                "User-selected local documents. Use relevant documents as sources, distinguish them by filename, and say when information is not present.\n\n" + combined.take(120000))
            .apply()
    }

    private fun manageImportedDocuments() {
        val docs = importedDocuments()
        if (docs.length() == 0) {
            AlertDialog.Builder(this).setMessage("No imported documents. Choose up to five text files or PDFs.")
                .setPositiveButton("OK", null).show()
            return
        }
        val labels = Array(docs.length()) { i ->
            val item = docs.optJSONObject(i)
            (i + 1).toString() + ". " + item?.optString("name", "Document") +
                " (" + (item?.optString("text")?.length ?: 0) + " characters)"
        }
        AlertDialog.Builder(this).setTitle("Imported local documents")
            .setItems(labels) { _, index ->
                val item = docs.optJSONObject(index) ?: return@setItems
                AlertDialog.Builder(this).setTitle(item.optString("name"))
                    .setMessage("This document is stored locally and included in the next offline AI chat. Remove it?")
                    .setNegativeButton("Keep", null)
                    .setPositiveButton("Remove") { _, _ ->
                        val remaining = org.json.JSONArray()
                        for (i in 0 until docs.length()) if (i != index) remaining.put(docs.getJSONObject(i))
                        saveImportedDocuments(remaining)
                        Toast.makeText(this, "Document removed from ChatWork context.", Toast.LENGTH_SHORT).show()
                    }.show()
            }
            .setNeutralButton("Remove all") { _, _ ->
                AlertDialog.Builder(this).setMessage("Remove all imported document context?")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Remove") { _, _ ->
                        saveImportedDocuments(org.json.JSONArray())
                        Toast.makeText(this, "All imported documents removed.", Toast.LENGTH_SHORT).show()
                    }.show()
            }
            .setNegativeButton("Close", null).show()
    }

    @Deprecated("Legacy result callback for compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 7201 || resultCode != RESULT_OK || data == null) return
        val selectedUris = buildList {
            val clip = data.clipData
            if (clip != null) {
                for (i in 0 until clip.itemCount) clip.getItemAt(i).uri?.let(::add)
            } else data.data?.let(::add)
        }.distinct()
        if (selectedUris.isEmpty()) return
        val existing = importedDocuments()
        if (existing.length() + selectedUris.size > 5) {
            AlertDialog.Builder(this).setMessage("ChatWork supports up to five imported documents. Remove an existing document before adding more.")
                .setPositiveButton("OK", null).show()
            return
        }
        Thread {
            try {
                val imported = mutableListOf<Pair<String, String>>()
                var totalChars = (0 until existing.length()).sumOf {
                    existing.optJSONObject(it)?.optString("text")?.length ?: 0
                }
                for (uri in selectedUris) {
                    val mimeType = contentResolver.getType(uri).orEmpty().lowercase()
                    val isPdf = mimeType == "application/pdf" || uri.toString().lowercase().endsWith(".pdf")
                    val extracted = if (isPdf) {
                        val bytes = contentResolver.openInputStream(uri)?.use { input ->
                            val output = java.io.ByteArrayOutputStream()
                            val buffer = ByteArray(8192)
                            var total = 0
                            while (true) {
                                val count = input.read(buffer)
                                if (count < 0) break
                                total += count
                                require(total <= 20 * 1024 * 1024) { "A PDF exceeds the 20 MB import limit." }
                                output.write(buffer, 0, count)
                            }
                            output.toByteArray()
                        } ?: throw IllegalStateException("Unable to read selected PDF.")
                        com.tom_roush.pdfbox.android.PDFBoxResourceLoader.init(applicationContext)
                        val document = com.tom_roush.pdfbox.pdmodel.PDDocument.load(bytes)
                        try {
                            require(document.numberOfPages <= 40) { "A PDF exceeds the 40-page limit." }
                            com.tom_roush.pdfbox.text.PDFTextStripper().apply {
                                startPage = 1
                                endPage = document.numberOfPages
                            }.getText(document).take(120001)
                        } finally {
                            document.close()
                        }
                    } else {
                        contentResolver.openInputStream(uri)?.use { stream ->
                            BufferedReader(InputStreamReader(stream)).use { reader ->
                                val buffer = CharArray(8192)
                                val result = StringBuilder()
                                while (result.length <= 120000) {
                                    val count = reader.read(buffer, 0, (120001 - result.length).coerceAtMost(buffer.size))
                                    if (count < 0) break
                                    result.append(buffer, 0, count)
                                }
                                result.toString()
                            }
                        } ?: throw IllegalStateException("Unable to read selected text file.")
                    }
                    require(extracted.isNotBlank()) { "No selectable text was found. Scanned/image-only PDFs still need OCR." }
                    val name = contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                        val column = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                        if (column >= 0 && cursor.moveToFirst()) cursor.getString(column) else null
                    } ?: if (isPdf) "Imported PDF" else "Imported text file"
                    totalChars += extracted.length
                    require(totalChars <= 120000) { "Combined imported documents exceed the 120,000-character chat-context limit." }
                    imported.add(name to extracted)
                }
                val merged = org.json.JSONArray()
                for (i in 0 until existing.length()) merged.put(existing.getJSONObject(i))
                imported.forEach { (name, text) ->
                    merged.put(org.json.JSONObject().put("name", name).put("text", text))
                }
                saveImportedDocuments(merged)
                runOnUiThread {
                    AlertDialog.Builder(this).setMessage(
                        imported.size.toString() + " document(s) imported. Total stored text: " + totalChars +
                            " characters. They will be included in your next offline AI chat. Manage or remove them anytime in Assistant Tools."
                    ).setPositiveButton("OK", null).show()
                }
            } catch (failure: Exception) {
                runOnUiThread {
                    AlertDialog.Builder(this).setMessage("Could not import documents: " +
                        (failure.message ?: failure.javaClass.simpleName))
                        .setPositiveButton("OK", null).show()
                }
            }
        }.start()
    }

    private fun scheduleReminder() {
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7202)
            Toast.makeText(this, "Allow notifications, then schedule your reminder again.", Toast.LENGTH_LONG).show()
            return
        }
        val title = EditText(this).apply { hint = "Reminder title" }
        val date = DatePicker(this)
        val time = TimePicker(this).apply { setIs24HourView(true) }
        val repeat = Spinner(this).apply {
            adapter = ArrayAdapter(this@AssistantToolsActivity, android.R.layout.simple_spinner_dropdown_item, listOf("Does not repeat", "Every day", "Every week"))
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(title)
            addView(date)
            addView(time)
            addView(TextView(this@AssistantToolsActivity).apply { text = "Repeat" })
            addView(repeat)
        }
        AlertDialog.Builder(this).setTitle("Schedule reminder").setView(layout)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Schedule") { _, _ ->
                val calendar = Calendar.getInstance().apply {
                    set(date.year, date.month, date.dayOfMonth, time.hour, time.minute, 0)
                    set(Calendar.SECOND, 0)
                }
                if (calendar.timeInMillis <= System.currentTimeMillis()) {
                    Toast.makeText(this, "Choose a future time.", Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }
                val id = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
                val reminderTitle = title.text.toString().ifBlank { "ChatWork reminder" }
                val repeatMode = when (repeat.selectedItemPosition) { 1 -> "daily"; 2 -> "weekly"; else -> "none" }
                val intent = Intent(this, ChatWorkReminderReceiver::class.java)
                    .putExtra("title", reminderTitle).putExtra("id", id)
                val pending = PendingIntent.getBroadcast(
                    this, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val alarm = getSystemService(ALARM_SERVICE) as AlarmManager
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pending)
                val ids = reminderIds().apply { add(id.toString()) }
                toolsPrefs.edit().putString("reminder_title_" + id, reminderTitle)
                    .putString("reminder_repeat_" + id, repeatMode)
                    .putLong("reminder_at_" + id, calendar.timeInMillis)
                    .putStringSet("reminder_ids", ids).apply()
                Toast.makeText(this, "Reminder scheduled.", Toast.LENGTH_LONG).show()
            }.show()
    }

    private fun reminderIds(): MutableSet<String> =
        toolsPrefs.getStringSet("reminder_ids", emptySet()).orEmpty().toMutableSet()

    private fun manageReminders() {
        val entries = reminderIds().mapNotNull { id ->
            val title = toolsPrefs.getString("reminder_title_" + id, null) ?: return@mapNotNull null
            val at = toolsPrefs.getLong("reminder_at_" + id, 0L)
            val repeat = toolsPrefs.getString("reminder_repeat_" + id, "none") ?: "none"
            Triple(id, title + if (repeat == "none") "" else " (" + repeat + ")", at)
        }.sortedBy { it.third }
        if (entries.isEmpty()) {
            AlertDialog.Builder(this).setTitle("Scheduled reminders")
                .setMessage("No upcoming ChatWork reminders.")
                .setPositiveButton("OK", null).show()
            return
        }
        val formatter = java.text.DateFormat.getDateTimeInstance(
            java.text.DateFormat.MEDIUM, java.text.DateFormat.SHORT
        )
        val labels = entries.map {
            it.second + "\n" + formatter.format(java.util.Date(it.third))
        }.toTypedArray()
        AlertDialog.Builder(this).setTitle("Scheduled reminders")
            .setItems(labels) { _, index -> manageReminder(entries[index]) }
            .setNegativeButton("Done", null).show()
    }

    private fun manageReminder(item: Triple<String, String, Long>) {
        AlertDialog.Builder(this).setTitle(item.second)
            .setMessage("Scheduled for " + java.text.DateFormat.getDateTimeInstance().format(java.util.Date(item.third)))
            .setNegativeButton("Close", null)
            .setPositiveButton("Edit") { _, _ -> editReminder(item) }
            .setNeutralButton("Cancel reminder") { _, _ ->
                val id = item.first.toIntOrNull() ?: return@setNeutralButton
                val intent = Intent(this, ChatWorkReminderReceiver::class.java).putExtra("id", id)
                val pending = PendingIntent.getBroadcast(
                    this, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                (getSystemService(ALARM_SERVICE) as AlarmManager).cancel(pending)
                pending.cancel()
                val ids = reminderIds().apply { remove(item.first) }
                toolsPrefs.edit().remove("reminder_title_" + id).remove("reminder_at_" + id).remove("reminder_repeat_" + id)
                    .putStringSet("reminder_ids", ids).apply()
                Toast.makeText(this, "Reminder cancelled.", Toast.LENGTH_SHORT).show()
                manageReminders()
            }.show()
    }

    private fun editReminder(item: Triple<String, String, Long>) {
        val id = item.first.toIntOrNull() ?: return
        val titleInput = EditText(this).apply {
            setText(toolsPrefs.getString("reminder_title_" + id, item.second))
            hint = "Reminder title"
        }
        val calendar = Calendar.getInstance().apply {
            timeInMillis = item.third
        }
        val date = DatePicker(this).apply {
            updateDate(calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH), calendar.get(Calendar.DAY_OF_MONTH))
        }
        val time = TimePicker(this).apply {
            setIs24HourView(true)
            hour = calendar.get(Calendar.HOUR_OF_DAY)
            minute = calendar.get(Calendar.MINUTE)
        }
        val repeatModes = listOf("Does not repeat", "Every day", "Every week")
        val repeat = Spinner(this).apply {
            adapter = ArrayAdapter(this@AssistantToolsActivity, android.R.layout.simple_spinner_dropdown_item, repeatModes)
            setSelection(when (toolsPrefs.getString("reminder_repeat_" + id, "none")) {
                "daily" -> 1
                "weekly" -> 2
                else -> 0
            })
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(titleInput)
            addView(date)
            addView(time)
            addView(TextView(this@AssistantToolsActivity).apply { text = "Repeat" })
            addView(repeat)
        }
        AlertDialog.Builder(this).setTitle("Edit reminder").setView(layout)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ ->
                val next = Calendar.getInstance().apply {
                    set(date.year, date.month, date.dayOfMonth, time.hour, time.minute, 0)
                    set(Calendar.SECOND, 0)
                }
                if (next.timeInMillis <= System.currentTimeMillis()) {
                    Toast.makeText(this, "Choose a future time.", Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }
                val reminderTitle = titleInput.text.toString().ifBlank { "ChatWork reminder" }
                val repeatMode = when (repeat.selectedItemPosition) { 1 -> "daily"; 2 -> "weekly"; else -> "none" }
                val alarmIntent = Intent(this, ChatWorkReminderReceiver::class.java)
                    .putExtra("id", id).putExtra("title", reminderTitle)
                val pending = PendingIntent.getBroadcast(
                    this, id, alarmIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val alarm = getSystemService(ALARM_SERVICE) as AlarmManager
                alarm.cancel(pending)
                pending.cancel()
                val replacement = PendingIntent.getBroadcast(
                    this, id, alarmIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.timeInMillis, replacement)
                toolsPrefs.edit().putString("reminder_title_" + id, reminderTitle)
                    .putLong("reminder_at_" + id, next.timeInMillis)
                    .putString("reminder_repeat_" + id, repeatMode).apply()
                Toast.makeText(this, "Reminder updated.", Toast.LENGTH_SHORT).show()
                manageReminders()
            }.show()
    }


    /** Opens the calendar editor; no calendar read/write permission is requested. */
    private fun addCalendarEvent() {
        val title = EditText(this).apply { hint = "Event title" }
        val date = DatePicker(this)
        val time = TimePicker(this).apply { setIs24HourView(true) }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(title)
            addView(date)
            addView(time)
        }
        AlertDialog.Builder(this).setTitle("Add calendar event").setView(layout)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Continue") { _, _ ->
                val start = Calendar.getInstance().apply {
                    set(date.year, date.month, date.dayOfMonth, time.hour, time.minute, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                if (start.timeInMillis <= System.currentTimeMillis()) {
                    Toast.makeText(this, "Choose a future date and time.", Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }
                val eventTitle = title.text.toString().trim().take(160)
                if (eventTitle.isBlank()) {
                    Toast.makeText(this, "Enter an event title.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                val end = start.timeInMillis + 60L * 60L * 1000L
                val insert = Intent(Intent.ACTION_INSERT).apply {
                    data = android.provider.CalendarContract.Events.CONTENT_URI
                    putExtra(android.provider.CalendarContract.Events.TITLE, eventTitle)
                    putExtra(android.provider.CalendarContract.EXTRA_EVENT_BEGIN_TIME, start.timeInMillis)
                    putExtra(android.provider.CalendarContract.EXTRA_EVENT_END_TIME, end)
                    putExtra(android.provider.CalendarContract.Events.AVAILABILITY,
                        android.provider.CalendarContract.Events.AVAILABILITY_BUSY)
                }
                try {
                    if (insert.resolveActivity(packageManager) != null) startActivity(insert)
                    else Toast.makeText(this, "No calendar app is available on this phone.", Toast.LENGTH_LONG).show()
                } catch (_: Exception) {
                    Toast.makeText(this, "Unable to open calendar app.", Toast.LENGTH_LONG).show()
                }
            }.show()
    }

    private fun showApps() {
        val pm = packageManager
        val apps = pm.queryIntentActivities(
            Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0
        ).sortedBy { it.loadLabel(pm).toString().lowercase() }
        val labels = apps.map { it.loadLabel(pm).toString() }.toTypedArray()
        AlertDialog.Builder(this).setTitle("Choose installed app")
            .setItems(labels) { _, index ->
                val launch = pm.getLaunchIntentForPackage(apps[index].activityInfo.packageName)
                if (launch != null) {
                    try { startActivity(launch) }
                    catch (_: Exception) { Toast.makeText(this, "Unable to open app.", Toast.LENGTH_SHORT).show() }
                }
            }.setNegativeButton("Cancel", null).show()
    }
}
