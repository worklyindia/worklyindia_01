package com.worklyindia.app

import android.app.Activity
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.graphics.Color
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import android.view.Gravity
import android.view.View
import android.net.Uri

/** Compact activity shown inside Android's conversation-bubble surface. */
class ChatBubbleActivity : Activity() {
    private var chatWebView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val rawUrl = intent.getStringExtra("chat_url") ?: intent.data?.toString().orEmpty()
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull()
        val safeUrl = uri?.takeIf {
            it.scheme == "https" &&
                it.host.equals("worklyindia.devs.surf", ignoreCase = true) &&
                it.userInfo == null
        }?.toString() ?: "https://worklyindia.devs.surf/notifications"

        val root = FrameLayout(this).apply { setBackgroundColor(Color.WHITE) }
        val webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.setSupportMultipleWindows(false)
            settings.useWideViewPort = false
            settings.loadWithOverviewMode = false
            settings.textZoom = 100
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    // Keep the site inside Android's compact bubble viewport.
                    view.evaluateJavascript(
                        "(function(){var m=document.querySelector('meta[name=viewport]');" +
                            "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}" +
                            "m.content='width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';" +
                            "document.documentElement.style.maxWidth='100%';" +
                            "document.documentElement.style.overflowX='hidden';" +
                            "if(document.body){document.body.style.maxWidth='100%';document.body.style.overflowX='hidden';}" +
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
