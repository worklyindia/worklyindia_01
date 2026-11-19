package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Signs in with the same Supabase Auth account used by Workly India, then registers this phone. */
class WorklyAccountActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var identity: EditText
    private lateinit var password: EditText
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(24), dp(24), dp(24), dp(24))
            setBackgroundColor(0xFFF4F7FB.toInt())
        }
        root.addView(TextView(this).apply { text = "WORKLY INDIA"; textSize = 13f; setTextColor(0xFF2878D0.toInt()) })
        root.addView(TextView(this).apply { text = "Connect your account"; textSize = 27f; setTextColor(0xFF142033.toInt()); setPadding(0, dp(8), 0, dp(6)) })
        root.addView(TextView(this).apply { text = "Sign in with the same email or phone and password you use on Workly India."; textSize = 14f; setTextColor(0xFF65748B.toInt()) })
        identity = EditText(this).apply { hint = "Email address or phone (+country code)"; maxLines = 1; setPadding(dp(12), dp(12), dp(12), dp(12)) }
        password = EditText(this).apply { hint = "Password"; maxLines = 1; inputType = 129; setPadding(dp(12), dp(12), dp(12), dp(12)) }
        root.addView(identity, LinearLayout.LayoutParams(-1, dp(54)).apply { topMargin = dp(22) })
        root.addView(password, LinearLayout.LayoutParams(-1, dp(54)).apply { topMargin = dp(10) })
        root.addView(Button(this).apply {
            text = "Sign in and connect automatically"; isAllCaps = false
            setOnClickListener { signIn() }
        }, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(18) })
        status = TextView(this).apply { textSize = 13f; setTextColor(0xFF65748B.toInt()); setPadding(0, dp(12), 0, 0) }
        root.addView(status)
        setContentView(root)
    }

    private fun signIn() {
        val id = identity.text.toString().trim()
        val secret = password.text.toString()
        if (id.isBlank() || secret.isBlank()) { status.text = "Enter your Workly India login details."; return }
        status.text = "Signing in securely…"
        worker.execute {
            try {
                val url = URL("${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=password")
                val connection = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"; connectTimeout = 15000; readTimeout = 20000; doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                }
                val body = JSONObject().put(if (id.contains("@")) "email" else "phone", id).put("password", secret)
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                connection.disconnect()
                val result = JSONObject(raw.ifBlank { "{}" })
                if (code !in 200..299) throw IllegalStateException(result.optString("msg", result.optString("message", result.optString("error_description", "Sign in failed. Check your details."))))
                val accessToken = result.optString("access_token")
                if (accessToken.isBlank()) throw IllegalStateException("Workly sign-in did not return a valid session.")
                val deviceToken = VoiceRelayApi.registerDevice(accessToken, "Workly Voice Android")
                SecureDeviceTokenStore.save(this, deviceToken)
                runOnUiThread {
                    val relayIntent = Intent(this, VoiceRelayService::class.java)
                    if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(relayIntent) else startService(relayIntent)
                    startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
                    finish()
                }
            } catch (error: Exception) {
                runOnUiThread { status.text = error.message ?: "Could not connect. Please try again." }
            }
        }
    }

    override fun onDestroy() { worker.shutdown(); super.onDestroy() }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
