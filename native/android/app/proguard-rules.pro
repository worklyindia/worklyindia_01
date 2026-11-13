# Keep WebView JavaScript bridge methods callable through Android's
# annotation-based JavaScript interface. This is required for native features
# exposed to the existing Workly website.
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve source line information so Crashlytics can deobfuscate stack traces.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Firebase, AndroidX WorkManager, WebView and calling SDKs publish their own
# consumer rules. Avoid broad package-wide keep rules that would defeat R8.
