package com.worklyindia.app

import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

@Composable
fun NativeFeatureScreen(m:Modifier,title:String,session:NativeSession?,onBack:()->Unit) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var refresh by remember { mutableIntStateOf(0) }
    var applications by remember { mutableStateOf<List<NativeApplication>>(emptyList()) }
    var notifications by remember { mutableStateOf<List<NativeNotification>>(emptyList()) }
    var conversations by remember { mutableStateOf<List<NativeConversation>>(emptyList()) }
    var chatMessages by remember { mutableStateOf<List<NativeChatMessage>>(emptyList()) }
    var selectedConversation by remember { mutableStateOf<NativeConversation?>(null) }
    var message by remember { mutableStateOf("") }
    var resumeName by remember { mutableStateOf("") }
    var resumeHeadline by remember { mutableStateOf("") }
    var resumeSkills by remember { mutableStateOf("") }
    var resumeExperience by remember { mutableStateOf("") }
    var resumeEducation by remember { mutableStateOf("") }
    var employerJobs by remember { mutableStateOf<List<Pair<String,String>>>(emptyList()) }
    var jobTitle by remember { mutableStateOf("") }
    var jobLocation by remember { mutableStateOf("") }
    var jobDescription by remember { mutableStateOf("") }
    var jobType by remember { mutableStateOf("Full Time") }
    var coverRole by remember { mutableStateOf("") }
    var coverCompany by remember { mutableStateOf("") }
    var coverText by remember { mutableStateOf("") }
    var supportTitle by remember { mutableStateOf("") }
    var supportDescription by remember { mutableStateOf("") }
    var supportCategory by remember { mutableStateOf("Account") }
    val scope= rememberCoroutineScope()

    LaunchedEffect(title,session,refresh,selectedConversation?.id) {
        if(session==null) return@LaunchedEffect
        busy=true; error=null
        try {
            when(title) {
                "My applications" -> applications=NativeDataApi.applications(session)
                "Notifications" -> notifications=NativeDataApi.notifications(session)
                "Messages" -> {
                    if(selectedConversation==null) conversations=NativeDataApi.conversations(session)
                    else chatMessages=NativeDataApi.messages(session,selectedConversation!!.id)
                }
                "My resume" -> NativeDataApi.loadResumeDraft(session)?.let { d ->
                    resumeName=d.optString("full_name"); resumeHeadline=d.optString("headline")
                    resumeSkills=d.optString("skills"); resumeExperience=d.optString("experience"); resumeEducation=d.optString("education")
                }
                "Employer dashboard" -> employerJobs=NativeDataApi.employerJobs(session)
            }
        } catch(e:Exception) { error=e.message ?: "Data load nahi ho saka." }
        finally { busy=false }
    }

    Column(m.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically) {
            IconButton(onBack) { Icon(Icons.Default.ArrowBack,"Back") }
            Text(selectedConversation?.jobTitle ?: title,Modifier.weight(1f),style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
            if(title in listOf("My applications","Notifications","Messages","Employer dashboard")) IconButton(onClick={refresh++}) { Icon(Icons.Default.Refresh,"Refresh") }
        }
        if(session==null) {
            Box(Modifier.fillMaxSize().padding(24.dp),contentAlignment=Alignment.Center) {
                Column(horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.Lock,null,Modifier.size(42.dp),tint=MaterialTheme.colorScheme.primary)
                    Text("Login required",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
                    Text("Is feature ko use karne ke liye Account tab se login karein.",color=MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else when(title) {
            "AI Chat" -> NativeAIChatScreen(session)
            "Connected accounts" -> {
                LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    item { Text("Connect your communication channels",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
                    item { Text("Account permissions are managed securely. A channel will show Connected only after its provider OAuth/token setup has been completed and verified.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant) }
                    item { NativeChannelCard("WhatsApp Business","Business inbox, customer messages and approved templates","Official Meta Business connection required",Icons.Default.Chat) }
                    item { NativeChannelCard("Instagram","Business DMs, comments and account profile","Instagram Business OAuth and permissions required",Icons.Default.CameraAlt) }
                    item { NativeChannelCard("Facebook Messenger","Page inbox, messages and page identity","Facebook Page OAuth and permissions required",Icons.Default.Facebook) }
                    item { NativeChannelCard("Gmail","Read and reply to connected Gmail mailbox","Google OAuth consent and verified callback required",Icons.Default.Email) }
                    item { NativeChannelCard("Outlook","Microsoft mailbox and email conversations","Microsoft OAuth app and callback required",Icons.Default.Mail) }
                    item { NativeChannelCard("Domain Email","IMAP/SMTP mailbox connection","Mailbox host, port and app-password setup required",Icons.Default.AlternateEmail) }
                    item { NativeChannelCard("Telegram","Bot messages and automated replies","Telegram bot token and webhook required",Icons.Default.Send) }
                    item { NativeChannelCard("Google Business Profile","Business reviews and profile interactions","Google Business Profile API access required",Icons.Default.Business) }
                    item { Text("Important: provider connect flows are not yet enabled in this Android build. These accounts are not falsely marked as connected.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.error) }
                }
            }
            "My applications" -> {
                if(busy) LoadingNative()
                else if(applications.isEmpty()) EmptyNative("Abhi applications nahi hain","Jobs par apply karne ke baad yahan status dikhega.")
                else LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    items(applications,key={it.id}) { a -> NativeRowCard(a.jobTitle,a.company.ifBlank{"Workly India"},a.status.replaceFirstChar{it.uppercase()}) }
                }
            }
            "Notifications" -> {
                if(busy) LoadingNative()
                else if(notifications.isEmpty()) EmptyNative("No notifications","Naye job aur account updates yahan aayenge.")
                else LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    items(notifications,key={it.id}) { n ->
                        Card(Modifier.fillMaxWidth().clickable {
                            if(!n.read) scope.launch { runCatching { NativeDataApi.markNotificationRead(session,n.id); refresh++ }.onFailure{error=it.message} }
                        },colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
                            Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                                Row(verticalAlignment=Alignment.CenterVertically) {
                                    Text(n.title,Modifier.weight(1f),fontWeight=FontWeight.Bold)
                                    if(!n.read) Badge { Text("NEW") }
                                }
                                Text(n.message,color=MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(if(n.read)"Read" else "Tap to mark as read",style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }
            "Messages" -> {
                if(selectedConversation==null) {
                    if(busy) LoadingNative()
                    else if(conversations.isEmpty()) EmptyNative("No conversations yet","Employer ya applicant se conversation shuru hone par yahan dikhegi.")
                    else LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        items(conversations,key={it.id}) { c -> NativeRowCard(c.jobTitle,"Conversation ID: ${c.id.take(8)}","Open") { selectedConversation=c } }
                    }
                } else {
                    Column(Modifier.weight(1f)) {
                        if(busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                        LazyColumn(Modifier.weight(1f).fillMaxWidth(),contentPadding=PaddingValues(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                            items(chatMessages,key={it.id}) { msg ->
                                Row(Modifier.fillMaxWidth(),horizontalArrangement=if(msg.senderId==session.userId)Arrangement.End else Arrangement.Start) {
                                    Surface(color=if(msg.senderId==session.userId)MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                                        shape=RoundedCornerShape(14.dp)) {
                                        Text(msg.message,Modifier.widthIn(max=300.dp).padding(12.dp),color=MaterialTheme.colorScheme.onSurface)
                                    }
                                }
                            }
                        }
                        Row(Modifier.fillMaxWidth().padding(10.dp),verticalAlignment=Alignment.CenterVertically) {
                            OutlinedTextField(message,{message=it},Modifier.weight(1f),placeholder={Text("Message…")},maxLines=4)
                            IconButton(enabled=message.isNotBlank()&&!busy,onClick={
                                val text=message
                                scope.launch { busy=true; runCatching { NativeDataApi.sendMessage(session,selectedConversation!!.id,text); message=""; chatMessages=NativeDataApi.messages(session,selectedConversation!!.id) }.onFailure{error=it.message}; busy=false }
                            }) { Icon(Icons.Default.Send,"Send") }
                        }
                    }
                }
            }
            "My resume" -> LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                item { Text("Resume builder",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
                item { OutlinedTextField(resumeName,{resumeName=it},Modifier.fillMaxWidth(),label={Text("Full name")},singleLine=true) }
                item { OutlinedTextField(resumeHeadline,{resumeHeadline=it},Modifier.fillMaxWidth(),label={Text("Professional headline")},singleLine=true) }
                item { OutlinedTextField(resumeSkills,{resumeSkills=it},Modifier.fillMaxWidth(),label={Text("Skills")},minLines=2) }
                item { OutlinedTextField(resumeExperience,{resumeExperience=it},Modifier.fillMaxWidth(),label={Text("Work experience")},minLines=4) }
                item { OutlinedTextField(resumeEducation,{resumeEducation=it},Modifier.fillMaxWidth(),label={Text("Education")},minLines=3) }
                item { Button(enabled=!busy&&resumeName.isNotBlank(),onClick={scope.launch { busy=true; runCatching { NativeDataApi.saveResumeDraft(session,resumeName,resumeHeadline,resumeSkills,resumeExperience,resumeEducation); error="Resume draft saved." }.onFailure{error=it.message}; busy=false }},modifier=Modifier.fillMaxWidth()) { Text(if(busy)"Saving…" else "Save resume draft") } }
                item { Text("Resume PDF templates and export are not connected yet.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            "Cover letter builder" -> LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                item { Text("Cover letter builder",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
                item { OutlinedTextField(coverRole,{coverRole=it},Modifier.fillMaxWidth(),label={Text("Job title")},singleLine=true) }
                item { OutlinedTextField(coverCompany,{coverCompany=it},Modifier.fillMaxWidth(),label={Text("Company")},singleLine=true) }
                item { OutlinedTextField(coverText,{coverText=it},Modifier.fillMaxWidth(),label={Text("Your cover letter")},minLines=8) }
                item { Button(enabled=!busy&&coverText.isNotBlank(),onClick={scope.launch { busy=true; runCatching { NativeDataApi.saveCoverLetterDraft(session,coverRole,coverCompany,coverText); error="Cover letter draft saved." }.onFailure{error=it.message}; busy=false }},modifier=Modifier.fillMaxWidth()) { Text("Save cover letter") } }
            }
            "Help & support" -> LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                item { Text("Create a support ticket",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
                item { OutlinedTextField(supportTitle,{supportTitle=it},Modifier.fillMaxWidth(),label={Text("Subject")},singleLine=true) }
                item { OutlinedTextField(supportCategory,{supportCategory=it},Modifier.fillMaxWidth(),label={Text("Category (Account / Jobs / Payment)")},singleLine=true) }
                item { OutlinedTextField(supportDescription,{supportDescription=it},Modifier.fillMaxWidth(),label={Text("Describe your issue")},minLines=5) }
                item { Button(enabled=!busy&&supportTitle.isNotBlank()&&supportDescription.isNotBlank(),onClick={scope.launch { busy=true; runCatching { NativeDataApi.createSupportTicket(session,supportTitle,supportDescription,supportCategory); supportTitle=""; supportDescription=""; error="Support ticket submitted." }.onFailure{error=it.message}; busy=false }},modifier=Modifier.fillMaxWidth()) { Text("Submit support ticket") } }
            }
            "Employer dashboard" -> LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                item { Text("Your job postings",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
                if(employerJobs.isEmpty()) item { EmptyNative("Company profile not found","Job post karne se pehle employer company profile complete karein.") }
                items(employerJobs) { NativeRowCard(it.first,"Employer listing",it.second) }
                item { HorizontalDivider() }
                item { Text("Create a private draft",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
                item { OutlinedTextField(jobTitle,{jobTitle=it},Modifier.fillMaxWidth(),label={Text("Job title")},singleLine=true) }
                item { OutlinedTextField(jobLocation,{jobLocation=it},Modifier.fillMaxWidth(),label={Text("Location")},singleLine=true) }
                item { OutlinedTextField(jobDescription,{jobDescription=it},Modifier.fillMaxWidth(),label={Text("Job description")},minLines=4) }
                item { OutlinedTextField(jobType,{jobType=it},Modifier.fillMaxWidth(),label={Text("Job type")},singleLine=true) }
                item { Button(enabled=!busy&&jobTitle.isNotBlank()&&jobLocation.isNotBlank()&&jobDescription.isNotBlank(),onClick={scope.launch { busy=true; runCatching { NativeDataApi.createJobDraft(session,jobTitle,jobLocation,jobDescription,jobType); jobTitle=""; jobLocation=""; jobDescription=""; employerJobs=NativeDataApi.employerJobs(session); error="Private draft saved. Publish workflow is not yet connected." }.onFailure{error=it.message}; busy=false }},modifier=Modifier.fillMaxWidth()) { Text("Save job draft") } }
            }
            else -> InfoNativePage(title)
        }
        if(error!=null) Text(error!!,Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=8.dp),color=if(error!!.contains("saved",true))MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
    }
}

@Composable private fun NativeRowCard(title:String,subtitle:String,status:String,onClick:(()->Unit)?=null) {
    Card(Modifier.fillMaxWidth().then(if(onClick!=null)Modifier.clickable{onClick()}else Modifier),colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
        Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text(title,fontWeight=FontWeight.SemiBold); Text(subtitle,color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall) }
            Text(status,color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.labelMedium)
        }
    }
}
@Composable private fun LoadingNative() { Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){CircularProgressIndicator()} }
@Composable private fun EmptyNative(title:String,body:String) { Box(Modifier.fillMaxWidth().padding(28.dp),contentAlignment=Alignment.Center){Column(horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(8.dp)){Icon(Icons.Default.Inbox,null,Modifier.size(36.dp),tint=MaterialTheme.colorScheme.onSurfaceVariant);Text(title,fontWeight=FontWeight.Bold);Text(body,color=MaterialTheme.colorScheme.onSurfaceVariant)}} }
@Composable private fun InfoNativePage(title:String) {
    val body=when(title) {
        "About Us" -> "Workly India connects job seekers and employers across India through job discovery, applications and career tools."
        "Mission" -> "Our mission is to make job discovery and hiring more accessible, transparent and useful for people across India."
        "Vision" -> "Our vision is a trusted digital employment ecosystem where every candidate and employer can connect with confidence."
        "Why Choose Workly India" -> "Explore opportunities, manage applications and connect with employers from one native app experience."
        "Trust & Safety" -> "Never pay an employer to get a job. Verify company details, protect personal information and report suspicious activity."
        "Employer Guidelines" -> "Employers should publish accurate job descriptions, transparent compensation details and fair hiring requirements."
        "Job Seeker Guidelines" -> "Keep your profile accurate, apply to relevant roles and never share OTPs, passwords or payment details with recruiters."
        "Community Guidelines" -> "Treat candidates and employers respectfully. Do not post misleading, abusive, discriminatory or fraudulent content."
        "Privacy Policy" -> "Workly India uses account and application information to provide job discovery and hiring features. Review data access and account settings before sharing personal details."
        "Terms & Conditions" -> "Use Workly India lawfully and provide accurate information. Job availability and employer decisions may change; users should independently verify offers."
        "Refund & Cancellation" -> "Paid services are subject to the applicable purchase terms. Keep transaction references and contact support for billing disputes."
        "Accessibility Statement" -> "The app supports Android system Light and Dark themes, scalable native layouts and accessible labels for core controls."
        "FAQ" -> "For account, application, employer and payment questions, contact Workly India support through the Help & Support section."
        "Contact Us" -> "For assistance, use the Help & Support option in your Workly India account."
        "Cookie Policy" -> "This native app does not use browser cookies for its core app screens. Connected services may process data under their own policies."
        "Disclaimer" -> "Workly India is a job platform. Candidates should verify employers and offers before sharing sensitive information or accepting employment."
        "DMCA / Copyright Policy" -> "Report content you believe infringes your copyright through Workly India support with the relevant ownership and content details."
        "Website Pricing" -> "Pricing details are not yet synchronized into the native app. No purchase is made from this screen."
        "Blog" -> "Native blog feed is not connected yet."
        "Sitemap" -> "Native app navigation includes Home, Jobs, Saved, More and Account."
        "Careers" -> "Workly India career opportunities will appear here when available."
        "Press / Media Kit" -> "Press and media resources are not yet published in this native screen."
        else -> "This section is available inside the Workly India app. More detailed content is being prepared."
    }
    Column(Modifier.fillMaxSize().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text(title,style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text(body,style=MaterialTheme.typography.bodyLarge,color=MaterialTheme.colorScheme.onSurfaceVariant)
    }
}


@Composable private fun NativeChannelCard(name:String,description:String,requirement:String,icon:androidx.compose.ui.graphics.vector.ImageVector) {
    Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
        Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            Surface(shape=RoundedCornerShape(12.dp),color=MaterialTheme.colorScheme.secondaryContainer) { Icon(icon,null,Modifier.padding(10.dp).size(23.dp),tint=MaterialTheme.colorScheme.primary) }
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(3.dp)) {
                Text(name,fontWeight=FontWeight.SemiBold)
                Text(description,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                Text(requirement,style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.tertiary)
            }
            Text("Setup",style=MaterialTheme.typography.labelMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}


private data class NativeAIMessage(val role: String, val content: String)

@Composable
private fun NativeAIChatScreen(session: NativeSession) {
    val messages = remember(session.userId) { mutableStateListOf<NativeAIMessage>() }
    var draft by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("Ready when you are") }
    var failure by remember { mutableStateOf<String?>(null) }
    var thinkHarder by remember { mutableStateOf(false) }
    var showComposerMenu by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val speechLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!spoken.isNullOrBlank()) draft = listOf(draft.trim(), spoken).filter { it.isNotBlank() }.joinToString(" ")
    }
    val scope = rememberCoroutineScope()
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()

    LaunchedEffect(messages.size, messages.lastOrNull()?.content) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    fun send(text: String) {
        val rawPrompt = text.trim()
        if (rawPrompt.isBlank() || sending) return
        val prompt = if (thinkHarder) "$rawPrompt\\n\\nPlease think carefully, verify the reasoning, and provide a more detailed, well-structured answer." else rawPrompt
        draft = ""
        thinkHarder = false
        failure = null
        messages.add(NativeAIMessage("user", prompt))
        messages.add(NativeAIMessage("assistant", ""))
        sending = true
        status = "Thinking…"
        scope.launch {
            try {
                val history = messages.dropLast(1).map { it }
                val answer = callNativeCareerAI(history, session) { partial, liveStatus ->
                    if (messages.isNotEmpty() && messages.last().role == "assistant") {
                        messages[messages.lastIndex] = NativeAIMessage("assistant", partial)
                    }
                    if (!liveStatus.isNullOrBlank()) status = liveStatus
                }
                if (messages.isNotEmpty() && messages.last().role == "assistant") {
                    messages[messages.lastIndex] = NativeAIMessage("assistant", answer.ifBlank { "I couldn't prepare a response. Please try again." })
                }
                status = "Ready"
            } catch (e: Exception) {
                if (messages.isNotEmpty() && messages.last().role == "assistant") {
                    messages[messages.lastIndex] = NativeAIMessage("assistant", "")
                }
                failure = e.message ?: "AI Chat abhi available nahi hai. Dobara try karein."
                status = "Couldn't send"
            } finally {
                sending = false
            }
        }
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)) {
                Icon(Icons.Default.AutoAwesome, null, Modifier.padding(10.dp).size(23.dp), tint = MaterialTheme.colorScheme.primary)
            }
            Column(Modifier.weight(1f).padding(start = 11.dp)) {
                Text("Workly AI", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(status, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = { if (!sending) { messages.clear(); failure = null; status = "New chat" } }, enabled = !sending) {
                Icon(Icons.Default.DeleteOutline, contentDescription = "Clear chat")
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        if (messages.isEmpty()) {
            LazyColumn(
                Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 22.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                item {
                    Text("YOUR EVERYDAY AI ASSISTANT", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    Text("What would you like help with today?", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
                    Text("Ask about careers, resumes, interviews, writing or everyday questions. You can chat in Hindi or English.", Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
                item {
                    Text("Try asking", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        listOf(
                            "Help me prepare for my first job interview",
                            "Write a professional summary for my resume",
                            "Find skills I should learn for a customer support job",
                            "Explain this in simple Hindi"
                        ).forEach { prompt ->
                            Card(
                                onClick = { send(prompt) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(15.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
                            ) {
                                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.AutoAwesome, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                    Text(prompt, Modifier.weight(1f).padding(start = 10.dp), style = MaterialTheme.typography.bodyMedium)
                                    Icon(Icons.Default.ArrowUpward, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(17.dp))
                                }
                            }
                        }
                    }
                }
                item {
                    Text("AI can make mistakes. Verify important job, financial and personal decisions with trusted sources.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                items(messages.size) { index ->
                    val item = messages[index]
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = if (item.role == "user") Arrangement.End else Arrangement.Start
                    ) {
                        Surface(
                            modifier = Modifier.widthIn(max = 320.dp),
                            color = if (item.role == "user") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                            shape = RoundedCornerShape(18.dp),
                            border = if (item.role == "assistant") androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f)) else null
                        ) {
                            if (item.content.isBlank() && sending && item.role == "assistant") {
                                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                                    Text(status, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            } else {
                                Text(item.content, Modifier.padding(horizontal = 15.dp, vertical = 12.dp), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
                if (failure != null) item {
                    Text(failure!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { val lastUser = messages.lastOrNull { it.role == "user" }?.content; if (lastUser != null && !sending) { messages.removeAll { it.role == "assistant" && it.content.isBlank() }; send(lastUser) } }) { Text("Try again") }
                }
            }
        }
        Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 6.dp) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp)) {
                if (thinkHarder) {
                    AssistChip(
                        onClick = { thinkHarder = false },
                        label = { Text("Think harder · On") },
                        leadingIcon = { Icon(Icons.Default.Psychology, null) },
                        trailingIcon = { Icon(Icons.Default.Close, null) }
                    )
                }
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Box {
                        FilledTonalIconButton(onClick = { showComposerMenu = true }, enabled = !sending, modifier = Modifier.size(46.dp)) {
                            Icon(Icons.Default.Add, contentDescription = "More options")
                        }
                        DropdownMenu(expanded = showComposerMenu, onDismissRequest = { showComposerMenu = false }) {
                            DropdownMenuItem(
                                text = { Text(if (thinkHarder) "Turn off Think harder" else "Think harder") },
                                leadingIcon = { Icon(Icons.Default.Psychology, null) },
                                onClick = { thinkHarder = !thinkHarder; showComposerMenu = false }
                            )
                        }
                    }
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Message…") },
                        maxLines = 6,
                        shape = RoundedCornerShape(25.dp),
                        enabled = !sending
                    )
                    if (draft.isBlank() && !sending) {
                        FilledTonalIconButton(
                            onClick = {
                                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                    putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to Workly AI")
                                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN")
                                }
                                runCatching { speechLauncher.launch(intent) }
                                    .onFailure { failure = "Voice typing is not available on this device. Install or enable a speech recognition service." }
                            },
                            modifier = Modifier.size(46.dp)
                        ) { Icon(Icons.Default.Mic, contentDescription = "Voice typing") }
                    }
                    FilledIconButton(
                        onClick = { send(draft) },
                        enabled = draft.isNotBlank() && !sending,
                        modifier = Modifier.size(46.dp)
                    ) { Icon(Icons.Default.ArrowUpward, contentDescription = "Send message") }
                }
                Text(
                    if (sending) "Workly AI is generating a response…" else "Voice typing · Think harder · Streaming AI replies",
                    Modifier.fillMaxWidth().padding(top = 5.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }
    }
}

private suspend fun callNativeCareerAI(
    history: List<NativeAIMessage>,
    session: NativeSession,
    onUpdate: suspend (String, String?) -> Unit
): String = withContext(Dispatchers.IO) {
    val base = "https://jubwzelupbntbetpajqb.supabase.co"
    val key = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
    val payload = JSONObject()
        .put("messages", JSONArray().apply {
            history.forEach { put(JSONObject().put("role", it.role).put("content", it.content)) }
        })
        .put("user_id", session.userId)
        .put("hasImages", false)
        .put("currentPage", "/ai-assistant")
        .put("audience", "job_seeker")
        .put("pageContext", JSONObject().put("path", "/ai-assistant").put("page", "AI Chat").put("audience", "job_seeker"))
    val connection = (URL("$base/functions/v1/ai-career-chat").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 20000
        readTimeout = 180000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Accept", "text/event-stream, application/json")
        setRequestProperty("apikey", key)
        setRequestProperty("Authorization", "Bearer ${session.accessToken}")
    }
    try {
        connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        if (code !in 200..299) {
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val detail = runCatching { JSONObject(body).optString("userMessage").ifBlank { JSONObject(body).optString("error") } }.getOrNull()
            throw IllegalStateException(detail?.takeIf { it.isNotBlank() } ?: when (code) {
                401, 403 -> "Session expire ho gayi. Dobara login karein."
                402, 429 -> "AI Chat usage limit complete ho gayi. Apna plan check karein."
                else -> "AI request failed ($code). Dobara try karein."
            })
        }
        if (connection.contentType?.contains("application/json", true) == true) {
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = JSONObject(body)
            return@withContext json.optString("response").ifBlank { json.optString("message") }
        }
        var full = ""
        var latestStatus: String? = "Workly AI is thinking…"
        stream?.bufferedReader(Charsets.UTF_8)?.use { reader ->
            while (true) {
                val line = reader.readLine() ?: break
                if (!line.startsWith("data: ")) continue
                val raw = line.removePrefix("data: ").trim()
                if (raw.isBlank() || raw == "[DONE]") continue
                val event = runCatching { JSONObject(raw) }.getOrNull() ?: continue
                when (event.optString("type")) {
                    "status" -> {
                        latestStatus = event.optString("text").takeIf { it.isNotBlank() } ?: latestStatus
                        withContext(Dispatchers.Main) { onUpdate(full, latestStatus) }
                    }
                    "error" -> throw IllegalStateException(event.optString("message").ifBlank { "AI response mein problem aa gayi." })
                    "progress_message" -> {
                        latestStatus = event.optString("text").takeIf { it.isNotBlank() } ?: latestStatus
                        withContext(Dispatchers.Main) { onUpdate(full, latestStatus) }
                    }
                    "image_start" -> {
                        latestStatus = "Creating image…"
                        withContext(Dispatchers.Main) { onUpdate(full, latestStatus) }
                    }
                    else -> {
                        val delta = event.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("delta")?.optString("content").orEmpty()
                        if (delta.isNotEmpty()) {
                            full += delta
                            withContext(Dispatchers.Main) { onUpdate(full, "Workly AI is replying…") }
                        }
                    }
                }
            }
        }
        if (full.isBlank()) throw IllegalStateException("AI ne empty response diya. Dobara try karein.")
        full
    } finally {
        connection.disconnect()
    }
}
