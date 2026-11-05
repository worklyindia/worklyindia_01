package com.worklyindia.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

private val WorklyGreen = Color(0xFF128A52)
private val PageBg = Color(0xFFF5F8F5)
private val Ink = Color(0xFF17231C)
private val Muted = Color(0xFF647168)

private data class Job(
    val title: String, val company: String, val location: String,
    val salary: String, val type: String, val category: String
)

private val sampleJobs = listOf(
    Job("Customer Support Executive", "Workly Partner", "Remote • India", "₹15,000–25,000 / month", "Full time", "Customer support"),
    Job("Telecaller (Fresher)", "Bright Services", "Ahmedabad, Gujarat", "₹14,000–22,000 / month", "Full time", "Sales"),
    Job("Junior Web Developer", "Digital Studio", "Remote • India", "₹20,000–35,000 / month", "Full time", "IT & software"),
    Job("Data Entry Operator", "Office Solutions", "India", "₹12,000–18,000 / month", "Part time", "Admin"),
    Job("HR Recruiter", "Talent Connect", "Hybrid • Gujarat", "₹18,000–28,000 / month", "Full time", "HR")
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WorklyTheme { WorklyApp() }
        }
    }
}

@Composable
private fun WorklyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = WorklyGreen, onPrimary = Color.White,
            secondary = Color(0xFF28764A), background = PageBg,
            surface = Color.White, onSurface = Ink
        ),
        content = content
    )
}

@Composable
private fun WorklyApp() {
    var tab by remember { mutableStateOf("Home") }
    var selectedJob by remember { mutableStateOf<Job?>(null) }
    var search by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("All") }
    var role by remember { mutableStateOf("Job seeker") }
    var saved by remember { mutableStateOf(setOf<String>()) }
    var applied by remember { mutableStateOf(setOf<String>()) }

    val visibleJobs = sampleJobs.filter {
        (category == "All" || it.category == category) &&
        (search.isBlank() || it.title.contains(search, true) || it.company.contains(search, true) ||
            it.location.contains(search, true) || it.category.contains(search, true))
    }

    Scaffold(
        containerColor = PageBg,
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                listOf(
                    Triple("Home", Icons.Default.Home, "Home"),
                    Triple("Jobs", Icons.Default.Search, "Jobs"),
                    Triple("Saved", Icons.Default.Bookmark, "Saved"),
                    Triple("Profile", Icons.Default.Person, "Profile")
                ).forEach { (label, icon, destination) ->
                    NavigationBarItem(
                        selected = tab == destination,
                        onClick = { selectedJob = null; tab = destination },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label) }
                    )
                }
            }
        }
    ) { padding ->
        when {
            selectedJob != null -> JobDetail(
                job = selectedJob!!,
                isSaved = saved.contains(selectedJob!!.title),
                isApplied = applied.contains(selectedJob!!.title),
                onBack = { selectedJob = null },
                onSave = { title -> saved = if (saved.contains(title)) saved - title else saved + title },
                onApply = { title -> applied = applied + title }
            )
            tab == "Home" -> HomeScreen(
                modifier = Modifier.padding(padding),
                search = search, onSearch = { search = it },
                onExplore = { tab = "Jobs" },
                onRole = { role = it },
                role = role,
                jobs = sampleJobs.take(3),
                onJob = { selectedJob = it },
                onPost = { tab = "Post Job" }
            )
            tab == "Jobs" -> JobsScreen(
                modifier = Modifier.padding(padding),
                search = search, onSearch = { search = it },
                category = category, onCategory = { category = it },
                jobs = visibleJobs, onJob = { selectedJob = it }
            )
            tab == "Saved" -> JobsScreen(
                modifier = Modifier.padding(padding),
                search = "", onSearch = {},
                category = "All", onCategory = {},
                jobs = sampleJobs.filter { saved.contains(it.title) },
                onJob = { selectedJob = it },
                heading = "Saved jobs"
            )
            tab == "Profile" -> ProfileScreen(
                modifier = Modifier.padding(padding),
                role = role, onRole = { role = it },
                onPost = { tab = "Post Job" }
            )
            tab == "Post Job" -> PostJobScreen(
                modifier = Modifier.padding(padding),
                onBack = { tab = "Profile" }
            )
        }
    }
}

