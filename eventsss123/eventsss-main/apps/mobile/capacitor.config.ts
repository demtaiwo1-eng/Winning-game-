import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ephinta.app",
  appName: "EPHINTA",
  webDir: "../web/dist",
  server: { androidScheme: "https" },
  plugins: {
    CapacitorUpdater: { autoUpdate: false },
    SplashScreen: { launchShowDuration: 900, launchAutoHide: true, fadeOutDuration: 250, backgroundColor: "#10002f", androidScaleType: "CENTER_INSIDE", showSpinner: false },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
  android: { allowMixedContent: false },
};

export default config;
