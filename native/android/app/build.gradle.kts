import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.worklyindia.app"
    compileSdk = 35


    defaultConfig {
        applicationId = "com.worklyindia.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
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
            if (!storePath.isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures { compose = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.razorpay:checkout:1.6.41")
    implementation("live.videosdk:rtc-android-sdk:2.2.0")
    implementation("live.100ms:room-kit:1.3.9")
    debugImplementation("androidx.compose.ui:ui-tooling")
}

// Firebase Android config is supplied as app/google-services.json when the Android app is registered in Firebase.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}
