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
        // GitHub Actions run number increases monotonically for each workflow run.
        // Local Android Studio builds fall back to versionCode 1.
        versionCode = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1
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
    packaging {
        jniLibs {
            // Both Sherpa-ONNX and ONNX Runtime AARs bundle this shared native library.
            // Package one copy per ABI; both SDKs use the same ONNX Runtime C ABI.
            pickFirsts += setOf("**/libonnxruntime.so")
        }
    }
    buildFeatures { buildConfig = true }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    // ONNX Runtime CPU inference for Indic Tiny TTS acoustic, flow and Vocos graphs.
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.31.1")
    implementation("com.github.k2-fsa:sherpa-onnx:2.0.1") {
        // The Android AAR already contains the Kotlin/JVM API classes.
        // JitPack also publishes a separate JVM JAR; exclude it to avoid duplicate classes.
        exclude(group = "com.github.k2-fsa.sherpa-onnx", module = "sherpa-onnx-jvm")
    }
}
