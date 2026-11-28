package com.worklyindia.aivoice
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Account-scoped settings; API keys are encrypted with Android Keystore. */
object JarvisSettingsStore {
 data class Config(val provider:String,val apiKey:String,val sttLanguage:String,val ttsLanguage:String,val active:Boolean)
 private const val PREFS="chatwork_jarvis_account_settings"; private const val ALIAS="chatwork_jarvis_api_key_v1"
 private fun scope(c:Context):String {
  val token=SecureDeviceTokenStore.readAccessToken(c)?:return "signed_in"
  return runCatching { val p=token.split(".").getOrNull(1)?:return@runCatching "signed_in"
   JSONObject(String(Base64.decode(p,Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING),Charsets.UTF_8)).optString("sub").ifBlank{"signed_in"}
  }.getOrDefault("signed_in").replace(Regex("[^A-Za-z0-9_-]"),"_")
 }
 private fun k(c:Context,n:String)=scope(c)+"_"+n
 fun read(c:Context):Config {
  val p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);val encrypted=p.getString(k(c,"key"),null)
  return Config(p.getString(k(c,"provider"),"groq")?:"groq",encrypted?.let{runCatching{decrypt(it)}.getOrNull()}.orEmpty(),
   p.getString(k(c,"stt"),"hi")?:"hi",p.getString(k(c,"tts"),"hi")?:"hi",p.getBoolean(k(c,"active"),false))
 }
 fun save(c:Context,provider:String,key:String,stt:String,tts:String) {
  require(provider in setOf("groq","gemini")&&stt in setOf("hi","en","gu")&&tts in setOf("hi","en","gu"))
  val e=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString(k(c,"provider"),provider).putString(k(c,"stt"),stt).putString(k(c,"tts"),tts)
  if(key.isNotBlank())e.putString(k(c,"key"),encrypt(key.trim()));e.apply()
 }
 fun setActive(c:Context,v:Boolean)=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean(k(c,"active"),v).apply()
 fun generateReply(c:Context,prompt:String,cfg:Config):String {
  check(cfg.apiKey.isNotBlank()){"Save your ${cfg.provider.uppercase()} API key in JARVIS Setup."}
  val gem=cfg.provider=="gemini";val url=if(gem)"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cfg.apiKey}" else "https://api.groq.com/openai/v1/chat/completions"
  val h=(URL(url).openConnection() as HttpURLConnection).apply{requestMethod="POST";connectTimeout=20000;readTimeout=60000;doOutput=true;setRequestProperty("Content-Type","application/json");if(!gem)setRequestProperty("Authorization","Bearer ${cfg.apiKey}")}
  try {
   val body=if(gem)JSONObject().put("contents",org.json.JSONArray().put(JSONObject().put("role","user").put("parts",org.json.JSONArray().put(JSONObject().put("text",prompt.take(12000)))))).put("generationConfig",JSONObject().put("temperature",0.5).put("maxOutputTokens",700))
   else JSONObject().put("model","llama-3.3-70b-versatile").put("messages",org.json.JSONArray().put(JSONObject().put("role","system").put("content","You are JARVIS, ChatWork's concise multilingual assistant. Reply in the user's language.")).put(JSONObject().put("role","user").put("content",prompt.take(12000)))).put("temperature",0.5).put("max_tokens",700)
   h.outputStream.use{it.write(body.toString().toByteArray())};val code=h.responseCode
   val raw=(if(code in 200..299)h.inputStream else h.errorStream)?.bufferedReader()?.use{it.readText()}.orEmpty();val o=runCatching{JSONObject(raw)}.getOrElse{JSONObject()}
   check(code in 200..299){o.optJSONObject("error")?.optString("message")?.ifBlank{"AI provider HTTP $code"}?:o.optString("message").ifBlank{"AI provider HTTP $code"}}
   val answer=if(gem)o.optJSONArray("candidates")?.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts")?.optJSONObject(0)?.optString("text").orEmpty() else o.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content").orEmpty()
   return answer.trim().also{check(it.isNotBlank()){"Selected AI provider returned an empty reply."}}
  }finally{h.disconnect()}
 }
 private fun encrypt(v:String):String{val c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());return Base64.encodeToString(c.iv+c.doFinal(v.toByteArray()),Base64.NO_WRAP)}
 private fun decrypt(v:String):String{val b=Base64.decode(v,Base64.NO_WRAP);require(b.size>12);val c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,b.copyOfRange(0,12)));return c.doFinal(b.copyOfRange(12,b.size)).toString(Charsets.UTF_8)}
 private fun key():SecretKey{val s=java.security.KeyStore.getInstance("AndroidKeyStore").apply{load(null)};(s.getKey(ALIAS,null) as? SecretKey)?.let{return it};val g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true).build());return g.generateKey()}
}
