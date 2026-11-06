package com.worklyindia.app

import android.annotation.SuppressLint
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private const val HOME_BASE_URL = "https://jubwzelupbntbetpajqb.supabase.co"
private const val HOME_PUBLIC_KEY = "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o"

data class NativeHomeBanner(val title:String,val subtitle:String,val image:String?,val youtube:String?)
data class NativeHomeBadge(val title:String,val subtitle:String,val description:String,val image:String?)
data class NativeHomePerson(val name:String,val image:String?)
data class NativeHomeData(val banners:List<NativeHomeBanner> = emptyList(),val videos:List<String> = emptyList(),val heroImage:String? = null,val seekersImage:String? = null,val badges:List<NativeHomeBadge> = emptyList(),val seekers:List<NativeHomePerson> = emptyList(),val companies:List<NativeHomePerson> = emptyList(),val logoUrl:String? = null,val brandName:String = "Workly India",val tagline:String = "Find.Work.Grow",val seekerLoginAvatar:String? = null,val employerLoginAvatar:String? = null)

object NativeHomeApi {
    suspend fun load():NativeHomeData = withContext(Dispatchers.IO) {
        var banners=emptyList<NativeHomeBanner>(); var videos=emptyList<String>(); var hero:String?=null; var seekersImage:String?=null
        var badges=emptyList<NativeHomeBadge>(); var seekers=emptyList<NativeHomePerson>(); var companies=emptyList<NativeHomePerson>(); var logoUrl:String?=null; var brandName="Workly India"; var tagline="Find.Work.Grow"; var seekerAvatar:String?=null; var employerAvatar:String?=null
        runCatching {
            val a=JSONArray(request("$HOME_BASE_URL/rest/v1/rpc/get_active_hero_banners","POST","{}"))
            banners=(0 until a.length()).mapNotNull { i -> val o=a.optJSONObject(i) ?: return@mapNotNull null
                NativeHomeBanner(o.optString("title"),o.optString("subtitle"),o.optString("image_url").takeIf{it.startsWith("http")},o.optString("youtube_url").takeIf{it.startsWith("http")}) }
        }
        runCatching {
            val a=JSONArray(request("$HOME_BASE_URL/rest/v1/app_settings?select=setting_key,setting_value&setting_key=in.(home_seekers_video_url,home_hero_image,home_seekers_image,job_seeker_login_avatar,employer_login_avatar)"))
            for(i in 0 until a.length()) { val o=a.getJSONObject(i); when(o.optString("setting_key")) {
                "home_seekers_video_url" -> videos=o.optString("setting_value").split(Regex("[\\n,]+")).map{it.trim()}.filter{it.contains("youtu")}
                "home_hero_image" -> hero=o.optString("setting_value").takeIf{it.startsWith("http")}
                "home_seekers_image" -> seekersImage=o.optString("setting_value").takeIf{it.startsWith("http")}
                "job_seeker_login_avatar" -> seekerAvatar=o.optString("setting_value").takeIf{it.startsWith("http")}
                "employer_login_avatar" -> employerAvatar=o.optString("setting_value").takeIf{it.startsWith("http")}
            } }
        }
        runCatching {
            val a=JSONArray(request("$HOME_BASE_URL/rest/v1/home_trust_badges?select=title,subtitle,description,image_url&is_active=eq.true&order=sort_order.asc"))
            badges=(0 until a.length()).map { i -> val o=a.getJSONObject(i); NativeHomeBadge(o.optString("title"),o.optString("subtitle"),o.optString("description"),o.optString("image_url").takeIf{it.startsWith("http")}) }
        }
        runCatching { seekers=people("get_trust_seekers") }; runCatching { companies=people("get_trust_companies") }
        runCatching { val o=JSONObject(request("$HOME_BASE_URL/rest/v1/rpc/get_brand_assets","POST","{}")); logoUrl=o.optString("logo_url").takeIf{it.startsWith("http")}; brandName=o.optString("brand_name").ifBlank{"Workly India"}; tagline=o.optString("brand_tagline").ifBlank{"Find.Work.Grow"} }
        NativeHomeData(banners,videos,hero,seekersImage,badges,seekers,companies,logoUrl,brandName,tagline,seekerAvatar,employerAvatar)
    }
    private fun people(fn:String):List<NativeHomePerson> {
        val a=JSONArray(request("$HOME_BASE_URL/rest/v1/rpc/$fn","POST","{\"_limit\":30}"))
        return (0 until a.length()).mapNotNull { i -> val o=a.optJSONObject(i) ?: return@mapNotNull null
            val n=o.optString("name").trim(); if(n.isBlank()) null else NativeHomePerson(n,o.optString("image_url").takeIf{it.startsWith("http")}) }
    }
    private fun request(url:String,method:String="GET",body:String?=null):String {
        val c=URL(url).openConnection() as HttpURLConnection; c.connectTimeout=12000; c.readTimeout=16000; c.requestMethod=method
        c.setRequestProperty("apikey",HOME_PUBLIC_KEY); c.setRequestProperty("Accept","application/json")
        if(body!=null){c.doOutput=true;c.setRequestProperty("Content-Type","application/json");c.outputStream.use{it.write(body.toByteArray())}}
        try { val code=c.responseCode; val stream=if(code in 200..299)c.inputStream else c.errorStream; val result=stream?.bufferedReader()?.use{it.readText()}.orEmpty()
            if(code !in 200..299) error("Home content unavailable ($code)"); return result
        } finally { c.disconnect() }
    }
}

