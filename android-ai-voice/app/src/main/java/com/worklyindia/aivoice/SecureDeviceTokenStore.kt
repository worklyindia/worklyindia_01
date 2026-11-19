package com.worklyindia.aivoice

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Stores the paired device token encrypted with an AES-GCM key held by Android Keystore.
 * The token is never written to plain-text SharedPreferences.
 */
object SecureDeviceTokenStore {
    private const val PREFS = "workly_ai_voice_secure"
    private const val TOKEN = "device_token"
    private const val KEY_ALIAS = "workly_ai_voice_device_token_v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    @Synchronized
    fun save(context: Context, token: String) {
        require(token.length >= 40) { "Invalid device token" }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val encrypted = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
        val packed = cipher.iv + encrypted
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(TOKEN, Base64.encodeToString(packed, Base64.NO_WRAP))
            .apply()
    }

    @Synchronized
    fun read(context: Context): String? {
        val packedText = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(TOKEN, null) ?: return null
        return try {
            val packed = Base64.decode(packedText, Base64.NO_WRAP)
            if (packed.size <= 12) return null
            val iv = packed.copyOfRange(0, 12)
            val encrypted = packed.copyOfRange(12, packed.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
            cipher.doFinal(encrypted).toString(Charsets.UTF_8)
        } catch (_: Exception) {
            clear(context)
            null
        }
    }

    @Synchronized
    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(TOKEN).apply()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}
