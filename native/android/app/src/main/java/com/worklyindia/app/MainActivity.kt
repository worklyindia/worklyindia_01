package com.worklyindia.app

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
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
import android.app.AlertDialog
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import android.app.PictureInPictureParams
import android.util.Rational
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallState
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.install.model.AppUpdateType
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
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : FragmentActivity() {
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
    // The branded startup cover is for the first app launch only. Showing it
    // on every same-origin document navigation makes the app feel like a slow website.
    private var initialWebsiteLoadCompleted = false
    private var lastLoadedUrl: String = "https://worklyindia.devs.surf/"
    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val website = "https://worklyindia.devs.surf/"
    private val allowedHost = "worklyindia.devs.surf"
    private lateinit var appUpdateManager: AppUpdateManager
    private var updateDialogVisible = false
    private var updateCheckInProgress = false
    private var websiteUpdateCheckInProgress = false
    private var websiteUpdateDialogVisible = false
    private var pendingWebsiteInstallUri: Uri? = null
    private var websiteDownloadId: Long = -1L
    private var websiteDownloadRelease: JSONObject? = null
    private var websiteDownloadDialog: android.app.Dialog? = null
    private var websiteInstallDialogVisible = false
    private var biometricAuthenticatedForForeground = false
    private var biometricPromptShowing = false
    // Avoid repeating native token registration on every WebView navigation.
    private var autoPushRegistrationUserId: String? = null
    private var pendingNativePushSession: NativeSession? = null
    private var pendingNativePushFirebaseConfig: JSONObject? = null
    private var pendingAutoPushRegistrationSession: NativeSession? = null
    private var waitingForWebsiteInstallPermission = false
    private val websiteUpdatePrefs by lazy { getSharedPreferences("workly_android_update", Context.MODE_PRIVATE) }
    private var websiteDownloadProgressBar: ProgressBar? = null
    private var websiteDownloadProgressLabel: TextView? = null
    private val isPlayStoreInstall: Boolean by lazy {
        runCatching {
            val installer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                packageManager.getInstallSourceInfo(packageName).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                packageManager.getInstallerPackageName(packageName)
            }
            installer == "com.android.vending"
        }.getOrDefault(false)
    }
    private val websiteDownloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
            val completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
            if (completedId != websiteDownloadId) return
            val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val query = DownloadManager.Query().setFilterById(completedId)
            manager.query(query).use { cursor ->
                if (!cursor.moveToFirst()) return
                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    val uri = manager.getUriForDownloadedFile(completedId)
                    if (uri != null) {
                        pendingWebsiteInstallUri = uri
                        persistPendingWebsiteInstall(uri, websiteDownloadRelease)
                        websiteDownloadId = -1L
                        websiteUpdatePrefs.edit().remove("active_download_id").apply()
                        runOnUiThread {
                            websiteDownloadDialog?.dismiss()
                            websiteDownloadDialog = null
                            showWebsiteInstallReadyDialog(websiteDownloadRelease)
                        }
                    } else {
                        runOnUiThread { Toast.makeText(this@MainActivity, "Update download could not be opened. Please try again.", Toast.LENGTH_LONG).show() }
                    }
                } else {
                    val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                    android.util.Log.e("WorklyAppUpdate", "Website APK download failed: $reason")
                    websiteDownloadId = -1L
                    runOnUiThread {
                        websiteDownloadDialog?.dismiss()
                        websiteDownloadDialog = null
                        Toast.makeText(this@MainActivity, "Update download failed. Please try again.", Toast.LENGTH_LONG).show()
                        checkForWebsiteRelease()
                    }
                }
            }
        }
    }
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
        restorePendingWebsiteInstall()
        ContextCompat.registerReceiver(
            this, websiteDownloadReceiver,
            android.content.IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED
        )
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
        // Keep the visible WebView renderer at foreground importance to reduce
        // renderer eviction while users navigate the app. Allow Android to
        // lower its priority when the WebView is not visible.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, true)
        }
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
                    if (!initialWebsiteLoadCompleted) {
                        runOnUiThread { showStartupLoading() }
                    }
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