@Composable
fun NativeScrollReveal(type: String = "fade-up", content: @Composable () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    val screenHeightPx = with(LocalDensity.current) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    val revealModifier = Modifier.onGloballyPositioned { coordinates ->
        if (!visible) {
            val top = coordinates.positionInRoot().y
            val bottom = top + coordinates.size.height
            if (top < screenHeightPx && bottom > 0f) visible = true
        }
    }
    val alpha by animateFloatAsState(if (visible) 1f else 0f, tween(600, easing = FastOutSlowInEasing), label = "homeRevealAlpha")
    val offset by animateFloatAsState(if (visible) 0f else if (type == "zoom-in") 0f else 30f, tween(600, easing = FastOutSlowInEasing), label = "homeRevealOffset")
    val scale by animateFloatAsState(if (visible) 1f else if (type == "zoom-in") 0.94f else 1f, tween(600, easing = FastOutSlowInEasing), label = "homeRevealScale")
    androidx.compose.foundation.layout.Box(revealModifier.graphicsLayer { this.alpha = alpha; translationY = offset; scaleX = scale; scaleY = scale }) { content() }
}

@Composable
fun NativeHomeBannerCarousel(data:NativeHomeData) {
    if(data.banners.isEmpty()) return
    var index by remember(data.banners) { mutableIntStateOf(0) }
    var userInteracting by remember { mutableStateOf(false) }
    var progress by remember(index, userInteracting) { mutableFloatStateOf(0f) }
    LaunchedEffect(index, userInteracting, data.banners.size) {
        if(data.banners.size > 1 && !userInteracting) {
            progress = 0f
            val tick = 30L
            var elapsed = 0L
            while(elapsed < 3000L) {
                delay(tick)
                elapsed += tick
                progress = (elapsed / 3000f).coerceIn(0f,1f)
            }
            index = (index + 1) % data.banners.size
        }
    }
    LaunchedEffect(userInteracting) {
        if(userInteracting) { delay(3000); userInteracting = false }
    }
    val b=data.banners[index.coerceIn(data.banners.indices)]
    Card(Modifier.fillMaxWidth().padding(horizontal=12.dp).pointerInput(data.banners.size) { var drag = 0f; detectHorizontalDragGestures(onHorizontalDrag = { _, amount -> drag += amount }, onDragEnd = { if (drag > 40f) { userInteracting = true; index = (index - 1 + data.banners.size) % data.banners.size } else if (drag < -40f) { userInteracting = true; index = (index + 1) % data.banners.size }; drag = 0f }, onDragCancel = { drag = 0f }) },shape=RoundedCornerShape(18.dp),colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
        Column {
            if(b.image!=null) AsyncImage(b.image,b.title,Modifier.fillMaxWidth().aspectRatio(2f).clip(RoundedCornerShape(topStart=18.dp,topEnd=18.dp)),contentScale=androidx.compose.ui.layout.ContentScale.Fit)
            if(b.title.isNotBlank() || b.subtitle.isNotBlank()) Column(Modifier.padding(horizontal=15.dp,vertical=12.dp)){if(b.title.isNotBlank())Text(b.title,style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold);if(b.subtitle.isNotBlank())Text(b.subtitle,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)}
            if(data.banners.size>1) {
                LinearProgressIndicator(progress={progress},modifier=Modifier.fillMaxWidth().height(3.dp),color=MaterialTheme.colorScheme.primary,trackColor=MaterialTheme.colorScheme.surfaceVariant)
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.Center,verticalAlignment=Alignment.CenterVertically){
                    IconButton(onClick={userInteracting=true;index=(index-1+data.banners.size)%data.banners.size}){Icon(Icons.Default.ChevronLeft,"Previous banner")}
                    Text("${index+1} / ${data.banners.size}",style=MaterialTheme.typography.labelMedium)
                    IconButton(onClick={userInteracting=true;index=(index+1)%data.banners.size}){Icon(Icons.Default.ChevronRight,"Next banner")}
                }
            }
            if(b.youtube!=null)NativeHomeYouTube(b.youtube,Modifier.fillMaxWidth().height(205.dp))
        }
    }
}

