package com.worklyindia.app

import javax.crypto.Cipher
import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
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
import android.view.ViewGroup
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
import androidx.core.content.FileProvider
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
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
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var rootLayout: FrameLayout
    private lateinit var loadingOverlay: FrameLayout
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingFileChooserCallback: android.webkit.ValueCallback<Array<Uri>>? = null
    private var pendingCameraUri: Uri? = null
    private var pendingCameraFile: File? = null
    private var pendingVaultImport = false
    private var pendingVaultOpenId: String? = null
    private var pendingGeoCallback: android.webkit.GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var offlineOverlay: FrameLayout? = null
    // Preserve the exact in-app destination when a navigation fails offline.
    private var pendingOfflineUrl: String? = null
    private var offlineRetryInProgress = false
    private var reconnectCheckInProgress = false
    private var chargingAlertAccessDialogVisible = false
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
    private var websiteUpdateDialog: android.app.Dialog? = null
    private var pendingWebsiteInstallUri: Uri? = null
    private var websiteDownloadId: Long = -1L
    private var websiteDownloadRelease: JSONObject? = null
    private var websiteDownloadDialog: android.app.Dialog? = null
    private var websiteInstallDialogVisible = false
    // Defer update prompts and cancelled installer hand-offs until a fresh app launch.
    private var websiteUpdateDeferredForSession = false
    private var websiteInstallDeferredForSession = false
    private var biometricAuthenticatedForForeground = false
    private var biometricPromptShowing = false
    // Native call lifecycle bridge: keep the display awake and allow Android PiP while an interview video is active.
    @Volatile private var interviewCallActive = false
    @Volatile private var interviewCallVideoEnabled = false
    // Avoid repeating native token registration on every WebView navigation.
    private var autoPushRegistrationUserId: String? = null
    private var pendingNativePushSession: NativeSession? = null
    private var pendingNativePushFirebaseConfig: JSONObject? = null
    private var pendingAutoPushRegistrationSession: NativeSession? = null
    private var waitingForWebsiteInstallPermission = false
    private var websiteInstallLaunchPending = false
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
                        websiteUpdatePrefs.edit().remove("active_download_id").remove("active_download_release").apply()
                        runOnUiThread {
                            websiteDownloadDialog?.dismiss()
                            websiteDownloadDialog = null
                            window.decorView.post { continueWebsiteInstallIfAllowed() }
                        }
                    } else {
                        runOnUiThread { Toast.makeText(this@MainActivity, "Update download could not be opened. Please try again.", Toast.LENGTH_LONG).show() }
                    }
                } else {
                    val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                    android.util.Log.e("WorklyAppUpdate", "Website APK download failed: $reason")
                    websiteDownloadId = -1L
                    websiteUpdatePrefs.edit()
                        .remove("active_download_id")
                        .remove("active_download_release")
                        .apply()
                    runOnUiThread {
                        websiteDownloadDialog?.dismiss()
                        websiteDownloadDialog = null
                        val reasonText = when (reason) {
                            DownloadManager.ERROR_FILE_ALREADY_EXISTS -> "An old update file already exists. Please tap Download update again."
                            DownloadManager.ERROR_INSUFFICIENT_SPACE -> "Not enough storage space to download the update."
                            DownloadManager.ERROR_DEVICE_NOT_FOUND -> "Download storage is unavailable. Please check your phone storage."
                            DownloadManager.ERROR_CANNOT_RESUME -> "The download could not resume. Please try again."
                            else -> "Update download failed (code $reason). Please check your internet and try again."
                        }
                        Toast.makeText(this@MainActivity, reasonText, Toast.LENGTH_LONG).show()
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
        if (requestCode == REQUEST_WEBSITE_INSTALL) {
            websiteInstallLaunchPending = false
            val targetCode = websiteDownloadRelease?.optInt("version_code", 0)?.toLong() ?: 0L
            if (resultCode == RESULT_OK || (targetCode > 0L && getInstalledAppVersionCode() >= targetCode)) {
                clearPendingWebsiteInstall()
            } else {
                // Keep the downloaded APK, but do not reopen Android's installer
                // again during this app session after the user presses Cancel.
                websiteInstallDeferredForSession = true
                android.util.Log.i("WorklyAppUpdate", "Installer was cancelled; retry will wait for the next app launch")
            }
            return
        }
        if (requestCode == REQUEST_APP_UPDATE) {
            if (resultCode != RESULT_OK) {
                android.util.Log.i("WorklyAppUpdate", "In-app update flow was cancelled or failed: $resultCode")
            }
            return
        }
        if (requestCode == REQUEST_VAULT_IMPORT) {
            if (resultCode == RESULT_OK && data?.data != null) {
                val selectedUri = data.data!!
                runCatching { SecureDocumentVault.newEncryptionCipher() }
                    .onSuccess { encryptionCipher ->
                        authenticateVault(encryptionCipher) { authenticatedCipher ->
                            runCatching {
                                val bytes = contentResolver.openInputStream(selectedUri)?.use { input ->
                                    val output = java.io.ByteArrayOutputStream()
                                    val buffer = ByteArray(8192)
                                    var total = 0
                                    while (true) {
                                        val count = input.read(buffer)
                                        if (count < 0) break
                                        total += count
                                        require(total <= SecureDocumentVault.MAX_DOCUMENT_BYTES) { "Choose a document up to 15 MB." }
                                        output.write(buffer, 0, count)
                                    }
                                    output.toByteArray()
                                } ?: throw IllegalStateException("Could not read the selected document.")
                                val name = queryDisplayName(selectedUri)
                                val mime = contentResolver.getType(selectedUri) ?: "application/octet-stream"
                                SecureDocumentVault.saveAuthenticated(this, name, mime, bytes, authenticatedCipher)
                            }.onSuccess {
                                Toast.makeText(this, "Biometric-protected document saved in Secure Vault.", Toast.LENGTH_LONG).show()
                            }.onFailure {
                                Toast.makeText(this, it.message ?: "Could not save document.", Toast.LENGTH_LONG).show()
                            }
                        }
                    }.onFailure {
                        Toast.makeText(this, it.message ?: "Secure Vault key is unavailable.", Toast.LENGTH_LONG).show()
                    }
            }
            return
        }
        if (requestCode == REQUEST_FILE_CHOOSER) {
            val callback = pendingFileChooserCallback
            pendingFileChooserCallback = null
            val cameraUri = pendingCameraUri
            val cameraFile = pendingCameraFile
            pendingCameraUri = null
            pendingCameraFile = null
            val capturedImage = cameraUri?.takeIf {
                resultCode == RESULT_OK && cameraFile?.exists() == true && cameraFile.length() > 0L
            }
            // Camera output is returned directly; document picker results retain
            // WebView's standard single-file and multi-select parsing.
            val results = capturedImage?.let { arrayOf(it) }
                ?: WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            if (cameraFile != null && capturedImage == null) cameraFile.delete()
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
        webView.addJavascriptInterface(WorklyFestivalWidgetBridge(this), "WorklyFestivalWidget")
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame && Uri.parse(request.url.toString()).host == allowedHost) {
                    AppErrorReporter.capture(
                        applicationContext,
                        "webview_navigation",
                        "error",
                        "WebViewNetworkError",
                        "Main page request failed with Android error code ${error.errorCode}",
                        source = request.url.encodedPath ?: "/"
                    )
                }
                if (request.isForMainFrame && Uri.parse(request.url.toString()).host == allowedHost) {
                    runOnUiThread {
                        if (::swipeRefreshLayout.isInitialized) swipeRefreshLayout.isRefreshing = false
                        pendingOfflineUrl = request.url.toString()
                        offlineRetryInProgress = false
                        view.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                        if (!initialWebsiteLoadCompleted && !hasInternetConnection()) {
                            // Keep the startup screen visible when no cached Home document exists.
                            // A cached Home can still render; otherwise wait for network recovery.
                            showStartupLoading()
                        } else {
                            showOfflineScreen()
                        }
                    }
                }
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: android.webkit.WebResourceResponse
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                val host = request.url.host.orEmpty()
                if (errorResponse.statusCode >= 500 && (host == allowedHost || host.endsWith(".supabase.co"))) {
                    AppErrorReporter.capture(
                        applicationContext,
                        "webview_http",
                        "error",
                        "HttpServiceError",
                        "HTTP ${errorResponse.statusCode}",
                        source = request.url.encodedPath ?: "/",
                        httpStatus = errorResponse.statusCode
                    )
                }
            }

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
                    if (::swipeRefreshLayout.isInitialized) swipeRefreshLayout.isRefreshing = false
                    // WebView may call onPageFinished for its own network-error page.
                    // Keep the branded offline screen until a deliberate retry succeeds.
                    if (pendingOfflineUrl == null || offlineRetryInProgress) {
                        pendingOfflineUrl = null
                        offlineRetryInProgress = false
                        hideOfflineScreen()
                    }
                    if (hasInternetConnection()) view.settings.cacheMode = WebSettings.LOAD_DEFAULT
                    syncWebsiteSession()
                    // Capture JavaScript crashes and first-party/Supabase service failures without collecting request bodies or query strings.
                    view.evaluateJavascript("""
                        (function() {
                          if (window.__worklyErrorTelemetryInstalled) return;
                          window.__worklyErrorTelemetryInstalled = true;
                          var recent = Object.create(null);
                          function report(kind, message, source, status) {
                            try {
                              var parsed = new URL(source || location.href, location.href);
                              var trusted = parsed.origin === location.origin || parsed.hostname.endsWith('.supabase.co');
                              if (!trusted) return;
                              var safePath = parsed.pathname || '/';
                              var key = kind + '|' + safePath + '|' + status;
                              if (recent[key] && Date.now() - recent[key] < 30000) return;
                              recent[key] = Date.now();
                              if (window.WorklyAndroid && window.WorklyAndroid.reportAppError) {
                                window.WorklyAndroid.reportAppError(kind, String(message || kind).slice(0, 1000), safePath, Number(status) || 0);
                              }
                            } catch (_) {}
                          }
                          window.addEventListener('error', function(event) {
                            report('JavaScriptError', event.message || 'JavaScript execution failed', event.filename || location.pathname, 0);
                          });
                          window.addEventListener('unhandledrejection', function(event) {
                            var reason = event.reason;
                            report('UnhandledPromiseRejection', reason && reason.message ? reason.message : 'Unhandled promise rejection', location.pathname, 0);
                          });
                          if (window.fetch) {
                            var originalFetch = window.fetch;
                            window.fetch = function() {
                              var request = arguments[0];
                              var rawUrl = typeof request === 'string' ? request : (request && request.url) || location.href;
                              var parsed;
                              try { parsed = new URL(rawUrl, location.href); }
                              catch (_) { return originalFetch.apply(this, arguments); }
                              var tracked = parsed.origin === location.origin || parsed.hostname.endsWith('.supabase.co');
                              return originalFetch.apply(this, arguments).then(function(response) {
                                if (tracked && (response.status >= 500 || response.status === 429)) {
                                  report('HttpServiceError', 'HTTP ' + response.status, parsed.pathname, response.status);
                                }
                                return response;
                              }).catch(function(error) {
                                if (tracked) report('NetworkRequestError', error && error.message ? error.message : 'Network request failed', parsed.pathname, 0);
                                throw error;
                              });
                            };
                          }
                        })();
                    """.trimIndent(), null)
                    // Persist the current SPA route so a force-closed app resumes
                    // the same page instead of always returning to the homepage.
                    view.evaluateJavascript("""
                        (function() {
                          if (window.__worklyRoutePersistenceInstalled) return;
                          window.__worklyRoutePersistenceInstalled = true;
                          var save = function() {
                            try {
                              if (window.WorklyAndroid && window.WorklyAndroid.saveLastVisitedRoute) {
                                window.WorklyAndroid.saveLastVisitedRoute(window.location.href);
                              }
                            } catch (_) {}
                          };
                          var push = history.pushState;
                          var replace = history.replaceState;
                          history.pushState = function() {
                            var result = push.apply(this, arguments);
                            save();
                            return result;
                          };
                          history.replaceState = function() {
                            var result = replace.apply(this, arguments);
                            save();
                            return result;
                          };
                          window.addEventListener('popstate', function() { save(); markRouteChange(); });
                          window.addEventListener('hashchange', function() { save(); markRouteChange(); });
                          window.addEventListener('pagehide', save);

                          // SPA navigation failures do not reach WebViewClient.onReceivedError:
                          // React Router keeps the same document alive and failed data requests
                          // are ordinary fetch/XHR errors. Detect only a failed request shortly
                          // after an in-app route change, then ask Android to show its native
                          // branded offline screen. Cached routes with no failed request remain usable.
                          var routeFailureWindowUntil = 0;
                          function markRouteChange() {
                            routeFailureWindowUntil = Date.now() + 10000;
                          }
                          var originalPushState = history.pushState;
                          history.pushState = function() {
                            var result = originalPushState.apply(this, arguments);
                            save();
                            markRouteChange();
                            return result;
                          };
                          var originalReplaceState = history.replaceState;
                          history.replaceState = function() {
                            var result = originalReplaceState.apply(this, arguments);
                            save();
                            markRouteChange();
                            return result;
                          };
                          function reportOfflineRouteFailure() {
                            if (Date.now() > routeFailureWindowUntil) return;
                            var connected = navigator.onLine;
                            try {
                              if (window.WorklyAndroid && window.WorklyAndroid.isNetworkConnected) {
                                connected = window.WorklyAndroid.isNetworkConnected();
                              }
                            } catch (_) {}
                            if (connected) return;
                            routeFailureWindowUntil = 0;
                            try {
                              if (window.WorklyAndroid && window.WorklyAndroid.onOfflineNavigationFailure) {
                                window.WorklyAndroid.onOfflineNavigationFailure(window.location.href);
                              }
                            } catch (_) {}
                          }
                          if (window.fetch && !window.__worklyOfflineFetchHooked) {
                            window.__worklyOfflineFetchHooked = true;
                            var originalFetch = window.fetch.bind(window);
                            window.fetch = function() {
                              return originalFetch.apply(this, arguments).catch(function(error) {
                                reportOfflineRouteFailure();
                                throw error;
                              });
                            };
                          }
                          if (window.XMLHttpRequest && !window.__worklyOfflineXhrHooked) {
                            window.__worklyOfflineXhrHooked = true;
                            var originalOpen = XMLHttpRequest.prototype.open;
                            var originalSend = XMLHttpRequest.prototype.send;
                            XMLHttpRequest.prototype.open = function() {
                              this.__worklyOfflineRouteRequest = true;
                              return originalOpen.apply(this, arguments);
                            };
                            XMLHttpRequest.prototype.send = function() {
                              this.addEventListener('error', reportOfflineRouteFailure, { once: true });
                              this.addEventListener('timeout', reportOfflineRouteFailure, { once: true });
                              return originalSend.apply(this, arguments);
                            };
                          }
                          save();
                        })();
                    """.trimIndent(), null)
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
                                if (Date.now() - splashReadySince >= 100) {
                                  clearInterval(splashWatcher);
                                  window.__worklyNativeSplashReady = true;
                                  try { sessionStorage.removeItem('worklyNativeBootRecovery:' + location.pathname); } catch (_) {}
                                  if (window.WorklyAndroid && window.WorklyAndroid.onWebsiteReady) {
                                    window.WorklyAndroid.onWebsiteReady();
                                  }
                                }
                              } else {
                                splashReadySince = 0;
                              }
                            }, 100);
                            // A WebView can finish the document request while the React
                            // app never hydrates (for example, a stale renderer/cache state).
                            // Retry the same route once, then show the native retry screen
                            // instead of leaving the startup skeleton on screen forever.
                            setTimeout(function() {
                              if (window.__worklyNativeSplashReady) return;
                              var key = 'worklyNativeBootRecovery:' + location.pathname;
                              var attempts = 0;
                              try { attempts = Number(sessionStorage.getItem(key) || 0); } catch (_) {}
                              if (attempts < 1) {
                                try { sessionStorage.setItem(key, '1'); } catch (_) {}
                                location.reload();
                              } else if (window.WorklyAndroid && window.WorklyAndroid.onWebsiteLoadStalled) {
                                window.WorklyAndroid.onWebsiteLoadStalled();
                              }
                            }, 12000);
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
                val pickerIntent = fileChooserParams.createIntent().apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                val intent = Intent.createChooser(pickerIntent, "Choose a file")
                val acceptsImages = fileChooserParams.acceptTypes.any { it.startsWith("image/") || it == "*/*" }
                if (fileChooserParams.isCaptureEnabled && acceptsImages) {
                    runCatching {
                        val cameraDirectory = File(cacheDir, "images").apply { mkdirs() }
                        val imageFile = File.createTempFile("workly-resume-", ".jpg", cameraDirectory)
                        val imageUri = FileProvider.getUriForFile(this@MainActivity, "$packageName.fileprovider", imageFile)
                        val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                            putExtra(MediaStore.EXTRA_OUTPUT, imageUri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                        }
                        if (cameraIntent.resolveActivity(packageManager) != null) {
                            pendingCameraFile = imageFile
                            pendingCameraUri = imageUri
                            intent.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                        } else {
                            imageFile.delete()
                        }
                    }.onFailure { error ->
                        android.util.Log.w("WorklyResumeScanner", "Camera capture is unavailable", error)
                    }
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
            // Edge-to-edge disables the legacy adjustResize path on modern Android.
            // Apply the IME bottom inset to the root so the WebView's measured area
            // actually shrinks while the keyboard is visible (including gesture-nav devices).
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val bottomInset = if (insets.isVisible(WindowInsetsCompat.Type.ime())) {
                maxOf(bars.bottom, ime.bottom)
            } else {
                bars.bottom
            }
            view.setPadding(bars.left, bars.top, bars.right, bottomInset)
            WindowInsetsCompat.CONSUMED
        }
        // Keep the WebView scroll gestures native-refresh-free. The website has
        // long pages and embedded interview rooms; SwipeRefreshLayout can mistake
        // an upward/mid-page scroll for a pull gesture and reload the whole app.
        // Users can still navigate and scroll normally without triggering a reload.
        swipeRefreshLayout = SwipeRefreshLayout(this).apply {
            isEnabled = false
            addView(webView, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ))
        }
        rootLayout.addView(swipeRefreshLayout, FrameLayout.LayoutParams(
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
        // Ask for notification and Android full-screen-alert access once the
        // app window is ready, so the 100% battery alarm can ring and show
        // its lock-screen activity when the device permits full-screen intents.
        rootLayout.post { ensureChargingAlertAccess() }
        registerNetworkListener()
        val openVaultShortcut = intent.data?.scheme == "worklyindia" && intent.data?.host == "open" && intent.data?.path == "/vault"
        val openHomeFromQuickTile = intent.getBooleanExtra("workly_open_home", false)
        val explicitTarget = trustedInternalUrl(intent.getStringExtra("notification_url"))
            ?: trustedInternalUrl(intent.data?.toString())
            ?: if (intent.hasExtra("notification_type")) "https://$allowedHost/notifications" else null
        val navigationPrefs = getSharedPreferences("workly_navigation", Context.MODE_PRIVATE)
        // A swipe-away from Android Recents is a deliberate full close. The
        // foreground monitor service records this independently of Activity
        // destruction, so the next normal app launch starts at Home. A simple
        // background/resume never sets this flag and keeps the last route.
        // Android assigns a stable taskId while this app remains in Recents.
        // If the user swipes the whole task away and launches again, Android creates
        // a new taskId. This detects a real task removal even when the optional
        // charging foreground service is not running (for example, access is OFF).
        val previousTaskId = navigationPrefs.getInt("active_task_id", -1)
        val taskWasRemoved = previousTaskId != -1 && previousTaskId != taskId
        val forceHomeAfterTaskRemoval =
            navigationPrefs.getBoolean("force_home_next_launch", false) || taskWasRemoved
        val navigationEditor = navigationPrefs.edit()
            .putInt("active_task_id", taskId)
        if (forceHomeAfterTaskRemoval) {
            navigationEditor
                .remove("force_home_next_launch")
                .remove("last_route")
        }
        navigationEditor.commit()

        val savedRoute = navigationPrefs.getString("last_route", null)
            ?.takeIf { it.startsWith("/") && !it.startsWith("//") }
        val target = when {
            openHomeFromQuickTile -> website
            explicitTarget != null -> explicitTarget
            forceHomeAfterTaskRemoval -> website
            !savedRoute.isNullOrBlank() -> "https://$allowedHost$savedRoute"
            else -> website
        }
        lastLoadedUrl = target
        // Offline cold-start always opens the locally cached Home page.
        // Keep the user on Home; only show the offline screen after they request
        // another page that cannot be opened without a network connection.
        if (hasInternetConnection()) {
            webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
            webView.loadUrl(target)
        } else {
            webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
            pendingOfflineUrl = null
            offlineRetryInProgress = false
            lastLoadedUrl = website
            webView.loadUrl(website)
        }
        if (openVaultShortcut) webView.post { showSecureDocumentVault() }
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
            text = "No internet connection. Turn on mobile data or connect to Wi-Fi. Workly India will automatically reconnect and reopen this page when internet is available."
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

    private fun retryOfflinePage() {
        val target = pendingOfflineUrl ?: lastLoadedUrl
        if (!::webView.isInitialized || target.isBlank()) return
        if (!hasInternetConnection()) {
            // Connectivity can change between the Android callback and this retry.
            // Stay silently on the branded offline screen; the next validated
            // network callback or onResume check will retry automatically.
            offlineRetryInProgress = false
            return
        }
        offlineRetryInProgress = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.loadUrl(target)
    }

    private fun hideOfflineScreen() {
        offlineOverlay?.let { overlay ->
            (overlay.parent as? android.view.ViewGroup)?.removeView(overlay)
        }
        offlineOverlay = null
    }

    private fun recoverOfflinePageIfConnected() {
        if (!::webView.isInitialized || isFinishing || isDestroyed) return
        if (!hasInternetConnection()) return

        
        dispatchNativeEvent("workly-native-network-change", "{connected:true}")
        dispatchNativeEvent("online")
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT

        if (pendingOfflineUrl != null && !offlineRetryInProgress) {
            retryOfflinePage()
        } else if (!initialWebsiteLoadCompleted && webView.url.isNullOrBlank()) {
            webView.loadUrl(lastLoadedUrl)
        }
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
                        
                        if (::webView.isInitialized) {
                            webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
                            // Retry the exact failed route after connectivity returns, even
                            // when the app had already completed its first successful load.
                            if (pendingOfflineUrl != null && !offlineRetryInProgress) {
                                retryOfflinePage()
                            } else if (!initialWebsiteLoadCompleted) {
                                webView.loadUrl(lastLoadedUrl)
                            }
                        }
                    }
                } else {
                    dispatchNativeEvent("offline")
                    runOnUiThread {
                        if (::webView.isInitialized && !hasInternetConnection()) {
                            webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                            // Preserve the current route and cover the page immediately.
                            val currentUrl = webView.url?.takeIf {
                                Uri.parse(it).host == allowedHost
                            } ?: lastLoadedUrl
                            pendingOfflineUrl = currentUrl
                            offlineRetryInProgress = false
                            showOfflineScreen()
                        }
                    }
                }
            }

            override fun onLost(network: android.net.Network) {
                if (!hasInternetConnection()) {
                    dispatchNativeEvent("workly-native-network-change", "{connected:false}")
                    dispatchNativeEvent("offline")
                    runOnUiThread {
                        if (::webView.isInitialized && !hasInternetConnection()) {
                            webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                            val currentUrl = webView.url?.takeIf {
                                Uri.parse(it).host == allowedHost
                            } ?: lastLoadedUrl
                            pendingOfflineUrl = currentUrl
                            offlineRetryInProgress = false
                            showOfflineScreen()
                        }
                    }
                }
            }
        }
        runCatching {
            manager.registerDefaultNetworkCallback(callback)
            networkCallback = callback
            // Also inspect the current default network: registering a callback
            // while data is already ON is not a reliable recovery trigger on
            // every Android vendor build.
            webView.post { recoverOfflinePageIfConnected() }
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

    // Battery-full alerts are notification-driven. Exact-alarm access is not
    // required for ACTION_BATTERY_CHANGED monitoring, so do not request it.
    // Guide the user through each real prerequisite in order.
    private fun showChargingAccessSettings(title: String, message: String, settingsIntent: Intent) {
        if (chargingAlertAccessDialogVisible || isFinishing || isDestroyed) return
        chargingAlertAccessDialogVisible = true
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Open settings") { _, _ ->
                runCatching { startActivity(settingsIntent) }
                    .onFailure { error ->
                        android.util.Log.w("WorklyCharging", "Could not open battery alert settings", error)
                        Toast.makeText(this, "Open Workly India settings manually and enable notifications.", Toast.LENGTH_LONG).show()
                    }
            }
            .setNegativeButton("Later", null)
            .setOnDismissListener { chargingAlertAccessDialogVisible = false }
            .show()
    }

    private fun ensureChargingAlertAccess() {
        // Full-screen access is optional for battery monitoring and MP3 alerts.
        // Ask for it only to enable the 100% full-screen activity experience.
        if (Build.VERSION.SDK_INT >= 34) {
            val notificationManager = getSystemService(android.app.NotificationManager::class.java)
            if (!notificationManager.canUseFullScreenIntent()) {
                showChargingAccessSettings(
                    "Enable full-screen notifications",
                    "Allow Send full-screen notifications if you want Workly to open the 100% battery alert over other screens. Charging monitoring and audio continue without it.",
                    Intent(
                        android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                        Uri.parse("package:$packageName")
                    )
                )
            }
        }
        ensureChargingBackgroundAccess()
    }

    /**
     * Always keep battery monitoring active. Android full-screen-intent access
     * controls only whether the 100% alert can open as a full-screen activity;
     * it must never stop charger edge handling or charging audio.
     */
    private fun ensureChargingBackgroundAccess() {
        ensureChargingMonitorRunning()
    }

    private fun biometricPreferences() = getSharedPreferences("workly_app_security", Context.MODE_PRIVATE)

    private fun queryDisplayName(uri: Uri): String {
        return runCatching {
            contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
        }.getOrNull() ?: "document"
    }

    private fun authenticateVault(cipher: javax.crypto.Cipher, onSuccess: (javax.crypto.Cipher) -> Unit) {
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG
        if (BiometricManager.from(this).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
            Toast.makeText(this, "Set up a strong biometric (fingerprint or supported face unlock) to use Secure Vault.", Toast.LENGTH_LONG).show()
            return
        }
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                val authenticatedCipher = result.cryptoObject?.cipher
                if (authenticatedCipher != null) onSuccess(authenticatedCipher)
                else Toast.makeText(this@MainActivity, "Biometric key authorization failed. Vault remains locked.", Toast.LENGTH_LONG).show()
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                Toast.makeText(this@MainActivity, "Secure Vault remains locked.", Toast.LENGTH_SHORT).show()
            }
        })
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock Secure Document Vault")
            .setSubtitle("Biometric verification unlocks the encryption key")
            .setAllowedAuthenticators(authenticators)
            .build()
        prompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
    }

    /** Compatibility path for documents encrypted by the original, non-auth-bound vault key. */
    private fun authenticateLegacyVault(onSuccess: () -> Unit) {
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG
        if (BiometricManager.from(this).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
            Toast.makeText(this, "A strong biometric is required to open this older vault document.", Toast.LENGTH_LONG).show()
            return
        }
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { onSuccess() }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                Toast.makeText(this@MainActivity, "Secure Vault remains locked.", Toast.LENGTH_SHORT).show()
            }
        })
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock older vault document")
            .setSubtitle("Verify your identity to access this previously saved document")
            .setAllowedAuthenticators(authenticators)
            .build()
        prompt.authenticate(info)
    }

    private fun showSecureDocumentVault() {
        val entries = SecureDocumentVault.list(this)
        val labels = entries.mapIndexed { index, _ -> "Secure document ${index + 1}" }.toMutableList()
        labels.add(0, "＋  Add a document")
        AlertDialog.Builder(this)
            .setTitle("Secure Document Vault")
            .setMessage("Documents are encrypted on this device. Biometric verification is required to import or open them.")
            .setItems(labels.toTypedArray()) { _, which ->
                if (which == 0) {
                    val picker = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }
                    startActivityForResult(picker, REQUEST_VAULT_IMPORT)
                } else {
                    val selected = entries[which - 1]
                    fun openDecryptedDocument(document: Triple<String, String, ByteArray>) {
                        runCatching {
                            val (name, mime, bytes) = document
                            val safeName = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").take(120)
                            val tempDir = File(cacheDir, "secure-vault").apply {
                                mkdirs()
                                listFiles()?.forEach { it.delete() }
                            }
                            val temp = File(tempDir, safeName)
                            temp.writeBytes(bytes)
                            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", temp)
                            val view = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(uri, mime)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            startActivity(Intent.createChooser(view, "Open secure document"))
                        }.onFailure {
                            Toast.makeText(this, it.message ?: "Could not open document.", Toast.LENGTH_LONG).show()
                        }
                    }
                    runCatching { SecureDocumentVault.newDecryptionCipher(this, selected.id) }
                        .onSuccess { cipher ->
                            if (cipher == null) {
                                authenticateLegacyVault {
                                    runCatching { SecureDocumentVault.read(this, selected.id) }
                                        .onSuccess(::openDecryptedDocument)
                                        .onFailure { Toast.makeText(this, it.message ?: "Could not open older document.", Toast.LENGTH_LONG).show() }
                                }
                            } else {
                                authenticateVault(cipher) { authenticatedCipher ->
                                    runCatching { SecureDocumentVault.readAuthenticated(this, selected.id, authenticatedCipher) }
                                        .onSuccess(::openDecryptedDocument)
                                        .onFailure { Toast.makeText(this, it.message ?: "Could not open document.", Toast.LENGTH_LONG).show() }
                                }
                            }
                        }.onFailure {
                            Toast.makeText(this, it.message ?: "Could not prepare vault decryption.", Toast.LENGTH_LONG).show()
                        }
                }
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun isBiometricLockEnabled(): Boolean = biometricPreferences().getBoolean("biometric_lock_enabled", false)

    private fun showBiometricLockPrompt(isSetup: Boolean) {
        if (biometricPromptShowing || isFinishing || isDestroyed) return
        val authenticators = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        } else {
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        }
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
        fun reportAppError(type: String, message: String, source: String, httpStatus: Int): Boolean {
            AppErrorReporter.capture(
                applicationContext,
                "webview",
                "error",
                type,
                message,
                source = source,
                httpStatus = httpStatus.takeIf { it > 0 }
            )
            return true
        }

        @JavascriptInterface
        fun saveLastVisitedRoute(url: String): Boolean {
            val safeUrl = trustedInternalUrl(url) ?: return false
            val uri = Uri.parse(safeUrl)
            val route = buildString {
                append(uri.encodedPath?.takeIf { it.isNotBlank() } ?: "/")
                uri.encodedQuery?.let { append("?"); append(it) }
                uri.encodedFragment?.let { append("#"); append(it) }
            }
            if (route.startsWith("/auth") || route.startsWith("/oauth") ||
                route.contains("access_token", ignoreCase = true) ||
                route.contains("refresh_token", ignoreCase = true) ||
                route.contains("code=", ignoreCase = true) ||
                route.contains("token=", ignoreCase = true) ||
                route.contains("otp=", ignoreCase = true)
            ) return false
            getSharedPreferences("workly_navigation", Context.MODE_PRIVATE)
                .edit()
                .putString("last_route", route)
                .commit()
            lastLoadedUrl = "https://$allowedHost$route"
            return true
        }

        @JavascriptInterface
        fun onOfflineNavigationFailure(url: String) {
            val safeUrl = trustedInternalUrl(url) ?: return
            runOnUiThread {
                if (hasInternetConnection() || isFinishing || isDestroyed) return@runOnUiThread
                pendingOfflineUrl = safeUrl
                lastLoadedUrl = safeUrl
                offlineRetryInProgress = false
                if (::webView.isInitialized) {
                    webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                }
                showOfflineScreen()
            }
        }

        @JavascriptInterface
        fun canDisplayOverOtherApps(): Boolean {
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                android.provider.Settings.canDrawOverlays(this@MainActivity)
        }

        // Return a fresh OS permission snapshot so the website can explain the
        // exact state instead of assuming that opening Settings granted access.
        @JavascriptInterface
        fun getOverlayPermissionStatus(): String {
            val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            val granted = !supported || android.provider.Settings.canDrawOverlays(this@MainActivity)
            val declared = packageManager.checkPermission(
                Manifest.permission.SYSTEM_ALERT_WINDOW,
                packageName
            ) == PackageManager.PERMISSION_GRANTED
            return JSONObject()
                .put("supported", supported)
                .put("granted", granted)
                .put("permissionDeclared", declared)
                .put("androidVersion", Build.VERSION.RELEASE.orEmpty())
                .put("apiLevel", Build.VERSION.SDK_INT)
                .put("manufacturer", Build.MANUFACTURER.orEmpty())
                .put("model", Build.MODEL.orEmpty())
                .toString()
        }

        @JavascriptInterface
        fun openDisplayOverOtherAppsSettings(): Boolean {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                android.provider.Settings.canDrawOverlays(this@MainActivity)
            ) return true

            runOnUiThread {
                val packageSettings = Intent(
                    android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + packageName)
                )
                val generalSettings = Intent(
                    android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION
                )
                try {
                    // Prefer the app-specific page. Some OEM Settings apps ignore
                    // the package URI, so retry with the general overlay page.
                    try {
                        startActivity(packageSettings)
                    } catch (packageSettingsError: Exception) {
                        android.util.Log.w(
                            "WorklyOverlay",
                            "App-specific overlay settings unavailable; opening general page",
                            packageSettingsError
                        )
                        startActivity(generalSettings)
                    }
                } catch (error: Exception) {
                    android.util.Log.w("WorklyOverlay", "Could not open overlay permission settings", error)
                    Toast.makeText(
                        this@MainActivity,
                        "Open Settings > Apps > Special app access > Display over other apps. If Android says access is restricted, open Workly India App info > ⋮ > Allow restricted settings first.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
            return false
        }

        @JavascriptInterface
        fun setInterviewCallActive(active: Boolean, videoEnabled: Boolean): Boolean {
            runOnUiThread {
                interviewCallActive = active
                interviewCallVideoEnabled = active && videoEnabled
                if (active) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode) {
                        runCatching { moveTaskToBack(false) }
                    }
                }
            }
            return true
        }

        @JavascriptInterface
        fun scanResumeImage(dataUrl: String): Boolean {
            return try {
                if (!dataUrl.startsWith("data:image/") || dataUrl.length > 16 * 1024 * 1024) {
                    dispatchNativeEvent("workly-native-resume-ocr", JSONObject().put("error", "Choose an image smaller than 12 MB.").toString())
                    return false
                }
                val encoded = dataUrl.substringAfter(",", "")
                val bytes = Base64.decode(encoded, Base64.DEFAULT)
                val bitmap = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    ?: throw IllegalArgumentException("This image could not be opened.")
                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener { result ->
                        dispatchNativeEvent(
                            "workly-native-resume-ocr",
                            JSONObject().put("text", result.text).toString()
                        )
                        bitmap.recycle()
                        recognizer.close()
                    }
                    .addOnFailureListener { error ->
                        dispatchNativeEvent(
                            "workly-native-resume-ocr",
                            JSONObject().put("error", error.message ?: "Could not read text from this image.").toString()
                        )
                        bitmap.recycle()
                        recognizer.close()
                    }
                true
            } catch (error: Exception) {
                dispatchNativeEvent(
                    "workly-native-resume-ocr",
                    JSONObject().put("error", error.message ?: "Could not scan this image.").toString()
                )
                false
            }
        }

        @JavascriptInterface
        fun openSecureDocumentVault(): Boolean {
            runOnUiThread { showSecureDocumentVault() }
            return true
        }

        @JavascriptInterface
        fun getChargingAlertSettings(): String {
            val prefs = getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE)
            return JSONObject()
                .put("chargingStart", prefs.getBoolean(ChargingMonitorService.KEY_START_ALERT_ENABLED, true))
                .put("chargerDisconnect", prefs.getBoolean(ChargingMonitorService.KEY_DISCONNECT_ALERT_ENABLED, true))
                .put("batteryFull", prefs.getBoolean(ChargingMonitorService.KEY_FULL_ALERT_ENABLED, true))
                .put("silentMode", prefs.getBoolean(ChargingMonitorService.KEY_SILENT_MODE, false))
                .toString()
        }

        @JavascriptInterface
        fun saveChargingAlertSettings(
            chargingStart: Boolean,
            chargerDisconnect: Boolean,
            batteryFull: Boolean,
            silentMode: Boolean
        ): Boolean {
            val saved = getSharedPreferences(ChargingMonitorService.PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean(ChargingMonitorService.KEY_START_ALERT_ENABLED, chargingStart)
                .putBoolean(ChargingMonitorService.KEY_DISCONNECT_ALERT_ENABLED, chargerDisconnect)
                .putBoolean(ChargingMonitorService.KEY_FULL_ALERT_ENABLED, batteryFull)
                .putBoolean(ChargingMonitorService.KEY_SILENT_MODE, silentMode)
                .commit()
            if (!saved) return false
            return runCatching {
                startService(Intent(this@MainActivity, ChargingMonitorService::class.java).setAction(ChargingMonitorService.ACTION_SETTINGS_CHANGED))
                true
            }.getOrDefault(false)
        }

        @JavascriptInterface
        fun isBiometricLockEnabled(): Boolean = this@MainActivity.isBiometricLockEnabled()

        @JavascriptInterface
        fun setBiometricLockEnabled(enabled: Boolean): Boolean {
            if (enabled) {
                val authenticators = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
                } else {
                    BiometricManager.Authenticators.BIOMETRIC_STRONG
                }
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
        fun showExitHint() {
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Press back again to exit Workly India", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun onWebsiteReady() {
            runOnUiThread {
                initialWebsiteLoadCompleted = true
                hideStartupLoading()
                // Keep the WebView alive and warm its HTTP cache with a small
                // set of same-origin app routes after the first screen is ready.
                // This prefetches the app shell only; authenticated/API data
                // continues to use normal Supabase session and cache rules.
                if (::webView.isInitialized && hasInternetConnection()) {
                    webView.evaluateJavascript("""
                        (function() {
                          if (window.__worklyNativeRouteWarmupStarted) return;
                          window.__worklyNativeRouteWarmupStarted = true;
                          var excluded = /\\/(auth|login|signup|employer-auth|employer-signup|checkout|payment)(\\/|$)/i;
                          var links = Array.from(document.querySelectorAll('a[href]'))
                            .map(function(a) { try { return new URL(a.href, location.href); } catch (_) { return null; } })
                            .filter(function(u) {
                              return u && u.origin === location.origin &&
                                !excluded.test(u.pathname) &&
                                u.pathname !== location.pathname &&
                                !u.pathname.match(/\\.(pdf|zip|apk|png|jpe?g|webp|mp4)$/i);
                            });
                          var unique = Array.from(new Map(links.map(function(u) { return [u.pathname + u.search, u]; })).values()).slice(0, 8);
                          var warm = function() {
                            unique.forEach(function(u) {
                              var hint = document.createElement('link');
                              hint.rel = 'prefetch';
                              hint.as = 'document';
                              hint.href = u.href;
                              document.head.appendChild(hint);
                            });
                          };
                          if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2500 });
                          else setTimeout(warm, 1200);
                        })();
                    """.trimIndent(), null)
                }
            }
        }

        @JavascriptInterface
        fun onWebsiteLoadStalled() {
            runOnUiThread {
                if (initialWebsiteLoadCompleted || isFinishing || isDestroyed) return@runOnUiThread
                initialWebsiteLoadCompleted = true
                hideStartupLoading()
                pendingOfflineUrl = webView.url?.takeIf { Uri.parse(it).host == allowedHost } ?: website
                lastLoadedUrl = pendingOfflineUrl ?: website
                offlineRetryInProgress = false
                showOfflineScreen()
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
                NativePushManager.clearActiveNotifications(this@MainActivity)
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
                    val userId = user.getString("id")
                    val oldSession = NativeAuth.session(this@MainActivity)

                    // One FCM installation must belong only to the currently
                    // signed-in account. Remove the previous account mapping
                    // before registering the replacement account.
                    activityScope.launch(Dispatchers.IO) {
                        if (oldSession != null && oldSession.userId != userId) {
                            NativePushManager.unregister(this@MainActivity, oldSession)
                        }
                        val saved = NativeAuth.saveWebSession(
                            this@MainActivity,
                            session.getString("access_token"),
                            session.getString("refresh_token"),
                            userId,
                            user.optString("email"),
                            if (role.equals("employer", true)) "employer" else "jobseeker"
                        )
                        runOnUiThread {
                            if (oldSession?.userId != saved.userId) autoPushRegistrationUserId = null
                            // Permission already granted means this device has opted in.
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
        } else if (requestCode == REQUEST_CHARGING_ALERT_NOTIFICATIONS) {
            if (hasNotificationPermission()) ensureChargingAlertAccess()
            else Toast.makeText(this, "Allow Workly India notifications so it can alert you at 100% charge.", Toast.LENGTH_LONG).show()
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

    private fun trustedInternalUrl(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        return runCatching {
            val candidate = if (raw.startsWith("/")) Uri.parse("https://$allowedHost$raw") else Uri.parse(raw)
            candidate.takeIf {
                it.scheme == "https" &&
                it.host.equals(allowedHost, ignoreCase = true) &&
                candidate.userInfo == null
            }?.toString()
        }.getOrNull()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra("workly_open_home", false)) {
            lastLoadedUrl = website
            if (hasInternetConnection()) {
                hideOfflineScreen()
                webView.loadUrl(website)
            } else {
                webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                webView.loadUrl(website)
            }
            return
        }
        val openVaultShortcut = intent.data?.scheme == "worklyindia" && intent.data?.host == "open" && intent.data?.path == "/vault"
        if (openVaultShortcut) {
            webView.post { showSecureDocumentVault() }
            return
        }
        val target = trustedInternalUrl(intent.getStringExtra("notification_url"))
            ?: trustedInternalUrl(intent.data?.toString())
        if (!target.isNullOrBlank()) {
            lastLoadedUrl = target
            if (hasInternetConnection()) {
                hideOfflineScreen()
                webView.loadUrl(target)
            } else {
                // Open the requested route from WebView/service-worker cache when available.
                webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                webView.loadUrl(target)
            }
        }
    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        // Let React Router handle in-app navigation and the two-press home exit.
        // Never show a confirmation dialog and never use WebView history here:
        // WebView history also contains SPA route entries.
        if (::webView.isInitialized) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new Event('workly-native-back'));",
                null
            )
        } else {
            super.onBackPressed()
        }
    }

    // Start a persistent foreground monitor on the user's first app launch.
    // It continues monitoring after the UI is closed and across charge cycles.
    private fun ensureChargingMonitorRunning() {
        val monitor = Intent(this, ChargingMonitorService::class.java)
            .setAction(ChargingMonitorService.ACTION_START)
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(this, monitor)
            } else {
                startService(monitor)
            }
        }.onFailure { error ->
            android.util.Log.e("WorklyCharging", "Could not start persistent battery monitor", error)
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-check the user's battery-optimization choice after returning from
        // Android Settings. If already charging, start the monitor while this
        // Activity is foreground; future charger events can then start it locked.
        ensureChargingBackgroundAccess()
        getSystemService(android.app.NotificationManager::class.java).cancel(4108)
        getSystemService(android.app.NotificationManager::class.java).cancel(4107)
        // Decrypted files are exported to a short-lived app-private cache only
        // so Android's document viewer can open them. Remove leftovers as soon
        // as the user returns to Workly India (and on the next app launch).
        runCatching {
            File(cacheDir, "secure-vault").listFiles()?.forEach { it.delete() }
        }
        registerNetworkListener()
        // Network callbacks are unregistered while the app is backgrounded.
        // Connectivity may already be restored before this Activity resumes,
        // so check the active validated network immediately instead of waiting
        // for another onCapabilitiesChanged callback.
        recoverOfflinePageIfConnected()
        // Re-check special overlay access every time the user returns from
        // Android Settings and notify the embedded website of the real OS state.
        if (::webView.isInitialized) {
            val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                android.provider.Settings.canDrawOverlays(this)
            webView.post {
                if (::webView.isInitialized) {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('workly-native-overlay-permission', {detail:{granted:$overlayGranted}}));",
                        null
                    )
                }
            }
        }
        if (isBiometricLockEnabled() && !biometricAuthenticatedForForeground) showBiometricLockPrompt(false)
        if (::webView.isInitialized) syncWebsiteSession()
        if (pendingWebsiteInstallUri != null) {
            if (!websiteInstallDeferredForSession) resumePendingWebsiteInstall()
        } else if (::appUpdateManager.isInitialized && !websiteUpdateDeferredForSession) {
            if (isPlayStoreInstall) checkForPlayStoreUpdate() else {
                // Check once when the app returns to the foreground; no background polling.
                checkForWebsiteRelease()
            }
        }
    }


    // Finish the APK hand-off after Android has fully resumed the app from
    // "Allow from this source" settings, so the system confirmation opens at once.
    override fun onPostResume() {
        super.onPostResume()
        if (!websiteInstallDeferredForSession) resumePendingWebsiteInstall()
        resumeActiveWebsiteDownload()
    }

    private fun resumePendingWebsiteInstall() {
        if (websiteInstallDeferredForSession || websiteInstallLaunchPending || pendingWebsiteInstallUri == null || isFinishing || isDestroyed) return

        val targetCode = websiteDownloadRelease?.optInt("version_code", 0)?.toLong() ?: 0L
        if (targetCode > 0L && getInstalledAppVersionCode() >= targetCode) {
            clearPendingWebsiteInstall()
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            if (waitingForWebsiteInstallPermission) showWebsiteInstallPermissionDialog()
            else {
                Toast.makeText(this, "Enable “Allow from this source” in Android settings to install the update.", Toast.LENGTH_LONG).show()
            }
            return
        }

        if (!websiteInstallLaunchPending) {
            websiteInstallDialogVisible = false
            websiteInstallLaunchPending = true
            window.decorView.post {
                if (!isFinishing && !isDestroyed && pendingWebsiteInstallUri != null) {
                    continueWebsiteInstallIfAllowed()
                } else {
                    websiteInstallLaunchPending = false
                }
            }
        }
    }

    override fun onPause() {
        getSystemService(android.app.NotificationManager::class.java).cancel(4108)
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
        if (!mandatory && websiteUpdateDeferredForSession) return
        websiteUpdateDialogVisible = true
        val content = buildWebsiteUpdateCard(
            versionName,
            if (mandatory) "Important update required" else "A new version is available",
            notes,
            showProgress = false
        )
        websiteUpdateDialog = showWebsiteUpdateBottomSheet(
            content = content,
            primaryLabel = "Download update",
            secondaryLabel = if (mandatory) null else "Later",
            onPrimary = { downloadWebsiteUpdate(release) },
            onSecondary = {
                // Later means keep this prompt hidden until Workly India is fully
                // closed and opened again; no timer-based re-prompt in this session.
                websiteUpdateDeferredForSession = true
            },
            // Keep the update prompt visible while Android queues the download.
            // It is replaced by the progress sheet only after enqueue succeeds.
            dismissOnPrimary = false,
            onDismiss = { websiteUpdateDialogVisible = false; websiteUpdateDialog = null }
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
            // Keep a short rolling window over DownloadManager's actual byte counter.
            // This avoids the lag introduced by the old EMA smoothing, which made the
            // in-app speed disagree with Android's own download notification.
            val samples = java.util.ArrayDeque<Pair<Long, Long>>()
            var lastDisplayedSpeed = 0L
            var lastProgressTime = android.os.SystemClock.elapsedRealtime()
            while (websiteDownloadId != -1L && websiteDownloadDialog?.isShowing == true) {
                try {
                    manager.query(DownloadManager.Query().setFilterById(websiteDownloadId)).use { cursor ->
                        if (cursor.moveToFirst()) {
                            val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                            val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                            val now = android.os.SystemClock.elapsedRealtime()

                            samples.addLast(now to downloaded)
                            // Retain about two seconds of samples to reduce bursty 0 B/s
                            // readings while keeping the displayed rate close to Android's.
                            while (samples.size > 1 && now - samples.peekFirst().first > 2000L) {
                                samples.removeFirst()
                            }
                            val first = samples.peekFirst()
                            val elapsed = first?.let { now - it.first } ?: 0L
                            if (first != null && elapsed >= 900L) {
                                val delta = (downloaded - first.second).coerceAtLeast(0L)
                                if (delta > 0L) {
                                    lastDisplayedSpeed = (delta * 1000L / elapsed).coerceAtLeast(1L)
                                    lastProgressTime = now
                                }
                            }

                            val speedText = when {
                                lastDisplayedSpeed > 0L && now - lastProgressTime <= 4000L ->
                                    "${android.text.format.Formatter.formatShortFileSize(this@MainActivity, lastDisplayedSpeed)}/s"
                                lastDisplayedSpeed > 0L -> "Waiting for data…"
                                else -> "Calculating…"
                            }
                            val downloadedText = android.text.format.Formatter.formatShortFileSize(this@MainActivity, downloaded)
                            if (total > 0L) {
                                val percent = ((downloaded * 100L) / total).toInt().coerceIn(0, 100)
                                websiteDownloadProgressBar?.isIndeterminate = false
                                websiteDownloadProgressBar?.progress = percent
                                websiteDownloadProgressLabel?.text = "$percent% downloaded  •  $downloadedText / ${android.text.format.Formatter.formatShortFileSize(this@MainActivity, total)}\nSpeed: $speedText"
                            } else {
                                websiteDownloadProgressLabel?.text = "Downloading… $downloadedText\nSpeed: $speedText"
                            }
                        }
                    }
                } catch (error: Exception) {
                    android.util.Log.w("WorklyAppUpdate", "Could not read APK download progress", error)
                }
                delay(1000)
            }
        }
    }

    private fun downloadWebsiteUpdate(release: JSONObject) {
        if (websiteDownloadId != -1L) {
            Toast.makeText(this, "The update is already downloading.", Toast.LENGTH_SHORT).show()
            return
        }
        val apkPath = release.optString("apk_path", "").trim()
        if (apkPath.isBlank()) {
            Toast.makeText(this, "Update file is not configured correctly.", Toast.LENGTH_LONG).show()
            return
        }

        // Current APKs are public GitHub Release assets. Keep legacy R2 URLs
        // and Supabase object-key support for older release records.
        val apkUrl = if (apkPath.startsWith("https://", ignoreCase = true)) {
            val uri = Uri.parse(apkPath)
            val isGitHubReleaseAsset = uri.host == "github.com" &&
                uri.path?.matches(Regex("/worklyindia/worklyindia_01/releases/download/android-v[0-9]+/Workly-India\\.apk")) == true
            val isLegacyR2Asset = uri.host in setOf(
                "pub-e8cec40741a24d08bc49bd0c7070f8f3.r2.dev",
                "downloads.devs.surf"
            )
            if (uri.scheme != "https" || (!isGitHubReleaseAsset && !isLegacyR2Asset) || uri.userInfo != null) {
                Toast.makeText(this, "Update download URL is not trusted.", Toast.LENGTH_LONG).show()
                return
            }
            apkPath
        } else {
            if (apkPath.startsWith("/") || apkPath.contains("..")) {
                Toast.makeText(this, "Update file is not configured correctly.", Toast.LENGTH_LONG).show()
                return
            }
            val encodedPath = apkPath.split("/").joinToString("/") {
                java.net.URLEncoder.encode(it, "UTF-8").replace("+", "%20")
            }
            "https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/android-app-releases/" + encodedPath
        }
        try {
            val versionCode = release.optInt("version_code", 0)
            require(versionCode > 0) { "Update version is invalid." }
            // A unique filename avoids DownloadManager FILE_ALREADY_EXISTS failures
            // when a previous APK remains in the app-specific Downloads folder.
            val destinationName = "workly-india-update-$versionCode.apk"
            val request = DownloadManager.Request(Uri.parse(apkUrl))
                .setTitle("Workly India update")
                .setDescription("Downloading version " + release.optString("version_name"))
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, destinationName)
            val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            websiteDownloadRelease = release
            websiteDownloadId = manager.enqueue(request)
            check(websiteDownloadId != -1L) { "Android could not queue the update download." }
            websiteUpdatePrefs.edit()
                .putLong("active_download_id", websiteDownloadId)
                .putString("active_download_release", release.toString())
                .apply()
            android.util.Log.i("WorklyAppUpdate", "Queued APK download id=$websiteDownloadId version=$versionCode url=$apkUrl")
            websiteUpdateDialog?.dismiss()
            websiteUpdateDialog = null
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
        dismissOnPrimary: Boolean = true,
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
                    // Downloads keep their prompt visible until DownloadManager
                    // confirms that the request was queued. Installer hand-off
                    // still dismisses first to avoid OEM window-focus races.
                    if (dismissOnPrimary) dialog.dismiss()
                    if (dismissOnPrimary) {
                        sheet.postDelayed({
                            if (!isFinishing && !isDestroyed) onPrimary()
                        }, 250L)
                    } else if (!isFinishing && !isDestroyed) {
                        onPrimary()
                    }
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
        val apkUri = pendingWebsiteInstallUri ?: run {
            websiteInstallLaunchPending = false
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            waitingForWebsiteInstallPermission = true
            websiteInstallLaunchPending = false
            websiteUpdatePrefs.edit().putBoolean("waiting_permission", true).commit()
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
            // Hand the completed APK directly to Android's package installer.
            // ACTION_VIEW launches the system confirmation immediately in the foreground;
            // a PackageInstaller status callback can be deferred behind Workly on some
            // Android/OEM builds until the user leaves and re-enters the app.
            val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                putExtra(Intent.EXTRA_RETURN_RESULT, true)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            android.util.Log.i("WorklyAppUpdate", "Launching Android package installer for $apkUri")
            websiteInstallLaunchPending = true
            startActivityForResult(installIntent, REQUEST_WEBSITE_INSTALL)
            waitingForWebsiteInstallPermission = false
            websiteUpdatePrefs.edit().remove("waiting_permission").commit()
            websiteDownloadId = -1L
        } catch (error: Exception) {
            websiteInstallLaunchPending = false
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
            .remove("active_download_release")
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
        val pendingRelease = websiteUpdatePrefs.getString("pending_release", null)
            ?.let { runCatching { JSONObject(it) }.getOrNull() }
        val activeRelease = websiteUpdatePrefs.getString("active_download_release", null)
            ?.let { runCatching { JSONObject(it) }.getOrNull() }
        pendingWebsiteInstallUri = uri?.let { runCatching { Uri.parse(it) }.getOrNull() }
        // Keep the release metadata paired with a completed APK. Previously the
        // nullable active-download value overwrote pending_release on every launch,
        // making the installed-version guard ineffective and reopening the installer.
        websiteDownloadRelease = activeRelease ?: pendingRelease
        waitingForWebsiteInstallPermission = websiteUpdatePrefs.getBoolean("waiting_permission", false)
        websiteDownloadId = websiteUpdatePrefs.getLong("active_download_id", -1L)

        // Also clear stale pending APK state if Android already installed this version.
        val targetCode = websiteDownloadRelease?.optInt("version_code", 0)?.toLong() ?: 0L
        if (pendingWebsiteInstallUri != null && targetCode > 0L &&
            getInstalledAppVersionCode() >= targetCode
        ) {
            clearPendingWebsiteInstall()
        }
    }

    private fun resumeActiveWebsiteDownload() {
        if (websiteDownloadId == -1L || pendingWebsiteInstallUri != null || isFinishing || isDestroyed) return
        val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        runCatching {
            manager.query(DownloadManager.Query().setFilterById(websiteDownloadId)).use { cursor ->
                if (!cursor.moveToFirst()) {
                    websiteDownloadId = -1L
                    websiteUpdatePrefs.edit().remove("active_download_id").remove("active_download_release").apply()
                    return
                }
                when (cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        val uri = manager.getUriForDownloadedFile(websiteDownloadId)
                        if (uri != null) {
                            pendingWebsiteInstallUri = uri
                            persistPendingWebsiteInstall(uri, websiteDownloadRelease)
                            websiteDownloadId = -1L
                            websiteUpdatePrefs.edit().remove("active_download_id").remove("active_download_release").apply()
                            window.decorView.post { continueWebsiteInstallIfAllowed() }
                        }
                    }
                    DownloadManager.STATUS_FAILED -> {
                        val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                        android.util.Log.e("WorklyAppUpdate", "Restored APK download failed: $reason")
                        websiteDownloadId = -1L
                        websiteUpdatePrefs.edit().remove("active_download_id").remove("active_download_release").apply()
                        Toast.makeText(this, "Update download failed. Please tap Download update to retry.", Toast.LENGTH_LONG).show()
                    }
                    DownloadManager.STATUS_PENDING,
                    DownloadManager.STATUS_RUNNING,
                    DownloadManager.STATUS_PAUSED -> {
                        if (websiteDownloadDialog?.isShowing != true && websiteDownloadRelease != null) {
                            showWebsiteDownloadProgress(websiteDownloadRelease!!)
                        }
                    }
                }
            }
        }.onFailure { error ->
            android.util.Log.e("WorklyAppUpdate", "Could not resume APK download", error)
        }
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
            .remove("active_download_release")
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
        // Cross-origin meeting iframes hide their <video> elements from the parent page.
        // The trusted Workly interview page therefore explicitly reports active call state.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            interviewCallActive && interviewCallVideoEnabled &&
            !isInPictureInPictureMode && !isFinishing && !isDestroyed
        ) {
            runCatching {
                enterPictureInPictureMode(
                    PictureInPictureParams.Builder()
                        .setAspectRatio(Rational(16, 9))
                        .build()
                )
            }.onFailure { error ->
                android.util.Log.w("WorklyCalls", "Could not enter picture-in-picture", error)
            }
        }
    }

    override fun onDestroy() {
        interviewCallActive = false
        interviewCallVideoEnabled = false
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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
        private const val PACKAGE_INSTALL_STATUS_REQUEST = 7441
        private const val REQUEST_APP_UPDATE = 4104
        private const val REQUEST_WEBSITE_INSTALL = 4106
        private const val REQUEST_NOTIFICATIONS = 701
        private const val REQUEST_CHARGING_ALERT_NOTIFICATIONS = 704
        private const val REQUEST_FILE_CHOOSER = 4103
        private const val REQUEST_VAULT_IMPORT = 4105
        private const val REQUEST_MEDIA = 702
        private const val REQUEST_LOCATION = 703
    }
}
