package com.worklyindia.aivoice

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/** Restores the persistent server notification if an OEM shade allows it to be swiped away. */
class VoiceRelayNotificationRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != VoiceRelayService.ACTION_RESTORE_NOTIFICATION) return
        val serviceIntent = Intent(context, VoiceRelayService::class.java)
            .setAction(VoiceRelayService.ACTION_RESTORE_NOTIFICATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
