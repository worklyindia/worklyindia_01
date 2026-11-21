package com.worklyindia.aivoice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import org.json.JSONObject
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.LongBuffer
import java.text.Normalizer
import java.util.Random
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.PI

/**
 * ONNX Runtime implementation of Indic Tiny TTS (Matcha acoustic model + Vocos).
 * Each language pack is loaded on demand and its ONNX sessions are retained by the Activity
 * between conversions, then closed when the screen is destroyed.
 */
class IndicTinyTtsEngine private constructor(
    private val env: OrtEnvironment,
    private val encoder: OrtSession,
    private val flow: OrtSession,
    private val vocoder: OrtSession,
    private val language: String,
    private val femaleSpeakerId: Long,
    private val maleSpeakerId: Long,
    private val languageId: Long,
    private val styleId: Long,
    private val tokenIds: Map<String, Long>,
    private val mean: Float,
    private val std: Float,
    private val femaleLengthScale: Float,
    private val maleLengthScale: Float,
    private val timesteps: Int,
    private val temperature: Float,
    private val pauseSamples: Int
) : AutoCloseable {
    @Volatile private var activeTrack: AudioTrack? = null

    fun speak(text: String, voice: String = "female", speed: Float = 1.0f) {
        require(speed in 0.5f..2.0f) { "Speech speed must be between 0.5x and 2x." }
        val selectedVoice = voice.lowercase()
        val speaker = when (selectedVoice) {
            "female" -> femaleSpeakerId
            "male" -> maleSpeakerId
            else -> throw IllegalArgumentException("Choose female or male voice.")
        }
        val scale = (if (selectedVoice == "male") maleLengthScale else femaleLengthScale) / speed
        val normalized = normalizeInput(text)
        require(normalized.isNotBlank()) { "Enter text to speak." }
        val pieces = splitChunks(normalized)
        val audioParts = ArrayList<FloatArray>()
        val random = Random(System.nanoTime())
        for (chunk in pieces) {
            val ids = encodeCharacters(chunk)
            if (ids.size > MAX_TOKENS) throw IllegalArgumentException("Text is too long. Split it into shorter sentences.")
            val spoken = synthesizeChunk(ids, speaker, random, scale)
            if (spoken.isNotEmpty()) {
                if (audioParts.isNotEmpty()) audioParts.add(FloatArray(pauseSamples))
                audioParts.add(spoken)
            }
        }
        val total = audioParts.sumOf { it.size }
        require(total > 0) { "No supported speech characters found. Use Hindi, Gujarati or English script matching the selected voice." }
        val waveform = FloatArray(total)
        var offset = 0
        audioParts.forEach { part -> part.copyInto(waveform, offset); offset += part.size }
        play(waveform)
    }

    fun synthesizeToWav(text: String, output: File, voice: String = "female", speed: Float = 1.0f): File {
        require(speed in 0.5f..2.0f) { "Speech speed must be between 0.5x and 2x." }
        val selectedVoice = voice.lowercase()
        val speaker = when (selectedVoice) {
            "female" -> femaleSpeakerId
            "male" -> maleSpeakerId
            else -> throw IllegalArgumentException("Choose female or male voice.")
        }
        val scale = (if (selectedVoice == "male") maleLengthScale else femaleLengthScale) / speed
        val normalized = normalizeInput(text)
        require(normalized.isNotBlank()) { "Enter text to speak." }
        val parts = ArrayList<FloatArray>()
        val random = Random(System.nanoTime())
        for (chunk in splitChunks(normalized)) {
            val ids = encodeCharacters(chunk)
            require(ids.size <= MAX_TOKENS) { "Text is too long. Split it into shorter sentences." }
            val spoken = synthesizeChunk(ids, speaker, random, scale)
            if (spoken.isNotEmpty()) {
                if (parts.isNotEmpty()) parts.add(FloatArray(pauseSamples))
                parts.add(spoken)
            }
        }
        val samples = FloatArray(parts.sumOf { it.size })
        var offset = 0
        parts.forEach { it.copyInto(samples, offset); offset += it.size }
        require(samples.isNotEmpty()) { "No supported speech characters found for this voice." }
        writeWav(output, samples)
        return output
    }

    private fun writeWav(output: File, samples: FloatArray) {
        output.parentFile?.mkdirs()
        val dataBytes = samples.size * 2
        java.io.DataOutputStream(output.outputStream().buffered()).use { out ->
            fun ascii(value: String) = out.write(value.toByteArray(Charsets.US_ASCII))
            fun leInt(value: Int) { out.writeByte(value); out.writeByte(value ushr 8); out.writeByte(value ushr 16); out.writeByte(value ushr 24) }
            fun leShort(value: Int) { out.writeByte(value); out.writeByte(value ushr 8) }
            ascii("RIFF"); leInt(36 + dataBytes); ascii("WAVE"); ascii("fmt "); leInt(16)
            leShort(1); leShort(1); leInt(SAMPLE_RATE); leInt(SAMPLE_RATE * 2); leShort(2); leShort(16)
            ascii("data"); leInt(dataBytes)
            samples.forEach { leShort((it.coerceIn(-1f, 1f) * 32767f).toInt()) }
        }
    }

    private fun splitChunks(text: String): List<String> {
        val result = ArrayList<String>()
        val sentences = text.split(Regex("(?<=[।?!.])\\s+"))
        for (sentenceValue in sentences) {
            var sentence = sentenceValue.trim()
            while (sentence.length > 250) {
                var cut = sentence.lastIndexOf(',', 250)
                if (cut <= 0) cut = sentence.lastIndexOf(' ', 250)
                if (cut <= 0) cut = 250
                result.add(sentence.substring(0, cut).trim())
                sentence = sentence.substring(cut).trim()
            }
            if (sentence.isNotBlank()) result.add(sentence)
        }
        return result
    }

    private fun normalizeInput(text: String): String {
        val digitWords = when (language) {
            "hi" -> listOf("शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ")
            "gu" -> listOf("શૂન્ય", "એક", "બે", "ત્રણ", "ચાર", "પાંચ", "છ", "સાત", "આઠ", "નવ")
            else -> listOf("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine")
        }
        val expanded = buildString {
            for (character in text) {
                val digit = when {
                    character in '0'..'9' -> character - '0'
                    language == "hi" && character in '०'..'९' -> character - '०'
                    language == "gu" && character in '૦'..'૯' -> character - '૦'
                    else -> -1
                }
                if (digit >= 0) append(' ').append(digitWords[digit]).append(' ')
                else append(when (character) {
                    '\n', '\r', '\t' -> ' '
                    '“', '”' -> '"'
                    '’', '‘' -> '\''
                    '—', '–' -> '-'
                    else -> character
                })
            }
        }
        return Normalizer.normalize(expanded, Normalizer.Form.NFC)
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun encodeCharacters(text: String): LongArray {
        val chars = ArrayList<Long>()
        for (character in text) {
            val id = tokenIds["c:$character"]
            if (id != null) {
                chars.add(id)
            } else if (Character.isLetter(character) || Character.getType(character) == Character.NON_SPACING_MARK.toInt() ||
                Character.getType(character) == Character.COMBINING_SPACING_MARK.toInt()
            ) {
                throw IllegalArgumentException("Character '$character' is not supported by the selected $language voice. Use Hindi, Gujarati or English script matching this model.")
            } else if (chars.isNotEmpty() && tokenIds.containsKey("c: ")) {
                chars.add(tokenIds.getValue("c: "))
            }
        }
        while (chars.isNotEmpty() && chars.last() == tokenIds["c: "]) chars.removeAt(chars.lastIndex)
        require(chars.isNotEmpty()) { "Enter text in the selected language." }
        val withBlank = LongArray(chars.size * 2 + 1)
        chars.forEachIndexed { index, id -> withBlank[index * 2 + 1] = id }
        return withBlank
    }

    private fun synthesizeChunk(ids: LongArray, speaker: Long, random: Random, scale: Float): FloatArray {
        val tokenTensor = OnnxTensor.createTensor(env, arrayOf(ids))
        val lengthTensor = OnnxTensor.createTensor(env, longArrayOf(ids.size.toLong()))
        val languageTensor = OnnxTensor.createTensor(env, longArrayOf(languageId))
        val speakerTensor = OnnxTensor.createTensor(env, longArrayOf(speaker))
        val styleTensor = OnnxTensor.createTensor(env, longArrayOf(styleId))
        val encoderInputs = mapOf(
            "tokens" to tokenTensor, "token_lengths" to lengthTensor, "language" to languageTensor,
            "speaker" to speakerTensor, "style" to styleTensor
        )
        val encoded = try { encoder.run(encoderInputs) } finally {
            tokenTensor.close(); lengthTensor.close(); languageTensor.close(); speakerTensor.close(); styleTensor.close()
        }
        val muX: Array<Array<FloatArray>>
        val logW: Array<Array<FloatArray>>
        val condition: Array<FloatArray>
        try {
            muX = encoded.get("mu_x").get().value as Array<Array<FloatArray>>
            logW = encoded.get("logw").get().value as Array<Array<FloatArray>>
            condition = encoded.get("cond").get().value as Array<FloatArray>
        } finally { encoded.close() }

        val tokenCount = logW[0][0].size
        val durations = FloatArray(tokenCount)
        var totalDuration = 0.0
        for (i in 0 until tokenCount) {
            val frames = ceil(exp(logW[0][0][i].toDouble())).toFloat() * scale
            durations[i] = frames
            totalDuration += frames.toDouble()
        }
        val yLength = max(1, totalDuration.toInt())
        val padded = ((yLength + 1) / 2) * 2
        require(padded <= MAX_FRAMES) { "The text would generate too much audio. Split it into shorter messages." }

        val muY = Array(1) { Array(MEL_CHANNELS) { FloatArray(padded) } }
        val mask = Array(1) { Array(1) { FloatArray(padded) } }
        var cumulative = 0.0
        for (token in 0 until tokenCount) {
            val start = ceil(cumulative).toInt().coerceAtLeast(0)
            val end = min(yLength, ceil(cumulative + durations[token].toDouble()).toInt())
            for (frame in start until end) {
                if (frame >= yLength) break
                mask[0][0][frame] = 1f
                for (channel in 0 until MEL_CHANNELS) muY[0][channel][frame] = muX[0][channel][token]
            }
            cumulative += durations[token]
        }

        val latent = Array(1) { Array(MEL_CHANNELS) { FloatArray(padded) } }
        for (channel in 0 until MEL_CHANNELS) for (frame in 0 until padded) {
            latent[0][channel][frame] = (random.nextGaussian() * temperature).toFloat()
        }
        val timePoints = FloatArray(timesteps + 1) { it.toFloat() / timesteps.toFloat() }
        for (step in 0 until timesteps) {
            val xTensor = OnnxTensor.createTensor(env, latent)
            val maskTensor = OnnxTensor.createTensor(env, mask)
            val muTensor = OnnxTensor.createTensor(env, muY)
            val timeTensor = OnnxTensor.createTensor(env, floatArrayOf(timePoints[step]))
            val condTensor = OnnxTensor.createTensor(env, condition)
            val result = try {
                flow.run(mapOf("x" to xTensor, "mask" to maskTensor, "mu" to muTensor, "t" to timeTensor, "cond" to condTensor))
            } finally {
                xTensor.close(); maskTensor.close(); muTensor.close(); timeTensor.close(); condTensor.close()
            }
            val velocity = try { result.get("v").get().value as Array<Array<FloatArray>> } finally { result.close() }
            val delta = timePoints[step + 1] - timePoints[step]
            for (channel in 0 until MEL_CHANNELS) for (frame in 0 until padded) {
                latent[0][channel][frame] += delta * velocity[0][channel][frame]
            }
        }

        val mel = Array(1) { Array(MEL_CHANNELS) { FloatArray(yLength) } }
        for (channel in 0 until MEL_CHANNELS) for (frame in 0 until yLength) {
            mel[0][channel][frame] = latent[0][channel][frame] * std + mean
        }
        val melTensor = OnnxTensor.createTensor(env, mel)
        val decoded = try { vocoder.run(mapOf("mel" to melTensor)) } finally { melTensor.close() }
        val real: Array<Array<FloatArray>>
        val imag: Array<Array<FloatArray>>
        try {
            real = decoded.get("real").get().value as Array<Array<FloatArray>>
            imag = decoded.get("imag").get().value as Array<Array<FloatArray>>
        } finally { decoded.close() }
        return inverseStft(real[0], imag[0])
    }

    private fun inverseStft(real: Array<FloatArray>, imag: Array<FloatArray>): FloatArray {
        val frames = real[0].size
        require(frames >= 2) { "TTS generated too few audio frames." }
        val total = FFT_SIZE + HOP_SIZE * (frames - 1)
        val output = DoubleArray(total)
        val envelope = DoubleArray(total)
        val window = DoubleArray(FFT_SIZE) { 0.5 - 0.5 * cos(2.0 * PI * it / FFT_SIZE) }
        for (frame in 0 until frames) {
            val re = DoubleArray(FFT_SIZE)
            val im = DoubleArray(FFT_SIZE)
            for (k in 0..FFT_SIZE / 2) {
                re[k] = real[k][frame].toDouble()
                im[k] = imag[k][frame].toDouble()
                if (k != 0 && k != FFT_SIZE / 2) {
                    re[FFT_SIZE - k] = re[k]
                    im[FFT_SIZE - k] = -im[k]
                }
            }
            fftInverse(re, im)
            val start = frame * HOP_SIZE
            for (i in 0 until FFT_SIZE) {
                output[start + i] += re[i] * window[i]
                envelope[start + i] += window[i] * window[i]
            }
        }
        val cut = FFT_SIZE / 2
        val waveform = FloatArray(total - FFT_SIZE)
        for (i in waveform.indices) {
            val divisor = envelope[i + cut]
            check(divisor > 1e-11) { "Audio reconstruction failed (invalid overlap)." }
            waveform[i] = (output[i + cut] / divisor).toFloat().coerceIn(-1f, 1f)
        }
        return waveform
    }

    private fun fftInverse(real: DoubleArray, imag: DoubleArray) {
        val n = real.size
        var j = 0
        for (i in 1 until n) {
            var bit = n shr 1
            while ((j and bit) != 0) { j = j xor bit; bit = bit shr 1 }
            j = j xor bit
            if (i < j) {
                val tr = real[i]; real[i] = real[j]; real[j] = tr
                val ti = imag[i]; imag[i] = imag[j]; imag[j] = ti
            }
        }
        var len = 2
        while (len <= n) {
            val angle = 2.0 * PI / len
            val wLenRe = cos(angle)
            val wLenIm = kotlin.math.sin(angle)
            var start = 0
            while (start < n) {
                var wr = 1.0; var wi = 0.0
                for (k in 0 until len / 2) {
                    val even = start + k
                    val odd = even + len / 2
                    val vr = real[odd] * wr - imag[odd] * wi
                    val vi = real[odd] * wi + imag[odd] * wr
                    real[odd] = real[even] - vr; imag[odd] = imag[even] - vi
                    real[even] += vr; imag[even] += vi
                    val nextWr = wr * wLenRe - wi * wLenIm
                    wi = wr * wLenIm + wi * wLenRe
                    wr = nextWr
                }
                start += len
            }
            len = len shl 1
        }
        for (i in 0 until n) { real[i] /= n; imag[i] /= n }
    }

    /**
     * Use PCM 16-bit streaming rather than PCM_FLOAT + MODE_STATIC.
     * PCM_FLOAT static tracks are not supported consistently by Android OEM audio
     * drivers and can fail at AudioTrack initialization on otherwise capable phones.
     */
    private fun play(samples: FloatArray) {
        require(samples.isNotEmpty()) { "No audio was generated." }
        val minBuffer = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        check(minBuffer > 0) { "This device does not support 24 kHz mono audio output (code $minBuffer)." }
        val bufferBytes = max(minBuffer * 2, 8 * 1024)
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
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(bufferBytes)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        try {
            activeTrack = track
            check(track.state == AudioTrack.STATE_INITIALIZED) {
                "Audio output could not start. Check media volume and device audio output."
            }
            val pcm = ShortArray(samples.size) { index ->
                (samples[index].coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort()
            }
            track.play()
            var offset = 0
            while (offset < pcm.size) {
                if (track.playState != AudioTrack.PLAYSTATE_PLAYING) {
                    throw IllegalStateException("Audio playback stopped before the voice finished.")
                }
                val written = track.write(pcm, offset, pcm.size - offset, AudioTrack.WRITE_BLOCKING)
                check(written > 0) { "Audio output write failed (code $written)." }
                offset += written
            }
            val expectedFrames = pcm.size
            val deadline = android.os.SystemClock.elapsedRealtime() +
                (expectedFrames * 1000L / SAMPLE_RATE) + 3000L
            while (track.playState == AudioTrack.PLAYSTATE_PLAYING &&
                track.playbackHeadPosition.toLong() < expectedFrames &&
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

    fun stop() { runCatching { activeTrack?.stop() } }

    override fun close() {
        stop()
        encoder.close()
        flow.close()
        vocoder.close()
    }

    companion object {
        private const val SAMPLE_RATE = 24_000
        private const val MEL_CHANNELS = 100
        private const val FFT_SIZE = 1024
        private const val HOP_SIZE = 256
        private const val MAX_TOKENS = 2048
        private const val MAX_FRAMES = 12_000

        private fun sha256(file: File): String {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
            file.inputStream().buffered().use { input ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    digest.update(buffer, 0, count)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }

        fun create(context: Context, language: String): IndicTinyTtsEngine {
            val code = language.lowercase()
            require(code in listOf("hi", "gu", "en")) { "Indic Tiny TTS supports Hindi, Gujarati and English." }
            val pack = SpeechModelCatalog.indicTinyTts(code)
            check(OfflineSpeechEngineFactory.isReady(context, pack)) { "Indic Tiny TTS $code is not fully downloaded." }
            val directory = File(context.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS), "workly-voice-models/${pack.id}")
            val config = JSONObject(File(directory, "config.json").readText())
            val symbols = config.getJSONObject("vocab").getJSONArray("symbols")
            val tokens = HashMap<String, Long>(symbols.length())
            for (index in 0 until symbols.length()) tokens[symbols.getString(index)] = index.toLong()
            val ids = config.getJSONObject("ids")
            val voices = ids.getJSONObject("speakers")
            val voicePrefix = when (code) { "hi" -> "hi_"; "gu" -> "gu_"; else -> "en_lim_" }
            val femaleName = voices.keys().asSequence().firstOrNull { it.startsWith(voicePrefix) && it.endsWith("_F") }
                ?: voices.keys().asSequence().firstOrNull { it.startsWith(voicePrefix) && it.endsWith("_M") }
                ?: throw IllegalStateException("Speaker IDs are missing from the model config.")
            val maleName = voices.keys().asSequence().firstOrNull { it.startsWith(voicePrefix) && it.endsWith("_M") } ?: femaleName
            val env = OrtEnvironment.getEnvironment()
            val options = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(Runtime.getRuntime().availableProcessors().coerceIn(2, 4))
                setInterOpNumThreads(1)
            }
            try {
                val base = File(directory, "onnx")
                val encoderFile = File(base, "text_encoder.onnx")
                val flowFile = File(base, "flow_decoder.onnx")
                val vocoderFile = File(base, "vocoder.onnx")
                val expectedHashes = when (code) {
                    "hi" -> listOf("38df505ea822800d91a13bdc4a670f81ee964e9e0fe24a705590859fe7cfd08f", "923a0472ec4d4c05c43bfc8ea512f8f762cf447b9f6ce1f01043144e1f6d1252", "44d36238a761750447038895ab194e2378f6f4ba2c2d089a4766fa52810ef353")
                    "gu" -> listOf("275820514eace183d8028a8a726cd69c8c3fe2eeec9ba8bbc71cc03162b5bc63", "4bd15fafdc493974198a6cfa9e9797da3b6c7b00ff12536ae8a1283e2aa58f19", "44d36238a761750447038895ab194e2378f6f4ba2c2d089a4766fa52810ef353")
                    else -> listOf("e2e6f4cac08a0b4f8a39e4306df42066930b90fbce27a70453aaa68f91c74873", "5b6a911751f8dfd8e01feb05ae281c4bfde7cb6df2e90ae7870b3685dc582d05", "44d36238a761750447038895ab194e2378f6f4ba2c2d089a4766fa52810ef353")
                }
                listOf(encoderFile, flowFile, vocoderFile).zip(expectedHashes).forEach { (file, expected) ->
                    check(file.isFile && file.length() > 1_000_000L) { "Indic Tiny TTS model file is missing: ${file.name}" }
                    check(sha256(file) == expected) { "Indic Tiny TTS checksum failed for ${file.name}. Delete this pack and download it again." }
                }
                val encoder = env.createSession(encoderFile.absolutePath, options)
                val flow = env.createSession(flowFile.absolutePath, options)
                val vocoder = env.createSession(vocoderFile.absolutePath, options)
                val stats = config.getJSONArray("mel_stats")
                val synthesis = config.getJSONObject("synthesis")
                val scaleObject = synthesis.getJSONObject("length_scale")
                val femaleScale = scaleObject.optDouble(femaleName, 1.0).toFloat()
                val maleScale = scaleObject.optDouble(maleName, femaleScale.toDouble()).toFloat()
                return IndicTinyTtsEngine(
                    env, encoder, flow, vocoder, code,
                    voices.getLong(femaleName), voices.getLong(maleName), ids.getLong("language"), ids.getJSONObject("styles").getLong("read"),
                    tokens, stats.getDouble(0).toFloat(), stats.getDouble(1).toFloat(), femaleScale, maleScale,
                    synthesis.optInt("n_timesteps", 4), synthesis.optDouble("temperature", 0.667).toFloat(),
                    (synthesis.optDouble("sentence_pause_s", 0.15) * SAMPLE_RATE).toInt()
                )
            } catch (error: Exception) {
                options.close()
                throw error
            }
        }
    }
}
