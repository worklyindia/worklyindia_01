package com.worklyindia.aivoice

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast

/** JARVIS provider and downloaded speech-model setup. */
class JarvisSetupActivity:Activity(){
 private data class Language(val code:String,val label:String)
 private val sttCatalog=listOf(Language("as","Assamese"),Language("bn","Bengali"),Language("brx","Bodo"),Language("doi","Dogri"),Language("gu","Gujarati"),Language("hi","Hindi"),Language("kn","Kannada"),Language("kok","Konkani"),Language("ks","Kashmiri"),Language("mai","Maithili"),Language("ml","Malayalam"),Language("mni","Manipuri"),Language("mr","Marathi"),Language("ne","Nepali"),Language("or","Odia"),Language("pa","Punjabi"),Language("sa","Sanskrit"),Language("sat","Santali"),Language("sd","Sindhi"),Language("ta","Tamil"),Language("te","Telugu"),Language("ur","Urdu"),Language("en","English"))
 private val ttsCatalog=listOf(Language("gu","Gujarati · ગુજરાતી"),Language("hi","Hindi · हिन्दी"),Language("en","English · India"))
 private lateinit var provider:Spinner;private lateinit var api:EditText;private lateinit var apiStatus:TextView;private lateinit var sttSummary:TextView;private lateinit var ttsSummary:TextView;private lateinit var status:TextView;private lateinit var active:Button;private lateinit var sttModel:Spinner;private lateinit var ttsModel:Spinner
 private var selectedStt=linkedSetOf<String>();private var selectedTts=linkedSetOf<String>();private var selectedTtsModel="itantra"
 private val packs by lazy{SpeechPackDownloadManager(this)}
 private val ink get()=ChatWorkTheme.color(this,0xFF142033.toInt());private val muted get()=ChatWorkTheme.color(this,0xFF65748B.toInt());private val bg get()=ChatWorkTheme.color(this,0xFFF4F7FB.toInt());private val surface get()=ChatWorkTheme.color(this,0xFFFFFFFF.toInt())
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);ChatWorkTheme.applyWindow(this);render()}
 override fun onResume(){super.onResume();JarvisCrashBreadcrumbs.reportIfUnclean(this);if(::status.isInitialized)refreshAvailability()}
 private fun render(){
  val cfg=JarvisSettingsStore.read(this);selectedStt=cfg.sttLanguages.toCollection(linkedSetOf());selectedTts=cfg.ttsLanguages.toCollection(linkedSetOf());selectedTtsModel=cfg.ttsModel
  val root=LinearLayout(this).apply{orientation=1;setBackgroundColor(bg)}
  val head=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL;setPadding(dp(14),dp(8),dp(14),dp(8))}
  head.addView(TextView(this).apply{text="‹";textSize=34f;setTextColor(ink);gravity=Gravity.CENTER;setOnClickListener{finish()}},LinearLayout.LayoutParams(dp(44),dp(48)))
  head.addView(TextView(this).apply{text="JARVIS Active · Setup";textSize=19f;setTextColor(ink);typeface=android.graphics.Typeface.DEFAULT_BOLD});root.addView(head)
  val scroll=ScrollView(this);val c=LinearLayout(this).apply{orientation=1;setPadding(dp(16),dp(12),dp(16),dp(28))};scroll.addView(c);root.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
  c.addView(section("1. AI Reply"));c.addView(hint("Local Qwen is disabled for JARVIS. Choose Groq or Google AI Studio · Gemini and save your own API key."))
  provider=spinner(listOf("Groq" to "groq","Google AI Studio · Gemini" to "gemini"),cfg.provider);c.addView(provider,match())
  api=EditText(this).apply{hint=if(cfg.apiKey.isBlank())"Enter API key" else "Enter a new API key only to replace";inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD;setSingleLine(true);setTextColor(ink);setHintTextColor(muted)};c.addView(api,match())
  apiStatus=TextView(this).apply{text=if(cfg.apiKey.isBlank())"No API key saved." else "API key saved securely · ${cfg.provider.uppercase()} · ••••••••••••";setTextColor(if(cfg.apiKey.isBlank())muted else ink);textSize=13f};c.addView(apiStatus,match())
  c.addView(hint("Saved keys stay encrypted in Android Keystore. Leave the field blank to keep the saved key; enter a new key to replace it."))
  c.addView(section("2. Text To Voice"))
  c.addView(hint("Choose a downloaded JARVIS-compatible model: iTantra VITS, Indic Tiny TTS or Kokoro-82M."))
  ttsModel=Spinner(this);c.addView(ttsModel,match())
  c.addView(hint("Downloaded languages for the selected model:"))
  ttsSummary=TextView(this).apply{setTextColor(ink);textSize=15f;setPadding(dp(10),dp(12),dp(10),dp(12));setBackgroundColor(surface)};c.addView(ttsSummary,match())
  c.addView(button("Select downloaded Text To Voice languages"){chooseLanguages(false)},match())
  c.addView(section("3. Voice To Text"))
  c.addView(hint("Select the downloaded speech recognition model."))
  sttModel=Spinner(this);c.addView(sttModel,match())
  c.addView(hint("Downloaded languages for the selected model:"))
  sttSummary=TextView(this).apply{setTextColor(ink);textSize=15f;setPadding(dp(10),dp(12),dp(10),dp(12));setBackgroundColor(surface)};c.addView(sttSummary,match())
  c.addView(button("Select downloaded Voice To Text languages"){chooseLanguages(true)},match())
  c.addView(section("4. Call ChatWork"))
  c.addView(hint("Start a hands-free voice conversation using your selected downloaded Voice To Text and Text To Voice models. ChatWork listens automatically after microphone permission is granted. This call does not start Hey ChatWork background wake listening."))
  c.addView(button("☎  Call ChatWork"){startActivity(Intent(this,JarvisCallActivity::class.java))},match())
  c.addView(section("5. JARVIS status"));status=TextView(this).apply{textSize=14f;setTextColor(muted);setPadding(dp(12),dp(12),dp(12),dp(12));setBackgroundColor(surface)};c.addView(status,match())
  c.addView(button("Save AI & model settings"){save(true)},match())
  active=button(if(cfg.active||WakeWordAssistantService.isRunning)"Deactivate JARVIS" else "Active JARVIS"){if(isActive())deactivateConfirm() else activate()};c.addView(active,match())
  c.addView(hint("Settings are stored on this device for the signed-in account. The API key is encrypted with Android Keystore. Selected languages are saved and restored when this page is reopened."))
  setContentView(root);refreshAvailability()
 }
 private fun availableStt()=sttCatalog.filter{runCatching{val p=SpeechModelCatalog.indicConformer(it.code);packs.snapshot(p).files.all{f->f.state==SpeechPackDownloadManager.State.COMPLETE}&&OfflineSpeechEngineFactory.isReady(this,p)}.getOrDefault(false)}
 private fun ttsPack(code:String)=when(selectedTtsModel){"indic"->SpeechModelCatalog.indicTinyTts(code);"kokoro"->SpeechModelCatalog.kokoro82m();else->SpeechModelCatalog.itantraVits(code)}
 private fun ttsLanguagesForModel()=if(selectedTtsModel=="kokoro")listOf(Language("hi","Hindi · हिन्दी"),Language("en","English")) else ttsCatalog
 private fun isTtsPackReady(model:String,code:String)=runCatching{val p=when(model){"indic"->SpeechModelCatalog.indicTinyTts(code);"kokoro"->SpeechModelCatalog.kokoro82m();else->SpeechModelCatalog.itantraVits(code)};val snapshot=packs.snapshot(p);snapshot.files.isNotEmpty()&&snapshot.files.all{it.state==SpeechPackDownloadManager.State.COMPLETE}&&snapshot.state==SpeechPackDownloadManager.State.COMPLETE}.getOrDefault(false)
  private fun availableTtsModels()=listOf("itantra","indic","kokoro").filter{model->(if(model=="kokoro")listOf("hi","en") else listOf("gu","hi","en")).any{code->isTtsPackReady(model,code)}}
  private fun availableTts()=ttsLanguagesForModel().filter{isTtsPackReady(selectedTtsModel,it.code)}
 private fun refreshAvailability(){
  if(!::status.isInitialized)return
  val a=availableStt();val modelChoices=availableTtsModels();if(selectedTtsModel !in modelChoices && modelChoices.isNotEmpty())selectedTtsModel=modelChoices.first();val b=availableTts()
  selectedStt.retainAll(a.map{it.code}.toSet());selectedTts.retainAll(b.map{it.code}.toSet())
  if(selectedStt.isEmpty()&&a.isNotEmpty())selectedStt.add(a.first().code)
  if(selectedTts.isEmpty()&&b.isNotEmpty())selectedTts.add(b.first().code)
  bindModelSpinner(sttModel,if(a.isEmpty()) emptyList() else listOf("AI4Bharat IndicConformer INT8 · Downloaded"))
  val labels=mapOf("itantra" to "iTantra VITS","indic" to "Indic Tiny TTS","kokoro" to "Kokoro-82M")
  val choices=modelChoices
  if(selectedTtsModel !in choices && choices.isNotEmpty())selectedTtsModel=choices.first()
  ttsModel.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,if(choices.isEmpty())listOf("No downloaded TTS model") else choices.map{labels[it]?:it})
  ttsModel.isEnabled=choices.isNotEmpty()
  ttsModel.setSelection(choices.indexOf(selectedTtsModel).coerceAtLeast(0))
  ttsModel.onItemSelectedListener=object:android.widget.AdapterView.OnItemSelectedListener{override fun onNothingSelected(p:android.widget.AdapterView<*>?){};override fun onItemSelected(p:android.widget.AdapterView<*>?,v:View?,position:Int,id:Long){if(choices.isEmpty())return;selectedTtsModel=choices[position];val ready=availableTts().map{it.code}.toSet();selectedTts.retainAll(ready);if(selectedTts.isEmpty()&&ready.isNotEmpty())selectedTts.add(ready.first());if(::ttsSummary.isInitialized)ttsSummary.text=selectionText(ttsCatalog,selectedTts,availableTts(),"No downloaded language pack for this model.")}}
  sttSummary.text=selectionText(sttCatalog,selectedStt,a,"No complete downloaded IndicConformer language packs found.")
  ttsSummary.text=selectionText(ttsCatalog,selectedTts,b,"No complete downloaded language pack found for the selected TTS model.")
  val cfg=JarvisSettingsStore.read(this)
  status.text=when{
   cfg.apiKey.isBlank()->"API key not saved. Enter your provider key and save settings."
   a.isEmpty()||b.isEmpty()->"Download at least one complete model pack for both speech directions, then return here. A partially downloaded pack is not selectable."
   !WakeWordEngineFactory.isReady(this)->"Hey ChatWork wake-word model is not downloaded or is incomplete. Download it from Download Models first."
   else->"Ready to save and activate. Selected STT: ${selectedStt.joinToString()} · TTS: ${selectedTts.joinToString()}."
  }
 }
 private fun bindModelSpinner(spinner:Spinner,labels:List<String>){
  val shown=if(labels.isEmpty())listOf("No downloaded model available") else labels
  spinner.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,shown)
  spinner.isEnabled=labels.isNotEmpty()
 }
 private fun selectionText(all:List<Language>,selected:Set<String>,available:List<Language>,empty:String):String{
  if(available.isEmpty())return empty
  val names=all.filter{it.code in selected&&available.any{a->a.code==it.code}}.map{it.label}
  return if(names.isEmpty())"Tap Select to choose a downloaded language." else names.joinToString("  ·  ")
 }
 private fun chooseLanguages(isStt:Boolean){
  val catalog=if(isStt)sttCatalog else ttsCatalog
  val ready=if(isStt)availableStt() else availableTts()
  if(ready.isEmpty()){Toast.makeText(this,"No matching language model is downloaded yet. Download it from the Download Models page on ChatWork home.",Toast.LENGTH_LONG).show();return}
  val selected=if(isStt)selectedStt else selectedTts
  val labels=ready.map{it.label}.toTypedArray();val checked=BooleanArray(ready.size){ready[it].code in selected}
  AlertDialog.Builder(this).setTitle(if(isStt)"Downloaded Voice To Text languages" else "Downloaded Text To Voice languages")
   .setMultiChoiceItems(labels,checked){_,which,on->if(on)selected.add(ready[which].code)else selected.remove(ready[which].code)}
   .setNegativeButton("Cancel",null).setPositiveButton("Save selection"){_,_->if(selected.isEmpty()){Toast.makeText(this,"Select at least one downloaded language.",Toast.LENGTH_SHORT).show()}else{if(isStt)sttSummary.text=selectionText(catalog,selected,ready,"")else ttsSummary.text=selectionText(catalog,selected,ready,"")}}
   .show()
 }
 private fun save(show:Boolean):Boolean{
  val key=api.text?.toString()?.trim().orEmpty()
  return runCatching{
   JarvisSettingsStore.save(this,providerValue(),key,selectedStt.toList(),selectedTts.toList(),selectedTtsModel)
   api.setText("")
   if(show)Toast.makeText(this,"JARVIS settings saved.",Toast.LENGTH_SHORT).show()
   apiStatus.text=if(JarvisSettingsStore.read(this).apiKey.isBlank())"No API key saved." else "API key saved securely · ${providerValue().uppercase()} · ••••••••••••"
   refreshAvailability();true
  }.getOrElse{status.text=it.message?: "Save failed";false}
 }
 private fun activate(){
  if(selectedStt.isEmpty()||selectedTts.isEmpty()){status.text="Select at least one downloaded language for both speech models.";return}
  if(!save(false))return
  val cfg=JarvisSettingsStore.read(this);val stt=cfg.sttLanguage;val tts=cfg.ttsLanguage
  val sttPack=SpeechModelCatalog.indicConformer(stt);val ttsPack=ttsPack(tts)
  val missing=mutableListOf<String>()
  if(cfg.apiKey.isBlank())missing.add("API key")
  if(!OfflineSpeechEngineFactory.isReady(this,sttPack))missing.add("IndicConformer $stt")
  if(packs.snapshot(ttsPack).state!=SpeechPackDownloadManager.State.COMPLETE)missing.add("${selectedTtsModel.uppercase()} TTS $tts")
  if(!WakeWordEngineFactory.isReady(this))missing.add("Hey ChatWork wake-word")
  if(missing.isNotEmpty()){status.text="Required downloaded models are missing or incomplete: ${missing.joinToString()}. Your saved settings are kept.";return}
  if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),8101);return}
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS),8102);return}
  startJarvis()
 }
 private fun startJarvis(){JarvisSettingsStore.setActive(this,true);try{val i=Intent(this,WakeWordAssistantService::class.java);if(Build.VERSION.SDK_INT>=26)startForegroundService(i)else startService(i);status.text="Starting JARVIS… Keep ChatWork open until the notification confirms listening.";active.text="Deactivate JARVIS"}catch(e:Exception){JarvisSettingsStore.setActive(this,false);status.text="Could not start JARVIS: ${e.message}";active.text="Active JARVIS"}}
 private fun deactivateConfirm(){AlertDialog.Builder(this).setTitle("Deactivate JARVIS?").setMessage("JARVIS stops listening. Saved API key and language choices remain.").setNegativeButton("Cancel",null).setPositiveButton("Deactivate"){_,_->JarvisSettingsStore.setActive(this,false);stopService(Intent(this,WakeWordAssistantService::class.java).setAction(WakeWordAssistantService.ACTION_STOP));status.text="JARVIS deactivated. Settings are saved.";active.text="Active JARVIS"}.show()}
 private fun isActive()=JarvisSettingsStore.read(this).active||WakeWordAssistantService.isRunning
 override fun onRequestPermissionsResult(code:Int,p:Array<out String>,r:IntArray){super.onRequestPermissionsResult(code,p,r);if(code==8101||code==8102){if(r.isNotEmpty()&&r.all{it==PackageManager.PERMISSION_GRANTED})activate()else status.text="Microphone and notification permissions are required."}}
 private fun providerValue()=if(provider.selectedItemPosition==1)"gemini" else "groq"
 private fun spinner(items:List<Pair<String,String>>,selected:String)=Spinner(this).apply{adapter=ArrayAdapter(this@JarvisSetupActivity,android.R.layout.simple_spinner_dropdown_item,items.map{it.first});setSelection(items.indexOfFirst{it.second==selected}.coerceAtLeast(0))}
 private fun section(v:String)=TextView(this).apply{text=v;textSize=17f;setTextColor(ink);typeface=android.graphics.Typeface.DEFAULT_BOLD;setPadding(0,dp(18),0,dp(8))}
 private fun hint(v:String)=TextView(this).apply{text=v;textSize=12f;setTextColor(muted);setPadding(0,dp(4),0,dp(8))}
 private fun button(v:String,click:()->Unit)=Button(this).apply{text=v;isAllCaps=false;setOnClickListener{click()}}
 private fun match()=LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(8)}
 private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
}