@Composable
fun NativeHomeCareerCategories(onCategory:(String)->Unit,onAll:()->Unit) {
    val photoBase = "https://wsrv.nl/?w=600&q=80&output=webp&url=https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/"
    val cards = listOf(
        arrayOf("Jobs for Freshers","Your first step starts here","Fresher","FIRST OPPORTUNITY","01-Jobs-for-Freshers.png"),
        arrayOf("Work from Home","A career, wherever you are","Remote","WORK YOUR WAY","02-Work-from-Home.png"),
        arrayOf("Part-time Jobs","Make time for what matters","Part-time","FLEXIBLE HOURS","03-Part-time-Jobs.png"),
        arrayOf("Jobs for Women","Your ambition belongs here","Women","NEW POSSIBILITIES","04-Jobs-for-Women.png"),
        arrayOf("Full-time Jobs","Build your next chapter","Full-time","CAREER GROWTH","05-Full-time-Jobs.png"),
        arrayOf("Internships","Learn today, lead tomorrow","Internship","LEARN & GROW","06-Internships.png")
    )
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                Text("FIND YOUR NEXT CHAPTER", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                Text("Jobs that fit your life", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            TextButton(onClick = onAll) { Text("All jobs"); Icon(Icons.Default.ArrowForward, null, Modifier.size(15.dp)) }
        }
        cards.forEachIndexed { index, card ->
            val icons = listOf(Icons.Default.School,Icons.Default.Home,Icons.Default.Schedule,Icons.Default.Groups,Icons.Default.Work,Icons.Default.MenuBook)
            Card(
                onClick = { onCategory(card[2]) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = .6f))
            ) {
                Row(Modifier.fillMaxWidth().heightIn(min = 150.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f).padding(start = 16.dp, top = 15.dp, bottom = 15.dp, end = 8.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(icons[index], null, Modifier.size(15.dp), tint = MaterialTheme.colorScheme.primary)
                            Text(card[3], Modifier.padding(start = 5.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                        }
                        Text(card[0], style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(card[1], style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("View jobs", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                            Icon(Icons.Default.ArrowUpward, null, Modifier.padding(start = 4.dp).size(14.dp), tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                    AsyncImage(
                        model = photoBase + card[4], contentDescription = card[0],
                        modifier = Modifier.width(116.dp).height(150.dp).clip(RoundedCornerShape(topEnd = 15.dp, bottomEnd = 15.dp)),
                        contentScale = androidx.compose.ui.layout.ContentScale.Fit
                    )
                }
            }
        }
    }
}

@Composable
fun NativeHomeExtraSections(data:NativeHomeData,onFeature:(String)->Unit,onCategory:(String)->Unit) {
    if(data.videos.isNotEmpty()) {
        HomeHeading("Workly India videos","Updates and useful job guidance")
        LazyRow(contentPadding=PaddingValues(horizontal=14.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){items(data.videos){NativeHomeYouTube(it,Modifier.width(310.dp).height(190.dp))}}
    }
    HomeHeading("See Workly India in action","A quick look at how hiring and job search work on the platform.")
    NativeHomeMp4("https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev/workly-india-promo-30s-silent.mp4",data.heroImage,Modifier.fillMaxWidth().padding(horizontal=14.dp).height(205.dp))
    TextButton(onClick={onFeature("Workly India video")}){Text("Watch full video")}
    HomeHeading("Join job seekers on Workly India","Community and career opportunities")
    if(data.seekers.isNotEmpty())LazyRow(contentPadding=PaddingValues(horizontal=12.dp),horizontalArrangement=Arrangement.spacedBy(9.dp)){items(data.seekers){p->Card(Modifier.width(120.dp)){Column(Modifier.padding(10.dp),horizontalAlignment=Alignment.CenterHorizontally){if(p.image!=null)AsyncImage(p.image,p.name,Modifier.size(48.dp).clip(RoundedCornerShape(24.dp)))else Icon(Icons.Default.Person,null,Modifier.size(48.dp));Text(p.name,style=MaterialTheme.typography.labelSmall,maxLines=1,overflow=TextOverflow.Ellipsis)}}}}
    if(data.seekersImage!=null)AsyncImage(data.seekersImage,"Workly India job seeker community",Modifier.fillMaxWidth().padding(10.dp))
    HomeHeading("Free Resume Templates","Choose a design and create your resume")
    LazyRow(contentPadding=PaddingValues(horizontal=14.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){items(listOf("Modern","Professional","Minimal","Creative","Classic")){name->Card(onClick={onFeature("My resume")},Modifier.width(145.dp).height(155.dp)){Column(Modifier.fillMaxSize().padding(12.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.SpaceBetween){Icon(Icons.Default.Description,null,Modifier.size(48.dp),tint=MaterialTheme.colorScheme.primary);Text(name,fontWeight=FontWeight.Bold);Text("Create resume",style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.primary)}}}}
    TextButton(onClick={onFeature("My resume")}){Text("View all resume templates")}
    HomeHeading("Free Cover Letter Templates","Make your job application stand out")
    LazyRow(contentPadding=PaddingValues(horizontal=14.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){items(listOf("Professional","Modern","Simple","Creative")){name->Card(onClick={onFeature("Cover letter builder")},Modifier.width(145.dp).height(140.dp)){Column(Modifier.fillMaxSize().padding(12.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.SpaceBetween){Icon(Icons.Default.Mail,null,Modifier.size(42.dp),tint=MaterialTheme.colorScheme.primary);Text(name,fontWeight=FontWeight.Bold);Text("Create cover letter",style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.primary)}}}}
    TextButton(onClick={onFeature("Cover letter builder")}){Text("View all cover letter templates")}
    Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
        Row(verticalAlignment=Alignment.CenterVertically){Icon(Icons.Default.Language,null,tint=MaterialTheme.colorScheme.primary);Text("Domains",Modifier.padding(start=8.dp),color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold)}
        Text("Get your own website domain",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold);Text("Find and buy the perfect domain for your brand.",color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
        OutlinedButton(onClick={onFeature("Domains")},Modifier.fillMaxWidth()){Icon(Icons.Default.Search,null);Text("Search domain name",Modifier.padding(start=8.dp))}
        Text(".com   .in   .co.in   .online   .store   .tech   .net   .org   .app",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.labelMedium)
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly){listOf("Instant setup" to Icons.Default.Bolt,"Free SSL" to Icons.Default.Shield,"Easy DNS" to Icons.Default.Settings).forEach{(t,i)->Column(horizontalAlignment=Alignment.CenterHorizontally){Icon(i,null,tint=MaterialTheme.colorScheme.primary);Text(t,style=MaterialTheme.typography.labelSmall)}}}
    }
    if(data.badges.isNotEmpty()){HomeHeading("Why choose Workly India","Platform safety and trust features");data.badges.forEach{b->Card(Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=5.dp),shape=RoundedCornerShape(16.dp)){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){Row(verticalAlignment=Alignment.CenterVertically){if(b.image!=null)AsyncImage(b.image,b.title,Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)))else Icon(Icons.Default.VerifiedUser,null,Modifier.size(40.dp),tint=MaterialTheme.colorScheme.primary);Column(Modifier.weight(1f).padding(start=10.dp)){Text(b.title,fontWeight=FontWeight.Bold);Text(b.subtitle,style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)}};Text(b.description.ifBlank{b.subtitle},style=MaterialTheme.typography.bodySmall)}}}}
    HomeHeading("Trusted by companies","Company profiles and employer community")
    if(data.companies.isNotEmpty())LazyRow(contentPadding=PaddingValues(horizontal=12.dp),horizontalArrangement=Arrangement.spacedBy(9.dp)){items(data.companies){p->Card{Row(Modifier.widthIn(min=130.dp,max=190.dp).padding(12.dp),verticalAlignment=Alignment.CenterVertically){if(p.image!=null)AsyncImage(p.image,p.name,Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)))else Icon(Icons.Default.Business,null);Text(p.name,Modifier.padding(start=8.dp),style=MaterialTheme.typography.labelMedium,maxLines=2,overflow=TextOverflow.Ellipsis)}}}}
    TextButton(onClick={onFeature("Companies")}){Text("Explore companies")}
    Card(Modifier.fillMaxWidth().padding(14.dp),colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.errorContainer)){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){Row(verticalAlignment=Alignment.CenterVertically){Icon(Icons.Default.Warning,null,tint=MaterialTheme.colorScheme.error);Text("Important Safety Notice",Modifier.padding(start=8.dp),fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.error)};Text("This platform lists job opportunities from various companies. We do not provide jobs directly.");Text("Always verify the company before applying. Legitimate jobs never require payment. Do not pay registration or processing fees.");Text("Never share your OTP, bank details, or passwords. Only verify documents through official government websites.");Text("Job seekers are never charged. Report suspicious activity to Workly India support.",style=MaterialTheme.typography.bodySmall);TextButton(onClick={onFeature("Help & support")}){Text("Contact support")}}}
    Column(Modifier.fillMaxWidth().padding(16.dp),horizontalAlignment=Alignment.CenterHorizontally){Text("Explore Workly India",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
        val links=listOf("About Us","Mission","Vision","Why Choose Us","Blog","Trust & Safety","Employer Guidelines","Job Seeker Guidelines","Community Guidelines","Accessibility Statement","Privacy Policy","Refund Policy","Terms & Conditions","FAQ","Disclaimer","DMCA","Cookie Policy","Contact Us","Sitemap","Careers","Press / Media Kit")
        links.chunked(2).forEach{pair->Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.Center){pair.forEach{label->TextButton(onClick={onFeature(label)},Modifier.weight(1f)){Text(label,style=MaterialTheme.typography.labelSmall,maxLines=2)}}}}
        Text("Follow Workly India",fontWeight=FontWeight.Bold);Row(horizontalArrangement=Arrangement.spacedBy(14.dp)){IconButton(onClick={onFeature("Social channels")}){Icon(Icons.Default.Facebook,"Facebook")};IconButton(onClick={onFeature("Social channels")}){Icon(Icons.Default.CameraAlt,"Instagram")};IconButton(onClick={onFeature("Social channels")}){Icon(Icons.Default.PlayCircle,"YouTube")}}
        Text("© 2026 Workly India. All Rights Reserved.",style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun HomeHeading(title:String,subtitle:String){Column(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=12.dp)){Text(title,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold);Text(subtitle,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)}}
private fun homeYoutubeId(url:String):String?=Regex("(?:youtu\\.be/|youtube(?:-nocookie)?\\.com/(?:embed/|watch\\?v=|shorts/))([A-Za-z0-9_-]{11})").find(url)?.groupValues?.getOrNull(1)

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun NativeHomeYouTube(url:String,modifier:Modifier=Modifier){val id=homeYoutubeId(url)?:return;AndroidView(modifier=modifier.clip(RoundedCornerShape(14.dp)),factory={ctx->WebView(ctx).apply{settings.javaScriptEnabled=true;settings.domStorageEnabled=true;webChromeClient=WebChromeClient();webViewClient=WebViewClient();loadDataWithBaseURL("https://www.youtube-nocookie.com","<html><meta name='viewport' content='width=device-width,initial-scale=1'><body style='margin:0;background:#000'><iframe width='100%' height='100%' src='https://www.youtube-nocookie.com/embed/$id?playsinline=1&rel=0' frameborder='0' allow='accelerometer;autoplay;encrypted-media;picture-in-picture' allowfullscreen></iframe></body></html>","text/html","UTF-8",null)}},update={})}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun NativeHomeMp4(url:String,poster:String?,modifier:Modifier=Modifier){AndroidView(modifier=modifier.clip(RoundedCornerShape(14.dp)),factory={ctx->WebView(ctx).apply{settings.javaScriptEnabled=true;webChromeClient=WebChromeClient();webViewClient=WebViewClient();val p=poster?.let{"poster='$it'"}.orEmpty();loadDataWithBaseURL(null,"<html><meta name='viewport' content='width=device-width,initial-scale=1'><body style='margin:0;background:#000'><video $p controls playsinline preload='metadata' style='width:100%;height:100%;object-fit:contain'><source src='$url' type='video/mp4'></video></body></html>","text/html","UTF-8",null)}},update={})}
