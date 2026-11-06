package com.worklyindia.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class NativeApplication(val id:String, val jobTitle:String, val company:String, val status:String, val appliedAt:String, val reviewedAt:String?)
data class NativeEmployerApplicant(val id:String,val jobId:String,val applicantId:String,val jobTitle:String,val fullName:String,val email:String,val phone:String,val location:String,val skills:List<String>,val experience:String,val resumeUrl:String,val coverLetter:String,val status:String,val appliedAt:String)
data class NativeNotification(val id:String, val title:String, val message:String, val createdAt:String, val read:Boolean)
data class NativeConversation(val id:String, val jobTitle:String, val lastMessage:String, val updatedAt:String)
data class NativeChatMessage(val id:String, val senderId:String, val message:String, val createdAt:String)
data class NativeInterview(val id:String,val jobTitle:String,val applicantId:String,val scheduledAt:String,val scheduledEndAt:String,val mode:String,val videoPlatform:String,val locationUrl:String,val jitsiMeetingUrl:String,val videosdkRoomId:String,val videosdkMeetingUrl:String,val videosdkHostToken:String,val videosdkParticipantTokens:JSONObject?,val hmsRoomId:String,val hmsRoomUrl:String,val hmsHostToken:String,val hmsParticipantTokens:JSONObject?,val status:String,val notes:String,val hostUserId:String)

object NativeDataApi {
    private const val BASE="https://jubwzelupbntbetpajqb.supabase.co/rest/v1"
    private const val KEY="sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"
    private fun enc(s:String)=URLEncoder.encode(s,"UTF-8").replace("+","%20")

    private suspend fun call(path:String, session:NativeSession, method:String="GET", body:JSONObject?=null, prefer:String?=null):String = withContext(Dispatchers.IO) {
        val c=URL(BASE+path).openConnection() as HttpURLConnection
        c.requestMethod=method
        c.connectTimeout=15000
        c.readTimeout=20000
        c.setRequestProperty("apikey",KEY)
        c.setRequestProperty("Authorization","Bearer ${session.accessToken}")
        c.setRequestProperty("Accept","application/json")
        if(body!=null) {
            c.setRequestProperty("Content-Type","application/json")
            c.doOutput=true
            c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        }
        if(prefer!=null) c.setRequestProperty("Prefer",prefer)
        try {
            val status=c.responseCode
            val text=(if(status in 200..299)c.inputStream else c.errorStream)?.bufferedReader()?.use{it.readText()}.orEmpty()
            if(status !in 200..299) {
                val detail=runCatching { JSONObject(text).optString("message").ifBlank{JSONObject(text).optString("hint")} }.getOrNull()
                throw IllegalStateException(detail?.takeIf{it.isNotBlank()} ?: "Server request failed ($status)")
            }
            text
        } finally { c.disconnect() }
    }

    suspend fun savedJobIds(s:NativeSession):Set<String> {
        val a=JSONArray(call("/saved_jobs?select=job_id&user_id=eq.${enc(s.userId)}&limit=1000",s))
        return (0 until a.length()).mapNotNull { a.optJSONObject(it)?.optString("job_id")?.takeIf{v->v.isNotBlank()} }.toSet()
    }
    suspend fun saveJob(s:NativeSession,jobId:String) {
        call("/saved_jobs?on_conflict=user_id,job_id",s,"POST",JSONObject().put("user_id",s.userId).put("job_id",jobId),
            "resolution=ignore-duplicates,return=minimal")
    }
    suspend fun unsaveJob(s:NativeSession,jobId:String) {
        call("/saved_jobs?user_id=eq.${enc(s.userId)}&job_id=eq.${enc(jobId)}",s,"DELETE",null,"return=minimal")
    }

    suspend fun applications(s:NativeSession):List<NativeApplication> {
        val a=JSONArray(call("/job_applications?select=id,status,applied_at,reviewed_at,job:jobs(title,api_company_name,companies(company_name))&applicant_id=eq.${enc(s.userId)}&order=applied_at.desc&limit=100",s))
        return (0 until a.length()).map { i ->
            val o=a.getJSONObject(i); val j=o.optJSONObject("job"); val co=j?.optJSONObject("companies")
            NativeApplication(o.optString("id"),j?.optString("title")?.takeIf{it.isNotBlank()}?:"Job application",
                co?.optString("company_name")?.takeIf{it.isNotBlank()}?:j?.optString("api_company_name","")?:"",
                o.optString("status","submitted"),o.optString("applied_at"),o.optString("reviewed_at").takeIf{it.isNotBlank() && it!="null"})
        }
    }


