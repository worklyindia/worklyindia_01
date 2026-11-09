package com.worklyindia.app

import android.app.PendingIntent
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * User-addable Quick Settings shortcut for opening Workly India.
 * Android does not allow third-party apps to replace system Mobile Data/Wi-Fi tiles.
 */
class WorklyQuickSettingsTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            label = "Workly India"
            subtitle = "Open app"
            icon = Icon.createWithResource(this@WorklyQuickSettingsTileService, R.drawable.ic_workly_quick_settings)
            // This is a launch shortcut, not a toggle. Keep it available and tappable.
            state = Tile.STATE_INACTIVE
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()

        // Use an explicit launch target so Android/OEM launchers cannot resolve
        // this shortcut to the website or another activity.
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // Android 14+ expects the PendingIntent overload for QS tile launches.
                val pendingIntent = PendingIntent.getActivity(
                    this,
                    0,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                startActivityAndCollapse(pendingIntent)
            } else {
                @Suppress("DEPRECATION")
                startActivityAndCollapse(launchIntent)
            }
        } catch (error: Exception) {
            android.util.Log.e("WorklyQuickTile", "Quick Settings tap could not launch Workly India", error)
            // Fallback for OEM implementations that reject the collapse launch API.
            runCatching { startActivity(launchIntent) }
                .onFailure { fallbackError ->
                    android.util.Log.e("WorklyQuickTile", "Fallback app launch also failed", fallbackError)
                }
        }
    }
}
