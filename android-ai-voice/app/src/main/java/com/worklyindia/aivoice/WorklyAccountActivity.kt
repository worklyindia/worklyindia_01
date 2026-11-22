package com.worklyindia.aivoice

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.text.InputType
import android.text.TextWatcher
import android.text.Editable
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Native Workly account screens backed by the same Supabase Auth account as Workly India. */
class WorklyAccountActivity : Activity() {
    private enum class Screen { LOGIN, SIGNUP, SIGNUP_OTP, FORGOT_EMAIL, FORGOT_OTP, RESET_PASSWORD }

    private val worker = Executors.newSingleThreadExecutor()
    private var screen = Screen.LOGIN
    private var emailValue = ""
    private var passwordValue = ""
    private var otpValue = ""
    private var newPasswordValue = ""
    private var recoveryAccessToken = ""
    private var workerEnabled = false

    private lateinit var status: TextView
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var otpInput: EditText
    private lateinit var newPasswordInput: EditText
    private lateinit var workerOptIn: CheckBox

    private val ink get() = ChatWorkTheme.color(this, 0xFF142033.toInt())
    private val muted get() = ChatWorkTheme.color(this, 0xFF65748B.toInt())
    private val surface get() = ChatWorkTheme.color(this, 0xFFFFFFFF.toInt())
    private val page get() = ChatWorkTheme.color(this, 0xFFF4F7FB.toInt())
    private val line get() = ChatWorkTheme.color(this, 0xFFE5EAF1.toInt())
    private val blue = 0xFF2878D0.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ChatWorkTheme.applyWindow(this)
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        render()
    }

    private fun render(message: String? = null) {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(page)
            setPadding(dp(20), dp(22), dp(20), dp(24))
            gravity = Gravity.CENTER_HORIZONTAL
        }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            addView(root, android.widget.FrameLayout.LayoutParams(-1, -2))
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }
        root.addView(content, LinearLayout.LayoutParams(-1, -2).apply {
            width = -1
            gravity = Gravity.CENTER_HORIZONTAL
        })

        content.addView(TextView(this).apply {
            text = "WORKLY INDIA"
            textSize = 13f
            letterSpacing = 0.12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(blue)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(8) })

        content.addView(TextView(this).apply {
            text = "ChatWork"
            textSize = 29f
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setTextColor(ink)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, -2))

        content.addView(TextView(this).apply {
            text = "Connect securely with your Workly India account"
            textSize = 14f
            setTextColor(muted)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(6)
            bottomMargin = dp(22)
        })

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(22), dp(20), dp(20))
            background = rounded(surface, dp(22), line, dp(1))
        }
        content.addView(card, LinearLayout.LayoutParams(-1, -2))

        val heading = when (screen) {
            Screen.LOGIN -> "Welcome back"
            Screen.SIGNUP -> "Create your account"
            Screen.SIGNUP_OTP -> "Verify your email"
            Screen.FORGOT_EMAIL -> "Reset your password"
            Screen.FORGOT_OTP -> "Enter verification code"
            Screen.RESET_PASSWORD -> "Create a new password"
        }
        val description = when (screen) {
            Screen.LOGIN -> "Sign in with your email and password. No login OTP."
            Screen.SIGNUP -> "Use your email address and create a secure password."
            Screen.SIGNUP_OTP -> "Enter the verification code sent to your email address."
            Screen.FORGOT_EMAIL -> "We’ll send a password recovery code to your email."
            Screen.FORGOT_OTP -> "Check your inbox and enter the recovery code."
            Screen.RESET_PASSWORD -> "Choose a new password for your Workly India account."
        }
        card.addView(TextView(this).apply {
            text = heading
            textSize = 23f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(ink)
        })
        card.addView(TextView(this).apply {
            text = description
            textSize = 14f
            setTextColor(muted)
        }, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(7)
            bottomMargin = dp(20)
        })

        when (screen) {
            Screen.LOGIN -> {
                addEmailField(card)
                addPasswordField(card, "Password")
                textAction(card, "Forgot password?") { capture(); screen = Screen.FORGOT_EMAIL; render() }
                primaryAction(card, "Sign in") { capture(); signIn() }
                textAction(card, "Create a new account") { capture(); screen = Screen.SIGNUP; render() }
                addWorkerOption(card)
            }
            Screen.SIGNUP -> {
                addEmailField(card)
                addPasswordField(card, "Create password")
                primaryAction(card, "Create account") { capture(); signUp() }
                textAction(card, "Already have an account? Sign in") { capture(); screen = Screen.LOGIN; render() }
            }
            Screen.SIGNUP_OTP -> {
                addEmailField(card, editable = false)
                addOtpField(card)
                primaryAction(card, "Verify email") { capture(); verifySignupOtp() }
                textAction(card, "Back to sign in") { screen = Screen.LOGIN; render() }
            }
            Screen.FORGOT_EMAIL -> {
                addEmailField(card)
                primaryAction(card, "Send recovery code") { capture(); sendRecoveryCode() }
                textAction(card, "Back to sign in") { screen = Screen.LOGIN; render() }
            }
            Screen.FORGOT_OTP -> {
                addEmailField(card, editable = false)
                addOtpField(card)
                primaryAction(card, "Verify code") { capture(); verifyRecoveryOtp() }
                textAction(card, "Back to sign in") { screen = Screen.LOGIN; render() }
            }
            Screen.RESET_PASSWORD -> {
                addPasswordField(card, "New password", newPassword = true)
                primaryAction(card, "Update password") { capture(); updatePassword() }
                textAction(card, "Cancel") { screen = Screen.LOGIN; render() }
            }
        }

        status = TextView(this).apply {
            textSize = 13f
            setTextColor(muted)
            gravity = Gravity.CENTER
            setPadding(dp(4), dp(14), dp(4), 0)
            text = message.orEmpty()
        }
        card.addView(status, LinearLayout.LayoutParams(-1, -2))

        setContentView(scroll)
    }

    private fun addEmailField(parent: LinearLayout, editable: Boolean = true) {
        addLabel(parent, "Email address")
        emailInput = field("name@example.com", emailValue, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS).apply {
            isEnabled = editable
            imeOptions = EditorInfo.IME_ACTION_NEXT
        }
        parent.addView(emailInput, fieldParams())
        watch(emailInput) { emailValue = it }
    }

    private fun addPasswordField(parent: LinearLayout, hint: String, newPassword: Boolean = false) {
        addLabel(parent, if (newPassword) "New password" else "Password")
        val value = if (newPassword) newPasswordValue else passwordValue
        val input = field(hint, value, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD).apply {
            imeOptions = EditorInfo.IME_ACTION_DONE
        }
        if (newPassword) {
            newPasswordInput = input
            watch(input) { newPasswordValue = it }
        } else {
            passwordInput = input
            watch(input) { passwordValue = it }
        }
        parent.addView(input, fieldParams())
    }

    private fun addOtpField(parent: LinearLayout) {
        addLabel(parent, "6-digit code")
        otpInput = field("Enter email code", otpValue, InputType.TYPE_CLASS_NUMBER).apply {
            maxLengthCompat(6)
            imeOptions = EditorInfo.IME_ACTION_DONE
        }
        parent.addView(otpInput, fieldParams())
        watch(otpInput) { otpValue = it }
    }

    private fun addLabel(parent: LinearLayout, value: String) {
        parent.addView(TextView(this).apply {
            text = value
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(ink)
        }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(7) })
    }

    private fun field(hintText: String, value: String, type: Int): EditText =
        EditText(this).apply {
            hint = hintText
            setText(value)
            inputType = type
            textSize = 15f
            setSingleLine(true)
            setTextColor(ink)
            setHintTextColor(muted)
            setPadding(dp(14), 0, dp(14), 0)
            background = rounded(page, dp(12), line, dp(1))
        }

    private fun EditText.maxLengthCompat(length: Int) {
        filters = arrayOf(android.text.InputFilter.LengthFilter(length))
    }

    private fun watch(input: EditText, changed: (String) -> Unit) {
        input.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                changed(s?.toString().orEmpty())
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
    }

    private fun fieldParams() = LinearLayout.LayoutParams(-1, dp(54)).apply { bottomMargin = dp(15) }

    private fun primaryAction(parent: LinearLayout, label: String, action: () -> Unit) {
        parent.addView(Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(0xFFFFFFFF.toInt())
            background = rounded(blue, dp(13))
            setOnClickListener { hideKeyboard(); action() }
        }, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(5); bottomMargin = dp(8) })
    }

    private fun textAction(parent: LinearLayout, label: String, action: () -> Unit) {
        parent.addView(TextView(this).apply {
            text = label
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(blue)
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(13), dp(8), dp(13))
            setOnClickListener { hideKeyboard(); action() }
        }, LinearLayout.LayoutParams(-1, -2))
    }

    private fun addWorkerOption(parent: LinearLayout) {
        workerOptIn = CheckBox(this).apply {
            text = "Allow this phone to process other users’ text or audio using downloaded models. This is optional and may use battery, data and processing power."
            isChecked = workerEnabled
            textSize = 12f
            setTextColor(muted)
            setPadding(0, dp(4), 0, 0)
            setOnCheckedChangeListener { _, checked -> workerEnabled = checked }
        }
        parent.addView(workerOptIn, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) })
    }

    private fun capture() {
        if (::emailInput.isInitialized) emailValue = emailInput.text.toString().trim()
        if (::passwordInput.isInitialized) passwordValue = passwordInput.text.toString()
        if (::otpInput.isInitialized) otpValue = otpInput.text.toString().trim()
        if (::newPasswordInput.isInitialized) newPasswordValue = newPasswordInput.text.toString()
    }

    private fun signIn() {
        val email = emailValue.trim()
        val secret = passwordValue
        if (!email.contains("@") || secret.isBlank()) {
            render("Enter a valid email address and password.")
            return
        }
        runRequest("Signing in…") {
            val result = authRequest("POST", "/auth/v1/token?grant_type=password",
                JSONObject().put("email", email).put("password", secret))
            val access = result.optString("access_token")
            val refresh = result.optString("refresh_token")
            if (access.isBlank() || refresh.isBlank()) error("Sign in did not return a valid session.")
            connectAndOpen(access, refresh)
        }
    }

    private fun signUp() {
        val email = emailValue.trim()
        val secret = passwordValue
        if (!email.contains("@")) { render("Enter a valid email address."); return }
        if (secret.length < 6) { render("Use a password with at least 6 characters."); return }
        runRequest("Creating your account…") {
            val result = authRequest("POST", "/auth/v1/signup",
                JSONObject().put("email", email).put("password", secret))
            val access = result.optString("access_token")
            val refresh = result.optString("refresh_token")
            if (access.isNotBlank() && refresh.isNotBlank()) {
                connectAndOpen(access, refresh)
            } else {
                runOnUiThread {
                    otpValue = ""
                    screen = Screen.SIGNUP_OTP
                    render("A verification code was requested. Check your email.")
                }
            }
        }
    }

    private fun verifySignupOtp() {
        val email = emailValue.trim()
        val code = otpValue.trim()
        if (code.length != 6) { render("Enter the 6-digit code from your email."); return }
        runRequest("Verifying email…") {
            val result = authRequest("POST", "/auth/v1/verify",
                JSONObject().put("email", email).put("token", code).put("type", "signup"))
            val access = result.optString("access_token")
            val refresh = result.optString("refresh_token")
            if (access.isNotBlank() && refresh.isNotBlank()) connectAndOpen(access, refresh)
            else runOnUiThread {
                screen = Screen.LOGIN
                passwordValue = ""
                render("Email verified. Sign in with your email and password.")
            }
        }
    }

    private fun sendRecoveryCode() {
        val email = emailValue.trim()
        if (!email.contains("@")) { render("Enter the email address on your account."); return }
        runRequest("Sending recovery code…") {
            authRequest("POST", "/auth/v1/recover", JSONObject().put("email", email))
            runOnUiThread {
                otpValue = ""
                screen = Screen.FORGOT_OTP
                render("If this email belongs to an account, a recovery code has been sent.")
            }
        }
    }

    private fun verifyRecoveryOtp() {
        val email = emailValue.trim()
        val code = otpValue.trim()
        if (code.length != 6) { render("Enter the 6-digit recovery code."); return }
        runRequest("Verifying recovery code…") {
            val result = authRequest("POST", "/auth/v1/verify",
                JSONObject().put("email", email).put("token", code).put("type", "recovery"))
            recoveryAccessToken = result.optString("access_token")
            if (recoveryAccessToken.isBlank()) error("Recovery verification did not return a valid session.")
            runOnUiThread {
                newPasswordValue = ""
                screen = Screen.RESET_PASSWORD
                render("Code verified. Set your new password.")
            }
        }
    }

    private fun updatePassword() {
        val secret = newPasswordValue
        if (secret.length < 6) { render("Use a new password with at least 6 characters."); return }
        runRequest("Updating password…") {
            authRequest("PUT", "/auth/v1/user", JSONObject().put("password", secret), recoveryAccessToken)
            recoveryAccessToken = ""
            passwordValue = ""
            newPasswordValue = ""
            runOnUiThread {
                screen = Screen.LOGIN
                render("Password updated successfully. Sign in with your new password.")
            }
        }
    }

    private fun runRequest(progress: String, work: () -> Unit) {
        render(progress)
        worker.execute {
            try {
                work()
            } catch (error: Exception) {
                runOnUiThread { render(error.message ?: "Something went wrong. Please try again.") }
            }
        }
    }

    private fun authRequest(method: String, path: String, body: JSONObject, bearer: String? = null): JSONObject {
        val connection = (URL(BuildConfig.SUPABASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 20000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
            if (!bearer.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $bearer")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val result = if (raw.isBlank()) JSONObject() else JSONObject(raw)
            if (code !in 200..299) {
                val message = result.optString("msg").ifBlank {
                    result.optString("message").ifBlank {
                        result.optString("error_description").ifBlank { result.optString("error") }
                    }
                }
                throw IllegalStateException(message.ifBlank { "Supabase authentication failed (HTTP $code)." })
            }
            return result
        } finally {
            connection.disconnect()
        }
    }

    private fun connectAndOpen(accessToken: String, refreshToken: String) {
        SecureDeviceTokenStore.saveAuthSession(this, accessToken, refreshToken)
        val deviceToken = VoiceRelayApi.registerDevice(accessToken, "ChatWork Android")
        SecureDeviceTokenStore.save(this, deviceToken)
        var workerSetupFailed = false
        if (workerEnabled) {
            try {
                val capabilities = VoiceWorkerCapabilityRegistry.downloadedRelayCapabilities(this)
                VoiceRelayApi.setWorkerState(deviceToken, true, capabilities)
            } catch (_: Exception) {
                // Community worker mode is optional. A relay preference failure must
                // never block a valid Workly account sign-in.
                workerEnabled = false
                workerSetupFailed = true
            }
        }
        getSharedPreferences(VoiceWorkerCapabilityRegistry.WORKER_PREFS, MODE_PRIVATE).edit()
            .putBoolean(VoiceWorkerCapabilityRegistry.WORKER_ENABLED_KEY, workerEnabled).apply()
        runOnUiThread {
            val relayIntent = Intent(this, VoiceRelayService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(relayIntent) else startService(relayIntent)
            if (workerSetupFailed) {
                android.widget.Toast.makeText(this, "Signed in. Optional worker mode could not be enabled.", android.widget.Toast.LENGTH_LONG).show()
            }
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
            finish()
        }
    }

    private fun hideKeyboard() {
        (getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)
            ?.hideSoftInputFromWindow(window.decorView.windowToken, 0)
    }

    private fun rounded(fill: Int, radius: Int, stroke: Int? = null, strokeWidth: Int = 0) =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius.toFloat()
            if (stroke != null && strokeWidth > 0) setStroke(strokeWidth, stroke)
        }

    override fun onDestroy() {
        worker.shutdown()
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