private fun completeNativePushPermissionFlow(granted: Boolean) {
    val session = pendingNativePushSession
    val firebaseConfig = pendingNativePushFirebaseConfig
    pendingNativePushSession = null
    pendingNativePushFirebaseConfig = null
    if (!granted || session == null || firebaseConfig == null) {
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('workly:native-notification-result', {detail:{granted:" + granted + ",registered:false}}));",
            null
        )
        return
    }
    activityScope.launch(Dispatchers.IO) {
        val registered = NativePushManager.register(this@MainActivity, session, firebaseConfig)
        runOnUiThread {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('workly:native-notification-result', {detail:{granted:true,registered:" + registered + "}}));",
                null
            )
        }
    }
}


    private fun registerSignedInAndroidPush(session: NativeSession) {
        if (autoPushRegistrationUserId == session.userId) return
        autoPushRegistrationUserId = session.userId
        activityScope.launch(Dispatchers.IO) {
            val registered = NativePushManager.register(this@MainActivity, session)
            if (!registered) {
                autoPushRegistrationUserId = null
                android.util.Log.w("WorklyPush", "Automatic Android push registration failed for signed-in user")
            }
        }
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
        if (networkCallback != null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
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
                if (internetReady && ::webView.isInitialized) {
                    WorklyForegroundNetworkAlerts.onBandwidthChanged(
                        this@MainActivity,
                        capabilities.linkDownstreamBandwidthKbps,
                        capabilities.linkUpstreamBandwidthKbps
                    )
                }
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

    private fun biometricPreferences() = getSharedPreferences("workly_app_security", Context.MODE_PRIVATE)

    private fun isBiometricLockEnabled(): Boolean = biometricPreferences().getBoolean("biometric_lock_enabled", false)

    private fun showBiometricLockPrompt(isSetup: Boolean) {
        if (biometricPromptShowing || isFinishing || isDestroyed) return
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if (BiometricManager.from(this).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
            if (isSetup) biometricPreferences().edit().putBoolean("biometric_lock_enabled", false).apply()
            Toast.makeText(this, "Set up a screen lock or fingerprint/face unlock in Android settings first.", Toast.LENGTH_LONG).show()
            return
        }
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                biometricPromptShowing = false
                biometricAuthenticatedForForeground = true
                if (isSetup) Toast.makeText(this@MainActivity, "App lock enabled.", Toast.LENGTH_SHORT).show()
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                biometricPromptShowing = false
                if (isSetup) biometricPreferences().edit().putBoolean("biometric_lock_enabled", false).apply()
                else finish()
            }
        })
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock Workly India")
            .setSubtitle("Confirm your identity to continue")
            .setAllowedAuthenticators(authenticators)
            .build()
        biometricPromptShowing = true
        prompt.authenticate(promptInfo)
    }

    inner class WorklyWebBridge {
        @JavascriptInterface
        fun isBiometricLockEnabled(): Boolean = this@MainActivity.isBiometricLockEnabled()

        @JavascriptInterface
        fun setBiometricLockEnabled(enabled: Boolean): Boolean {
            if (enabled) {
                val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
                if (BiometricManager.from(this@MainActivity).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) return false
                biometricPreferences().edit().putBoolean("biometric_lock_enabled", true).apply()
                runOnUiThread { showBiometricLockPrompt(true) }
            } else {
                biometricPreferences().edit().putBoolean("biometric_lock_enabled", false).apply()
                biometricAuthenticatedForForeground = true
            }
            return true
        }
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
            runOnUiThread {
                initialWebsiteLoadCompleted = true
                hideStartupLoading()
            }
        }

        @JavascriptInterface
        fun isNotificationPermissionGranted(): Boolean = hasNotificationPermission()

        @JavascriptInterface
        fun requestNativeNotifications(rawSession: String, rawFirebaseConfig: String) {
            runOnUiThread {
                try {
                    val sessionJson = JSONObject(rawSession)
                    val user = sessionJson.getJSONObject("user")
                    val metadata = user.optJSONObject("user_metadata") ?: JSONObject()
                    val role = metadata.optString("user_type", metadata.optString("account_type", metadata.optString("role", "jobseeker")))
                    pendingNativePushSession = NativeAuth.saveWebSession(
                        this@MainActivity,
                        sessionJson.getString("access_token"),
                        sessionJson.getString("refresh_token"),
                        user.getString("id"),
                        user.optString("email"),
                        if (role.equals("employer", true)) "employer" else "jobseeker"
                    )
                    pendingNativePushFirebaseConfig = JSONObject(rawFirebaseConfig)
                    if (Build.VERSION.SDK_INT >= 33 &&
                        ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    ) {
                        ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
                    } else {
                        completeNativePushPermissionFlow(hasNotificationPermission())
                    }
                } catch (error: Exception) {
                    android.util.Log.e("WorklyPush", "Could not start native notification setup", error)
                    completeNativePushPermissionFlow(false)
                }
            }
        }


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
                autoPushRegistrationUserId = null
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
                    // Permission already granted means this device has opted in.
                    // Register its native FCM token automatically after login so
                    // owner-published Android releases can reach existing app users
                    // without requiring them to open the notification settings page.
                    if (hasNotificationPermission() && autoPushRegistrationUserId != saved.userId) {
                        registerSignedInAndroidPush(saved)
                    } else if (
                        Build.VERSION.SDK_INT >= 33 &&
                        ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    ) {
                        val promptKey = "notification_permission_prompted_${saved.userId}"
                        val prefs = getSharedPreferences("workly_android_push", Context.MODE_PRIVATE)
                        if (!prefs.getBoolean(promptKey, false)) {
                            prefs.edit().putBoolean(promptKey, true).apply()
                            pendingAutoPushRegistrationSession = saved
                            ActivityCompat.requestPermissions(
                                this@MainActivity,
                                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                                REQUEST_NOTIFICATIONS
                            )
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
            if (pendingNativePushSession != null) {
                completeNativePushPermissionFlow(granted)
            } else {
                val autoSession = pendingAutoPushRegistrationSession
                pendingAutoPushRegistrationSession = null
                if (granted && autoSession != null) {
                    registerSignedInAndroidPush(autoSession)
                } else {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('workly-native-notification-permission', {detail:{granted:$granted}}));",
                        null
                    )
                }
            }
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
        registerNetworkListener()
        if (isBiometricLockEnabled() && !biometricAuthenticatedForForeground) showBiometricLockPrompt(false)
        if (::webView.isInitialized) syncWebsiteSession()
        if (pendingWebsiteInstallUri != null) {
            val targetCode = websiteDownloadRelease?.optInt("version_code", 0)?.toLong() ?: 0L
            if (targetCode > 0L && getInstalledAppVersionCode() >= targetCode) {
                clearPendingWebsiteInstall()
            } else if (waitingForWebsiteInstallPermission &&
                (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls())) {
                waitingForWebsiteInstallPermission = false
                websiteUpdatePrefs.edit().putBoolean("waiting_permission", false).apply()
                continueWebsiteInstallIfAllowed()
            } else if (waitingForWebsiteInstallPermission) {
                showWebsiteInstallPermissionDialog()
            } else {
                showWebsiteInstallReadyDialog(websiteDownloadRelease)
            }
        } else if (::appUpdateManager.isInitialized) {
            if (isPlayStoreInstall) checkForPlayStoreUpdate() else checkForWebsiteRelease()
        }
    }

    override fun onPause() {
        // Stop network-quality tracking immediately when Workly India is no longer visible.
        networkCallback?.let { callback ->
            runCatching {
                (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager)
                    .unregisterNetworkCallback(callback)
            }
        }
        networkCallback = null
        super.onPause()
    }

    // Direct APK installs are updated from the public Workly release feed.
    // Play Store installs are deliberately kept on Google's official Play Core flow.
    @Suppress("DEPRECATION")
    private fun getInstalledAppVersionCode(): Long {
        return runCatching {
            val info = packageManager.getPackageInfo(packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
        }.getOrDefault(BuildConfig.VERSION_CODE.toLong())
    }

    private fun checkForWebsiteRelease() {
        if (websiteUpdateCheckInProgress || websiteUpdateDialogVisible || isFinishing || isDestroyed) return
        websiteUpdateCheckInProgress = true
        activityScope.launch(Dispatchers.IO) {
            var release: JSONObject? = null
            try {
                val endpoint = URL(
                    "https://jubwzelupbntbetpajqb.supabase.co/rest/v1/android_app_releases" +
                        "?select=id,version_code,version_name,apk_path,release_notes,min_supported_version_code" +
                        "&is_published=eq.true&order=version_code.desc&limit=1"
                )
                val connection = (endpoint.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 12000
                    readTimeout = 12000
                    setRequestProperty("apikey", "sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o")
                    setRequestProperty("Authorization", "Bearer sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o")
                    setRequestProperty("Accept", "application/json")
                }
                try {
                    if (connection.responseCode in 200..299) {
                        val body = connection.inputStream.bufferedReader().use { it.readText() }
                        val rows = org.json.JSONArray(body)
                        if (rows.length() > 0) release = rows.getJSONObject(0)
                    } else {
                        android.util.Log.w("WorklyAppUpdate", "Release feed HTTP " + connection.responseCode)
                    }
                } finally { connection.disconnect() }
            } catch (error: Exception) {
                android.util.Log.w("WorklyAppUpdate", "Could not check website APK release feed", error)
            }
            runOnUiThread {
                websiteUpdateCheckInProgress = false
                val latest = release ?: return@runOnUiThread
                val latestCode = latest.optInt("version_code", 0)
                if (latestCode.toLong() <= getInstalledAppVersionCode()) return@runOnUiThread
                val pendingCode = websiteDownloadRelease?.optInt("version_code", 0)
                    ?: websiteUpdatePrefs.getString("pending_release", null)
                        ?.let { runCatching { JSONObject(it).optInt("version_code", 0) }.getOrDefault(0) }
                    ?: 0
                if (pendingCode in 1 until latestCode) {
                    discardOlderWebsiteUpdate(latestCode)
                }
                if (websiteDownloadId == -1L && pendingWebsiteInstallUri == null) {
                    showWebsiteUpdateDialog(latest)
                }
            }
        }
    }

    private fun showWebsiteUpdateDialog(release: JSONObject) {
        if (websiteUpdateDialogVisible || isFinishing || isDestroyed) return
        val versionCode = release.optInt("version_code", 0)
        val versionName = release.optString("version_name", "New version")
        val notes = release.optString("release_notes", "").trim()
        val mandatory = getInstalledAppVersionCode() < release.optInt("min_supported_version_code", 1).toLong()
        val snoozeKey = "update_later_until_$versionCode"
        val snoozedUntil = websiteUpdatePrefs.getLong(snoozeKey, 0L)
        if (!mandatory && System.currentTimeMillis() < snoozedUntil) return
        websiteUpdateDialogVisible = true
        val content = buildWebsiteUpdateCard(
            versionName,
            if (mandatory) "Important update required" else "A new version is available",
            notes,
            showProgress = false
        )
        showWebsiteUpdateBottomSheet(
            content = content,
            primaryLabel = "Download update",
            secondaryLabel = if (mandatory) null else "Later",
            onPrimary = { downloadWebsiteUpdate(release) },
            onSecondary = {
                websiteUpdatePrefs.edit()
                    .putLong(snoozeKey, System.currentTimeMillis() + 24L * 60L * 60L * 1000L)
                    .apply()
            },
            onDismiss = { websiteUpdateDialogVisible = false }
        )
    }

    private fun buildWebsiteUpdateCard(
        versionName: String,
        subtitle: String,
        notes: String,
        showProgress: Boolean
    ): LinearLayout {
        val density = resources.displayMetrics.density
        fun px(value: Int) = (value * density).toInt()
        val dark = isNativeDarkTheme()
        val surface = if (dark) Color.rgb(17, 27, 45) else Color.WHITE
        val primaryText = if (dark) Color.rgb(244, 247, 252) else Color.rgb(25, 35, 48)
        val secondaryText = if (dark) Color.rgb(190, 202, 219) else Color.rgb(100, 110, 122)
        val mutedText = if (dark) Color.rgb(169, 183, 202) else Color.rgb(75, 85, 98)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(px(24), px(24), px(24), px(16))
            gravity = Gravity.CENTER_HORIZONTAL
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(surface)
                cornerRadius = px(24).toFloat()
                setStroke(px(1), if (dark) Color.rgb(49, 66, 88) else Color.rgb(229, 235, 242))
            }
        }
        val updateBadge = TextView(this).apply {
            text = "✦  WORKLY INDIA UPDATE"
            textSize = 10f
            letterSpacing = 0.08f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(if (dark) Color.rgb(111, 239, 205) else Color.rgb(13, 128, 100))
            gravity = Gravity.CENTER
            setPadding(px(12), px(7), px(12), px(7))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(if (dark) Color.rgb(25, 66, 66) else Color.rgb(226, 248, 241))
                cornerRadius = px(30).toFloat()
            }
        }
        container.addView(updateBadge, LinearLayout.LayoutParams(-2, -2).apply {
            bottomMargin = px(14)
        })
        val appIcon = ImageView(this).apply {
            setImageResource(R.mipmap.ic_launcher)
            scaleType = ImageView.ScaleType.FIT_CENTER
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(if (dark) Color.rgb(30, 44, 63) else Color.rgb(241, 247, 250))
                cornerRadius = px(20).toFloat()
            }
            setPadding(px(7), px(7), px(7), px(7))
        }
        container.addView(appIcon, LinearLayout.LayoutParams(px(68), px(68)).apply {
            bottomMargin = px(14)
        })
        container.addView(TextView(this).apply {
            text = "Workly India"
            textSize = 21f
            setTextColor(primaryText)
            gravity = Gravity.CENTER
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(-1, -2))
        container.addView(TextView(this).apply {
            text = "Version $versionName"
            textSize = 13f
            setTextColor(secondaryText)
            gravity = Gravity.CENTER
            setPadding(0, px(4), 0, px(8))
        }, LinearLayout.LayoutParams(-1, -2))
        container.addView(TextView(this).apply {
            text = subtitle
            textSize = 15f
            setTextColor(primaryText)
            gravity = Gravity.CENTER
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, px(4), 0, px(8))
        }, LinearLayout.LayoutParams(-1, -2))
        if (notes.isNotBlank() && !showProgress) {
            val whatsNew = TextView(this).apply {
                text = "WHAT'S NEW\n$notes"
                textSize = 13f
                setTextColor(mutedText)
                setLineSpacing(px(3).toFloat(), 1f)
                setPadding(0, px(8), 0, px(12))
            }
            container.addView(whatsNew, LinearLayout.LayoutParams(-1, -2))
        }
        if (showProgress) {
            websiteDownloadProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
                isIndeterminate = true
                max = 100
            }
            container.addView(websiteDownloadProgressBar, LinearLayout.LayoutParams(-1, px(8)).apply {
                topMargin = px(8)
                bottomMargin = px(8)
            })
            websiteDownloadProgressLabel = TextView(this).apply {
                text = "Preparing download…"
                textSize = 13f
                setTextColor(mutedText)
                gravity = Gravity.CENTER
            }
            container.addView(websiteDownloadProgressLabel, LinearLayout.LayoutParams(-1, -2))
        }
        return container
    }

    private fun showWebsiteDownloadProgress(release: JSONObject) {
        val versionName = release.optString("version_name", "latest version")
        val content = buildWebsiteUpdateCard(
            versionName, "Downloading update", "Downloading… Keep Workly India open.",
            showProgress = true
        )
        websiteDownloadDialog = showWebsiteUpdateBottomSheet(
            content = content,
            primaryLabel = null,
            secondaryLabel = null,
            onPrimary = { },
            onSecondary = { },
            onDismiss = { }
        )
        monitorWebsiteDownloadProgress()
    }

    private fun monitorWebsiteDownloadProgress() {
        activityScope.launch {
            val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            while (websiteDownloadId != -1L && websiteDownloadDialog?.isShowing == true) {
                try {
                    manager.query(DownloadManager.Query().setFilterById(websiteDownloadId)).use { cursor ->
                        if (cursor.moveToFirst()) {
                            val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                            val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                            if (total > 0L) {
                                val percent = ((downloaded * 100L) / total).toInt().coerceIn(0, 100)
                                websiteDownloadProgressBar?.isIndeterminate = false
                                websiteDownloadProgressBar?.progress = percent
                                websiteDownloadProgressLabel?.text = "$percent% downloaded  •  ${android.text.format.Formatter.formatShortFileSize(this@MainActivity, downloaded)} / ${android.text.format.Formatter.formatShortFileSize(this@MainActivity, total)}"
                            } else {
                                websiteDownloadProgressLabel?.text = "Downloading… ${android.text.format.Formatter.formatShortFileSize(this@MainActivity, downloaded)}"
                            }
                        }
                    }
                } catch (error: Exception) {
                    android.util.Log.w("WorklyAppUpdate", "Could not read APK download progress", error)
                }
                delay(500)
            }
        }
    }

    private fun showWebsiteInstallReadyDialog(release: JSONObject?) {
        if (pendingWebsiteInstallUri == null || websiteInstallDialogVisible || isFinishing || isDestroyed) return
        websiteInstallDialogVisible = true
        val versionName = release?.optString("version_name", "new version") ?: "new version"
        val mandatory = getInstalledAppVersionCode() < (release?.optInt("min_supported_version_code", 1) ?: 1).toLong()
        val content = buildWebsiteUpdateCard(
            versionName, "Download complete", "The update is ready. Tap Install now to open Android's secure installer.",
            showProgress = false
        )
        showWebsiteUpdateBottomSheet(
            content = content,
            primaryLabel = "Install now",
            secondaryLabel = if (mandatory) null else "Later",
            onPrimary = { continueWebsiteInstallIfAllowed() },
            onSecondary = { }
        )
    }

    private fun downloadWebsiteUpdate(release: JSONObject) {
        val apkPath = release.optString("apk_path", "").trim()
        if (apkPath.isBlank() || apkPath.startsWith("/") || apkPath.contains("..")) {
            Toast.makeText(this, "Update file is not configured correctly.", Toast.LENGTH_LONG).show()
            return
        }
        val encodedPath = apkPath.split("/").joinToString("/") {
            java.net.URLEncoder.encode(it, "UTF-8").replace("+", "%20")
        }
        val apkUrl = "https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/android-app-releases/" + encodedPath
        try {
            val request = DownloadManager.Request(Uri.parse(apkUrl))
                .setTitle("Workly India update")
                .setDescription("Downloading version " + release.optString("version_name"))
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "workly-india-update.apk")
            val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            websiteDownloadRelease = release
            websiteDownloadId = manager.enqueue(request)
            websiteUpdatePrefs.edit().putLong("active_download_id", websiteDownloadId).apply()
            showWebsiteDownloadProgress(release)
        } catch (error: Exception) {
            android.util.Log.e("WorklyAppUpdate", "Could not start APK download", error)
            Toast.makeText(this, "Could not download the update. Please try again.", Toast.LENGTH_LONG).show()
        }
    }

    private fun showWebsiteInstallPermissionDialog() {
        if (websiteInstallDialogVisible || isFinishing || isDestroyed) return
        websiteInstallDialogVisible = true
        val density = resources.displayMetrics.density
        val message = TextView(this).apply {
            text = "To install the Workly India update, enable “Allow from this source” in Android settings, then return here."
            textSize = 14f
            setTextColor(if (isNativeDarkTheme()) Color.rgb(190, 202, 219) else Color.rgb(75, 85, 98))
            setPadding((20 * density).toInt(), (8 * density).toInt(), (20 * density).toInt(), (18 * density).toInt())
        }
        showWebsiteUpdateBottomSheet(
            content = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(this@MainActivity).apply {
                    text = "Allow app installation"
                    textSize = 19f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    setTextColor(if (isNativeDarkTheme()) Color.rgb(244, 247, 252) else Color.rgb(25, 35, 48))
                    setPadding((20 * density).toInt(), (12 * density).toInt(), (20 * density).toInt(), 0)
                })
                addView(message)
            },
            primaryLabel = "Open settings",
            secondaryLabel = "Not now",
            onPrimary = {
                val settingsIntent = Intent(
                    android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + packageName)
                )
                runCatching { startActivity(settingsIntent) }.onFailure {
                    Toast.makeText(this, "Please allow Workly India to install updates in Android settings.", Toast.LENGTH_LONG).show()
                }
            },
            onSecondary = { }
        )
    }

    private fun showWebsiteUpdateBottomSheet(
        content: android.view.View,
        primaryLabel: String?,
        secondaryLabel: String?,
        onPrimary: () -> Unit,
        onSecondary: () -> Unit,
        onDismiss: () -> Unit = { websiteInstallDialogVisible = false }
    ): android.app.Dialog {
        val density = resources.displayMetrics.density
        fun px(value: Int) = (value * density).toInt()
        val dark = isNativeDarkTheme()
        val surface = if (dark) Color.rgb(17, 27, 45) else Color.WHITE
        val sheet = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(px(16), px(8), px(16), px(18))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(surface)
                cornerRadii = floatArrayOf(px(26).toFloat(), px(26).toFloat(), px(26).toFloat(), px(26).toFloat(), 0f, 0f, 0f, 0f)
            }
        }
        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        lateinit var dialog: android.app.Dialog
        val handle = TextView(this).apply {
            text = "━━━━━━"
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(if (dark) Color.rgb(103, 119, 141) else Color.rgb(177, 187, 199))
            layoutParams = LinearLayout.LayoutParams(0, px(34), 1f)
        }
        topRow.addView(handle)
        sheet.addView(topRow)
        sheet.addView(content, LinearLayout.LayoutParams(-1, -2))
        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        if (secondaryLabel != null) {
            actions.addView(TextView(this@MainActivity).apply {
                text = secondaryLabel
                textSize = 15f
                gravity = Gravity.CENTER
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(if (dark) Color.rgb(224, 232, 243) else Color.rgb(45, 58, 75))
                background = android.graphics.drawable.GradientDrawable().apply {
                    setColor(if (dark) Color.rgb(37, 51, 72) else Color.rgb(239, 243, 248))
                    setStroke(px(1), if (dark) Color.rgb(74, 91, 115) else Color.rgb(207, 216, 228))
                    cornerRadius = px(14).toFloat()
                }
                setOnClickListener {
                    dialog.dismiss()
                    onSecondary()
                }
            }, LinearLayout.LayoutParams(0, px(56), 1f))
        }
        if (primaryLabel != null) {
            actions.addView(TextView(this).apply {
                text = primaryLabel
                textSize = 15f
                gravity = Gravity.CENTER
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(Color.WHITE)
                background = android.graphics.drawable.GradientDrawable().apply {
                    setColor(if (dark) Color.rgb(21, 159, 120) else Color.rgb(13, 128, 100))
                    cornerRadius = px(14).toFloat()
                }
                setOnClickListener {
                    dialog.dismiss()
                    onPrimary()
                }
            }, LinearLayout.LayoutParams(0, px(56), 1f).apply {
                if (secondaryLabel != null) leftMargin = px(10)
            })
        }
        if (primaryLabel != null || secondaryLabel != null) {
            sheet.addView(actions, LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = px(12)
            })
        }

        dialog = android.app.Dialog(this)
        dialog.setContentView(sheet)
        // Keep the update sheet on screen until the user chooses an explicit action.
        dialog.setCancelable(false)
        dialog.setCanceledOnTouchOutside(false)
        dialog.setOnDismissListener { onDismiss() }
        dialog.window?.apply {
            setBackgroundDrawableResource(android.R.color.transparent)
            setDimAmount(0.58f)
            addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT)
            setGravity(Gravity.BOTTOM)
            attributes = attributes.apply {
                width = WindowManager.LayoutParams.MATCH_PARENT
                height = WindowManager.LayoutParams.WRAP_CONTENT
                gravity = Gravity.BOTTOM
                windowAnimations = android.R.style.Animation_InputMethod
            }
        }
        dialog.show()
        dialog.window?.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT)
        return dialog
    }

    private fun continueWebsiteInstallIfAllowed() {
        val apkUri = pendingWebsiteInstallUri ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            waitingForWebsiteInstallPermission = true
            websiteUpdatePrefs.edit().putBoolean("waiting_permission", true).apply()
            val settingsIntent = Intent(
                android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + packageName)
            )
            runCatching { startActivity(settingsIntent) }.onFailure {
                Toast.makeText(this, "Allow Workly India to install updates in Android settings.", Toast.LENGTH_LONG).show()
            }
            return
        }
        try {
            // Use Android's dedicated package-install action for APK updates.
            // The source permission is checked above; Android still shows its
            // secure final confirmation screen (apps cannot silently self-install).
            val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                clipData = android.content.ClipData.newRawUri("Workly India update", apkUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(installIntent)
            websiteDownloadId = -1L
        } catch (error: Exception) {
            android.util.Log.e("WorklyAppUpdate", "Could not open Android package installer", error)
            Toast.makeText(this, "Could not open the installer. Please try again.", Toast.LENGTH_LONG).show()
        }
    }


    private fun isNativeDarkTheme(): Boolean =
        (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES

    private fun updateDialogContext(): Context {
        val theme = if (isNativeDarkTheme()) android.R.style.Theme_Material_NoActionBar
            else android.R.style.Theme_Material_Light_NoActionBar
        return android.view.ContextThemeWrapper(this, theme)
    }

    private fun styleWebsiteUpdateDialog(dialog: AlertDialog) {
        val dark = isNativeDarkTheme()
        dialog.window?.setBackgroundDrawable(
            android.graphics.drawable.ColorDrawable(if (dark) Color.rgb(17, 27, 45) else Color.WHITE)
        )
        dialog.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.90f).toInt(),
            android.view.WindowManager.LayoutParams.WRAP_CONTENT
        )
        val buttonColor = if (dark) Color.rgb(76, 220, 190) else Color.rgb(21, 159, 120)
        dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(buttonColor)
        dialog.getButton(AlertDialog.BUTTON_NEGATIVE)?.setTextColor(if (dark) Color.rgb(190, 202, 219) else Color.rgb(80, 92, 108))
    }

    private fun persistPendingWebsiteInstall(uri: Uri, release: JSONObject?) {
        websiteUpdatePrefs.edit()
            .putString("pending_apk_uri", uri.toString())
            .putString("pending_release", release?.toString())
            .apply()
    }

    private fun discardOlderWebsiteUpdate(latestVersionCode: Int) {
        val pendingRelease = websiteUpdatePrefs.getString("pending_release", null)
            ?.let { runCatching { JSONObject(it) }.getOrNull() }
        val pendingVersion = pendingRelease?.optInt("version_code", 0) ?: 0
        val activeVersion = websiteDownloadRelease?.optInt("version_code", 0) ?: 0
        if (pendingVersion >= latestVersionCode && activeVersion >= latestVersionCode) return

        val savedDownloadId = websiteUpdatePrefs.getLong("active_download_id", -1L)
        if (savedDownloadId != -1L) {
            runCatching {
                (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).remove(savedDownloadId)
            }
        }
        websiteDownloadId = -1L
        websiteDownloadRelease = null
        pendingWebsiteInstallUri = null
        waitingForWebsiteInstallPermission = false
        websiteUpdatePrefs.edit()
            .remove("active_download_id")
            .remove("pending_apk_uri")
            .remove("pending_release")
            .remove("waiting_permission")
            .apply()
        websiteDownloadDialog?.dismiss()
        websiteDownloadDialog = null
        websiteInstallDialogVisible = false
    }

    private fun restorePendingWebsiteInstall() {
        val uri = websiteUpdatePrefs.getString("pending_apk_uri", null)
        val release = websiteUpdatePrefs.getString("pending_release", null)
        pendingWebsiteInstallUri = uri?.let { runCatching { Uri.parse(it) }.getOrNull() }
        websiteDownloadRelease = release?.let { runCatching { JSONObject(it) }.getOrNull() }
        waitingForWebsiteInstallPermission = websiteUpdatePrefs.getBoolean("waiting_permission", false)
    }

    private fun clearPendingWebsiteInstall() {
        pendingWebsiteInstallUri = null
        websiteDownloadRelease = null
        waitingForWebsiteInstallPermission = false
        websiteUpdatePrefs.edit()
            .remove("pending_apk_uri")
            .remove("pending_release")
            .remove("waiting_permission")
            .remove("active_download_id")
            .apply()
        websiteInstallDialogVisible = false
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
                        info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> {
                        // Launch Google's Play-owned in-app update UI directly.
                        // Do not show a separate Workly AlertDialog first.
                        runCatching {
                            appUpdateManager.startUpdateFlowForResult(
                                info, this,
                                AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
                                REQUEST_APP_UPDATE
                            )
                        }.onFailure { error ->
                            android.util.Log.e("WorklyAppUpdate", "Could not start Play update UI", error)
                        }
                    }
                }
            }
            .addOnFailureListener { error ->
                updateCheckInProgress = false
                android.util.Log.w("WorklyAppUpdate", "Could not check Play Store update", error)
            }
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

    override fun onStop() {
        if (isBiometricLockEnabled()) biometricAuthenticatedForForeground = false
        super.onStop()
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isInPictureInPictureMode && ::webView.isInitialized) {
            // Enter PiP only while a video element is actively playing (for example, an interview).
            webView.evaluateJavascript(
                "Array.from(document.querySelectorAll('video')).some(v => !v.paused && !v.ended && v.readyState >= 2)",
            ) { result ->
                if (result == "true" && !isFinishing && !isDestroyed) {
                    runCatching {
                        enterPictureInPictureMode(
                            PictureInPictureParams.Builder()
                                .setAspectRatio(Rational(16, 9))
                                .build()
                        )
                    }
                }
            }
        }
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
