# Preserve JavaScript bridge method names exposed to the Workly website.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep source line metadata so native crash reports remain actionable.
-keepattributes SourceFile,LineNumberTable
