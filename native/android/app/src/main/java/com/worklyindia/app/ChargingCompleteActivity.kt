package com.worklyindia.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.view.animation.AccelerateDecelerateInterpolator
import com.airbnb.lottie.LottieAnimationView
import com.airbnb.lottie.LottieDrawable

class ChargingCompleteActivity : Activity() {
    private val unplugReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: Intent?) {
            if (intent?.action == ACTION_CLOSE_ON_UNPLUG) {
                // The monitor service owns audio shutdown on the unplug edge.
                // Do not send a second asynchronous ACK that could race a rapid re-plug.
                finish()
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val filter = android.content.IntentFilter(ACTION_CLOSE_ON_UNPLUG)
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            registerReceiver(unplugReceiver, filter, android.content.Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(unplugReceiver, filter)
        }
    }

    override fun onResume() {
        super.onResume()
        // OEMs can delay or drop the close broadcast. Check the live battery
        // state as a second, independent dismissal path whenever this screen resumes.
        val battery = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val plugged = (battery?.getIntExtra(android.os.BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0
        val status = battery?.getIntExtra(android.os.BatteryManager.EXTRA_STATUS, -1)
            ?: android.os.BatteryManager.BATTERY_STATUS_UNKNOWN
        val charging = plugged && status != android.os.BatteryManager.BATTERY_STATUS_DISCHARGING
        if (!charging) {
            acknowledgeAlarm()
            finish()
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }
    }

    override fun onStop() {
        runCatching { unregisterReceiver(unplugReceiver) }
        super.onStop()
    }

    private val navy = Color.rgb(7, 17, 38)
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
        window.statusBarColor = navy
        window.navigationBarColor = navy
    }

    private fun renderAlert() {
        val density = resources.displayMetrics.density
        fun px(value: Int) = (value * density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(px(26), px(24), px(26), px(28))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(navy, Color.rgb(17, 48, 82), Color.rgb(8, 27, 51))
            )
        }

        val brand = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, px(42))
        }
        val logo = ImageView(this).apply {
            setImageResource(R.mipmap.ic_launcher)
            scaleType = ImageView.ScaleType.FIT_CENTER
            contentDescription = "Workly India app logo"
        }
        brand.addView(logo, LinearLayout.LayoutParams(px(48), px(48)))
        brand.addView(TextView(this).apply {
            text = "Workly India"
            textSize = 20f
            letterSpacing = 0.015f
            gravity = Gravity.CENTER
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.WHITE)
        }, LinearLayout.LayoutParams(-2, -2).apply { topMargin = px(8) })
        root.addView(brand)

        // Original battery ring + lightning bolt animation, with a transparent canvas.
        val icon = LottieAnimationView(this).apply {
            setAnimation(R.raw.battery_full_ring)
            repeatCount = LottieDrawable.INFINITE
            repeatMode = LottieDrawable.RESTART
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.TRANSPARENT)
            contentDescription = "Battery fully charged animation"
            alpha = 0f
            scaleX = 0.55f
            scaleY = 0.55f
        }
        root.addView(icon, LinearLayout.LayoutParams(px(164), px(164)).apply { bottomMargin = px(28) })

        root.addView(TextView(this).apply {
            text = "100% BATTERY"
            textSize = 14f
            letterSpacing = 0.22f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(133, 224, 197))
        })
        root.addView(TextView(this).apply {
            text = "Your battery is\nfully charged!"
            textSize = 29f
            gravity = Gravity.CENTER
            setTypeface(Typeface.SERIF, Typeface.BOLD)
            setTextColor(Color.WHITE)
            setPadding(0, px(18), 0, px(14))
        })
        root.addView(TextView(this).apply {
            text = "Your phone has reached 100% charge. You can unplug it now to help avoid leaving it connected longer than needed."
            textSize = 17f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(220, 230, 242))
            setLineSpacing(px(5).toFloat(), 1f)
            setPadding(px(3), 0, px(3), px(34))
        })

        val button = TextView(this).apply {
            text = "OK, GOT IT"
            textSize = 17f
            letterSpacing = 0.10f
            gravity = Gravity.CENTER
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.rgb(18, 160, 125))
                cornerRadius = px(28).toFloat()
            }
            elevation = px(5).toFloat()
            setPadding(px(24), px(21), px(24), px(21))
            setOnClickListener {
                acknowledgeAlarm()
                finish()
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            }
        }
        root.addView(button, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, -2))
        setContentView(root)

        icon.post {
            ObjectAnimator.ofPropertyValuesHolder(
                icon,
                PropertyValuesHolder.ofFloat(View.SCALE_X, 0.55f, 1.08f, 1f),
                PropertyValuesHolder.ofFloat(View.SCALE_Y, 0.55f, 1.08f, 1f),
                PropertyValuesHolder.ofFloat(View.ALPHA, 0f, 1f)
            ).apply {
                duration = 850
                interpolator = AccelerateDecelerateInterpolator()
                start()
            }
            icon.playAnimation()
        }
        root.alpha = 0f
        root.animate().alpha(1f).setDuration(420).start()
    }

    companion object {
        const val ACTION_CLOSE_ON_UNPLUG = "com.worklyindia.app.ACTION_CLOSE_BATTERY_SCREEN"
    }

    private fun acknowledgeAlarm() {
        val intent = Intent(this, ChargingMonitorService::class.java).apply {
            action = ChargingMonitorService.ACTION_ACKNOWLEDGE
        }
        runCatching { startService(intent) }
            .onFailure { android.util.Log.e("WorklyCharging", "Could not stop battery alarm", it) }
    }
}
