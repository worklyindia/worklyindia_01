package com.worklyindia.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** Notifications are emitted only when MainActivity's foreground network callback invokes this. */
object WorklyForegroundNetworkAlerts {
    private const val PREFS = "workly_foreground_network_alerts"
    private const val KEY_WAS_SLOW = "was_slow"
    private const val CHANNEL_ID = "workly_network_quality_foreground"
    private const val NOTIFICATION_ID = 4110
    private const val SLOW_DOWNSTREAM_KBPS = 512
    private const val SLOW_UPSTREAM_KBPS = 128

    fun onBandwidthChanged(context: Context, downstreamKbps: Int, upstreamKbps: Int) {
        // Android may report 0 when it has no estimate. Never treat unknown as slow.
        if (downstreamKbps <= 0 || upstreamKbps <= 0) return
        val isSlow = downstreamKbps < SLOW_DOWNSTREAM_KBPS || upstreamKbps < SLOW_UPSTREAM_KBPS
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val hasPrevious = prefs.contains(KEY_WAS_SLOW)
        val wasSlow = prefs.getBoolean(KEY_WAS_SLOW, false)
        if (hasPrevious && isSlow == wasSlow) return
        prefs.edit().putBoolean(KEY_WAS_SLOW, isSlow).apply()

        if (!hasPrevious && !isSlow) return
        if (isSlow) {
            show(context, "Slow Internet Connection Detected",
                "Your internet connection is currently slow. Some Workly India features may take longer to load. Please check your network connection.")
        } else if (wasSlow) {
            show(context, "Your Internet Connection Is Back to Normal",
                "Your network connection is stable again. You can now enjoy a smoother Workly India experience.")
        }
    }

    private fun show(context: Context, title: String, body: String) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Network quality alerts", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Slow internet and connection recovery alerts while Workly India is open"
                    setShowBadge(false)
                }
            )
        }
        val pending = PendingIntent.getActivity(
            context, NOTIFICATION_ID,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        NotificationManagerCompat.from(context).notify(
            NOTIFICATION_ID,
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_workly)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()
        )
    }
}
