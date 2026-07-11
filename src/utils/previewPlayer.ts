import type { AudioSegment, AudioAssetMetadata } from '../types';

export class PreviewPlayer {
  private video: HTMLVideoElement | null = null;
  private audioPool = new Map<string, HTMLAudioElement>();
  private segments: AudioSegment[] = [];
  private assets: AudioAssetMetadata[] = [];
  private onTimeUpdateCallback?: (time: number) => void;
  private onPlayPauseCallback?: (isPlaying: boolean) => void;

  // Public flag to prevent feedback loops in React
  public isSelfUpdatingPlayhead = false;

  constructor() {}

  setVideoElement(video: HTMLVideoElement) {
    if (this.video === video) return;

    this.cleanup();
    this.video = video;
    this.setupListeners();
  }

  updateTracks(segments: AudioSegment[], assets: AudioAssetMetadata[]) {
    this.segments = segments;
    this.assets = assets;
    this.syncAudio();
  }

  onTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdateCallback = callback;
  }

  onPlayPause(callback: (isPlaying: boolean) => void) {
    this.onPlayPauseCallback = callback;
  }

  play() {
    if (this.video && this.video.paused) {
      this.video.play().catch((err) => {
        console.warn('[PreviewPlayer] Video play failed:', err);
      });
    }
  }

  pause() {
    if (this.video && !this.video.paused) {
      this.video.pause();
    }
  }

  seek(time: number) {
    if (!this.video) return;
    // Only seek if the difference is significant to avoid feedback jitter
    if (Math.abs(this.video.currentTime - time) > 0.05) {
      try {
        this.video.currentTime = time;
        this.syncAudio();
      } catch (err) {
        console.warn('[PreviewPlayer] Video seek failed:', err);
      }
    }
  }

  setPlaybackRate(rate: number) {
    if (this.video) {
      this.video.playbackRate = rate;
    }
  }

  cleanup() {
    this.removeListeners();
    this.clearAudioPool();
    this.video = null;
    this.onTimeUpdateCallback = undefined;
    this.onPlayPauseCallback = undefined;
    this.isSelfUpdatingPlayhead = false;
  }

  private setupListeners() {
    if (!this.video) return;
    this.video.addEventListener('timeupdate', this.handleTimeUpdate);
    this.video.addEventListener('play', this.handlePlay);
    this.video.addEventListener('pause', this.handlePause);
    this.video.addEventListener('seeking', this.handleSeeking);
    this.video.addEventListener('seeked', this.handleSeeked);
    this.video.addEventListener('ratechange', this.handleRateChange);
  }

  private removeListeners() {
    if (!this.video) return;
    this.video.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.video.removeEventListener('play', this.handlePlay);
    this.video.removeEventListener('pause', this.handlePause);
    this.video.removeEventListener('seeking', this.handleSeeking);
    this.video.removeEventListener('seeked', this.handleSeeked);
    this.video.removeEventListener('ratechange', this.handleRateChange);
  }

  private clearAudioPool() {
    for (const audio of this.audioPool.values()) {
      audio.pause();
      audio.src = '';
    }
    this.audioPool.clear();
  }

  private handleTimeUpdate = () => {
    if (!this.video) return;
    this.isSelfUpdatingPlayhead = true;
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.video.currentTime);
    }
    this.syncAudio();
  };

  private handlePlay = () => {
    if (this.onPlayPauseCallback) {
      this.onPlayPauseCallback(true);
    }
    this.syncAudio();
  };

  private handlePause = () => {
    if (this.onPlayPauseCallback) {
      this.onPlayPauseCallback(false);
    }
    this.syncAudio();
  };

  private handleSeeking = () => {
    this.syncAudio();
  };

  private handleSeeked = () => {
    this.syncAudio();
  };

  private handleRateChange = () => {
    if (!this.video) return;
    const rate = this.video.playbackRate;
    for (const audio of this.audioPool.values()) {
      audio.playbackRate = rate;
    }
  };

  public syncAudio() {
    if (!this.video) return;

    const vTime = this.video.currentTime;
    const isVideoPlaying = !this.video.paused && !this.video.ended;
    const rate = this.video.playbackRate;

    const activeSegmentIds = new Set<string>();

    for (const seg of this.segments) {
      const asset = this.assets.find((a) => a.id === seg.assetId);
      if (!asset || !asset.blobUrl) continue;

      const duration = asset.duration;
      const start = seg.startTime;
      const end = start + duration;

      if (vTime >= start && vTime < end) {
        activeSegmentIds.add(seg.id);
        const targetAudioTime = vTime - start;

        let audio = this.audioPool.get(seg.id);
        if (!audio) {
          audio = new Audio(asset.blobUrl);
          audio.volume = seg.volume;
          audio.playbackRate = rate;
          audio.currentTime = targetAudioTime;
          this.audioPool.set(seg.id, audio);

          if (isVideoPlaying) {
            audio.play().catch((err) => {
              console.warn(`[PreviewPlayer] Failed to play audio segment ${seg.id}:`, err);
            });
          }
        } else {
          if (audio.volume !== seg.volume) {
            audio.volume = seg.volume;
          }
          if (audio.playbackRate !== rate) {
            audio.playbackRate = rate;
          }

          if (Math.abs(audio.currentTime - targetAudioTime) > 0.15) {
            audio.currentTime = targetAudioTime;
          }

          if (isVideoPlaying) {
            if (audio.paused) {
              audio.play().catch((err) => {
                console.warn(`[PreviewPlayer] Failed to resume audio segment ${seg.id}:`, err);
              });
            }
          } else {
            if (!audio.paused) {
              audio.pause();
            }
          }
        }
      }
    }

    for (const [id, audio] of this.audioPool.entries()) {
      if (!activeSegmentIds.has(id)) {
        audio.pause();
        audio.src = '';
        this.audioPool.delete(id);
      }
    }
  }
}

export const previewPlayer = new PreviewPlayer();