@Composable
private fun HomeScreen(
    modifier: Modifier, search: String, onSearch: (String) -> Unit,
    onExplore: () -> Unit, onRole: (String) -> Unit, role: String,
    jobs: List<Job>, onJob: (Job) -> Unit, onPost: () -> Unit
) {
    LazyColumn(modifier = modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(42.dp).background(WorklyGreen, RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) {
                    Text("W", color = Color.White, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
                }
                Column(Modifier.padding(start = 10.dp)) {
                    Text("Workly India", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    Text("Find work. Build your future.", color = Muted, style = MaterialTheme.typography.labelSmall)
                }
                Spacer(Modifier.weight(1f))
                Icon(Icons.Default.NotificationsNone, contentDescription = "Notifications", tint = Ink)
            }
        }
        item {
            Surface(color = Color(0xFFE4F3E8), shape = RoundedCornerShape(24.dp)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("YOUR NEXT OPPORTUNITY", color = WorklyGreen, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                    Text("Find a job that
fits your life.", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, color = Ink)
                    Text("Explore opportunities across India, including remote jobs.", color = Muted)
                    OutlinedTextField(
                        value = search, onValueChange = onSearch, modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Job title, skill or company") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
                        singleLine = true, shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White)
                    )
                    Button(onClick = onExplore, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                        Text("Search jobs", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("I am here to…", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.weight(1f))
                Text("Change", color = WorklyGreen, modifier = Modifier.clickable { onRole(if (role == "Job seeker") "Employer" else "Job seeker") })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RoleCard("Find a job", "Explore & apply", role == "Job seeker", Modifier.weight(1f)) { onRole("Job seeker") }
                RoleCard("Hire talent", "Post a vacancy", role == "Employer", Modifier.weight(1f)) { onRole("Employer"); onPost() }
            }
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Popular categories", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.weight(1f))
                Text("See all", color = WorklyGreen, modifier = Modifier.clickable(onClick = onExplore))
            }
            Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CategoryTag("Customer support")
                CategoryTag("IT & software")
            }
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CategoryTag("Sales")
                CategoryTag("Work from home")
            }
        }
        item { Text("Featured opportunities", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium) }
        items(jobs) { JobCard(it, false, {}, onJob) }
        item {
            OutlinedButton(onClick = onExplore, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                Text("Explore all jobs")
            }
        }
    }
}

