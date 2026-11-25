package com.worklyindia.aivoice

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.nio.ByteOrder
import kotlin.math.roundToInt

/** Decodes a selected audio document to mono Float32 PCM at 16 kHz without network access. */
object AudioFileDecoder {
    private const val TARGET_RATE = OfflineSpeechRecognizer.SAMPLE_RATE
    private const val MAX_DURATION_US = 30L * 60L * 1_000_000L

    fun decode(context: Context, uri: Uri): FloatArray {
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null
        try {
            extractor.setDataSource(context, uri, null)
            var track = -1
            var format: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val candidate = extractor.getTrackFormat(i)
                val mime = candidate.getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) { track = i; format = candidate; break }
            }
            check(track >= 0 && format != null) { "This file does not contain a supported audio track." }
            val sourceFormat = format!!
            val durationUs = if (sourceFormat.containsKey(MediaFormat.KEY_DURATION)) sourceFormat.getLong(MediaFormat.KEY_DURATION) else 0L
            require(durationUs <= MAX_DURATION_US) { "For reliable on-device processing, choose audio up to 30 minutes." }
            extractor.selectTrack(track)
            val mime = sourceFormat.getString(MediaFormat.KEY_MIME)!!
            codec = MediaCodec.createDecoderByType(mime)
            codec.configure(sourceFormat, null, null, 0)
            codec.start()

            val output = FloatSamples()
            val info = MediaCodec.BufferInfo()
            var inputDone = false
            var outputDone = false
            var sourceRate = sourceFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = sourceFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var pcmEncoding = android.media.AudioFormat.ENCODING_PCM_16BIT

            while (!outputDone) {
                if (!inputDone) {
                    val inputIndex = codec.dequeueInputBuffer(10_000)
                    if (inputIndex >= 0) {
                        val input = codec.getInputBuffer(inputIndex)!!
                        val size = extractor.readSampleData(input, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(inputIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            codec.queueInputBuffer(inputIndex, 0, size, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }

                when (val outputIndex = codec.dequeueOutputBuffer(info, 10_000)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val outFormat = codec.outputFormat
                        sourceRate = outFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channels = outFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        if (outFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) pcmEncoding = outFormat.getInteger(MediaFormat.KEY_PCM_ENCODING)
                    }
                    MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                    else -> if (outputIndex >= 0) {
                        val buffer = codec.getOutputBuffer(outputIndex)
                        if (buffer != null && info.size > 0) {
                            buffer.position(info.offset)
                            buffer.limit(info.offset + info.size)
                            val samples = decodePcm(buffer.slice().order(ByteOrder.LITTLE_ENDIAN), pcmEncoding, channels)
                            output.appendResampledMono(samples, sourceRate)
                        }
                        outputDone = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
                        codec.releaseOutputBuffer(outputIndex, false)
                    }
                }
            }
            return output.toArray()
        } finally {
            runCatching { codec?.stop() }
            runCatching { codec?.release() }
            extractor.release()
        }
    }

    private fun decodePcm(buffer: java.nio.ByteBuffer, encoding: Int, channels: Int): FloatArray {
        val bytesPerSample = if (encoding == android.media.AudioFormat.ENCODING_PCM_FLOAT) 4 else 2
        val frames = buffer.remaining() / (bytesPerSample * channels.coerceAtLeast(1))
        val mono = FloatArray(frames)
        for (frame in 0 until frames) {
            var sum = 0f
            for (channel in 0 until channels) {
                sum += if (encoding == android.media.AudioFormat.ENCODING_PCM_FLOAT) buffer.float
                else buffer.short / 32768f
            }
            mono[frame] = (sum / channels).coerceIn(-1f, 1f)
        }
        return mono
    }

    private class FloatSamples {
        private var data = FloatArray(16_384)
        private var size = 0
        fun appendResampledMono(input: FloatArray, inputRate: Int) {
            if (input.isEmpty() || inputRate <= 0) return
            val outputCount = (input.size.toDouble() * TARGET_RATE / inputRate).roundToInt().coerceAtLeast(1)
            ensure(size + outputCount)
            for (i in 0 until outputCount) {
                val sourcePosition = i.toDouble() * inputRate / TARGET_RATE
                val left = sourcePosition.toInt().coerceIn(0, input.lastIndex)
                val right = (left + 1).coerceAtMost(input.lastIndex)
                val fraction = (sourcePosition - left).toFloat()
                data[size++] = input[left] * (1f - fraction) + input[right] * fraction
            }
            require(size <= TARGET_RATE * 60 * 30) { "Audio exceeds the 30-minute offline limit." }
        }
        private fun ensure(required: Int) {
            if (required > data.size) data = data.copyOf(maxOf(required, data.size * 2))
        }
        fun toArray(): FloatArray = data.copyOf(size)
    }
}
