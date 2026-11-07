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
import androidx.appcompat.app.AlertDialog
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallState
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.appupdate.AppUpdateType
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.cancel
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var rootLayout: FrameLayout
    private lateinit var loadingOverlay: FrameLayout
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingFileChooserCallback: android.webkit.ValueCallback<Array<Uri>>? = null
    private var pendingGeoCallback: android.webkit.GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var offlineOverlay: FrameLayout? = null
    private var reconnectCheckInProgress = false
    private var lastLoadedUrl: String = "https://worklyindia.devs.surf/"
    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val website = "https://worklyindia.devs.surf/"
    private val allowedHost = "worklyindia.devs.surf"
    private lateinit var appUpdateManager: AppUpdateManager
    private var updateDialogVisible = false
    private var updateCheckInProgress = false
    private val appUpdateListener = InstallStateUpdatedListener { state ->
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            runOnUiThread { showUpdateDownloadedDialog() }
        }
    }

    @Deprecated("Android WebView file chooser result callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_APP_UPDATE) {
            if (resultCode != RESULT_OK) {
                android.util.Log.i("WorklyAppUpdate", "In-app update flow was cancelled or failed: $resultCode")
            }
            return
        }
        if (requestCode == REQUEST_FILE_CHOOSER) {
            val callback = pendingFileChooserCallback
            pendingFileChooserCallback = null
            // parseResult preserves both single-file and multi-select ClipData results.
            val results = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            callback?.onReceiveValue(results)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        appUpdateManager = AppUpdateManagerFactory.create(this)
        appUpdateManager.registerListener(appUpdateListener)
        // Let Android lay out the app below the real system status bar.
        // Avoid manual inset padding: it can create a second, visible gap above the website.
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        val startupDarkMode = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        val startupBarColor = if (startupDarkMode) Color.rgb(1, 8, 22) else Color.rgb(247, 249, 251)
        window.statusBarColor = startupBarColor
        window.navigationBarColor = startupBarColor
        if (Build.VERSION.SDK_INT >= 28) window.navigationBarDividerColor = if (startupDarkMode) Color.rgb(35, 43, 58) else Color.rgb(230, 233, 240)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            show(WindowInsetsCompat.Type.statusBars())
            show(WindowInsetsCompat.Type.navigationBars())
            isAppearanceLightStatusBars = !startupDarkMode
            isAppearanceLightNavigationBars = !startupDarkMode
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
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                val uri = Uri.parse(url)
                if (uri.scheme == "https" && uri.host == allowedHost) {
                    lastLoadedUrl = url
                    runOnUiThread { showStartupLoading() }
                }
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

                // Razorpay UPI Intent redirects (upi://, gpay://, phonepe:// and
                // intent://) must leave the WebView and open the installed UPI app.
                if (uri.scheme == "intent") {
                    return try {
                        val intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).apply {
                            addCategory(Intent.CATEGORY_BROWSABLE)
                            component = null
                            selector = null
                        }
                        try {
                            startActivity(intent)
                        } catch (missingApp: android.content.ActivityNotFoundException) {
                            val fallback = intent.getStringExtra("browser_fallback_url")
                            if (!fallback.isNullOrBlank()) {
                                val fallbackUri = Uri.parse(fallback)
                                if (fallbackUri.scheme == "https") startActivity(Intent(Intent.ACTION_VIEW, fallbackUri))
                            }
                        }
                        true
                    } catch (error: Exception) {
                        android.util.Log.w("WorklyPayments", "Could not launch UPI intent", error)
                        true
                    }
                }
                if (uri.scheme == "upi" || uri.scheme == "gpay" || uri.scheme == "phonepe" ||
                    uri.scheme == "paytmmp" || uri.scheme == "tez" || uri.scheme == "bhim" ||
                    uri.scheme == "credpay" || uri.scheme == "amazonpay") {
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        true
                    } catch (error: android.content.ActivityNotFoundException) {
                        android.util.Log.w("WorklyPayments", "No installed app can handle UPI URI: ${uri.scheme}", error)
                        true
                    }
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
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: android.webkit.ValueCallback<Array<Uri>>,
                fileChooserParams: WebChromeClient.FileChooserParams
            ): Boolean {
                // Android's system document picker securely grants access only to
                // the files the user selects; broad storage permissions are not needed.
                pendingFileChooserCallback?.onReceiveValue(null)
                pendingFileChooserCallback = filePathCallback
                // Let WebView construct the picker intent so accept types,
                // camera capture hints and multiple-selection mode are respected.
                val intent = fileChooserParams.createIntent().apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                return try {
                    startActivityForResult(intent, REQUEST_FILE_CHOOSER)
                    true
                } catch (error: Exception) {
                    pendingFileChooserCallback = null
                    filePathCallback.onReceiveValue(null)
                    Toast.makeText(this@MainActivity, "Unable to open file picker.", Toast.LENGTH_LONG).show()
                    true
                }
            }
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
        rootLayout.setBackgroundColor(startupBarColor)
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
        lastLoadedUrl = target
        // Do not start WebView navigation while offline. This prevents a browser
        // error page from appearing behind the branded offline screen.
        if (hasInternetConnection()) {
            webView.loadUrl(target)
        } else {
            showOfflineScreen()
        }
    }

    private fun createStartupLoadingOverlay(): FrameLayout {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val dark = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES

        val backgroundStart = if (dark) Color.rgb(5, 13, 29) else Color.rgb(244, 249, 255)
        val backgroundMiddle = if (dark) Color.rgb(8, 27, 39) else Color.rgb(238, 250, 249)
        val backgroundEnd = if (dark) Color.rgb(20, 14, 38) else Color.rgb(250, 247, 255)
        val cardColor = if (dark) Color.rgb(17, 27, 45) else Color.WHITE
        val logoCardColor = if (dark) Color.rgb(26, 40, 61) else Color.rgb(247, 250, 255)
        val primaryText = if (dark) Color.rgb(239, 245, 255) else Color.rgb(20, 38, 68)
        val secondaryText = if (dark) Color.rgb(177, 193, 214) else Color.rgb(102, 119, 143)
        val mutedText = if (dark) Color.rgb(137, 156, 181) else Color.rgb(139, 153, 173)
        val accentColor = Color.rgb(39, 190, 177)
        val progressTrack = if (dark) Color.rgb(44, 62, 83) else Color.rgb(225, 237, 245)

        fun roundedBackground(color: Int, radius: Int): android.graphics.drawable.GradientDrawable =
            android.graphics.drawable.GradientDrawable().apply {
                setColor(color)
                cornerRadius = dp(radius).toFloat()
            }

        val overlay = FrameLayout(this).apply {
            background = android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
                intArrayOf(backgroundStart, backgroundMiddle, backgroundEnd)
            )
            isClickable = true
            isFocusable = true
        }

        fun addOrb(size: Int, color: Int, gravity: Int, xMargin: Int, yMargin: Int) {
            val orb = android.view.View(this).apply {
                background = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(color)
                }
                alpha = if (dark) 0.20f else 0.42f
            }
            overlay.addView(orb, FrameLayout.LayoutParams(dp(size), dp(size), gravity).apply {
                leftMargin = dp(xMargin)
                rightMargin = dp(xMargin)
                topMargin = dp(yMargin)
                bottomMargin = dp(yMargin)
            })
        }
        addOrb(190, if (dark) Color.rgb(41, 91, 150) else Color.rgb(183, 218, 255), Gravity.TOP or Gravity.END, 0, -55)
        addOrb(150, if (dark) Color.rgb(25, 116, 105) else Color.rgb(175, 239, 226), Gravity.BOTTOM or Gravity.START, 0, -35)
        addOrb(82, if (dark) Color.rgb(91, 65, 139) else Color.rgb(222, 203, 255), Gravity.TOP or Gravity.START, 24, 105)

        // Full-page loading composition: keep the branded background visible
        // edge-to-edge and remove the floating card container.
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(30), dp(34), dp(30), dp(30))
            setBackgroundColor(Color.TRANSPARENT)
        }

        // Reuse the exact installed app launcher artwork, with its square corners
        // clipped into a clean circular mark so no separate tile/card is shown.
        val logo = ImageView(this).apply {
            setImageResource(R.drawable.ic_workly_launcher_image)
            scaleType = ImageView.ScaleType.FIT_CENTER
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL
                setColor(Color.TRANSPARENT)
            }
            clipToOutline = true
            contentDescription = "Workly India app logo"
        }

        val brand = TextView(this).apply {
            text = "Workly India"
            setTextColor(primaryText)
            textSize = 27f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            letterSpacing = 0.01f
        }
        val accent = TextView(this).apply {
            text = "YOUR CAREER. YOUR NEXT CHAPTER."
            setTextColor(accentColor)
            textSize = 10f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            letterSpacing = 0.14f
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = "Preparing your workspace"
            setTextColor(secondaryText)
            textSize = 14f
            gravity = Gravity.CENTER
        }
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
            progressTintList = android.content.res.ColorStateList.valueOf(accentColor)
            indeterminateTintList = android.content.res.ColorStateList.valueOf(accentColor)
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(progressTrack)
        }
        val footer = TextView(this).apply {
            text = "A brighter path to better opportunities"
            setTextColor(mutedText)
            textSize = 11f
            gravity = Gravity.CENTER
        }

        content.addView(logo, LinearLayout.LayoutParams(dp(112), dp(112)).apply {
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
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        android.animation.ObjectAnimator.ofFloat(logo, "scaleX", 1f, 1.045f, 1f).apply {
            duration = 1800
            repeatCount = android.animation.ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
            start()
        }
        android.animation.ObjectAnimator.ofFloat(logo, "scaleY", 1f, 1.045f, 1f).apply {
            duration = 1800
            repeatCount = android.animation.ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
            start()
        }
        return overlay
    }

    private fun showStartupLoading() {
        if (!::loadingOverlay.isInitialized || !::rootLayout.isInitialized) return
        if (loadingOverlay.parent !== rootLayout) return
        loadingOverlay.animate().cancel()
        loadingOverlay.alpha = 1f
        loadingOverlay.visibility = android.view.View.VISIBLE
        loadingOverlay.bringToFront()
    }

    private fun hideStartupLoading() {
        if (!::loadingOverlay.isInitialized || !::rootLayout.isInitialized) return
        if (loadingOverlay.parent == null || loadingOverlay.visibility != android.view.View.VISIBLE) return
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

    private fun hasInternetConnection(): Boolean {
        val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun showOfflineScreen() {
        if (!::rootLayout.isInitialized || offlineOverlay?.parent != null) return
        val dark = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        val backgroundColor = if (dark) Color.rgb(5, 13, 29) else Color.rgb(246, 249, 252)
        val cardColor = if (dark) Color.rgb(17, 27, 45) else Color.WHITE
        val textColor = if (dark) Color.WHITE else Color.rgb(24, 35, 52)
        val mutedColor = if (dark) Color.rgb(180, 193, 210) else Color.rgb(100, 116, 139)
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        // Reuse the same branded gradient and floating-orb background as the
        // startup loading screen so both native states feel like one app.
        val backgroundStart = if (dark) Color.rgb(5, 13, 29) else Color.rgb(244, 249, 255)
        val backgroundMiddle = if (dark) Color.rgb(8, 27, 39) else Color.rgb(238, 250, 249)
        val backgroundEnd = if (dark) Color.rgb(20, 14, 38) else Color.rgb(250, 247, 255)
        val overlay = FrameLayout(this).apply {
            background = android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
                intArrayOf(backgroundStart, backgroundMiddle, backgroundEnd)
            )
            isClickable = true
            isFocusable = true
        }
        fun addOfflineOrb(size: Int, color: Int, gravity: Int, xMargin: Int, yMargin: Int) {
            val orb = android.view.View(this).apply {
                background = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(color)
                }
                alpha = if (dark) 0.20f else 0.42f
            }
            overlay.addView(orb, FrameLayout.LayoutParams(dp(size), dp(size), gravity).apply {
                leftMargin = dp(xMargin)
                rightMargin = dp(xMargin)
                topMargin = dp(yMargin)
                bottomMargin = dp(yMargin)
            })
        }
        addOfflineOrb(190, if (dark) Color.rgb(41, 91, 150) else Color.rgb(183, 218, 255), Gravity.TOP or Gravity.END, 0, -55)
        addOfflineOrb(150, if (dark) Color.rgb(25, 116, 105) else Color.rgb(175, 239, 226), Gravity.BOTTOM or Gravity.START, 0, -35)
        addOfflineOrb(82, if (dark) Color.rgb(91, 65, 139) else Color.rgb(222, 203, 255), Gravity.TOP or Gravity.START, 24, 105)
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(30), dp(30), dp(30), dp(30))
            setBackgroundColor(Color.TRANSPARENT)
        }
        // Play the user's original WiFi Connecting.json animation.
        val offlineAnimation = com.airbnb.lottie.LottieAnimationView(this).apply {
            setAnimation(R.raw.wifi_connecting)
            repeatCount = com.airbnb.lottie.LottieDrawable.INFINITE
            scaleType = android.widget.ImageView.ScaleType.FIT_CENTER
            contentDescription = "Wi-Fi connection animation"
            playAnimation()
        }
        card.addView(offlineAnimation, LinearLayout.LayoutParams(dp(156), dp(156)).apply {
            gravity = Gravity.CENTER
            bottomMargin = dp(18)
        })
        val eyebrow = TextView(this).apply {
            text = "INTERNET CONNECTION"
            textSize = 11f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            letterSpacing = 0.14f
            setTextColor(Color.rgb(22, 163, 122))
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }
        val heading = TextView(this).apply {
            text = "You're offline"
            textSize = 28f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            setTextColor(textColor)
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, dp(10), 0, 0)
        }
        val message = TextView(this).apply {
            text = "No internet connection detected. Turn on mobile data or connect to Wi-Fi, then check again. Wi-Fi without internet will not work."
            textSize = 15f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL)
            setTextColor(mutedColor)
            gravity = Gravity.CENTER
            setLineSpacing(dp(4).toFloat(), 1.05f)
            setPadding(0, dp(14), 0, dp(26))
        }
        val footer = TextView(this).apply {
            text = "Workly India • Your next opportunity awaits"
            textSize = 12f
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL)
            setTextColor(mutedColor)
            gravity = Gravity.CENTER
            setPadding(0, dp(22), 0, 0)
        }
        card.addView(eyebrow)
        card.addView(heading)
        card.addView(message)
        card.addView(footer)
        overlay.addView(card, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        offlineOverlay = overlay
        rootLayout.addView(overlay, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
    }

    private fun hideOfflineScreen() {
        offlineOverlay?.let { overlay ->
            (overlay.parent as? android.view.ViewGroup)?.removeView(overlay)
        }
        offlineOverlay = null
    }

    private fun registerNetworkListener() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) {
                // A network can be connected to Wi-Fi/mobile data without having
                // working internet. Wait for NET_CAPABILITY_VALIDATED below.
                dispatchNativeEvent("workly-native-network-change", "{connected:false}")
            }

            override fun onCapabilitiesChanged(
                network: android.net.Network,
                capabilities: android.net.NetworkCapabilities
            ) {
                val internetReady =
                    capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                dispatchNativeEvent("workly-native-network-change", "{connected:$internetReady}")
                if (internetReady) {
                    dispatchNativeEvent("online")
                    runOnUiThread {
                        val wasOffline = offlineOverlay?.parent != null
                        if (wasOffline && !reconnectCheckInProgress && ::webView.isInitialized) {
                            showStartupLoading()
                            hideOfflineScreen()
                            webView.loadUrl(lastLoadedUrl)
                        }
                    }
                } else {
                    dispatchNativeEvent("offline")
                    runOnUiThread { showOfflineScreen() }
                }
            }

            override fun onLost(network: android.net.Network) {
                if (!hasInternetConnection()) {
                    dispatchNativeEvent("workly-native-network-change", "{connected:false}")
                    dispatchNativeEvent("offline")
                    runOnUiThread { showOfflineScreen() }
                }
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
        fun openExternalUrl(rawUrl: String): Boolean {
            return try {
                val uri = Uri.parse(rawUrl)
                if (uri.scheme != "https" && uri.scheme != "http") return false
                if (uri.host.isNullOrBlank()) return false
                runOnUiThread {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
                    } catch (error: Exception) {
                        android.util.Log.w("WorklyShare", "No app can open share URL", error)
                        Toast.makeText(this@MainActivity, "No app available to open this share link", Toast.LENGTH_SHORT).show()
                    }
                }
                true
            } catch (error: Exception) {
                android.util.Log.w("WorklyShare", "Invalid share URL", error)
                false
            }
        }

        @JavascriptInterface
        fun shareText(title: String, message: String, url: String): Boolean {
            return try {
                val payload = buildString {
                    if (message.isNotBlank()) append(message.trim())
                    if (url.isNotBlank() && !contains(url)) {
                        if (isNotEmpty()) append("\n\n")
                        append(url.trim())
                    }
                }
                if (payload.isBlank()) return false
                // Launch the chooser on Android's UI thread and handle launch
                // failures there (the JavaScript bridge caller runs on a WebView thread).
                runOnUiThread {
                    try {
                        val sendIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, title.take(120))
                            putExtra(Intent.EXTRA_TEXT, payload)
                        }
                        val chooser = Intent.createChooser(
                            sendIntent,
                            title.ifBlank { "Share with" }
                        )
                        startActivity(chooser)
                    } catch (launchError: Exception) {
                        android.util.Log.e("WorklyShare", "Android share chooser launch failed", launchError)
                        Toast.makeText(
                            this@MainActivity,
                            "Unable to open sharing apps. Please try again.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
                true
            } catch (error: Exception) {
                android.util.Log.w("WorklyShare", "Could not open Android share sheet", error)
                false
            }
        }

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
            // Report usable internet, not merely an active Wi-Fi/mobile connection.
            return hasInternetConnection()
        }

        @JavascriptInterface
        fun setStatusBar(color: String, darkIcons: Boolean) {
            runOnUiThread {
                val nightMode = resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK
                val isDark = nightMode == android.content.res.Configuration.UI_MODE_NIGHT_YES
                // Never allow website status-bar styling to turn the clock/network/battery
                // icons dark or blend them into the dark system bar.
                val parsed = if (isDark) Color.rgb(1, 8, 22)
                    else runCatching { Color.parseColor(color) }.getOrDefault(Color.WHITE)
                window.statusBarColor = parsed
                val controller = WindowCompat.getInsetsController(window, window.decorView)
                controller.isAppearanceLightStatusBars = if (isDark) false else darkIcons
                controller.show(WindowInsetsCompat.Type.statusBars())
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
            // Use Android's built-in touch feedback; this does not require VIBRATE permission.
            runOnUiThread {
                webView.performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY)
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
        if (!target.isNullOrBlank()) {
            lastLoadedUrl = target
            if (hasInternetConnection()) {
                hideOfflineScreen()
                webView.loadUrl(target)
            } else {
                showOfflineScreen()
            }
        }
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

    override fun onResume() {
        super.onResume()
        if (::appUpdateManager.isInitialized) checkForPlayStoreUpdate()
    }

    private fun checkForPlayStoreUpdate() {
        if (updateCheckInProgress || updateDialogVisible || isFinishing || isDestroyed) return
        updateCheckInProgress = true
        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                updateCheckInProgress = false
                when {
                    info.installStatus() == InstallStatus.DOWNLOADED -> showUpdateDownloadedDialog()
                    info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> {
                        if (info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                            appUpdateManager.startUpdateFlowForResult(
                                info, this, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                                REQUEST_APP_UPDATE
                            )
                        }
                    }
                    info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                        info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> showUpdateAvailableDialog(info)
                }
            }
            .addOnFailureListener { error ->
                updateCheckInProgress = false
                android.util.Log.w("WorklyAppUpdate", "Could not check Play Store update", error)
            }
    }

    private fun showUpdateAvailableDialog(info: com.google.android.play.core.appupdate.AppUpdateInfo) {
        if (updateDialogVisible || isFinishing || isDestroyed) return
        updateDialogVisible = true
        AlertDialog.Builder(this)
            .setTitle("Update available")
            .setMessage("A new version of Workly India is available. Update now to get the latest improvements and features.")
            .setCancelable(true)
            .setNegativeButton("Later") { dialog, _ ->
                updateDialogVisible = false
                dialog.dismiss()
            }
            .setPositiveButton("Update now") { dialog, _ ->
                updateDialogVisible = false
                dialog.dismiss()
                runCatching {
                    appUpdateManager.startUpdateFlowForResult(
                        info, this,
                        AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
                        REQUEST_APP_UPDATE
                    )
                }.onFailure { error ->
                    android.util.Log.e("WorklyAppUpdate", "Could not start in-app update", error)
                }
            }
            .setOnCancelListener { updateDialogVisible = false }
            .show()
    }

    private fun showUpdateDownloadedDialog() {
        if (updateDialogVisible || isFinishing || isDestroyed) return
        updateDialogVisible = true
        AlertDialog.Builder(this)
            .setTitle("Update ready")
            .setMessage("Workly India has downloaded the update. Restart the app to finish installing it.")
            .setCancelable(false)
            .setPositiveButton("Restart now") { dialog, _ ->
                updateDialogVisible = false
                dialog.dismiss()
                appUpdateManager.completeUpdate()
            }
            .show()
    }

    override fun onDestroy() {
        if (::appUpdateManager.isInitialized) {
            appUpdateManager.unregisterListener(appUpdateListener)
        }
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
        private const val REQUEST_APP_UPDATE = 4104
        private const val REQUEST_NOTIFICATIONS = 701
        private const val REQUEST_FILE_CHOOSER = 4103
        private const val REQUEST_MEDIA = 702
        private const val REQUEST_LOCATION = 703
    }
}