@Composable
private fun RoleCard(title: String, subtitle: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Card(modifier.clickable(onClick), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = if (selected) Color(0xFFE6F4EA) else Color.White)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(if (title == "Find a job") Icons.Default.WorkOutline else Icons.Default.BusinessCenter, contentDescription = null, tint = WorklyGreen)
            Text(title, fontWeight = FontWeight.Bold)
            Text(subtitle, color = Muted, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun JobsScreen(
    modifier: Modifier, search: String, onSearch: (String) -> Unit,
    category: String, onCategory: (String) -> Unit, jobs: List<Job>,
    onJob: (Job) -> Unit, heading: String = "Explore jobs"
) {
    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text(heading, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        if (heading != "Saved jobs") {
            item {
                OutlinedTextField(
                    value = search, onValueChange = onSearch, modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search title, company, location") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    singleLine = true, shape = RoundedCornerShape(14.dp)
                )
            }
            item {
                Text("Category", fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("All", "Customer support", "Sales", "IT & software", "Admin", "HR").forEach {
                        FilterChip(selected = category == it, onClick = { onCategory(it) }, label = { Text(it) })
                    }
                }
            }
        }
        item { Text("${jobs.size} opportunities", color = Muted, style = MaterialTheme.typography.bodySmall) }
        if (jobs.isEmpty()) item { EmptyState("No jobs found", "Try another search or save jobs to see them here.") }
        items(jobs) { JobCard(it, false, {}, onJob) }
    }
}

@Composable
private fun JobCard(job: Job, saved: Boolean, onSave: () -> Unit, onOpen: (Job) -> Unit) {
    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Box(Modifier.size(42.dp).background(Color(0xFFE8F4EC), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                    Text(job.company.take(1), color = WorklyGreen, fontWeight = FontWeight.Bold)
                }
                Column(Modifier.weight(1f).padding(start = 10.dp)) {
                    Text(job.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text(job.company, color = Muted, style = MaterialTheme.typography.bodySmall)
                }
                IconButton(onClick = onSave) { Icon(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = "Save job", tint = WorklyGreen) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AssistChip(onClick = {}, label = { Text(job.type) })
                AssistChip(onClick = {}, label = { Text(job.location) })
            }
            Text(job.salary, color = WorklyGreen, fontWeight = FontWeight.SemiBold)
            Button(onClick = { onOpen(job) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp)) {
                Text("View job & apply")
            }
        }
    }
}

@Composable
private fun JobDetail(job: Job, isSaved: Boolean, isApplied: Boolean, onBack: () -> Unit, onSave: (String) -> Unit, onApply: (String) -> Unit) {
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") }
            Text("Job details", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
        }
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(job.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(job.company, color = Muted)
                Text(job.salary, color = WorklyGreen, fontWeight = FontWeight.Bold)
                Text("📍 ${job.location}")
                Text("Employment: ${job.type}")
                Text("About this role", fontWeight = FontWeight.Bold)
                Text("We are looking for motivated candidates. Review the role details and apply when you are ready. Verify employer information before sharing personal details.")
                Text("Requirements", fontWeight = FontWeight.Bold)
                Text("• Communication and role-related skills\n• Willingness to learn\n• Relevant experience is an advantage")
            }
        }
        OutlinedButton(onClick = { onSave(job.title) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
            Icon(if (isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = null)
            Spacer(Modifier.width(8.dp)); Text(if (isSaved) "Saved" else "Save job")
        }
        Button(onClick = { onApply(job.title) }, modifier = Modifier.fillMaxWidth(), enabled = !isApplied, shape = RoundedCornerShape(12.dp)) {
            Text(if (isApplied) "Application started (demo)" else "Apply now")
        }
        Text("Demo content: live listings and application submission require backend integration.", color = Muted, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ProfileScreen(modifier: Modifier, role: String, onRole: (String) -> Unit, onPost: () -> Unit) {
    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text("My profile", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(58.dp).background(Color(0xFFE4F3E8), RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = WorklyGreen, modifier = Modifier.size(32.dp))
                    }
                    Text("Welcome to Workly India", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    Text("Sign in to sync your profile, applications and saved jobs.", color = Muted)
                    Button(onClick = { onRole("Job seeker") }, modifier = Modifier.fillMaxWidth()) { Text("Continue as job seeker") }
                    OutlinedButton(onClick = { onRole("Employer") }, modifier = Modifier.fillMaxWidth()) { Text("Continue as employer") }
                }
            }
        }
        item { ProfileMenuRow("Build my resume", "Create a professional resume", Icons.Default.Description) }
        item { ProfileMenuRow("My applications", "Track your job applications", Icons.Default.Assignment) }
        item { ProfileMenuRow("Help & support", "Contact Workly India", Icons.Default.SupportAgent) }
        item { ProfileMenuRow("Privacy & safety", "Stay safe while job searching", Icons.Default.Security) }
        item { if (role == "Employer") Button(onClick = onPost, modifier = Modifier.fillMaxWidth()) { Text("Post a job") } }
        item { Text("Native app preview • Account services are not connected yet", color = Muted, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun ProfileMenuRow(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = WorklyGreen)
            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold)
                Text(subtitle, color = Muted, style = MaterialTheme.typography.bodySmall)
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Muted)
        }
    }
}

@Composable
private fun PostJobScreen(modifier: Modifier, onBack: () -> Unit) {
    var title by remember { mutableStateOf("") }
    var company by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var salary by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf(false) }
    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") }
            Text("Post a job", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        } }
        item { Text("Reach candidates across India. Fill in the role details below.", color = Muted) }
        item { OutlinedTextField(title, { title = it }, label = { Text("Job title *") }, modifier = Modifier.fillMaxWidth(), singleLine = true) }
        item { OutlinedTextField(company, { company = it }, label = { Text("Company name *") }, modifier = Modifier.fillMaxWidth(), singleLine = true) }
        item { OutlinedTextField(location, { location = it }, label = { Text("Location / Remote *") }, modifier = Modifier.fillMaxWidth(), singleLine = true) }
        item { OutlinedTextField(salary, { salary = it }, label = { Text("Salary range") }, modifier = Modifier.fillMaxWidth(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)) }
        item { OutlinedTextField(description, { description = it }, label = { Text("Job description *") }, modifier = Modifier.fillMaxWidth(), minLines = 4) }
        item {
            Button(onClick = { submitted = true }, enabled = title.isNotBlank() && company.isNotBlank() && location.isNotBlank() && description.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                Text("Preview job post")
            }
        }
        if (submitted) item { Text("Preview ready. Publishing requires employer sign-in and server validation.", color = WorklyGreen, fontWeight = FontWeight.SemiBold) }
        item { Text("This is a UI preview; no job is published or sent to a server.", color = Muted, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun CategoryTag(label: String) {
    Surface(color = Color.White, shape = RoundedCornerShape(50)) {
        Text(label, modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp), color = WorklyGreen, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun EmptyState(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Default.SearchOff, contentDescription = null, tint = Muted, modifier = Modifier.size(40.dp))
        Text(title, fontWeight = FontWeight.Bold)
        Text(body, color = Muted)
    }
}
