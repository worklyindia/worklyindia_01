package com.worklyindia.aivoice

import android.content.Context
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import com.k2fsa.sherpa.onnx.GenerationConfig
import com.github.csukuangfj.piper.phonemize.piperPhonemizeInitialize
import com.github.csukuangfj.piper.phonemize.piperPhonemizeText
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Offline iTantra-compatible VITS synthesis using the app's Sherpa-ONNX runtime.
 * The downloaded Piper/Mimic3 archives are extracted into app-private model storage.
 */
class SherpaVitsTtsEngine private constructor(
    private val tts: OfflineTts,
    private val packLanguageFallback: String
) : AutoCloseable {
    private val closed = AtomicBoolean(false)

    fun synthesizeToWav(text: String, output: File, speed: Float = 1.0f): File {
        check(!closed.get()) { "VITS voice engine is closed." }
        require(text.isNotBlank()) { "Enter text to speak." }
        require(speed in 0.5f..2.0f) { "Speech speed must be between 0.5x and 2x." }
        val voice = tts.lang().takeIf { it.isNotBlank() } ?: packLanguageFallback
        val phonemes = phonemize(text, voice)
        val generationConfig = GenerationConfig(sid = 0, speed = speed)
        generationConfig.phonemeCodepoints = phonemes
        val audio = tts.generateWithConfig(text = "", config = generationConfig)
        require(audio.samples.isNotEmpty() && audio.sampleRate > 0) { "The VITS model returned empty audio." }
        writeWav(output, audio.samples, audio.sampleRate)
        return output
    }

    override fun close() {
        if (closed.compareAndSet(false, true)) runCatching { tts.release() }
    }

    companion object {
        private val phonemizerLock = Any()
        private val phonemizerInitialized = AtomicBoolean(false)

        private fun phonemize(text: String, voice: String): Array<IntArray> {
            val result = piperPhonemizeText(text, voice)
                ?: throw IllegalArgumentException("Could not convert text into $voice phonemes.")
            try {
                val sentences = Array(result.numSentences) { index -> result.getPhonemes(index) }
                    .filter { it.isNotEmpty() }
                    .toTypedArray()
                require(sentences.isNotEmpty()) { "No speech phonemes were produced for this text and language." }
                return sentences
            } finally {
                result.close()
            }
        }
        fun create(context: Context, pack: SpeechModelCatalog.Pack): SherpaVitsTtsEngine {
            val root = SpeechPackDownloadManager(context).modelDirectory(pack)
            val archives = File(root, "archives")
            val voiceArchive = File(archives, "voice.tar.bz2")
            check(voiceArchive.isFile) { "Download the iTantra VITS voice model first." }

            val voiceDir = File(root, "voice")
            if (!File(voiceDir, "model.onnx").isFile || !File(voiceDir, "tokens.txt").isFile) {
                extractTarBz2(voiceArchive, voiceDir, listOf("espeak-ng-data/"))
            }
            val model = File(voiceDir, "model.onnx").takeIf { it.isFile }
                ?: voiceDir.walkTopDown().firstOrNull { it.isFile && it.extension.equals("onnx", ignoreCase = true) }
            val tokens = File(voiceDir, "tokens.txt").takeIf { it.isFile }
                ?: voiceDir.walkTopDown().firstOrNull { it.isFile && it.name == "tokens.txt" }
            check(model?.isFile == true && tokens?.isFile == true) { "VITS archive is missing its ONNX model or tokens.txt." }
            val config = OfflineTtsConfig(
                model = OfflineTtsModelConfig(
                    vits = OfflineTtsVitsModelConfig(
                        model = model!!.absolutePath,
                        tokens = tokens!!.absolutePath,
                    ),
                    numThreads = Runtime.getRuntime().availableProcessors().coerceIn(2, 4),
                    debug = false,
                    provider = "cpu"
                )
            )
            synchronized(phonemizerLock) {
                if (!phonemizerInitialized.get()) {
                    piperPhonemizeInitialize(context.applicationContext)
                    phonemizerInitialized.set(true)
                }
            }
            return SherpaVitsTtsEngine(
                OfflineTts(assetManager = null, config = config),
                when (pack.languageCode) { "gu" -> "gu"; "hi" -> "hi"; else -> "en-us" }
            )
        }

        private fun extractTarBz2(archive: File, destination: File, excludePrefixes: List<String> = emptyList()) {
            destination.mkdirs()
            val canonicalRoot = destination.canonicalFile
            BZip2CompressorInputStream(archive.inputStream().buffered()).use { bz2 ->
                TarArchiveInputStream(bz2).use { tar ->
                    while (true) {
                        val entry = tar.nextEntry ?: break
                        if (!tar.canReadEntryData(entry)) continue
                        val normalized = entry.name.replace('\\', '/')
                        val slash = normalized.indexOf('/')
                        val relative = if (slash >= 0 && slash < normalized.lastIndex) normalized.substring(slash + 1) else ""
                        if (relative.isBlank() || excludePrefixes.any { relative.startsWith(it) }) continue
                        val target = File(destination, relative)
                        check(target.canonicalFile.toPath().startsWith(canonicalRoot.toPath())) { "Unsafe path in model archive." }
                        if (entry.isDirectory) target.mkdirs()
                        else {
                            target.parentFile?.mkdirs()
                            FileOutputStream(target).use { output -> tar.copyTo(output) }
                        }
                    }
                }
            }
        }

        private fun writeWav(file: File, samples: FloatArray, sampleRate: Int) {
            val dataBytes = samples.size * 2
            file.parentFile?.mkdirs()
            RandomAccessFile(file, "rw").use { wav ->
                wav.setLength(0L)
                fun ascii(value: String) = wav.write(value.toByteArray(Charsets.US_ASCII))
                fun leInt(value: Int) {
                    wav.write(value and 0xff); wav.write((value ushr 8) and 0xff)
                    wav.write((value ushr 16) and 0xff); wav.write((value ushr 24) and 0xff)
                }
                fun leShort(value: Int) { wav.write(value and 0xff); wav.write((value ushr 8) and 0xff) }
                ascii("RIFF"); leInt(36 + dataBytes); ascii("WAVE"); ascii("fmt "); leInt(16)
                leShort(1); leShort(1); leInt(sampleRate); leInt(sampleRate * 2); leShort(2); leShort(16)
                ascii("data"); leInt(dataBytes)
                val buffer = ByteArray(16_384)
                var offset = 0
                while (offset < samples.size) {
                    val count = minOf(buffer.size / 2, samples.size - offset)
                    for (i in 0 until count) {
                        val pcm = (samples[offset + i].coerceIn(-1f, 1f) * 32767f).toInt()
                        buffer[i * 2] = pcm.toByte()
                        buffer[i * 2 + 1] = (pcm shr 8).toByte()
                    }
                    wav.write(buffer, 0, count * 2)
                    offset += count
                }
                wav.fd.sync()
            }
        }
    }
}
