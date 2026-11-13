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

        // Capture only safe routing metadata (never message text, phone numbers,
        // sender IDs, URLs, or access tokens) so we can prove FCM reached Android
        // and see which fields the social-bubble classifier actually received.
        val routingKeys = payload.keys.sorted().joinToString(",").take(500)
        val platform = listOf("platform", "source", "channel", "integration", "provider")
            .firstNotNullOfOrNull { key -> payload[key]?.takeIf { it.isNotBlank() }?.lowercase() }
            ?: "unknown"
        val eventType = payload["type"] ?: payload["notification_type"] ?: "unknown"
        val socialPayload = "$platform $eventType $routingKeys".lowercase().let { text ->
            listOf("whatsapp", "instagram", "facebook", "messenger", "social_inbox").any { it in text }
        }
        if (socialPayload) {
            val diagnostic = "fcmReceived=true platform=$platform type=$eventType keys=$routingKeys sdk=${android.os.Build.VERSION.SDK_INT}"
            android.util.Log.i("WorklyPush", "Social FCM received: $diagnostic")
            AppErrorReporter.capture(
                applicationContext,
                "bubble",
                "warning",
                "SocialFcmReceived",
                diagnostic,
                source = "fcm"
            )
        }
        NativePushManager.showNotification(applicationContext, payload)
    }
}
