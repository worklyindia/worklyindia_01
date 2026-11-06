package com.worklyindia.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class WorklyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        if (!NativePushManager.isOptedIn(applicationContext)) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        if (!NotificationManagerCompat.from(applicationContext).areNotificationsEnabled()) return
        val session = NativeAuth.session(applicationContext) ?: return
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            runCatching { NativePushManager.register(applicationContext, session) }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        if (!NativePushManager.isOptedIn(applicationContext)) return
        // The existing Workly notification hub sends FCM data-only messages.
        // Display exactly one native notification here (never an FCM auto-display duplicate).
        val payload = message.data.toMutableMap()
        message.notification?.title?.takeIf { it.isNotBlank() }?.let { payload.putIfAbsent("title", it) }
        message.notification?.body?.takeIf { it.isNotBlank() }?.let { payload.putIfAbsent("body", it) }
        NativePushManager.showNotification(applicationContext, payload)
    }
}
