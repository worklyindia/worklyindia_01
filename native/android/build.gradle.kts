plugins {
    id("com.android.application") version "9.3.1" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
    id("com.google.firebase.crashlytics") version "3.0.2" apply false
    // 1.4.2 references the removed AGP Transform API; 2.0.2 is the current
    // Firebase Performance plugin and uses the supported instrumentation API.
    id("com.google.firebase.firebase-perf") version "2.0.2" apply false
}
