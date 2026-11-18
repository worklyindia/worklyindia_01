package com.worklyindia.aivoice

import java.io.File

/**
 * On-device Qwen GGUF inference through the pinned llama.cpp Android native build.
 * Call loadModel/generate from a background executor, never the Android main thread.
 */
class OfflineAiEngine {
    companion object { const val MIN_VALID_MODEL_BYTES = 400_000_000L }
    @Volatile
    var isLoaded: Boolean = false
        private set

    private val nativeAvailable = runCatching { System.loadLibrary("worklyllama") }.isSuccess

    @Synchronized
    fun loadModel(file: File): Boolean {
        check(nativeAvailable) { "The offline AI native engine is not available in this app build." }
        if (!file.isFile || file.length() < MIN_VALID_MODEL_BYTES) {
            throw IllegalStateException("The offline AI model file is missing or incomplete.")
        }
        isLoaded = nativeLoadModel(file.absolutePath)
        return isLoaded
    }

    @Synchronized
    fun generate(prompt: String): String {
        check(isLoaded) { "Load the offline AI model first." }
        require(prompt.isNotBlank()) { "Enter a message first." }
        val result = nativeGenerate(prompt.trim().take(4000), 96).trim()
        check(result.isNotEmpty()) { "The model returned an empty response. Try a shorter message or reload the model." }
        return result
    }

    @Synchronized
    fun unload() {
        if (isLoaded) nativeUnloadModel()
        isLoaded = false
    }

    private external fun nativeLoadModel(modelPath: String): Boolean
    private external fun nativeGenerate(prompt: String, maxTokens: Int): String
    private external fun nativeUnloadModel()
}
