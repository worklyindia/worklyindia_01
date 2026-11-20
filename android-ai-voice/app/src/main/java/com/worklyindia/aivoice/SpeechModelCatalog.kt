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
    private const val TINY_GU = "https://huggingface.co/sulabhkatiyar/indic-tiny-tts-gujarati/resolve/main"
    private const val TINY_HI = "https://huggingface.co/sulabhkatiyar/indic-tiny-tts-hindi/resolve/main"
    private const val TINY_EN = "https://huggingface.co/sulabhkatiyar/indic-tiny-tts-english/resolve/main"

    // IndicConformer CTC INT8 exports: all 22 scheduled Indian languages plus English.
    // Each Indian-language ONNX file is approximately 197.6 MB; shared tokens are 67,605 bytes.
    private val indicConformerBytes = mapOf(
        "as" to 197_595_509L, "bn" to 197_595_578L, "brx" to 197_584_960L,
        "doi" to 197_584_880L, "gu" to 197_595_461L, "hi" to 197_595_593L,
        "kn" to 197_595_728L, "kok" to 197_585_030L, "ks" to 197_584_968L,
        "mai" to 197_585_045L, "ml" to 197_595_555L, "mni" to 197_585_042L,
        "mr" to 197_595_593L, "ne" to 197_585_135L, "or" to 197_584_928L,
        "pa" to 197_595_548L, "sa" to 197_585_030L, "sat" to 197_584_818L,
        "sd" to 197_584_945L, "ta" to 197_595_513L, "te" to 197_595_693L,
        "ur" to 197_585_089L, "en" to 174_610_057L
    )

    fun indicConformer(language: String): Pack {
        val code = language.lowercase()
        val modelBytes = indicConformerBytes[code]
            ?: throw IllegalArgumentException("IndicConformer language is not supported: $code")
        val isEnglish = code == "en"
        return Pack(
            id = "indicconformer-$code",
            title = "AI4Bharat IndicConformer INT8",
            languageCode = code,
            license = "MIT (source model); see repository README for export provenance",
            repository = "parismitaglobalsolutions/indicconformer-sherpa-onnx",
            files = listOf(
                ModelFile("$code/model.int8.onnx", "$INDICCONFORMER/$code/model.int8.onnx", modelBytes),
                ModelFile("tokens.txt", if (isEnglish) "$INDICCONFORMER/en/tokens.txt" else "$INDICCONFORMER/tokens.txt", if (isEnglish) 11_433L else 67_605L)
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

    private const val MOSS_TTS = "https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX/resolve/main"
    private const val MOSS_CODEC = "https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX/resolve/main"

    /**
     * MOSS-TTS-Nano 100M Android ONNX package. Model weights are downloaded
     * separately from the APK; this pack is roughly 712 MB and requires
     * substantial free storage and RAM. The Android smoke test uses the
     * upstream pre-tokenized English/Chinese prompts until a full SentencePiece
     * tokenizer adapter is added.
     */
    fun mossTtsNano(): Pack = Pack(
        id = "moss-tts-nano",
        title = "MOSS-TTS-Nano 100M",
        languageCode = "en",
        license = "Apache-2.0",
        repository = "OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX + OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX",
        files = listOf(
            ModelFile("MOSS-TTS-Nano-100M-ONNX/browser_poc_manifest.json", "$MOSS_TTS/browser_poc_manifest.json", 503_354L),
            ModelFile("MOSS-TTS-Nano-100M-ONNX/tts_browser_onnx_meta.json", "$MOSS_TTS/tts_browser_onnx_meta.json", 4_487L),
            ModelFile("MOSS-TTS-Nano-100M-ONNX/tokenizer.model", "$MOSS_TTS/tokenizer.model", 470_897L, "c353ee1479b536bf414c1b247f5542b6607fb8ae91320e5af1781fee200fddff"),
            ModelFile("MOSS-TTS-Nano-100M-ONNX/moss_tts_prefill.onnx", "$MOSS_TTS/moss_tts_prefill.onnx", 283_305L),
            ModelFile("MOSS-TTS-Nano-100M-ONNX/moss_tts_decode_step.onnx", "$MOSS_TTS/moss_tts_decode_step.onnx", 291_483L),
            ModelFile("MOSS-TTS-Nano-100M-ONNX/moss_tts_local_fixed_sampled_frame.onnx", "$MOSS_TTS/moss_tts_local_fixed_sampled_frame.onnx", 471_262L),
            ModelFile("MOSS-TTS-Nano-100M-ONNX/moss_tts_global_shared.data", "$MOSS_TTS/moss_tts_global_shared.data", 440_813_568L),
            ModelFile("MOSS-TTS-Nano-100M-ONNX/moss_tts_local_shared.data", "$MOSS_TTS/moss_tts_local_shared.data", 229_678_080L),
            ModelFile("MOSS-Audio-Tokenizer-Nano-ONNX/codec_browser_onnx_meta.json", "$MOSS_CODEC/codec_browser_onnx_meta.json", 17_036L),
            ModelFile("MOSS-Audio-Tokenizer-Nano-ONNX/moss_audio_tokenizer_decode_full.onnx", "$MOSS_CODEC/moss_audio_tokenizer_decode_full.onnx", 681_902L),
            ModelFile("MOSS-Audio-Tokenizer-Nano-ONNX/moss_audio_tokenizer_decode_shared.data", "$MOSS_CODEC/moss_audio_tokenizer_decode_shared.data", 44_198_912L)
        )
    )


    /**
     * Qwen3-TTS 0.6B Base, GGUF Q4_K_M. This model uses the isolated
     * qwen3-tts.cpp native Android arm64 runtime (API 31+).
     */
    fun qwen3Tts(): Pack = Pack(
        id = "qwen3-tts-06b-q4",
        title = "Qwen3-TTS 0.6B CustomVoice · Q4_K_M",
        languageCode = "en",
        license = "Apache-2.0 (Qwen3-TTS model); MIT (qwen3-tts.cpp runtime)",
        repository = "Serveurperso/Qwen3-TTS-GGUF",
        files = listOf(
            ModelFile(
                "qwen-talker-0.6b-customvoice-Q4_K_M.gguf",
                "https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF/resolve/main/qwen-talker-0.6b-base-Q4_K_M.gguf",
                604_878_080L
            ),
            ModelFile(
                "qwen-tokenizer-12hz-Q4_K_M.gguf",
                "https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF/resolve/main/qwen-tokenizer-12hz-Q4_K_M.gguf",
                254_974_752L
            )
        )
    )


    private const val CHATTERBOX_GGUF = "https://huggingface.co/cstr/chatterbox-GGUF/resolve/main"
    private const val COSYVOICE_GGUF = "https://huggingface.co/cstr/cosyvoice3-0.5b-2512-GGUF/resolve/main"
    private const val COSYVOICE_BASE = "https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512/resolve/main/CosyVoice-BlankEN"

    /** QVAC native multilingual Chatterbox pack (Hindi included). */
    fun chatterboxMultilingual(): Pack = Pack(
        id = "qvac-chatterbox-multilingual",
        title = "Chatterbox Multilingual · Q4_K",
        languageCode = "hi",
        license = "MIT model weights; MIT native runtime",
        repository = "cstr/chatterbox-GGUF",
        files = listOf(
            ModelFile("chatterbox-t3-q4_k.gguf", "$CHATTERBOX_GGUF/chatterbox-t3-q4_k.gguf", 382_171_840L),
            ModelFile("chatterbox-s3gen-q4_k.gguf", "$CHATTERBOX_GGUF/chatterbox-s3gen-q4_k.gguf", 254_658_880L)
        )
    )

    /**
     * CosyVoice3 Android native GGUF bundle. Includes the small tokenizer
     * files and reference audio needed by the native zero-shot voice path.
     */
    fun cosyVoice3(): Pack = Pack(
        id = "qvac-cosyvoice3",
        title = "CosyVoice 3 · Q4/Q8",
        languageCode = "en",
        license = "Apache-2.0 model weights; MIT native runtime; sample voice attribution in upstream repository",
        repository = "cstr/cosyvoice3-0.5b-2512-GGUF + FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
        files = listOf(
            ModelFile("cosyvoice3-llm-q4_k.gguf", "$COSYVOICE_GGUF/cosyvoice3-llm-q4_k.gguf", 383_891_200L),
            ModelFile("cosyvoice3-flow-q8_0.gguf", "$COSYVOICE_GGUF/cosyvoice3-flow-q8_0.gguf", 360_751_936L),
            ModelFile("cosyvoice3-hift-f16.gguf", "$COSYVOICE_GGUF/cosyvoice3-hift-f16.gguf", 41_601_888L),
            ModelFile("cosyvoice3-s3tok-q4_k.gguf", "$COSYVOICE_GGUF/cosyvoice3-s3tok-q4_k.gguf", 145_258_240L),
            ModelFile("cosyvoice3-campplus-f16.gguf", "$COSYVOICE_GGUF/cosyvoice3-campplus-f16.gguf", 14_153_600L),
            ModelFile("vocab.json", "$COSYVOICE_BASE/vocab.json", 2_776_833L),
            ModelFile("merges.txt", "$COSYVOICE_BASE/merges.txt", 1_402_109L),
            ModelFile("zero_shot_prompt.wav", "https://raw.githubusercontent.com/lcretan/FunAudioLLM.CosyVoice/main/zero_shot_prompt.wav", 111_496L)
        )
    )

}
