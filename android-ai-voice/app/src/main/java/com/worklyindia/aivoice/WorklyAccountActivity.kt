package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.CheckBox
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
    private lateinit var workerOptIn: CheckBox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ChatWorkTheme.applyWindow(this)
        val bg = ChatWorkTheme.color(this, 0xFFF4F7FB.toInt())
        val ink = ChatWorkTheme.color(this, 0xFF142033.toInt())
        val muted = ChatWorkTheme.color(this, 0xFF65748B.toInt())
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(24), dp(24), dp(24), dp(24))
            setBackgroundColor(bg)
        }
        root.addView(TextView(this).apply { text = "WORKLY INDIA"; textSize = 13f; setTextColor(0xFF2878D0.toInt()) })
        root.addView(TextView(this).apply { text = "Connect your account"; textSize = 27f; setTextColor(ink); setPadding(0, dp(8), 0, dp(6)) })
        root.addView(TextView(this).apply { text = "Sign in with the same email or phone and password you use on Workly India."; textSize = 14f; setTextColor(muted) })
        identity = EditText(this).apply { hint = "Email address or phone (+country code)"; maxLines = 1; setTextColor(ink); setHintTextColor(muted); setBackgroundColor(ChatWorkTheme.color(this@WorklyAccountActivity, 0xFFFFFFFF.toInt())); setPadding(dp(12), dp(12), dp(12), dp(12)) }
        password = EditText(this).apply { hint = "Password"; maxLines = 1; inputType = 129; setTextColor(ink); setHintTextColor(muted); setBackgroundColor(ChatWorkTheme.color(this@WorklyAccountActivity, 0xFFFFFFFF.toInt())); setPadding(dp(12), dp(12), dp(12), dp(12)) }
        root.addView(identity, LinearLayout.LayoutParams(-1, dp(54)).apply { topMargin = dp(22) })
        root.addView(password, LinearLayout.LayoutParams(-1, dp(54)).apply { topMargin = dp(10) })
        root.addView(Button(this).apply {
            text = "Sign in and connect automatically"; isAllCaps = false
            setOnClickListener { signIn() }
        }, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(18) })
        root.addView(Button(this).apply {
            text = "Create a new account"; isAllCaps = false
            setOnClickListener { signUp() }
        }, LinearLayout.LayoutParams(-1, dp(48)).apply { topMargin = dp(8) })
        workerOptIn = CheckBox(this).apply {
            text = "Enable this phone as a community AI worker (optional). It may use battery, data and processing power. You can turn it off any time."
            isChecked = false
            textSize = 13f
            setTextColor(ink)
        }
        root.addView(workerOptIn, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
        status = TextView(this).apply { textSize = 13f; setTextColor(muted); setPadding(0, dp(12), 0, 0) }
        root.addView(status)
        setContentView(root)
    }


    private fun signUp() {
        val email = identity.text.toString().trim()
        val secret = password.text.toString()
        if (!email.contains("@")) {
            status.text = "For new accounts, enter an email address. Phone sign-up may require OTP verification."
            return
        }
        if (secret.length < 6) {
            status.text = "Use a password with at least 6 characters."
            return
        }
        status.text = "Creating your Workly India account…"
        worker.execute {
            try {
                val connection = (URL("${BuildConfig.SUPABASE_URL}/auth/v1/signup").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"; connectTimeout = 15000; readTimeout = 20000; doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                }
                val body = JSONObject().put("email", email).put("password", secret)
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                connection.disconnect()
                val result = JSONObject(raw.ifBlank { "{}" })
                if (code !in 200..299) {
                    throw IllegalStateException(result.optString("msg", result.optString("message", result.optString("error_description", "Account creation failed."))))
                }
                val accessToken = result.optString("access_token")
                val refreshToken = result.optString("refresh_token")
                if (accessToken.isBlank() || refreshToken.isBlank()) {
                    runOnUiThread { status.text = "Account created. Check your email to confirm it, then sign in here." }
                    return@execute
                }
                SecureDeviceTokenStore.saveAuthSession(this, accessToken, refreshToken)
                val deviceToken = VoiceRelayApi.registerDevice(accessToken, "ChatWork Android")
                SecureDeviceTokenStore.save(this, deviceToken)
                val capabilities = VoiceWorkerCapabilityRegistry.downloadedRelayCapabilities(this)
                VoiceRelayApi.setWorkerState(deviceToken, workerOptIn.isChecked, capabilities)
                runOnUiThread {
                    val relayIntent = Intent(this, VoiceRelayService::class.java)
                    if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(relayIntent) else startService(relayIntent)
                    startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
                    finish()
                }
            } catch (error: Exception) {
                runOnUiThread { status.text = error.message ?: "Could not create your account. Please try again." }
            }
        }
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
                val refreshToken = result.optString("refresh_token")
                if (accessToken.isBlank() || refreshToken.isBlank()) throw IllegalStateException("Workly sign-in did not return a valid session.")
                SecureDeviceTokenStore.saveAuthSession(this, accessToken, refreshToken)
                val deviceToken = VoiceRelayApi.registerDevice(accessToken, "ChatWork Android")
                SecureDeviceTokenStore.save(this, deviceToken)
                val capabilities = VoiceWorkerCapabilityRegistry.downloadedRelayCapabilities(this)
                VoiceRelayApi.setWorkerState(deviceToken, workerOptIn.isChecked, capabilities)
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
