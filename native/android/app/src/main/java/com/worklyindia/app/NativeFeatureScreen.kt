package com.worklyindia.app

import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.util.Base64
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
fun NativeFeatureScreen(
    m: Modifier,
    title: String,
    session: NativeSession?,
    onBack: () -> Unit,
    paymentResult: NativeRazorpayResult? = null,
    onStartCheckout: (NativeCheckoutOrder) -> Unit = {},
    onConsumePaymentResult: () -> Unit = {}
) {
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
    var companyLoading by remember { mutableStateOf(false) }
    var companySaving by remember { mutableStateOf(false) }
    var companyName by remember { mutableStateOf("") }
    var companyIndustry by remember { mutableStateOf("") }
    var companySize by remember { mutableStateOf("") }
    var companyLocation by remember { mutableStateOf("") }
    var companyWebsite by remember { mutableStateOf("") }
    var companyDescription by remember { mutableStateOf("") }
    var companyPhone by remember { mutableStateOf("") }
    var companyEmail by remember { mutableStateOf("") }
    var companyCountry by remember { mutableStateOf("India") }
    var companyState by remember { mutableStateOf("") }
    var companyCity by remember { mutableStateOf("") }
    var companyPostalCode by remember { mutableStateOf("") }
    var companyWhatsapp by remember { mutableStateOf("") }
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
                "Employer dashboard" -> {
                    employerJobs=NativeDataApi.employerJobs(session)
                    companyLoading=true
                    NativeDataApi.loadCompany(session)?.let { p ->
                        companyName=p.optString("company_name"); companyIndustry=p.optString("industry")
                        companySize=p.optString("company_size"); companyLocation=p.optString("location")
                        companyWebsite=p.optString("website"); companyDescription=p.optString("description")
                        companyPhone=p.optString("phone"); companyEmail=p.optString("email")
                        companyCountry=p.optString("country").ifBlank{"India"}; companyState=p.optString("state")
                        companyCity=p.optString("city"); companyPostalCode=p.optString("postal_code")
                        companyWhatsapp=p.optString("whatsapp_number")
                    }
                    companyLoading=false
                }
            }
        } catch(e:Exception) { error=e.message ?: "Data load nahi ho saka." }
        finally { busy=false }
    }

    Column(m.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically) {
            IconButton(onClick={ if(title=="Messages" && selectedConversation!=null) { selectedConversation=null; chatMessages=emptyList(); error=null } else onBack() }) { Icon(Icons.Default.ArrowBack,"Back") }
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
            "AI Chat Plans" -> NativeAIPlansScreen(session, paymentResult, onStartCheckout, onConsumePaymentResult)
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
                else LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                    item {
                        Text("${applications.size} applications",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                        Text("Employer ke response ke saath status yahan update hoga.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    items(applications,key={it.id}) { a -> ApplicationStatusCard(a) }
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
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface),shape=RoundedCornerShape(18.dp)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                            Row(verticalAlignment=Alignment.CenterVertically) {
                                Icon(Icons.Default.Business,null,tint=MaterialTheme.colorScheme.primary,modifier=Modifier.size(28.dp))
                                Column(Modifier.padding(start=10.dp).weight(1f)) {
                                    Text("Company profile",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                                    Text("Employer details candidates ko dikhane ke liye",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                if(companyLoading) CircularProgressIndicator(Modifier.size(20.dp),strokeWidth=2.dp)
                            }
                            OutlinedTextField(companyName,{companyName=it},Modifier.fillMaxWidth(),label={Text("Company name *")},singleLine=true)
                            OutlinedTextField(companyIndustry,{companyIndustry=it},Modifier.fillMaxWidth(),label={Text("Industry")},singleLine=true)
                            OutlinedTextField(companySize,{companySize=it},Modifier.fillMaxWidth(),label={Text("Company size")},singleLine=true)
                            OutlinedTextField(companyLocation,{companyLocation=it},Modifier.fillMaxWidth(),label={Text("Company address / location")},singleLine=true)
                            OutlinedTextField(companyWebsite,{companyWebsite=it},Modifier.fillMaxWidth(),label={Text("Website")},singleLine=true)
                            OutlinedTextField(companyDescription,{companyDescription=it},Modifier.fillMaxWidth(),label={Text("About company")},minLines=3)
                            OutlinedTextField(companyPhone,{companyPhone=it},Modifier.fillMaxWidth(),label={Text("Contact phone")},singleLine=true)
                            OutlinedTextField(companyEmail,{companyEmail=it},Modifier.fillMaxWidth(),label={Text("Contact email")},singleLine=true)
                            OutlinedTextField(companyWhatsapp,{companyWhatsapp=it},Modifier.fillMaxWidth(),label={Text("WhatsApp number")},singleLine=true)
                            OutlinedTextField(companyCountry,{companyCountry=it},Modifier.fillMaxWidth(),label={Text("Country")},singleLine=true)
                            OutlinedTextField(companyState,{companyState=it},Modifier.fillMaxWidth(),label={Text("State")},singleLine=true)
                            OutlinedTextField(companyCity,{companyCity=it},Modifier.fillMaxWidth(),label={Text("City")},singleLine=true)
                            OutlinedTextField(companyPostalCode,{companyPostalCode=it},Modifier.fillMaxWidth(),label={Text("PIN code")},singleLine=true)
                            Button(enabled=!companySaving&&!companyLoading&&companyName.isNotBlank(),onClick={
                                companySaving=true
                                scope.launch {
                                    val data=JSONObject().put("company_name",companyName.trim()).put("industry",companyIndustry.trim())
                                        .put("company_size",companySize.trim()).put("location",companyLocation.trim())
                                        .put("website",companyWebsite.trim()).put("description",companyDescription.trim())
                                        .put("phone",companyPhone.trim()).put("email",companyEmail.trim())
                                        .put("country",companyCountry.trim()).put("state",companyState.trim())
                                        .put("city",companyCity.trim()).put("postal_code",companyPostalCode.trim())
                                        .put("whatsapp_number",companyWhatsapp.trim())
                                    runCatching { NativeDataApi.saveCompany(session,data) }
                                        .onSuccess { error="Company profile saved successfully." }
                                        .onFailure { error=it.message ?: "Company profile save nahi ho saka." }
                                    companySaving=false
                                }
                            },modifier=Modifier.fillMaxWidth()) { Text(if(companySaving)"Saving company…" else "Save company profile") }
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        NativeEmployerStatCard("Total jobs",employerJobs.size.toString(),Modifier.weight(1f))
                        NativeEmployerStatCard("Active",employerJobs.count{it.second.equals("active",true)||it.second.equals("published",true)}.toString(),Modifier.weight(1f))
                        NativeEmployerStatCard("Drafts",employerJobs.count{it.second.equals("draft",true)}.toString(),Modifier.weight(1f))
                    }
                }
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

@Composable private fun NativeEmployerStatCard(label:String,value:String,modifier:Modifier=Modifier) {
    Card(modifier,colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface),shape=RoundedCornerShape(14.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp),verticalArrangement=Arrangement.spacedBy(4.dp)) {
            Text(value,style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.primary)
            Text(label,style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable @Composable
private fun ApplicationStatusCard(application: NativeApplication) {
    val raw = application.status.trim().lowercase().replace('-', '_').replace(' ', '_')
    val label = when(raw) {
        "applied", "submitted", "pending" -> "Submitted"
        "under_review", "reviewing", "viewed", "in_review" -> "Under review"
        "shortlisted", "short_listed" -> "Shortlisted"
        "interview", "interview_scheduled", "interviewing" -> "Interview"
        "selected", "accepted", "hired" -> "Selected"
        "rejected", "declined" -> "Not selected"
        "withdrawn", "cancelled", "canceled" -> "Withdrawn"
        else -> application.status.replace('_',' ').replaceFirstChar { it.uppercase() }.ifBlank { "Submitted" }
    }
    val icon = when(raw) {
        "rejected", "declined" -> Icons.Default.Cancel
        "shortlisted", "short_listed", "interview", "interview_scheduled", "interviewing", "selected", "accepted", "hired" -> Icons.Default.CheckCircle
        "under_review", "reviewing", "viewed", "in_review" -> Icons.Default.Visibility
        "withdrawn", "cancelled", "canceled" -> Icons.Default.Block
        else -> Icons.Default.Schedule
    }
    val appliedDate = runCatching {
        java.time.Instant.parse(application.appliedAt).atZone(java.time.ZoneId.of("Asia/Kolkata"))
            .format(java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy"))
    }.getOrNull()
    val reviewedDate = application.reviewedAt?.let { value ->
        runCatching { java.time.Instant.parse(value).atZone(java.time.ZoneId.of("Asia/Kolkata"))
            .format(java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy")) }.getOrNull()
    }
    Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),
        colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface),
        border=androidx.compose.foundation.BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant.copy(alpha=0.65f))) {
        Column(Modifier.fillMaxWidth().padding(15.dp),verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(3.dp)) {
                    Text(application.jobTitle,fontWeight=FontWeight.Bold,style=MaterialTheme.typography.titleMedium)
                    Text(application.company.ifBlank{"Workly India"},color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
                }
                Surface(color=MaterialTheme.colorScheme.secondaryContainer,shape=RoundedCornerShape(50)) {
                    Row(Modifier.padding(horizontal=10.dp,vertical=6.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                        Icon(icon,null,Modifier.size(15.dp),tint=MaterialTheme.colorScheme.primary)
                        Text(label,style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.SemiBold)
                    }
                }
            }
            Divider(color=MaterialTheme.colorScheme.outlineVariant)
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.CalendarToday,null,Modifier.size(16.dp),tint=MaterialTheme.colorScheme.onSurfaceVariant)
                Text(" Applied ${appliedDate ?: "date unavailable"}",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                if(reviewedDate!=null) {
                    Spacer(Modifier.width(12.dp))
                    Text("Reviewed ${reviewedDate}",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Text("Application ID: ${application.id.take(8)}",style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun NativeRowCard(title:String,subtitle:String,status:String,onClick:(()->Unit)?=null) {
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


private data class NativeAIMessage(val role: String, val content: String, val images: List<String> = emptyList())
private data class NativeAIFile(val name: String, val text: String)

@Composable
private fun NativeAIChatScreen(session: NativeSession) {
    val messages = remember(session.userId) { mutableStateListOf<NativeAIMessage>() }
    var draft by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("Ready when you are") }
    var failure by remember { mutableStateOf<String?>(null) }
    var thinkHarder by remember { mutableStateOf(false) }
    var showComposerMenu by remember { mutableStateOf(false) }
    var selectedImages by remember { mutableStateOf<List<String>>(emptyList()) }
    var selectedFiles by remember { mutableStateOf<List<NativeAIFile>>(emptyList()) }
    var isProcessingAttachment by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNotEmpty()) scope.launch {
            isProcessingAttachment = true
            try {
                val room = (5 - selectedImages.size).coerceAtLeast(0)
                val encoded = uris.take(room).mapNotNull { uri ->
                    withContext(Dispatchers.IO) {
                        context.contentResolver.openInputStream(uri)?.use { input ->
                            val bitmap = android.graphics.BitmapFactory.decodeStream(input) ?: return@withContext null
                            val scaled = if (bitmap.width > 1400 || bitmap.height > 1400) {
                                val ratio = minOf(1400f / bitmap.width, 1400f / bitmap.height)
                                Bitmap.createScaledBitmap(bitmap, (bitmap.width * ratio).toInt(), (bitmap.height * ratio).toInt(), true)
                            } else bitmap
                            val out = java.io.ByteArrayOutputStream()
                            scaled.compress(Bitmap.CompressFormat.JPEG, 78, out)
                            "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                        }
                    }
                }
                selectedImages = selectedImages + encoded
            } catch (e: Exception) { failure = e.message ?: "Photo load nahi ho paya." }
            finally { isProcessingAttachment = false }
        }
    }
    val cameraPicker = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) scope.launch {
            isProcessingAttachment = true
            try {
                val data = withContext(Dispatchers.IO) {
                    val out = java.io.ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 78, out)
                    "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                }
                if (selectedImages.size < 5) selectedImages = selectedImages + data
            } catch (e: Exception) { failure = e.message ?: "Camera image process nahi hua." }
            finally { isProcessingAttachment = false }
        }
    }
    val documentPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNotEmpty()) scope.launch {
            isProcessingAttachment = true
            try {
                val docs = uris.take((3 - selectedFiles.size).coerceAtLeast(0)).mapNotNull { uri ->
                    withContext(Dispatchers.IO) { readNativeAIFile(context, uri) }
                }
                selectedFiles = selectedFiles + docs
            } catch (e: Exception) { failure = e.message ?: "File read nahi ho payi." }
            finally { isProcessingAttachment = false }
        }
    }
    val speechLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!spoken.isNullOrBlank()) draft = listOf(draft.trim(), spoken).filter { it.isNotBlank() }.joinToString(" ")
    }
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()

    LaunchedEffect(messages.size, messages.lastOrNull()?.content) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    fun send(text: String) {
        val rawPrompt = text.trim()
        if (rawPrompt.isBlank() && selectedImages.isEmpty() && selectedFiles.isEmpty() || sending) return
        val prompt = if (thinkHarder) "$rawPrompt\n\nPlease think carefully, verify the reasoning, and provide a more detailed, well-structured answer." else rawPrompt
        draft = ""
        thinkHarder = false
        failure = null
        val attachmentContext = selectedFiles.joinToString("\n\n") { "--- Attached file: ${it.name} ---\n${it.text}" }
        val promptWithFiles = listOf(prompt, attachmentContext).filter { it.isNotBlank() }.joinToString("\n\n")
        val outgoingImages = selectedImages
        messages.add(NativeAIMessage("user", promptWithFiles, outgoingImages))
        messages.add(NativeAIMessage("assistant", ""))
        selectedImages = emptyList()
        selectedFiles = emptyList()
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
                if (selectedImages.isNotEmpty() || selectedFiles.isNotEmpty()) {
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        selectedImages.forEachIndexed { index, data ->
                            Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
                                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Image, null, tint = MaterialTheme.colorScheme.primary)
                                    Text("Photo ${index + 1}", Modifier.padding(horizontal = 5.dp), style = MaterialTheme.typography.labelSmall)
                                    IconButton(onClick = { selectedImages = selectedImages.filterIndexed { i, _ -> i != index } }, modifier = Modifier.size(22.dp)) { Icon(Icons.Default.Close, "Remove photo", modifier = Modifier.size(15.dp)) }
                                }
                            }
                        }
                        selectedFiles.forEachIndexed { index, file ->
                            Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
                                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.AttachFile, null, tint = MaterialTheme.colorScheme.primary)
                                    Text(file.name.take(18), Modifier.padding(horizontal = 5.dp), style = MaterialTheme.typography.labelSmall)
                                    IconButton(onClick = { selectedFiles = selectedFiles.filterIndexed { i, _ -> i != index } }, modifier = Modifier.size(22.dp)) { Icon(Icons.Default.Close, "Remove file", modifier = Modifier.size(15.dp)) }
                                }
                            }
                        }
                    }
                }
                if (isProcessingAttachment) LinearProgressIndicator(Modifier.fillMaxWidth())
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
                                text = { Text("Camera") }, leadingIcon = { Icon(Icons.Default.CameraAlt, null) },
                                onClick = { showComposerMenu = false; cameraPicker.launch(null) }
                            )
                            DropdownMenuItem(
                                text = { Text("Photos") }, leadingIcon = { Icon(Icons.Default.Image, null) },
                                onClick = { showComposerMenu = false; imagePicker.launch("image/*") }
                            )
                            DropdownMenuItem(
                                text = { Text("Files (PDF, TXT, CSV, JSON, MD)") }, leadingIcon = { Icon(Icons.Default.AttachFile, null) },
                                onClick = { showComposerMenu = false; documentPicker.launch("*/*") }
                            )
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
                        enabled = (draft.isNotBlank() || selectedImages.isNotEmpty() || selectedFiles.isNotEmpty()) && !sending && !isProcessingAttachment,
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


