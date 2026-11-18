package com.worklyindia.aivoice

/**
 * Verified model-pack metadata for optional offline Indian-language speech engines.
 *
 * These packs are deliberately not bundled in the APK. Download them only after
 * the user accepts the app's existing Wi-Fi/mobile-data consent.
 *
 * Repository layouts and byte sizes were checked against the Hugging Face Hub.
 * Do not mark a pack READY until every listed file has been downloaded and
 * validated. Model loading/inference is handled by the engine adapters.
 */
object SpeechModelCatalog {
    data class ModelFile(
        val relativePath: String,
        val url: String,
        val expectedBytes: Long,
        val sha256: String? = null
    )

    data class Pack(
        val id: String,
        val title: String,
        val languageCode: String,
        val license: String,
        val repository: String,
        val files: List<ModelFile>
    ) {
        val totalBytes: Long get() = files.sumOf { it.expectedBytes }
    }

    private const val INDICCONFORMER = "https://huggingface.co/parismitaglobalsolutions/indicconformer-sherpa-onnx/resolve/main"
    private const val SHRUTI = "https://huggingface.co/udgamlabs/Shruti-ONNX/resolve/main"
    private const val TINY_GU = "https://huggingface.co/sulabhkatiyar/indic-tiny-tts-gujarati/resolve/main"
    private const val TINY_HI = "https://huggingface.co/sulabhkatiyar/indic-tiny-tts-hindi/resolve/main"
    private const val TINY_EN = "https://huggingface.co/sulabhkatiyar/indic-tiny-tts-english/resolve/main"

    // AI4Bharat-derived IndicConformer CTC INT8 exports (shared tokens + language model).
    // Per-language ONNX files are ~198 MB; shared tokens are 67,605 bytes.
    fun indicConformer(language: String): Pack {
        val code = language.lowercase()
        require(code == "hi" || code == "gu") { "IndicConformer supports Hindi (hi) and Gujarati (gu) in this app." }
        val modelBytes = if (code == "hi") 197_595_593L else 197_595_461L
        return Pack(
            id = "indicconformer-$code",
            title = "AI4Bharat IndicConformer INT8",
            languageCode = code,
            license = "MIT (source model); see repository README for export provenance",
            repository = "parismitaglobalsolutions/indicconformer-sherpa-onnx",
            files = listOf(
                ModelFile("model.int8.onnx", "$INDICCONFORMER/$code/model.int8.onnx", modelBytes),
                ModelFile("tokens.txt", "$INDICCONFORMER/tokens.txt", 67_605L)
            )
        )
    }

    // Shruti ships sherpa-onnx Moonshine packs. Do not use the ONNX Runtime
    // folder here: the Android adapter expects the sherpa-onnx file layout.
    fun shruti(language: String): Pack {
        val code = language.lowercase()
        require(code == "hi" || code == "gu") { "Shruti supports Hindi (hi) and Gujarati (gu) in this app." }
        val root = "$SHRUTI/$code/sherpa-onnx"
        val prefix = if (code == "hi") "hi" else "gu"
        return Pack(
            id = "shruti-$code",
            title = "Shruti ONNX",
            languageCode = code,
            license = "Apache-2.0",
            repository = "udgamlabs/Shruti-ONNX",
            files = listOf(
                ModelFile("preprocess.onnx", "$root/preprocess.onnx", 912_310L),
                ModelFile("encode.onnx", "$root/encode.onnx", 19_637_087L),
                ModelFile("uncached_decode.onnx", "$root/uncached_decode.onnx", 421_454L),
                ModelFile("cached_decode.onnx", "$root/cached_decode.onnx", 32_801_767L),
                ModelFile("tokens.txt", "$root/tokens.txt", if (prefix == "hi") 110_114L else 120_164L)
            )
        )
    }

    // Indic Tiny TTS ONNX graphs. The ONNX manifest carries the authoritative
    // SHA-256 values; size checks alone are not a substitute for checksum checks.
    fun indicTinyTts(language: String): Pack {
        val code = language.lowercase()
        val (base, encoderBytes, languageName) = when (code) {
            "gu" -> Triple(TINY_GU, 17_694_814L, "Gujarati")
            "hi" -> Triple(TINY_HI, 17_695_838L, "Hindi")
            "en" -> Triple(TINY_EN, 17_692_766L, "English")
            else -> throw IllegalArgumentException("Indic Tiny TTS supports Gujarati, Hindi and English.")
        }
        return Pack(
            id = "indic-tiny-tts-$code",
            title = "Indic Tiny TTS · $languageName",
            languageCode = code,
            license = "CC-BY-4.0 model weights; review repository LICENSE.md and NOTICE",
            repository = "sulabhkatiyar/indic-tiny-tts-$code",
            files = listOf(
                ModelFile("config.json", "$base/config.json", if (code == "gu") 3_299L else if (code == "hi") 3_443L else 3_039L),
                ModelFile("onnx/text_encoder.onnx", "$base/onnx/text_encoder.onnx", encoderBytes, when (code) {
                    "hi" -> "38df505ea822800d91a13bdc4a670f81ee964e9e0fe24a705590859fe7cfd08f"
                    "gu" -> "275820514eace183d8028a8a726cd69c8c3fe2eeec9ba8bbc71cc03162b5bc63"
                    else -> "e2e6f4cac08a0b4f8a39e4306df42066930b90fbce27a70453aaa68f91c74873"
                }),
                ModelFile("onnx/flow_decoder.onnx", "$base/onnx/flow_decoder.onnx", 19_169_253L, when (code) {
                    "hi" -> "923a0472ec4d4c05c43bfc8ea512f8f762cf447b9f6ce1f01043144e1f6d1252"
                    "gu" -> "4bd15fafdc493974198a6cfa9e9797da3b6c7b00ff12536ae8a1283e2aa58f19"
                    else -> "5b6a911751f8dfd8e01feb05ae281c4bfde7cb6df2e90ae7870b3685dc582d05"
                }),
                ModelFile("onnx/vocoder.onnx", "$base/onnx/vocoder.onnx", 54_150_036L, "44d36238a761750447038895ab194e2378f6f4ba2c2d089a4766fa52810ef353"),
                ModelFile("onnx/onnx_manifest.json", "$base/onnx/onnx_manifest.json", if (code == "gu") 3_115L else if (code == "hi") 3_117L else 3_118L)
            )
        )
    }
}
