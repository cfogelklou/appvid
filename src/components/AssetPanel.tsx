import React, { useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { Music, Plus, Trash2, AlertTriangle, FileAudio } from 'lucide-react';
import { getAudioPeaks, getWavDuration } from '../utils/audioWaveform';
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
        tempAudio.addEventListener('loadedmetadata', async () => {
          let duration = tempAudio.duration;
          // Fallback to WAV parser check if loaded duration is 0 or NaN
          if (isNaN(duration) || duration <= 0) {
            const wavDur = await getWavDuration(file);
            duration = wavDur !== null ? wavDur : Math.max(0.5, (file.size * 8) / 128000);
          }
          const peaks = await getAudioPeaks(file);
          importAudio(file, duration, peaks);
          URL.revokeObjectURL(objectUrl);
        });
        tempAudio.addEventListener('error', async () => {
          console.error(`Failed to load audio metadata for ${file.name}`);
          // 1. Try WAV header parser
          let duration = await getWavDuration(file);
          // 2. Fallback to estimation based on file size (assuming standard 128kbps)
          if (duration === null || duration <= 0) {
            duration = Math.max(0.5, (file.size * 8) / 128000);
          }
          const peaks = await getAudioPeaks(file);
          importAudio(file, duration, peaks);
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
          <>
            <p className="asset-panel-hint" style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '14px', lineHeight: '1.4', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              💡 Click <strong>Place at Playhead</strong> on any imported file to add it onto the timeline.
            </p>
            {project.audioAssets.map(asset => (
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

                <div className="asset-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '10px', width: '100%' }}>
                  {asset.duration === 0 && (
                    <span className="warning-badge" title="Failed to read duration. Placing might be unreliable.">
                      <AlertTriangle size={14} />
                    </span>
                  )}
                  {asset.placedCount > 0 && (
                    <span className="placed-badge" title={`Placed ${asset.placedCount} times`} style={{ display: 'inline-flex', alignItems: 'center', height: '28px', padding: '0 8px', fontSize: '11px', background: 'var(--color-bg-card)', border: '1px solid var(--border)', borderRadius: '4px' }}>
                      x{asset.placedCount}
                    </span>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '28px', fontSize: '11px' }}
                    onClick={() => addSegment(asset.id)}
                    title="Place at playhead"
                  >
                    <Plus size={12} />
                    <span>Place at Playhead</span>
                  </button>
                  <button
                    className="btn-icon btn-danger-light"
                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
                    onClick={() => removeAudio(asset.id)}
                    title="Remove asset"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
export default AssetPanel;
