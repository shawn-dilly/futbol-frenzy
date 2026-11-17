import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.futbolfrenzy.app',
  appName: 'Futbol Frenzy',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      hidden: true
    }
  }
};

export default config;