    suspend fun employerApplications(s:NativeSession):List<NativeEmployerApplicant> {
        val a=JSONArray(call("/job_applications?select=id,job_id,applicant_id,api_full_name,api_email,api_phone,api_location,api_skills,api_experience_years,resume_url,cover_letter,status,applied_at,job:jobs(title)&employer_id=eq.${enc(s.userId)}&order=applied_at.desc&limit=200",s))
        return (0 until a.length()).map { i ->
            val o=a.getJSONObject(i); val skills=o.optJSONArray("api_skills")
            NativeEmployerApplicant(o.optString("id"),o.optString("job_id"),o.optString("applicant_id"),o.optJSONObject("job")?.optString("title")?.takeIf{it.isNotBlank()}?:"Job application",
                o.optString("api_full_name").ifBlank{"Candidate"},o.optString("api_email"),o.optString("api_phone"),o.optString("api_location"),
                if(skills==null) emptyList() else (0 until skills.length()).map{skills.optString(it)}.filter{it.isNotBlank()},
                o.optString("api_experience_years").takeIf{it.isNotBlank() && it!="null"}?.let{"$it years"}.orEmpty(),
                o.optString("resume_url"),o.optString("cover_letter"),o.optString("status","applied"),o.optString("applied_at"))
        }
    }
    suspend fun getOrCreateConversation(s:NativeSession, jobId:String, applicantId:String, jobTitle:String):NativeConversation {
        val path="/conversations?select=id,last_message_at&employer_id=eq."+enc(s.userId)+"&applicant_id=eq."+enc(applicantId)+"&job_id=eq."+enc(jobId)+"&limit=1"
        val existing=JSONArray(call(path,s))
        if(existing.length()>0) { val o=existing.getJSONObject(0); return NativeConversation(o.optString("id"),jobTitle,"",o.optString("last_message_at")) }
        val body=JSONObject().put("job_id",jobId).put("employer_id",s.userId).put("applicant_id",applicantId).put("status","active")
        val created=JSONArray(call("/conversations",s,"POST",body,"return=representation"))
        if(created.length()==0) throw IllegalStateException("Conversation create nahi ho saka.")
        val o=created.getJSONObject(0)
        return NativeConversation(o.optString("id"),jobTitle,"",o.optString("last_message_at"))
    }

    suspend fun interviews(s:NativeSession):List<NativeInterview> {
        val uid=enc(s.userId)
        val path="/interviews?select=id,applicant_id,scheduled_at,scheduled_end_at,mode,video_platform,location_url,jitsi_meeting_url,videosdk_room_id,videosdk_meeting_url,videosdk_host_token,videosdk_participant_tokens,hms_room_id,hms_room_url,hms_host_token,hms_participant_tokens,status,notes,host_user_id,job:jobs(title)&or=(applicant_id.eq."+uid+",host_user_id.eq."+uid+")&order=scheduled_at.asc&limit=100"
        val a=JSONArray(call(path,s))
        return (0 until a.length()).map { i ->
            val o=a.getJSONObject(i)
            NativeInterview(o.optString("id"),o.optJSONObject("job")?.optString("title")?.takeIf{it.isNotBlank()}?:"Interview",
                o.optString("applicant_id"),o.optString("scheduled_at"),o.optString("scheduled_end_at"),
                o.optString("mode"),o.optString("video_platform"),o.optString("location_url"),o.optString("jitsi_meeting_url"),o.optString("videosdk_room_id"),o.optString("videosdk_meeting_url"),o.optString("videosdk_host_token"),o.optJSONObject("videosdk_participant_tokens"),o.optString("hms_room_id"),o.optString("hms_room_url"),o.optString("hms_host_token"),o.optJSONObject("hms_participant_tokens"),o.optString("status"),o.optString("notes"),o.optString("host_user_id"))
        }
    }

