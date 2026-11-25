package com.worklyindia.aivoice

import android.app.ActivityManager
import android.content.Context
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateRemoteModel
import org.json.JSONArray
import org.json.JSONObject

/**
 * Single source of truth for local model task types and relay eligibility.
 *
 * A pack being downloaded is not sufficient to make it a worker. Only models
 * with an inference adapter already wired into VoiceRelayService are eligible.
 * Extend this registry only alongside a tested relay adapter.
 */
object VoiceWorkerCapabilityRegistry {
    const val WORKER_PREFS = "chatwork_community_worker"
    const val WORKER_ENABLED_KEY = "worker_enabled"
    enum class Task { TEXT_TO_SPEECH, SPEECH_TO_TEXT, OFFLINE_CHAT, TRANSLATION, IMAGE_GENERATION, VIDEO_GENERATION }
    enum class Adapter { INDIC_TINY_TTS, KOKORO, SHERPA_VITS, QVAC, MOSS, INDIC_CONFORMER, QWEN }

    data class Capability(
        val packId: String,
        val task: Task,
        val adapter: Adapter,
        val languages: Set<String>,
        val relayReady: Boolean,
        val reason: String
    )

    private val capabilities = listOf(
        Capability("indic-tiny-tts-gu", Task.TEXT_TO_SPEECH, Adapter.INDIC_TINY_TTS, setOf("gu"), true, "Gujarati offline TTS adapter is connected to the relay."),
        Capability("indic-tiny-tts-hi", Task.TEXT_TO_SPEECH, Adapter.INDIC_TINY_TTS, setOf("hi"), true, "Hindi offline TTS adapter is connected to the relay."),
        Capability("indic-tiny-tts-en", Task.TEXT_TO_SPEECH, Adapter.INDIC_TINY_TTS, setOf("en"), true, "English offline TTS adapter is connected to the relay."),
        Capability("kokoro-82m", Task.TEXT_TO_SPEECH, Adapter.KOKORO, setOf("hi", "en"), true, "Hindi/English Kokoro adapter is connected to the relay."),
        Capability("itantra-vits-gu", Task.TEXT_TO_SPEECH, Adapter.SHERPA_VITS, setOf("gu"), true, "Sherpa-ONNX VITS adapter is connected to the shared voice relay."),
        Capability("itantra-vits-hi", Task.TEXT_TO_SPEECH, Adapter.SHERPA_VITS, setOf("hi"), true, "Sherpa-ONNX VITS adapter is connected to the shared voice relay."),
        Capability("itantra-vits-en", Task.TEXT_TO_SPEECH, Adapter.SHERPA_VITS, setOf("en"), true, "Sherpa-ONNX VITS adapter is connected to the shared voice relay."),
        Capability("qvac-chatterbox-multilingual", Task.TEXT_TO_SPEECH, Adapter.QVAC, setOf("multilingual"), false, "Native test path exists; relay integration and device validation are pending."),
        Capability("qvac-cosyvoice3", Task.TEXT_TO_SPEECH, Adapter.QVAC, setOf("multilingual"), false, "Native test path exists; relay integration and device validation are pending."),
        Capability("moss-tts-nano", Task.TEXT_TO_SPEECH, Adapter.MOSS, setOf("en", "zh"), false, "Model test path is not yet a verified relay worker adapter."),
        Capability("indicconformer-*", Task.SPEECH_TO_TEXT, Adapter.INDIC_CONFORMER, setOf("as","bn","brx","doi","gu","hi","kn","kok","ks","mai","ml","mni","mr","ne","or","pa","sa","sat","sd","ta","te","ur","en"), false, "Downloaded speech-recognition weights are not yet connected to an on-device relay STT adapter."),
        Capability("qwen-*", Task.OFFLINE_CHAT, Adapter.QWEN, setOf("multilingual"), false, "Qwen runs in the offline chat flow; it is not connected to the shared relay worker.")
    )

    fun forPack(packId: String): Capability? =
        capabilities.firstOrNull { it.packId == packId }
            ?: capabilities.firstOrNull { it.packId.endsWith("*") && packId.startsWith(it.packId.removeSuffix("*")) }

