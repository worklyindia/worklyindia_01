package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/** User-visible controls limited to Android global navigation and scroll actions. */
class MobileControlActivity : Activity() {
    private lateinit var status: TextView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; gravity=Gravity.CENTER_HORIZONTAL; setPadding(24,24,24,24) }
        root.addView(TextView(this).apply { text="Mobile Control"; textSize=24f })
        root.addView(TextView(this).apply { text="ChatWork only performs the navigation and scroll actions you choose here. Accessibility permission is optional and can be disabled anytime."; setPadding(0,16,0,16) })
        status=TextView(this).apply { text=statusText(); setPadding(0,8,0,16) }; root.addView(status)
        button(root,"Enable / Review Accessibility permission") { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
        button(root,"Back") { if(!performGlobal(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)) Toast.makeText(this,"Enable ChatWork Mobile Control first.",Toast.LENGTH_LONG).show() }
        button(root,"Home") { performGlobal(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME) }
        button(root,"Recent apps") { performGlobal(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS) }
        button(root,"Scroll screen down") { scroll(true) }
        button(root,"Scroll screen up") { scroll(false) }
        button(root,"Wi-Fi settings") { startActivity(Intent(Settings.ACTION_WIFI_SETTINGS)) }
        button(root,"Bluetooth settings") { startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }
        button(root,"Display settings") { startActivity(Intent(Settings.ACTION_DISPLAY_SETTINGS)) }
        button(root,"Back to Assistant Tools") { finish() }
        setContentView(root)
    }
    private fun button(root:LinearLayout,label:String,action:()->Unit){root.addView(Button(this).apply{text=text=label;setOnClickListener{action()}})}
    private fun statusText()=if(ChatWorkMobileControlService.enabled(this)) "Accessibility control: enabled" else "Accessibility control: disabled"
    private fun performGlobal(action:Int):Boolean {
        val service=MobileControlServiceRegistry.service ?: return false
        return service.performGlobalAction(action).also { status.text=statusText() }
    }
    private fun scroll(forward:Boolean) {
        val service=MobileControlServiceRegistry.service
        if(service==null) Toast.makeText(this,"Enable ChatWork Mobile Control first.",Toast.LENGTH_LONG).show()
        else Toast.makeText(this,if(service.scrollCurrentScreen(forward)) "Scroll action sent." else "No scrollable area found.",Toast.LENGTH_SHORT).show()
    }
}
