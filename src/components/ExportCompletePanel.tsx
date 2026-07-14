import React from 'react';
import { Check, X, AlertTriangle, Download, RotateCcw, ArrowLeft, Share2, ShieldCheck } from 'lucide-react';
import type { BatchRecoveryItem } from '../text/types';
import { useProject } from '../context/ProjectContext';
import './components.css';

interface ExportCompletePanelProps {
  // For single video export (existing behavior)
  outputBlob?: Blob;
  onSingleClose?: () => void;

  // For batch export (new behavior)
  batchItems?: BatchRecoveryItem[];
  onDownloadSingle?: (locale: string) => void;
  onDownloadAll?: () => void;
  onExportMore?: () => void;
  projectFileName?: string;
}

const statusConfig = {
  queued: { label: 'Queued', color: '#6b7280', icon: null },
  blocked: { label: 'Blocked', color: '#f59e0b', icon: AlertTriangle },
  rendering: { label: 'Rendering', color: '#3b82f6', icon: null },
  writing: { label: 'Writing', color: '#3b82f6', icon: null },
  completed: { label: 'Completed', color: '#10b981', icon: Check },
  failed: { label: 'Failed', color: '#ef4444', icon: X },
  cancelled: { label: 'Cancelled', color: '#6b7280', icon: null },
};

export const ExportCompletePanel: React.FC<ExportCompletePanelProps> = ({
  outputBlob,
  onSingleClose,
  batchItems,
  onDownloadSingle,
  onDownloadAll,
  onExportMore,
  projectFileName: _projectFileName,
}) => {
  // Determine which mode to render
  const isBatchMode = batchItems && batchItems.length > 0;

  // Single export mode (existing behavior)
  if (!isBatchMode && outputBlob) {
    return <SingleExportComplete outputBlob={outputBlob} onClose={onSingleClose || (() => {})} />;
  }

  // Batch export mode (new behavior)
  if (isBatchMode && batchItems) {
    const completedCount = batchItems.filter(i => i.status === 'completed').length;
    const failedCount = batchItems.filter(i => i.status === 'failed').length;
    const totalCount = batchItems.length;
    const allComplete = totalCount > 0 && completedCount + failedCount === totalCount;

    return (
      <div className="export-complete-container">
        <div className="export-complete-header">
          <h2>Export Complete</h2>
          <p className="export-complete-subtitle">
            {completedCount} of {totalCount} locale{totalCount > 1 ? 's' : ''} exported successfully
            {failedCount > 0 && ` (${failedCount} failed)`}
          </p>
        </div>

        {/* Results Table */}
        <div className="export-results-table">
          <table className="export-table">
            <thead>
              <tr>
                <th>Locale</th>
                <th>Status</th>
                <th>Message</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batchItems.map(item => {
                const config = statusConfig[item.status as keyof typeof statusConfig];
                const StatusIcon = config.icon;

                return (
                  <tr key={item.locale}>
                    <td className="locale-cell">{item.locale}</td>
                    <td className="status-cell">
                      <span
                        className="status-badge"
                        style={{ backgroundColor: `${config.color}20`, color: config.color }}
                      >
                        {StatusIcon && <StatusIcon size={14} />}
                        {config.label}
                      </span>
                    </td>
                    <td className="message-cell">
                      {item.message || '-'}
                    </td>
                    <td className="action-cell">
                      {item.status === 'completed' && onDownloadSingle && (
                        <button
                          className="btn-download-single"
                          onClick={() => onDownloadSingle(item.locale)}
                          title={`Download ${item.locale}`}
                        >
                          <Download size={16} />
                          <span>Download</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="export-complete-footer">
          {onDownloadAll && allComplete && completedCount > 1 && (
            <button className="btn-primary" onClick={onDownloadAll}>
              <Download size={18} />
              Download All as ZIP
            </button>
          )}

          {onExportMore && (
            <button className="btn-secondary" onClick={onExportMore}>
              <RotateCcw size={18} />
              Export More
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

// Single export completion component (existing behavior preserved)
const SingleExportComplete: React.FC<{ outputBlob: Blob; onClose: () => void }> = ({
  outputBlob,
  onClose,
}) => {
  const { activePreset } = useProject();
  // The exported video is rendered at the preset dimensions, so mirror that
  // aspect ratio onto the preview container to avoid letterboxing/collapse.
  const presetAspectRatio = activePreset.width / activePreset.height;

  const [blobUrl, setBlobUrl] = React.useState<string>('');
  const [canShare, setCanShare] = React.useState<boolean>(false);

  // Generate Blob URL and clean up on unmount
  React.useEffect(() => {
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
    a.download = `export_preview.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Web Share API support
  const handleShare = async () => {
    if (!outputBlob) return;
    try {
      const file = new File([outputBlob], `export_preview.mp4`, { type: 'video/mp4' });
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
          <div
            className="output-preview-container"
            data-orientation={presetAspectRatio >= 1 ? 'landscape' : 'portrait'}
            style={{ '--preset-aspect-ratio': presetAspectRatio } as React.CSSProperties}
          >
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
                <span className="stat-label">File Size</span>
                <span className="stat-value">{formatSize(outputBlob.size)}</span>
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