    /** Returns only fully downloaded, relay-wired models. Never advertises test-only packs. */
    fun downloadedRelayCapabilities(context: Context): JSONArray {
        val manager = SpeechPackDownloadManager(context)
        val ttsUsage = context.getSharedPreferences("workly_tts_usage", Context.MODE_PRIVATE)
        val result = JSONArray()
        val ttsPacks = listOf(
            SpeechModelCatalog.indicTinyTts("gu") to "indic",
            SpeechModelCatalog.indicTinyTts("hi") to "indic",
            SpeechModelCatalog.indicTinyTts("en") to "indic",
            SpeechModelCatalog.kokoro82m() to "kokoro",
            SpeechModelCatalog.itantraVits("gu") to "itantra",
            SpeechModelCatalog.itantraVits("hi") to "itantra",
            SpeechModelCatalog.itantraVits("en") to "itantra"
        )
        for ((pack, relayModel) in ttsPacks) {
            if (manager.snapshot(pack).state != SpeechPackDownloadManager.State.COMPLETE) continue
            val languages: List<String> = if (pack.id.startsWith("indic-tiny-tts-") || pack.id.startsWith("itantra-vits-")) listOf(pack.id.substringAfterLast("-")) else listOf("hi", "en")
            result.put(JSONObject()
                .put("task", "tts")
                .put("model", relayModel)
                .put("model_name", pack.title)
                .put("pack_id", pack.id)
                .put("size_bytes", pack.totalBytes)
                .put("installed_at", manager.installedAt(pack) ?: JSONObject.NULL)
                .put("last_used_at", ttsUsage.getString("last_used_at_${pack.id}", null) ?: JSONObject.NULL)
                .put("last_duration_ms", ttsUsage.getLong("last_duration_ms_${pack.id}", -1L).takeIf { it >= 0L } ?: JSONObject.NULL)
                .put("last_text_chars", ttsUsage.getInt("last_text_chars_${pack.id}", -1).takeIf { it >= 0 } ?: JSONObject.NULL)
                .put("last_output_bytes", ttsUsage.getLong("last_output_bytes_${pack.id}", -1L).takeIf { it >= 0L } ?: JSONObject.NULL)
                .put("usage", ModelUsageTracker.snapshot(context, pack.id))
                .put("languages", JSONArray(languages))
                .put("ready", true))
        }

        // Advertise IndicConformer only when every file for that language is present.
        val speechLanguages = listOf("as","bn","brx","doi","gu","hi","kn","kok","ks","mai","ml","mni","mr","ne","or","pa","sa","sat","sd","ta","te","ur","en")
        for (language in speechLanguages) {
            val pack = SpeechModelCatalog.indicConformer(language)
            if (!OfflineSpeechEngineFactory.isReady(context, pack)) continue
            result.put(JSONObject()
                .put("task", "stt")
                .put("model", "indicconformer-" + language)
                .put("model_name", pack.title)
                .put("pack_id", pack.id)
                .put("size_bytes", pack.totalBytes)
                .put("installed_at", manager.installedAt(pack) ?: JSONObject.NULL)
                .put("usage", ModelUsageTracker.snapshot(context, pack.id))
                .put("languages", JSONArray(listOf(language)))
                .put("ready", true))
        }

        // Qwen is advertised only when the GGUF is valid and current free RAM
        // meets the model's safety threshold. Never advertise a model that is
        // merely present but unsafe to load on this device.
        val memoryInfo = ActivityManager.MemoryInfo()
        (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memoryInfo)
        val qwenManager = QwenModelManager(context)
        for (model in qwenManager.models) {
            if (qwenManager.snapshot(model).state != QwenModelManager.State.READY) continue
            if (!qwenManager.isSupported(model, memoryInfo.availMem)) continue
            result.put(JSONObject()
                .put("task", "ai")
                .put("model", "qwen-" + model.id)
                .put("model_name", model.title)
                .put("pack_id", "qwen-" + model.id)
                .put("size_bytes", model.size)
                .put("installed_at", qwenManager.installedAt(model) ?: JSONObject.NULL)
                .put("usage", ModelUsageTracker.snapshot(context, "qwen-" + model.id))
                .put("languages", JSONArray(listOf("multilingual")))
                .put("ready", true))
        }

        // Translation is advertised only for language pairs whose two ML Kit
        // language packs are already installed. The relay never downloads packs
        // on behalf of a community job.
        runCatching {
            val downloaded = Tasks.await(
                RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel::class.java)
            )
            val installedLanguages = downloaded.map { it.language }.toSet()
            val pairs = ArrayList<String>()
            for (source in installedLanguages) for (target in installedLanguages) {
                if (source != target) pairs.add(source + "-" + target)
            }
            if (pairs.isNotEmpty()) {
                result.put(JSONObject()
                    .put("task", "translate")
                    .put("model", "mlkit-translation")
                    .put("pack_id", "mlkit-translation")
                    .put("usage", ModelUsageTracker.snapshot(context, "mlkit-translation"))
                    .put("languages", JSONArray(pairs.take(30)))
                    .put("ready", true))
            }
        }
        return result
    }

    fun workerReady(packId: String): Boolean = forPack(packId)?.relayReady == true

    fun status(packId: String, downloaded: Boolean): String {
        val capability = forPack(packId) ?: return "Worker: unsupported model"
        if (!downloaded) return if (capability.relayReady) "Worker: eligible after download and validation" else "Worker: not ready"
        return if (capability.relayReady) "Worker: eligible after local model validation" else "Worker: not ready · " + capability.reason
    }
}