    suspend fun updateInterviewStatus(s:NativeSession, interviewId:String, status:String) {
        require(status in setOf("cancelled","completed")) { "Interview status invalid hai." }
        val body=JSONObject().put("status",status).put("updated_at",java.time.Instant.now().toString())
        call("/interviews?id=eq.${enc(interviewId)}&host_user_id=eq.${enc(s.userId)}",s,"PATCH",body,"return=minimal")
    }
    suspend fun scheduleInterview(s:NativeSession, jobId:String, applicantId:String, localDateTime:String, mode:String, locationOrLink:String, notes:String) {
        require(mode in setOf("online","jitsi","phone","in_person")) { "Interview mode invalid hai." }
        val local=java.time.LocalDateTime.parse(localDateTime.trim())
        require(local.isAfter(java.time.LocalDateTime.now())) { "Interview ka time future mein hona chahiye." }
        val start=local.atZone(java.time.ZoneId.systemDefault()).toOffsetDateTime()
        val end=start.plusMinutes(30)
        val storedMode=if(mode=="jitsi") "online" else mode
        val body=JSONObject().put("job_id",jobId).put("applicant_id",applicantId).put("scheduled_at",start.toString()).put("scheduled_end_at",end.toString()).put("mode",storedMode).put("status","scheduled").put("host_user_id",s.userId)
        if(mode=="jitsi") {
            val roomName="WorklyIndia-"+java.util.UUID.randomUUID().toString().replace("-","")
            val meetingUrl="https://meet.jit.si/"+roomName
            body.put("video_platform","jitsi").put("jitsi_room_name",roomName).put("jitsi_meeting_url",meetingUrl).put("location_url",meetingUrl)
        } else if(mode=="online") {
            body.put("video_platform","custom")
        }
        if(locationOrLink.isNotBlank() && mode!="jitsi") body.put("location_url",locationOrLink.trim())
        if(notes.isNotBlank()) body.put("notes",notes.trim())
        call("/interviews",s,"POST",body,"return=minimal")
    }
    suspend fun updateApplicantStatus(s:NativeSession, applicationId:String, status:String) {
        require(status=="shortlisted" || status=="rejected") { "Invalid application status." }
        call("/job_applications?id=eq.${enc(applicationId)}&employer_id=eq.${enc(s.userId)}",s,"PATCH",
            JSONObject().put("status",status).put("reviewed_at",java.time.Instant.now().toString()),"return=minimal")
    }

    suspend fun hasApplied(s:NativeSession, jobId:String):Boolean {
        val a=JSONArray(call("/job_applications?select=id&applicant_id=eq.${enc(s.userId)}&job_id=eq.${enc(jobId)}&limit=1",s))
        return a.length()>0
    }

    suspend fun notifications(s:NativeSession):List<NativeNotification> {
        val a=JSONArray(call("/notifications?select=id,title,message,created_at,is_read&user_id=eq.${enc(s.userId)}&order=created_at.desc&limit=100",s))
        return (0 until a.length()).map { i -> val o=a.getJSONObject(i)
            NativeNotification(o.optString("id"),o.optString("title"),o.optString("message"),o.optString("created_at"),o.optBoolean("is_read")) }
    }

    suspend fun markNotificationRead(s:NativeSession,id:String) {
        call("/notifications?id=eq.${enc(id)}&user_id=eq.${enc(s.userId)}",s,"PATCH",JSONObject().put("is_read",true),"return=minimal")
    }

    suspend fun conversations(s:NativeSession):List<NativeConversation> {
        val a=JSONArray(call("/conversations?select=id,last_message_at,job:jobs(title)&or=(applicant_id.eq.${enc(s.userId)},employer_id.eq.${enc(s.userId)})&order=last_message_at.desc.nullslast&limit=100",s))
        return (0 until a.length()).map { i -> val o=a.getJSONObject(i)
            NativeConversation(o.optString("id"),o.optJSONObject("job")?.optString("title")?.takeIf{it.isNotBlank()}?:"Workly chat","",o.optString("last_message_at")) }
    }

    suspend fun messages(s:NativeSession,conversationId:String):List<NativeChatMessage> {
        val a=JSONArray(call("/chat_messages?select=id,sender_id,message,created_at&conversation_id=eq.${enc(conversationId)}&order=created_at.asc&limit=300",s))
        return (0 until a.length()).map { i -> val o=a.getJSONObject(i)
            NativeChatMessage(o.optString("id"),o.optString("sender_id"),o.optString("message"),o.optString("created_at")) }
    }

    suspend fun sendMessage(s:NativeSession,conversationId:String,message:String) {
        require(message.isNotBlank()) { "Message khali nahi ho sakta." }
        call("/chat_messages",s,"POST",JSONObject().put("conversation_id",conversationId).put("sender_id",s.userId)
            .put("sender_type","user").put("message",message.trim()).put("message_type","text"),"return=minimal")
    }

    suspend fun loadResumeDraft(s:NativeSession):JSONObject? {
        val a=JSONArray(call("/resume_drafts?select=data&user_id=eq.${enc(s.userId)}&limit=1",s))
        return if(a.length()==0)null else a.getJSONObject(0).optJSONObject("data")
    }

