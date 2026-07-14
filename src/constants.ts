import type { StorePreset } from './types';

export const STORE_PRESETS: StorePreset[] = [
  {
    id: 'portrait',
    name: 'Portrait',
    width: 1080,
    height: 1920,
    platform: 'ios',
    description: '1080 x 1920 (9:16)',
  },
  {
    id: 'landscape',
    name: 'Landscape',
    width: 1920,
    height: 1080,
    platform: 'ios',
    description: '1920 x 1080 (16:9)',
  },
];
