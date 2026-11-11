package com.worklyindia.app

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.os.Bundle
import android.widget.Toast

/**
 * Receives PackageInstaller status callbacks for the in-app APK updater.
 * The system's confirmation UI is always shown when required; this activity
 * never attempts to silently install or grant permissions.
 */
class PackageInstallStatusActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleStatus(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleStatus(intent)
    }

    private fun handleStatus(callback: Intent?) {
        if (callback == null) {
            finish()
            return
        }

        when (callback.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirmation = if (Build.VERSION.SDK_INT >= 33) {
                    callback.getParcelableExtra(PackageInstaller.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    callback.getParcelableExtra<Intent>(PackageInstaller.EXTRA_INTENT)
                }
                if (confirmation != null) {
                    try {
                        startActivity(confirmation)
                    } catch (error: Exception) {
                        Toast.makeText(this, "Please complete the Android update confirmation.", Toast.LENGTH_LONG).show()
                    }
                } else {
                    Toast.makeText(this, "Android did not provide the update confirmation screen.", Toast.LENGTH_LONG).show()
                }
                finish()
            }
            PackageInstaller.STATUS_SUCCESS -> {
                Toast.makeText(this, "Workly India updated successfully.", Toast.LENGTH_SHORT).show()
                finish()
            }
            else -> {
                val message = callback.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                    ?.takeIf { it.isNotBlank() }
                    ?: "Workly India update could not be installed."
                Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                android.util.Log.e("WorklyAppUpdate", "PackageInstaller failed: $message")
                finish()
            }
        }
    }
}