/** Records successful inference timing for every locally installed model, whether used
 * directly inside ChatWork or invoked by a website through the phone relay. */
object ModelUsageTracker {
    private const val PREFS = "workly_model_usage"

    @Synchronized
    fun record(
        context: Context,
        packId: String,
        modelName: String,
        task: String,
        source: String,
        startedAtElapsedMs: Long,
        inputChars: Int = 0,
        outputBytes: Long = 0L
    ) {
        if (packId.isBlank()) return
        val duration = (android.os.SystemClock.elapsedRealtime() - startedAtElapsedMs).coerceAtLeast(0L)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val count = prefs.getLong("count_$packId", 0L) + 1L
        val total = prefs.getLong("total_ms_$packId", 0L) + duration
        val fastest = prefs.getLong("fastest_ms_$packId", Long.MAX_VALUE).coerceAtMost(duration)
        val slowest = prefs.getLong("slowest_ms_$packId", 0L).coerceAtLeast(duration)
        prefs.edit()
            .putString("model_name_$packId", modelName)
            .putString("task_$packId", task)
            .putString("last_used_at_$packId", java.time.Instant.now().toString())
            .putLong("last_duration_ms_$packId", duration)
            .putLong("average_duration_ms_$packId", total / count)
            .putLong("fastest_duration_ms_$packId", fastest)
            .putLong("slowest_duration_ms_$packId", slowest)
            .putLong("count_$packId", count)
            .putString("last_source_$packId", source)
            .putInt("last_input_chars_$packId", inputChars.coerceAtLeast(0))
            .putLong("last_output_bytes_$packId", outputBytes.coerceAtLeast(0L))
            .apply()
    }

    fun snapshot(context: Context, packId: String): JSONObject {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val count = prefs.getLong("count_$packId", 0L)
        return JSONObject()
            .put("last_used_at", prefs.getString("last_used_at_$packId", null) ?: JSONObject.NULL)
            .put("last_duration_ms", prefs.getLong("last_duration_ms_$packId", -1L).takeIf { it >= 0L } ?: JSONObject.NULL)
            .put("average_duration_ms", prefs.getLong("average_duration_ms_$packId", -1L).takeIf { it >= 0L } ?: JSONObject.NULL)
            .put("fastest_duration_ms", prefs.getLong("fastest_duration_ms_$packId", -1L).takeIf { it >= 0L } ?: JSONObject.NULL)
            .put("slowest_duration_ms", prefs.getLong("slowest_duration_ms_$packId", -1L).takeIf { it >= 0L } ?: JSONObject.NULL)
            .put("use_count", count)
            .put("last_source", prefs.getString("last_source_$packId", null) ?: JSONObject.NULL)
            .put("task", prefs.getString("task_$packId", null) ?: JSONObject.NULL)
            .put("model_name", prefs.getString("model_name_$packId", null) ?: JSONObject.NULL)
            .put("last_input_chars", prefs.getInt("last_input_chars_$packId", -1).takeIf { it >= 0 } ?: JSONObject.NULL)
            .put("last_output_bytes", prefs.getLong("last_output_bytes_$packId", -1L).takeIf { it >= 0L } ?: JSONObject.NULL)
    }
}
