import { type ConfigContext, type ExpoConfig } from 'expo/config';

const APP_VERSION = '0.1.0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'OpenClaw React Native',
  slug: 'openclaw-react-native',
  version: APP_VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'openclaw',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'ai.openclaw.reactnative',
    supportsTablet: true,
  },
  android: {
    package: 'ai.openclaw.reactnative',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#10121A',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: true,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#10121A',
  },
  experiments: {
    reactCompiler: true,
  },
});
