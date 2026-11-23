package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.util.Date
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Per-user, read-only Google-Sheets-style view of this account's ChatWork records stored in Supabase. */
class DataCollectionActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private val loading = AtomicBoolean(false)
    private var dashboard = JSONObject()
    private var selectedTab = "Overview"
    private var statusText = "Connecting to Supabase…"

    private val ink = 0xFFF0F4FA.toInt()
    private val muted = 0xFFAAB7C8.toInt()
    private val surface = 0xFF101B2B.toInt()
    private val canvas = 0xFF070D18.toInt()
    private val line = 0xFF29384D.toInt()
    private val blue = 0xFF2878D0.toInt()

    private val refreshRunnable = object : Runnable {
        override fun run() {
            refreshData()
            handler.postDelayed(this, 15_000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ChatWorkTheme.applyWindow(this)
        window.statusBarColor = canvas
        window.navigationBarColor = canvas
        androidx.core.view.WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        render()
        refreshData()
    }

    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(refreshRunnable)
        handler.postDelayed(refreshRunnable, 15_000L)
    }

    override fun onPause() {
        handler.removeCallbacks(refreshRunnable)
        super.onPause()
    }

    private fun refreshData() {
        val token = SecureDeviceTokenStore.read(this)
        if (token.isNullOrBlank()) {
            statusText = "Connect your Workly India account to load Supabase data."
            render()
            return
        }
        if (!loading.compareAndSet(false, true)) return
        statusText = "Refreshing Supabase data…"
        render()
        executor.execute {
            try {
                val response = VoiceRelayApi.userDataDashboard(token)
                runOnUiThread {
                    dashboard = normalizeDashboard(response)
                    statusText = "Connected • Live data from Supabase"
                    loading.set(false)
                    render()
                }
            } catch (error: Exception) {
                runOnUiThread {
                    statusText = error.message ?: "Could not load ChatWork data."
                    loading.set(false)
                    render()
                }
            }
        }
    }

    private fun render() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(canvas)
        }

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setBackgroundColor(canvas)
        }
        toolbar.addView(TextView(this).apply {
            text = "‹"
            textSize = 36f
            gravity = Gravity.CENTER
            setTextColor(ink)
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(42), dp(48)))
        toolbar.addView(TextView(this).apply {
            text = "ChatWork Data Collection"
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(ink)
            gravity = Gravity.CENTER_VERTICAL
        }, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(toolbar)
        root.addView(View(this).apply { setBackgroundColor(line) }, LinearLayout.LayoutParams(-1, dp(1)))

        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            setPadding(0, dp(14), 0, dp(24))
        }
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        scroll.addView(body, FrameLayout.LayoutParams(-1, -2))
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))

        if (dashboard.length() == 0) {
            body.addView(infoCard("Supabase connection", statusText))
        } else {
            addTabs(body)
            addSelectedTable(body)
        }
        setContentView(root)
        ChatWorkTheme.applyContentInsets(this)
    }

    private fun addOverview(parent: LinearLayout) {
        val devices = dashboard.optJSONArray("devices") ?: JSONArray()
        val device = devices.optJSONObject(0)
        val workerStatus = device?.let { row ->
            when {
                !row.isNull("revoked_at") -> "REVOKED"
                row.optBoolean("worker_enabled", false) && isRecentHeartbeat(row.optString("last_seen_at")) -> "ACTIVE"
                row.optBoolean("worker_enabled", false) -> "OFFLINE"
                else -> "OFF"
            }
        } ?: "NOT REGISTERED"
        val lastSeen = device?.optString("last_seen_at", "")?.takeIf { it.isNotBlank() }?.let { formatDate(it) } ?: "Never"
        parent.addView(sectionTitle("Worker status"))
        parent.addView(infoCard("Community Worker: " + workerStatus, "Last heartbeat: " + lastSeen))
        parent.addView(sectionTitle("Installed models and languages"))
        val capabilities = device?.optJSONArray("model_capabilities") ?: JSONArray()
        val headers = arrayOf("Model", "Size", "Date", "Time", "Language")
        val table = TableLayout(this).apply {
            isStretchAllColumns = false
            setPadding(0, dp(2), 0, dp(2))
        }
        val header = TableRow(this).apply { setBackgroundColor(0xFF1A2A40.toInt()) }
        headers.forEach { header.addView(cell(it, true)) }
        table.addView(header)
        for (i in 0 until capabilities.length()) {
            val cap = capabilities.optJSONObject(i) ?: continue
            val model = listOf("model", "model_name", "pack_id", "model_id", "name", "id")
                .firstNotNullOfOrNull { key ->
                    cap.optString(key).takeIf { it.isNotBlank() && it != "null" && it != "Unknown model" }
                } ?: "Unknown model"
            val sizeValue = when {
                cap.has("size_bytes") -> cap.optLong("size_bytes")
                cap.has("model_size_bytes") -> cap.optLong("model_size_bytes")
                cap.has("size") -> cap.optLong("size")
                else -> -1L
            }
            val size = if (sizeValue >= 0) formatBytes(sizeValue) else "—"
            val installedAt = listOf("installed_at", "downloaded_at", "completed_at").firstNotNullOfOrNull { key ->
                cap.optString(key).takeIf { it.isNotBlank() && it != "null" }
            }
            val date = installedAt?.let { formatDate(it).substringBefore(" ") } ?: "—"
            val time = installedAt?.let { formatDate(it).substringAfter(" ", "—") } ?: "—"
            val languages = cap.optJSONArray("languages") ?: JSONArray()
            val languageNames = (0 until languages.length()).mapNotNull { index ->
                languages.optString(index).takeIf { it.isNotBlank() }?.let { fullLanguageName(it) }
            }
            val row = TableRow(this).apply {
                setBackgroundColor(if (i % 2 == 0) surface else 0xFF0C1625.toInt())
            }
            listOf(model, size, date, time, languageNames.joinToString(", ").ifBlank { "—" })
                .forEach { row.addView(cell(it, false)) }
            table.addView(row)
        }
        val horizontal = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = true
            clipToPadding = false
            background = rounded(surface, dp(12), line)
            addView(table)
        }
        parent.addView(horizontal, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
        if (capabilities.length() == 0) parent.addView(infoCard("No installed models", "No ready model capabilities were reported by this phone."))
    }

    private fun fullLanguageName(code: String): String {
        val normalized = code.substringBefore('-').lowercase(java.util.Locale.ROOT)
        val name = when (normalized) {
            "en" -> "English"
            "hi" -> "Hindi"
            "gu" -> "Gujarati"
            "ta" -> "Tamil"
            "te" -> "Telugu"
            "bn" -> "Bengali"
            "mr" -> "Marathi"
            "kn" -> "Kannada"
            "ml" -> "Malayalam"
            "pa" -> "Punjabi"
            "ur" -> "Urdu"
            "or" -> "Odia"
            "as" -> "Assamese"
            else -> java.util.Locale.forLanguageTag(normalized).getDisplayLanguage(java.util.Locale.ENGLISH)
        }
        return name.ifBlank { code }
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val units = arrayOf("KB", "MB", "GB", "TB")
        var value = bytes.toDouble()
        var unit = -1
        do { value /= 1024.0; unit++ } while (value >= 1024 && unit < units.lastIndex)
        return String.format(java.util.Locale.ENGLISH, "%.2f %s", value, units[unit])
    }

    private fun addTabs(parent: LinearLayout) {
        val tabs = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        for (tab in listOf("Overview", "Logs")) {
            val active = selectedTab == tab
            val item = TextView(this).apply {
                text = tab
                textSize = 14f
                typeface = if (active) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                gravity = Gravity.CENTER
                setTextColor(if (active) 0xFFFFFFFF.toInt() else muted)
                background = rounded(if (active) blue else surface, dp(12), if (active) blue else line)
                setOnClickListener {
                    selectedTab = tab
                    render()
                }
            }
            tabs.addView(item, LinearLayout.LayoutParams(0, dp(50), 1f).apply {
                leftMargin = dp(3); rightMargin = dp(3)
            })
        }
        parent.addView(tabs, LinearLayout.LayoutParams(-1, dp(54)).apply { bottomMargin = dp(12) })
    }

    private fun addSelectedTable(parent: LinearLayout) {
        when (selectedTab) {
            "Overview" -> addOverview(parent)
            "Logs" -> addTable(parent, arrayOf("Time", "Source", "Status", "Model", "Language", "Message"),
                "logs", arrayOf("created_at", "source", "status", "model", "language", "message"))
        }
    }

    private fun addTable(
        parent: LinearLayout,
        headers: Array<String>,
        arrayName: String,
        keys: Array<String>,
        maxRows: Int = Int.MAX_VALUE
    ) {
        val records = dashboard.optJSONArray(arrayName) ?: JSONArray()
        val matching = ArrayList<JSONObject>()
        for (index in 0 until records.length()) {
            val record = records.optJSONObject(index) ?: continue
            matching.add(record)
        }
        val shown = matching.take(maxRows)
        val horizontal = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = true
            background = rounded(surface, dp(12), line)
        }
        val table = TableLayout(this).apply {
            isStretchAllColumns = false
            setPadding(dp(4), dp(4), dp(4), dp(4))
        }
        val header = TableRow(this).apply { setBackgroundColor(0xFF1A2A40.toInt()) }
        for (label in headers) header.addView(cell(label, true))
        table.addView(header)
        for ((index, record) in shown.withIndex()) {
            val row = TableRow(this).apply {
                setBackgroundColor(if (index % 2 == 0) surface else 0xFF0C1625.toInt())
                setOnClickListener { showRecord(record) }
            }
            for (key in keys) {
                val errorRow = record.optString("status").uppercase(java.util.Locale.ROOT) in listOf("ERROR", "FAILED", "FAILURE")
                row.addView(cell(displayValue(record, key), false, key == "message" && errorRow))
            }
            table.addView(row)
        }
        horizontal.addView(table)
        parent.addView(horizontal, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
        if (matching.isEmpty()) parent.addView(infoCard("No activity yet", "App and website activity will appear here when recorded."))
    }

    private fun displayValue(record: JSONObject, path: String): String {
        var value: Any? = record
        for (part in path.split(".")) {
            value = when (value) {
                is JSONObject -> value.opt(part).takeUnless { it == JSONObject.NULL }
                else -> null
            }
        }
        return when (value) {
            null -> "—"
            is JSONObject -> value.toString()
            is JSONArray -> {
                if (path == "model_capabilities") {
                    val names = ArrayList<String>()
                    for (i in 0 until value.length()) {
                        val cap = value.optJSONObject(i) ?: continue
                        val pack = cap.optString("pack_id").takeIf { it.isNotBlank() } ?: cap.optString("model")
                        val languages = cap.optJSONArray("languages") ?: JSONArray()
                        val languageNames = (0 until languages.length()).mapNotNull { index ->
                            languages.optString(index).takeIf { it.isNotBlank() }
                        }
                        names.add(pack + " [" + languageNames.joinToString(", ") + "]")
                    }
                    names.joinToString("\n").ifBlank { "None" }
                } else value.toString()
            }
            is Boolean -> if (path == "worker_enabled") if (value) "ON" else "OFF" else if (value) "Yes" else "No"
            else -> {
                val text = value.toString()
                if (path.endsWith("_at") && text.contains("T")) formatDate(text) else text
            }
        }
    }

    private fun cell(value: String, header: Boolean, error: Boolean = false): TextView = TextView(this).apply {
        text = value
        textSize = if (header) 12f else 11.5f
        typeface = if (header) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        setTextColor(if (error) 0xFFFF5252.toInt() else if (header) 0xFFF0F4FA.toInt() else ink)
        background = GradientDrawable().apply {
            setColor(if (header) 0xFF1A2A40.toInt() else surface)
            setStroke(dp(1), 0xFF33445C.toInt())
        }
        maxLines = 3
        ellipsize = android.text.TextUtils.TruncateAt.END
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(10), dp(12), dp(10), dp(12))
        minWidth = dp(112)
        layoutParams = TableRow.LayoutParams(dp(148), -2)
    }

    private fun showRecord(record: JSONObject) {
        val details = TextView(this).apply {
            text = record.toString(2)
            textSize = 12f
            setTextColor(ink)
            setPadding(dp(16), dp(12), dp(16), dp(12))
            typeface = Typeface.MONOSPACE
        }
        val scroll = ScrollView(this).apply {
            addView(details)
            background = rounded(surface, dp(10), line)
        }
        AlertDialog.Builder(this)
            .setTitle("Record details")
            .setView(scroll)
            .setPositiveButton("Close", null)
            .create()
            .also { dialog ->
                dialog.setOnShowListener {
                    dialog.window?.setBackgroundDrawable(rounded(surface, dp(14), line))
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(blue)
                    val titleId = resources.getIdentifier("alertTitle", "id", "android")
                    dialog.findViewById<TextView>(titleId)?.setTextColor(ink)
                }
                dialog.show()
            }
    }

    private fun infoCard(title: String, message: String): View =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(15), dp(14), dp(15), dp(14))
            background = rounded(surface, dp(14), line)
            addView(TextView(this@DataCollectionActivity).apply {
                text = title
                textSize = 14f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(ink)
            })
            addView(TextView(this@DataCollectionActivity).apply {
                text = message
                textSize = 12f
                setTextColor(muted)
            }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(6) })
        }

    private fun sectionTitle(value: String) = TextView(this).apply {
        text = value
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(ink)
        setPadding(dp(2), dp(8), dp(2), dp(9))
    }

    private fun rounded(fill: Int, radius: Int, stroke: Int? = null) =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius.toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

    private fun formatDate(value: String): String = try {
        val parsed = java.time.Instant.parse(value).toEpochMilli()
        java.text.SimpleDateFormat("dd/MM/yyyy hh:mm:ss a", java.util.Locale.ENGLISH).format(Date(parsed))
    } catch (_: Exception) { value }

    private fun isRecentHeartbeat(value: String): Boolean = try {
        val parsed = java.time.Instant.parse(value).toEpochMilli()
        System.currentTimeMillis() - parsed <= 60_000L
    } catch (_: Exception) { false }

    private fun normalizeDashboard(source: JSONObject): JSONObject {
        val result = JSONObject(source.toString())
        val existing = result.optJSONArray("logs")
        if (existing != null && existing.length() > 0) return result
        val logs = JSONArray()
        val jobs = result.optJSONArray("jobs") ?: JSONArray()
        for (i in 0 until jobs.length()) {
            val row = jobs.optJSONObject(i) ?: continue
            val payload = row.optJSONObject("payload") ?: JSONObject()
            val output = row.optJSONObject("result") ?: JSONObject()
            logs.put(JSONObject()
                .put("id", "job:" + row.optString("id"))
                .put("created_at", row.optString("created_at"))
                .put("source", "VOICE JOB")
                .put("status", row.optString("status", "UNKNOWN").uppercase(java.util.Locale.ROOT))
                .put("model", payload.optString("model"))
                .put("language", payload.optString("language", payload.optString("source_language")))
                .put("message", output.optString("error", row.optString("job_type", "job").uppercase(java.util.Locale.ROOT) + " request")))
        }
        val diagnostics = result.optJSONArray("diagnostics") ?: JSONArray()
        for (i in 0 until diagnostics.length()) {
            val row = diagnostics.optJSONObject(i) ?: continue
            logs.put(JSONObject()
                .put("id", "diagnostic:" + row.optString("id"))
                .put("created_at", row.optString("created_at"))
                .put("source", "APP EVENT")
                .put("status", if (!row.isNull("error_type") || !row.isNull("error_message")) "ERROR" else "INFO")
                .put("model", "")
                .put("language", row.optString("language"))
                .put("message", row.optString("error_message", (row.optJSONObject("metadata")?.optString("message") ?: row.optString("event_type", "App event")))))
        }
        result.put("logs", logs)
        return result
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        handler.removeCallbacks(refreshRunnable)
        executor.shutdownNow()
        super.onDestroy()
    }
}
