package com.worklyindia.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import com.razorpay.Checkout
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import org.json.JSONObject


class MainActivity : ComponentActivity(), PaymentResultWithDataListener {
    var razorpayResult by mutableStateOf<NativeRazorpayResult?>(null)
        private set

    fun clearRazorpayResult() { razorpayResult = null }

    fun openRazorpayCheckout(order: NativeCheckoutOrder, email: String) {
        try {
            val checkout = Checkout()
            checkout.setKeyID(order.keyId)
            val options = JSONObject()
                .put("key", order.keyId)
                .put("order_id", order.orderId)
                .put("amount", order.amount)
                .put("currency", order.currency)
                .put("name", "Workly India")
                .put("description", "AI Chat - ${order.planName}")
                .put("prefill", JSONObject().put("email", email))
                .put("theme", JSONObject().put("color", "#1646C8"))
                .put("retry", JSONObject().put("enabled", true).put("max_count", 3))
            checkout.open(this, options)
        } catch (e: Exception) {
            razorpayResult = NativeRazorpayResult(null, null, null, e.message ?: "Checkout open nahi ho saka.")
        }
    }

    override fun onPaymentSuccess(razorpayPaymentId: String?, paymentData: PaymentData) {
        razorpayResult = NativeRazorpayResult(
            orderId = paymentData.orderId,
            paymentId = paymentData.paymentId ?: razorpayPaymentId,
            signature = paymentData.signature
        )
    }

    override fun onPaymentError(code: Int, response: String?, paymentData: PaymentData?) {
        razorpayResult = NativeRazorpayResult(
            orderId = paymentData?.orderId,
            paymentId = paymentData?.paymentId,
            signature = paymentData?.signature,
            error = response?.take(500) ?: "Payment cancel ya fail hua (code $code)."
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Website App Links launch the native app; normal entry starts at the native Home screen.
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Checkout.preload(applicationContext)
        setContent {
            val dark = isSystemInDarkTheme()
            SideEffect {
                // Keep Android system status/navigation bars visible and make their icons
                // readable in both system Light and Dark modes.
                window.statusBarColor = if (dark) android.graphics.Color.rgb(16, 21, 34) else android.graphics.Color.rgb(244, 246, 251)
                window.navigationBarColor = if (dark) android.graphics.Color.rgb(16, 21, 34) else android.graphics.Color.rgb(244, 246, 251)
                val bars = WindowInsetsControllerCompat(window, window.decorView)
                bars.isAppearanceLightStatusBars = !dark
                bars.isAppearanceLightNavigationBars = !dark
                bars.show(WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.navigationBars())
            }
            MaterialTheme(
                colorScheme = if (dark) darkColorScheme(
                    primary = Color(0xFF9DB7FF), onPrimary = Color(0xFF102B68),
                    background = Color(0xFF101522), surface = Color(0xFF191F2D),
                    onSurface = Color(0xFFE8ECF5), onSurfaceVariant = Color(0xFFB3BDCF),
                    secondaryContainer = Color(0xFF283653), error = Color(0xFFFFB4AB)
                ) else lightColorScheme(
                    primary = Color(0xFF1646C8), onPrimary = Color.White,
                    background = Color(0xFFF4F6FB), surface = Color.White,
                    onSurface = Color(0xFF151B2C), onSurfaceVariant = Color(0xFF636B80),
                    secondaryContainer = Color(0xFFE7EDFC)
                )
            ) { WorklyApp() }
        }
    }
}

// Native navigation only: app screens must never launch website URLs.

private fun shareJob(ctx: Context, job: Job) {
    val text = "🚀 Job Opening\n📌 ${job.title}\n🏢 ${job.company}\n📍 ${job.location}\n💰 ${job.salary}\n\n👉 Apply here: ${job.webUrl}"
    ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share job"))
}

/** Saved jobs persist on the device. */
private class SavedStore(ctx: Context) {
    private val p = ctx.getSharedPreferences("workly", Context.MODE_PRIVATE)
    fun load(): Set<String> = p.getStringSet("saved", emptySet())!!.toSet()
    fun save(ids: Set<String>) = p.edit().putStringSet("saved", ids).apply()
}

private sealed interface LoadState {
    data object Loading : LoadState
    data class Error(val msg: String) : LoadState
    data class Ready(val jobs: List<Job>) : LoadState
}

@Composable
private fun WorklyApp() {
    val ctx = LocalContext.current
    val paymentActivity = ctx as? MainActivity
    var notificationPermissionGranted by remember { mutableStateOf(Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) }
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> notificationPermissionGranted = granted }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    val store = remember { SavedStore(ctx) }
    var authSession by remember { mutableStateOf(NativeAuth.session(ctx)) }
    var authMessage by remember { mutableStateOf<String?>(null) }
    var externalApplyNotice by remember { mutableStateOf(false) }
    var applyConfirmation by remember { mutableStateOf<Job?>(null) }
    var applyBusy by remember { mutableStateOf(false) }
    var applyResult by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    var tab by rememberSaveable { mutableStateOf("Home") }
    var selected by remember { mutableStateOf<Job?>(null) }
    var selectedFeature by rememberSaveable { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(store.load()) }
    var search by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var categories by remember { mutableStateOf(listOf<String>()) }
    var state by remember { mutableStateOf<LoadState>(LoadState.Loading) }
    var reload by remember { mutableIntStateOf(0) }
    val known = remember { mutableStateMapOf<String, Job>() }
    var homeData by remember { mutableStateOf(NativeHomeData()) }
    LaunchedEffect(Unit) { runCatching { homeData = NativeHomeApi.load() } }

