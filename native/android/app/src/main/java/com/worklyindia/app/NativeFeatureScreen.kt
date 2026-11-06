package com.worklyindia.app

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
                item { Button(enabled=!busy&&resumeName.isNotBlank(),onClick={scope.launch { busy=true; runCatching { NativeDataApi.saveResumeDraft(session,resumeName,resumeHeadline,resumeSkills,resumeExperience,resumeEducation); error="Resume draft saved." }.onFailure{error=it.message}; busy=false }},Modifier.fillMaxWidth()) { Text(if(busy)"Saving…" else "Save resume draft") } }
                item { Text("Resume PDF templates and export are not connected yet.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            "Cover letter builder" -> LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                item { Text("Cover letter builder",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
                item { OutlinedTextField(coverRole,{coverRole=it},Modifier.fillMaxWidth(),label={Text("Job title")},singleLine=true) }
                item { OutlinedTextField(coverCompany,{coverCompany=it},Modifier.fillMaxWidth(),label={Text("Company")},singleLine=true) }
                item { OutlinedTextField(coverText,{coverText=it},Modifier.fillMaxWidth(),label={Text("Your cover letter")},minLines=8) }
                item { Button(enabled=!busy&&coverText.isNotBlank(),onClick={scope.launch { busy=true; runCatching { NativeDataApi.saveCoverLetterDraft(session,coverRole,coverCompany,coverText); error="Cover letter draft saved." }.onFailure{error=it.message}; busy=false }},Modifier.fillMaxWidth()) { Text("Save cover letter") } }
            }
            "Help & support" -> LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                item { Text("Create a support ticket",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
                item { OutlinedTextField(supportTitle,{supportTitle=it},Modifier.fillMaxWidth(),label={Text("Subject")},singleLine=true) }
                item { OutlinedTextField(supportCategory,{supportCategory=it},Modifier.fillMaxWidth(),label={Text("Category (Account / Jobs / Payment)")},singleLine=true) }
                item { OutlinedTextField(supportDescription,{supportDescription=it},Modifier.fillMaxWidth(),label={Text("Describe your issue")},minLines=5) }
                item { Button(enabled=!busy&&supportTitle.isNotBlank()&&supportDescription.isNotBlank(),onClick={scope.launch { busy=true; runCatching { NativeDataApi.createSupportTicket(session,supportTitle,supportDescription,supportCategory); supportTitle=""; supportDescription=""; error="Support ticket submitted." }.onFailure{error=it.message}; busy=false }},Modifier.fillMaxWidth()) { Text("Submit support ticket") } }
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
                item { Button(enabled=!busy&&jobTitle.isNotBlank()&&jobLocation.isNotBlank()&&jobDescription.isNotBlank(),onClick={scope.launch { busy=true; runCatching { NativeDataApi.createJobDraft(session,jobTitle,jobLocation,jobDescription,jobType); jobTitle=""; jobLocation=""; jobDescription=""; employerJobs=NativeDataApi.employerJobs(session); error="Private draft saved. Publish workflow is not yet connected." }.onFailure{error=it.message}; busy=false }},Modifier.fillMaxWidth()) { Text("Save job draft") } }
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
