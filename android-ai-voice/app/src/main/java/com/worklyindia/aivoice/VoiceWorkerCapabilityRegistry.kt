package com.worklyindia.aivoice

import android.app.ActivityManager
import android.content.Context
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
        Capability("itantra-vits-gu", Task.TEXT_TO_SPEECH, Adapter.SHERPA_VITS, setOf("gu"), false, "Local test adapter exists; relay integration and device validation are pending."),
        Capability("itantra-vits-hi", Task.TEXT_TO_SPEECH, Adapter.SHERPA_VITS, setOf("hi"), false, "Local test adapter exists; relay integration and device validation are pending."),
        Capability("itantra-vits-en", Task.TEXT_TO_SPEECH, Adapter.SHERPA_VITS, setOf("en"), false, "Local test adapter exists; relay integration and device validation are pending."),
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
        val result = JSONArray()
        val ttsPacks = listOf(
            SpeechModelCatalog.indicTinyTts("gu") to "indic",
            SpeechModelCatalog.indicTinyTts("hi") to "indic",
            SpeechModelCatalog.indicTinyTts("en") to "indic",
            SpeechModelCatalog.kokoro82m() to "kokoro"
        )
        for ((pack, relayModel) in ttsPacks) {
            if (manager.snapshot(pack).state != SpeechPackDownloadManager.State.COMPLETE) continue
            val languages: List<String> = if (pack.id.startsWith("indic-tiny-tts-")) listOf(pack.id.substringAfterLast("-")) else listOf("hi", "en")
            result.put(JSONObject()
                .put("task", "tts")
                .put("model", relayModel)
                .put("pack_id", pack.id)
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
                .put("pack_id", pack.id)
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
                .put("pack_id", "qwen-" + model.id)
                .put("languages", JSONArray(listOf("multilingual")))
                .put("ready", true))
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
