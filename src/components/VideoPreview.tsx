import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { previewPlayer } from '../utils/previewPlayer';
import { layoutCue, createCanvasMeasurer } from '../text/textLayout';
import { FONT_ASSET } from '../text/constants';
import { isIntervalActive } from '../text/types';
import { PreviewLocaleSelector } from './PreviewLocaleSelector';
import { AlertTriangle } from 'lucide-react';
import './VideoPreview.css';
import './components.css';

export const VideoPreview: React.FC = () => {
  const {
    project,
    activePreset,
    playhead,
    isPlaying,
    setPlayhead,
    setIsPlaying,
    importVideo,
    relinkVideo,
    text,
  } = useProject();

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const relinkInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Bind the video element to the preview player
  useEffect(() => {
    if (videoRef.current && project.video?.blobUrl) {
      previewPlayer.setVideoElement(videoRef.current);
      // Sync track metadata to player
      previewPlayer.updateProject(project);
    }
  }, [project.video?.blobUrl, project, project.segments, project.audioAssets]);

  // Sync playhead state updates (react -> player)
  useEffect(() => {
    if (project.video?.blobUrl) {
      if (previewPlayer.isSelfUpdatingPlayhead) {
        previewPlayer.isSelfUpdatingPlayhead = false;
        return;
      }
      previewPlayer.seek(playhead);
    }
  }, [playhead, project.video?.blobUrl]);

  // Sync isPlaying state updates (react -> player)
  useEffect(() => {
    if (project.video?.blobUrl) {
      if (isPlaying) {
        previewPlayer.play();
      } else {
        previewPlayer.pause();
      }
    }
  }, [isPlaying, project.video?.blobUrl]);

  // Sync player callbacks (player -> react state)
  useEffect(() => {
    previewPlayer.onTimeUpdate((time) => {
      setPlayhead(time);
    });
    previewPlayer.onPlayPause((playing) => {
      setIsPlaying(playing);
    });

    return () => {
      previewPlayer.onTimeUpdate(() => {});
      previewPlayer.onPlayPause(() => {});
    };
  }, [setPlayhead, setIsPlaying]);

  // Handle original audio muting based on settings
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = project.settings.originalAudioMode === 'mute';
    }
  }, [project.settings.originalAudioMode]);

  // Extract video duration and dimensions, then import
  const processAndImportVideoFile = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = blobUrl;

    tempVideo.onloadedmetadata = () => {
      importVideo({
        name: file.name,
        size: file.size,
        duration: tempVideo.duration,
        width: tempVideo.videoWidth,
        height: tempVideo.videoHeight,
        aspectRatio: tempVideo.videoWidth / tempVideo.videoHeight,
        file: file,
      });
      URL.revokeObjectURL(blobUrl);
    };

    tempVideo.onerror = () => {
      console.error('Failed to load video metadata for file:', file.name);
      URL.revokeObjectURL(blobUrl);
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndImportVideoFile(file);
    }
  };

  const handleRelinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const success = relinkVideo(file);
      if (!success) {
        alert(`Selected file does not match the project video:\nExpected: ${project.video?.name}`);
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerRelinkInput = () => {
    relinkInputRef.current?.click();
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processAndImportVideoFile(file);
    }
  };

  const isVideoOffline = project.video && !project.video.blobUrl;
  const isVideoLoaded = project.video && project.video.blobUrl;
  const presetAspectRatio = activePreset.width / activePreset.height;

  // Create canvas measurer for text layout
  const measureText = useMemo(() => createCanvasMeasurer(), []);

  // Compute active text cues for current playhead
  const activeCues = useMemo(() => {
    if (!text.catalogs || !text.cues) return [];
    return text.cues.filter((cue) => {
      const resolved = { ...cue.base, ...cue.overrides };
      return isIntervalActive(resolved, playhead);
    });
  }, [text.cues, playhead]);

  // Compute laid-out cues for rendering
  const laidOutCues = useMemo(() => {
    if (activeCues.length === 0 || !text.previewLocale) return [];

    const catalog = text.catalogs[text.previewLocale];
    if (!catalog) return [];

    const frame = { width: activePreset.width, height: activePreset.height };

    return activeCues
      .map((cue) => {
        try {
          return layoutCue({
            cue,
            locale: text.previewLocale!,
            catalog,
            frame,
            measure: measureText,
          });
        } catch (error) {
          console.error('Failed to layout cue:', error);
          return null;
        }
      })
      .filter((cue): cue is NonNullable<typeof cue> => cue !== null);
  }, [activeCues, text.previewLocale, text.catalogs, activePreset, measureText]);

  // Check for overflow warnings
  const hasOverflow = laidOutCues.some((cue) => cue.overflow);

  // Compute text overlay position based on alignments
  const getTextOverlayStyle = (cue: any) => {
    const {
      safeAreaInset,
      blockWidth,
      blockHeight,
      horizontalAlign,
      verticalAlign,
      lineHeight,
      fontSize,
      color,
      fontFamily,
    } = cue;

    // Compute horizontal position
    let left: number;
    switch (horizontalAlign) {
      case 'left':
        left = safeAreaInset;
        break;
      case 'center':
        left = (activePreset.width - blockWidth) / 2;
        break;
      case 'right':
        left = activePreset.width - safeAreaInset - blockWidth;
        break;
      default:
        left = safeAreaInset;
    }

    // Clamp to safe area
    left = Math.max(safeAreaInset, Math.min(left, activePreset.width - safeAreaInset - blockWidth));

    // Compute vertical position
    let top: number;
    const verticalSafeAreaInset = activePreset.height * 0.05;
    const availableHeight = activePreset.height - 2 * verticalSafeAreaInset;
    switch (verticalAlign) {
      case 'top':
        top = verticalSafeAreaInset;
        break;
      case 'middle':
        top = verticalSafeAreaInset + (availableHeight - blockHeight) / 2;
        break;
      case 'bottom':
        top = activePreset.height - verticalSafeAreaInset - blockHeight;
        break;
      default:
        top = activePreset.height - verticalSafeAreaInset - blockHeight;
    }

    // Clamp to safe area
    top = Math.max(
      verticalSafeAreaInset,
      Math.min(top, activePreset.height - verticalSafeAreaInset - blockHeight),
    );

    // Font family CSS mapping (data-driven via FONT_ASSET)
    const fontFamilyCss = FONT_ASSET[fontFamily].cssFamily;

    return {
      position: 'absolute' as const,
      // Position/size in % of the device-screen, font in cqh, so the overlay
      // scales with the rendered preview (which is CSS-sized, not preset-sized).
      left: `${(left / activePreset.width) * 100}%`,
      top: `${(top / activePreset.height) * 100}%`,
      width: `${(blockWidth / activePreset.width) * 100}%`,
      height: `${(blockHeight / activePreset.height) * 100}%`,
      fontFamily: fontFamilyCss,
      fontSize: `${(fontSize / activePreset.height) * 100}cqh`,
      lineHeight: `${(lineHeight / activePreset.height) * 100}cqh`,
      color: color,
      textAlign: horizontalAlign,
      whiteSpace: 'pre-wrap',
      overflow: 'hidden',
    };
  };

  return (
    <div
      className='video-preview-wrapper'
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ border: isDragOver ? '2px dashed #6366f1' : 'none' }}
    >
      {/* Target Store Preset Badge */}
      {project.video && (
        <div className='preset-badge'>
          {activePreset.name} ({project.settings.fitMode.toUpperCase()})
        </div>
      )}

      {/* Preview Locale Selector */}
      {project.video && text.previewLocale && Object.keys(text.catalogs).length > 0 && (
        <PreviewLocaleSelector />
      )}

      {/* Overflow Warning Banner */}
      {hasOverflow && isVideoLoaded && (
        <div className='text-overflow-warning'>
          <AlertTriangle size={16} />
          <span>Text exceeds safe area boundaries</span>
        </div>
      )}

      {/* Main Viewport Mock Device Frame */}
      <div
        className='device-frame'
        data-orientation={presetAspectRatio >= 1 ? 'landscape' : 'portrait'}
        style={{ '--preset-aspect-ratio': presetAspectRatio } as React.CSSProperties}
      >
        {/* Device elements */}
        {activePreset.platform === 'ios' && <div className='device-notch' />}
        <div className='device-home-bar' />

        {/* Viewport Screen */}
        <div className={`device-screen fit-mode-${project.settings.fitMode}`}>
          {isVideoLoaded ? (
            <>
              <video
                ref={videoRef}
                className='preview-video'
                src={project.video!.blobUrl}
                playsInline
                muted={project.settings.originalAudioMode === 'mute'}
                preload='auto'
              />
              {/* Text Overlay Container */}
              {laidOutCues.length > 0 && (
                <div className='text-overlay-container'>
                  {laidOutCues.map((cue) => (
                    <div key={cue.id} className='text-overlay' style={getTextOverlayStyle(cue)}>
                      {cue.lines.map((line, lineIdx) => (
                        <div key={lineIdx} className='text-overlay-line'>
                          {line}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {/* Optional overlay borders to indicate visual safe area constraints */}
              <div className='safe-area-guide' />
            </>
          ) : isVideoOffline ? (
            /* Offline File State (e.g. from restored draft) */
            <div className='relink-container'>
              <svg
                className='relink-warning-icon'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                />
              </svg>
              <h3>Video File Offline</h3>
              <p>
                The draft was restored, but you need to relink the video file: <br />
                <strong>{project.video!.name}</strong>
              </p>
              <button className='relink-btn' onClick={triggerRelinkInput}>
                Relink Video File
              </button>
              <input
                type='file'
                ref={relinkInputRef}
                className='preview-file-input'
                accept='video/*'
                onChange={handleRelinkChange}
              />
            </div>
          ) : (
            /* Empty State (Drag & Drop or Click to import) */
            <div className='preview-empty-state' onClick={triggerFileInput}>
              <svg
                className='preview-empty-icon'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
                />
              </svg>
              <h3>Import a Video</h3>
              <p>Drag and drop a video here, or click to browse files from your computer.</p>
              <input
                type='file'
                ref={fileInputRef}
                className='preview-file-input'
                accept='video/*'
                onChange={handleFileChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