private fun readNativeAIFile(context: android.content.Context, uri: Uri): NativeAIFile? {
    val name = context.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    } ?: "attachment"
    val mime = context.contentResolver.getType(uri).orEmpty()
    val ext = name.substringAfterLast('.', "").lowercase()
    val supported = setOf("txt", "md", "csv", "json", "xml", "html", "css", "js", "ts", "py", "java", "log", "yaml", "yml", "pdf")
    if (ext !in supported && !mime.startsWith("text/") && mime != "application/pdf") {
        throw IllegalArgumentException("$name: is file type ka text extraction abhi supported nahi hai.")
    }
    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
    if (bytes.size > 5 * 1024 * 1024) throw IllegalArgumentException("$name: file 5 MB se chhoti honi chahiye.")
    val raw = String(bytes, Charsets.UTF_8)
    val extracted = if (ext == "pdf" || mime == "application/pdf") {
        val matches = Regex("\\(([^()]*)\\)").findAll(raw).map { it.groupValues[1] }.filter { it.length > 2 && it.any(Char::isLetter) }.toList()
        matches.joinToString(" ").ifBlank { "PDF attached. Text extraction limited on this device; ask the user for a text-based copy if needed." }
    } else raw
    return NativeAIFile(name, extracted.take(25000))
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
            history.forEach { item ->
                val content: Any = if (item.images.isNotEmpty()) {
                    JSONArray().apply {
                        put(JSONObject().put("type", "text").put("text", item.content.ifBlank { "Please analyze these images." }))
                        item.images.forEach { url -> put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", url))) }
                    }
                } else item.content
                put(JSONObject().put("role", item.role).put("content", content))
            }
        })
        .put("user_id", session.userId)
        .put("hasImages", history.any { it.images.isNotEmpty() })
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
