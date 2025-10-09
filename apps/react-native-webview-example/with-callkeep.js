// with-callkeep.js
const { withInfoPlist } = require("@expo/config-plugins");
const { withAndroidManifest } = require("@expo/config-plugins");

//
// iOS: add microphone permission + VoIP background mode
//
const withCallKeepIOS = (config) => {
  return withInfoPlist(config, (config) => {
    config.modResults.NSMicrophoneUsageDescription =
      config.modResults.NSMicrophoneUsageDescription ||
      "We need microphone access for calls";

    config.modResults.NSCameraUsageDescription =
        config.modResults.NSCameraUsageDescription || "We need camera access for calls";

    config.modResults.UIBackgroundModes = Array.from(
      new Set([...(config.modResults.UIBackgroundModes || []), "audio", "voip"])
    );

    return config;
  });
};

//
// Android: add telecom service permission
//
const withCallKeepAndroid = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure <uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE" />
    if (!manifest["uses-permission"]) manifest["uses-permission"] = [];

    const alreadyHas = manifest["uses-permission"].some(
      (perm) =>
        perm.$["android:name"] ===
        "android.permission.BIND_TELECOM_CONNECTION_SERVICE"
    );

    if (!alreadyHas) {
      manifest["uses-permission"].push({
        $: {
          "android:name":
            "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
        },
      });
    }

    return config;
  });
};

//
// Main plugin wrapper
//
const withCallKeep = (config) => {
  config = withCallKeepIOS(config);
  config = withCallKeepAndroid(config);
  return config;
};

module.exports = withCallKeep;
