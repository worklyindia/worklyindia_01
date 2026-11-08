package com.worklyindia.app

import android.content.Context
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

/** AES-256-GCM encrypted documents stored only in the app's no-backup private directory. */
object SecureDocumentVault {
    private const val KEY_ALIAS = "workly_secure_document_vault_v1"
    private const val DIRECTORY = "secure-document-vault"
    private const val MAGIC = 0x57445631
    const val MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

    data class Entry(val id: String, val file: File)

    private fun directory(context: Context) =
        File(context.noBackupFilesDir, DIRECTORY).apply { mkdirs() }

    fun list(context: Context): List<Entry> =
        directory(context).listFiles()?.filter { it.isFile && it.extension == "wdv" }
            ?.sortedByDescending { it.lastModified() }
            ?.map { Entry(it.nameWithoutExtension, it) } ?: emptyList()

    fun save(context: Context, displayName: String, mimeType: String, bytes: ByteArray): String {
        require(bytes.isNotEmpty() && bytes.size <= MAX_DOCUMENT_BYTES) { "Choose a document up to 15 MB." }
        val safeName = displayName.substringAfterLast('/').substringAfterLast('\\')
            .replace(Regex("[\\\\/:*?\"<>|]"), "_").take(160).ifBlank { "document" }
        val payload = ByteArrayOutputStream().also { buffer ->
            DataOutputStream(buffer).use { out ->
                out.writeInt(MAGIC)
                out.writeUTF(safeName)
                out.writeUTF(mimeType.take(120))
                out.writeInt(bytes.size)
                out.write(bytes)
            }
        }.toByteArray()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val encrypted = cipher.doFinal(payload)
        val id = java.util.UUID.randomUUID().toString()
        File(directory(context), "$id.wdv").outputStream().use { stream ->
            stream.write(cipher.iv.size)
            stream.write(cipher.iv)
            stream.write(encrypted)
        }
        return id
    }

    fun read(context: Context, id: String): Triple<String, String, ByteArray> {
        require(id.matches(Regex("[a-fA-F0-9-]{36}"))) { "Invalid document reference." }
        val file = File(directory(context), "$id.wdv")
        require(file.isFile && file.length() <= MAX_DOCUMENT_BYTES + 1024L) { "Document not found." }
        val raw = file.readBytes()
        require(raw.size > 13) { "Encrypted document is damaged." }
        val ivLength = raw[0].toInt() and 0xff
        require(ivLength in 12..16 && raw.size > 1 + ivLength) { "Encrypted document is damaged." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, raw.copyOfRange(1, 1 + ivLength)))
        val plain = cipher.doFinal(raw.copyOfRange(1 + ivLength, raw.size))
        DataInputStream(ByteArrayInputStream(plain)).use { input ->
            require(input.readInt() == MAGIC) { "Invalid vault document." }
            val name = input.readUTF()
            val mime = input.readUTF()
            val size = input.readInt()
            require(size in 1..MAX_DOCUMENT_BYTES && size <= input.available()) { "Invalid document data." }
            return Triple(name, mime.ifBlank { "application/octet-stream" }, ByteArray(size).also(input::readFully))
        }
    }

    fun delete(context: Context, id: String): Boolean {
        if (!id.matches(Regex("[a-fA-F0-9-]{36}"))) return false
        return File(directory(context), "$id.wdv").delete()
    }

    private fun getOrCreateKey(): java.security.Key {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? java.security.Key)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        generator.generateKey()
        return KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.getKey(KEY_ALIAS, null)
            ?: throw IllegalStateException("Secure vault key unavailable.")
    }
}
