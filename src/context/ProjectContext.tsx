import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type {
  Project,
  StorePreset,
  VideoAssetMetadata,
  AudioAssetMetadata,
  AudioSegment,
  VideoSegment,
  ExportSettings,
} from '../types';
import { STORE_PRESETS } from '../constants';

export const getEditedVideoDuration = (project: Project): number => {
  if (!project.videoSegments || project.videoSegments.length === 0) {
    return project.video ? project.video.duration : 0;
  }
  const lastSeg = project.videoSegments[project.videoSegments.length - 1];
  return lastSeg.startTime + lastSeg.duration;
};

interface ProjectContextType {
  project: Project;
  activePreset: StorePreset;
  playhead: number;
  isPlaying: boolean;
  zoom: number;
  selectedSegmentId: string | null;
  selectedVideoSegmentId: string | null;
  hasDraft: boolean;
  setPlayhead: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setSelectedSegmentId: (id: string | null) => void;
  setSelectedVideoSegmentId: (id: string | null) => void;
  importVideo: (video: Omit<VideoAssetMetadata, 'blobUrl'> & { file: File }) => void;
  importAudio: (file: File, duration: number, peaks?: number[]) => void;
  removeAudio: (assetId: string) => void;
  addSegment: (assetId: string) => void;
  updateSegment: (id: string, updates: Partial<Pick<AudioSegment, 'startTime' | 'volume'>>) => void;
  removeSegment: (id: string) => void;
  updateSettings: (settings: Partial<ExportSettings>) => void;
  saveDraft: () => void;
  restoreDraft: () => void;
  clearProject: () => void;
  relinkVideo: (file: File) => boolean;
  relinkAudio: (assetId: string, file: File) => boolean;
  updateAudioPeaks: (assetId: string, peaks: number[]) => void;
  splitVideoSegment: (segmentId: string, splitTime: number) => void;
  deleteVideoSegment: (segmentId: string) => void;
  updateVideoSegmentSpeed: (segmentId: string, speed: number) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const DRAFT_KEY = 'appvid_project_draft';

const createDefaultProject = (): Project => ({
  id: crypto.randomUUID(),
  name: 'Untitled Project',
  video: null,
  audioAssets: [],
  segments: [],
  settings: {
    presetId: 'portrait',
    width: 1080,
    height: 1920,
    fitMode: 'fit',
    originalAudioMode: 'keep',
    quality: 'high',
  },
  updatedAt: Date.now(),
});

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<Project>(createDefaultProject);
  const [playhead, setPlayheadState] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(50); // pixels per second
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedVideoSegmentId, setSelectedVideoSegmentId] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean>(false);

  // Relinking states are tracked via context and matching metadata

  useEffect(() => {
    // Check if a draft exists on startup
    const draft = localStorage.getItem(DRAFT_KEY);
    setHasDraft(!!draft);
  }, []);

  const activePreset =
    STORE_PRESETS.find((p) => p.id === project.settings.presetId) || STORE_PRESETS[0];

  const setPlayhead = (time: number) => {
    const videoDuration = getEditedVideoDuration(project);
    if (project.video) {
      setPlayheadState(Math.max(0, Math.min(time, videoDuration)));
    } else {
      setPlayheadState(Math.max(0, time));
    }
  };

  const importVideo = (videoData: Omit<VideoAssetMetadata, 'blobUrl'> & { file: File }) => {
    const blobUrl = URL.createObjectURL(videoData.file);
    // Autodetect orientation from source dimensions so the editor frame and
    // export default match the video (portrait vs landscape).
    const orientedPreset =
      STORE_PRESETS.find((p) => p.id === (videoData.width > videoData.height ? 'landscape' : 'portrait')) ||
      STORE_PRESETS[0];
    setProject((prev) => {
      const defaultSegment: VideoSegment = {
        id: crypto.randomUUID(),
        clipStart: 0,
        duration: videoData.duration,
        startTime: 0,
        playbackRate: 1.0,
      };

      const updated = {
        ...prev,
        video: {
          name: videoData.name,
          size: videoData.size,
          duration: videoData.duration,
          width: videoData.width,
          height: videoData.height,
          aspectRatio: videoData.aspectRatio,
          blobUrl,
        },
        videoSegments: [defaultSegment],
        settings: {
          ...prev.settings,
          presetId: orientedPreset.id,
          width: orientedPreset.width,
          height: orientedPreset.height,
        },
        updatedAt: Date.now(),
      };
      return updated;
    });
    setPlayheadState(0);
  };

  const importAudio = (file: File, duration: number, peaks?: number[]) => {
    const id = crypto.randomUUID();
    const blobUrl = URL.createObjectURL(file);
    setProject((prev) => {
      const newAsset: AudioAssetMetadata = {
        id,
        name: file.name,
        size: file.size,
        duration,
        blobUrl,
        placedCount: 0,
        peaks,
      };

      const updated = {
        ...prev,
        audioAssets: [...prev.audioAssets, newAsset],
        updatedAt: Date.now(),
      };
      return updated;
    });
  };

  const removeAudio = (assetId: string) => {
    setProject((prev) => {
      // Find asset to revoke object URL
      const asset = prev.audioAssets.find((a) => a.id === assetId);
      if (asset) {
        URL.revokeObjectURL(asset.blobUrl);
      }

      // Filter out segment instances
      const remainingSegments = prev.segments.filter((s) => s.assetId !== assetId);
      const remainingAssets = prev.audioAssets.filter((a) => a.id !== assetId);

      const updated = {
        ...prev,
        audioAssets: remainingAssets.map((a) => {
          const count = remainingSegments.filter((s) => s.assetId === a.id).length;
          return { ...a, placedCount: count };
        }),
        segments: remainingSegments,
        updatedAt: Date.now(),
      };
      return updated;
    });

    // Filter out segment instances from project state

    if (selectedSegmentId) {
      const isDeleted =
        project.segments.find((s) => s.id === selectedSegmentId)?.assetId === assetId;
      if (isDeleted) setSelectedSegmentId(null);
    }
  };

  const updateAudioPeaks = (assetId: string, peaks: number[]) => {
    setProject((prev) => {
      const updated = {
        ...prev,
        audioAssets: prev.audioAssets.map((a) => (a.id === assetId ? { ...a, peaks } : a)),
        updatedAt: Date.now(),
      };
      return updated;
    });
  };

  const addSegment = (assetId: string) => {
    const asset = project.audioAssets.find((a) => a.id === assetId);
    if (!asset) return;

    const newSegment: AudioSegment = {
      id: crypto.randomUUID(),
      assetId,
      startTime: playhead,
      volume: 1.0,
    };

    setProject((prev) => {
      const updatedSegments = [...prev.segments, newSegment];
      const updated = {
        ...prev,
        segments: updatedSegments,
        audioAssets: prev.audioAssets.map((a) =>
          a.id === assetId ? { ...a, placedCount: a.placedCount + 1 } : a,
        ),
        updatedAt: Date.now(),
      };
      return updated;
    });
    setSelectedSegmentId(newSegment.id);
  };

  const updateSegment = (
    id: string,
    updates: Partial<Pick<AudioSegment, 'startTime' | 'volume'>>,
  ) => {
    setProject((prev) => {
      const updatedSegments = prev.segments.map((s) => {
        if (s.id !== id) return s;
        let startTime = s.startTime;
        if (updates.startTime !== undefined) {
          startTime = Math.max(0, updates.startTime);
          if (prev.video) {
            startTime = Math.min(startTime, getEditedVideoDuration(prev));
          }
        }
        return {
          ...s,
          startTime,
          volume:
            updates.volume !== undefined ? Math.max(0, Math.min(updates.volume, 1.0)) : s.volume,
        };
      });

      return {
        ...prev,
        segments: updatedSegments,
        updatedAt: Date.now(),
      };
    });
  };

  const removeSegment = (id: string) => {
    setProject((prev) => {
      const segment = prev.segments.find((s) => s.id === id);
      if (!segment) return prev;

      const remainingSegments = prev.segments.filter((s) => s.id !== id);
      const updated = {
        ...prev,
        segments: remainingSegments,
        audioAssets: prev.audioAssets.map((a) =>
          a.id === segment.assetId ? { ...a, placedCount: Math.max(0, a.placedCount - 1) } : a,
        ),
        updatedAt: Date.now(),
      };
      return updated;
    });
    if (selectedSegmentId === id) {
      setSelectedSegmentId(null);
    }
  };

  const updateSettings = (settingsUpdates: Partial<ExportSettings>) => {
    setProject((prev) => {
      const settings = { ...prev.settings, ...settingsUpdates };

      // If preset changed, auto-update dimensions unless custom
      const preset = STORE_PRESETS.find((p) => p.id === settings.presetId);
      if (preset && preset.id !== 'custom' && settingsUpdates.presetId) {
        settings.width = preset.width;
        settings.height = preset.height;
      }

      const updated = {
        ...prev,
        settings,
        updatedAt: Date.now(),
      };
      return updated;
    });
  };

  const saveDraft = () => {
    // Serialize metadata only (no blob urls or files)
    const draftData = {
      id: project.id,
      name: project.name,
      video: project.video
        ? {
            name: project.video.name,
            size: project.video.size,
            duration: project.video.duration,
            width: project.video.width,
            height: project.video.height,
            aspectRatio: project.video.aspectRatio,
          }
        : null,
      videoSegments: project.videoSegments,
      audioAssets: project.audioAssets.map((a) => ({
        id: a.id,
        name: a.name,
        size: a.size,
        duration: a.duration,
        peaks: a.peaks,
      })),
      segments: project.segments,
      settings: project.settings,
      updatedAt: Date.now(),
    };

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    setHasDraft(true);
  };

  const restoreDraft = () => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) return;

    try {
      const parsed = JSON.parse(draft);

      const defaultSegments = parsed.video ? [{
        id: crypto.randomUUID(),
        clipStart: 0,
        duration: parsed.video.duration,
        startTime: 0,
        playbackRate: 1.0,
      }] : [];

      // Re-initialize draft project with empty blobUrls (relink required)
      const restoredProject: Project = {
        id: parsed.id,
        name: parsed.name,
        video: parsed.video ? { ...parsed.video, blobUrl: '' } : null,
        videoSegments: parsed.videoSegments || defaultSegments,
        audioAssets: parsed.audioAssets.map((a: any) => ({
          ...a,
          blobUrl: '',
          placedCount: parsed.segments.filter((s: any) => s.assetId === a.id).length,
        })),
        segments: parsed.segments,
        settings: parsed.settings,
        updatedAt: parsed.updatedAt,
      };

      setProject(restoredProject);
      setPlayheadState(0);
    } catch (e) {
      console.error('Failed to restore draft', e);
    }
  };

  const clearProject = () => {
    // Revoke old video Url
    if (project.video) {
      URL.revokeObjectURL(project.video.blobUrl);
    }
    // Revoke old audio Urls
    project.audioAssets.forEach((a) => {
      URL.revokeObjectURL(a.blobUrl);
    });

    setProject(createDefaultProject());
    setPlayheadState(0);
    setSelectedSegmentId(null);
  };

  const splitVideoSegment = (segmentId: string, splitTime: number) => {
    setProject((prev) => {
      if (!prev.videoSegments) return prev;
      const idx = prev.videoSegments.findIndex((s) => s.id === segmentId);
      if (idx === -1) return prev;

      const S = prev.videoSegments[idx];
      // Validation: split time must be strictly within segment bounds
      if (splitTime - S.startTime < 0.1 || (S.startTime + S.duration) - splitTime < 0.1) {
        return prev;
      }

      const S1: VideoSegment = {
        id: crypto.randomUUID(),
        clipStart: S.clipStart,
        duration: splitTime - S.startTime,
        startTime: S.startTime,
        playbackRate: S.playbackRate,
      };

      const S2: VideoSegment = {
        id: crypto.randomUUID(),
        clipStart: S.clipStart + (splitTime - S.startTime) * S.playbackRate,
        duration: S.duration - S1.duration,
        startTime: splitTime,
        playbackRate: S.playbackRate,
      };

      const newVideoSegments = [
        ...prev.videoSegments.slice(0, idx),
        S1,
        S2,
        ...prev.videoSegments.slice(idx + 1),
      ];

      // Update start times of subsequent segments
      let currentStartTime = 0;
      const finalVideoSegments = newVideoSegments.map((s) => {
        const updated = { ...s, startTime: currentStartTime };
        currentStartTime += s.duration;
        return updated;
      });

      // Split overlapping audio segments
      const updatedSegments: AudioSegment[] = [];
      prev.segments.forEach((A) => {
        const asset = prev.audioAssets.find((a) => a.id === A.assetId);
        const assetDuration = asset ? asset.duration : 0;
        const currentDuration = A.duration !== undefined ? A.duration : assetDuration;
        const currentClipStart = A.clipStart !== undefined ? A.clipStart : 0;

        if (splitTime > A.startTime && splitTime < A.startTime + currentDuration) {
          const duration1 = splitTime - A.startTime;
          const A1: AudioSegment = {
            id: crypto.randomUUID(),
            assetId: A.assetId,
            startTime: A.startTime,
            volume: A.volume,
            clipStart: currentClipStart,
            duration: duration1,
          };
          const A2: AudioSegment = {
            id: crypto.randomUUID(),
            assetId: A.assetId,
            startTime: splitTime,
            volume: A.volume,
            clipStart: currentClipStart + duration1,
            duration: currentDuration - duration1,
          };
          updatedSegments.push(A1, A2);
        } else {
          updatedSegments.push(A);
        }
      });

      const finalAudioAssets = prev.audioAssets.map((a) => {
        const count = updatedSegments.filter((s) => s.assetId === a.id).length;
        return { ...a, placedCount: count };
      });

      return {
        ...prev,
        videoSegments: finalVideoSegments,
        segments: updatedSegments,
        audioAssets: finalAudioAssets,
        updatedAt: Date.now(),
      };
    });
  };

  const deleteVideoSegment = (segmentId: string) => {
    setProject((prev) => {
      if (!prev.videoSegments || prev.videoSegments.length <= 1) return prev;
      const newVideoSegments = prev.videoSegments.filter((s) => s.id !== segmentId);

      // Re-calculate start times magnetically
      let currentStartTime = 0;
      const finalVideoSegments = newVideoSegments.map((s) => {
        const updated = { ...s, startTime: currentStartTime };
        currentStartTime += s.duration;
        return updated;
      });

      return {
        ...prev,
        videoSegments: finalVideoSegments,
        updatedAt: Date.now(),
      };
    });
    if (selectedVideoSegmentId === segmentId) {
      setSelectedVideoSegmentId(null);
    }
  };

  const updateVideoSegmentSpeed = (segmentId: string, speed: number) => {
    setProject((prev) => {
      if (!prev.videoSegments) return prev;
      const newVideoSegments = prev.videoSegments.map((s) => {
        if (s.id !== segmentId) return s;
        // visual duration = raw duration / speed
        const rawDuration = s.duration * s.playbackRate;
        const newDuration = rawDuration / speed;
        return {
          ...s,
          playbackRate: speed,
          duration: newDuration,
        };
      });

      // Re-calculate start times magnetically
      let currentStartTime = 0;
      const finalVideoSegments = newVideoSegments.map((s) => {
        const updated = { ...s, startTime: currentStartTime };
        currentStartTime += s.duration;
        return updated;
      });

      return {
        ...prev,
        videoSegments: finalVideoSegments,
        updatedAt: Date.now(),
      };
    });
  };

  const relinkVideo = (file: File): boolean => {
    if (!project.video) return false;
    // Basic verification
    const matches =
      file.name === project.video.name || Math.abs(file.size - project.video.size) < 1024;
    if (matches) {
      const blobUrl = URL.createObjectURL(file);
      setProject((prev) => {
        if (!prev.video) return prev;
        return {
          ...prev,
          video: { ...prev.video, blobUrl },
        };
      });
      return true;
    }
    return false;
  };

  const relinkAudio = (assetId: string, file: File): boolean => {
    const asset = project.audioAssets.find((a) => a.id === assetId);
    if (!asset) return false;

    const matches = file.name === asset.name || Math.abs(file.size - asset.size) < 1024;
    if (matches) {
      const blobUrl = URL.createObjectURL(file);
      setProject((prev) => ({
        ...prev,
        audioAssets: prev.audioAssets.map((a) => (a.id === assetId ? { ...a, blobUrl } : a)),
      }));
      return true;
    }
    return false;
  };

  return (
    <ProjectContext.Provider
      value={{
        project,
        activePreset,
        playhead,
        isPlaying,
        zoom,
        selectedSegmentId,
        selectedVideoSegmentId,
        hasDraft,
        setPlayhead,
        setIsPlaying,
        setZoom,
        setSelectedSegmentId,
        setSelectedVideoSegmentId,
        importVideo,
        importAudio,
        updateAudioPeaks,
        removeAudio,
        addSegment,
        updateSegment,
        removeSegment,
        updateSettings,
        saveDraft,
        restoreDraft,
        clearProject,
        relinkVideo,
        relinkAudio,
        splitVideoSegment,
        deleteVideoSegment,
        updateVideoSegmentSpeed,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
