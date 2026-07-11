import React from 'react';
import { useProject } from '../context/ProjectContext';
import { STORE_PRESETS } from '../constants';
import { X, AlertTriangle, Check } from 'lucide-react';
import './components.css';

interface ExportSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: () => void;
}

export const ExportSettingsSheet: React.FC<ExportSettingsSheetProps> = ({
  isOpen,
  onClose,
  onStartExport
}) => {
  const { project, updateSettings } = useProject();

  if (!isOpen) return null;

  const { video, settings } = project;
  const tw = settings.width;
  const th = settings.height;

  // Calculate warnings
  const warnings: string[] = [];
  if (video) {
    // 1. Duration warning: iOS App Store previews must be 15s to 30s
    if (video.duration < 15 || video.duration > 30) {
      warnings.push(
        `Duration is ${video.duration.toFixed(1)}s. App Store Previews must be between 15 and 30 seconds.`
      );
    }

    // 2. Aspect ratio mismatch warning
    const targetRatio = tw / th;
    const sourceRatio = video.aspectRatio;
    const ratioDifference = Math.abs(sourceRatio - targetRatio);
    if (ratioDifference > 0.02) {
      warnings.push(
        `Source aspect ratio (${sourceRatio.toFixed(2)}) differs from target preset (${targetRatio.toFixed(2)}). Video will be ${
          settings.fitMode === 'fit' ? 'fit with black bars' : 'filled and cropped'
        }.`
      );
    }

    // 3. Large file warning (Memory limits risk in browser)
    const mbSize = video.size / (1024 * 1024);
    if (mbSize > 100) {
      warnings.push(
        `Video size is large (${mbSize.toFixed(1)} MB). Processing large videos in-browser may exceed memory limits on mobile devices.`
      );
    }
  }

  const hasWarnings = warnings.length > 0;

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ presetId: e.target.value });
  };

  const handleFitModeChange = (mode: 'fit' | 'fill') => {
    updateSettings({ fitMode: mode });
  };

  const handleAudioModeChange = (mode: 'keep' | 'mute') => {
    updateSettings({ originalAudioMode: mode });
  };

  const handleCustomWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      updateSettings({ width: val });
    }
  };

  const handleCustomHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      updateSettings({ height: val });
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-container" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Export Video Settings</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        <div className="sheet-body">
          {/* Preset Selector */}
          <div className="sheet-section">
            <span className="sheet-section-title">Output Store Preset</span>
            <select
              className="form-select"
              value={settings.presetId}
              onChange={handlePresetChange}
            >
              {STORE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.width}x{preset.height})
                </option>
              ))}
            </select>

            {/* Custom dimensions if 'custom' selected */}
            {settings.presetId === 'custom' && (
              <div className="custom-dims-row">
                <div className="input-group">
                  <label htmlFor="custom-width">Width (px)</label>
                  <input
                    id="custom-width"
                    type="number"
                    className="form-input"
                    value={settings.width}
                    onChange={handleCustomWidthChange}
                    min="100"
                    max="4000"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="custom-height">Height (px)</label>
                  <input
                    id="custom-height"
                    type="number"
                    className="form-input"
                    value={settings.height}
                    onChange={handleCustomHeightChange}
                    min="100"
                    max="4000"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Scaling / Fit Mode Selector */}
          <div className="sheet-section">
            <span className="sheet-section-title">Fit & Scaling Mode</span>
            <div className="segmented-control">
              <button
                type="button"
                className={`segment-btn ${settings.fitMode === 'fit' ? 'active' : ''}`}
                onClick={() => handleFitModeChange('fit')}
              >
                Fit with Padding
              </button>
              <button
                type="button"
                className={`segment-btn ${settings.fitMode === 'fill' ? 'active' : ''}`}
                onClick={() => handleFitModeChange('fill')}
              >
                Fill and Crop
              </button>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {settings.fitMode === 'fit'
                ? 'Scales the video to fit within the target dimensions, adding black bars.'
                : 'Scales the video to fill the target dimensions, cropping the excess width or height.'}
            </p>
          </div>

          {/* Original Audio Setting */}
          <div className="sheet-section">
            <span className="sheet-section-title">Original Video Audio</span>
            <div className="segmented-control">
              <button
                type="button"
                className={`segment-btn ${settings.originalAudioMode === 'keep' ? 'active' : ''}`}
                onClick={() => handleAudioModeChange('keep')}
              >
                Keep Original Audio
              </button>
              <button
                type="button"
                className={`segment-btn ${settings.originalAudioMode === 'mute' ? 'active' : ''}`}
                onClick={() => handleAudioModeChange('mute')}
              >
                Mute Original Audio
              </button>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {settings.originalAudioMode === 'keep'
                ? 'The original recording audio will play in the background under placed clips.'
                : 'The original audio from the video is silenced. Only placed audio clips will play.'}
            </p>
          </div>

          {/* Quality Indicator */}
          <div className="sheet-section">
            <span className="sheet-section-title">Video Quality Preset</span>
            <div className="quality-display">
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>High Quality (AVC / H.264)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Targeting CRF 22, FastStart optimized for App Store upload.
                </div>
              </div>
              <span className="quality-badge">CRF 22</span>
            </div>
          </div>

          {/* Store Readiness Panel */}
          {video && hasWarnings && (
            <div className="warning-panel">
              <div className="warning-panel-header">
                <AlertTriangle size={18} />
                <span>Store Compliance Warnings</span>
              </div>
              <ul className="warning-list">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
              <div className="warning-note">
                This export may not meet App Store / Google Play preview requirements, but you can still export it.
              </div>
            </div>
          )}
        </div>

        <div className="sheet-footer">
          {hasWarnings ? (
            <>
              <button className="btn-primary" onClick={onStartExport}>
                <AlertTriangle size={18} />
                Export Anyway
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Review Settings
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={onStartExport} disabled={!video}>
              <Check size={18} />
              Export {tw} x {th} MP4
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
