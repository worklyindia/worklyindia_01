package com.worklyindia.aivoice

import com.qwen.tts.studio.engine.QwenEngine
import java.io.Closeable
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.roundToInt

/**
 * On-device Qwen3-TTS wrapper. The model weights stay in app-private model
 * storage; only the JNI runtime is packaged for arm64-v8a.
 */
class Qwen3TtsEngine(
    private val modelDirectory: File,
    private val cpuThreads: Int = 2
) : Closeable {
    private val engine = QwenEngine()

    fun load() {
        check(engine.setCpuThreads(cpuThreads)) { "Could not set Qwen CPU thread count." }
        check(engine.loadModels(modelDirectory.absolutePath, "qwen-talker-0.6b-customvoice-Q4_K_M.gguf")) {
            engine.getLastError() ?: "Qwen3-TTS model load failed."
        }
    }

    fun availableSpeakers(): List<String> = engine.getAvailableSpeakers()

    fun synthesizeToWav(text: String, output: File, speaker: String = "Ryan"): File {
        require(text.isNotBlank()) { "Enter text to synthesize." }
        require(speaker.isNotBlank()) { "Choose a speaker voice." }
        val result = engine.synthesize(
            text = text,
            params = QwenEngine.NativeParams(languageId = 2050, speaker = speaker, maxAudioTokens = 256)
        )
        val audio = result.audio
        check(result.success && audio != null && audio.isNotEmpty()) {
            result.errorMsg ?: engine.getLastError() ?: "Qwen3-TTS did not return audio."
        }
        writePcm16Wav(output, audio, result.sampleRate)
        return output
    }

    private fun writePcm16Wav(file: File, samples: FloatArray, sampleRate: Int) {
        require(samples.isNotEmpty()) { "Qwen3-TTS generated empty audio." }
        val pcmBytes = samples.size * 2
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
            put("RIFF".toByteArray(Charsets.US_ASCII))
            putInt(36 + pcmBytes)
            put("WAVE".toByteArray(Charsets.US_ASCII))
            put("fmt ".toByteArray(Charsets.US_ASCII))
            putInt(16)
            putShort(1)
            putShort(1)
            putInt(sampleRate)
            putInt(sampleRate * 2)
            putShort(2)
            putShort(16)
            put("data".toByteArray(Charsets.US_ASCII))
            putInt(pcmBytes)
        }
        file.parentFile?.mkdirs()
        FileOutputStream(file).use { stream ->
            stream.write(header.array())
            val pcm = ByteBuffer.allocate(pcmBytes).order(ByteOrder.LITTLE_ENDIAN)
            samples.forEach { sample ->
                val clamped = sample.coerceIn(-1f, 1f)
                pcm.putShort((clamped * if (clamped < 0f) 32768f else 32767f).roundToInt().toShort())
            }
            stream.write(pcm.array())
        }
    }

    override fun close() {
        engine.close()
    }
}
