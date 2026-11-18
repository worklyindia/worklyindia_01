package com.worklyindia.aivoice

import java.io.File

/**
 * On-device Qwen GGUF inference through the pinned llama.cpp Android native build.
 * Call loadModel/generate from a background executor, never the Android main thread.
 */
class OfflineAiEngine {
    @Volatile
    var isLoaded: Boolean = false
        private set

    init {
        System.loadLibrary("worklyllama")
    }

    @Synchronized
    fun loadModel(file: File): Boolean {
        if (!file.isFile || file.length() < OfflineModelManager.MIN_VALID_MODEL_BYTES) {
            throw IllegalStateException("The offline AI model file is missing or incomplete.")
        }
        isLoaded = nativeLoadModel(file.absolutePath)
        return isLoaded
    }

    @Synchronized
    fun generate(prompt: String): String {
        check(isLoaded) { "Load the offline AI model first." }
        require(prompt.isNotBlank()) { "Enter a message first." }
        return nativeGenerate(prompt.trim().take(6000), 192)
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
