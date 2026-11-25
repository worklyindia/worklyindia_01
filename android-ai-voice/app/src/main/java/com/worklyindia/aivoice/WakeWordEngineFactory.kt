package com.worklyindia.aivoice

import android.content.Context
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest

/** Installs and opens the official small English Sherpa-ONNX keyword spotter. */
object WakeWordEngineFactory {
    private data class RequiredFile(val name: String, val bytes: Long, val sha256: String)

    private val requiredFiles = listOf(
        RequiredFile(
            "encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
            4_000_908L,
            "7d5a25fbc14b423074fe0c58e1be388ccf3f1a815c649980232a0c47f81875e4"
        ),
        RequiredFile(
            "decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
            1_063_189L,
            "f61ebd3eed3773a44d088d53dfae92dbb6aec4839f4dcaee2d402414741663a3"
        ),
        RequiredFile(
            "joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
            163_380L,
            "eae9da0c7e1e6c6a3f4cc42d167899c388f6c6701b94cb96320e4f55df79624c"
        ),
        RequiredFile(
            "tokens.txt",
            5_006L,
            "fd2ded4050a55d2b1578870ba8697d02371980217806b7558bd0a5cc60f3ba53"
        ),
        RequiredFile(
            "bpe.model",
            244_837L,
            "c8a2a0129c4ab8e463164c142f82d25649661b122c8cd0b7aab5c9e80b90ad24"
        )
    )

    class Session internal constructor(
        val spotter: KeywordSpotter,
        val stream: OnlineStream
    ) : AutoCloseable {
        override fun close() {
            runCatching { stream.release() }
            runCatching { spotter.release() }
        }
    }

    fun isReady(context: Context): Boolean {
        val pack = SpeechModelCatalog.chatWorkWakeWord()
        return SpeechPackDownloadManager(context).snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE
    }

    fun open(context: Context): Session {
        val app = context.applicationContext
        val pack = SpeechModelCatalog.chatWorkWakeWord()
        val manager = SpeechPackDownloadManager(app)
        check(manager.snapshot(pack).state == SpeechPackDownloadManager.State.COMPLETE) {
            "Download the ChatWork Wake Word model from Download Models first."
        }
        val modelDir = File(manager.modelDirectory(pack), "model")
        installArchive(manager.modelDirectory(pack), modelDir)
        val encoder = File(modelDir, requiredFiles[0].name)
        val decoder = File(modelDir, requiredFiles[1].name)
        val joiner = File(modelDir, requiredFiles[2].name)
        val tokens = File(modelDir, requiredFiles[3].name)
        val bpe = File(modelDir, requiredFiles[4].name)
        val keywords = File(modelDir, "keywords.txt")
        if (!keywords.isFile || keywords.readText() != WAKE_KEYWORD_LINE + "\n") {
            keywords.writeText(WAKE_KEYWORD_LINE + "\n")
        }

        val modelConfig = OnlineModelConfig(
            transducer = OnlineTransducerModelConfig(
                encoder = encoder.absolutePath,
                decoder = decoder.absolutePath,
                joiner = joiner.absolutePath
            ),
            tokens = tokens.absolutePath,
            numThreads = 1,
            provider = "cpu",
            modelType = "zipformer2",
            modelingUnit = "bpe",
            bpeVocab = bpe.absolutePath
        )
        val spotter = KeywordSpotter(
            config = KeywordSpotterConfig(
                featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
                modelConfig = modelConfig,
                keywordsFile = keywords.absolutePath,
                keywordsScore = 2.0f,
                keywordsThreshold = 0.35f,
                numTrailingBlanks = 2
            )
        )
        return try {
            Session(spotter, spotter.createStream())
        } catch (error: Throwable) {
            spotter.release()
            throw error
        }
    }

    private fun installArchive(downloadDir: File, modelDir: File) {
        if (requiredFiles.all { verify(File(modelDir, it.name), it) }) return
        val archive = File(downloadDir, "kws-model.tar.bz2")
        check(archive.isFile && archive.length() == 15_667_804L) {
            "The downloaded wake-word archive is incomplete. Delete it and download again."
        }
        if (modelDir.exists()) modelDir.deleteRecursively()
        check(modelDir.mkdirs() || modelDir.isDirectory) { "Could not create the wake-word model folder." }
        val wanted = requiredFiles.associateBy { it.name }
        TarArchiveInputStream(BZip2CompressorInputStream(BufferedInputStream(FileInputStream(archive)))).use { tar ->
            while (true) {
                val entry = tar.nextTarEntry ?: break
                if (!entry.isFile) continue
                val name = entry.name.substringAfterLast('/')
                if (name !in wanted) continue
                val target = File(modelDir, name)
                FileOutputStream(target).use { output -> tar.copyTo(output) }
            }
        }
        requiredFiles.forEach { required ->
            check(verify(File(modelDir, required.name), required)) {
                "Wake-word model validation failed for ${required.name}. Delete the model and download it again."
            }
        }
    }

    private fun verify(file: File, required: RequiredFile): Boolean {
        if (!file.isFile || file.length() != required.bytes) return false
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        return actual.equals(required.sha256, ignoreCase = true)
    }

    const val SAMPLE_RATE = 16_000
    const val WAKE_PHRASE = "Hey ChatWork"
    // BPE tokens verified against the released GigaSpeech vocabulary.
    // Accept both the single-word brand pronunciation and a separated "Chat Work".
    private const val WAKE_KEYWORD_LINE =
        "▁HE Y ▁CHA T W OR K :2.0 #0.35 @HEY_CHATWORK_COMPOUND\n" +
            "▁HE Y ▁CHA T ▁WORK :2.0 #0.35 @HEY_CHATWORK_SPACED"
}
