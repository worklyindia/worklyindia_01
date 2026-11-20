package com.worklyindia.aivoice

import android.content.Context
import android.os.Environment
import java.io.File

/**
 * Resolves downloaded speech packs and creates the matching Sherpa-ONNX engine.
 * Must be called from a worker thread; model initialization loads native weights.
 */
object OfflineSpeechEngineFactory {
    fun isReady(context: Context, pack: SpeechModelCatalog.Pack): Boolean {
        val directory = packDirectory(context, pack)
        return pack.files.all { modelFile ->
            val file = File(directory, modelFile.relativePath)
            file.isFile && file.length() == modelFile.expectedBytes
        }
    }

    fun openIndicConformer(
        context: Context,
        language: String
    ): OfflineSpeechRecognizer {
        val pack = SpeechModelCatalog.indicConformer(language)
        check(isReady(context, pack)) { "${pack.title} (${pack.languageCode}) is not fully downloaded." }
        val directory = packDirectory(context, pack)
        return OfflineSpeechRecognizer.indicConformer(
            File(directory, "model.int8.onnx"),
            File(directory, "tokens.txt")
        )
    }

    private fun packDirectory(context: Context, pack: SpeechModelCatalog.Pack): File {
        return File(
            context.applicationContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            "workly-voice-models/${pack.id}"
        )
    }
}
