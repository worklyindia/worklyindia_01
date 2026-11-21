package com.worklyindia.aivoice

import java.io.Closeable
import java.io.File

/**
 * Native QVAC speech engine adapter. Model weights remain in the model pack
 * directory and are never bundled in the APK.
 */
class QvacTtsEngine private constructor(private var nativeHandle: Long) : Closeable {
    companion object {
        const val CHATTERBOX = 0
        const val COSYVOICE3 = 1

        init {
            System.loadLibrary("workly_qvac_tts_jni")
        }

        fun create(
            kind: Int,
            modelDirectory: File,
            modelA: File = File(""),
            modelB: File = File(""),
            description: String = "",
            referenceAudio: File = File(""),
            referenceText: String = "",
            language: String = "en",
            threads: Int = 2
        ): QvacTtsEngine {
            require(kind == CHATTERBOX || kind == COSYVOICE3) { "Unsupported native TTS engine." }
            val handle = nativeCreate(
                kind,
                modelDirectory.absolutePath,
                modelA.takeIf { it.path.isNotEmpty() }?.absolutePath.orEmpty(),
                modelB.takeIf { it.path.isNotEmpty() }?.absolutePath.orEmpty(),
                description,
                referenceAudio.takeIf { it.path.isNotEmpty() }?.absolutePath.orEmpty(),
                referenceText,
                language,
                threads.coerceIn(1, 4)
            )
            check(handle != 0L) { "Native TTS engine could not be initialized." }
            return QvacTtsEngine(handle)
        }

        @JvmStatic private external fun nativeCreate(
            kind: Int,
            modelDir: String,
            modelA: String,
            modelB: String,
            description: String,
            referenceAudio: String,
            referenceText: String,
            language: String,
            threads: Int
        ): Long

        @JvmStatic private external fun nativeSynthesize(handle: Long, text: String, outputPath: String): Int
        @JvmStatic private external fun nativeDestroy(handle: Long)
    }

    @Synchronized
    fun synthesizeToWav(text: String, output: File): Int {
        check(nativeHandle != 0L) { "Native TTS engine is closed." }
        require(text.isNotBlank()) { "Enter text to synthesize." }
        output.parentFile?.mkdirs()
        val sampleRate = nativeSynthesize(nativeHandle, text, output.absolutePath)
        check(sampleRate > 0 && output.isFile && output.length() > 44L) {
            "Native TTS engine did not create a valid WAV file."
        }
        return sampleRate
    }

    @Synchronized
    override fun close() {
        if (nativeHandle != 0L) {
            nativeDestroy(nativeHandle)
            nativeHandle = 0L
        }
    }
}
