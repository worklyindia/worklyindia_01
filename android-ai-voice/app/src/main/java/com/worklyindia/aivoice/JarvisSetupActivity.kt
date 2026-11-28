package com.worklyindia.aivoice
import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast

/** JARVIS provider and speech model setup. */
class JarvisSetupActivity:Activity(){
 private val langs=listOf("Hindi · हिन्दी" to "hi","English · India" to "en","Gujarati · ગુજરાતી" to "gu")
 private lateinit var provider:Spinner;private lateinit var api:EditText;private lateinit var stt:Spinner;private lateinit var tts:Spinner;private lateinit var status:TextView;private lateinit var active:Button
 private val packs by lazy{SpeechPackDownloadManager(this)}
 private val ink get()=ChatWorkTheme.color(this,0xFF142033.toInt());private val muted get()=ChatWorkTheme.color(this,0xFF65748B.toInt());private val bg get()=ChatWorkTheme.color(this,0xFFF4F7FB.toInt());private val surface get()=ChatWorkTheme.color(this,0xFFFFFFFF.toInt())
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);ChatWorkTheme.applyWindow(this);render()}
 private fun render(msg:String?=null){
  val cfg=JarvisSettingsStore.read(this);val root=LinearLayout(this).apply{orientation=1;setBackgroundColor(bg)}
  val head=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL;setPadding(dp(14),dp(8),dp(14),dp(8))}
  head.addView(TextView(this).apply{text="‹";textSize=34f;setTextColor(ink);gravity=Gravity.CENTER;setOnClickListener{finish()}},LinearLayout.LayoutParams(dp(44),dp(48)))
  head.addView(TextView(this).apply{text="JARVIS Active · Setup";textSize=19f;setTextColor(ink);typeface=android.graphics.Typeface.DEFAULT_BOLD});root.addView(head)
  val scroll=ScrollView(this);val c=LinearLayout(this).apply{orientation=1;setPadding(dp(16),dp(12),dp(16),dp(28))};scroll.addView(c);root.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
  c.addView(section("1. AI Reply"));c.addView(hint("Local Qwen is disabled for JARVIS. Select Groq or Gemini and enter your own API key."))
  provider=spinner(listOf("Groq" to "groq","Google AI Studio · Gemini" to "gemini"),cfg.provider);c.addView(provider,match())
  api=EditText(this).apply{hint=if(cfg.apiKey.isBlank())"Paste API key" else "Saved API key · leave blank to keep or enter a new key";inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD;setSingleLine(true);setTextColor(ink)};c.addView(api,match())
  c.addView(hint(if(cfg.apiKey.isBlank())"No API key saved for this account yet." else "API key saved securely for ${cfg.provider.uppercase()}. Leave this field blank to keep it."))
  c.addView(section("2. Text To Voice"));tts=spinner(langs,cfg.ttsLanguage);c.addView(tts,match());c.addView(hint("Downloaded voice model: Sherpa-ONNX iTantra-compatible VITS · Hindi / English / Gujarati"))
  c.addView(section("3. Voice To Text"));stt=spinner(langs,cfg.sttLanguage);c.addView(stt,match());c.addView(hint("Downloaded speech model: AI4Bharat IndicConformer INT8 · Hindi / English / Gujarati"))
  c.addView(hint("Download and test speech models from Download Model on the ChatWork home page. Only completed and tested models can be activated."))
  c.addView(section("4. JARVIS status"));status=TextView(this).apply{textSize=14f;setTextColor(muted);setPadding(dp(12),dp(12),dp(12),dp(12));text=msg?:if(cfg.active||WakeWordAssistantService.isRunning)"JARVIS is active or starting. Check its persistent notification." else "Not active. Save your key and download the selected models.";setBackgroundColor(surface)};c.addView(status,match())
  c.addView(button("Save AI & model settings"){save(true)},match())
  active=button(if(cfg.active||WakeWordAssistantService.isRunning)"Deactivate JARVIS" else "Active JARVIS"){if(isActive())deactivateConfirm() else activate()};c.addView(active,match())
  c.addView(hint("Settings are saved for this signed-in Workly account on this device. The API key is encrypted with Android Keystore; leave its field blank to keep the saved key."))
  setContentView(root)
 }
 private fun save(show:Boolean):Boolean{val key=api.text?.toString()?.trim().orEmpty();if(key.isBlank()&&JarvisSettingsStore.read(this).apiKey.isBlank()){status.text="Add your ${providerValue().uppercase()} API key first.";return false}
  return runCatching{JarvisSettingsStore.save(this,providerValue(),key,lang(stt),lang(tts));if(show)Toast.makeText(this,"JARVIS settings saved securely.",Toast.LENGTH_SHORT).show();true}.getOrElse{status.text=it.message?:"Save failed";false}}
 private fun activate(){if(!save(false))return;val cfg=JarvisSettingsStore.read(this);val a=SpeechModelCatalog.indicConformer(cfg.sttLanguage);val b=SpeechModelCatalog.itantraVits(cfg.ttsLanguage);val w=SpeechModelCatalog.chatWorkWakeWord();val missing=mutableListOf<String>()
  if(cfg.apiKey.isBlank())missing.add("API key");if(!OfflineSpeechEngineFactory.isReady(this,a))missing.add("IndicConformer ${cfg.sttLanguage.uppercase()}");if(packs.snapshot(b).state!=SpeechPackDownloadManager.State.COMPLETE||!packs.isModelTested(b))missing.add("Tested iTantra VITS ${cfg.ttsLanguage.uppercase()}");if(!WakeWordEngineFactory.isReady(this)||!packs.isModelTested(w))missing.add("Tested Hey ChatWork wake-word model")
  if(missing.isNotEmpty()){status.text="Download and test first: ${missing.joinToString(", ")}. Open Download Model page.";return}
  if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),8101);return}
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS),8102);return};startJarvis()
 }
 private fun startJarvis(){JarvisSettingsStore.setActive(this,true);try{val i=Intent(this,WakeWordAssistantService::class.java);if(Build.VERSION.SDK_INT>=26)startForegroundService(i)else startService(i);status.text="Starting JARVIS… Keep ChatWork open until the notification confirms listening.";active.text="Deactivate JARVIS"}catch(e:Exception){JarvisSettingsStore.setActive(this,false);status.text="Could not start JARVIS: ${e.message}";active.text="Active JARVIS"}}
 private fun deactivateConfirm(){AlertDialog.Builder(this).setTitle("Deactivate JARVIS?").setMessage("JARVIS stops listening and removes its microphone notification. Saved API key and model choices remain.").setNegativeButton("Cancel",null).setPositiveButton("Deactivate"){_,_->JarvisSettingsStore.setActive(this,false);stopService(Intent(this,WakeWordAssistantService::class.java).setAction(WakeWordAssistantService.ACTION_STOP));status.text="JARVIS deactivated. Settings are saved.";active.text="Active JARVIS"}.show()}
 private fun isActive()=JarvisSettingsStore.read(this).active||WakeWordAssistantService.isRunning
 override fun onRequestPermissionsResult(code:Int,p:Array<out String>,r:IntArray){super.onRequestPermissionsResult(code,p,r);if(code==8101||code==8102){if(r.isNotEmpty()&&r.all{it==PackageManager.PERMISSION_GRANTED})activate()else status.text="Microphone and notification permissions are required."}}
 private fun providerValue()=if(provider.selectedItemPosition==1)"gemini" else "groq";private fun lang(s:Spinner)=langs[s.selectedItemPosition.coerceIn(langs.indices)].second
 private fun spinner(items:List<Pair<String,String>>,selected:String)=Spinner(this).apply{adapter=ArrayAdapter(this@JarvisSetupActivity,android.R.layout.simple_spinner_dropdown_item,items.map{it.first});setSelection(items.indexOfFirst{it.second==selected}.coerceAtLeast(0))}
 private fun section(v:String)=TextView(this).apply{text=v;textSize=17f;setTextColor(ink);typeface=android.graphics.Typeface.DEFAULT_BOLD;setPadding(0,dp(18),0,dp(8))}
 private fun hint(v:String)=TextView(this).apply{text=v;textSize=12f;setTextColor(muted);setPadding(0,dp(4),0,dp(8))}
 private fun button(v:String,click:()->Unit)=Button(this).apply{text=v;isAllCaps=false;setOnClickListener{click()}}
 private fun match()=LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(8)};private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
}
