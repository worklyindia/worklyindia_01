package com.worklyindia.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.widget.LinearLayout
import android.widget.TextView
import android.view.ViewGroup

class ChargingCompleteActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        renderAlert()
    }

    private fun showOverLockScreen() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
        window.statusBarColor = Color.rgb(7, 17, 38)
        window.navigationBarColor = Color.rgb(7, 17, 38)
    }

    private fun renderAlert() {
        val density = resources.displayMetrics.density
        fun px(value: Int) = (value * density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(px(28), px(34), px(28), px(30))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.rgb(7, 17, 38), Color.rgb(18, 45, 79), Color.rgb(8, 27, 51))
            )
        }
        val icon = TextView(this).apply {
            text = "✓"
            textSize = 46f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.rgb(28, 174, 132))
            }
            layoutParams = LinearLayout.LayoutParams(px(104), px(104)).apply { bottomMargin = px(28) }
        }
        root.addView(icon)
        root.addView(TextView(this).apply {
            text = "100% BATTERY"
            textSize = 14f
            letterSpacing = 0.18f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(133, 224, 197))
        })
        root.addView(TextView(this).apply {
            text = "Your battery is fully charged!"
            textSize = 28f
            gravity = Gravity.CENTER
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.WHITE)
            setPadding(0, px(14), 0, px(12))
        })
        root.addView(TextView(this).apply {
            text = "Your phone has reached 100% charge. You can unplug it now to help avoid leaving it connected longer than needed."
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(220, 230, 242))
            setLineSpacing(px(5).toFloat(), 1f)
            setPadding(px(4), 0, px(4), px(30))
        })
        val button = TextView(this).apply {
            text = "OK, GOT IT"
            textSize = 16f
            letterSpacing = 0.08f
            gravity = Gravity.CENTER
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.rgb(18, 160, 125))
                cornerRadius = px(18).toFloat()
            }
            setPadding(px(24), px(18), px(24), px(18))
            setOnClickListener {
                acknowledgeAlarm()
                finish()
            }
        }
        root.addView(button, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, -2))
        setContentView(root)
    }

    private fun acknowledgeAlarm() {
        val intent = Intent(this, ChargingMonitorService::class.java).apply {
            action = ChargingMonitorService.ACTION_ACKNOWLEDGE
        }
        runCatching { startService(intent) }
            .onFailure { android.util.Log.e("WorklyCharging", "Could not stop battery alarm", it) }
    }
}
