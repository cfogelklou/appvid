import type { StorePreset } from './types';

export const STORE_PRESETS: StorePreset[] = [
  /*{
    id: 'ios-6.9',
    name: 'iOS 6.9" Portrait (iPhone 16 Pro Max)',
    width: 1320,
    height: 2868,
    platform: 'ios',
    description: '1320 x 2868'
  },
  {
    id: 'ios-6.7',
    name: 'iOS 6.7" Portrait (iPhone 15 Pro Max)',
    width: 1290,
    height: 2796,
    platform: 'ios',
    description: '1290 x 2796'
  },
  {
    id: 'ios-6.5',
    name: 'iOS 6.5" Portrait (iPhone XS Max)',
    width: 1242,
    height: 2688,
    platform: 'ios',
    description: '1242 x 2688'
  },*/
  {
    id: 'appstore-portrait',
    name: 'Appstore Portrait',
    width: 886,
    height: 1920,
    platform: 'ios',
    description: '886 x 1920'
  },
  {
    id: 'appstore-landscape',
    name: 'Appstore Landscape',
    width: 1920,
    height: 886,
    platform: 'ios',
    description: '1920 x 886'
  },
  {
    id: 'google-play-portrait',
    name: 'Google Play Portrait',
    width: 1080,
    height: 1920,
    platform: 'android',
    description: '1080 x 1920'
  },
  {
    id: 'google-play-landscape',
    name: 'Google Play Landscape',
    width: 1920,
    height: 1080,
    platform: 'android',
    description: '1920 x 1080'
  }
];
