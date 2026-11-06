package com.worklyindia.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
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
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var pendingWebPermission: PermissionRequest? = null
    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val website = "https://worklyindia.devs.surf/"
    private val allowedHost = "worklyindia.devs.surf"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Let Android lay out the app below the real system status bar.
        // Avoid manual inset padding: it can create a second, visible gap above the website.
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = android.graphics.Color.WHITE
        window.navigationBarColor = android.graphics.Color.WHITE
        if (Build.VERSION.SDK_INT >= 28) window.navigationBarDividerColor = android.graphics.Color.rgb(230, 233, 240)
        WindowCompat.getInsetsController(window, window.decorView).apply {
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
            loadsImagesAutomatically = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)
            cacheMode = WebSettings.LOAD_DEFAULT
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
                    // In this native shell Android already places the WebView below
                    // the status bar. WebView may still report a non-zero CSS
                    // safe-area inset, which adds a second blank strip above headers.
                    view.evaluateJavascript("""
                        (function() {
                          var id = 'workly-native-top-inset-fix';
                          var style = document.getElementById(id);
                          if (!style) {
                            style = document.createElement('style');
                            style.id = id;
                            style.textContent = 'html, body { padding-top: 0 !important; margin-top: 0 !important; }';
                            (document.head || document.documentElement).appendChild(style);
                          }
                          document.documentElement.dataset.worklyNative = 'android';
                          if (document.body) document.body.style.setProperty('padding-top', '0', 'important');
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
                if (Uri.parse(origin).host == allowedHost) callback.invoke(origin, true, false)
                else callback.invoke(origin, false, false)
            }
        }
        // Let Android fit the WebView between the status and navigation bars.
        // Do not add CSS/native safe-area padding a second time.
        setContentView(webView)
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

    private fun hasNotificationPermission(): Boolean {
        val runtimeGranted = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        return runtimeGranted && NotificationManagerCompat.from(this).areNotificationsEnabled()
    }

    inner class WorklyWebBridge {
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
        fun registerPushNotifications(rawSession: String) {
            runOnUiThread {
                try {
                    // Always use the latest Supabase access token from the live web
                    // session; the encrypted native copy may otherwise expire.
                    val sessionJson = JSONObject(rawSession)
                    val user = sessionJson.getJSONObject("user")
                    val metadata = user.optJSONObject("user_metadata") ?: JSONObject()
                    val role = metadata.optString("user_type",
                        metadata.optString("account_type", metadata.optString("role", "jobseeker")))
                    val session = NativeAuth.saveWebSession(
                        this@MainActivity,
                        sessionJson.getString("access_token"),
                        sessionJson.getString("refresh_token"),
                        user.getString("id"),
                        user.optString("email"),
                        if (role.equals("employer", true)) "employer" else "jobseeker"
                    )
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
                    android.util.Log.e("WorklyPush", "Could not read fresh website session", error)
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('workly-native-push-registration-complete', {detail:{success:false,reason:'session_unavailable'}}));",
                        null
                    )
                }
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
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    override fun onDestroy() {
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
    }
}
