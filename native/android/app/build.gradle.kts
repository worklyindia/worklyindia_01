import java.util.Properties

plugins {
    id("com.android.application")
    id("com.google.firebase.crashlytics")
    id("com.google.firebase.firebase-perf")
}

val releaseProperties = Properties().apply {
    val releaseConfig = rootProject.file("../../android-release.properties")
    if (releaseConfig.exists()) releaseConfig.inputStream().use { load(it) }
}


android {
    namespace = "com.worklyindia.app"
    compileSdk = 36

    buildFeatures { buildConfig = true }

    flavorDimensions += "distribution"
    productFlavors {
        create("playStore") { dimension = "distribution" }
        create("website") { dimension = "distribution" }
    }

    defaultConfig {
        applicationId = "com.worklyindia.app"
        minSdk = 24
        targetSdk = 35
        versionCode = releaseProperties.getProperty("versionCode", "7").toInt()
        versionName = releaseProperties.getProperty("versionName", "2.4.6")
    }

    signingConfigs {
        create("release") {
            val storePath = System.getenv("WORKLY_UPLOAD_STORE_FILE")
            if (!storePath.isNullOrBlank()) {
                storeFile = file(storePath)
                storePassword = System.getenv("WORKLY_UPLOAD_STORE_PASSWORD")
                keyAlias = System.getenv("WORKLY_UPLOAD_KEY_ALIAS")
                keyPassword = System.getenv("WORKLY_UPLOAD_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        getByName("release") {
            val storePath = System.getenv("WORKLY_UPLOAD_STORE_FILE")
            if (!storePath.isNullOrBlank()) signingConfig = signingConfigs.getByName("release")
            // Enable R8 shrinking/optimization only for release builds. Keep
            // debug builds debuggable and preserve consumer SDK rules.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    // Native GA4/Firebase Analytics: app installs, opens, sessions and screen views.
    implementation("com.google.firebase:firebase-analytics")
    // Automatic startup, network and custom trace instrumentation.
    implementation("com.google.firebase:firebase-perf")
    // Crash diagnostics with R8 mapping-file deobfuscation.
    implementation("com.google.firebase:firebase-crashlytics")
    // Official Google Play in-app update flow (flexible updates).
    implementation("com.google.android.play:app-update-ktx:2.1.0")
    implementation("androidx.core:core-ktx:1.17.0")
    // Native pull-to-refresh gesture for the embedded Workly WebView.
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    // Native fingerprint, face and device-credential app lock.
    implementation("androidx.biometric:biometric:1.1.0")
    // On-device OCR for scanned resume pages; no image upload is required.
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    // WebAuthn/passkey support inside the embedded WebView via Android Credential Manager.
    implementation("androidx.credentials:credentials:1.6.0-beta02")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0-beta02")
    // Google Play Services Phone Number Hint API; user-selected SIM number suggestion without phone/SMS permissions.
    implementation("com.google.android.gms:play-services-auth:21.3.0")
    implementation("androidx.webkit:webkit:1.14.0")
    // Render the exact user-supplied WiFi Connecting.json Lottie animation on the offline screen.
    implementation("com.airbnb.android:lottie:6.6.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Native interview calling providers. Website iframe calls remain unchanged.
    // 100ms SDK: room-code authentication is issued by the existing Supabase function.
    implementation("live.100ms:android-sdk:2.9.88")
    implementation("live.100ms:video-view:2.9.88")

    // VideoSDK native Android client; tokens/meeting IDs remain server-issued.
    implementation("live.videosdk:rtc-android-sdk:3.0.0")
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}
