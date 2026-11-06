package com.worklyindia.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class NativeApplication(val id:String, val jobTitle:String, val company:String, val status:String, val appliedAt:String)
data class NativeNotification(val id:String, val title:String, val message:String, val createdAt:String, val read:Boolean)
data class NativeConversation(val id:String, val jobTitle:String, val lastMessage:String, val updatedAt:String)
data class NativeChatMessage(val id:String, val senderId:String, val message:String, val createdAt:String)

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
        val a=JSONArray(call("/job_applications?select=id,status,applied_at,job:jobs(title,api_company_name,companies(company_name))&applicant_id=eq.${enc(s.userId)}&order=applied_at.desc&limit=100",s))
        return (0 until a.length()).map { i ->
            val o=a.getJSONObject(i); val j=o.optJSONObject("job"); val co=j?.optJSONObject("companies")
            NativeApplication(o.optString("id"),j?.optString("title")?.takeIf{it.isNotBlank()}?:"Job application",
                co?.optString("company_name")?.takeIf{it.isNotBlank()}?:j?.optString("api_company_name","")?:"",
                o.optString("status","submitted"),o.optString("applied_at"))
        }
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
