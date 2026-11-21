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
import java.io.File
import kotlin.math.roundToInt

class KokoroTtsEngine(context: Context) : AutoCloseable {
    private val app = context.applicationContext
    private var engine: TextToSpeech? = null

    fun synthesizeToWav(
        pack: SpeechModelCatalog.Pack,
        modelDirectory: File,
        text: String,
        voiceId: String,
        outputFile: File
    ): File {
        require(pack.id == "kokoro-82m") { "This is not a Kokoro model pack." }
        require(text.isNotBlank()) { "Enter text to speak." }

        val modelFile = File(modelDirectory, "kokoro_int8_fp16.litertlm")
        check(modelFile.isFile && modelFile.length() == 294_783_298L) {
            "Kokoro model is incomplete or failed its size check. Delete it and download again."
        }

        // Reuse the MediaPipe runtime after the first request; model initialization is costly.
        val tts = engine ?: TextToSpeech.create(
            TextToSpeechOptions(
                baseOptions = BaseOptions.builder()
                    .setModelAssetPath(modelFile.absolutePath)
                    .setDelegate(Delegate.CPU)
                    .build(),
                cacheDirectory = app.cacheDir.absolutePath
            )
        ).also { engine = it }

        val voices = tts.listVoices()
        check(voices.any { it.voiceId == voiceId }) {
            "Selected voice is not available in this Kokoro model: $voiceId"
        }
        // Bound each inference request so very long input does not create one huge
        // temporary waveform in memory. The runtime remains loaded across chunks.
        val chunks = splitText(text)
        require(chunks.isNotEmpty()) { "Enter text to speak." }
        outputFile.parentFile?.mkdirs()
        var dataBytes = 0L
        var sampleRate = 0
        java.io.RandomAccessFile(outputFile, "rw").use { wav ->
            wav.setLength(0L)
            writeWavHeader(wav, 0, 24_000)
            for (chunk in chunks) {
                val audio = tts.synthesize(chunk, SynthesisOptions(voiceId = voiceId))
                check(audio.samples.isNotEmpty()) { "Kokoro returned empty audio for a text segment." }
                if (sampleRate == 0) sampleRate = audio.sampleRateHz
                check(audio.sampleRateHz == sampleRate) { "Kokoro changed sample rate between text segments." }
                val nextBytes = dataBytes + audio.samples.size.toLong() * 2L
                require(nextBytes <= Int.MAX_VALUE - 36L) { "Generated audio is too large for a single WAV file. Split the text into smaller files." }
                val buffer = ByteArray(16_384)
                var offset = 0
                while (offset < audio.samples.size) {
                    val count = minOf(buffer.size / 2, audio.samples.size - offset)
                    for (i in 0 until count) {
                        val pcm = (audio.samples[offset + i].coerceIn(-1f, 1f) * 32767f).roundToInt()
                        buffer[i * 2] = pcm.toByte()
                        buffer[i * 2 + 1] = (pcm shr 8).toByte()
                    }
                    wav.write(buffer, 0, count * 2)
                    offset += count
                }
                dataBytes = nextBytes
            }
            check(dataBytes > 0L && sampleRate > 0) { "Kokoro returned no audio." }
            wav.seek(0L)
            writeWavHeader(wav, dataBytes.toInt(), sampleRate)
            wav.fd.sync()
        }
        check(outputFile.isFile && outputFile.length() > 44L) {
            "Kokoro could not write the generated WAV audio."
        }
        return outputFile
    }

    private fun splitText(text: String, maxChars: Int = 500): List<String> {
        // Larger bounded segments reduce per-call overhead while keeping each
        // temporary waveform limited for mobile memory usage.
        val result = ArrayList<String>()
        val sentences = text.trim().split(Regex("(?<=[.!?।؟])\\s+"))
        for (value in sentences) {
            var remaining = value.trim()
            while (remaining.length > maxChars) {
                var cut = remaining.lastIndexOf(' ', maxChars)
                if (cut < maxChars / 2) cut = maxChars
                result.add(remaining.substring(0, cut).trim())
                remaining = remaining.substring(cut).trim()
            }
            if (remaining.isNotBlank()) result.add(remaining)
        }
        return result
    }

    private fun writeWavHeader(wav: java.io.RandomAccessFile, dataBytes: Int, sampleRate: Int) {
        fun ascii(value: String) = wav.write(value.toByteArray(Charsets.US_ASCII))
        fun leInt(value: Int) {
            wav.write(value and 0xff); wav.write((value ushr 8) and 0xff)
            wav.write((value ushr 16) and 0xff); wav.write((value ushr 24) and 0xff)
        }
        fun leShort(value: Int) { wav.write(value and 0xff); wav.write((value ushr 8) and 0xff) }
        ascii("RIFF"); leInt(36 + dataBytes); ascii("WAVE"); ascii("fmt "); leInt(16)
        leShort(1); leShort(1); leInt(sampleRate); leInt(sampleRate * 2); leShort(2); leShort(16)
        ascii("data"); leInt(dataBytes)
    }

    override fun close() {
        val current = engine
        engine = null
        current?.close()
    }
}
