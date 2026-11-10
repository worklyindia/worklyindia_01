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
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
        }
        chatWebView = webView
        root.addView(webView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
        val close = TextView(this).apply {
            text = "×"
            textSize = 28f
            gravity = Gravity.CENTER
            setTextColor(Color.DKGRAY)
            setBackgroundColor(0xFFF2F4F7.toInt())
            setOnClickListener { finish() }
        }
        root.addView(close, FrameLayout.LayoutParams(48, 48, Gravity.TOP or Gravity.END))
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
