package com.worklyindia.aivoice

import java.io.File

/**
 * On-device Qwen GGUF inference through the pinned llama.cpp Android native build.
 * Call loadModel/generate from a background executor, never the Android main thread.
 */
class OfflineAiEngine {
    companion object {
        const val MIN_VALID_MODEL_BYTES = 400_000_000L
        // The JNI runtime owns one process-wide llama model. Keep Kotlin state and
        // lifecycle operations process-wide too, so a model test cannot leave a
        // different Activity believing that an unloaded native model is still ready.
        private val processLock = Any()
        @Volatile private var loadedModelPath: String? = null
    }

    val isLoaded: Boolean get() = loadedModelPath != null
    private val nativeAvailable = runCatching { System.loadLibrary("worklyllama") }.isSuccess
    @Volatile private var partialResponseListener: ((String) -> Unit)? = null

    @Suppress("unused")
    private fun onNativeToken(value: String) {
        partialResponseListener?.invoke(value)
    }

    fun loadModel(file: File): Boolean = synchronized(processLock) {
        check(nativeAvailable) { "The offline AI native engine is not available in this app build." }
        if (!file.isFile || file.length() < MIN_VALID_MODEL_BYTES) {
            throw IllegalStateException("The offline AI model file is missing or incomplete.")
        }
        val loaded = nativeLoadModel(file.absolutePath)
        loadedModelPath = if (loaded) file.absolutePath else null
        loaded
    }

    fun generate(prompt: String, onPartial: (String) -> Unit = {}): String = synchronized(processLock) {
        check(loadedModelPath != null) { "Load the offline AI model first." }
        require(prompt.isNotBlank()) { "Enter a message first." }
        partialResponseListener = onPartial
        try {
            // 160 tokens gives the small on-device models room to answer fully,
            // while keeping replies bounded for mobile latency and memory.
            val result = nativeGenerate(prompt.trim().take(4000), 160).trim()
            check(result.isNotEmpty()) { "The model returned an empty response. Try a shorter message or reload the model." }
            result
        } finally {
            partialResponseListener = null
        }
    }

    fun unload() = synchronized(processLock) {
        if (loadedModelPath != null) nativeUnloadModel()
        loadedModelPath = null
    }

    private external fun nativeLoadModel(modelPath: String): Boolean
    private external fun nativeGenerate(prompt: String, maxTokens: Int): String
    private external fun nativeUnloadModel()
}
