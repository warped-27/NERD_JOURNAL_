import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'NERD_JOURNAL_',
  slug: 'nerd-journal',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'nerdjournal',
  userInterfaceStyle: 'dark',

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.nerdjournal.app',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'NERD_JOURNAL_ records your voice so you can dictate journal entries.',
      NSPhotoLibraryUsageDescription:
        'NERD_JOURNAL_ reads your photo library so you can attach images to journal entries.',
      NSPhotoLibraryAddUsageDescription:
        'NERD_JOURNAL_ saves images to your photo library.',
      NSCameraUsageDescription:
        'NERD_JOURNAL_ uses the camera so you can photograph pages or scenes for a journal entry.',
    },
  },

  android: {
    package: 'com.nerdjournal.app',
    adaptiveIcon: {
      backgroundColor: '#04070a',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.READ_MEDIA_IMAGES',
    ],
    predictiveBackGestureEnabled: false,
  },

  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },

  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#04070a',
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-audio',
      {
        microphonePermission:
          'NERD_JOURNAL_ records your voice so you can dictate journal entries.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'NERD_JOURNAL_ reads your photo library so you can attach images to journal entries.',
        cameraPermission:
          'NERD_JOURNAL_ uses the camera so you can photograph pages or scenes for a journal entry.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: { newArchEnabled: true },
        android: { newArchEnabled: true },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '',
    },
  },
};

export default config;
