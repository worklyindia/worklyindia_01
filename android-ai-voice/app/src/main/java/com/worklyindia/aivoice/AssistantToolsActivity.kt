package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlarmManager
import android.app.AlertDialog
import android.app.PendingIntent
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
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
        addButton("Add memory") { addMemory() }
        addButton("Review / edit / delete / clear memory") { reviewMemory() }
        addButton("Choose a text file or PDF for AI chat") { chooseFile() }
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

    private fun addButton(label: String, action: () -> Unit) {
        root.addView(Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        })
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
                addCategory(Intent.CATEGORY_OPENABLE)
            }, 7201
        )
    }

    @Deprecated("Legacy result callback for compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 7201 || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        val mimeType = contentResolver.getType(uri).orEmpty().lowercase()
        Thread {
            try {
                val extracted = if (mimeType == "application/pdf" || uri.toString().lowercase().endsWith(".pdf")) {
                    val bytes = contentResolver.openInputStream(uri)?.use { input ->
                        val output = java.io.ByteArrayOutputStream()
                        val buffer = ByteArray(8192)
                        var total = 0
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            total += count
                            require(total <= 20 * 1024 * 1024) { "PDF exceeds the 20 MB import limit." }
                            output.write(buffer, 0, count)
                        }
                        output.toByteArray()
                    } ?: throw IllegalStateException("Unable to read selected PDF.")
                    com.tom_roush.pdfbox.android.PDFBoxResourceLoader.init(applicationContext)
                    val document = com.tom_roush.pdfbox.pdmodel.PDDocument.load(bytes)
                    try {
                        require(document.numberOfPages <= 40) { "PDF exceeds the 40-page import limit." }
                        val stripper = com.tom_roush.pdfbox.text.PDFTextStripper().apply {
                            startPage = 1
                            endPage = document.numberOfPages
                        }
                        stripper.getText(document).take(120001)
                    } finally {
                        document.close()
                    }
                } else {
                    contentResolver.openInputStream(uri)?.use { stream ->
                        BufferedReader(InputStreamReader(stream)).use { reader ->
                            val buffer = CharArray(8192)
                            val result = StringBuilder()
                            while (result.length <= 120000) {
                                val remaining = (120001 - result.length).coerceAtMost(buffer.size)
                                val count = reader.read(buffer, 0, remaining)
                                if (count < 0) break
                                result.append(buffer, 0, count)
                            }
                            result.toString()
                        }
                    } ?: throw IllegalStateException("Unable to read selected text file.")
                }
                require(extracted.isNotBlank()) { "No selectable text was found. Scanned/image-only PDFs need OCR, which is not included yet." }
                require(extracted.length <= 120000) { "Extracted text exceeds the 120 KB chat-context limit." }
                toolsPrefs.edit()
                    .putString("pending_file_context", "Chosen document content (user-selected):\n" + extracted)
                    .apply()
                runOnUiThread {
                    AlertDialog.Builder(this).setMessage(
                        "Document text extracted (" + extracted.length + " characters). It will be included in your next offline AI chat prompt."
                    ).setPositiveButton("OK", null).show()
                }
            } catch (failure: Exception) {
                runOnUiThread {
                    AlertDialog.Builder(this).setMessage("Could not read document: " + (failure.message ?: "Unknown error"))
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
