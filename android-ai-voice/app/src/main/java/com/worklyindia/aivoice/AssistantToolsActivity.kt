package com.worklyindia.aivoice

import android.app.*
import android.Manifest
import android.content.pm.PackageManager
import android.content.*
import android.net.Uri
import android.os.Bundle
import android.provider.CalendarContract
import android.widget.*
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.Calendar

/** User-controlled local memory, SAF text import, local reminder and launcher app shortcuts. */
class AssistantToolsActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("chatwork_user_memory", MODE_PRIVATE) }
    private val toolsPrefs by lazy { getSharedPreferences("chatwork_assistant_tools", MODE_PRIVATE) }
    private lateinit var root: LinearLayout
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(24,24,24,24) }
        root.addView(TextView(this).apply { text="ChatWork Assistant Tools"; textSize=22f })
        root.addView(TextView(this).apply { text="Memories are stored locally. Files are only read after you choose them."; setPadding(0,12,0,12) })
        addButton("Add memory") { addMemory() }
        addButton("Review / edit / delete / clear memory") { reviewMemory() }
        addButton("Choose a text file for AI chat") { chooseFile() }
        addButton("Schedule phone reminder") { scheduleReminder() }
        addButton("Mobile Control") { startActivity(Intent(this, MobileControlActivity::class.java)) }\n        addButton("Open an installed app") { showApps() }
        addButton("Back") { finish() }
        setContentView(root)
    }
    private fun addButton(label:String, action:()->Unit) { root.addView(Button(this).apply { text=label; setOnClickListener{action()} }) }
    private fun addMemory() {
        val edit=EditText(this).apply { hint="Memory (avoid sensitive information)" }
        AlertDialog.Builder(this).setTitle("Save local memory").setView(edit).setNegativeButton("Cancel",null)
            .setPositiveButton("Save"){_,_-> val value=edit.text.toString().trim()
                if(value.isNotBlank()){ val old=prefs.getString("items","").orEmpty(); prefs.edit().putString("items",if(old.isBlank())value else "$old\n$value").apply(); reviewMemory() }
            }.show()
    }
    private fun reviewMemory() {
        val items=prefs.getString("items","").orEmpty().split("\n").filter{it.isNotBlank()}
        val dialog=AlertDialog.Builder(this).setTitle("Saved memories")
        if(items.isEmpty()) { dialog.setMessage("No saved memories."); dialog.setPositiveButton("OK",null).show(); return }
        dialog.setItems(items.toTypedArray()){_,index-> memoryActions(items,index) }
            .setNeutralButton("Clear all"){_,_-> AlertDialog.Builder(this).setMessage("Delete all saved memory?").setNegativeButton("Cancel",null).setPositiveButton("Clear"){_,_->prefs.edit().remove("items").apply()}.show() }
            .setPositiveButton("Done",null).show()
    }
    private fun memoryActions(items:List<String>,index:Int) {
        AlertDialog.Builder(this).setMessage(items[index]).setTitle("Memory")
            .setNeutralButton("Edit"){_,_-> val input=EditText(this).apply{setText(items[index])}
                AlertDialog.Builder(this).setTitle("Edit memory").setView(input).setNegativeButton("Cancel",null)
                    .setPositiveButton("Save"){_,_-> val new=input.text.toString().trim(); val revised=items.toMutableList(); if(new.isBlank()) revised.removeAt(index) else revised[index]=new; prefs.edit().putString("items",revised.joinToString("\n")).apply(); reviewMemory() }.show()
            }.setNegativeButton("Delete"){_,_->prefs.edit().putString("items",items.filterIndexed{i,_->i!=index}.joinToString("\n")).apply();reviewMemory()}
            .setPositiveButton("Close",null).show()
    }
    private fun chooseFile() {
        startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply{type="text/*";addCategory(Intent.CATEGORY_OPENABLE)},7201)
    }
    @Deprecated("Legacy result callback for compatibility")
    override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?) {
        super.onActivityResult(requestCode,resultCode,data)
        if(requestCode!=7201 || resultCode!=RESULT_OK) return
        val uri=data?.data ?: return
        try {
            contentResolver.openInputStream(uri)?.use { stream ->
                val text=BufferedReader(InputStreamReader(stream)).use{it.readText()}
                if(text.length>120000) throw IllegalArgumentException("File is too large for chat context (limit 120 KB of text).")
                toolsPrefs.edit().putString("pending_file_context","Chosen document content (user-selected):\n$text").apply()
                AlertDialog.Builder(this).setMessage("Text read (${text.length} characters). It will be included in your next offline AI chat prompt.").setPositiveButton("OK",null).show()
            } ?: throw IllegalStateException("Unable to read selected document.")
        } catch(e:Exception) { AlertDialog.Builder(this).setMessage("Could not read text: ${e.message}").setPositiveButton("OK",null).show() }
    }
    private fun scheduleReminder() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7202)
            Toast.makeText(this, "Allow notifications, then schedule your reminder again.", Toast.LENGTH_LONG).show()
            return
        }
        val title=EditText(this).apply{hint="Reminder title"}
        val now=Calendar.getInstance()
        val date=DatePicker(this); val time=TimePicker(this).apply{setIs24HourView(true)}
        val layout=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;addView(title);addView(date);addView(time)}
        AlertDialog.Builder(this).setTitle("Schedule reminder").setView(layout).setNegativeButton("Cancel",null)
            .setPositiveButton("Schedule"){_,_-> val cal=Calendar.getInstance().apply{set(date.year,date.month,date.dayOfMonth,time.hour,time.minute,0);set(Calendar.SECOND,0)}
                if(cal.timeInMillis<=System.currentTimeMillis()){Toast.makeText(this,"Choose a future time.",Toast.LENGTH_LONG).show();return@setPositiveButton}
                val id=(System.currentTimeMillis()%Int.MAX_VALUE).toInt()
                val intent=Intent(this,ChatWorkReminderReceiver::class.java).putExtra("title",title.text.toString().ifBlank{"ChatWork reminder"}).putExtra("id",id)
                val pi=PendingIntent.getBroadcast(this,id,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val alarm=getSystemService(ALARM_SERVICE) as AlarmManager
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,cal.timeInMillis,pi)
                Toast.makeText(this,"Reminder scheduled.",Toast.LENGTH_LONG).show()
            }.show()
    }
    private fun showApps() {
        val pm=packageManager
        val apps=pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0)
            .sortedBy{it.loadLabel(pm).toString().lowercase()}
        val labels=apps.map{it.loadLabel(pm).toString()}.toTypedArray()
        AlertDialog.Builder(this).setTitle("Choose installed app").setItems(labels){_,index->
            val launch=pm.getLaunchIntentForPackage(apps[index].activityInfo.packageName)
            if(launch!=null) try{startActivity(launch)}catch(_:Exception){Toast.makeText(this,"Unable to open app.",Toast.LENGTH_SHORT).show()}
        }.setNegativeButton("Cancel",null).show()
    }
}
