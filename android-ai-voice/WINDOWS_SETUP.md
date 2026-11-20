# Run ChatWork on Windows 10/11

The current ChatWork client in this repository is an Android application. There is not yet a native Windows `.exe` build.

## Supported way to try the same Android app on a Windows PC

1. Install a current Android emulator such as BlueStacks 5 from its official website.
2. Enable CPU virtualization (Intel VT-x / AMD-V) in BIOS/UEFI and Windows virtualization settings if the emulator requests it.
3. Start an Android 64-bit instance in the emulator.
4. Build or obtain the signed ChatWork APK from a trusted project release.
5. In the emulator, use **Install APK** and select the ChatWork APK.
6. Open ChatWork and sign in with the same account used on the phone.

## Important limitations

- This runs the Android APK inside an emulator; it is not a native Windows desktop application.
- The current Android app's native inference dependencies and device-specific features may not all work in an emulator.
- The Wan 2.1 video runtime in the Android app is built for ARM64 Android. It should not be assumed to work in a typical x86-64 Windows emulator.
- Model downloads consume disk space inside the emulator. The emulator must remain running while local inference is active.
- For a computer-hosted AI server that the phone can use remotely, a separate Windows server service and authenticated network/API connection still need to be implemented. Installing the Android app in an emulator does not automatically turn the PC into a server.
- Do not install debug APKs from unknown sources or share release signing keys.

## Native Windows app status

A native Windows build requires a separate desktop client implementation (for example, Kotlin Multiplatform/Compose Desktop or a Windows WebView client) and desktop-compatible model runtimes. This repository currently does not contain that build. Keep the Android app and its release signing identity unchanged while desktop support is developed separately.
