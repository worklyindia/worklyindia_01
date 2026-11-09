package com.worklyindia.app
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// Website-matched card: today's event is marked Today; the next event is marked Coming Soon.
class WorklyDateTimeWidgetProvider : AppWidgetProvider() {
 override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
  val tz=TimeZone.getTimeZone("Asia/Kolkata")
  val hour=java.util.Calendar.getInstance(tz).get(java.util.Calendar.HOUR_OF_DAY)
  val greeting=when(hour){ in 5..11->"☀  Good Morning"; in 12..16->"☀  Good Afternoon"; in 17..20->"☾  Good Evening"; else->"☾  Good Night" }
  val today=SimpleDateFormat("yyyy-MM-dd",Locale.US).apply{timeZone=tz}.format(Date())
  val raw=context.getSharedPreferences(WorklyFestivalWidgetBridge.PREFS,Context.MODE_PRIVATE).getString(WorklyFestivalWidgetBridge.KEY_FESTIVALS,null)
  val rows=runCatching{JSONArray(raw?: "[]")}.getOrDefault(JSONArray())
  val events=mutableListOf<Pair<String,String>>()
  for(i in 0 until rows.length()){
   val row=rows.optJSONObject(i)?:continue
   val date=row.optString("date"); val name=row.optString("name").trim()
   if(date>=today && date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && name.isNotBlank()) events.add(date to name)
  }
  events.sortBy{it.first}
  val todayEvents=events.filter{it.first==today}
  val chosen=if(todayEvents.isNotEmpty()) todayEvents else events.takeWhile{it.first==events.firstOrNull()?.first}
  val eventName=chosen.take(2).joinToString(" • "){it.second}.ifBlank{"Festival calendar"}
  val eventDate=chosen.firstOrNull()?.first
  val label=if(todayEvents.isNotEmpty()) "TODAY'S FESTIVAL" else if(eventDate!=null) "COMING SOON" else "FESTIVALS"
  val dateLabel=eventDate?.let{d->runCatching{SimpleDateFormat("yyyy-MM-dd",Locale.US).apply{timeZone=tz}.parse(d)?.let{SimpleDateFormat("EEE, dd MMM",Locale.ENGLISH).apply{timeZone=tz}.format(it)}}.getOrNull()}?:"Offline • Sync when online"
  ids.forEach{id->
   val v=RemoteViews(context.packageName,R.layout.workly_datetime_widget)
   v.setTextViewText(R.id.workly_datetime_greeting,greeting)
   v.setString(R.id.workly_datetime_time,"setTimeZone","Asia/Kolkata")
   v.setString(R.id.workly_datetime_seconds,"setTimeZone","Asia/Kolkata")
   v.setString(R.id.workly_datetime_date,"setTimeZone","Asia/Kolkata")
   v.setTextViewText(R.id.workly_festival_label,label)
   v.setTextViewText(R.id.workly_festival_name,eventName)
   v.setTextViewText(R.id.workly_festival_badge, if(todayEvents.isNotEmpty()) "Today" else if(eventDate != null) "Coming Soon" else "View All")
   val intent=Intent(Intent.ACTION_VIEW,Uri.parse("https://worklyindia.devs.surf/festivals")).apply{setPackage(context.packageName);flags=Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP}
   val pending=PendingIntent.getActivity(context,id+7100,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
   v.setOnClickPendingIntent(R.id.workly_festival_open,pending)
   manager.updateAppWidget(id,v)
  }
 }
 companion object {
  fun refreshAll(context:Context){
   val manager=AppWidgetManager.getInstance(context)
   val ids=manager.getAppWidgetIds(ComponentName(context,WorklyDateTimeWidgetProvider::class.java))
   if(ids.isNotEmpty()) WorklyDateTimeWidgetProvider().onUpdate(context,manager,ids)
  }
 }
}