plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.worklyindia.aivoice"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.worklyindia.aivoice"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "SUPABASE_URL", "\"https://jubwzelupbntbetpajqb.supabase.co\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o\"")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true }
    kotlinOptions { jvmTarget = "17" }
}
