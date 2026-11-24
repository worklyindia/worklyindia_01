package com.worklyindia.aivoice

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64

class RelayApiException(val statusCode: Int, message: String) : IllegalStateException(message)

object VoiceRelayApi {
    private const val TIMEOUT_MS = 60_000
    private const val AUDIO_UPLOAD_TIMEOUT_MS = 60_000
    private val endpoint = "${BuildConfig.SUPABASE_URL}/functions/v1/unified-voice"

    data class ApiResult(val body: JSONObject, val statusCode: Int)

    fun post(action: String, values: JSONObject = JSONObject(), deviceToken: String? = null, authToken: String? = null): ApiResult {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
            setRequestProperty("Authorization", "Bearer ${authToken ?: BuildConfig.SUPABASE_PUBLISHABLE_KEY}")
            if (!deviceToken.isNullOrBlank()) setRequestProperty("x-device-token", deviceToken)
        }
        try {
            val request = JSONObject(values.toString()).put("action", action)
            connection.outputStream.use { it.write(request.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = try { JSONObject(raw) } catch (_: Exception) { JSONObject().put("error", "Invalid relay response") }
            return ApiResult(json, code)
        } finally {
            connection.disconnect()
        }
    }

    fun registerDevice(authToken: String, deviceName: String): String {
        val result = post("register_device", JSONObject().put("device_name", deviceName), authToken = authToken)
        if (result.statusCode !in 200..299) {
            throw RelayApiException(result.statusCode, result.body.optString("error", "Could not connect this phone to your Workly account"))
        }
        return result.body.getString("device_token")
    }


    fun setWorkerState(
        deviceToken: String,
        enabled: Boolean,
        capabilities: org.json.JSONArray,
        metrics: JSONObject? = null
    ) {
        val values = JSONObject()
            .put("enabled", enabled)
            .put("capabilities", if (enabled) capabilities else org.json.JSONArray())
        if (metrics != null) values.put("metrics", metrics)
        val response = post(
            "set_worker_state",
            values,
            deviceToken = deviceToken
        )
        if (response.statusCode !in 200..299) {
            throw RelayApiException(response.statusCode, response.body.optString("error", "Could not update worker availability"))
        }
    }

    fun registerFcmToken(deviceToken: String, fcmToken: String) {
        val result = post(
            "register_fcm_token",
            JSONObject().put("fcm_token", fcmToken),
            deviceToken = deviceToken
        )
        if (result.statusCode !in 200..299) {
            throw RelayApiException(result.statusCode, result.body.optString("error", "Could not register push notifications"))
        }
    }

    fun reportDiagnostic(deviceToken: String, eventType: String, message: String, detail: String = "", model: String = "") {
        val isError = eventType.contains("error", true) ||
            message.contains("failed", true) || message.contains("error", true) ||
            message.contains("reconnect", true)
        val modelPattern = Regex(
            """(indic-tiny-tts-(gu|hi|en)|itantra-vits-(gu|hi|en)|indicconformer-[a-z]+|qwen-[a-z0-9.]+|kokoro-82m)""",
            RegexOption.IGNORE_CASE
        )
        val reportedModel = model.takeIf { it.isNotBlank() } ?: modelPattern.find("$message $detail")?.value
        val metadata = JSONObject()
            .put("message", message.take(300))
            .put("detail", detail.take(300))
            .put("model", reportedModel ?: JSONObject.NULL)
        val values = JSONObject()
            .put("event_type", eventType.take(80))
            .put("error_type", if (isError) eventType.take(80) else JSONObject.NULL)
            .put("error_message", if (isError) message.take(500) else JSONObject.NULL)
            .put("app_version", BuildConfig.VERSION_NAME)
            .put("android_version", android.os.Build.VERSION.RELEASE ?: "unknown")
            .put("device_model", (android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL).take(100))
            .put("metadata", metadata)
        val response = post("report_diagnostic", values, deviceToken = deviceToken)
        if (response.statusCode !in 200..299) {
            throw RelayApiException(response.statusCode, response.body.optString("error", "Could not save ChatWork diagnostics"))
        }
    }

    fun userDataDashboard(deviceToken: String): JSONObject {
        val response = post("user_data_dashboard", deviceToken = deviceToken)
        if (response.statusCode !in 200..299) {
            throw RelayApiException(response.statusCode, response.body.optString("error", "Could not load ChatWork data"))
        }
        return response.body
    }

    fun poll(token: String): JSONObject {
        val result = post("poll", deviceToken = token)
        if (result.statusCode !in 200..299) throw RelayApiException(result.statusCode, result.body.optString("error", "Relay poll failed"))
        return result.body
    }

    fun complete(token: String, jobId: String, result: JSONObject) {
        val response = post(
            "complete_job",
            JSONObject().put("job_id", jobId).put("result", result),
            token
        )
        if (response.statusCode !in 200..299) throw RelayApiException(response.statusCode, response.body.optString("error", "Could not complete voice job"))
    }

    fun uploadAudio(token: String, jobId: String, audioBytes: ByteArray) {
        if (audioBytes.isEmpty() || audioBytes.size > 1_300_000) {
            throw RelayApiException(413, "Generated voice audio is empty or exceeds 1.3 MB.")
        }
        val encoded = Base64.getEncoder().encodeToString(audioBytes)
        val values = JSONObject().put("job_id", jobId).put("audio_base64", encoded)
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = TIMEOUT_MS
            readTimeout = AUDIO_UPLOAD_TIMEOUT_MS
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
            setRequestProperty("Authorization", "Bearer ${BuildConfig.SUPABASE_PUBLISHABLE_KEY}")
            setRequestProperty("x-device-token", token)
        }
        try {
            val request = JSONObject(values.toString()).put("action", "upload_audio")
            connection.outputStream.use { it.write(request.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = try { JSONObject(raw) } catch (_: Exception) { JSONObject().put("error", "Invalid relay response") }
            if (code !in 200..299) throw RelayApiException(code, json.optString("error", "Could not upload generated voice audio"))
        } finally {
            connection.disconnect()
        }
    }

    fun downloadAudio(audioUrl: String): ByteArray {
        val connection = (URL(audioUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = TIMEOUT_MS
            readTimeout = AUDIO_UPLOAD_TIMEOUT_MS
            requestMethod = "GET"
        }
        try {
            val code = connection.responseCode
            if (code !in 200..299) throw RelayApiException(code, "Could not download caller audio.")
            val bytes = connection.inputStream.use { it.readBytes() }
            if (bytes.isEmpty() || bytes.size > 1_300_000) throw RelayApiException(413, "Caller audio is empty or too large.")
            return bytes
        } finally { connection.disconnect() }
    }

    fun transcribe(token: String, audioBytes: ByteArray): JSONObject {
        if (audioBytes.isEmpty() || audioBytes.size > 1_300_000) throw RelayApiException(413, "Caller audio is empty or too large.")
        val values = JSONObject().put("audio", Base64.getEncoder().encodeToString(audioBytes))
        val response = post("speech-to-text", values, deviceToken = token)
        if (response.statusCode !in 200..299) throw RelayApiException(response.statusCode, response.body.optString("error", "Speech recognition failed."))
        return response.body
    }

    fun fail(token: String, jobId: String, reason: String) {
        val response = post(
            "fail_job",
            JSONObject().put("job_id", jobId).put("reason", reason.take(500)),
            token
        )
        if (response.statusCode !in 200..299) throw RelayApiException(response.statusCode, response.body.optString("error", "Could not report voice job failure"))
    }
}