    suspend fun saveResumeDraft(s:NativeSession,fullName:String,headline:String,skills:String,experience:String,education:String) {
        val data=JSONObject().put("full_name",fullName).put("headline",headline).put("skills",skills)
            .put("experience",experience).put("education",education).put("updated_at",java.time.Instant.now().toString())
        call("/resume_drafts?on_conflict=user_id",s,"POST",JSONObject().put("user_id",s.userId).put("data",data),
            "resolution=merge-duplicates,return=minimal")
    }

    suspend fun saveCoverLetterDraft(s:NativeSession,role:String,company:String,letter:String) {
        val data=JSONObject().put("role",role).put("company",company).put("letter",letter)
            .put("updated_at",java.time.Instant.now().toString())
        call("/cover_letter_drafts?on_conflict=user_id",s,"POST",JSONObject().put("user_id",s.userId).put("data",data),
            "resolution=merge-duplicates,return=minimal")
    }

    suspend fun createSupportTicket(s:NativeSession,title:String,description:String,category:String) {
        call("/support_tickets",s,"POST",JSONObject().put("user_id",s.userId).put("user_name",s.email.substringBefore("@"))
            .put("user_email",s.email).put("title",title.trim()).put("description",description.trim())
            .put("category",category).put("priority","normal").put("status","open"),"return=minimal")
    }

    suspend fun loadProfile(s:NativeSession):JSONObject? {
        val a=JSONArray(call("/profiles?select=full_name,phone,location,experience_years,current_position,skills,education,bio,preferred_location,job_type,industry&user_id=eq.${enc(s.userId)}&limit=1",s))
        return if(a.length()==0)null else a.getJSONObject(0)
    }

    suspend fun saveProfile(s:NativeSession, fullName:String, phone:String, location:String,
                            currentPosition:String, experienceYears:Int?, skills:String,
                            education:String, bio:String, preferredLocation:String, jobType:String, industry:String) {
        val skillArray=JSONArray().apply { skills.split(",").map{it.trim()}.filter{it.isNotBlank()}.forEach{put(it)} }
        val body=JSONObject().put("user_id",s.userId).put("email",s.email).put("full_name",fullName.trim())
            .put("phone",phone.trim()).put("location",location.trim()).put("current_position",currentPosition.trim())
            .put("experience_years",experienceYears).put("skills",skillArray).put("education",education.trim())
            .put("bio",bio.trim()).put("preferred_location",preferredLocation.trim()).put("job_type",jobType.trim())
            .put("industry",industry.trim()).put("updated_at",java.time.Instant.now().toString())
        call("/profiles?on_conflict=user_id",s,"POST",body,"resolution=merge-duplicates,return=minimal")
    }

    suspend fun loadCompany(s:NativeSession):JSONObject? {
        val a=JSONArray(call("/companies?select=id,company_name,industry,company_size,location,website,description,phone,email,country,state,city,postal_code,whatsapp_number&user_id=eq.${enc(s.userId)}&limit=1",s))
        return if(a.length()==0)null else a.getJSONObject(0)
    }

    suspend fun saveCompany(s:NativeSession, fields:JSONObject) {
        val existing=loadCompany(s)
        val body=JSONObject(fields.toString()).put("user_id",s.userId)
        if(existing==null) {
            call("/companies",s,"POST",body,"return=minimal")
        } else {
            call("/companies?id=eq.${enc(existing.optString("id"))}&user_id=eq.${enc(s.userId)}",s,"PATCH",body,"return=minimal")
        }
    }

    suspend fun companyId(s:NativeSession):String? {
        val a=JSONArray(call("/companies?select=id&user_id=eq.${enc(s.userId)}&limit=1",s))
        return if(a.length()==0)null else a.getJSONObject(0).optString("id").takeIf{it.isNotBlank()}
    }

    suspend fun employerJobs(s:NativeSession):List<Pair<String,String>> {
        val company=companyId(s) ?: return emptyList()
        val a=JSONArray(call("/jobs?select=id,title,status,created_at&company_id=eq.${enc(company)}&order=created_at.desc&limit=100",s))
        return (0 until a.length()).map { i -> val o=a.getJSONObject(i); o.optString("title") to o.optString("status") }
    }

    suspend fun createJobDraft(s:NativeSession,title:String,location:String,description:String,jobType:String) {
        val company=companyId(s) ?: throw IllegalStateException("Job post karne se pehle Employer/Company profile setup karein.")
        val body=JSONObject().put("company_id",company).put("title",title.trim()).put("location",location.trim())
            .put("description",description.trim()).put("job_type",jobType).put("status","draft").put("visibility","private")
        call("/jobs",s,"POST",body,"return=minimal")
    }
}
