package com.worklyindia.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class NativeAIPlan(
    val id: String,
    val name: String,
    val priceInr: Int,
    val features: String
)

data class NativeCheckoutOrder(
    val orderId: String,
    val amount: Int,
    val currency: String,
    val keyId: String,
    val planName: String
)

data class NativeRazorpayResult(
    val orderId: String?,
    val paymentId: String?,
    val signature: String?,
    val error: String? = null
)

object NativePaymentApi {
    private const val BASE = "https://jubwzelupbntbetpajqb.supabase.co"
    private const val KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"

    private fun request(path: String, session: NativeSession, body: JSONObject): JSONObject {
        val connection = URL(BASE + path).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 20000
        connection.readTimeout = 30000
        connection.setRequestProperty("apikey", KEY)
        connection.setRequestProperty("Authorization", "Bearer ${session.accessToken}")
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Accept", "application/json")
        connection.doOutput = true
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching {
                    val json = JSONObject(text)
                    json.optString("error").ifBlank { json.optString("message") }
                }.getOrNull()
                throw IllegalStateException(message?.takeIf { it.isNotBlank() } ?: "Payment server error ($status)")
            }
            return if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally {
            connection.disconnect()
        }
    }

    suspend fun plans(session: NativeSession): List<NativeAIPlan> = withContext(Dispatchers.IO) {
        val url = URL("$BASE/rest/v1/ai_chat_plans?select=id,name,price_inr,features,display_order&is_active=eq.true&order=display_order.asc")
        val connection = url.openConnection() as HttpURLConnection
        connection.connectTimeout = 15000
        connection.readTimeout = 20000
        connection.setRequestProperty("apikey", KEY)
        connection.setRequestProperty("Authorization", "Bearer ${session.accessToken}")
        connection.setRequestProperty("Accept", "application/json")
        try {
            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw IllegalStateException("Plans load nahi ho sake ($status)")
            val rows = JSONArray(text)
            (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index)
                NativeAIPlan(
                    id = row.getString("id"),
                    name = row.optString("name", "AI Chat Plan"),
                    priceInr = row.optInt("price_inr", 0),
                    features = row.optJSONObject("features")?.toString() ?: row.optJSONArray("features")?.toString().orEmpty()
                )
            }
        } finally {
            connection.disconnect()
        }
    }

    suspend fun createAiChatOrder(session: NativeSession, planId: String): JSONObject = withContext(Dispatchers.IO) {
        request("/functions/v1/ai-chat-create-subscription", session, JSONObject().put("plan_id", planId))
    }

    suspend fun verifyAiChatPayment(session: NativeSession, result: NativeRazorpayResult, planId: String): JSONObject =
        withContext(Dispatchers.IO) {
            require(!result.orderId.isNullOrBlank() && !result.paymentId.isNullOrBlank() && !result.signature.isNullOrBlank()) {
                "Razorpay payment details incomplete hain."
            }
            request("/functions/v1/ai-chat-verify-subscription", session,
                JSONObject().put("razorpay_order_id", result.orderId)
                    .put("razorpay_payment_id", result.paymentId)
                    .put("razorpay_signature", result.signature)
                    .put("plan_id", planId))
        }
}
