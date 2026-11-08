package com.worklyindia.app

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

/** AES-GCM encrypted documents in app-private, no-backup storage. */
object SecureDocumentVault {
    private const val LEGACY_KEY_ALIAS = "workly_secure_document_vault_v1"
    private const val AUTH_KEY_ALIAS = "workly_secure_document_vault_biometric_v2"
    private const val DIRECTORY = "secure-document-vault"
    private const val PAYLOAD_MAGIC = 0x57445631
    private const val AUTH_FILE_MAGIC = 0x57563231
    const val MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

    data class Entry(val id: String, val file: File)

    private fun directory(context: Context) =
        File(context.noBackupFilesDir, DIRECTORY).apply { mkdirs() }

    fun list(context: Context): List<Entry> =
        directory(context).listFiles()?.filter { it.isFile && it.extension == "wdv" }
            ?.sortedByDescending { it.lastModified() }
            ?.map { Entry(it.nameWithoutExtension, it) } ?: emptyList()

    /** Initialize a per-use key operation. The returned Cipher must be passed to BiometricPrompt. */
    fun newEncryptionCipher(): Cipher {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateBiometricKey())
        return cipher
    }

    /** Returns null for documents written by the pre-biometric vault format. */
    fun newDecryptionCipher(context: Context, id: String): Cipher? {
        val file = documentFile(context, id)
        val raw = file.readBytes()
        require(raw.size > 20) { "Encrypted document is damaged." }
        val header = java.nio.ByteBuffer.wrap(raw, 0, 4).int
        if (header != AUTH_FILE_MAGIC) return null
        val ivLength = raw[4].toInt() and 0xff
        require(ivLength in 12..16 && raw.size > 5 + ivLength) { "Encrypted document is damaged." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateBiometricKey(),
            GCMParameterSpec(128, raw.copyOfRange(5, 5 + ivLength))
        )
        return cipher
    }

    fun saveAuthenticated(
        context: Context, displayName: String, mimeType: String, bytes: ByteArray, cipher: Cipher
    ): String {
        require(bytes.isNotEmpty() && bytes.size <= MAX_DOCUMENT_BYTES) { "Choose a document up to 15 MB." }
        require(cipher.opmodeForVault() == Cipher.ENCRYPT_MODE) { "Invalid vault encryption operation." }
        val payload = encodePayload(displayName, mimeType, bytes)
        val encrypted = cipher.doFinal(payload)
        val id = java.util.UUID.randomUUID().toString()
        File(directory(context), "$id.wdv").outputStream().use { stream ->
            val header = java.nio.ByteBuffer.allocate(5).putInt(AUTH_FILE_MAGIC).put(cipher.iv.size.toByte()).array()
            stream.write(header)
            stream.write(cipher.iv)
            stream.write(encrypted)
        }
        return id
    }

    fun readAuthenticated(context: Context, id: String, cipher: Cipher): Triple<String, String, ByteArray> {
        require(cipher.opmodeForVault() == Cipher.DECRYPT_MODE) { "Invalid vault decryption operation." }
        val raw = documentFile(context, id).readBytes()
        require(raw.size > 20 && java.nio.ByteBuffer.wrap(raw, 0, 4).int == AUTH_FILE_MAGIC) {
            "This document needs the older vault reader."
        }
        val ivLength = raw[4].toInt() and 0xff
        require(ivLength in 12..16 && raw.size > 5 + ivLength) { "Encrypted document is damaged." }
        return decodePayload(cipher.doFinal(raw.copyOfRange(5 + ivLength, raw.size)))
    }

    /** Legacy reader retained so existing vault documents remain accessible after this upgrade. */
    fun read(context: Context, id: String): Triple<String, String, ByteArray> {
        val file = documentFile(context, id)
        val raw = file.readBytes()
        require(raw.size > 13) { "Encrypted document is damaged." }
        require(java.nio.ByteBuffer.wrap(raw, 0, 4).int != AUTH_FILE_MAGIC) {
            "This document requires biometric-bound decryption."
        }
        val ivLength = raw[0].toInt() and 0xff
        require(ivLength in 12..16 && raw.size > 1 + ivLength) { "Encrypted document is damaged." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            getLegacyKey(),
            GCMParameterSpec(128, raw.copyOfRange(1, 1 + ivLength))
        )
        return decodePayload(cipher.doFinal(raw.copyOfRange(1 + ivLength, raw.size)))
    }

    fun delete(context: Context, id: String): Boolean {
        if (!id.matches(Regex("[a-fA-F0-9-]{36}"))) return false
        return File(directory(context), "$id.wdv").delete()
    }

    private fun documentFile(context: Context, id: String): File {
        require(id.matches(Regex("[a-fA-F0-9-]{36}"))) { "Invalid document reference." }
        return File(directory(context), "$id.wdv").also {
            require(it.isFile && it.length() <= MAX_DOCUMENT_BYTES + 2048L) { "Document not found." }
        }
    }

    private fun encodePayload(displayName: String, mimeType: String, bytes: ByteArray): ByteArray {
        val safeName = displayName.substringAfterLast('/').substringAfterLast('\\')
            .replace(Regex("[\\\\/:*?\"<>|]"), "_").take(160).ifBlank { "document" }
        return ByteArrayOutputStream().also { buffer ->
            DataOutputStream(buffer).use { out ->
                out.writeInt(PAYLOAD_MAGIC)
                out.writeUTF(safeName)
                out.writeUTF(mimeType.take(120))
                out.writeInt(bytes.size)
                out.write(bytes)
            }
        }.toByteArray()
    }

    private fun decodePayload(plain: ByteArray): Triple<String, String, ByteArray> =
        DataInputStream(ByteArrayInputStream(plain)).use { input ->
            require(input.readInt() == PAYLOAD_MAGIC) { "Invalid vault document." }
            val name = input.readUTF()
            val mime = input.readUTF()
            val size = input.readInt()
            require(size in 1..MAX_DOCUMENT_BYTES && size == input.available()) { "Invalid document data." }
            Triple(name, mime.ifBlank { "application/octet-stream" }, ByteArray(size).also(input::readFully))
        }

    private fun getLegacyKey(): java.security.Key {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return store.getKey(LEGACY_KEY_ALIAS, null) as? java.security.Key
            ?: throw IllegalStateException("Legacy vault key unavailable; old documents cannot be decrypted.")
    }

    private fun getOrCreateBiometricKey(): java.security.Key {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(AUTH_KEY_ALIAS, null) as? java.security.Key)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val builder = KeyGenParameterSpec.Builder(
            AUTH_KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                0, KeyProperties.AUTH_BIOMETRIC_STRONG
            )
        } else {
            @Suppress("DEPRECATION")
            builder.setUserAuthenticationValidityDurationSeconds(-1)
        }
        generator.init(builder.build())
        generator.generateKey()
        return KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            .getKey(AUTH_KEY_ALIAS, null)
            ?: throw IllegalStateException("Biometric-protected vault key unavailable.")
    }

    private fun Cipher.opmodeForVault(): Int {
        // Cipher does not expose its mode; check it with a harmless algorithm-independent property
        // via the key-operation intent passed by the caller instead.
        return if (iv != null && iv.isNotEmpty()) {
            // GCM encrypt Ciphers expose an IV before doFinal; decrypt Ciphers do too.
            // The caller-side method validates the expected mode through the dedicated helper below.
            cipherMode
        } else cipherMode
    }

    private val cipherModes = java.util.WeakHashMap<Cipher, Int>()
    private val Cipher.cipherMode: Int
        get() = cipherModes[this] ?: throw IllegalArgumentException("Cipher was not prepared by Secure Vault.")
}
