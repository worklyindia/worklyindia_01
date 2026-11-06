package com.worklyindia.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val Brand = Color(0xFF1646C8)
private val PageBg = Color(0xFFF4F6FB)
private val Ink = Color(0xFF151B2C)
private val Muted = Color(0xFF636B80)
private val Soft = Color(0xFFE7EDFC)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Brand, onPrimary = Color.White, background = PageBg,
                    surface = Color.White, onSurface = Ink, secondaryContainer = Soft
                )
            ) { WorklyApp() }
        }
    }
}

private fun openUrl(ctx: Context, url: String) =
    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

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
    val store = remember { SavedStore(ctx) }
    var authSession by remember { mutableStateOf(NativeAuth.session(ctx)) }
    var authMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    var tab by rememberSaveable { mutableStateOf("Home") }
    var selected by remember { mutableStateOf<Job?>(null) }
    var saved by remember { mutableStateOf(store.load()) }
    var search by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var categories by remember { mutableStateOf(listOf<String>()) }
    var state by remember { mutableStateOf<LoadState>(LoadState.Loading) }
    var reload by remember { mutableIntStateOf(0) }
    val known = remember { mutableStateMapOf<String, Job>() }

    LaunchedEffect(Unit) { runCatching { categories = JobsApi.fetchCategories() } }
    LaunchedEffect(search, category, reload) {
        if (search.isNotEmpty()) delay(350)
        state = LoadState.Loading
        state = runCatching { JobsApi.fetchJobs(search, category) }.fold(
            { list -> list.forEach { known[it.id] = it }; LoadState.Ready(list) },
            { LoadState.Error("Internet check karein aur dobara try karein.") }
        )
    }
    val toggleSave: (Job) -> Unit = { j ->
        saved = if (j.id in saved) saved - j.id else saved + j.id; store.save(saved)
    }

    BackHandler(enabled = selected != null || tab != "Home") {
        if (selected != null) selected = null else tab = "Home"
    }

    Scaffold(
        containerColor = PageBg,
        bottomBar = {
            if (selected == null) NavigationBar(containerColor = Color.White) {
                listOf("Home" to Icons.Default.Home, "Jobs" to Icons.Default.Search,
                    "Saved" to Icons.Default.Bookmark, "Account" to Icons.Default.Person)
                    .forEach { (label, icon) ->
                        NavigationBarItem(selected = tab == label, onClick = { tab = label },
                            icon = { Icon(icon, contentDescription = label) }, label = { Text(label) })
                    }
            }
        }
    ) { pad ->
        val m = Modifier.padding(pad)
        val job = selected
        when {
            job != null -> JobDetail(m, job, job.id in saved, { selected = null }, toggleSave,
                onApply = { if (job.externalApplyUrl.isNullOrBlank()) { if (authSession == null) { authMessage = "Apply karne ke liye login karein."; tab = "Account"; selected = null } else scope.launch { authMessage = try { NativeAuth.apply(ctx, job.id); "Application submit ho gayi." } catch (e: Exception) { e.message ?: "Apply nahi ho saka." }; selected = null; tab = "Account" } } else openUrl(ctx, job.externalApplyUrl) }, onShare = { shareJob(ctx, job) })
            tab == "Home" -> HomeScreen(m, state, categories, saved, toggleSave,
                onSearch = { search = it; tab = "Jobs" }, onCategory = { category = it; tab = "Jobs" },
                onJob = { selected = it }, onRetry = { reload++ }, onAll = { tab = "Jobs" },
                onEmployer = { tab = "Account" })
            tab == "Jobs" -> JobsScreen(m, state, search, { search = it }, categories, category, { category = it },
                saved, toggleSave, { selected = it }, { reload++ })
            tab == "Saved" -> SavedScreen(m, known.values.filter { it.id in saved }, saved.size, saved, toggleSave) { selected = it }
            else -> AccountScreen(m, authSession, authMessage, onMessage = { authMessage = it }, onSession = { authSession = it; authMessage = if (it == null) "Logout successful." else "Login successful." })
        }
    }
}

