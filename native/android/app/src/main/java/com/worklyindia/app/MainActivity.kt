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
import android.os.BatteryManager
import android.app.ActivityManager
import android.os.Bundle
import android.provider.MediaStore
import android.util.Base64
import android.view.WindowManager
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.ViewCompat
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.view.Gravity
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
    private lateinit var rootLayout: FrameLayout
    private lateinit var loadingOverlay: FrameLayout
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
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
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

                          // Keep Android system bars and the WebView canvas in sync
                          // with the website's system-following light/dark theme.
                          if (!window.__worklyNativeThemeSyncInstalled) {
                            window.__worklyNativeThemeSyncInstalled = true;
                            var applyNativeTheme = function() {
                              var dark = window.WorklyAndroid && window.WorklyAndroid.isSystemDarkMode
                                ? window.WorklyAndroid.isSystemDarkMode()
                                : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
                              if (window.WorklyAndroid && window.WorklyAndroid.setSystemTheme) {
                                window.WorklyAndroid.setSystemTheme(!!dark);
                              }
                            };
                            applyNativeTheme();
                            if (window.matchMedia) {
                              var themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
                              if (themeQuery.addEventListener) themeQuery.addEventListener('change', applyNativeTheme);
                              else if (themeQuery.addListener) themeQuery.addListener(applyNativeTheme);
                            }
                            new MutationObserver(applyNativeTheme).observe(
                              document.documentElement, { attributes: true, attributeFilter: ['class'] }
                            );
                          }

                          // Do not rely only on the React hook to dismiss the native
                          // splash: a failed/slow auth request or an older cached bundle
                          // must never leave the user staring at the splash forever.
                          if (!window.__worklyNativeSplashWatcherInstalled) {
                            window.__worklyNativeSplashWatcherInstalled = true;
                            var splashStartedAt = Date.now();
                            var splashReadySince = 0;
                            var splashWatcher = setInterval(function() {
                              var root = document.getElementById('root');
                              var hasRenderedApp = !!(root && root.firstElementChild &&
                                (root.innerText || '').trim().length > 0);
                              var pageReady = document.readyState === 'complete';
                              if (pageReady && hasRenderedApp) {
                                if (!splashReadySince) splashReadySince = Date.now();
                                if (Date.now() - splashReadySince >= 900) {
                                  clearInterval(splashWatcher);
                                  if (window.WorklyAndroid && window.WorklyAndroid.onWebsiteReady) {
                                    window.WorklyAndroid.onWebsiteReady();
                                  }
                                }
                              } else {
                                splashReadySince = 0;
                              }
                              // Absolute safety fallback: show the page/error state
                              // rather than trapping the user on the startup overlay.
                              if (Date.now() - splashStartedAt >= 20000) {
                                clearInterval(splashWatcher);
                                if (window.WorklyAndroid && window.WorklyAndroid.onWebsiteReady) {
                                  window.WorklyAndroid.onWebsiteReady();
                                }
                              }
                            }, 200);
                          }

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
                    callback.invoke(origin, true, true)
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
                Toast.makeText(this@MainActivity, "Download failed. Please try again.", Toast.LENGTH_LONG).show()
            }
        }

        // Android 15 enforces edge-to-edge for targetSdk 35. Apply system-bar
        // insets exactly once to the root container so the WebView starts directly
        // below the status bar and ends above the navigation bar.
        rootLayout = FrameLayout(this)
        rootLayout.setBackgroundColor(Color.WHITE)
        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        rootLayout.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        loadingOverlay = createStartupLoadingOverlay()
        rootLayout.addView(loadingOverlay, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        setContentView(rootLayout)
        ViewCompat.requestApplyInsets(rootLayout)
        registerNetworkListener()
        val target = intent.getStringExtra("notification_url")
            ?.takeIf { runCatching { Uri.parse(it).let { u -> u.scheme == "https" && u.host == allowedHost } }.getOrDefault(false) }
            ?: intent.data?.takeIf { it.scheme == "https" && it.host == allowedHost }?.toString()
            ?: website
        webView.loadUrl(target)
        // Native failsafe independent of JavaScript/React bridge callbacks.
        // Never keep the splash over the website indefinitely on a slow device.
        rootLayout.postDelayed({ hideStartupLoading() }, 25000)
    }

    private fun createStartupLoadingOverlay(): FrameLayout {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        fun roundedBackground(color: Int, radius: Int): android.graphics.drawable.GradientDrawable =
            android.graphics.drawable.GradientDrawable().apply {
                setColor(color)
                cornerRadius = dp(radius).toFloat()
            }

        val overlay = FrameLayout(this).apply {
            // The startup screen is intentionally light, independent of the
            // phone's dark-mode setting. The website switches theme after load.
            background = android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.rgb(244, 249, 255), Color.rgb(238, 250, 249), Color.rgb(250, 247, 255))
            )
            isClickable = true
            isFocusable = true
        }

        // Soft decorative colour orbs add depth without distracting from the logo.
        fun addOrb(size: Int, color: Int, gravity: Int, xMargin: Int, yMargin: Int) {
            val orb = android.view.View(this).apply {
                background = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(color)
                }
                alpha = 0.42f
            }
            overlay.addView(orb, FrameLayout.LayoutParams(dp(size), dp(size), gravity).apply {
                leftMargin = dp(xMargin)
                rightMargin = dp(xMargin)
                topMargin = dp(yMargin)
                bottomMargin = dp(yMargin)
            })
        }
        addOrb(190, Color.rgb(183, 218, 255), Gravity.TOP or Gravity.END, 0, -55)
        addOrb(150, Color.rgb(175, 239, 226), Gravity.BOTTOM or Gravity.START, 0, -35)
        addOrb(82, Color.rgb(222, 203, 255), Gravity.TOP or Gravity.START, 24, 105)

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(34), dp(28), dp(30))
            background = roundedBackground(Color.WHITE, 30)
            elevation = dp(12).toFloat()
        }

        val logoCard = FrameLayout(this).apply {
            background = roundedBackground(Color.rgb(247, 250, 255), 26)
            elevation = dp(5).toFloat()
        }
        val logo = ImageView(this).apply {
            setImageResource(R.drawable.ic_workly_launcher_image)
            scaleType = ImageView.ScaleType.FIT_CENTER
            contentDescription = "Workly India app logo"
            setPadding(dp(10), dp(10), dp(10), dp(10))
        }
        logoCard.addView(logo, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        val brand = TextView(this).apply {
            text = "Workly India"
            setTextColor(Color.rgb(20, 38, 68))
            textSize = 27f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            letterSpacing = 0.01f
        }
        val accent = TextView(this).apply {
            text = "YOUR CAREER. YOUR NEXT CHAPTER."
            setTextColor(Color.rgb(22, 153, 151))
            textSize = 10f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            letterSpacing = 0.14f
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = "Preparing your workspace"
            setTextColor(Color.rgb(102, 119, 143))
            textSize = 14f
            gravity = Gravity.CENTER
        }
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
            progressTintList = android.content.res.ColorStateList.valueOf(Color.rgb(30, 177, 164))
            indeterminateTintList = android.content.res.ColorStateList.valueOf(Color.rgb(30, 177, 164))
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.rgb(225, 237, 245))
        }
        val footer = TextView(this).apply {
            text = "A brighter path to better opportunities"
            setTextColor(Color.rgb(139, 153, 173))
            textSize = 11f
            gravity = Gravity.CENTER
        }

        content.addView(logoCard, LinearLayout.LayoutParams(dp(112), dp(112)).apply {
            bottomMargin = dp(22)
        })
        content.addView(brand, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(7) })
        content.addView(accent, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(22) })
        content.addView(subtitle, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(14) })
        content.addView(progress, LinearLayout.LayoutParams(dp(172), dp(4)).apply {
            bottomMargin = dp(22)
        })
        content.addView(footer, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        overlay.addView(content, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        ).apply {
            leftMargin = dp(28)
            rightMargin = dp(28)
        })

        // Gentle breathing animation keeps the startup screen feeling alive.
        android.animation.ObjectAnimator.ofFloat(logoCard, "scaleX", 1f, 1.045f, 1f).apply {
            duration = 1800
            repeatCount = android.animation.ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
            start()
        }
        android.animation.ObjectAnimator.ofFloat(logoCard, "scaleY", 1f, 1.045f, 1f).apply {
            duration = 1800
            repeatCount = android.animation.ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
            start()
        }
        return overlay
    }

    private fun hideStartupLoading() {
        if (!::loadingOverlay.isInitialized || !::rootLayout.isInitialized) return
        if (loadingOverlay.parent == null) return
        loadingOverlay.animate().alpha(0f).setDuration(220).withEndAction {
            loadingOverlay.visibility = android.view.View.GONE
            loadingOverlay.alpha = 1f
        }.start()
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
        fun getNativeDeviceInfo(): String {
            return runCatching {
                val metrics = resources.displayMetrics
                val memory = ActivityManager.MemoryInfo().also {
                    (getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(it)
                }
                val batteryManager = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
                val batteryLevel = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                val appInfo = packageManager.getPackageInfo(packageName, 0)
                @Suppress("DEPRECATION")
                val appVersionCode = if (Build.VERSION.SDK_INT >= 28) appInfo.longVersionCode else appInfo.versionCode.toLong()
                JSONObject()
                    .put("manufacturer", Build.MANUFACTURER.orEmpty().ifBlank { "Unknown" })
                    .put("brand", Build.BRAND.orEmpty().ifBlank { "Unknown" })
                    .put("model", Build.MODEL.orEmpty().ifBlank { "Unknown" })
                    .put("device", Build.DEVICE.orEmpty().ifBlank { "Unknown" })
                    .put("product", Build.PRODUCT.orEmpty().ifBlank { "Unknown" })
                    .put("hardware", Build.HARDWARE.orEmpty().ifBlank { "Unknown" })
                    .put("androidVersion", Build.VERSION.RELEASE.orEmpty().ifBlank { "Unknown" })
                    .put("apiLevel", Build.VERSION.SDK_INT)
                    .put("securityPatch", if (Build.VERSION.SDK_INT >= 23) Build.VERSION.SECURITY_PATCH else "N/A")
                    .put("supportedAbis", Build.SUPPORTED_ABIS.joinToString(", ").ifBlank { "Unknown" })
                    .put("totalRamGb", String.format(java.util.Locale.US, "%.1f GB", memory.totalMem / (1024.0 * 1024.0 * 1024.0)))
                    .put("screenPixels", "${metrics.widthPixels} × ${metrics.heightPixels}")
                    .put("screenDensityDpi", metrics.densityDpi)
                    .put("batteryPercent", if (batteryLevel in 0..100) batteryLevel else JSONObject.NULL)
                    .put("appVersion", appInfo.versionName ?: "Unknown")
                    .put("appVersionCode", appVersionCode)
                    .put("locale", resources.configuration.locales[0].toLanguageTag())
                    .toString()
            }.getOrElse { error ->
                android.util.Log.e("WorklyDeviceInfo", "Could not collect native device details", error)
                JSONObject().put("error", "native_device_info_unavailable").toString()
            }
        }

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
        fun isSystemDarkMode(): Boolean {
            val nightMode = resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK
            return nightMode == android.content.res.Configuration.UI_MODE_NIGHT_YES
        }

        @JavascriptInterface
        fun setSystemTheme(dark: Boolean) {
            runOnUiThread {
                val barColor = if (dark) Color.rgb(1, 8, 22) else Color.rgb(247, 249, 251)
                window.statusBarColor = barColor
                window.navigationBarColor = barColor
                if (Build.VERSION.SDK_INT >= 28) {
                    window.navigationBarDividerColor = if (dark) Color.rgb(35, 43, 58) else Color.rgb(230, 233, 240)
                }
                WindowCompat.getInsetsController(window, window.decorView).apply {
                    isAppearanceLightStatusBars = !dark
                    isAppearanceLightNavigationBars = !dark
                }
                if (::webView.isInitialized) webView.setBackgroundColor(barColor)
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
        fun onWebsiteReady() {
            runOnUiThread { hideStartupLoading() }
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

        // Keep the no-argument bridge for older website bundles.
        @JavascriptInterface
        fun registerPushNotifications() {
            runOnUiThread {
                val session = NativeAuth.session(this@MainActivity)
                if (session == null) dispatchPushRegistrationResult(false, "session_unavailable")
                else startNativePushRegistration(session)
            }
        }

        // Receive the current Supabase session in the same bridge call as registration.
        @JavascriptInterface
        fun registerPushNotificationsWithSession(rawSession: String) {
            runOnUiThread {
                try {
                    val sessionJson = JSONObject(rawSession)
                    val user = sessionJson.getJSONObject("user")
                    val metadata = user.optJSONObject("user_metadata") ?: JSONObject()
                    val role = metadata.optString(
                        "user_type",
                        metadata.optString("account_type", metadata.optString("role", "jobseeker"))
                    )
                    val session = NativeAuth.saveWebSession(
                        this@MainActivity,
                        sessionJson.getString("access_token"),
                        sessionJson.getString("refresh_token"),
                        user.getString("id"),
                        user.optString("email"),
                        if (role.equals("employer", true)) "employer" else "jobseeker"
                    )
                    startNativePushRegistration(session)
                } catch (error: Exception) {
                    android.util.Log.e("WorklyPush", "Could not read current website session", error)
                    dispatchPushRegistrationResult(false, "session_unavailable")
                }
            }
        }

        // Preferred path: pass the Firebase config fetched by the authenticated
        // website session, rather than relying on an unauthenticated native fetch.
        @JavascriptInterface
        fun registerPushNotificationsWithSessionAndConfig(rawSession: String, rawFirebaseConfig: String) {
            runOnUiThread {
                try {
                    val sessionJson = JSONObject(rawSession)
                    val user = sessionJson.getJSONObject("user")
                    val metadata = user.optJSONObject("user_metadata") ?: JSONObject()
                    val role = metadata.optString(
                        "user_type",
                        metadata.optString("account_type", metadata.optString("role", "jobseeker"))
                    )
                    val session = NativeAuth.saveWebSession(
                        this@MainActivity,
                        sessionJson.getString("access_token"),
                        sessionJson.getString("refresh_token"),
                        user.getString("id"),
                        user.optString("email"),
                        if (role.equals("employer", true)) "employer" else "jobseeker"
                    )
                    val firebaseConfig = JSONObject(rawFirebaseConfig)
                    startNativePushRegistration(session, firebaseConfig)
                } catch (error: Exception) {
                    android.util.Log.e("WorklyPush", "Could not read website session/Firebase config", error)
                    dispatchPushRegistrationResult(false, "session_or_config_unavailable")
                }
            }
        }

        private fun startNativePushRegistration(session: NativeSession, firebaseConfig: JSONObject? = null) {
            if (!hasNotificationPermission()) {
                dispatchPushRegistrationResult(false, "permission_denied")
                return
            }
            activityScope.launch(Dispatchers.IO) {
                val success = NativePushManager.register(this@MainActivity, session, firebaseConfig)
                runOnUiThread {
                    dispatchPushRegistrationResult(success, if (success) "registered" else "fcm_or_database_error")
                }
            }
        }

        private fun dispatchPushRegistrationResult(success: Boolean, reason: String) {
            val safeReason = reason.replace(Regex("[^a-zA-Z0-9_-]"), "")
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('workly-native-push-registration-complete', {detail:{success:" + success + ",reason:'" + safeReason + "'}}));",
                null
            )
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
                    Toast.makeText(this@MainActivity, "File saved in Downloads: $safeName", Toast.LENGTH_LONG).show()
                }
                true
            } catch (error: Exception) {
                insertedUri?.let { runCatching { contentResolver.delete(it, null, null) } }
                android.util.Log.e("WorklyDownload", "Could not save generated website file", error)
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Download failed. Please try again.", Toast.LENGTH_LONG).show()
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
            if (origin != null && callback != null) callback.invoke(origin, granted, true)
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
