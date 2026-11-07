package com.worklyindia.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebViewCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var loadingOverlay: FrameLayout
    private val mainHandler = Handler(Looper.getMainLooper())
    private var loadingStartedAt = 0L
    private var lastReadyFingerprint = ""
    private var stableReadyChecks = 0
    private var readyCheckRunnable: Runnable? = null
    private var pendingWebPermission: PermissionRequest? = null
    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val website = "https://worklyindia.devs.surf/"
    private val allowedHost = "worklyindia.devs.surf"
    private var failedUrl: String? = null
    private var showingOfflinePage = false
    private val connectivityCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread {
                if (showingOfflinePage && isNetworkAvailable()) retryLastPage()
            }
        }

        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
            if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            ) {
                runOnUiThread {
                    if (showingOfflinePage) retryLastPage()
                }
            }
        }
    }
    private var connectivityCallbackRegistered = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Android 15 enforces edge-to-edge for apps targeting SDK 35.
        // Apply system-bar insets once to a native container, not in website CSS.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT
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

        // A native branded loading layer hides the WebView until the website has
        // rendered and its initial API requests/images have settled.
        // Keep the Android status bar visible and place the whole website below it.
        // A root container is used so the WebView viewport itself starts below the inset.
        val root = FrameLayout(this).apply {
            setBackgroundColor(android.graphics.Color.WHITE)
            addView(webView)
        }
        loadingOverlay = createLoadingOverlay()
        root.addView(
            loadingOverlay,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        showLoadingOverlay()
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, windowInsets ->
            val systemBars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            // Insets are already applied to the root. Do not dispatch them to WebView,
            // otherwise WebView can apply the status-bar inset a second time.
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(root)
        webView.settings.apply {
            // Enable Android Credential Manager-backed WebAuthn in supported System WebView versions.
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
                WebSettingsCompat.setWebAuthenticationSupport(
                    this,
                    WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
                )
                android.util.Log.i("WorklyWebView", "WebAuthn support enabled for the Workly Android app")
            } else {
                android.util.Log.w("WorklyWebView", "This Android System WebView version does not support WebAuthn")
            }
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadsImagesAutomatically = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)
            // Always revalidate remote app assets. LOAD_CACHE_ELSE_NETWORK can keep
            // an old JavaScript bundle alive and leave the browser-only push warning
            // visible after the native bridge has been added.
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
            if (Build.VERSION.SDK_INT >= 26) safeBrowsingEnabled = true
            // Lets the website identify this exact native WebView even if the
            // JavaScript bridge is temporarily unavailable during page startup.
            userAgentString = "$userAgentString WorklyIndiaApp/1.0"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        webView.addJavascriptInterface(WorklyWebBridge(), "WorklyAndroid")
        // Inject the native-app marker at document start, before any React code
        // runs. onPageFinished alone is too late: notification capability checks
        // can run during hydration and cache the browser-only unsupported state.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(
                webView,
                """
                (function(){
                  Object.defineProperty(window, '__WORKLY_NATIVE_ANDROID__', {value:true, configurable:false, enumerable:false});
                  window.__worklyPendingRequests = 0;
                  var originalFetch = window.fetch;
                  if (originalFetch) window.fetch = function(){
                    window.__worklyPendingRequests++;
                    return originalFetch.apply(this, arguments).finally(function(){
                      window.__worklyPendingRequests = Math.max(0, window.__worklyPendingRequests - 1);
                    });
                  };
                  var originalOpen = XMLHttpRequest.prototype.open;
                  var originalSend = XMLHttpRequest.prototype.send;
                  XMLHttpRequest.prototype.open = function(){
                    this.__worklyTrack = true;
                    return originalOpen.apply(this, arguments);
                  };
                  XMLHttpRequest.prototype.send = function(){
                    if (this.__worklyTrack) {
                      window.__worklyPendingRequests++;
                      var finish = function(){
                        if (!this.__worklyFinished) {
                          this.__worklyFinished = true;
                          window.__worklyPendingRequests = Math.max(0, window.__worklyPendingRequests - 1);
                        }
                      }.bind(this);
                      this.addEventListener('loadend', finish, {once:true});
                      this.addEventListener('error', finish, {once:true});
                      this.addEventListener('abort', finish, {once:true});
                    }
                    return originalSend.apply(this, arguments);
                  };
                  window.dispatchEvent(new Event('workly:native-bridge-ready'));
                })();
                """.trimIndent(),
                setOf("https://worklyindia.devs.surf")
            )
            android.util.Log.i("WorklyWebView", "Native notification marker installed before page scripts")
        } else {
            android.util.Log.w("WorklyWebView", "Document-start script unsupported; using bridge and User-Agent detection")
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                if (Uri.parse(url).host == allowedHost) showLoadingOverlay()
            }

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

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame && request.url.host == allowedHost) {
                    failedUrl = request.url.toString()
                    showOfflinePage()
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (!showingOfflinePage && Uri.parse(url).host == allowedHost) {
                    getSharedPreferences(APP_PREFS, MODE_PRIVATE).edit()
                        .putString(LAST_PAGE_URL, url).apply()
                    // Publish an explicit native marker before React initializes
                    // notification capability checks on the website.
                    webView.evaluateJavascript(
                        "window.__WORKLY_NATIVE_ANDROID__=true;window.dispatchEvent(new Event('workly:native-bridge-ready'))",
                        null
                    )
                    syncWebsiteSession()
                    startWebsiteReadyCheck()
                } else if (showingOfflinePage) {
                    mainHandler.postDelayed({ hideLoadingOverlay() }, 350)
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
        // The native container reserves the status/navigation bar areas exactly once.
        setContentView(root)
        val savedPage = getSharedPreferences(APP_PREFS, MODE_PRIVATE).getString(LAST_PAGE_URL, null)
        val target = intent.getStringExtra("notification_url")
            ?.takeIf { runCatching { Uri.parse(it).let { u -> u.scheme == "https" && u.host == allowedHost } }.getOrDefault(false) }
            ?: intent.data?.takeIf { it.scheme == "https" && it.host == allowedHost }?.toString()
            ?: savedPage
            ?: website
        // Explicit native marker is visible to the website before React starts,
        // including on Android System WebView builds without document-start JS.
        val appTarget = withNativeAppMarker(target)
        failedUrl = appTarget
        if (isNetworkAvailable()) webView.loadUrl(appTarget) else showOfflinePage()
    }

    private fun createLoadingOverlay(): FrameLayout {
        val overlay = FrameLayout(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(10, 20, 43))
            isClickable = true
            isFocusable = true
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
        }
        val logo = ImageView(this).apply {
            setImageResource(R.drawable.ic_workly_launcher_image)
            scaleType = ImageView.ScaleType.FIT_CENTER
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                cornerRadius = 24f * resources.displayMetrics.density
                setColor(android.graphics.Color.WHITE)
            }
            setPadding(18, 18, 18, 18)
        }
        content.addView(logo, LinearLayout.LayoutParams(88.dp(), 88.dp()).apply {
            bottomMargin = 22.dp()
        })
        val title = TextView(this).apply {
            text = "Workly India"
            setTextColor(android.graphics.Color.WHITE)
            textSize = 27f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        content.addView(title, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ))
        val subtitle = TextView(this).apply {
            text = "Getting everything ready for you"
            setTextColor(android.graphics.Color.rgb(190, 203, 225))
            textSize = 14f
            gravity = Gravity.CENTER
        }
        content.addView(subtitle, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = 9.dp() })
        val progress = ProgressBar(this).apply {
            isIndeterminate = true
            indeterminateTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.rgb(96, 165, 250))
        }
        content.addView(progress, LinearLayout.LayoutParams(34.dp(), 34.dp()).apply {
            topMargin = 28.dp()
        })
        overlay.addView(content, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ))
        return overlay
    }

    private fun Int.dp(): Int = (this * resources.displayMetrics.density).toInt()

    private fun showLoadingOverlay() {
        if (!::loadingOverlay.isInitialized) return
        readyCheckRunnable?.let { mainHandler.removeCallbacks(it) }
        loadingStartedAt = System.currentTimeMillis()
        lastReadyFingerprint = ""
        stableReadyChecks = 0
        loadingOverlay.visibility = View.VISIBLE
        loadingOverlay.alpha = 1f
    }

    private fun hideLoadingOverlay() {
        if (!::loadingOverlay.isInitialized || loadingOverlay.visibility != View.VISIBLE) return
        loadingOverlay.animate().alpha(0f).setDuration(220).withEndAction {
            loadingOverlay.visibility = View.GONE
            loadingOverlay.alpha = 1f
        }.start()
    }

    private fun startWebsiteReadyCheck() {
        readyCheckRunnable?.let { mainHandler.removeCallbacks(it) }
        val check = object : Runnable {
            override fun run() {
                if (isFinishing || isDestroyed || showingOfflinePage) return
                webView.evaluateJavascript(
                    """
                    (function(){
                      var body = document.body;
                      var imagesReady = !body || Array.prototype.every.call(body.querySelectorAll('img'), function(img){ return img.complete; });
                      var textLength = body ? (body.innerText || '').trim().length : 0;
                      var height = body ? body.scrollHeight : 0;
                      var rootChildren = document.getElementById('root') ? document.getElementById('root').children.length : 0;
                      return JSON.stringify({
                        complete: document.readyState === 'complete',
                        pending: window.__worklyPendingRequests || 0,
                        imagesReady: imagesReady,
                        textLength: textLength,
                        fingerprint: textLength + ':' + height + ':' + rootChildren
                      });
                    })();
                    """.trimIndent()
                ) { raw ->
                    try {
                        val decoded = org.json.JSONTokener(raw).nextValue() as? String
                        val state = decoded?.let { JSONObject(it) }
                        val elapsed = System.currentTimeMillis() - loadingStartedAt
                        if (state != null) {
                            val ready = state.optBoolean("complete") &&
                                state.optInt("pending", 0) == 0 &&
                                state.optBoolean("imagesReady") &&
                                state.optInt("textLength", 0) > 20
                            val fingerprint = state.optString("fingerprint")
                            if (ready && fingerprint == lastReadyFingerprint) stableReadyChecks++ else stableReadyChecks = 0
                            lastReadyFingerprint = fingerprint
                            if ((ready && stableReadyChecks >= 3 && elapsed >= 1200) ||
                                (elapsed >= 15000 && state.optBoolean("complete") && state.optInt("textLength", 0) > 20)
                            ) {
                                hideLoadingOverlay()
                                return@evaluateJavascript
                            }
                        }
                    } catch (_: Exception) {
                        // Keep the branded screen visible and retry while the page initializes.
                    }
                    if (System.currentTimeMillis() - loadingStartedAt < 18000) {
                        mainHandler.postDelayed(this, 450)
                    } else {
                        hideLoadingOverlay()
                    }
                }
            }
        }
        readyCheckRunnable = check
        mainHandler.postDelayed(check, 250)
    }

    private fun withNativeAppMarker(url: String): String = runCatching {
        val uri = Uri.parse(url)
        if (uri.getQueryParameter("workly_native") == "android") url
        else uri.buildUpon().appendQueryParameter("workly_native", "android").build().toString()
    }.getOrDefault(url)

    private fun isNetworkAvailable(): Boolean {
        val manager = getSystemService(ConnectivityManager::class.java)
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun retryLastPage() {
        val target = failedUrl ?: website
        if (!isNetworkAvailable()) {
            showingOfflinePage = false
            showOfflinePage()
            return
        }
        showingOfflinePage = false
        webView.loadUrl(target)
    }

    private fun showOfflinePage() {
        if (showingOfflinePage) return
        showingOfflinePage = true
        val html = """
            <!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="theme-color" content="#ffffff"><title>Workly India - Offline</title>
            <style>
              *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f7f9fc;color:#172033;
              font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
              main{width:100%;max-width:420px;background:#fff;border:1px solid #e3e8f0;border-radius:22px;
              padding:30px 24px;text-align:center;box-shadow:0 8px 30px rgba(20,40,80,.07)}
              .logo{width:68px;height:68px;border-radius:18px;background:#eff6ff;color:#1457a6;
              display:grid;place-items:center;font-size:30px;font-weight:800;margin:0 auto 18px}
              h1{font-size:24px;margin:0 0 10px}p{color:#64748b;line-height:1.6;margin:0 0 22px}
              button{width:100%;border:0;border-radius:12px;padding:15px;background:#155eef;color:white;
              font-size:16px;font-weight:700}small{display:block;color:#94a3b8;margin-top:18px}
            </style></head><body><main><div class="logo">W</div><h1>You're offline</h1>
            <p>Your internet connection is unavailable. Workly India is open in offline mode.
            Live jobs, messages and account updates will sync when you reconnect.</p>
            <button onclick="window.WorklyAndroid.retryConnection()">Try again</button>
            <small>Workly India · Offline mode</small></main></body></html>
        """.trimIndent()
        webView.loadDataWithBaseURL("https://$allowedHost/", html, "text/html", "UTF-8", null)
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

    inner class WorklyWebBridge {
        @JavascriptInterface
        fun isNativeAndroidApp(): Boolean = true

        @JavascriptInterface
        fun getNotificationPermissionStatus(): String {
            val runtimeGranted = Build.VERSION.SDK_INT < 33 ||
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            if (!runtimeGranted) {
                val askedBefore = getSharedPreferences(NOTIFICATION_PREFS, MODE_PRIVATE)
                    .getBoolean(NOTIFICATION_PERMISSION_ASKED, false)
                return if (askedBefore) "denied" else "default"
            }
            return if (androidx.core.app.NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled()) "granted" else "denied"
        }

        @JavascriptInterface
        fun requestNativeNotifications() {
            runOnUiThread {
                NativePushManager.setOptedIn(this@MainActivity, true)
                val permissionMissing = Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                val askedBefore = getSharedPreferences(NOTIFICATION_PREFS, MODE_PRIVATE)
                    .getBoolean(NOTIFICATION_PERMISSION_ASKED, false)
                val permanentlyDenied = permissionMissing && askedBefore &&
                    !ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS)
                val notificationsDisabled = !androidx.core.app.NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled()

                if (permanentlyDenied || (notificationsDisabled && !permissionMissing)) {
                    openAppNotificationSettings()
                } else if (permissionMissing) {
                    getSharedPreferences(NOTIFICATION_PREFS, MODE_PRIVATE).edit()
                        .putBoolean(NOTIFICATION_PERMISSION_ASKED, true).apply()
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
                } else if (notificationsDisabled) {
                    openAppNotificationSettings()
                } else {
                    registerNativePushAndNotifyJs(getNotificationPermissionStatus() == "granted")
                }
            }
        }

        @JavascriptInterface
        fun unsubscribeNativeNotifications() {
            runOnUiThread {
                val session = NativeAuth.session(this@MainActivity)
                if (session == null) {
                    NativePushManager.setOptedIn(this@MainActivity, false)
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('workly:native-unsubscribe-result',{detail:{success:true}}))",
                        null
                    )
                    return@runOnUiThread
                }
                activityScope.launch(Dispatchers.IO) {
                    val success = NativePushManager.unregister(this@MainActivity, session)
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('workly:native-unsubscribe-result',{detail:{success:$success}}))",
                            null
                        )
                    }
                }
            }
        }

        @JavascriptInterface
        fun retryConnection() {
            runOnUiThread { retryLastPage() }
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
                    if (NativePushManager.isOptedIn(this@MainActivity)) {
                        activityScope.launch(Dispatchers.IO) {
                            NativePushManager.register(this@MainActivity, saved)
                        }
                    }
                } catch (error: Exception) {
                    android.util.Log.w("WorklyWebView", "Website session sync skipped", error)
                }
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS) {
            val granted = Build.VERSION.SDK_INT < 33 ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            registerNativePushAndNotifyJs(granted)
        }
        if (requestCode == REQUEST_MEDIA) {
            val request = pendingWebPermission
            pendingWebPermission = null
            if (request != null) {
                val granted = permissions.indices.all { grantResults.getOrNull(it) == PackageManager.PERMISSION_GRANTED }
                if (granted) request.grant(request.resources) else request.deny()
            }
        }
    }

    private fun openAppNotificationSettings() {
        getSharedPreferences(NOTIFICATION_PREFS, MODE_PRIVATE).edit()
            .putBoolean(NOTIFICATION_SETTINGS_OPENED, true).apply()
        val intent = Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
        }
        runCatching { startActivity(intent) }
    }

    private fun registerNativePushAndNotifyJs(permissionGranted: Boolean) {
        if (!permissionGranted || !androidx.core.app.NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('workly:native-notification-result',{detail:{granted:false,registered:false}}))",
                null
            )
            return
        }
        val appContext = applicationContext
        activityScope.launch(Dispatchers.IO) {
            val session = NativeAuth.session(appContext)
            val registered = session?.let { NativePushManager.register(appContext, it) } ?: false
            runOnUiThread {
                val granted = permissionGranted && androidx.core.app.NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled()
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('workly:native-notification-result',{detail:{granted:$granted,registered:$registered}}))",
                    null
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        if (!connectivityCallbackRegistered) {
            val manager = getSystemService(ConnectivityManager::class.java)
            runCatching {
                manager.registerDefaultNetworkCallback(connectivityCallback)
                connectivityCallbackRegistered = true
            }.onFailure { android.util.Log.w("WorklyWebView", "Network callback unavailable", it) }
        }
    }

    override fun onStop() {
        if (connectivityCallbackRegistered) {
            runCatching {
                getSystemService(ConnectivityManager::class.java).unregisterNetworkCallback(connectivityCallback)
            }
            connectivityCallbackRegistered = false
        }
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        // Returning from Android notification settings should refresh FCM
        // registration automatically once the user has enabled notifications.
        val returnedFromNotificationSettings = getSharedPreferences(NOTIFICATION_PREFS, MODE_PRIVATE)
            .getBoolean(NOTIFICATION_SETTINGS_OPENED, false)
        if (returnedFromNotificationSettings) {
            getSharedPreferences(NOTIFICATION_PREFS, MODE_PRIVATE).edit()
                .putBoolean(NOTIFICATION_SETTINGS_OPENED, false).apply()
            if (::webView.isInitialized && NativePushManager.isOptedIn(this) &&
                getNotificationPermissionStatusForActivity() == "granted"
            ) {
                registerNativePushAndNotifyJs(true)
            }
        }
    }

    private fun getNotificationPermissionStatusForActivity(): String {
        val runtimeGranted = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        return if (runtimeGranted && androidx.core.app.NotificationManagerCompat.from(this).areNotificationsEnabled()) "granted" else "denied"
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
        readyCheckRunnable?.let { mainHandler.removeCallbacks(it) }
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
        private const val APP_PREFS = "workly_app_state"
        private const val LAST_PAGE_URL = "last_page_url"
        private const val NOTIFICATION_PREFS = "workly_notification_permissions"
        private const val NOTIFICATION_PERMISSION_ASKED = "post_notifications_asked"
        private const val NOTIFICATION_SETTINGS_OPENED = "notification_settings_opened"
    }
}
