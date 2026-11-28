package com.worklyindia.aivoice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
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
import kotlin.math.max

/**
 * Offline iTantra-compatible VITS synthesis using the app's Sherpa-ONNX runtime.
 * The downloaded Piper/Mimic3 archives are extracted into app-private model storage.
 */
class SherpaVitsTtsEngine private constructor(
    private val tts: OfflineTts,
) : AutoCloseable {
    private val closed = AtomicBoolean(false)
    @Volatile private var activeTrack: AudioTrack? = null

    fun synthesizeToWav(text: String, output: File, speed: Float = 1.0f): File {
        check(!closed.get()) { "VITS voice engine is closed." }
        require(text.isNotBlank()) { "Enter text to speak." }
        require(speed in 0.5f..2.0f) { "Speech speed must be between 0.5x and 2x." }
        val audio = tts.generate(text = text, sid = 0, speed = speed)
        require(audio.samples.isNotEmpty() && audio.sampleRate > 0) { "The VITS model returned empty audio." }
        writeWav(output, audio.samples, audio.sampleRate)
        return output
    }


    /** Generate and play speech locally on the phone; call from a worker thread. */
    fun speak(text: String, speed: Float = 1.0f) {
        check(!closed.get()) { "VITS voice engine is closed." }
        require(text.isNotBlank()) { "Enter text to speak." }
        require(speed in 0.5f..2.0f) { "Speech speed must be between 0.5x and 2x." }
        val audio = tts.generate(text = text, sid = 0, speed = speed)
        require(audio.samples.isNotEmpty() && audio.sampleRate > 0) { "The VITS model returned empty audio." }
        playAudio(audio.samples, audio.sampleRate)
    }

    private fun playAudio(samples: FloatArray, sampleRate: Int) {
        val minBuffer = AudioTrack.getMinBufferSize(
            sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
        check(minBuffer > 0) { "This device does not support VITS audio output (code $minBuffer)." }
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(max(minBuffer * 2, 8 * 1024))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        try {
            activeTrack = track
            check(track.state == AudioTrack.STATE_INITIALIZED) {
                "VITS audio output could not initialize. Check media volume and audio output."
            }
            val pcm = ShortArray(samples.size) {
                (samples[it].coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort()
            }
            track.play()
            var offset = 0
            while (offset < pcm.size) {
                check(!closed.get()) { "VITS speech playback was stopped." }
                val written = track.write(pcm, offset, pcm.size - offset, AudioTrack.WRITE_BLOCKING)
                check(written > 0) { "VITS audio output write failed (code $written)." }
                offset += written
            }
            val deadline = android.os.SystemClock.elapsedRealtime() +
                (pcm.size * 1000L / sampleRate) + 3000L
            while (track.playState == AudioTrack.PLAYSTATE_PLAYING &&
                track.playbackHeadPosition.toLong() < pcm.size &&
                android.os.SystemClock.elapsedRealtime() < deadline
            ) {
                Thread.sleep(20L)
            }
        } finally {
            activeTrack = null
            runCatching { track.pause() }
            runCatching { track.flush() }
            runCatching { track.stop() }
            track.release()
        }
    }

    fun stop() {
        runCatching { activeTrack?.stop() }
    }

    override fun close() {
        if (closed.compareAndSet(false, true)) {
            stop()
            runCatching { tts.release() }
        }
    }

    companion object {
        fun create(context: Context, pack: SpeechModelCatalog.Pack): SherpaVitsTtsEngine {
            val root = SpeechPackDownloadManager(context).modelDirectory(pack)
            val archives = File(root, "archives")
            val voiceArchive = File(archives, "voice.tar.bz2")
            check(voiceArchive.isFile) { "Download the iTantra VITS voice model first." }

            val voiceDir = File(root, "voice")
            if (!File(voiceDir, "model.onnx").isFile || !File(voiceDir, "tokens.txt").isFile) {
                extractTarBz2(voiceArchive, voiceDir)
            }
            val espeakArchive = File(archives, "espeak-ng-data.tar.bz2")
            check(espeakArchive.isFile) { "Download the shared Sherpa-ONNX espeak-ng data pack first." }
            val espeakDir = File(root, "espeak-ng-data")
            if (!File(espeakDir, "phontab").isFile && !File(espeakDir, "phontab").exists()) {
                extractTarBz2(espeakArchive, espeakDir)
            }
            val model = File(voiceDir, "model.onnx").takeIf { it.isFile }
                ?: voiceDir.walkTopDown().firstOrNull { it.isFile && it.extension.equals("onnx", ignoreCase = true) }
            val tokens = File(voiceDir, "tokens.txt").takeIf { it.isFile }
                ?: voiceDir.walkTopDown().firstOrNull { it.isFile && it.name == "tokens.txt" }
            check(model?.isFile == true && tokens?.isFile == true) { "VITS archive is missing its ONNX model or tokens.txt." }
            check(espeakDir.isDirectory && espeakDir.walkTopDown().any { it.isFile }) {
                "Sherpa-ONNX espeak-ng language data is missing or incomplete."
            }
            val config = OfflineTtsConfig(
                model = OfflineTtsModelConfig(
                    vits = OfflineTtsVitsModelConfig(
                        model = model!!.absolutePath,
                        tokens = tokens!!.absolutePath,
                        dataDir = espeakDir.absolutePath
                    ),
                    numThreads = Runtime.getRuntime().availableProcessors().coerceIn(2, 4),
                    debug = false,
                    provider = "cpu"
                )
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