    LaunchedEffect(Unit) { runCatching { categories = JobsApi.fetchCategories() } }
    LaunchedEffect(search, category, reload) {
        if (search.isNotEmpty()) delay(350)
        state = LoadState.Loading
        state = runCatching { JobsApi.fetchJobs(search, category) }.fold(
            { list -> list.forEach { known[it.id] = it }; LoadState.Ready(list) },
            { LoadState.Error("Internet check karein aur dobara try karein.") }
        )
    }
    LaunchedEffect(authSession?.userId) {
        val session = authSession
        if (session != null) runCatching { saved = NativeDataApi.savedJobIds(session); store.save(saved) }
    }
    LaunchedEffect(authSession?.userId, notificationPermissionGranted) {
        val session = authSession
        if (session != null && notificationPermissionGranted) {
            runCatching { NativePushManager.register(ctx, session) }
        }
    }
    val toggleSave: (Job) -> Unit = { j ->
        val wasSaved = j.id in saved
        saved = if (wasSaved) saved - j.id else saved + j.id
        store.save(saved)
        authSession?.let { session -> scope.launch { runCatching { if (wasSaved) NativeDataApi.unsaveJob(session,j.id) else NativeDataApi.saveJob(session,j.id) } } }
    }

    BackHandler(enabled = selected != null || selectedFeature != null || tab != "Home") {
        if (selected != null) selected = null else if (selectedFeature != null) selectedFeature = null else tab = "Home"
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            if (selected == null && selectedFeature == null) {
                NativeWebsiteHeader(
                    data = homeData,
                    savedCount = saved.size,
                    onAI = { selectedFeature = "AI Chat" },
                    onFavorites = { tab = "Saved" },
                    onRefer = { selectedFeature = "Refer" },
                    onProfile = { tab = "Account" },
                    onSearch = { tab = "Jobs" },
                    isLoggedIn = authSession != null
                )
            }
        },
        bottomBar = {
            if (selected == null && selectedFeature == null) NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                listOf("Home" to Icons.Default.Home, "Jobs" to Icons.Default.Search,
                    "Saved" to Icons.Default.Bookmark, "More" to Icons.Default.Menu, "Account" to Icons.Default.Person)
                    .forEach { (label, icon) ->
                        NavigationBarItem(selected = tab == label, onClick = { selectedFeature = null; selected = null; tab = label },
                            icon = { Icon(icon, contentDescription = label) }, label = { Text(label) })
                    }
            }
        }
    ) { pad ->
        val m = Modifier.padding(pad)
        val job = selected
        when {
            job != null -> JobDetail(m, job, job.id in saved, { selected = null }, toggleSave,
                onApply = {
                    if (!job.externalApplyUrl.isNullOrBlank()) externalApplyNotice = true
                    else if (authSession == null) {
                        authMessage = "Apply karne ke liye pehle login karein."
                        tab = "Account"
                        selected = null
                    } else applyConfirmation = job
                }, onShare = { shareJob(ctx, job) })
            selectedFeature != null -> NativeFeatureScreen(
                m, selectedFeature!!, authSession,
                onBack = { selectedFeature = null },
                paymentResult = paymentActivity?.razorpayResult,
                onStartCheckout = { order -> paymentActivity?.openRazorpayCheckout(order, authSession?.email.orEmpty()) },
                onConsumePaymentResult = { paymentActivity?.clearRazorpayResult() }
            )
            tab == "Home" -> HomeScreen(m, state, homeData, categories, saved, toggleSave,
                onSearch = { search = it; tab = "Jobs" }, onCategory = { category = it; tab = "Jobs" },
                onJob = { selected = it }, onRetry = { reload++ }, onAll = { tab = "Jobs" },
                onEmployer = { tab = "Account" }, onFeature = { feature -> when (feature) { "Favorites" -> tab = "Saved"; "Employee", "Post Job" -> selectedFeature = "Employer dashboard"; "Resume" -> selectedFeature = "My resume"; else -> selectedFeature = feature } })
            tab == "Jobs" -> JobsScreen(m, state, search, { search = it }, categories, category, { category = it },
                saved, toggleSave, { selected = it }, { reload++ })
            tab == "Saved" -> SavedScreen(m, known.values.filter { it.id in saved }, saved.size, saved, toggleSave) { selected = it }
            tab == "More" -> MoreScreen(m, authSession, saved.size, onNavigate = { if (it == "Login") tab = "Account" else selectedFeature = it })
            else -> AccountScreen(m, authSession, authMessage, onMessage = { authMessage = it }, onSession = { authSession = it; authMessage = if (it == null) "Logout successful." else "Login successful." }, onNavigate = { selectedFeature = it })
        }
    }
    if (applyConfirmation != null) {
        val pendingJob = applyConfirmation!!
        AlertDialog(
            onDismissRequest = { if (!applyBusy) applyConfirmation = null },
            title = { Text("Confirm application") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(pendingJob.title, fontWeight = FontWeight.Bold)
                    Text(pendingJob.company, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(pendingJob.location, style = MaterialTheme.typography.bodySmall)
                    Text("Aapki Workly India profile se is job ke liye application submit hogi. Submit karne se pehle apni profile details check kar lein.")
                }
            },
            confirmButton = {
                Button(enabled = !applyBusy, onClick = {
                    val session = authSession
                    if (session == null) {
                        applyConfirmation = null
                        tab = "Account"
                        authMessage = "Apply karne ke liye pehle login karein."
                    } else {
                        applyBusy = true
                        scope.launch {
                            val result = runCatching {
                                if (NativeDataApi.hasApplied(session, pendingJob.id)) {
                                    throw IllegalStateException("Aap is job ke liye pehle hi apply kar chuke hain. Status My applications mein dekhein.")
                                }
                                NativeAuth.apply(ctx, pendingJob.id, pendingJob.employerId
                                    ?: throw IllegalStateException("Employer details nahi mile. Is job ke liye native apply support available nahi hai."))
                            }
                            applyBusy = false
                            applyConfirmation = null
                            applyResult = result.fold(
                                { "Application submit ho gayi. Aap Account > My applications mein status dekh sakte hain." },
                                { it.message ?: "Application submit nahi ho saki. Dobara try karein." }
                            )
                        }
                    }
                }) { Text(if (applyBusy) "Submitting…" else "Confirm & apply") }
            },
            dismissButton = {
                TextButton(enabled = !applyBusy, onClick = { applyConfirmation = null }) { Text("Cancel") }
            }
        )
    }
    if (applyResult != null) AlertDialog(
        onDismissRequest = { applyResult = null },
        title = { Text(if (applyResult!!.startsWith("Application submit ho gayi")) "Application submitted" else "Application status") },
        text = { Text(applyResult!!) },
        confirmButton = { TextButton(onClick = { applyResult = null }) { Text("OK") } }
    )
    if (externalApplyNotice) AlertDialog(
        onDismissRequest = { externalApplyNotice = false },
        title = { Text("External application") },
        text = { Text("Is job ka application process employer ke external portal par hai. Aapki request ke mutabik Workly India app koi website ya browser open nahi karegi. Is job ke liye native in-app apply support abhi available nahi hai.") },
        confirmButton = { TextButton(onClick = { externalApplyNotice = false }) { Text("OK") } }
    )
}


