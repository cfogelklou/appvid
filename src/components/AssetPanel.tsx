import React, { useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { Music, Plus, Trash2, AlertTriangle, FileAudio, Type } from 'lucide-react';
import { getAudioPeaks, getWavDuration } from '../utils/audioWaveform';
import { TextAssetPanel } from './TextAssetPanel';
import './components.css';

export const AssetPanel: React.FC = () => {
  const { project, importAudio, removeAudio, addSegment } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = React.useState<'audio' | 'text'>('audio');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => {
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
    <div className='asset-panel'>
      {/* Tab Navigation */}
      <div className='asset-tabs'>
        <button
          className={`asset-tab ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveTab('audio')}
        >
          <Music size={16} />
          <span>Audio</span>
        </button>
        <button
          className={`asset-tab ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          <Type size={16} />
          <span>Text</span>
        </button>
      </div>

      {/* Audio Section */}
      {activeTab === 'audio' && (
        <>
          <div className='panel-header'>
            <div className='panel-title'>
              <Music size={18} />
              <span>Audio Assets</span>
            </div>
            <button className='btn btn-secondary btn-sm' onClick={handleAddClick}>
              <Plus size={16} />
              <span>Add Audio</span>
            </button>
            <input
              type='file'
              ref={fileInputRef}
              onChange={handleFileChange}
              accept='audio/*'
              multiple
              style={{ display: 'none' }}
            />
          </div>

          <div className='asset-list'>
            {project.audioAssets.length === 0 ? (
              <div className='empty-assets'>
                <FileAudio className='empty-icon' size={40} />
                <p>No audio files imported yet.</p>
                <p className='sub-text'>
                  Add MP3, WAV, or AAC voiceovers or music tracks to place on the timeline.
                </p>
              </div>
            ) : (
              <>
                <p
                  className='asset-panel-hint'
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)',
                    marginBottom: '14px',
                    lineHeight: '1.4',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  💡 Click <strong>Place at Playhead</strong> on any imported file to add it onto
                  the timeline.
                </p>
                {project.audioAssets.map((asset) => (
                  <div key={asset.id} className='asset-card'>
                    <div className='asset-card-main'>
                      <FileAudio className='asset-icon' size={18} />
                      <div className='asset-info'>
                        <div className='asset-name' title={asset.name}>
                          {asset.name}
                        </div>
                        <div className='asset-meta'>
                          <span>{formatDuration(asset.duration)}</span>
                          <span className='dot'>•</span>
                          <span>{formatSize(asset.size)}</span>
                        </div>
                      </div>
                    </div>

                    <div className='asset-card-actions'>
                      {asset.duration === 0 && (
                        <span
                          className='warning-badge'
                          title='Failed to read duration. Placing might be unreliable.'
                        >
                          <AlertTriangle size={14} />
                        </span>
                      )}
                      {asset.placedCount > 0 && (
                        <span
                          className='placed-badge'
                          title={`Placed ${asset.placedCount} times`}
                        >
                          x{asset.placedCount}
                        </span>
                      )}
                      <button
                        className='btn btn-primary btn-sm asset-place-btn'
                        onClick={() => addSegment(asset.id)}
                        title='Place at playhead'
                      >
                        <Plus size={12} />
                        <span>Place</span>
                      </button>
                      <button
                        className='btn-icon btn-danger-light asset-delete-btn'
                        onClick={() => removeAudio(asset.id)}
                        title='Remove asset'
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* Text Section */}
      {activeTab === 'text' && <TextAssetPanel />}
    </div>
  );
};
export default AssetPanel;
