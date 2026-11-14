import java.util.Properties

plugins {
    id("com.android.application")
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
            // Shrink unused bytecode/resources in signed release APKs and bundles.
            // Keep the debug build unshrunk for easier local diagnostics.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val storePath = System.getenv("WORKLY_UPLOAD_STORE_FILE")
            if (!storePath.isNullOrBlank()) signingConfig = signingConfigs.getByName("release")
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
    implementation("androidx.webkit:webkit:1.14.0")
    // Render the exact user-supplied WiFi Connecting.json Lottie animation on the offline screen.
    implementation("com.airbnb.android:lottie:6.6.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Video calling is handled by the existing website inside WebView.
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}
