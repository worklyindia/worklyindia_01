package com.worklyindia.aivoice

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.util.WeakHashMap

/** Shared palette and edge-to-edge window handling for every native ChatWork screen. */
internal object ChatWorkTheme {
    private val basePadding = WeakHashMap<View, IntArray>()

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
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN)
        activity.window.statusBarColor = Color.TRANSPARENT
        activity.window.navigationBarColor = Color.TRANSPARENT
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            activity.window.isNavigationBarContrastEnforced = false
            activity.window.isStatusBarContrastEnforced = false
        }
        WindowCompat.getInsetsController(activity.window, activity.window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
        activity.window.decorView.setBackgroundColor(bar)
    }

    /**
     * Android 15+ enforces edge-to-edge for targetSdk 35+. Apply safe insets to
     * the Activity content host after setContentView, not before onCreate.
     * This keeps headers, text fields and buttons below system bars on every
     * current and future Activity while preserving the full-screen background.
     */
    fun applyContentInsets(activity: Activity) {
        val content = activity.findViewById<View>(android.R.id.content) ?: return
        fun hideHorizontalScrollbars(view: View) {
            view.isHorizontalScrollBarEnabled = false
            if (view is ViewGroup) {
                for (index in 0 until view.childCount) hideHorizontalScrollbars(view.getChildAt(index))
            }
        }
        hideHorizontalScrollbars(content)
        if (!basePadding.containsKey(content)) {
            basePadding[content] = intArrayOf(
                content.paddingLeft, content.paddingTop,
                content.paddingRight, content.paddingBottom
            )
        }
        val initial = basePadding[content] ?: return
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(
                initial[0] + bars.left,
                initial[1] + bars.top,
                initial[2] + bars.right,
                initial[3] + bars.bottom
            )
            insets
        }
        ViewCompat.requestApplyInsets(content)
    }
}
