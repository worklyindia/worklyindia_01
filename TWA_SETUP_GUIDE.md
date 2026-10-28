# Complete TWA (Trusted Web Activity) Setup Guide - Workly India

## 🎯 What is TWA?
TWA allows your PWA to be published on Google Play Store as a real Android app with full-screen experience (no browser UI).

---

## 📋 Prerequisites

Before starting, make sure you have:

1. ✅ **PWA already working** (Already configured at worklyindia.devs.surf)
2. ✅ **HTTPS domain** (worklyindia.devs.surf)
3. ✅ **Web manifest** (public/manifest.json)
4. ✅ **Service worker** (public/sw.js)
5. ⬜ **Node.js 14+** installed ([Download here](https://nodejs.org/))
6. ⬜ **Java JDK 11+** installed ([Download here](https://adoptium.net/))
7. ⬜ **Android SDK** (comes with Android Studio - [Download here](https://developer.android.com/studio))

---

## 🚀 Step 1: Install Bubblewrap CLI

Open your terminal/command prompt and run:

```bash
npm install -g @bubblewrap/cli
```

**Verify installation:**
```bash
npx @bubblewrap/cli --version
```

---

## 🔐 Step 2: Generate Signing Keystore

This keystore is used to sign your app. **KEEP IT SAFE - you need it for all future updates!**

### For Windows (PowerShell/CMD):
```bash
keytool -genkeypair -alias wfhindia -keyalg RSA -keysize 2048 -validity 10000 -keystore android.keystore
```

### For Mac/Linux:
```bash
keytool -genkeypair \
  -alias wfhindia \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -keystore android.keystore
```

**You'll be asked:**
- Keystore password: (choose a strong password, SAVE IT!)
- Key password: (can be same as keystore password)
- Your name, organization, city, state, country

⚠️ **IMPORTANT**: Save these passwords somewhere safe! You'll need them forever!

---

## 🔍 Step 3: Get SHA256 Fingerprint

Run this command to get your SHA256 fingerprint:

```bash
keytool -list -v -keystore android.keystore -alias wfhindia
```

Enter your keystore password when prompted.

**Look for the SHA256 line like this:**
```
SHA256: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90
```

**Copy this entire SHA256 fingerprint!**

---

## 📝 Step 4: Update assetlinks.json

Edit the file `public/.well-known/assetlinks.json` and replace `SHA256_FINGERPRINT_HERE` with your actual SHA256 fingerprint:

```json
[
  {
    "relation": [
      "delegate_permission/common.handle_all_urls"
    ],
    "target": {
      "namespace": "android_app",
      "package_name": "online.workfromhomeindia.twa",
      "sha256_cert_fingerprints": [
        "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90"
      ]
    }
  }
]
```

**Deploy this file to production before testing the app!**

---

## 🏗️ Step 5: Initialize TWA Project

Create a new folder for your TWA build:

```bash
mkdir wfh-twa-build
cd wfh-twa-build
```

Initialize the TWA project:

```bash
npx @bubblewrap/cli init --manifest https://worklyindia.devs.surf/manifest.json
```

**Bubblewrap will ask you several questions. Use these answers:**

| Question | Answer |
|----------|--------|
| Domain | worklyindia.devs.surf |
| App name | Workly India - Workly India Jobs |
| Short name | Workly India |
| Package ID | online.workfromhomeindia.twa |
| Start URL | / |
| Theme color | #2563eb |
| Background color | #2563eb |
| Icon URL | (auto-detected from manifest) |
| Display mode | standalone |
| Signing key path | (path to your android.keystore) |
| Key alias | wfhindia |

---

## 📱 Step 6A: Build Debug APK (For Testing)

This creates an APK you can install directly on your phone for testing:

```bash
npx @bubblewrap/cli build
```

When prompted, enter your keystore and key passwords.

**Output files:**
- `app-release-signed.apk` - Your installable APK
- `assetlinks.json` - Updated asset links file

### Install on your Android phone:
1. Transfer APK to your phone
2. Enable "Install from unknown sources" in settings
3. Open the APK file and install

---

## 🏪 Step 6B: Build Release AAB (For Play Store)

Google Play Store requires AAB (Android App Bundle) format:

```bash
npx @bubblewrap/cli build --generateAppBundle
```

**Output files:**
- `app-release-bundle.aab` - For Play Store upload
- `app-release-signed.apk` - For direct testing

---

## 🔄 Step 7: Update Your App (Future Updates)

When you update your PWA and want to update the Play Store app:

```bash
cd wfh-twa-build
npx @bubblewrap/cli update --manifest https://worklyindia.devs.surf/manifest.json
npx @bubblewrap/cli build --generateAppBundle
```

**Important:** Increment the version in `twa-manifest.json` before each update!

---

## ✅ Step 8: Verify Digital Asset Links

Before publishing, verify your assetlinks.json is working:

1. **Online Tool:** https://developers.google.com/digital-asset-links/tools/generator

2. **Direct URL Check:**
   ```
   https://worklyindia.devs.surf/.well-known/assetlinks.json
   ```

3. **Google's Verification API:**
   ```
   https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://worklyindia.devs.surf&relation=delegate_permission/common.handle_all_urls
   ```

---

## 📲 Step 9: Publish to Google Play Store

1. Create a [Google Play Developer Account](https://play.google.com/console/) ($25 one-time fee)
2. Create a new app in Play Console
3. Upload the `.aab` file in Production > Releases
4. Fill in:
   - Store listing (title, description, screenshots)
   - Content rating questionnaire
   - Pricing & distribution
   - Privacy policy URL
5. Submit for review

---

## ⚠️ Common Errors & Solutions

### Error: "bubblewrap: command not found"
**Solution:** Use `npx @bubblewrap/cli` instead of just `bubblewrap`

### Error: "JDK not found"
**Solution:** Install Java JDK 11+ and set JAVA_HOME:
```bash
# Windows
set JAVA_HOME=C:\Program Files\Java\jdk-11

# Mac/Linux
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk
```

### Error: "Android SDK not found"
**Solution:** Install Android Studio and set ANDROID_HOME:
```bash
# Windows
set ANDROID_HOME=C:\Users\YourName\AppData\Local\Android\Sdk

# Mac
export ANDROID_HOME=$HOME/Library/Android/sdk

# Linux
export ANDROID_HOME=$HOME/Android/Sdk
```

### Error: "Digital Asset Links validation failed"
**Solutions:**
1. Check assetlinks.json is accessible at the correct URL
2. Verify SHA256 fingerprint matches exactly
3. Wait 24 hours (Chrome caches the validation)
4. Clear Chrome data and reinstall app

### Error: "App shows browser bar instead of fullscreen"
**Causes & Solutions:**
1. assetlinks.json not deployed - deploy it first!
2. SHA256 mismatch - regenerate and update
3. Cache issue - wait 24 hours or clear Chrome data

### Error: "Keystore password incorrect"
**Solution:** You must use the exact same password you set when creating the keystore

### Error: "Different signature for update"
**Solution:** You MUST use the same keystore for all updates. Never lose your keystore!

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `public/manifest.json` | PWA manifest with TWA enhancements |
| `public/.well-known/assetlinks.json` | Digital Asset Links for TWA verification |
| `twa-manifest.json` | Bubblewrap configuration (in root) |
| `android.keystore` | Signing key (KEEP SAFE!) |

---

## 🔧 Quick Commands Reference

```bash
# Install Bubblewrap
npm install -g @bubblewrap/cli

# Generate keystore
keytool -genkeypair -alias wfhindia -keyalg RSA -keysize 2048 -validity 10000 -keystore android.keystore

# Get SHA256 fingerprint
keytool -list -v -keystore android.keystore -alias wfhindia

# Initialize TWA
npx @bubblewrap/cli init --manifest https://worklyindia.devs.surf/manifest.json

# Build APK (testing)
npx @bubblewrap/cli build

# Build AAB (Play Store)
npx @bubblewrap/cli build --generateAppBundle

# Update TWA
npx @bubblewrap/cli update --manifest https://worklyindia.devs.surf/manifest.json
```

---

## 📚 Additional Resources

- [Bubblewrap GitHub](https://github.com/nicholasbraun/anthropic-sdk)
- [TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity)
- [Digital Asset Links](https://developers.google.com/digital-asset-links)
- [Play Console Help](https://support.google.com/googleplay/android-developer)

---

## 💡 Tips for Success

1. **Test locally first** - Install APK on your phone before uploading to Play Store
2. **Deploy assetlinks.json first** - The app won't work in fullscreen mode without it
3. **Keep your keystore safe** - Store it in multiple secure locations
4. **Version your app** - Increment version code for each Play Store update
5. **Check manifest regularly** - Ensure icons, colors, and URLs are correct
