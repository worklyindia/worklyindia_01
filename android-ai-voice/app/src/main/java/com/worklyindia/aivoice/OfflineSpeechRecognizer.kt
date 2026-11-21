package com.worklyindia.aivoice

import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineMoonshineModelConfig
import com.k2fsa.sherpa.onnx.OfflineNemoEncDecCtcModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import java.io.File

/**
 * File-backed offline ASR adapters.
 *
 * Audio must be mono Float32 PCM at 16 kHz. Call from a worker thread:
 * model loading and decoding are CPU-intensive.
 */
class OfflineSpeechRecognizer private constructor(
    private val recognizer: OfflineRecognizer
) : AutoCloseable {

    fun transcribe(samples16kMono: FloatArray): String {
        require(samples16kMono.isNotEmpty()) { "No audio samples were supplied." }
        val stream = recognizer.createStream()
        return try {
            stream.acceptWaveform(samples16kMono, SAMPLE_RATE)
            recognizer.decode(stream)
            recognizer.getResult(stream).text.trim()
        } finally {
            stream.release()
        }
    }

    override fun close() {
        recognizer.release()
    }

    companion object {
        const val SAMPLE_RATE = 16_000

        /**
         * AI4Bharat IndicConformer CTC INT8 export. Use the matching per-language
         * model (hi or gu) and the repository's shared tokens.txt.
         */
        fun indicConformer(modelFile: File, tokensFile: File): OfflineSpeechRecognizer {
            requireModel(modelFile)
            requireModel(tokensFile)
            val config = OfflineRecognizerConfig(
                featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
                modelConfig = OfflineModelConfig(
                    nemo = OfflineNemoEncDecCtcModelConfig(model = modelFile.absolutePath),
                    tokens = tokensFile.absolutePath,
                    numThreads = inferenceThreads(),
                    provider = "cpu"
                )
            )
            return OfflineSpeechRecognizer(OfflineRecognizer(config = config))
        }

        /**
         * Shruti's Android sherpa-onnx Moonshine pack. One pack per Indian
         * language; it also recognizes English and code-switched speech.
         */
        fun shruti(modelDirectory: File): OfflineSpeechRecognizer {
            val preprocessor = File(modelDirectory, "preprocess.onnx")
            val encoder = File(modelDirectory, "encode.onnx")
            val uncached = File(modelDirectory, "uncached_decode.onnx")
            val cached = File(modelDirectory, "cached_decode.onnx")
            val tokens = File(modelDirectory, "tokens.txt")
            listOf(preprocessor, encoder, uncached, cached, tokens).forEach(::requireModel)

            val config = OfflineRecognizerConfig(
                featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
                modelConfig = OfflineModelConfig(
                    moonshine = OfflineMoonshineModelConfig(
                        preprocessor = preprocessor.absolutePath,
                        encoder = encoder.absolutePath,
                        uncachedDecoder = uncached.absolutePath,
                        cachedDecoder = cached.absolutePath
                    ),
                    tokens = tokens.absolutePath,
                    numThreads = inferenceThreads(),
                    provider = "cpu"
                )
            )
            return OfflineSpeechRecognizer(OfflineRecognizer(config = config))
        }

        private fun inferenceThreads(): Int = Runtime.getRuntime().availableProcessors().coerceIn(2, 4)

        private fun requireModel(file: File) {
            require(file.isFile && file.length() > 0L) {
                "Required offline speech model file is missing: ${file.name}"
            }
        }
    }
}
