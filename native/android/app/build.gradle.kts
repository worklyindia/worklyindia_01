plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.worklyindia.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.worklyindia.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "2.0.0"
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
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.core:core-ktx:1.15.0")
    // WebAuthn/passkey support inside the embedded WebView via Android Credential Manager.
    implementation("androidx.credentials:credentials:1.6.0-beta02")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0-beta02")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}
