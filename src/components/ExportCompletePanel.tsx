import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Check, Download, Share2, ArrowLeft, ShieldCheck } from 'lucide-react';
import './components.css';

interface ExportCompletePanelProps {
  outputBlob: Blob;
  onClose: () => void;
}

export const ExportCompletePanel: React.FC<ExportCompletePanelProps> = ({
  outputBlob,
  onClose
}) => {
  const { project, activePreset } = useProject();
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [canShare, setCanShare] = useState<boolean>(false);

  // Generate Blob URL and clean up on unmount
  useEffect(() => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    setBlobUrl(url);

    // Check share capability
    const testFile = new File([outputBlob], 'test.mp4', { type: 'video/mp4' });
    setCanShare(!!(navigator.share && navigator.canShare && navigator.canShare({ files: [testFile] })));

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [outputBlob]);

  // Programmatic download
  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    
    // Construct friendly filename
    const baseName = project.video
      ? project.video.name.replace(/\.[^/.]+$/, '')
      : 'export';
    a.download = `${baseName}_preview.mp4`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Web Share API support
  const handleShare = async () => {
    if (!outputBlob) return;
    try {
      const baseName = project.video
        ? project.video.name.replace(/\.[^/.]+$/, '')
        : 'export';
      const file = new File([outputBlob], `${baseName}_preview.mp4`, { type: 'video/mp4' });
      await navigator.share({
        files: [file],
        title: 'App Preview Video',
        text: 'Created with AppVid.',
      });
    } catch (e) {
      console.warn('Share cancelled or failed:', e);
    }
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="complete-overlay">
      <div className="complete-container">
        <div className="complete-header">
          <div className="complete-icon">
            <Check size={28} />
          </div>
          <h2 className="complete-title">Export Complete!</h2>
          <p className="complete-subtitle">Your app preview video was successfully created and optimized.</p>
        </div>

        <div className="preview-layout">
          {/* Native video preview */}
          <div className="output-preview-container">
            {blobUrl && (
              <video
                className="output-preview-video"
                src={blobUrl}
                controls
                playsInline
                loop
                autoPlay
                muted
              />
            )}
          </div>

          {/* Info and Actions */}
          <div className="info-layout">
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Resolution</span>
                <span className="stat-value">{project.settings.width} × {project.settings.height}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">File Size</span>
                <span className="stat-value">{formatSize(outputBlob.size)}</span>
              </div>
              <div className="stat-card" style={{ gridColumn: 'span 2' }}>
                <span className="stat-label">Target Preset</span>
                <span className="stat-value">{activePreset.name}</span>
              </div>
            </div>

            <div className="privacy-notice-panel">
              <ShieldCheck size={20} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
              <div className="privacy-notice-text">
                <strong>Exported Locally:</strong> No files were uploaded to a server. The final rendering and MP4 encoding occurred entirely within this browser tab.
              </div>
            </div>

            <div className="action-row">
              <button type="button" className="btn-primary" onClick={handleDownload}>
                <Download size={18} />
                Download Video
              </button>

              {canShare && (
                <button type="button" className="btn-secondary" onClick={handleShare} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Share2 size={16} />
                  Share Video
                </button>
              )}

              <button type="button" className="btn-secondary" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                <ArrowLeft size={16} />
                Back to Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExportCompletePanel;
