package com.worklyindia.aivoice

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.provider.CalendarContract
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/** Permission-bounded mobile tools: explicit user-managed memory, SAF file picker and calendar intent. */
class AssistantToolsActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("chatwork_user_memory", MODE_PRIVATE) }
    private lateinit var root: LinearLayout
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(24,24,24,24) }
        root.addView(TextView(this).apply { text="ChatWork Assistant Tools"; textSize=22f })
        root.addView(TextView(this).apply { text="Memory is stored locally on this phone. Add only information you want the assistant to remember."; setPadding(0,12,0,12) })
        root.addView(Button(this).apply { text="Add memory"; setOnClickListener { addMemory() } })
        root.addView(Button(this).apply { text="Review / delete memory"; setOnClickListener { reviewMemory() } })
        root.addView(Button(this).apply { text="Open a file (choose yourself)"; setOnClickListener {
            val intent=Intent(Intent.ACTION_OPEN_DOCUMENT).apply { type="*/*"; addCategory(Intent.CATEGORY_OPENABLE) }
            startActivityForResult(intent, 7201)
        } })
        root.addView(Button(this).apply { text="Create reminder / calendar event"; setOnClickListener { createEvent() } })
        root.addView(Button(this).apply { text="Open an app"; setOnClickListener { appChooser() } })
        root.addView(Button(this).apply { text="Back"; setOnClickListener { finish() } })
        setContentView(root)
    }
    private fun addMemory() {
        val edit=EditText(this).apply { hint="Memory (avoid sensitive information)" }
        AlertDialog.Builder(this).setTitle("Save local memory").setView(edit)
            .setNegativeButton("Cancel",null).setPositiveButton("Save"){_,_-> 
                val value=edit.text.toString().trim()
                if(value.isNotBlank()) { val old=prefs.getString("items","").orEmpty(); prefs.edit().putString("items", if(old.isBlank()) value else old+"\n"+value).apply(); reviewMemory() }
            }.show()
    }
    private fun reviewMemory() {
        val items=prefs.getString("items","").orEmpty().split("\n").filter{it.isNotBlank()}
        if(items.isEmpty()){ AlertDialog.Builder(this).setMessage("No saved memory.").setPositiveButton("OK",null).show(); return }
        AlertDialog.Builder(this).setTitle("Saved memories").setItems(items.toTypedArray()){_,which->
            AlertDialog.Builder(this).setMessage(items[which]).setTitle("Memory")
                .setNegativeButton("Close",null).setNeutralButton("Delete"){_,_-> prefs.edit().putString("items",items.filterIndexed{i,_->i!=which}.joinToString("\n")).apply(); reviewMemory() }.show()
        }.setPositiveButton("Done",null).show()
    }
    private fun createEvent() {
        val title=EditText(this).apply { hint="Reminder / event title" }
        AlertDialog.Builder(this).setTitle("New reminder").setView(title).setNegativeButton("Cancel",null)
            .setPositiveButton("Continue"){_,_-> try {
                val intent=Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.Events.TITLE,title.text.toString().ifBlank{"ChatWork reminder"})
                startActivity(intent)
            } catch(_:Exception){ AlertDialog.Builder(this).setMessage("No calendar app available.").setPositiveButton("OK",null).show() } }.show()
    }
    private fun appChooser() {
        val intent=Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        try { startActivity(Intent.createChooser(intent,"Choose app to open")) }
        catch(_:Exception){ AlertDialog.Builder(this).setMessage("App chooser unavailable.").setPositiveButton("OK",null).show() }
    }
}