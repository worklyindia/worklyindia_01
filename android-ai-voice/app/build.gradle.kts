plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseStoreFile = System.getenv("WORKLY_VOICE_KEYSTORE_PATH")
val releaseStorePassword = System.getenv("WORKLY_VOICE_KEYSTORE_PASSWORD")
val releaseKeyAlias = System.getenv("WORKLY_VOICE_KEY_ALIAS")
val releaseKeyPassword = System.getenv("WORKLY_VOICE_KEY_PASSWORD")
val releaseSigningReady = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }

android {
    // Keep the Kotlin/manifest namespace stable; only the installed app identity changes.
    namespace = "com.worklyindia.aivoice"
    compileSdk = 35
    ndkVersion = "27.2.12479018"
    defaultConfig {
        applicationId = "com.worklyindia.chatwork"
        minSdk = 26
        targetSdk = 35
        versionCode = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1
        versionName = "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")
        buildConfigField("String", "SUPABASE_URL", "\"https://jubwzelupbntbetpajqb.supabase.co\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o\"")
        externalNativeBuild {
            cmake {
                cppFlags += listOf("-std=c++17")
                arguments += listOf("-DANDROID_STL=c++_shared")
            }
        }
    }
    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (releaseSigningReady) signingConfig = signingConfigs.getByName("release")
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
    sourceSets.getByName("main").jniLibs.srcDir(layout.buildDirectory.dir("generated/wan-jni"))
    packaging {
        jniLibs {
            // Wan is launched as a child process from nativeLibraryDir, so Android
            // must extract the executable instead of loading it only from the APK.
            useLegacyPackaging = true
            pickFirsts += setOf("**/libonnxruntime.so")
        }
    }
    buildFeatures { buildConfig = true }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("com.airbnb.android:lottie:6.7.1")
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.32.0")
    implementation("com.github.k2-fsa:sherpa-onnx:2.0.1") {
        exclude(group = "com.github.k2-fsa.sherpa-onnx", module = "sherpa-onnx-jvm")
    }
}


// Pinned Saient Wan2.1 Vulkan executable. Model weights remain a separate
// 4.73 GB first-run download; only the arm64 runtime is packaged in the APK.
val wanEngineOutput = layout.buildDirectory.file("generated/wan-jni/arm64-v8a/libquartz-wan.so")
val downloadWanVideoEngine by tasks.registering {
    outputs.file(wanEngineOutput)
    doLast {
        val target = wanEngineOutput.get().asFile
        val expectedBytes = 82_749_840L
        val expectedSha256 = "7f18eb1337e70bc69cbbd21adfe7a7bfe56401e50c33c7a41747104f6bfa49ca"
        fun digest(file: java.io.File): String {
            val md = java.security.MessageDigest.getInstance("SHA-256")
            file.inputStream().buffered(1024 * 1024).use { input ->
                val buffer = ByteArray(1024 * 1024)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    md.update(buffer, 0, count)
                }
            }
            return md.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        }
        if (target.isFile && target.length() == expectedBytes && digest(target) == expectedSha256) {
            logger.lifecycle("Verified cached Saient Wan2.1 Android engine.")
            return@doLast
        }
        target.parentFile.mkdirs()
        val partial = java.io.File(target.parentFile, target.name + ".part")
        partial.delete()
        val url = java.net.URL("https://raw.githubusercontent.com/SaientAI/saient/73073fd7fe17dc565b33a148e42282bcc1eb926c/engine/arm64-v8a/libquartz-wan.so")
        val connection = url.openConnection().apply {
            connectTimeout = 30_000
            readTimeout = 120_000
        }
        try {
            connection.getInputStream().buffered(1024 * 1024).use { input ->
                partial.outputStream().buffered(1024 * 1024).use { output -> input.copyTo(output) }
            }
        } finally {
            (connection as? java.net.HttpURLConnection)?.disconnect()
        }
        check(partial.length() == expectedBytes) {
            "Saient Wan engine download has an unexpected size: " + partial.length()
        }
        check(digest(partial) == expectedSha256) {
            "Saient Wan engine failed SHA-256 verification."
        }
        if (target.exists()) target.delete()
        check(partial.renameTo(target)) { "Could not install the verified Saient Wan engine." }
        logger.lifecycle("Downloaded and verified Saient Wan2.1 Android engine.")
    }
}
tasks.named("preBuild").configure { dependsOn(downloadWanVideoEngine) }
