#!/usr/bin/env bash
set -euo pipefail

APK="$GITHUB_WORKSPACE/android-ai-voice/app/build/outputs/apk/direct/debug/app-direct-debug.apk"
EVIDENCE="$GITHUB_WORKSPACE/chatwork-emulator-evidence"
mkdir -p "$EVIDENCE"
test -s "$APK" || { echo "::error::Built ChatWork APK is missing or empty: $APK"; exit 1; }

adb wait-for-device
trap 'adb logcat -d -t 5000 > "$EVIDENCE/chatwork-emulator-logcat.txt" 2>/dev/null || true' EXIT

# Wait for ADB transport and Android framework boot, not just device enumeration.
boot_deadline=$(( $(date +%s) + 900 ))
until adb get-state 2>/dev/null | grep -qx device; do
  if (( $(date +%s) >= boot_deadline )); then
    echo "::error::Android Emulator did not become online before timeout."
    adb devices -l || true
    exit 1
  fi
  sleep 3
done
until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
  if (( $(date +%s) >= boot_deadline )); then
    echo "::error::Android Emulator did not finish booting before timeout."
    adb devices -l || true
    exit 1
  fi
  sleep 3
done

adb install -r "$APK"
adb shell pm grant com.worklyindia.chatwork android.permission.RECORD_AUDIO || true
adb shell pm grant com.worklyindia.chatwork android.permission.POST_NOTIFICATIONS || true
adb shell am force-stop com.worklyindia.chatwork
adb shell monkey -p com.worklyindia.chatwork -c android.intent.category.LAUNCHER 1
sleep 25
if ! adb shell pidof com.worklyindia.chatwork >/dev/null; then
  adb logcat -d -t 5000 > "$EVIDENCE/chatwork-emulator-logcat.txt"
  echo "::error::ChatWork did not remain running after launch. See logcat artifact."
  exit 1
fi
adb shell screencap -p /sdcard/chatwork-home.png
adb pull /sdcard/chatwork-home.png "$EVIDENCE/chatwork-home.png"
adb shell uiautomator dump /sdcard/chatwork-window.xml >/dev/null
adb pull /sdcard/chatwork-window.xml "$EVIDENCE/chatwork-window.xml"
echo "ChatWork launch smoke test passed; screenshot and UI hierarchy captured."
