package com.worklyindia.aivoice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.google.mediapipe.tasks.audio.texttospeech.SynthesisOptions
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeech
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeechOptions
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import java.io.File

/**
 * On-device Kokoro 82M multilingual TTS.
 *
 * The model bundle must first be downloaded to app-private filesDir using the
 * Wi-Fi-only model pack manager. Run create/synthesize on a worker thread.
 */
class KokoroSpeechEngine private constructor(
    private val engine: TextToSpeech
) : AutoCloseable {

    fun availableVoices(): List<String> = engine.listVoices().map { it.voiceId }

    fun synthesize(text: String, voiceId: String): Pair<FloatArray, Int> {
        require(text.isNotBlank()) { "Enter text to speak." }
        val result = engine.synthesize(text, SynthesisOptions(voiceId = voiceId))
        return result.samples to result.sampleRateHz
    }

    @Volatile private var activeTrack: AudioTrack? = null

    fun stop() { runCatching { activeTrack?.stop() } }

    fun speak(text: String, voiceId: String) {
        val (samples, sampleRate) = synthesize(text, voiceId)
        require(samples.isNotEmpty()) { "Kokoro returned no audio samples." }
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(samples.size * Float.SIZE_BYTES)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()
        try {
            activeTrack = track
            check(track.state == AudioTrack.STATE_INITIALIZED) { "Could not initialize audio playback." }
            check(track.write(samples, 0, samples.size, AudioTrack.WRITE_BLOCKING) == samples.size) {
                "Could not write all Kokoro audio samples."
            }
            track.play()
            val deadline = android.os.SystemClock.elapsedRealtime() + samples.size * 1000L / sampleRate + 500L
            while (track.playState == AudioTrack.PLAYSTATE_PLAYING && android.os.SystemClock.elapsedRealtime() < deadline) {
                Thread.sleep(40L)
            }
        } finally {
            activeTrack = null
            runCatching { track.stop() }
            track.release()
        }
    }

    override fun close() { stop(); engine.close() }

    companion object {
        const val MODEL_FILE_NAME = "kokoro_int8_fp16.litertlm"
        const val MODEL_SIZE_BYTES = 294_783_298L
        const val MODEL_URL =
            "https://huggingface.co/litert-community/Kokoro-82M/resolve/main/kokoro_int8_fp16.litertlm"
        const val HINDI_VOICE = "hf_alpha"
        const val ENGLISH_US_VOICE = "af_heart"
        const val ENGLISH_UK_VOICE = "bf_emma"

        fun create(context: Context, modelFile: File): KokoroSpeechEngine {
            require(modelFile.isFile && modelFile.length() == MODEL_SIZE_BYTES) {
                "Kokoro model is missing or incomplete."
            }
            val options = TextToSpeechOptions(
                baseOptions = BaseOptions.builder()
                    .setModelAssetPath(modelFile.absolutePath)
                    .setDelegate(Delegate.CPU)
                    .build(),
                defaultVoiceId = ENGLISH_US_VOICE,
                speakingRate = 1.0f,
                cacheDirectory = context.cacheDir.absolutePath
            )
            return KokoroSpeechEngine(TextToSpeech.create(options))
        }
    }
}
