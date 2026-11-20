/*
 * Kokoro-82M Android inference adapter.
 * MediaPipe Tasks Audio / LiteRT executes the model locally; no network inference.
 * Model weights are downloaded separately and verified by SpeechPackDownloadManager.
 * The CPU-compatible bundle avoids optional GPU delegate libraries on older phones.
 */
package com.worklyindia.aivoice

import android.content.Context
import com.google.mediapipe.tasks.audio.texttospeech.SynthesisOptions
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeech
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeechOptions
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import kotlin.math.roundToInt

class KokoroTtsEngine(context: Context) : AutoCloseable {
    private val app = context.applicationContext
    private var engine: TextToSpeech? = null

    fun synthesizeToWav(
        pack: SpeechModelCatalog.Pack,
        modelDirectory: File,
        text: String,
        outputFile: File
    ): File {
        require(pack.id == "kokoro-82m") { "This is not a Kokoro model pack." }
        require(text.isNotBlank()) { "Enter text to speak." }

        val modelFile = File(modelDirectory, "kokoro_int8_fp16.litertlm")
        check(modelFile.isFile && modelFile.length() == 294_783_298L) {
            "Kokoro model is incomplete or failed its size check. Delete it and download again."
        }

        val options = TextToSpeechOptions(
            baseOptions = BaseOptions.builder()
                .setModelAssetPath(modelFile.absolutePath)
                .setDelegate(Delegate.CPU)
                .build(),
            cacheDirectory = app.cacheDir.absolutePath
        )
        val tts = TextToSpeech.create(options)
        engine = tts

        val voices = tts.listVoices()
        check(voices.isNotEmpty()) { "Kokoro did not report any available voices." }
        val isHindiScript = text.any { it in '\u0900'..'\u097F' }
        val preferredLocale = if (isHindiScript) "hi" else "en"
        val voice = voices.firstOrNull { it.locale.startsWith(preferredLocale, ignoreCase = true) }
            ?: voices.firstOrNull { it.locale.startsWith("en", ignoreCase = true) }
            ?: voices.first()
        val audio = tts.synthesize(text, SynthesisOptions(voiceId = voice.voiceId))
        check(audio.samples.isNotEmpty()) { "Kokoro returned empty audio." }

        writePcm16Wav(outputFile, audio.samples, audio.sampleRateHz)
        check(outputFile.isFile && outputFile.length() > 44L) {
            "Kokoro could not write the generated WAV audio."
        }
        return outputFile
    }

    private fun writePcm16Wav(file: File, samples: FloatArray, sampleRate: Int) {
        require(sampleRate > 0) { "Invalid Kokoro audio sample rate." }
        val dataBytes = samples.size * 2
        file.parentFile?.mkdirs()
        BufferedOutputStream(FileOutputStream(file)).use { out ->
            fun writeAscii(value: String) = value.forEach { out.write(it.code) }
            fun writeIntLE(value: Int) {
                out.write(value and 0xff)
                out.write((value ushr 8) and 0xff)
                out.write((value ushr 16) and 0xff)
                out.write((value ushr 24) and 0xff)
            }
            fun writeShortLE(value: Int) {
                out.write(value and 0xff)
                out.write((value ushr 8) and 0xff)
            }

            writeAscii("RIFF")
            writeIntLE(36 + dataBytes)
            writeAscii("WAVE")
            writeAscii("fmt ")
            writeIntLE(16)
            writeShortLE(1)
            writeShortLE(1)
            writeIntLE(sampleRate)
            writeIntLE(sampleRate * 2)
            writeShortLE(2)
            writeShortLE(16)
            writeAscii("data")
            writeIntLE(dataBytes)
            samples.forEach { sample ->
                val pcm = (sample.coerceIn(-1f, 1f) * 32767f).roundToInt()
                writeShortLE(pcm)
            }
        }
    }

    override fun close() {
        val current = engine
        engine = null
        current?.close()
    }
}
