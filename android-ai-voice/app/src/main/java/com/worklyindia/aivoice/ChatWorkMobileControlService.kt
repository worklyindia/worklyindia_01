package com.worklyindia.aivoice

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/** Limited user-enabled accessibility control: global navigation and scroll only. */
class ChatWorkMobileControlService : AccessibilityService() {\n    override fun onServiceConnected() { super.onServiceConnected(); MobileControlServiceRegistry.service = this }\n    override fun onDestroy() { MobileControlServiceRegistry.service = null; super.onDestroy() }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) { /* no event collection */ }
    override fun onInterrupt() {}
    fun scrollCurrentScreen(forward: Boolean): Boolean {
        val root = rootInActiveWindow ?: return false
        return scrollNode(root, forward)
    }
    private fun scrollNode(node: AccessibilityNodeInfo, forward: Boolean): Boolean {
        if (node.isScrollable) {
            val action = if (forward) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
            if (node.performAction(action)) return true
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (scrollNode(child, forward)) return true
        }
        return false
    }
    companion object {
        fun enabled(context: android.content.Context): Boolean {
            val enabledServices = android.provider.Settings.Secure.getString(context.contentResolver, android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
            return enabledServices.split(':').any { it.equals(context.packageName + "/" + ChatWorkMobileControlService::class.java.name, true) }
        }
    }
}