import type { Project, AudioSegment, AudioAssetMetadata } from '../types';

export class PreviewPlayer {
  private video: HTMLVideoElement | null = null;
  private audioPool = new Map<string, HTMLAudioElement>();
  private project: Project | null = null;
  private segments: AudioSegment[] = [];
  private assets: AudioAssetMetadata[] = [];
  private onTimeUpdateCallback?: (time: number) => void;
  private onPlayPauseCallback?: (isPlaying: boolean) => void;
  private globalRate = 1.0;

  // Public flag to prevent feedback loops in React
  public isSelfUpdatingPlayhead = false;

  constructor() {}

  setVideoElement(video: HTMLVideoElement) {
    if (this.video === video) return;

    this.cleanup();
    this.video = video;
    this.setupListeners();
  }

  updateProject(project: Project) {
    this.project = project;
    this.updateTracks(project.segments, project.audioAssets);
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

  public timelineTimeToSourceTime(t: number): number {
    if (!this.project || !this.project.videoSegments || this.project.videoSegments.length === 0) {
      return t;
    }
    // Find segment covering t
    const seg = this.project.videoSegments.find(
      (s) => t >= s.startTime && t <= s.startTime + s.duration
    );
    if (!seg) {
      const lastSeg = this.project.videoSegments[this.project.videoSegments.length - 1];
      return lastSeg.clipStart + lastSeg.duration * lastSeg.playbackRate;
    }
    return seg.clipStart + (t - seg.startTime) * seg.playbackRate;
  }

  public sourceTimeToTimelineTime(srcTime: number): number {
    if (!this.project || !this.project.videoSegments || this.project.videoSegments.length === 0) {
      return srcTime;
    }
    // Find segment covering srcTime
    const seg = this.project.videoSegments.find(
      (s) => srcTime >= s.clipStart && srcTime <= s.clipStart + s.duration * s.playbackRate
    );
    if (!seg) {
      const lastSeg = this.project.videoSegments[this.project.videoSegments.length - 1];
      return lastSeg.startTime + lastSeg.duration;
    }
    return seg.startTime + (srcTime - seg.clipStart) / seg.playbackRate;
  }

  seek(time: number) {
    if (!this.video) return;
    const targetSourceTime = this.timelineTimeToSourceTime(time);
    // Only seek if the difference is significant to avoid feedback jitter
    if (Math.abs(this.video.currentTime - targetSourceTime) > 0.05) {
      try {
        this.video.currentTime = targetSourceTime;
        this.syncPlaybackRate();
        this.syncAudio();
      } catch (err) {
        console.warn('[PreviewPlayer] Video seek failed:', err);
      }
    }
  }

  setPlaybackRate(rate: number) {
    this.globalRate = rate;
    this.syncPlaybackRate();
  }

  private getTargetPlaybackRate(): number {
    if (!this.video) return this.globalRate;
    if (!this.project || !this.project.videoSegments || this.project.videoSegments.length === 0) {
      return this.globalRate;
    }
    const vTime = this.sourceTimeToTimelineTime(this.video.currentTime);
    const seg = this.project.videoSegments.find(
      (s) => vTime >= s.startTime && vTime <= s.startTime + s.duration
    );
    const segmentRate = seg ? seg.playbackRate : 1.0;
    return segmentRate * this.globalRate;
  }

  private syncPlaybackRate() {
    if (!this.video) return;
    const targetRate = this.getTargetPlaybackRate();
    
    // Mute the video element if playing at a high speed to bypass Safari's 2.0x cap
    const originalAudioMode = this.project?.settings.originalAudioMode;
    const shouldMuteVideoElement = targetRate > 2.0 || originalAudioMode === 'mute';
    if (this.video.muted !== shouldMuteVideoElement) {
      this.video.muted = shouldMuteVideoElement;
    }

    if (Math.abs(this.video.playbackRate - targetRate) > 0.01) {
      this.video.playbackRate = targetRate;
    }
  }

  cleanup() {
    this.removeListeners();
    this.clearAudioPool();
    this.video = null;
    this.onTimeUpdateCallback = undefined;
    this.onPlayPauseCallback = undefined;
    this.isSelfUpdatingPlayhead = false;
    this.project = null;
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

    // Check if the playhead crossed a segment boundary
    if (this.project && this.project.videoSegments && this.project.videoSegments.length > 0) {
      const vTime = this.sourceTimeToTimelineTime(this.video.currentTime);
      const segIndex = this.project.videoSegments.findIndex(
        (s) => vTime >= s.startTime && vTime <= s.startTime + s.duration
      );

      if (segIndex !== -1) {
        const seg = this.project.videoSegments[segIndex];
        const clipEnd = seg.clipStart + seg.duration * seg.playbackRate;
        if (this.video.currentTime >= clipEnd - 0.01) {
          // Segment ended, transition to next segment
          if (segIndex + 1 < this.project.videoSegments.length) {
            const nextSeg = this.project.videoSegments[segIndex + 1];
            this.video.currentTime = nextSeg.clipStart;
            this.syncPlaybackRate();
          } else {
            // End of entire video timeline
            this.video.pause();
          }
        }
      }
    }

    const currentTimelineTime = this.sourceTimeToTimelineTime(this.video.currentTime);
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(currentTimelineTime);
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
    this.syncPlaybackRate();
    this.syncAudio();
  };

  private handleRateChange = () => {
    if (!this.video) return;
    const targetRate = this.getTargetPlaybackRate();
    if (Math.abs(this.video.playbackRate - targetRate) > 0.01) {
      this.video.playbackRate = targetRate;
    }
  };

  public syncAudio() {
    if (!this.video) return;

    const vTime = this.sourceTimeToTimelineTime(this.video.currentTime);
    const isVideoPlaying = !this.video.paused && !this.video.ended;
    const rate = this.globalRate;

    const activeSegmentIds = new Set<string>();

    for (const seg of this.segments) {
      const asset = this.assets.find((a) => a.id === seg.assetId);
      if (!asset || !asset.blobUrl) continue;

      const duration = seg.duration !== undefined ? seg.duration : asset.duration;
      const clipStart = seg.clipStart !== undefined ? seg.clipStart : 0;
      const start = seg.startTime;
      const end = start + duration;

      if (vTime >= start && vTime < end) {
        activeSegmentIds.add(seg.id);
        const targetAudioTime = (vTime - start) + clipStart;

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
