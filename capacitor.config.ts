import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.13aa0e68c4e34b09b3c9994d2061ae64',
  appName: 'Workly India',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notification",
      iconColor: "#1646C8"
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true
    },
    Keyboard: {
      resize: "native",
      style: "dark",
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: "light",
      backgroundColor: "#ffffff"
    }
  }
};

export default config;