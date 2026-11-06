package com.worklyindia.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class NativeSession(val accessToken: String, val refreshToken: String, val userId: String, val email: String)

object NativeAuth {
    private const val BASE = "https://jubwzelupbntbetpajqb.supabase.co"
    private const val KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
    private const val ALIAS = "workly_native_session_key"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(
            ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true).build())
        return generator.generateKey()
    }

    private fun save(context: Context, session: NativeSession?) {
        val prefs = context.getSharedPreferences("native_auth", Context.MODE_PRIVATE)
        if (session == null) { prefs.edit().clear().apply(); return }
        val plain = JSONObject().put("access", session.accessToken).put("refresh", session.refreshToken)
            .put("id", session.userId).put("email", session.email).toString().toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(plain)
        prefs.edit().putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString("data", Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
    }

    fun session(context: Context): NativeSession? = runCatching {
        val p = context.getSharedPreferences("native_auth", Context.MODE_PRIVATE)
        val iv = Base64.decode(p.getString("iv", null) ?: return null, Base64.NO_WRAP)
        val data = Base64.decode(p.getString("data", null) ?: return null, Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        val j = JSONObject(String(cipher.doFinal(data), Charsets.UTF_8))
        NativeSession(j.getString("access"), j.getString("refresh"), j.getString("id"), j.optString("email"))
    }.getOrNull()

    suspend fun signIn(context: Context, identifier: String, password: String): NativeSession = withContext(Dispatchers.IO) {
        val clean = identifier.trim().replace(Regex("[\\u200B-\\u200D\\uFEFF\\u00AD\\u200E\\u200F]"), "")
        val digits = clean.filter { it.isDigit() }
        val isPhone = !clean.contains("@") && digits.length in 10..15 && clean.all { it.isDigit() || it in "+ ()-" }
        val j = if (isPhone) {
            // Workly website resolves mobile credentials through the same secured Edge Function.
            val normalizedPhone = if (digits.length == 10) "91$digits" else digits
            request("POST", "/functions/v1/unified-ai-tricks",
                JSONObject().put("action", "phone_password_login").put("phone", normalizedPhone).put("password", password))
        } else {
            request("POST", "/auth/v1/token?grant_type=password",
                JSONObject().put("email", clean.lowercase()).put("password", password))
        }
        val s = NativeSession(j.getString("access_token"), j.getString("refresh_token"),
            j.getJSONObject("user").getString("id"), j.getJSONObject("user").optString("email", identifier))
        save(context, s); s
    }

    suspend fun checkLogin2FA(email: String, userType: String): JSONObject = withContext(Dispatchers.IO) {
        request("POST", "/functions/v1/unified-2fa",
            JSONObject().put("action", "check-login").put("email", email.trim().lowercase()).put("userType", userType))
    }

    suspend fun sendLoginOtp(userId: String, userType: String, method: String): JSONObject = withContext(Dispatchers.IO) {
        val action = if (method == "telegram") "send-telegram-otp" else "send-email-otp"
        request("POST", "/functions/v1/unified-2fa",
            JSONObject().put("action", action).put("userId", userId).put("userType", userType))
    }

    suspend fun verifyLoginOtp(userId: String, userType: String, method: String, code: String): Boolean = withContext(Dispatchers.IO) {
        val action = if (method == "telegram") "verify-telegram-otp" else "verify-email-otp"
        val result = request("POST", "/functions/v1/unified-2fa",
            JSONObject().put("action", action).put("userId", userId).put("userType", userType).put("code", code.trim()))
        result.optBoolean("verified", false)
    }

    suspend fun verifyLoginTotp(userId: String, userType: String, code: String): Boolean = withContext(Dispatchers.IO) {
        val result = request("POST", "/functions/v1/unified-totp",
            JSONObject().put("action", "verify-login").put("userId", userId).put("userType", userType).put("token", code.trim()))
        result.optBoolean("verified", false) || result.optBoolean("success", false)
    }

    suspend fun resetPassword(email: String, userType: String) = withContext(Dispatchers.IO) {
        val redirect = if (userType == "employer") "https://worklyindia.devs.surf/employer-auth?type=recovery" else "https://worklyindia.devs.surf/reset-password"
        request("POST", "/auth/v1/recover",
            JSONObject().put("email", email.trim().lowercase()).put("redirect_to", redirect))
    }

    suspend fun signUp(context: Context, email: String, password: String, name: String): NativeSession? = withContext(Dispatchers.IO) {
        val j = request("POST", "/auth/v1/signup",
            JSONObject().put("email", email.trim()).put("password", password)
                .put("data", JSONObject().put("full_name", name.trim()).put("display_name", name.trim())))
        val user = j.optJSONObject("user") ?: j
        val access = j.optString("access_token")
        val refresh = j.optString("refresh_token")
        val id = user.optString("id")
        if (access.isBlank() || refresh.isBlank() || id.isBlank()) return@withContext null
        val s = NativeSession(access, refresh, id, user.optString("email", email))
        save(context, s)
        ensureProfile(s, name)
        s
    }

    suspend fun refresh(context: Context): NativeSession? = withContext(Dispatchers.IO) {
        val old = session(context) ?: return@withContext null
        try {
            val j = request("POST", "/auth/v1/token?grant_type=refresh_token",
                JSONObject().put("refresh_token", old.refreshToken))
            val user = j.optJSONObject("user")
            val s = NativeSession(j.getString("access_token"), j.getString("refresh_token"),
                user?.optString("id")?.takeIf { it.isNotBlank() } ?: old.userId,
                user?.optString("email") ?: old.email)
            save(context, s); s
        } catch (_: Exception) { save(context, null); null }
    }

    suspend fun ensureProfile(session: NativeSession, name: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().put("user_id", session.userId).put("full_name", name)
            .put("email", session.email)
        request("POST", "/rest/v1/profiles?on_conflict=user_id",
            body, session.accessToken, mapOf("Prefer" to "resolution=merge-duplicates,return=minimal"))
    }

    suspend fun apply(context: Context, jobId: String, employerId: String, coverLetter: String = ""): Boolean = withContext(Dispatchers.IO) {
        val s = session(context) ?: throw IllegalStateException("Pehle login karein.")
        request("POST", "/rest/v1/job_applications",
            JSONObject().put("job_id", jobId).put("applicant_id", s.userId)
                .put("employer_id", employerId).put("cover_letter", coverLetter), s.accessToken,
            mapOf("Prefer" to "return=minimal"))
        true
    }

    fun signOut(context: Context) = save(context, null)

    private fun request(method: String, path: String, body: JSONObject, token: String? = null,
                        extra: Map<String, String> = emptyMap()): JSONObject {
        val c = URL(BASE + path).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.connectTimeout = 15000; c.readTimeout = 20000
        c.setRequestProperty("apikey", KEY)
        c.setRequestProperty("Accept", "application/json")
        c.setRequestProperty("Content-Type", "application/json")
        c.setRequestProperty("Authorization", "Bearer ${token ?: KEY}")
        extra.forEach { (k, v) -> c.setRequestProperty(k, v) }
        c.doOutput = true
        try {
            c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = c.responseCode
            val text = (if (status in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(text).optString("msg").ifBlank { JSONObject(text).optString("message") } }.getOrNull()
                throw IllegalStateException(message?.takeIf { it.isNotBlank() } ?: "Request failed ($status)")
            }
            return if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally { c.disconnect() }
    }
}
