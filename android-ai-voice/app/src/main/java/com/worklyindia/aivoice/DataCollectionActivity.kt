package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.text.DateFormat
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
    private var searchQuery = ""
    private var statusText = "Connecting to Supabase…"
    private var lastUpdated = ""
    private var page: LinearLayout? = null
    private var content: LinearLayout? = null
    private var searchInput: EditText? = null

    private val ink get() = ChatWorkTheme.color(this, 0xFF142033.toInt())
    private val muted get() = ChatWorkTheme.color(this, 0xFF65748B.toInt())
    private val surface get() = ChatWorkTheme.color(this, 0xFFFFFFFF.toInt())
    private val canvas get() = ChatWorkTheme.color(this, 0xFFF4F7FB.toInt())
    private val line get() = ChatWorkTheme.color(this, 0xFFE2E8F0.toInt())
    private val blue = 0xFF2878D0.toInt()
    private val green = 0xFF16845B.toInt()
    private val red = 0xFFCB4141.toInt()
    private val amber = 0xFFB7791F.toInt()

    private val refreshRunnable = object : Runnable {
        override fun run() {
            refreshData()
            handler.postDelayed(this, 15_000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ChatWorkTheme.applyWindow(this)
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
                    dashboard = response
                    lastUpdated = response.optString("generated_at").takeIf { it.isNotBlank() }?.let { formatDate(it) } ?: "Just now"
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
        page = root

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setBackgroundColor(surface)
        }
        toolbar.addView(TextView(this).apply {
            text = "‹"
            textSize = 34f
            gravity = Gravity.CENTER
            setTextColor(ink)
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(42), dp(48)))
        toolbar.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(this@DataCollectionActivity).apply {
                text = "ChatWork Data Collection"
                textSize = 18f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(ink)
            })
            addView(TextView(this@DataCollectionActivity).apply {
                text = "Your account's Supabase data"
                textSize = 12f
                setTextColor(muted)
            })
        }, LinearLayout.LayoutParams(0, -2, 1f))
        toolbar.addView(actionText("Refresh", blue) { refreshData() }, LinearLayout.LayoutParams(-2, dp(42)))
        root.addView(toolbar)
        root.addView(View(this).apply { setBackgroundColor(line) }, LinearLayout.LayoutParams(-1, dp(1)))

        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            setPadding(dp(14), dp(14), dp(14), dp(24))
        }
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        content = body
        scroll.addView(body, FrameLayout.LayoutParams(-1, -2))
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))

        body.addView(TextView(this).apply {
            text = statusText
            textSize = 12f
            setTextColor(if (statusText.startsWith("Connected")) green else muted)
        }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(4) })
        body.addView(TextView(this).apply {
            text = if (lastUpdated.isBlank()) "Auto refresh every 15 seconds" else "Last updated: " + lastUpdated + "  •  Auto refresh: 15 sec"
            textSize = 11f
            setTextColor(muted)
        }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(14) })

        if (dashboard.length() == 0) {
            body.addView(infoCard("Supabase connection", statusText))
        } else {
            addTabs(body)
            addSearch(body)
            addSelectedTable(body)
            body.addView(TextView(this).apply {
                text = "Only this account's worker status, installed models and activity logs. Sensitive tokens, passwords, audio links and private text are hidden."
                textSize = 11f
                setTextColor(muted)
                setPadding(dp(4), dp(14), dp(4), dp(4))
            })
        }
        setContentView(root)
        ChatWorkTheme.applyContentInsets(this)
    }

    private fun addOverview(parent: LinearLayout) {
        val devices = dashboard.optJSONArray("devices") ?: JSONArray()
        val device = devices.optJSONObject(0)
        val workerStatus = device?.optString("worker_status", "UNKNOWN") ?: "UNKNOWN"
        val lastSeen = device?.optString("last_seen_at", "")?.takeIf { it.isNotBlank() }?.let { formatDate(it) } ?: "Never"
        parent.addView(sectionTitle("Worker status"))
        parent.addView(infoCard(
            "Community Worker: " + workerStatus,
            "Last heartbeat: " + lastSeen
        ))
        parent.addView(sectionTitle("Installed models and languages"))
        val capabilities = device?.optJSONArray("model_capabilities") ?: JSONArray()
        val modelLines = ArrayList<String>()
        for (i in 0 until capabilities.length()) {
            val capability = capabilities.optJSONObject(i) ?: continue
            val model = capability.optString("model", "Unknown model")
            val pack = capability.optString("pack_id").takeIf { it.isNotBlank() }
            val languages = capability.optJSONArray("languages") ?: JSONArray()
            val languageNames = (0 until languages.length()).mapNotNull { index ->
                languages.optString(index).takeIf { it.isNotBlank() }
            }
            modelLines.add((pack ?: model) + " • " + (if (languageNames.isEmpty()) "Languages not reported" else languageNames.joinToString(", ")))
        }
        parent.addView(infoCard(
            "Ready on this phone (" + modelLines.size + ")",
            modelLines.joinToString("\n").ifBlank { "No fully downloaded and ready models reported by this phone." }
        ))
    }

    private fun addTabs(parent: LinearLayout) {
        val tabs = HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false }
        val strip = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        for (tab in listOf("Overview", "Devices", "Logs")) {
            val active = selectedTab == tab
            val item = TextView(this).apply {
                text = tab
                textSize = 13f
                typeface = if (active) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                gravity = Gravity.CENTER
                setTextColor(if (active) 0xFFFFFFFF.toInt() else muted)
                background = rounded(if (active) blue else surface, dp(12), if (active) blue else line)
                setPadding(dp(15), dp(11), dp(15), dp(11))
                setOnClickListener {
                    selectedTab = tab
                    render()
                }
            }
            strip.addView(item, LinearLayout.LayoutParams(-2, dp(42)).apply { rightMargin = dp(7) })
        }
        tabs.addView(strip)
        parent.addView(tabs, LinearLayout.LayoutParams(-1, dp(48)).apply { bottomMargin = dp(12) })
    }

    private fun addSearch(parent: LinearLayout) {
        val input = EditText(this).apply {
            hint = "Search records…"
            textSize = 14f
            isSingleLine = true
            setTextColor(ink)
            setHintTextColor(muted)
            setPadding(dp(14), 0, dp(14), 0)
            background = rounded(surface, dp(12), line)
            setText(searchQuery)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    searchQuery = s?.toString().orEmpty()
                    val current = content ?: return
                    val index = current.indexOfChild(this@DataCollectionActivity.searchInput)
                    if (index >= 0) {
                        current.removeViews(index + 1, current.childCount - index - 1)
                        addSelectedTable(current)
                    }
                }
                override fun afterTextChanged(s: Editable?) = Unit
            })
        }
        searchInput = input
        parent.addView(input, LinearLayout.LayoutParams(-1, dp(50)).apply { bottomMargin = dp(12) })
    }

    private fun addSelectedTable(parent: LinearLayout) {
        when (selectedTab) {
            "Overview" -> addOverview(parent)
            "Devices" -> {
                parent.addView(sectionTitle("Worker and installed model details"))
                addTable(parent, arrayOf("Device", "Worker status", "Online", "Installed models and languages", "Last seen"),
                    "devices", arrayOf("device_name", "worker_status", "online", "model_capabilities", "last_seen_at"))
            }
            "Logs" -> {
                parent.addView(sectionTitle("Supabase activity logs"))
                addTable(parent, arrayOf("Time", "Source", "Status", "Model", "Language", "Message"),
                    "logs", arrayOf("created_at", "source", "status", "model", "language", "message"))
            }
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
            if (searchQuery.isBlank() || record.toString().contains(searchQuery, ignoreCase = true)) matching.add(record)
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
        val header = TableRow(this).apply { setBackgroundColor(ChatWorkTheme.color(this, 0xFFEAF1FA.toInt())) }
        for (label in headers) header.addView(cell(label, true))
        table.addView(header)
        for ((index, record) in shown.withIndex()) {
            val row = TableRow(this).apply {
                setBackgroundColor(if (index % 2 == 0) surface else ChatWorkTheme.color(this, 0xFFF7F9FC.toInt()))
                setOnClickListener { showRecord(record) }
            }
            for (key in keys) row.addView(cell(displayValue(record, key), false))
            table.addView(row)
        }
        horizontal.addView(table)
        parent.addView(horizontal, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
        parent.addView(TextView(this).apply {
            text = "Showing " + shown.size + " of " + matching.size + " loaded records • Tap a row for details"
            textSize = 11f
            setTextColor(muted)
        }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
        if (matching.isEmpty()) parent.addView(infoCard("No matching records", "Try another search or refresh the data."))
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

    private fun cell(value: String, header: Boolean): TextView = TextView(this).apply {
        text = value
        textSize = if (header) 12f else 11.5f
        typeface = if (header) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        setTextColor(if (header) ink else muted)
        maxLines = 2
        ellipsize = android.text.TextUtils.TruncateAt.END
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(10), dp(12), dp(10), dp(12))
        minWidth = dp(112)
        layoutParams = TableRow.LayoutParams(dp(136), -2)
    }

    private fun showRecord(record: JSONObject) {
        AlertDialog.Builder(this)
            .setTitle("Record details")
            .setMessage(record.toString(2))
            .setPositiveButton("Close", null)
            .show()
            .also { dialog ->
                dialog.window?.setBackgroundDrawable(rounded(surface, dp(14), line))
                dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(blue)
            }
    }

    private fun statCard(label: String, value: String, accent: Int): View =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(13), dp(12), dp(13), dp(12))
            background = rounded(surface, dp(15), line)
            addView(TextView(this@DataCollectionActivity).apply {
                text = label
                textSize = 11f
                setTextColor(muted)
            })
            addView(TextView(this@DataCollectionActivity).apply {
                text = value
                textSize = 25f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(accent)
            }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(5) })
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

    private fun actionText(label: String, color: Int, action: () -> Unit) = TextView(this).apply {
        text = label
        textSize = 13f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        setTextColor(color)
        setPadding(dp(12), dp(8), dp(12), dp(8))
        background = rounded(canvas, dp(10), line)
        setOnClickListener { action() }
    }

    private fun spaceWidth(width: Int) = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(dp(width), 1)
    }

    private fun rounded(fill: Int, radius: Int, stroke: Int? = null) =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius.toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

    private fun formatDate(value: String): String = try {
        val parsed = java.time.Instant.parse(value).toEpochMilli()
        DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(parsed))
    } catch (_: Exception) { value }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        handler.removeCallbacks(refreshRunnable)
        executor.shutdownNow()
        super.onDestroy()
    }
}
