import React, { useRef, useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { previewPlayer } from '../utils/previewPlayer';
import './VideoPreview.css';

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

      {/* Main Viewport Mock Device Frame */}
      <div
        className='device-frame'
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
                preload='auto'
              />
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
