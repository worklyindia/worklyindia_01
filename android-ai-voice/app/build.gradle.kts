import java.io.File
import java.net.HttpURLConnection
import java.nio.file.Files
import java.net.URL
import java.security.MessageDigest

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
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
    sourceSets.getByName("main").jniLibs.srcDirs(
        layout.buildDirectory.dir("generated/wan-jni"),
        layout.buildDirectory.dir("generated/qwen3-jni"),
        layout.buildDirectory.dir("generated/qvac-jni")
    )
    packaging {
        jniLibs {
            // Wan is launched as a child process from nativeLibraryDir, so Android
            // must extract the executable instead of loading it only from the APK.
            useLegacyPackaging = true
            // Sherpa-ONNX 2.0.1 is built against ONNX Runtime 1.28.2; keep the ABI aligned.
        }
    }
    buildFeatures { buildConfig = true }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("com.google.mediapipe:tasks-audio:1.2.2")
    implementation("com.airbnb.android:lottie:6.7.1")
    implementation("com.google.mlkit:translate:17.0.3")
    implementation("com.google.firebase:firebase-messaging:24.1.2")
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.27.0")
    implementation("org.apache.commons:commons-compress:1.27.1")
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
        fun digest(file: File): String {
            val md = MessageDigest.getInstance("SHA-256")
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
        val partial = File(target.parentFile, target.name + ".part")
        partial.delete()
        val url = URL("https://raw.githubusercontent.com/SaientAI/saient/73073fd7fe17dc565b33a148e42282bcc1eb926c/engine/arm64-v8a/libquartz-wan.so")
        val connection = url.openConnection().apply {
            connectTimeout = 30_000
            readTimeout = 120_000
        }
        try {
            connection.getInputStream().buffered(1024 * 1024).use { input ->
                partial.outputStream().buffered(1024 * 1024).use { output -> input.copyTo(output) }
            }
        } finally {
            (connection as? HttpURLConnection)?.disconnect()
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


// Qwen3-TTS is built as an isolated native CMake project so its GGML targets
// cannot collide with the app's existing llama.cpp GGML targets. The upstream
// Android port currently supports arm64-v8a / API 31+ only.
val qwenNativeBuildDir = layout.buildDirectory.dir("qwen3-native")
val qwenNativeOutput = layout.buildDirectory.dir("generated/qwen3-jni/arm64-v8a/libqwen3_tts_jni.so")
val configureQwenNative by tasks.registering(Exec::class) {
    val qwenSource = layout.projectDirectory.dir("../qwen3-native")
    inputs.dir(qwenSource)
    inputs.dir(layout.projectDirectory.dir("../external/qwen3-tts.cpp"))
    outputs.dir(qwenNativeBuildDir)
    doFirst {
        val qwenSubmodule = layout.projectDirectory.dir("../external/qwen3-tts.cpp").asFile
        check(qwenSubmodule.resolve("ggml/CMakeLists.txt").isFile) {
            "Qwen3-TTS source is missing. Run: git submodule update --init --recursive"
        }
    }
    commandLine(
        "cmake", "-S", qwenSource.asFile.absolutePath,
        "-B", qwenNativeBuildDir.get().asFile.absolutePath,
        "-DCMAKE_TOOLCHAIN_FILE=${android.ndkDirectory.absolutePath}/build/cmake/android.toolchain.cmake",
        "-DANDROID_ABI=arm64-v8a",
        "-DANDROID_PLATFORM=android-31",
        "-DANDROID_STL=c++_shared",
        "-DCMAKE_BUILD_TYPE=Release"
    )
}
val buildQwenNative by tasks.registering(Exec::class) {
    dependsOn(configureQwenNative)
    outputs.file(qwenNativeOutput)
    commandLine(
        "cmake", "--build", qwenNativeBuildDir.get().asFile.absolutePath,
        "--target", "qwen3_tts_jni", "--config", "Release", "--parallel", "2"
    )
    doLast {
        val source = qwenNativeBuildDir.get().file("jni/arm64-v8a/libqwen3_tts_jni.so").asFile
        check(source.isFile) { "Qwen3-TTS native build did not produce libqwen3_tts_jni.so" }
        val target = qwenNativeOutput.get().asFile
        target.parentFile.mkdirs()
        source.copyTo(target, overwrite = true)
    }
}
tasks.matching { it.name == "preBuild" }.configureEach {
    dependsOn(buildQwenNative)
}


// QVAC's C++17 TTS stack provides Android-native Chatterbox, CosyVoice3 and
// Parler engines. Build it in a separate CMake graph with its matching pinned
// fabric GGML source so its target names cannot collide with llama.cpp/Qwen.
val qvacRepo = layout.projectDirectory.dir("../external/qvac-fabric-speech.cpp").asFile
val qvacTtsSource = File(qvacRepo, "engines/tts")
val qvacGgmlSource = layout.projectDirectory.dir("../external/qvac-fabric-llm.cpp/ggml").asFile
val sentencePieceSource = layout.projectDirectory.dir("../external/sentencepiece").asFile
val qvacNativeBuildDir = layout.buildDirectory.dir("qvac-native")
val qvacNativeOutput = layout.buildDirectory.file("generated/qvac-jni/arm64-v8a/libworkly_qvac_tts_jni.so")

val stageQvacTtsSource by tasks.registering {
    inputs.dir(qvacTtsSource)
    inputs.dir(qvacGgmlSource)
    inputs.dir(sentencePieceSource)
    doLast {
        check(File(qvacTtsSource, "CMakeLists.txt").isFile) {
            "QVAC TTS source submodule is missing. Run: git submodule update --init --recursive"
        }
        check(File(qvacGgmlSource, "CMakeLists.txt").isFile) {
            "QVAC fabric GGML submodule is missing. Run: git submodule update --init --recursive"
        }
        check(File(sentencePieceSource, "CMakeLists.txt").isFile) {
            "SentencePiece submodule is missing. Run: git submodule update --init --recursive"
        }
        val ggmlLink = File(qvacTtsSource, "ggml")
        if (Files.isSymbolicLink(ggmlLink.toPath())) {
            Files.delete(ggmlLink.toPath())
        } else if (ggmlLink.exists()) {
            check(ggmlLink.isDirectory && File(ggmlLink, "CMakeLists.txt").isFile) {
                "Unexpected QVAC engines/tts/ggml path; refusing to overwrite it."
            }
        }
        if (!ggmlLink.exists()) {
            Files.createSymbolicLink(ggmlLink.toPath(), qvacGgmlSource.toPath())
        }

        // The app ships a downloaded, verified reference WAV plus the S3Tok
        // and CAM++ GGUF companions. QVAC's upstream constructor currently
        // insists on a pre-baked voice.gguf even when reference_audio is
        // supplied; that is redundant because the reference path overwrites
        // all four baked voice tensors before first synthesis. Make that
        // baked voice optional only for the explicit reference-audio path.
        val cosyvoiceEngine = File(qvacTtsSource, "src/cosyvoice_engine.cpp")
        check(cosyvoiceEngine.isFile) { "QVAC CosyVoice native engine source is missing." }
        val engineSource = Files.readString(cosyvoiceEngine.toPath())
        val oldVoiceBlock = """        require(voice_path, "voice.gguf");"""
        val newVoiceBlock = """        if (voice_path.empty() && opts.reference_audio.empty()) {
            require(voice_path, "voice.gguf");
        }"""
        val oldLoadBlock = """        // voice.gguf: read its four tensors into vectors, then free it.
        {
            model_ctx voice_m = cosyvoice_load_gguf(
                voice_path, det::backend_is_cpu(backend) ? backend : nullptr);
            ModelGuard voice_guard(voice_m);
            voice_prompt_stok  = read_i32(voice_m, "voice/prompt_stok");
            voice_prompt_token = read_i32(voice_m, "voice/prompt_token");
            voice_prompt_feat  = read_f32(voice_m, "voice/prompt_feat");
            voice_embedding    = read_f32(voice_m, "voice/embedding");
        }
        voice_mel_len1     = (int)(voice_prompt_feat.size() / 80);
        voice_prompt_text  = cosyvoice_gguf_meta_str(voice_path, "voice.prompt_text", "");"""
        val newLoadBlock = """        // A baked voice is optional when reference_audio is supplied below;
        // that native path computes and replaces all voice tensors at load.
        if (!voice_path.empty()) {
            model_ctx voice_m = cosyvoice_load_gguf(
                voice_path, det::backend_is_cpu(backend) ? backend : nullptr);
            ModelGuard voice_guard(voice_m);
            voice_prompt_stok  = read_i32(voice_m, "voice/prompt_stok");
            voice_prompt_token = read_i32(voice_m, "voice/prompt_token");
            voice_prompt_feat  = read_f32(voice_m, "voice/prompt_feat");
            voice_embedding    = read_f32(voice_m, "voice/embedding");
            voice_mel_len1     = (int)(voice_prompt_feat.size() / 80);
            voice_prompt_text  = cosyvoice_gguf_meta_str(voice_path, "voice.prompt_text", "");
        }"""
        val patched = engineSource
            .replace(oldVoiceBlock, newVoiceBlock)
            .replace(oldLoadBlock, newLoadBlock)
        check(patched.contains(newVoiceBlock) && patched.contains(newLoadBlock)) {
            "Could not apply the CosyVoice reference-only voice patch; upstream source changed."
        }
        if (patched != engineSource) Files.writeString(cosyvoiceEngine.toPath(), patched)
    }
}

val configureQvacNative by tasks.registering(Exec::class) {
    dependsOn(stageQvacTtsSource)
    inputs.dir(layout.projectDirectory.dir("../qvac-native"))
    inputs.dir(qvacTtsSource)
    inputs.dir(qvacGgmlSource)
    inputs.dir(sentencePieceSource)
    outputs.dir(qvacNativeBuildDir)
    commandLine(
        "cmake", "-S", layout.projectDirectory.dir("../qvac-native").asFile.absolutePath,
        "-B", qvacNativeBuildDir.get().asFile.absolutePath,
        "-DQVAC_TTS_ROOT=${qvacTtsSource.absolutePath}",
        "-DSENTENCEPIECE_ROOT=${sentencePieceSource.absolutePath}",
        "-DCMAKE_TOOLCHAIN_FILE=${android.ndkDirectory.absolutePath}/build/cmake/android.toolchain.cmake",
        "-DANDROID_ABI=arm64-v8a",
        "-DANDROID_PLATFORM=android-26",
        "-DANDROID_STL=c++_shared",
        "-DCMAKE_BUILD_TYPE=Release"
    )
}

val buildQvacNative by tasks.registering(Exec::class) {
    dependsOn(configureQvacNative, buildQwenNative)
    inputs.dir(qvacNativeBuildDir)
    inputs.dir(qvacTtsSource)
    inputs.dir(qvacGgmlSource)
    inputs.dir(sentencePieceSource)
    outputs.file(qvacNativeOutput)
    commandLine(
        "cmake", "--build", qvacNativeBuildDir.get().asFile.absolutePath,
        "--target", "workly_qvac_tts_jni", "--config", "Release", "--parallel", "2"
    )
    doLast {
        val source = qvacNativeBuildDir.get().file("jni/arm64-v8a/libworkly_qvac_tts_jni.so").asFile
        check(source.isFile) { "QVAC native build did not produce libworkly_qvac_tts_jni.so" }
        val target = qvacNativeOutput.get().asFile
        target.parentFile.mkdirs()
        source.copyTo(target, overwrite = true)
    }
}
tasks.matching { it.name == "preBuild" }.configureEach {
    dependsOn(buildQvacNative)
}
