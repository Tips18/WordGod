import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wordgod.app',
  appName: 'WordGod',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
