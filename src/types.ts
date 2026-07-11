export interface VideoAssetMetadata {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
  blobUrl: string;
}

export interface VideoSegment {
  id: string;
  clipStart: number;      // Start offset within the raw source video file (seconds)
  duration: number;       // Visual duration on the timeline (seconds)
  startTime: number;      // Start position on the timeline (seconds)
  playbackRate: number;   // Speed multiplier (0.5, 1.0, 1.5, 2.0, 4.0, 8.0, 20.0)
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
  clipStart?: number; // offset within the audio asset (seconds, defaults to 0)
  duration?: number;  // played duration (seconds, defaults to asset duration)
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
  videoSegments?: VideoSegment[]; // optional for backward compatibility in drafts
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
