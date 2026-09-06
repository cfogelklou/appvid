import React from 'react';
import { useProject, getEditedVideoDuration } from '../context/ProjectContext';
import './components.css';

export const StoreReadinessPanel: React.FC = () => {
  const { project, activePreset } = useProject();

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const video = project.video;

  if (!video) {
    return (
      <div className='readiness-panel appvid-card'>
        <h3 className='readiness-title'>Store Readiness</h3>
        <div className='readiness-empty'>
          No screen recording imported. Import a video file to analyze store compliance.
        </div>
      </div>
    );
  }

  const warnings: string[] = [];

  // 1. Duration Validation
  const duration = getEditedVideoDuration(project);
  if (duration < 15 || duration > 30) {
    warnings.push(
      `Duration: Video is ${duration.toFixed(1)}s. App previews must be between 15.0 and 30.0 seconds.`,
    );
  }

  // 2. Resolution Validation
  const targetWidth = project.settings.width;
  const targetHeight = project.settings.height;
  if (video.width !== targetWidth || video.height !== targetHeight) {
    warnings.push(
      `Resolution: Source resolution (${video.width}x${video.height}) differs from the target preset resolution (${targetWidth}x${targetHeight}).`,
    );
  }

  // 3. Aspect Ratio Validation
  const videoRatio = video.aspectRatio;
  const targetRatio = targetWidth / targetHeight;
  if (Math.abs(videoRatio - targetRatio) > 0.02) {
    warnings.push(
      `Aspect Ratio: Source aspect ratio (${videoRatio.toFixed(2)}) does not match the target aspect ratio (${targetRatio.toFixed(2)}). Scaling with '${project.settings.fitMode}' mode will add padding or crop edges.`,
    );
  }

  // 4. File Size Risk
  if (video.size > 100 * 1024 * 1024) {
    warnings.push(
      `File Size: Recording is large (${formatSize(video.size)}). Mobile browsers may encounter memory limits during local export.`,
    );
  }

  return (
    <div className='readiness-panel appvid-card'>
      <h3 className='readiness-title'>Store Readiness</h3>

      {warnings.length === 0 ? (
        <div className='warning-item success'>
          <span className='warning-icon-span'>✓</span>
          <div>
            <strong>Store Ready</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.825rem' }}>
              Your recording meets all requirements for {activePreset.name}!
            </p>
          </div>
        </div>
      ) : (
        <div className='warnings-list'>
          {warnings.map((warning, index) => (
            <div key={index} className='warning-item amber'>
              <span className='warning-icon-span'>⚠</span>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className='readiness-banner'>
        <span className='readiness-banner-icon'>ℹ</span>
        <span>
          This export may not meet store preview requirements, but you can still export it.
        </span>
      </div>
    </div>
  );
};
