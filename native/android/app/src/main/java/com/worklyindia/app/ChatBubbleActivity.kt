package com.worklyindia.app

import android.app.Activity
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.content.res.Configuration
import android.graphics.Color
import android.view.ViewGroup
import android.widget.FrameLayout
import android.view.View
import android.net.Uri

/** Compact activity that opens the exact role-specific Workly conversation route in Android's bubble. */
class ChatBubbleActivity : Activity() {
    private var chatWebView: WebView? = null

    private fun isSystemDarkMode(): Boolean {
        val nightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return nightMode == Configuration.UI_MODE_NIGHT_YES
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Keep the original notification URL intact: employer, owner and employee
        // conversations have different authenticated routes and must not be merged.
        val rawUrl = intent.getStringExtra("chat_url") ?: intent.data?.toString().orEmpty()
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull()
        val safeUrl = uri?.takeIf {
            it.scheme == "https" &&
                it.host.equals("worklyindia.devs.surf", ignoreCase = true) &&
                it.userInfo == null
        }?.toString() ?: "https://worklyindia.devs.surf/notifications"

        val darkMode = isSystemDarkMode()
        val surfaceColor = if (darkMode) Color.rgb(1, 8, 22) else Color.WHITE
        val density = resources.displayMetrics.density
        val root = FrameLayout(this).apply {
            setBackgroundColor(surfaceColor)
            // Keep the bottom of the web page clear of the bubble's rounded edge/system controls.
            // Shrinking the WebView viewport also moves fixed-position message composers upward.
            setPadding(0, 0, 0, (16 * density).toInt())
            clipToPadding = true
        }
        val webView = WebView(this).apply {
            setBackgroundColor(surfaceColor)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.setSupportMultipleWindows(false)
            settings.useWideViewPort = false
            settings.loadWithOverviewMode = false
            settings.textZoom = 100
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            // Prefer normal HTTP validation while online; use the shared WebView cache
            // as an offline fallback so previously opened chat assets can render quickly.
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    // Keep the existing Workly Chat page, composer and controls unchanged.
                    // Apply the Android system appearance to this separate bubble WebView too.
                    val dark = if (darkMode) "true" else "false"
                    view.evaluateJavascript(
                        "(function(){var m=document.querySelector('meta[name=viewport]');" +
                            "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}" +
                            "m.content='width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';" +
                            "var d=$dark;" +
                            "document.documentElement.classList.toggle('dark',d);" +
                            "document.documentElement.style.colorScheme=d?'dark':'light';" +
                            "document.documentElement.style.maxWidth='100%';" +
                            "document.documentElement.style.overflowX='hidden';" +
                            "if(document.body){document.body.classList.toggle('dark',d);document.body.style.maxWidth='100%';document.body.style.overflowX='hidden';}" +
                            "})();",
                        null
                    )
                }
            }
            webChromeClient = WebChromeClient()
        }
        chatWebView = webView
        root.addView(webView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
        // Android owns bubble dismissal; keep the compact surface for chat content.
        setContentView(root)
        webView.loadUrl(safeUrl)
    }

    override fun onDestroy() {
        chatWebView?.apply {
            stopLoading()
            loadUrl("about:blank")
            destroy()
        }
        chatWebView = null
        super.onDestroy()
    }
}
