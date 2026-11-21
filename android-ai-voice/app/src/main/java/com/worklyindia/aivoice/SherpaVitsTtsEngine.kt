package com.worklyindia.aivoice

import android.content.Context
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
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
    private val tts: OfflineTts
) : AutoCloseable {
    private val closed = AtomicBoolean(false)

    fun synthesizeToWav(text: String, output: File, speed: Float = 1.0f): File {
        check(!closed.get()) { "VITS voice engine is closed." }
        require(text.isNotBlank()) { "Enter text to speak." }
        require(speed in 0.5f..2.0f) { "Speech speed must be between 0.5x and 2x." }
        val audio = tts.generate(text = text, sid = 0, speed = speed)
        require(audio.samples.isNotEmpty() && audio.sampleRate > 0) { "The VITS model returned empty audio." }
        writeWav(output, audio.samples, audio.sampleRate)
        return output
    }

    override fun close() {
        if (closed.compareAndSet(false, true)) runCatching { tts.release() }
    }

    companion object {
        fun create(context: Context, pack: SpeechModelCatalog.Pack): SherpaVitsTtsEngine {
            val root = SpeechPackDownloadManager(context).modelDirectory(pack)
            val archives = File(root, "archives")
            val voiceArchive = File(archives, "voice.tar.bz2")
            val espeakArchive = File(archives, "espeak-ng-data.tar.bz2")
            check(voiceArchive.isFile && espeakArchive.isFile) { "Download the complete iTantra VITS model first." }

            val voiceDir = File(root, "voice")
            val espeakDir = File(root, "espeak-ng-data")
            if (!File(voiceDir, "model.onnx").isFile || !File(voiceDir, "tokens.txt").isFile) {
                extractTarBz2(voiceArchive, voiceDir, listOf("espeak-ng-data/"))
            }
            if (!File(espeakDir, "phontab").isFile && !File(espeakDir, "espeak-ng-data/phontab").isFile) {
                extractTarBz2(espeakArchive, espeakDir)
            }
            val model = File(voiceDir, "model.onnx")
            val tokens = File(voiceDir, "tokens.txt")
            check(model.isFile && tokens.isFile) { "VITS archive is missing model.onnx or tokens.txt." }
            val dataDir = if (File(espeakDir, "phontab").isFile) espeakDir else File(espeakDir, "espeak-ng-data")
            check(File(dataDir, "phontab").isFile) { "The shared espeak-ng-data files were not extracted correctly." }

            val config = OfflineTtsConfig(
                model = OfflineTtsModelConfig(
                    vits = OfflineTtsVitsModelConfig(
                        model = model.absolutePath,
                        tokens = tokens.absolutePath,
                        dataDir = dataDir.absolutePath
                    )
                ),
                numThreads = 2,
                debug = false,
                provider = "cpu"
            )
            return SherpaVitsTtsEngine(OfflineTts(assetManager = null, config = config))
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
