package com.worklyindia.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

@Composable
fun NativeAIPlansScreen(
    session: NativeSession,
    paymentResult: NativeRazorpayResult?,
    onStartCheckout: (NativeCheckoutOrder) -> Unit,
    onConsumePaymentResult: () -> Unit
) {
    var plans by remember { mutableStateOf<List<NativeAIPlan>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var paying by remember { mutableStateOf(false) }
    var pendingPlanId by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var successful by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(session.userId) {
        loading = true
        runCatching { NativePaymentApi.plans(session) }
            .onSuccess { plans = it }
            .onFailure { message = it.message ?: "Plans load nahi ho sake." }
        loading = false
    }

    LaunchedEffect(paymentResult, pendingPlanId) {
        val result = paymentResult ?: return@LaunchedEffect
        val planId = pendingPlanId
        if (planId == null) {
            onConsumePaymentResult()
            return@LaunchedEffect
        }
        if (result.error != null) {
            message = "Payment complete nahi hua: ${result.error}"
            paying = false
            pendingPlanId = null
            onConsumePaymentResult()
            return@LaunchedEffect
        }
        paying = true
        message = "Payment verify ho raha hai. App band na karein."
        runCatching { NativePaymentApi.verifyAiChatPayment(session, result, planId) }
            .onSuccess {
                successful = true
                message = "Payment verified! Aapka AI Chat plan activate ho gaya."
                pendingPlanId = null
            }
            .onFailure {
                message = "Payment mila hai, lekin server verification pending hai. Dobara payment na karein. Support se contact karein. Detail: ${it.message}"
            }
        paying = false
        onConsumePaymentResult()
    }

    Column(Modifier.fillMaxSize()) {
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else if (plans.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Text(message ?: "Abhi koi active AI Chat plan available nahi hai.")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text("AI Chat plans", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("Secure payment Razorpay ke official checkout se hoga. Plan activate hone se pehle server payment verify karega.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (successful) item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(8.dp))
                            Text("Subscription active", fontWeight = FontWeight.Bold)
                        }
                    }
                }
                items(plans, key = { it.id }) { plan ->
                    val featureLabels = remember(plan.features) {
                        runCatching {
                            val json = JSONObject(plan.features)
                            json.keys().asSequence().map { key ->
                                val value = json.opt(key)
                                when (value) {
                                    is Boolean -> if (value) key.replace('_', ' ') else ""
                                    is Number -> if (value.toInt() > 0) "${key.replace('_', ' ')}: ${value}" else ""
                                    is String -> if (value.isNotBlank()) "${key.replace('_', ' ')}: $value" else ""
                                    else -> ""
                                }
                            }.filter { it.isNotBlank() }.take(5).toList()
                        }.getOrElse {
                            runCatching {
                                val array = JSONArray(plan.features)
                                (0 until array.length()).map { array.optString(it) }.filter { it.isNotBlank() }.take(5)
                            }.getOrDefault(emptyList())
                        }
                    }
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Text(plan.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Row(verticalAlignment = Alignment.Bottom) {
                                Text(if (plan.priceInr == 0) "Free" else "₹${plan.priceInr}",
                                    style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                                if (plan.priceInr > 0) Text(" / plan", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            featureLabels.forEach { feature ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.CheckCircle, null, Modifier.size(17.dp), tint = MaterialTheme.colorScheme.primary)
                                    Spacer(Modifier.width(7.dp))
                                    Text(feature, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                            Button(
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !paying && pendingPlanId == null,
                                onClick = {
                                    scope.launch {
                                        paying = true
                                        message = null
                                        runCatching { NativePaymentApi.createAiChatOrder(session, plan.id) }
                                            .onSuccess { order ->
                                                val orderId = order.optString("order_id")
                                                if (orderId.isBlank()) {
                                                    successful = order.optBoolean("success")
                                                    message = if (successful) "Free plan activate ho gaya." else "Plan response incomplete hai."
                                                } else {
                                                    pendingPlanId = plan.id
                                                    val checkout = NativeCheckoutOrder(
                                                        orderId = orderId,
                                                        amount = order.optInt("amount"),
                                                        currency = order.optString("currency", "INR"),
                                                        keyId = order.optString("key"),
                                                        planName = plan.name
                                                    )
                                                    if (checkout.keyId.isBlank() || checkout.amount <= 0) {
                                                        pendingPlanId = null
                                                        message = "Payment checkout configuration incomplete hai."
                                                    } else onStartCheckout(checkout)
                                                }
                                            }
                                            .onFailure { message = it.message ?: "Order create nahi ho saka." }
                                        paying = false
                                    }
                                }
                            ) {
                                if (paying) {
                                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                }
                                Text(if (plan.priceInr == 0) "Activate free plan" else "Pay securely")
                            }
                        }
                    }
                }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Lock, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.width(6.dp))
                        Text("Card/UPI details Workly India server par store nahi hote. Razorpay handles checkout.",
                            style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (message != null) item {
                    Text(message!!, color = if (successful) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
