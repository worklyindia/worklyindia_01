/*
 * Kokoro-82M Android inference adapter.
 * MediaPipe Tasks Audio / LiteRT executes the model locally; no network inference.
 * The CPU/GPU-compatible bundle can use the GPU vocoder with a safe CPU fallback.
 */
package com.worklyindia.aivoice

import android.content.Context
import android.os.SystemClock
import android.util.Log
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
    private var activeDelegate: Delegate? = null
    private var forceCpu = false

    private fun checkedModelFile(pack: SpeechModelCatalog.Pack, modelDirectory: File): File {
        require(pack.id == "kokoro-82m") { "This is not a Kokoro model pack." }
        val modelFile = File(modelDirectory, "kokoro_int8_fp16.litertlm")
        check(modelFile.isFile && modelFile.length() == 294_783_298L) {
            "Kokoro model is incomplete or failed its size check. Delete it and download again."
        }
        return modelFile
    }

    @Synchronized
    private fun createRuntime(modelFile: File, delegate: Delegate): TextToSpeech {
        return TextToSpeech.create(
            TextToSpeechOptions(
                baseOptions = BaseOptions.builder()
                    .setModelAssetPath(modelFile.absolutePath)
                    .setDelegate(delegate)
                    .build(),
                cacheDirectory = app.cacheDir.absolutePath
            )
        ).also {
            engine = it
            activeDelegate = delegate
            Log.i(TAG, "Kokoro runtime initialized delegate=$delegate")
        }
    }

    @Synchronized
    private fun getRuntime(modelFile: File): TextToSpeech {
        engine?.let { return it }
        if (!forceCpu) {
            try {
                // The existing kokoro_int8_fp16 bundle supports GPU execution.
                // MediaPipe runs the acoustic stage on CPU and the vocoder on GPU.
                return createRuntime(modelFile, Delegate.GPU)
            } catch (error: Exception) {
                Log.w(TAG, "Kokoro GPU delegate unavailable; falling back to CPU", error)
                engine?.runCatching { close() }
                engine = null
                activeDelegate = null
            }
        }
        return createRuntime(modelFile, Delegate.CPU)
    }

    @Synchronized
    private fun switchToCpu(modelFile: File): TextToSpeech {
        engine?.runCatching { close() }
        engine = null
        activeDelegate = null
        forceCpu = true
        Log.w(TAG, "Kokoro switching to CPU fallback")
        return createRuntime(modelFile, Delegate.CPU)
    }

    /** Initialize and retain the offline model before a website request arrives. */
    @Synchronized
    fun warm(pack: SpeechModelCatalog.Pack, modelDirectory: File, voiceId: String) {
        val modelFile = checkedModelFile(pack, modelDirectory)
        var tts = getRuntime(modelFile)
        check(tts.listVoices().any { it.voiceId == voiceId }) {
            "Selected voice is not available in this Kokoro model: $voiceId"
        }
        val warmupText = if (voiceId == "hf_alpha") "नमस्ते।" else "Hello."
        val startedAt = SystemClock.elapsedRealtime()
        try {
            val audio = tts.synthesize(warmupText, SynthesisOptions(voiceId = voiceId))
            check(audio.samples.isNotEmpty()) { "Kokoro warm-up returned empty audio for $voiceId." }
        } catch (error: Exception) {
            if (activeDelegate != Delegate.GPU) throw error
            Log.w(TAG, "Kokoro GPU warm-up failed; retrying on CPU", error)
            tts = switchToCpu(modelFile)
            val audio = tts.synthesize(warmupText, SynthesisOptions(voiceId = voiceId))
            check(audio.samples.isNotEmpty()) { "Kokoro CPU warm-up returned empty audio for $voiceId." }
        }
        Log.i(TAG, "Kokoro warm-up voice=$voiceId delegate=$activeDelegate durationMs=" + (SystemClock.elapsedRealtime() - startedAt))
    }

    @Synchronized
    fun synthesizeToWav(
        pack: SpeechModelCatalog.Pack,
        modelDirectory: File,
        text: String,
        voiceId: String,
        outputFile: File,
        onProgress: (Int, Int) -> Unit = { _, _ -> }
    ): File {
        require(text.isNotBlank()) { "Enter text to speak." }
        val modelFile = checkedModelFile(pack, modelDirectory)
        val chunks = splitText(text)
        require(chunks.isNotEmpty()) { "Enter text to speak." }
        var tts = getRuntime(modelFile)
        try {
            return writeSynthesis(tts, chunks, text, voiceId, outputFile, onProgress)
        } catch (error: Exception) {
            if (activeDelegate != Delegate.GPU) throw error
            Log.w(TAG, "Kokoro GPU synthesis failed; retrying complete request on CPU", error)
            tts = switchToCpu(modelFile)
            outputFile.delete()
            return writeSynthesis(tts, chunks, text, voiceId, outputFile, onProgress)
        }
    }

    private fun writeSynthesis(
        tts: TextToSpeech,
        chunks: List<String>,
        text: String,
        voiceId: String,
        outputFile: File,
        onProgress: (Int, Int) -> Unit
    ): File {
        check(tts.listVoices().any { it.voiceId == voiceId }) {
            "Selected voice is not available in this Kokoro model: $voiceId"
        }
        outputFile.parentFile?.mkdirs()
        var dataBytes = 0L
        var sampleRate = 0
        val synthesisStartedAt = SystemClock.elapsedRealtime()
        java.io.RandomAccessFile(outputFile, "rw").use { wav ->
            wav.setLength(0L)
            writeWavHeader(wav, 0, 24_000)
            for ((chunkIndex, chunk) in chunks.withIndex()) {
                val chunkStartedAt = SystemClock.elapsedRealtime()
                val audio = tts.synthesize(chunk, SynthesisOptions(voiceId = voiceId))
                Log.i(TAG, "Kokoro inference delegate=$activeDelegate voice=$voiceId chunk=${chunkIndex + 1}/${chunks.size} chars=${chunk.length} durationMs=" + (SystemClock.elapsedRealtime() - chunkStartedAt))
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
                onProgress(chunkIndex + 1, chunks.size)
            }
            check(dataBytes > 0L && sampleRate > 0) { "Kokoro returned no audio." }
            wav.seek(0L)
            writeWavHeader(wav, dataBytes.toInt(), sampleRate)
            wav.fd.sync()
        }
        check(outputFile.isFile && outputFile.length() > 44L) {
            "Kokoro could not write the generated WAV audio."
        }
        Log.i(TAG, "Kokoro synthesis complete delegate=$activeDelegate chars=${text.length} chunks=${chunks.size} durationMs=" + (SystemClock.elapsedRealtime() - synthesisStartedAt) + " wavBytes=${outputFile.length()}")
        return outputFile
    }

    private fun splitText(text: String, maxChars: Int = 500): List<String> {
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

    companion object {
        private const val TAG = "WorklyKokoroTTS"
    }

    @Synchronized
    override fun close() {
        val current = engine
        engine = null
        activeDelegate = null
        current?.close()
    }
}
