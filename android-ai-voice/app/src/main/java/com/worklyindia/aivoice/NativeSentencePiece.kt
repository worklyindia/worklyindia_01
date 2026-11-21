package com.worklyindia.aivoice

/** Native SentencePiece adapter used by MOSS-TTS-Nano's downloaded tokenizer.model. */
object NativeSentencePiece {
    init {
        System.loadLibrary("workly_qvac_tts_jni")
    }

    @JvmStatic
    external fun encode(modelPath: String, text: String): IntArray
}
