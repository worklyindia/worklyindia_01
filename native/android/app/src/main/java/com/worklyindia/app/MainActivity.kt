package com.worklyindia.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.ContentValues
import android.app.DownloadManager
import android.os.Environment
import android.webkit.URLUtil
import android.content.pm.PackageManager
import android.content.Context
import android.net.ConnectivityManager
import android.os.Vibrator
import android.os.VibrationEffect
import android.os.VibratorManager
import android.view.inputmethod.InputMethodManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.util.Base64
import android.view.WindowManager
import androidx.core.view.WindowInsetsCompat
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancel
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingGeoCallback: android.webkit.GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val website = "https://worklyindia.devs.surf/"
    private val allowedHost = "worklyindia.devs.surf"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Let Android lay out the app below the real system status bar.
        // Avoid manual inset padding: it can create a second, visible gap above the website.
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = android.graphics.Color.WHITE
        window.navigationBarColor = android.graphics.Color.WHITE
        if (Build.VERSION.SDK_INT >= 28) window.navigationBarDividerColor = android.graphics.Color.rgb(230, 233, 240)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            show(WindowInsetsCompat.Type.statusBars())
            show(WindowInsetsCompat.Type.navigationBars())
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
        webView = WebView(this)
        webView.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        webView.setBackgroundColor(android.graphics.Color.WHITE)
        // Enable WebAuthn in the embedded WebView so Supabase's browser passkey
        // ceremonies can invoke Android Credential Manager / Google Password Manager.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                webView.settings,
                WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            )
        } else {
            android.util.Log.w("WorklyWebView", "This Android System WebView does not support WebAuthn")
        }
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            loadsImagesAutomatically = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString WorklyIndiaApp/1.0"
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
            if (Build.VERSION.SDK_INT >= 26) safeBrowsingEnabled = true
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        webView.addJavascriptInterface(WorklyWebBridge(), "WorklyAndroid")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == allowedHost) return false
                if (uri.scheme == "http" || uri.scheme == "https") {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    return true
                }
                if (uri.scheme == "tel" || uri.scheme == "mailto" || uri.scheme == "geo") {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    return true
                }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (Uri.parse(url).host == allowedHost) {
                    syncWebsiteSession()
                    dispatchNativeEvent("workly-native-bridge-ready")
                    // In this native shell Android already places the WebView below
                    // the status bar. WebView may still report a non-zero CSS
                    // safe-area inset, which adds a second blank strip above headers.
                    view.evaluateJavascript("""
                        (function() {
                          document.documentElement.dataset.worklyNative = 'android';
                          if (window.__worklyNativeDownloadHandlerInstalled) return;
                          window.__worklyNativeDownloadHandlerInstalled = true;
                          document.addEventListener('click', function(event) {
                            var target = event.target;
                            var anchor = target && target.closest ? target.closest('a[download]') : null;
                            if (!anchor) return;
                            var href = anchor.href || '';
                            if (!href.startsWith('blob:') && !href.startsWith('data:')) return;
                            event.preventDefault();
                            event.stopPropagation();
                            (async function() {
                              var response = await fetch(href);
                              if (!response.ok) throw new Error('Could not read generated file');
                              var blob = await response.blob();
                              if (blob.size > 25 * 1024 * 1024) throw new Error('File is larger than 25 MB');
                              var reader = new FileReader();
                              reader.onloadend = function() {
                                try {
                                  var result = String(reader.result || '');
                                  var comma = result.indexOf(',');
                                  if (comma < 0) throw new Error('Invalid generated file');
                                  var saved = window.WorklyAndroid &&
                                    window.WorklyAndroid.downloadBase64File(
                                      anchor.download || 'workly-download',
                                      blob.type || 'application/octet-stream',
                                      result.slice(comma + 1)
                                    );
                                  if (!saved) throw new Error('Android could not save this file');
                                } catch (error) {
                                  console.error('[Workly download]', error);
                                }
                              };
                              reader.readAsDataURL(blob);
                            })().catch(function(error) { console.error('[Workly download]', error); });
                          }, true);
                        })();
                    """.trimIndent(), null)
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                if (Uri.parse(request.origin.toString()).host != allowedHost) {
                    request.deny()
                    return
                }
                val needed = mutableListOf<String>()
                val resources = request.resources.toSet()
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in resources &&
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
                ) needed += Manifest.permission.CAMERA
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in resources &&
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
                ) needed += Manifest.permission.RECORD_AUDIO
                if (needed.isEmpty()) {
                    request.grant(request.resources)
                } else {
                    pendingWebPermission = request
                    ActivityCompat.requestPermissions(this@MainActivity, needed.toTypedArray(), REQUEST_MEDIA)
                }
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: android.webkit.GeolocationPermissions.Callback) {
                if (Uri.parse(origin).host != allowedHost) {
                    callback.invoke(origin, false, false)
                    return
                }
                val fineGranted = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                val coarseGranted = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                if (fineGranted || coarseGranted || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                    callback.invoke(origin, true, false)
                } else {
                    pendingGeoCallback?.invoke(pendingGeoOrigin ?: origin, false, false)
                    pendingGeoOrigin = origin
                    pendingGeoCallback = callback
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                        REQUEST_LOCATION
                    )
                }
            }
        }
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            runCatching {
                val downloadUri = Uri.parse(url)
                require(downloadUri.scheme == "https" || downloadUri.scheme == "http") {
                    "This download link is not supported"
                }
                val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                    .replace(Regex("[\\\\/:*?\"<>|]"), "_")
                    .take(180)
                val request = DownloadManager.Request(downloadUri).apply {
                    setTitle(fileName)
                    setDescription("Downloading from Workly India")
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    setAllowedOverMetered(true)
                    setAllowedOverRoaming(false)
                    if (!mimeType.isNullOrBlank()) setMimeType(mimeType)
                    val cookies = CookieManager.getInstance().getCookie(url)
                    if (!cookies.isNullOrBlank()) addRequestHeader("Cookie", cookies)
                    if (!userAgent.isNullOrBlank()) addRequestHeader("User-Agent", userAgent)
                }
                val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                manager.enqueue(request)
                Toast.makeText(this, "Download started. Check Downloads.", Toast.LENGTH_LONG).show()
            }.onFailure { error ->
                android.util.Log.e("WorklyDownload", "Could not start website download", error)
                Toast.makeText(this, "Download failed. Please try again.", Toast.LENGTH_LONG).show()
            }
        }

        // Let Android fit the WebView between the status and navigation bars.
        // Do not add CSS/native safe-area padding a second time.
        setContentView(webView)
        registerNetworkListener()
        val target = intent.getStringExtra("notification_url")
            ?.takeIf { runCatching { Uri.parse(it).let { u -> u.scheme == "https" && u.host == allowedHost } }.getOrDefault(false) }
            ?: intent.data?.takeIf { it.scheme == "https" && it.host == allowedHost }?.toString()
            ?: website
        webView.loadUrl(target)
    }

    private fun syncWebsiteSession() {
        val script = """
            (function() {
              function syncWorklySession() {
                try {
                  var key = Object.keys(localStorage).find(function(k) { return k.indexOf('auth-token') >= 0; });
                  if (!key) return;
                  var session = JSON.parse(localStorage.getItem(key) || '{}');
                  if (session.access_token && session.refresh_token && session.user && session.user.id) {
                    WorklyAndroid.syncAuthSession(JSON.stringify(session));
                  }
                } catch(e) {}
              }
              if (!window.__worklyStorageHooked) {
                window.__worklyStorageHooked = true;
                var originalSet = Storage.prototype.setItem;
                Storage.prototype.setItem = function(k, v) {
                  var result = originalSet.apply(this, arguments);
                  if (String(k).indexOf('auth-token') >= 0) setTimeout(syncWorklySession, 250);
                  return result;
                };
                var originalRemove = Storage.prototype.removeItem;
                Storage.prototype.removeItem = function(k) {
                  var result = originalRemove.apply(this, arguments);
                  if (String(k).indexOf('auth-token') >= 0 && window.WorklyAndroid) WorklyAndroid.clearAuthSession();
                  return result;
                };
                window.addEventListener('storage', function(e) {
                  if (e.key && e.key.indexOf('auth-token') >= 0) setTimeout(syncWorklySession, 250);
                });
              }
              syncWorklySession();
            })();
        """.trimIndent()
        webView.evaluateJavascript(script, null)
    }

    private fun registerNetworkListener() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) {
                dispatchNativeEvent("workly-native-network-change", "{connected:true}")
                dispatchNativeEvent("online")
            }
            override fun onLost(network: android.net.Network) {
                dispatchNativeEvent("workly-native-network-change", "{connected:false}")
                dispatchNativeEvent("offline")
            }
        }
        runCatching {
            manager.registerDefaultNetworkCallback(callback)
            networkCallback = callback
        }.onFailure {
            android.util.Log.w("WorklyWebView", "Network listener unavailable", it)
        }
    }

    private fun dispatchNativeEvent(name: String, detail: String = "{}") {
        val safeName = name.replace(Regex("[^a-zA-Z0-9_-]"), "")
        runOnUiThread {
            if (!::webView.isInitialized) return@runOnUiThread
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('$safeName',{detail:$detail}));",
                null
            )
        }
    }

    private fun hasNotificationPermission(): Boolean {
        val runtimeGranted = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        return runtimeGranted && NotificationManagerCompat.from(this).areNotificationsEnabled()
    }

    inner class WorklyWebBridge {
        @JavascriptInterface
        fun isNetworkConnected(): Boolean {
            val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            return manager.activeNetworkInfo?.isConnected == true
        }

        @JavascriptInterface
        fun setStatusBar(color: String, darkIcons: Boolean) {
            runOnUiThread {
                val parsed = runCatching { Color.parseColor(color) }.getOrDefault(Color.WHITE)
                window.statusBarColor = parsed
                WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = darkIcons
            }
        }

        @JavascriptInterface
        fun hideKeyboard() {
            runOnUiThread {
                val manager = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                manager.hideSoftInputFromWindow(webView.windowToken, 0)
                dispatchNativeEvent("workly-native-keyboard-hidden")
            }
        }

        @JavascriptInterface
        fun vibrate(milliseconds: Int) {
            val duration = milliseconds.coerceIn(1, 80).toLong()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = getSystemService(VibratorManager::class.java)
                manager.defaultVibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                @Suppress("DEPRECATION")
                (getSystemService(Context.VIBRATOR_SERVICE) as Vibrator)
                    .vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                (getSystemService(Context.VIBRATOR_SERVICE) as Vibrator).vibrate(duration)
            }
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread { finish() }
        }

        @JavascriptInterface
        fun isNotificationPermissionGranted(): Boolean = hasNotificationPermission()

        @JavascriptInterface
        fun requestNotificationPermission(): Boolean {
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                runOnUiThread {
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
                }
                return false
            }
            return NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled()
        }

        @JavascriptInterface
        fun registerPushNotifications() {
            runOnUiThread {
                try {
                    // The website syncs its latest Supabase session immediately
                    // before calling this method. Retain the no-argument bridge
                    // for compatibility with the currently deployed web bundle.
                    val session = NativeAuth.session(this@MainActivity)
                        ?: throw IllegalStateException("Sign in again to enable notifications")
                    if (!hasNotificationPermission()) {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('workly-native-push-registration-complete', {detail:{success:false,reason:'permission_denied'}}));",
                            null
                        )
                        return@runOnUiThread
                    }
                    activityScope.launch(Dispatchers.IO) {
                        val success = NativePushManager.register(this@MainActivity, session)
                        runOnUiThread {
                            webView.evaluateJavascript(
                                "window.dispatchEvent(new CustomEvent('workly-native-push-registration-complete', {detail:{success:$success}}));",
                                null
                            )
                        }
                    }
                } catch (error: Exception) {
                    android.util.Log.e("WorklyPush", "Could not start native push registration", error)
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('workly-native-push-registration-complete', {detail:{success:false,reason:'session_unavailable'}}));",
                        null
                    )
                }
            }
        }

        @JavascriptInterface
        fun downloadBase64File(fileName: String, mimeType: String, base64Data: String): Boolean {
            var insertedUri: Uri? = null
            return try {
                require(base64Data.length <= 36_000_000) { "File is larger than 25 MB" }
                val safeName = fileName.substringAfterLast('/').substringAfterLast('\\')
                    .replace(Regex("[\\\\/:*?\\\"<>|]"), "_")
                    .take(180)
                    .ifBlank { "workly-download" }
                val safeMime = mimeType.takeIf { it.matches(Regex("^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+$")) }
                    ?: "application/octet-stream"
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                require(bytes.size <= 25 * 1024 * 1024) { "File is larger than 25 MB" }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                        put(MediaStore.Downloads.MIME_TYPE, safeMime)
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    insertedUri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("Could not create Downloads file")
                    contentResolver.openOutputStream(insertedUri!!, "w")?.use { it.write(bytes) }
                        ?: throw IllegalStateException("Could not write Downloads file")
                    val completed = ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }
                    contentResolver.update(insertedUri!!, completed, null, null)
                } else {
                    val directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                        ?: throw IllegalStateException("Downloads folder unavailable")
                    if (!directory.exists()) directory.mkdirs()
                    File(directory, safeName).writeBytes(bytes)
                }
                runOnUiThread {
                    Toast.makeText(this, "File saved in Downloads: $safeName", Toast.LENGTH_LONG).show()
                }
                true
            } catch (error: Exception) {
                insertedUri?.let { runCatching { contentResolver.delete(it, null, null) } }
                android.util.Log.e("WorklyDownload", "Could not save generated website file", error)
                runOnUiThread {
                    Toast.makeText(this, "Download failed. Please try again.", Toast.LENGTH_LONG).show()
                }
                false
            }
        }

        @JavascriptInterface
        fun clearAuthSession() {
            runOnUiThread {
                val old = NativeAuth.session(this@MainActivity)
                if (old != null) activityScope.launch(Dispatchers.IO) {
                    NativePushManager.unregister(this@MainActivity, old)
                }
                NativeAuth.signOut(this@MainActivity)
            }
        }

        @JavascriptInterface
        fun syncAuthSession(raw: String) {
            runOnUiThread {
                try {
                    val session = JSONObject(raw)
                    val user = session.getJSONObject("user")
                    val metadata = user.optJSONObject("user_metadata") ?: JSONObject()
                    val role = metadata.optString("user_type",
                        metadata.optString("account_type", metadata.optString("role", "jobseeker")))
                    val saved = NativeAuth.saveWebSession(
                        this@MainActivity,
                        session.getString("access_token"),
                        session.getString("refresh_token"),
                        user.getString("id"),
                        user.optString("email"),
                        if (role.equals("employer", true)) "employer" else "jobseeker"
                    )
                    // Push registration is explicit opt-in from the website settings UI.
                } catch (error: Exception) {
                    android.util.Log.w("WorklyWebView", "Website session sync skipped", error)
                }
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_MEDIA) {
            val request = pendingWebPermission
            pendingWebPermission = null
            if (request != null) {
                val granted = permissions.indices.all { grantResults.getOrNull(it) == PackageManager.PERMISSION_GRANTED }
                if (granted) request.grant(request.resources) else request.deny()
            }
        } else if (requestCode == REQUEST_LOCATION) {
            val origin = pendingGeoOrigin
            val callback = pendingGeoCallback
            pendingGeoOrigin = null
            pendingGeoCallback = null
            val granted = permissions.indices.any { index ->
                (permissions[index] == Manifest.permission.ACCESS_FINE_LOCATION ||
                    permissions[index] == Manifest.permission.ACCESS_COARSE_LOCATION) &&
                    grantResults.getOrNull(index) == PackageManager.PERMISSION_GRANTED
            }
            if (origin != null && callback != null) callback.invoke(origin, granted, false)
        } else if (requestCode == REQUEST_NOTIFICATIONS) {
            val granted = hasNotificationPermission()
            // The web UI owns the subscribe flow and invokes native registration
            // once after this callback. Do not register twice here.
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('workly-native-notification-permission', {detail:{granted:$granted}}));",
                null
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val target = intent.getStringExtra("notification_url")
            ?: intent.data?.takeIf { it.scheme == "https" && it.host == allowedHost }?.toString()
        if (!target.isNullOrBlank()) webView.loadUrl(target)
    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (::webView.isInitialized) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new Event('workly-native-back'));",
                null
            )
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        networkCallback?.let { callback ->
            runCatching {
                (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager)
                    .unregisterNetworkCallback(callback)
            }
        }
        networkCallback = null
        pendingGeoCallback?.invoke(pendingGeoOrigin ?: website, false, false)
        pendingGeoCallback = null
        pendingGeoOrigin = null
        activityScope.cancel()
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("WorklyAndroid")
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_NOTIFICATIONS = 701
        private const val REQUEST_MEDIA = 702
        private const val REQUEST_LOCATION = 703
    }
}
