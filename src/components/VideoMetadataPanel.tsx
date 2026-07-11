import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import type { VideoAssetMetadata } from '../types';
import './components.css';

interface VideoMetadataPanelProps {
  file?: File | null;
  onCancel?: () => void;
  onImportComplete?: () => void;
}

export const VideoMetadataPanel: React.FC<VideoMetadataPanelProps> = ({
  file,
  onCancel,
  onImportComplete,
}) => {
  const { project, importVideo } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local metadata parsed from a new file
  const [parsedMetadata, setParsedMetadata] = useState<{
    width: number;
    height: number;
    duration: number;
    aspectRatio: number;
  } | null>(null);

  // Load and parse the new file using hidden video element
  useEffect(() => {
    if (!file) {
      setParsedMetadata(null);
      return;
    }

    setLoading(true);
    setError(null);
    setParsedMetadata(null);

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    const handleLoadedMetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;
      const aspectRatio = width / height;

      setParsedMetadata({
        width,
        height,
        duration,
        aspectRatio,
      });
      setLoading(false);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const handleError = () => {
      setError(
        'Failed to load video metadata. The file might be corrupted or in an unsupported format.',
      );
      setLoading(false);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }, [file]);

  const handleConfirmImport = () => {
    if (!file || !parsedMetadata) return;

    importVideo({
      name: file.name,
      size: file.size,
      duration: parsedMetadata.duration,
      width: parsedMetadata.width,
      height: parsedMetadata.height,
      aspectRatio: parsedMetadata.aspectRatio,
      file,
    });

    if (onImportComplete) {
      onImportComplete();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Determine which metadata to display
  const activeVideo: VideoAssetMetadata | null = project.video;
  const isNewFile = !!file;

  const displayName = isNewFile ? file.name : activeVideo?.name || '';
  const displaySize = isNewFile ? file.size || 0 : activeVideo?.size || 0;
  const displayWidth = isNewFile ? parsedMetadata?.width || 0 : activeVideo?.width || 0;
  const displayHeight = isNewFile ? parsedMetadata?.height || 0 : activeVideo?.height || 0;
  const displayDuration = isNewFile ? parsedMetadata?.duration || 0 : activeVideo?.duration || 0;
  const displayAspectRatio = isNewFile
    ? parsedMetadata?.aspectRatio || 0
    : activeVideo?.aspectRatio || 0;

  const hasData = isNewFile ? !!parsedMetadata : !!activeVideo;

  if (loading) {
    return (
      <div className='appvid-card'>
        <div className='loading-spinner-container'>
          <div className='loading-spinner'></div>
          <p>Analyzing video file and extracting metadata...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='appvid-card'>
        <div className='warning-item red'>
          <span className='warning-icon-span'>⚠</span>
          <div>
            <strong>Import Error</strong>
            <p style={{ margin: '4px 0 0 0' }}>{error}</p>
          </div>
        </div>
        {onCancel && (
          <div className='metadata-actions' style={{ marginTop: '16px' }}>
            <button className='cancel-btn' type='button' onClick={onCancel}>
              Go Back
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!hasData) {
    return null;
  }

  // Calculate warnings
  const warnings: string[] = [];
  if (displayWidth >= displayHeight || displayAspectRatio >= 1.0) {
    warnings.push(
      'Orientation: Video is landscape or square. App Store previews must be in portrait orientation.',
    );
  }
  if (displaySize > 100 * 1024 * 1024) {
    warnings.push(
      `File Size: Video file size is large (${formatSize(displaySize)}). Large recordings may cause browser out-of-memory crashes during encoding, especially on mobile.`,
    );
  }
  if (displayDuration < 15 || displayDuration > 30) {
    warnings.push(
      `Duration: Video is ${displayDuration.toFixed(1)}s. App Store previews are strictly required to be between 15.0 and 30.0 seconds.`,
    );
  }

  return (
    <div className='metadata-panel appvid-card'>
      <h3 className='import-title' style={{ marginBottom: '8px' }}>
        {isNewFile ? 'Review Screen Recording' : 'Screen Recording Metadata'}
      </h3>

      <div className='metadata-grid'>
        <div className='metadata-item full-width'>
          <span className='metadata-label'>File Name</span>
          <span className='metadata-value'>{displayName}</span>
        </div>
        <div className='metadata-item'>
          <span className='metadata-label'>File Size</span>
          <span className='metadata-value'>{formatSize(displaySize)}</span>
        </div>
        <div className='metadata-item'>
          <span className='metadata-label'>Duration</span>
          <span className='metadata-value'>{formatDuration(displayDuration)}</span>
        </div>
        <div className='metadata-item'>
          <span className='metadata-label'>Resolution</span>
          <span className='metadata-value'>
            {displayWidth} × {displayHeight}
          </span>
        </div>
        <div className='metadata-item'>
          <span className='metadata-label'>Aspect Ratio</span>
          <span className='metadata-value'>
            {displayAspectRatio.toFixed(2)} (
            {displayWidth > displayHeight
              ? 'Landscape'
              : displayWidth === displayHeight
                ? 'Square'
                : 'Portrait'}
            )
          </span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className='warnings-list'>
          <h4 style={{ margin: '8px 0 4px 0', fontSize: '0.85rem', color: 'var(--color-warning)' }}>
            Compliance Warnings ({warnings.length})
          </h4>
          {warnings.map((w, idx) => (
            <div key={idx} className='warning-item amber'>
              <span className='warning-icon-span'>⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {isNewFile && (
        <div className='metadata-actions' style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          {onCancel && (
            <button className='btn-secondary' type='button' onClick={onCancel} style={{ flex: 1, padding: '10px 16px', fontSize: '0.9rem', width: 'auto' }}>
              Cancel
            </button>
          )}
          <button className='btn-primary' type='button' onClick={handleConfirmImport} style={{ flex: 1.5, padding: '10px 16px', fontSize: '0.9rem', width: 'auto' }}>
            Confirm & Import Video
          </button>
        </div>
      )}
    </div>
  );
};
