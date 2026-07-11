export interface VideoAssetMetadata {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
  blobUrl: string;
}

export interface AudioAssetMetadata {
  id: string;
  name: string;
  size: number;
  duration: number;
  blobUrl: string;
  placedCount: number;
  peaks?: number[];
}

export interface AudioSegment {
  id: string;
  assetId: string;
  startTime: number; // in seconds
  volume: number; // 0.0 to 1.0
}

export interface ExportSettings {
  presetId: string;
  width: number;
  height: number;
  fitMode: 'fit' | 'fill';
  originalAudioMode: 'keep' | 'mute';
  quality: 'high';
}

export interface Project {
  id: string;
  name: string;
  video: VideoAssetMetadata | null;
  audioAssets: AudioAssetMetadata[];
  segments: AudioSegment[];
  settings: ExportSettings;
  updatedAt: number;
}

export interface StorePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  platform: 'ios' | 'android' | 'custom';
  description: string;
}
