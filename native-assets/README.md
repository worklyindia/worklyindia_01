# Android notification icon (Workly India app)

Makes the small logo next to the app name blue on every phone, in both light and dark mode.

1. `npx cap add android` (only once), then copy `native-assets/android/res/*` into `android/app/src/main/res/`.
2. Paste `AndroidManifest-notification-snippet.xml` inside `<application>` in `android/app/src/main/AndroidManifest.xml`.
3. `npm run build && npx cap sync android && npx cap run android`.
