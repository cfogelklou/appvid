import type { StorePreset } from './types';

export const STORE_PRESETS: StorePreset[] = [
  {
    id: 'appstore-portrait',
    name: 'App Store Portrait',
    width: 886,
    height: 1920,
    platform: 'ios',
    description: '886 x 1920',
  },
  {
    id: 'appstore-landscape',
    name: 'App Store Landscape',
    width: 1920,
    height: 886,
    platform: 'ios',
    description: '1920 x 886',
  },
  {
    id: 'google-play-portrait',
    name: 'Google Play Portrait',
    width: 1080,
    height: 1920,
    platform: 'android',
    description: '1080 x 1920',
  },
  {
    id: 'google-play-landscape',
    name: 'Google Play Landscape',
    width: 1920,
    height: 1080,
    platform: 'android',
    description: '1920 x 1080',
  },
];
