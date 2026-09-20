/**
 * Dynamic Expo config.
 *
 * `googleServicesFile` resolves to the EAS file secret `GOOGLE_SERVICES_JSON`
 * on cloud builds (the real file is gitignored and never uploaded), and to
 * the local `./google-services.json` for local prebuilds.
 */
module.exports = () => ({
  expo: {
    name: "WA Bot Admin",
    slug: "wa-bot-admin",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "wabotadmin",
    userInterfaceStyle: "light",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.annasblackhat.wabotadmin",
      googleServicesFile: "./GoogleService-Info.plist",
    },
    android: {
      package: "com.annasblackhat.wabotadmin",
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "dynamic",
          },
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: "0f27c45f-43a4-4a1e-8208-f073dec1e5a4",
      },
    },
    owner: "annasblackhat",
  },
});
