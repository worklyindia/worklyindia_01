package com.worklyindia.app

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class WorklyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val session = NativeAuth.session(applicationContext) ?: return
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            runCatching { NativePushManager.register(applicationContext, session) }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // The existing Workly notification hub sends FCM data-only messages.
        // Display exactly one native notification here (never an FCM auto-display duplicate).
        val payload = message.data.toMutableMap()
        message.notification?.title?.takeIf { it.isNotBlank() }?.let { payload.putIfAbsent("title", it) }
        message.notification?.body?.takeIf { it.isNotBlank() }?.let { payload.putIfAbsent("body", it) }
        NativePushManager.showNotification(applicationContext, payload)
    }
}
