import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.eventselfsolutions.app",
  appName: "Event Self Solutions",
  webDir: "../web/dist",
  server: { androidScheme: "https" },
  plugins: {
    CapacitorUpdater: { autoUpdate: false },
    SplashScreen: { launchShowDuration: 0, backgroundColor: "#10002f", showSpinner: false },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
  android: { allowMixedContent: false },
};

export default config;
