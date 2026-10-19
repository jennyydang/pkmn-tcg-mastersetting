import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Must match the bundle ID registered in App Store Connect; change before submitting.
  appId: "com.mastersettracker.app",
  appName: "Master Set Tracker",
  // `npm run build` writes the static export here.
  webDir: "out",
  ios: {
    // The web layout pads itself with env(safe-area-inset-*) (viewport-fit=cover).
    contentInset: "never",
    backgroundColor: "#f9fafb",
  },
};

export default config;
