package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import com.google.firebase.messaging.FirebaseMessaging

/** Launcher bootstrap: pair account, start relay, then open the AI settings dashboard. */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (SecureDeviceTokenStore.read(this).isNullOrBlank()) {
            startActivity(Intent(this, WorklyAccountActivity::class.java))
            finish()
            return
        }

        val deviceToken = SecureDeviceTokenStore.read(this)
        if (!deviceToken.isNullOrBlank()) {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { fcmToken ->
                Thread { runCatching { VoiceRelayApi.registerFcmToken(deviceToken, fcmToken) } }.start()
            }
        }

        // Keep the website relay worker active; it is required for website voice processing.
        val relayIntent = Intent(this, VoiceRelayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(relayIntent) else startService(relayIntent)

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        }

        startActivity(Intent(this, SettingsActivity::class.java))
        finish()
        if (BuildConfig.FLAVOR == "direct") ChatWorkAppUpdater(this).checkForUpdate()
    }

    companion object { private const val REQUEST_NOTIFICATIONS = 2101 }
}
