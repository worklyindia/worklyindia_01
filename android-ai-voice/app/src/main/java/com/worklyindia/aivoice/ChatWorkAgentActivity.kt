package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.text.DateFormat
import java.util.Date
import java.util.UUID

/**
 * Offline task-planning foundation. Approval records a plan only; it never runs
 * arbitrary instructions or changes apps, files, messages, payments or settings.
 */
class ChatWorkAgentActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("chatwork_agent_audit", MODE_PRIVATE) }
    private lateinit var content: LinearLayout
    private var pendingGoal = ""
    private var pendingSteps: List<String> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 24, 24, 24)
        }
        root.addView(TextView(this).apply { text = "AI Agent"; textSize = 24f })
        root.addView(TextView(this).apply {
            text = "Create an offline task plan. Nothing runs automatically. Review and approve before any future connected action."
            setPadding(0, 12, 0, 16)
        })
        val goal = EditText(this).apply {
            hint = "What would you like the agent to plan?"
            minLines = 2
            maxLines = 4
        }
        root.addView(goal)
        val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        buttons.addView(Button(this@ChatWorkAgentActivity).apply {
            text = "Create plan"
            isAllCaps = false
            setOnClickListener { createPlan(goal.text.toString()) }
        })
        buttons.addView(Button(this@ChatWorkAgentActivity).apply {
            text = "Audit history"
            isAllCaps = false
            setOnClickListener { showHistory() }
        })
        root.addView(buttons)
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(ScrollView(this).apply { addView(content) },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        root.addView(Button(this).apply {
            text = "Back"
            isAllCaps = false
            setOnClickListener { finish() }
        })
        setContentView(root)
    }

    private fun createPlan(rawGoal: String) {
        val goal = rawGoal.trim().take(500)
        if (goal.isBlank()) {
            AlertDialog.Builder(this).setMessage("Enter a task first.")
                .setPositiveButton("OK", null).show()
            return
        }
        pendingGoal = goal
        pendingSteps = listOf(
            "Understand the goal and identify required information",
            "Prepare a proposed sequence of small, reversible actions",
            "Review permissions, privacy and possible side effects",
            "Ask for confirmation before any connected action"
        )
        content.removeAllViews()
        content.addView(TextView(this).apply {
            text = "Proposed plan for:\n" + goal + "\n\n" +
                pendingSteps.mapIndexed { index, step -> (index + 1).toString() + ". " + step }.joinToString("\n")
            textSize = 16f
            setPadding(0, 16, 0, 16)
        })
        content.addView(TextView(this).apply {
            text = "Approval records the plan only. No app, file, message, payment or system setting will be changed."
        })
        content.addView(Button(this).apply {
            text = "Approve plan"
            isAllCaps = false
            setOnClickListener { approvePlan() }
        })
        content.addView(Button(this).apply {
            text = "Discard plan"
            isAllCaps = false
            setOnClickListener {
                pendingGoal = ""
                pendingSteps = emptyList()
                content.removeAllViews()
            }
        })
    }

    private fun approvePlan() {
        if (pendingGoal.isBlank() || pendingSteps.isEmpty()) return
        val record = listOf(
            UUID.randomUUID().toString(),
            System.currentTimeMillis().toString(),
            "APPROVED_PLAN_ONLY",
            pendingGoal.replace("\n", " "),
            pendingSteps.joinToString(" | ")
        ).joinToString("\t")
        val old = prefs.getString("audit", "").orEmpty()
        val updated = (listOf(record) + old.lines().filter { it.isNotBlank() }).take(100)
        prefs.edit().putString("audit", updated.joinToString("\n")).apply()
        pendingGoal = ""
        pendingSteps = emptyList()
        content.removeAllViews()
        content.addView(TextView(this).apply {
            text = "Plan approved and saved to local audit history. No actions were executed."
            textSize = 16f
        })
    }

    private fun showHistory() {
        val records = prefs.getString("audit", "").orEmpty().lines().filter { it.isNotBlank() }
        if (records.isEmpty()) {
            AlertDialog.Builder(this).setTitle("Agent audit history")
                .setMessage("No approved plans yet.")
                .setPositiveButton("OK", null).show()
            return
        }
        val labels = records.map { line ->
            val parts = line.split('\t')
            val time = parts.getOrNull(1)?.toLongOrNull()?.let {
                DateFormat.getDateTimeInstance().format(Date(it))
            } ?: "Unknown time"
            time + " — " + parts.getOrNull(3).orEmpty()
        }
        AlertDialog.Builder(this).setTitle("Local agent audit history")
            .setItems(labels.toTypedArray()) { _, index ->
                val parts = records[index].split('\t')
                AlertDialog.Builder(this).setTitle("Approved plan (not executed)")
                    .setMessage("Goal: " + parts.getOrNull(3).orEmpty() +
                        "\n\nSteps: " + parts.getOrNull(4).orEmpty())
                    .setPositiveButton("OK", null).show()
            }
            .setNeutralButton("Clear history") { _, _ ->
                AlertDialog.Builder(this).setMessage("Delete all local agent audit records?")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Delete") { _, _ -> prefs.edit().remove("audit").apply() }
                    .show()
            }
            .setNegativeButton("Close", null).show()
    }
}
