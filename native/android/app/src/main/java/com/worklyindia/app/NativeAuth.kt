package com.worklyindia.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class NativeSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String,
    val userRole: String = "jobseeker"
)

/**
 * Minimal encrypted session bridge used only to register/unregister this WebView
 * installation for native Firebase notifications. Authentication stays on the website.
 */
object NativeAuth {
    private const val ALIAS = "workly_webview_session_key"
    private const val PREFS = "workly_webview_session"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    fun saveWebSession(
        context: Context,
        accessToken: String,
        refreshToken: String,
        userId: String,
        email: String,
        userRole: String
    ): NativeSession {
        val session = NativeSession(accessToken, refreshToken, userId, email, userRole)
        val plain = JSONObject()
            .put("access", session.accessToken)
            .put("refresh", session.refreshToken)
            .put("id", session.userId)
            .put("email", session.email)
            .put("role", session.userRole)
            .toString()
            .toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(plain)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString("data", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .apply()
        return session
    }

    fun session(context: Context): NativeSession? = runCatching {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val iv = Base64.decode(prefs.getString("iv", null) ?: return null, Base64.NO_WRAP)
        val data = Base64.decode(prefs.getString("data", null) ?: return null, Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        val json = JSONObject(String(cipher.doFinal(data), Charsets.UTF_8))
        NativeSession(
            json.getString("access"),
            json.getString("refresh"),
            json.getString("id"),
            json.optString("email"),
            json.optString("role", "jobseeker")
        )
    }.getOrNull()

    /**
     * Refresh the encrypted WebView session before background notification actions.
     * Supabase rotates refresh tokens, so persist the complete replacement session.
     */
    fun refreshSession(context: Context): NativeSession? = runCatching {
        val current = session(context) ?: return null
        val connection = java.net.URL("https://jubwzelupbntbetpajqb.supabase.co/auth/v1/token?grant_type=refresh_token")
            .openConnection() as java.net.HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 10000
        connection.readTimeout = 15000
        connection.setRequestProperty("apikey", "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o")
        connection.setRequestProperty("Content-Type", "application/json")
        connection.doOutput = true
        val body = JSONObject().put("refresh_token", current.refreshToken).toString()
        connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        val status = connection.responseCode
        val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()
        if (status !in 200..299) throw IllegalStateException("Session refresh failed [$status]")
        val json = JSONObject(response)
        val user = json.optJSONObject("user") ?: throw IllegalStateException("Refresh response has no user")
        val refreshedUserId = user.optString("id")
        if (refreshedUserId != current.userId) throw SecurityException("Refreshed account does not match the signed-in account")
        saveWebSession(
            context,
            json.getString("access_token"),
            json.getString("refresh_token"),
            refreshedUserId,
            user.optString("email", current.email),
            current.userRole
        )
    }.getOrNull()

    fun signOut(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
