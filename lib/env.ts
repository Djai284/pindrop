import Constants from 'expo-constants';

// Simple environment helper for runtime config via app.json -> expo.extra
export const env = {
  NODE_ENV: process.env.NODE_ENV,
  APP_SCHEME: (Constants.expoConfig as any)?.scheme ?? 'pindrop',
  ...(((Constants.expoConfig as any)?.extra as Record<string, any>) ?? {}),
};

export default env;
