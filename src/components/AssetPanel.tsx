import React, { useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { Music, Plus, Trash2, AlertTriangle, FileAudio } from 'lucide-react';
import './components.css';

export const AssetPanel: React.FC = () => {
  const { project, importAudio, removeAudio, addSegment } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        // Asynchronously get audio duration using HTMLAudioElement
        const objectUrl = URL.createObjectURL(file);
        const tempAudio = new Audio(objectUrl);
        tempAudio.addEventListener('loadedmetadata', () => {
          importAudio(file, tempAudio.duration);
          URL.revokeObjectURL(objectUrl);
        });
        tempAudio.addEventListener('error', () => {
          console.error(`Failed to load audio metadata for ${file.name}`);
          // Fallback to 0 if we can't read duration
          importAudio(file, 0);
          URL.revokeObjectURL(objectUrl);
        });
      });
    }
  };

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds === 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="asset-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Music size={18} />
          <span>Audio Assets</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleAddClick}>
          <Plus size={16} />
          <span>Add Audio</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="audio/*"
          multiple
          style={{ display: 'none' }}
        />
      </div>

      <div className="asset-list">
        {project.audioAssets.length === 0 ? (
          <div className="empty-assets">
            <FileAudio className="empty-icon" size={40} />
            <p>No audio files imported yet.</p>
            <p className="sub-text">Add MP3, WAV, or AAC voiceovers or music tracks to place on the timeline.</p>
          </div>
        ) : (
          project.audioAssets.map(asset => (
            <div key={asset.id} className="asset-card">
              <div className="asset-card-main">
                <FileAudio className="asset-icon" size={20} />
                <div className="asset-info">
                  <div className="asset-name" title={asset.name}>{asset.name}</div>
                  <div className="asset-meta">
                    <span>{formatDuration(asset.duration)}</span>
                    <span className="dot">•</span>
                    <span>{formatSize(asset.size)}</span>
                  </div>
                </div>
              </div>

              <div className="asset-card-actions">
                {asset.duration === 0 && (
                  <span className="warning-badge" title="Failed to read duration. Placing might be unreliable.">
                    <AlertTriangle size={14} />
                  </span>
                )}
                {asset.placedCount > 0 && (
                  <span className="placed-badge" title={`Placed ${asset.placedCount} times`}>
                    x{asset.placedCount}
                  </span>
                )}
                <button
                  className="btn-icon btn-primary-light"
                  onClick={() => addSegment(asset.id)}
                  title="Place at playhead"
                >
                  <Plus size={16} />
                </button>
                <button
                  className="btn-icon btn-danger-light"
                  onClick={() => removeAudio(asset.id)}
                  title="Remove asset"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default AssetPanel;
