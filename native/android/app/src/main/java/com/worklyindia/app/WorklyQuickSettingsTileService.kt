package com.worklyindia.app

import android.content.Intent
import android.graphics.drawable.Icon
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
            subtitle = "Open Workly India"
            icon = Icon.createWithResource(this@WorklyQuickSettingsTileService, R.drawable.ic_workly_launcher)
            state = Tile.STATE_INACTIVE
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            ?: Intent(this, MainActivity::class.java)
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        startActivityAndCollapse(launchIntent)
    }
}
