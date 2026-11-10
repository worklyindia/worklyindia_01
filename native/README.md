# Workly India Native Apps

This directory contains separate native Android (Kotlin + Jetpack Compose) and iOS (Swift + SwiftUI) applications. The existing React/Vite website and Capacitor app remain unchanged.

## Architecture

- Android: `native/android/` — Kotlin, Jetpack Compose, Material 3.
- iOS: `native/ios/` — Swift, SwiftUI.
- Backend: existing Workly India Supabase project; never embed service-role keys in mobile apps.
- Android application ID: `com.worklyindia.app`. Confirm the iOS bundle identifier in Apple Developer before signing.

## Delivery sequence

1. Native app shell and navigation.
2. Supabase Auth using the public/anon key and existing auth policies.
3. Jobs feed, search, job detail, apply/post flows.
4. Profile/resume and messaging.
5. Push notifications, deep links, accessibility and release signing.

## Build requirements

Android builds require JDK 17+ and Android SDK. iOS builds require macOS with Xcode. Store releases require Play Console / Apple Developer signing and review.

> This is a staged native implementation. Features must be integrated and tested before production release; do not ship placeholder screens as completed functionality.