@Composable
private fun HomeScreen(
    m: Modifier, state: LoadState, categories: List<String>, saved: Set<String>, onSave: (Job) -> Unit,
    onSearch: (String) -> Unit, onCategory: (String) -> Unit, onJob: (Job) -> Unit, onRetry: () -> Unit, onAll: () -> Unit,
    onEmployer: () -> Unit
) {
    var q by remember { mutableStateOf("") }
    LazyColumn(m.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(R.drawable.ic_workly_launcher),
                    contentDescription = "Workly India logo",
                    modifier = Modifier.size(44.dp)
                )
                Column(Modifier.padding(start = 10.dp)) {
                    Text("Workly India", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    Text("Verified jobs across India", color = Muted, style = MaterialTheme.typography.labelMedium)
                }
            }
        }
        item {
            Surface(color = Soft, shape = RoundedCornerShape(22.dp)) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Find a job that fits your life", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, color = Ink)
                    OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), singleLine = true,
                        placeholder = { Text("Job title, city or company") },
                        leadingIcon = { Icon(Icons.Default.Search, null) }, shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White))
                    Button({ onSearch(q) }, Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) { Text("Search jobs", fontWeight = FontWeight.Bold) }
                    OutlinedButton(onEmployer, Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                        Icon(Icons.Default.BusinessCenter, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("I'm hiring — post a job")
                    }
                }
            }
        }
        if (categories.isNotEmpty()) item {
            Text("Categories", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            Row(Modifier.padding(top = 8.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                categories.take(12).forEach { c -> AssistChip({ onCategory(c) }, { Text(c) }) }
            }
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Latest jobs", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.weight(1f))
                TextButton(onAll) { Text("See all") }
            }
        }
        jobList(state, saved, onSave, onJob, onRetry, take = 5)
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
        if (state is LoadState.Ready) item { Text("${state.jobs.size} jobs", color = Muted, style = MaterialTheme.typography.bodySmall) }
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
    Card(Modifier.fillMaxWidth().clickable(onClick = onOpen), shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Logo(job)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(job.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(job.company, color = Muted, style = MaterialTheme.typography.bodySmall)
                }
                IconButton(onSave) { Icon(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, "Save job", tint = Brand) }
            }
            Text("📍 ${job.location}", color = Muted, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Pill(job.type)
                if (job.experience.isNotBlank()) Pill("${job.experience} yrs")
                if (job.featured) Pill("⭐ Featured")
            }
            Text(job.salary, color = Brand, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun Logo(job: Job) {
    val mod = Modifier.size(46.dp).clip(RoundedCornerShape(12.dp)).background(Soft)
    if (job.logoUrl != null) AsyncImage(job.logoUrl, job.company, mod, contentScale = ContentScale.Crop)
    else Box(mod, Alignment.Center) { Text(job.company.take(1), color = Brand, fontWeight = FontWeight.Bold) }
}

@Composable
private fun Pill(t: String) = Surface(color = Soft, shape = RoundedCornerShape(50)) {
    Text(t, Modifier.padding(horizontal = 10.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = Ink)
}

@Composable
private fun JobDetail(m: Modifier, job: Job, saved: Boolean, onBack: () -> Unit, onSave: (Job) -> Unit, onApply: () -> Unit, onShare: () -> Unit) {
    Column(m.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().background(Color.White).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onBack) { Icon(Icons.Default.ArrowBack, "Back") }
            Text("Job details", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            IconButton(onShare) { Icon(Icons.Default.Share, "Share") }
            IconButton({ onSave(job) }) { Icon(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, "Save", tint = Brand) }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Logo(job)
                Column(Modifier.padding(start = 12.dp)) {
                    Text(job.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(job.company, color = Muted)
                }
            }
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("💰 ${job.salary}", color = Brand, fontWeight = FontWeight.Bold)
                    Text("📍 ${job.location}")
                    Text("💼 ${job.type}" + if (job.experience.isNotBlank()) " • ${job.experience} yrs experience" else "")
                    Text("👥 ${job.openings} opening" + if (job.openings > 1) "s" else "")
                }
            }
            Section("About this job", job.description)
            Section("Requirements", job.requirements)
            Section("Benefits", job.benefits)
            if (job.skills.isNotEmpty()) {
                Text("Skills", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) { job.skills.forEach { Pill(it) } }
            }
        }
        Surface(color = Color.White, shadowElevation = 6.dp) {
            Button(onApply, Modifier.fillMaxWidth().padding(14.dp).height(50.dp), shape = RoundedCornerShape(12.dp)) {
                Text("Apply now", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun Section(title: String, body: String) {
    if (body.isBlank()) return
    Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
    Text(body, color = Ink, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun AccountScreen(
    m: Modifier,
    session: NativeSession?,
    message: String?,
    onMessage: (String?) -> Unit,
    onSession: (NativeSession?) -> Unit
) {
    var mode by rememberSaveable { mutableStateOf("login") }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    LazyColumn(m.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Account", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (session != null) {
                        Text("Welcome to Workly India", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                        Text(session.email, color = Muted)
                        Text("Aapka account native app mein connected hai.", color = Muted)
                        Button(onClick = { NativeAuth.signOut(ctx); onSession(null); password = "" }, Modifier.fillMaxWidth()) { Text("Logout") }
                    } else {
                        Text("Workly India mein shuru karein", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                        Text("Login ya account banayein — app ke andar hi.", color = Muted)
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
                        color = if (message.contains("successful") || message.contains("submit") || message.contains("verify")) Brand else MaterialTheme.colorScheme.error
                    )
                }
            }
        }
        item { Text("More features", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium) }
        listOf(
            "My applications" to Icons.Default.Description,
            "My resume" to Icons.Default.Article,
            "Employer dashboard" to Icons.Default.BusinessCenter,
            "Messages" to Icons.Default.Chat,
            "Notifications" to Icons.Default.Notifications,
            "Help & support" to Icons.Default.SupportAgent
        ).forEach { (title, icon) ->
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(icon, null, tint = Brand)
                        Text(title, Modifier.padding(start = 12.dp).weight(1f), fontWeight = FontWeight.SemiBold)
                        Text("Coming next", color = Muted, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
        item { Text("Workly India • Native Android", color = Muted, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun Message(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, body: String, action: (@Composable () -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().padding(vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, null, tint = Muted, modifier = Modifier.size(40.dp))
        Text(title, fontWeight = FontWeight.Bold); Text(body, color = Muted)
        action?.invoke()
    }
}
