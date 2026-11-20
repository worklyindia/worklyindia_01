package com.worklyindia.aivoice

import android.app.Activity
import android.content.res.Configuration
import android.os.Build
import android.view.View

/** Shared light/dark palette for every native ChatWork screen. */
internal object ChatWorkTheme {
    fun isDark(activity: Activity): Boolean =
        (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    fun color(activity: Activity, lightColor: Int): Int {
        if (!isDark(activity)) return lightColor
        return when (lightColor) {
            0xFFF4F7FB.toInt(), 0xFFF4F7FF.toInt(), 0xFFFFFFFF.toInt(), 0xFFE5EAF1.toInt(),
            0xFFE8EDF4.toInt(), 0xFFD8E0EA.toInt() -> 0xFF1B293B.toInt()
            0xFF142033.toInt(), 0xFF26364B.toInt() -> 0xFFE8EEF7.toInt()
            0xFF65748B.toInt(), 0xFF536276.toInt(), 0xFF8491A3.toInt() -> 0xFFB5C1D1.toInt()
            else -> lightColor
        }
    }

    fun applyWindow(activity: Activity) {
        val dark = isDark(activity)
        val bar = if (dark) 0xFF101827.toInt() else 0xFFF4F7FB.toInt()
        activity.window.statusBarColor = bar
        activity.window.navigationBarColor = bar
        if (Build.VERSION.SDK_INT >= 29) {
            activity.window.isNavigationBarContrastEnforced = false
            activity.window.isStatusBarContrastEnforced = false
        }
        @Suppress("DEPRECATION")
        activity.window.decorView.systemUiVisibility = if (dark) 0 else
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
    }
}
