import type { ExpoConfig } from 'expo/config';

// Google's public sample AdMob app IDs. Real IDs come from EAS env vars for production builds.
const ADMOB_ANDROID_APP_ID =
  process.env.ADMOB_ANDROID_APP_ID ?? 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID ?? 'ca-app-pub-3940256099942544~1458002511';

const config: ExpoConfig = {
  name: 'Jigsaw In My Pocket',
  slug: 'jigsaw-in-my-pocket',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'jigsawinmypocket',
  userInterfaceStyle: 'light',
  backgroundColor: '#f9f9ff',
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? 'com.jigsawinmypocket.app',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription:
        'Jigsaw In My Pocket needs access to your photos so you can turn them into puzzles.',
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
      ],
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? 'com.jigsawinmypocket.app',
    adaptiveIcon: {
      backgroundColor: '#3E6B5C',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    'expo-font',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, backgroundColor: '#f9f9ff' }],
    'expo-image',
    'expo-sqlite',
    ['expo-audio', { microphonePermission: false }],
    [
      'expo-image-picker',
      { photosPermission: 'Jigsaw In My Pocket needs access to your photos so you can turn them into puzzles.', cameraPermission: false, microphonePermission: false },
    ],
    ['expo-notifications', { color: '#3E6B5C' }],
    'expo-web-browser',
    'expo-build-properties',
    ['react-native-google-mobile-ads', { androidAppId: ADMOB_ANDROID_APP_ID, iosAppId: ADMOB_IOS_APP_ID, delayAppMeasurementInit: true, skAdNetworkItems: ['cstr6suwn9.skadnetwork'] }],
    ['@stripe/stripe-react-native', { merchantIdentifier: process.env.APPLE_MERCHANT_ID ?? 'merchant.com.jigsawinmypocket.app', enableGooglePay: true }],
  ],
  // EXPO_BASE_URL is set only for the hosted web demo, which lives under a sub-path.
  experiments: { typedRoutes: false, baseUrl: process.env.EXPO_BASE_URL || undefined },
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } },
};

export default config;
