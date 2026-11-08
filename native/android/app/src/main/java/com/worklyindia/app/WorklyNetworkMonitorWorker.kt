package com.worklyindia.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Low-cost background network-quality monitor.
 *
 * Android's link bandwidth is an estimate supplied by the active network,
 * not a measured speed test. No test payloads are downloaded.
 */
class WorklyNetworkMonitorWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    override fun doWork(): Result {
        val connectivity = applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivity.activeNetwork ?: return Result.success()
        val capabilities = connectivity.getNetworkCapabilities(network) ?: return Result.success()

        if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) ||
            !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        ) return Result.success()

        val downstreamKbps = capabilities.linkDownstreamBandwidthKbps
        val upstreamKbps = capabilities.linkUpstreamBandwidthKbps
        // Zero means Android has no estimate; do not mislabel it as a slow connection.
        if (downstreamKbps <= 0 || upstreamKbps <= 0) return Result.success()

        val isSlow = downstreamKbps < SLOW_DOWNSTREAM_KBPS || upstreamKbps < SLOW_UPSTREAM_KBPS
        val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val hasPreviousState = prefs.contains(KEY_WAS_SLOW)
        val wasSlow = prefs.getBoolean(KEY_WAS_SLOW, false)

        if (!hasPreviousState || isSlow != wasSlow) {
            prefs.edit().putBoolean(KEY_WAS_SLOW, isSlow).apply()
            if (isSlow) {
                showNetworkNotification(
                    title = "Slow Internet Connection Detected",
                    body = "Your internet connection is currently slow. Some Workly India features may take longer to load. Please check your network connection."
                )
            } else if (wasSlow) {
                showNetworkNotification(
                    title = "Your Internet Connection Is Back to Normal",
                    body = "Your network connection is stable again. You can now enjoy a smoother Workly India experience."
                )
            }
        }

        return Result.success()
    }

    private fun showNetworkNotification(title: String, body: String) {
        val context = applicationContext
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            manager.getNotificationChannel(CHANNEL_ID) == null
        ) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Network quality alerts", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Alerts when your internet connection becomes slow or recovers"
                    setShowBadge(false)
                }
            )
        }

        val openApp = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_workly)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }

    companion object {
        private const val PREFS = "workly_network_monitor"
        private const val KEY_WAS_SLOW = "was_slow"
        private const val CHANNEL_ID = "workly_network_quality_v1"
        private const val NOTIFICATION_ID = 4108
        private const val SLOW_DOWNSTREAM_KBPS = 512
        private const val SLOW_UPSTREAM_KBPS = 128
        private const val WORK_NAME = "workly-network-quality-monitor"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<WorklyNetworkMonitorWorker>(
                15, TimeUnit.MINUTES
            ).setConstraints(constraints).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
