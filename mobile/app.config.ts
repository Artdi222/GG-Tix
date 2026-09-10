import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'GG-Tix',
  slug: config.slug || 'mobile',
  android: { ...config.android, package: process.env.EXPO_ANDROID_PACKAGE || 'com.ggtix.mobile', ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
  ios: { ...config.ios, bundleIdentifier: process.env.EXPO_IOS_BUNDLE_IDENTIFIER || 'com.ggtix.mobile' },
  extra: { ...config.extra, ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } : {}) },
});
