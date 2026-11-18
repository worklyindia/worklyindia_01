plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.worklyindia.aivoice"
    compileSdk = 35
    ndkVersion = "27.2.12479018"
    defaultConfig {
        applicationId = "com.worklyindia.aivoice"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "SUPABASE_URL", "\"https://jubwzelupbntbetpajqb.supabase.co\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o\"")
        externalNativeBuild {
            cmake {
                cppFlags += listOf("-std=c++17")
                arguments += listOf("-DANDROID_STL=c++_shared")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }
    buildFeatures { buildConfig = true }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    // Offline ASR runtime for AI4Bharat IndicConformer and Shruti model packs.
    implementation("com.google.mediapipe:tasks-audio:1.1.1")
    implementation("com.github.k2-fsa:sherpa-onnx:2.0.1") {
        // The Android AAR already contains the Kotlin/JVM API classes.
        // JitPack also publishes a separate JVM JAR; exclude it to avoid duplicate classes.
        exclude(group = "com.github.k2-fsa.sherpa-onnx", module = "sherpa-onnx-jvm")
    }
}