@Composable
private fun NativeWebsiteHeader(
    data: NativeHomeData,
    savedCount: Int,
    onAI: () -> Unit,
    onFavorites: () -> Unit,
    onRefer: () -> Unit,
    onProfile: () -> Unit,
    onSearch: () -> Unit,
    isLoggedIn: Boolean
) {
    Surface(
        modifier = Modifier.windowInsetsPadding(WindowInsets.statusBars),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 2.dp
    ) {
        Column {
            Box(Modifier.fillMaxWidth().height(3.dp).background(MaterialTheme.colorScheme.primary))
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (data.logoUrl != null) {
                    AsyncImage(
                        model = data.logoUrl,
                        contentDescription = "Workly India brand logo",
                        modifier = Modifier.size(43.dp).clip(RoundedCornerShape(50)),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Surface(
                        modifier = Modifier.size(43.dp),
                        shape = RoundedCornerShape(50),
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.Work, contentDescription = "Workly India", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                Column(Modifier.weight(1f).padding(start = 9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        val brandParts = data.brandName.split(" ", limit = 2)
                        Text(brandParts.firstOrNull().orEmpty().ifBlank { "Workly" }, color = Color(0xFF3B5CE4), fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
                        Text(" " + (brandParts.getOrNull(1) ?: "India"), color = Color(0xFF0DB17E), fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
                    }
                    Text(
                        data.tagline,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (isLoggedIn) {
                    IconButton(onClick = onAI, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = "AI Career Chat", tint = MaterialTheme.colorScheme.primary)
                    }
                    IconButton(onClick = onFavorites, modifier = Modifier.size(36.dp)) {
                        Box {
                            Icon(Icons.Default.FavoriteBorder, contentDescription = "Favorites", tint = MaterialTheme.colorScheme.primary)
                            if (savedCount > 0) {
                                Surface(
                                    modifier = Modifier.align(Alignment.TopEnd).size(15.dp),
                                    shape = RoundedCornerShape(50),
                                    color = MaterialTheme.colorScheme.error
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(savedCount.coerceAtMost(99).toString(), color = Color.White, style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                    }
                    IconButton(onClick = onRefer, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.CardGiftcard, contentDescription = "Refer a friend", tint = MaterialTheme.colorScheme.primary)
                    }
                    IconButton(onClick = onProfile, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.AccountCircle, contentDescription = "Profile", tint = MaterialTheme.colorScheme.primary)
                    }
                } else {
                    TextButton(onClick = onProfile) { Icon(Icons.Default.Login, contentDescription = null); Spacer(Modifier.width(4.dp)); Text("Log in") }
                }
            }
            OutlinedButton(
                onClick = onSearch,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 0.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurfaceVariant)
            ) {
                Icon(Icons.Default.Search, contentDescription = null)
                Spacer(Modifier.width(9.dp))
                Text("Search jobs, skills, city or company", modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Icon(Icons.Default.Tune, contentDescription = "Search filters")
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun HomeScreen(
    m: Modifier, state: LoadState, homeData: NativeHomeData, categories: List<String>, saved: Set<String>, onSave: (Job) -> Unit,
    onSearch: (String) -> Unit, onCategory: (String) -> Unit, onJob: (Job) -> Unit, onRetry: () -> Unit, onAll: () -> Unit,
    onEmployer: () -> Unit, onFeature: (String) -> Unit
) {
    var q by rememberSaveable { mutableStateOf("") }
    val quickActions = listOf(
        Triple("Resume", "Build your resume", Icons.Default.Article),
        Triple("AI Chat", "Career assistant", Icons.Default.AutoAwesome),
        Triple("Refer", "Invite a friend", Icons.Default.CardGiftcard),
        Triple("Companies", "Explore employers", Icons.Default.Business),
        Triple("Developer", "Developer tools", Icons.Default.Code),
        Triple("Post Job", "Create a job listing", Icons.Default.AddBox)
    )
    LazyColumn(
        m.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            if (homeData.banners.isNotEmpty()) NativeHomeBannerCarousel(homeData)
            else Card(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("JOBS • CAREER • GROWTH", color = Color.White, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    Text("Find work that fits your life.", color = Color.White, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
                    Text("Explore opportunities across India — remote, part-time and full-time.", color = Color.White.copy(alpha = .9f), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item {
            Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Find your next opportunity", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = q, onValueChange = { q = it }, modifier = Modifier.fillMaxWidth(),
                    singleLine = true, placeholder = { Text("Job title, skill, city or company") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search jobs") },
                    trailingIcon = { if (q.isNotBlank()) IconButton(onClick = { q = "" }) { Icon(Icons.Default.Close, contentDescription = "Clear search") } },
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                        focusedContainerColor = MaterialTheme.colorScheme.surface
                    )
                )
                Button(onClick = { onSearch(q.trim()) }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Default.Search, null); Spacer(Modifier.width(8.dp)); Text("Search jobs", fontWeight = FontWeight.Bold)
                }
                OutlinedButton(onClick = onEmployer, modifier = Modifier.fillMaxWidth().height(46.dp), shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Default.BusinessCenter, null); Spacer(Modifier.width(8.dp)); Text("I'm hiring — post a job")
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text("Explore by job type", Modifier.padding(horizontal = 14.dp), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val filters = listOf(
                        "All Jobs" to Icons.Default.Work,
                        "Remote" to Icons.Default.Home,
                        "Part-time" to Icons.Default.Schedule,
                        "Full-time" to Icons.Default.BusinessCenter,
                        "Internship" to Icons.Default.School,
                        "Contract" to Icons.Default.Description,
                        "Hybrid" to Icons.Default.Laptop
                    )
                    filters.forEach { (label, icon) ->
                        AssistChip(
                            onClick = { if (label == "All Jobs") onAll() else onCategory(label) },
                            label = { Text(label) },
                            leadingIcon = { Icon(icon, contentDescription = null, modifier = Modifier.size(17.dp)) },
                            shape = RoundedCornerShape(50)
                        )
                    }
                }
            }
        }
        item { NativeHomeCareerCategories(onCategory = onCategory, onAll = onAll) }
        item {
            Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Your career tools", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = { onFeature("More") }) { Text("Explore all") }
                }
                quickActions.chunked(3).forEach { pair ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        pair.forEach { (title, subtitle, icon) ->
                            Card(
                                onClick = { onFeature(title) }, modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = .55f))
                            ) {
                                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                                        Icon(icon, null, Modifier.padding(9.dp).size(21.dp), tint = MaterialTheme.colorScheme.primary)
                                    }
                                    Text(title, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleSmall, maxLines = 1)
                                    Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, maxLines = 2, minLines = 2)
                                }
                            }
                        }
                        if (pair.size < 3) repeat(3 - pair.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Latest opportunities", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    Text("Fresh jobs to explore", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = onAll) { Text("See all"); Icon(Icons.Default.ArrowForward, null, Modifier.size(16.dp)) }
            }
        }
        jobList(state, saved, onSave, onJob, onRetry, take = 10)
        item { NativeHomeExtraSections(homeData, onFeature, onCategory) }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.jobList(
    state: LoadState, saved: Set<String>, onSave: (Job) -> Unit, onJob: (Job) -> Unit, onRetry: () -> Unit, take: Int = Int.MAX_VALUE
) {
    when (state) {
        LoadState.Loading -> item { Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) { CircularProgressIndicator() } }
        is LoadState.Error -> item {
            Message(Icons.Default.WifiOff, "Jobs load nahi hue", state.msg) { Button(onRetry) { Text("Retry") } }
        }
        is LoadState.Ready -> {
            if (state.jobs.isEmpty()) item { Message(Icons.Default.SearchOff, "Koi job nahi mili", "Dusra shabd ya category try karein.") }
            items(state.jobs.take(take), key = { it.id }) { JobCard(it, it.id in saved, { onSave(it) }) { onJob(it) } }
        }
    }
}

@Composable
private fun JobsScreen(
    m: Modifier, state: LoadState, search: String, onSearch: (String) -> Unit, categories: List<String>,
    category: String?, onCategory: (String?) -> Unit, saved: Set<String>, onSave: (Job) -> Unit, onJob: (Job) -> Unit, onRetry: () -> Unit
) {
    LazyColumn(m.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Explore jobs", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        item {
            OutlinedTextField(search, onSearch, Modifier.fillMaxWidth(), singleLine = true,
                placeholder = { Text("Search title, city, company") }, leadingIcon = { Icon(Icons.Default.Search, null) },
                trailingIcon = { if (search.isNotEmpty()) IconButton({ onSearch("") }) { Icon(Icons.Default.Close, "Clear") } },
                shape = RoundedCornerShape(14.dp))
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(category == null, { onCategory(null) }, { Text("All") })
                categories.forEach { c -> FilterChip(category == c, { onCategory(c) }, { Text(c) }) }
            }
        }
        if (state is LoadState.Ready) item { Text("${state.jobs.size} jobs", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        jobList(state, saved, onSave, onJob, onRetry)
    }
}

@Composable
private fun SavedScreen(m: Modifier, jobs: List<Job>, count: Int, saved: Set<String>, onSave: (Job) -> Unit, onJob: (Job) -> Unit) {
    LazyColumn(m.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Saved jobs", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        if (count == 0) item { Message(Icons.Default.BookmarkBorder, "Abhi koi saved job nahi", "Job card par bookmark dabakar save karein.") }
        items(jobs, key = { it.id }) { JobCard(it, it.id in saved, { onSave(it) }) { onJob(it) } }
    }
}

@Composable
private fun JobCard(job: Job, saved: Boolean, onSave: () -> Unit, onOpen: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().clickable(onClick = onOpen),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.65f))
    ) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Logo(job)
                Column(Modifier.weight(1f).padding(start = 11.dp, end = 4.dp)) {
                    Text(job.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(job.company, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (job.featured) {
                            Spacer(Modifier.width(6.dp))
                            Pill("Featured")
                        }
                    }
                    Text(job.location, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                IconButton(onClick = onSave, modifier = Modifier.size(40.dp)) {
                    Icon(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                        if (saved) "Remove saved job" else "Save job",
                        tint = if (saved) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                Pill(job.type)
                if (job.category.isNotBlank()) Pill(job.category)
                if (job.experience.isNotBlank()) Pill(job.experience)
            }
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.07f))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Payments, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(19.dp))
                Text(job.salary.ifBlank { "Salary not disclosed" }, Modifier.weight(1f).padding(start = 8.dp),
                    color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                TextButton(onClick = onOpen, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)) {
                    Text("View details")
                    Icon(Icons.Default.ChevronRight, null, modifier = Modifier.size(17.dp))
                }
            }
        }
    }
}

@Composable
private fun Logo(job: Job) {
    val mod = Modifier.size(46.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.secondaryContainer)
    if (job.logoUrl != null) AsyncImage(job.logoUrl, job.company, mod, contentScale = ContentScale.Crop)
    else Box(mod, Alignment.Center) { Text(job.company.take(1), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold) }
}

@Composable
private fun Pill(t: String) = Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(50)) {
    Text(t, Modifier.padding(horizontal = 10.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface)
}

@Composable
private fun JobDetail(m: Modifier, job: Job, saved: Boolean, onBack: () -> Unit, onSave: (Job) -> Unit, onApply: () -> Unit, onShare: () -> Unit) {
    Column(m.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onBack) { Icon(Icons.Default.ArrowBack, "Back") }
            Text("Job details", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            IconButton(onShare) { Icon(Icons.Default.Share, "Share") }
            IconButton({ onSave(job) }) { Icon(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, "Save", tint = MaterialTheme.colorScheme.primary) }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
            Card(
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
            ) {
                Column(Modifier.fillMaxWidth().padding(17.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.Top) {
                        Logo(job)
                        Column(Modifier.weight(1f).padding(start = 12.dp)) {
                            Text(job.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                            Text(job.company, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                            Text(job.location, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                        }
                        if (job.featured) Pill("Featured")
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Pill(job.type)
                        if (job.category.isNotBlank()) Pill(job.category)
                        if (job.experience.isNotBlank()) Pill(job.experience)
                    }
                    Divider(color = MaterialTheme.colorScheme.outlineVariant)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Payments, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
                        Column(Modifier.weight(1f).padding(start = 10.dp)) {
                            Text("Salary", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(job.salary, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            }
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Job overview", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    DetailInfoRow(Icons.Default.LocationOn, "Location", job.location)
                    DetailInfoRow(Icons.Default.WorkOutline, "Job type", job.type)
                    if (job.category.isNotBlank()) DetailInfoRow(Icons.Default.Category, "Category", job.category)
                    if (job.experience.isNotBlank()) DetailInfoRow(Icons.Default.Schedule, "Experience", job.experience)
                    DetailInfoRow(Icons.Default.Groups, "Openings", "${job.openings.coerceAtLeast(1)}")
                }
            }
            Section("Job description", job.description)
            Section("Requirements", job.requirements)
            Section("Benefits", job.benefits)
            if (job.skills.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("Required skills", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) { job.skills.forEach { Pill(it) } }
                }
            }
        }
        Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 6.dp) {
            Button(onApply, Modifier.fillMaxWidth().padding(14.dp).height(50.dp), shape = RoundedCornerShape(12.dp)) {
                Text("Apply now", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun DetailInfoRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(19.dp))
        Column(Modifier.weight(1f).padding(start = 11.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun Section(title: String, body: String) {
    if (body.isBlank()) return
    Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
    Text(body, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun MoreScreen(m: Modifier, session: NativeSession?, savedCount: Int, onNavigate: (String) -> Unit) {
    var now by remember { mutableStateOf(LocalDateTime.now(ZoneId.of("Asia/Kolkata"))) }
    var selectedOption by remember { mutableStateOf<String?>(null) }
    var festivals by remember { mutableStateOf<List<Festival>>(emptyList()) }
    var festivalsLoaded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        festivals = runCatching { JobsApi.fetchFestivals() }.getOrDefault(emptyList())
        festivalsLoaded = true
    }
    LaunchedEffect(Unit) {
        while (true) {
            now = LocalDateTime.now(ZoneId.of("Asia/Kolkata"))
            delay(1000)
        }
    }
    val greeting = when (now.hour) {
        in 5..11 -> "Good Morning"
        in 12..16 -> "Good Afternoon"
        in 17..19 -> "Good Evening"
        else -> "Good Night"
    }
    val greetingIcon = when (now.hour) {
        in 5..11 -> Icons.Default.WbSunny
        in 12..16 -> Icons.Default.LightMode
        in 17..19 -> Icons.Default.WbTwilight
        else -> Icons.Default.DarkMode
    }
    val clock = now.format(DateTimeFormatter.ofPattern("hh:mm:ss a"))
    val date = now.format(DateTimeFormatter.ofPattern("EEEE, dd MMMM yyyy"))
    val today = now.toLocalDate().toString()
    val todayFestivals = festivals.filter { it.date == today }
    val nextFestivalDate = festivals.firstOrNull { it.date > today }?.date
    val upcomingFestivals = festivals.filter { it.date == nextFestivalDate }
    val shownFestivals = if (todayFestivals.isNotEmpty()) todayFestivals else upcomingFestivals
    val menu = listOf(
        "AI Chat", "AI Chat Plans", "Connected accounts", "Website Pricing", "About Us", "Mission", "Vision", "Why Choose Workly India",
        "Blog", "Trust & Safety", "Employer Guidelines", "Job Seeker Guidelines",
        "Community Guidelines", "Accessibility Statement", "Privacy Policy",
        "Refund & Cancellation", "Terms & Conditions", "FAQ", "Cookie Policy",
        "Disclaimer", "DMCA / Copyright Policy", "Contact Us", "Sitemap", "Careers",
        "Press / Media Kit"
    )
    val ctx = LocalContext.current
    LazyColumn(
        modifier = m.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp)
    ) {
        if (session == null) {
            item {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.09f))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Person, null, tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                        Text("Browsing as Guest", fontWeight = FontWeight.SemiBold)
                        Text("Login to unlock all features and sync your data across devices.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = { onNavigate("Login") }) { Text("Login") }
                }
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier.size(50.dp).clip(RoundedCornerShape(50))
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        (session?.email?.firstOrNull()?.uppercase() ?: "G"),
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                }
                Column(Modifier.padding(start = 12.dp)) {
                    Text(
                        session?.email?.substringBefore("@") ?: "Guest User",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        if (session != null) "Complete job search dashboard" else "Explore features - Login for full access",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
        item {
            Card(
                onClick = { selectedOption = "Festival calendar" },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp),
                shape = RoundedCornerShape(18.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.55f)),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column {
                    Row(
                        Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.primary.copy(alpha = 0.07f)).padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(Modifier.weight(1f)) {
                            Row(
                                Modifier.clip(RoundedCornerShape(50)).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)).padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(greetingIcon, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                                Text(greeting, Modifier.padding(start = 6.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Medium)
                            }
                            Text(clock, Modifier.padding(top = 12.dp), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                            Text(date, Modifier.padding(top = 5.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Box(
                            Modifier.clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)).padding(11.dp)
                        ) { Icon(Icons.Default.CalendarMonth, null, tint = MaterialTheme.colorScheme.primary) }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.65f))
                    Row(
                        Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.30f)).padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier.size(36.dp).clip(RoundedCornerShape(50))
                                .background(if (todayFestivals.isNotEmpty()) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Celebration, null, tint = if (todayFestivals.isNotEmpty()) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.primary, modifier = Modifier.size(17.dp))
                        }
                        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                            if (!festivalsLoaded) {
                                Text("Loading festival calendar…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            } else if (shownFestivals.isNotEmpty()) {
                                Text(if (todayFestivals.isNotEmpty()) "TODAY'S FESTIVAL" else "UPCOMING FESTIVAL", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(shownFestivals.joinToString(" • ") { it.name }, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            } else {
                                Text("View festival calendar", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                            }
                        }
                        if (todayFestivals.isNotEmpty()) {
                            Text("Today", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        } else if (nextFestivalDate != null) {
                            Column(horizontalAlignment = Alignment.End) {
                                Text(nextFestivalDate, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
                                val days = java.time.temporal.ChronoUnit.DAYS.between(now.toLocalDate(), java.time.LocalDate.parse(nextFestivalDate))
                                if (days > 0) Text(if (days == 1L) "Tomorrow" else "in $days days", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Icon(Icons.Default.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 6.dp).size(18.dp))
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MoreStatCard(Modifier.weight(1f), "—", "Applications", Icons.Default.Description)
                MoreStatCard(Modifier.weight(1f), savedCount.toString(), "Saved Jobs", Icons.Default.Favorite)
                MoreStatCard(Modifier.weight(1f), "—", "Response", Icons.Default.TrendingUp)
            }
        }
        item {
            Column(Modifier.fillMaxWidth().padding(top = 10.dp)) {
                menu.forEachIndexed { index, label ->
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.65f))
                    Row(
                        Modifier.fillMaxWidth().clickable { onNavigate(label) }
                            .padding(horizontal = 20.dp, vertical = 15.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                        Icon(Icons.Default.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                    }
                    if (index == menu.lastIndex) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.65f))
                }
            }
        }
        item {
            Text(
                "© ${now.year} Workly India. All Rights Reserved.",
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 20.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }

}

@Composable
private fun MoreStatCard(modifier: Modifier, value: String, label: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(15.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.55f)),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(11.dp)) {
            Box(Modifier.clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)).padding(7.dp)) {
                Icon(icon, null, Modifier.size(17.dp), tint = MaterialTheme.colorScheme.primary)
            }
            Text(value, Modifier.padding(top = 8.dp), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(label, Modifier.padding(top = 3.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun AccountScreen(
    m: Modifier,
    session: NativeSession?,
    message: String?,
    onMessage: (String?) -> Unit,
    onSession: (NativeSession?) -> Unit,
    onNavigate: (String) -> Unit
) {
    var mode by rememberSaveable { mutableStateOf("login") }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var profileBusy by remember { mutableStateOf(false) }
    var profileName by remember { mutableStateOf("") }
    var profilePhone by remember { mutableStateOf("") }
    var profileLocation by remember { mutableStateOf("") }
    var profilePosition by remember { mutableStateOf("") }
    var profileExperience by remember { mutableStateOf("") }
    var profileSkills by remember { mutableStateOf("") }
    var profileEducation by remember { mutableStateOf("") }
    var profileBio by remember { mutableStateOf("") }
    var profilePreferredLocation by remember { mutableStateOf("") }
    var profileJobType by remember { mutableStateOf("") }
    var profileIndustry by remember { mutableStateOf("") }
    var profileLoading by remember { mutableStateOf(false) }
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    LaunchedEffect(session?.userId) {
        if (session == null) {
            profileName = ""; profilePhone = ""; profileLocation = ""; profilePosition = ""
            profileExperience = ""; profileSkills = ""; profileEducation = ""; profileBio = ""
            profilePreferredLocation = ""; profileJobType = ""; profileIndustry = ""
        } else {
            profileLoading = true
            runCatching { NativeDataApi.loadProfile(session) }
                .onSuccess { p ->
                    if (p != null) {
                        profileName = p.optString("full_name")
                        profilePhone = p.optString("phone")
                        profileLocation = p.optString("location")
                        profilePosition = p.optString("current_position")
                        profileExperience = if (p.isNull("experience_years")) "" else p.optInt("experience_years").toString()
                        profileSkills = p.optJSONArray("skills")?.let { a -> (0 until a.length()).joinToString(", ") { a.optString(it) } }.orEmpty()
                        profileEducation = p.optString("education")
                        profileBio = p.optString("bio")
                        profilePreferredLocation = p.optString("preferred_location")
                        profileJobType = p.optString("job_type")
                        profileIndustry = p.optString("industry")
                    }
                }
                .onFailure { onMessage(it.message ?: "Profile load nahi ho saka.") }
            profileLoading = false
        }
    }
    LazyColumn(m.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Account", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (session != null) {
                        Text("Welcome to Workly India", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                        Text(session.email, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("Aapka account native app mein connected hai.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Button(onClick = { scope.launch { NativePushManager.unregister(ctx, session); NativeAuth.signOut(ctx); onSession(null); password = "" } }, Modifier.fillMaxWidth()) { Text("Logout") }
                    } else {
                        Text("Workly India mein shuru karein", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                        Text("Login ya account banayein — app ke andar hi.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (mode == "signup") OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text("Full name") }, singleLine = true)
                        OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Email address") }, singleLine = true)
                        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Password") }, singleLine = true)
                        Button(
                            enabled = !busy && email.contains("@") && password.length >= 6 && (mode == "login" || name.isNotBlank()),
                            onClick = {
                                scope.launch {
                                    busy = true
                                    onMessage(null)
                                    try {
                                        val result = if (mode == "login") NativeAuth.signIn(ctx, email, password)
                                            else NativeAuth.signUp(ctx, email, password, name)
                                        if (result == null) onMessage("Account create ho gaya. Email verify karke login karein.")
                                        else onSession(result)
                                    } catch (e: Exception) {
                                        onMessage(e.message ?: "Login nahi ho saka. Dobara try karein.")
                                    } finally { busy = false }
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) { Text(if (busy) "Please wait..." else if (mode == "login") "Login" else "Create account") }
                        TextButton(onClick = { mode = if (mode == "login") "signup" else "login"; onMessage(null) }) {
                            Text(if (mode == "login") "New user? Create account" else "Already have an account? Login")
                        }
                    }
                    if (!message.isNullOrBlank()) Text(
                        message,
                        color = if (message.contains("successful") || message.contains("submit") || message.contains("verify")) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                    )
                }
            }
        }
        if (session != null) item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AccountCircle, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
                        Column(Modifier.padding(start = 10.dp).weight(1f)) {
                            Text("My profile", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text("Apni job profile aur preferences update karein", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (profileLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    }
                    OutlinedTextField(profileName, { profileName = it }, Modifier.fillMaxWidth(), label = { Text("Full name") }, singleLine = true)
                    OutlinedTextField(session.email, {}, Modifier.fillMaxWidth(), label = { Text("Email address") }, readOnly = true, singleLine = true)
                    OutlinedTextField(profilePhone, { profilePhone = it }, Modifier.fillMaxWidth(), label = { Text("Phone number") }, singleLine = true)
                    OutlinedTextField(profileLocation, { profileLocation = it }, Modifier.fillMaxWidth(), label = { Text("Current location") }, singleLine = true)
                    OutlinedTextField(profilePosition, { profilePosition = it }, Modifier.fillMaxWidth(), label = { Text("Current position") }, singleLine = true)
                    OutlinedTextField(profileExperience, { profileExperience = it.filter(Char::isDigit).take(2) }, Modifier.fillMaxWidth(), label = { Text("Experience (years)") }, singleLine = true)
                    OutlinedTextField(profileSkills, { profileSkills = it }, Modifier.fillMaxWidth(), label = { Text("Skills (comma separated)") }, minLines = 2)
                    OutlinedTextField(profileEducation, { profileEducation = it }, Modifier.fillMaxWidth(), label = { Text("Education") }, minLines = 2)
                    OutlinedTextField(profileBio, { profileBio = it }, Modifier.fillMaxWidth(), label = { Text("About you") }, minLines = 3)
                    OutlinedTextField(profilePreferredLocation, { profilePreferredLocation = it }, Modifier.fillMaxWidth(), label = { Text("Preferred job location") }, singleLine = true)
                    OutlinedTextField(profileJobType, { profileJobType = it }, Modifier.fillMaxWidth(), label = { Text("Preferred job type") }, singleLine = true)
                    OutlinedTextField(profileIndustry, { profileIndustry = it }, Modifier.fillMaxWidth(), label = { Text("Preferred industry") }, singleLine = true)
                    Button(
                        enabled = !profileBusy && !profileLoading && profileName.isNotBlank(),
                        onClick = {
                            profileBusy = true
                            scope.launch {
                                runCatching {
                                    NativeDataApi.saveProfile(session, profileName, profilePhone, profileLocation,
                                        profilePosition, profileExperience.toIntOrNull(), profileSkills, profileEducation,
                                        profileBio, profilePreferredLocation, profileJobType, profileIndustry)
                                }.onSuccess { onMessage("Profile saved successfully.") }
                                    .onFailure { onMessage(it.message ?: "Profile save nahi ho saka.") }
                                profileBusy = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(if (profileBusy) "Saving profile…" else "Save profile") }
                }
            }
        }
        item { Text("More features", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium) }
        listOf(
            "AI Chat" to Icons.Default.AutoAwesome,
            "My applications" to Icons.Default.Description,
            "My resume" to Icons.Default.Article,
            "Cover letter builder" to Icons.Default.EditNote,
            "Employer dashboard" to Icons.Default.BusinessCenter,
            "Messages" to Icons.Default.Chat,
            "Notifications" to Icons.Default.Notifications,
            "Help & support" to Icons.Default.SupportAgent
        ).forEach { (title, icon) ->
            item {
                Card(onClick = { onNavigate(title) }, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(14.dp)) {
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
                        Text(title, Modifier.padding(start = 12.dp).weight(1f), fontWeight = FontWeight.SemiBold)
                        Icon(Icons.Default.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        item { Text("Workly India • Native Android", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun Message(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, body: String, action: (@Composable () -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().padding(vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(40.dp))
        Text(title, fontWeight = FontWeight.Bold); Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
        action?.invoke()
    }
}
