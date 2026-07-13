import React, { useState, useMemo } from 'react';
import { useProject, getEditedVideoDuration } from '../context/ProjectContext';
import { STORE_PRESETS } from '../constants';
import { X, AlertTriangle, Check, Info } from 'lucide-react';
import { BUILT_IN_LOCALES } from '../text/constants';
import { validateLocaleKeys } from '../text/textPackage';
import { resolveTextCue } from '../text/types';
import { layoutCue, createCanvasMeasurer } from '../text/textLayout';
import type { LaidOutTextCue } from '../text/types';
import './components.css';

interface ExportSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: () => void;
  onStartBatchExport?: (batchInput: {
    items: Array<{ locale: string; cueLayouts: LaidOutTextCue[] }>;
  }) => void;
}

export const ExportSettingsSheet: React.FC<ExportSettingsSheetProps> = ({
  isOpen,
  onClose,
  onStartExport,
  onStartBatchExport,
}) => {
  const { project, updateSettings, text } = useProject();
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(new Set());

  const { video, settings } = project;
  const tw = settings.width;
  const th = settings.height;

  // Check if browser supports directory picker (Chromium only)
  const supportsDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Determine whether to show locale selector (only when text cues exist)
  const hasTextCues = text.cues.length > 0;

  // Get all imported locales
  const importedLocales = useMemo(() => Object.keys(text.catalogs), [text.catalogs]);

  // Compute resolved keys for validation
  const resolvedKeys = useMemo(() => {
    return text.cues.map(cue => resolveTextCue(cue).stringKey);
  }, [text.cues]);

  // Validate each imported locale for missing keys
  const localeValidations = useMemo(() => {
    const validations = new Map<string, { blocked: boolean; missingKeys: string[]; reasons: string[] }>();
    for (const locale of importedLocales) {
      const validation = validateLocaleKeys(resolvedKeys, locale, text.catalogs[locale]);
      validations.set(locale, {
        blocked: validation.blocked,
        missingKeys: validation.missingKeys,
        reasons: validation.reasons
      });
    }
    return validations;
  }, [importedLocales, resolvedKeys, text.catalogs]);

  // Initialize selected locales on first render or when imported locales change
  React.useEffect(() => {
    if (hasTextCues && importedLocales.length > 0) {
      setSelectedLocales(prev => {
        // Check if we need to initialize (empty set means first render)
        if (prev.size === 0) {
          const initialSet = new Set<string>();
          // Built-in locales are checked by default if imported
          for (const locale of importedLocales) {
            if (BUILT_IN_LOCALES.includes(locale)) {
              initialSet.add(locale);
            }
          }
          return initialSet;
        }
        // Clean up selections that are no longer imported
        const cleaned = new Set<string>();
        for (const locale of prev) {
          if (importedLocales.includes(locale)) {
            cleaned.add(locale);
          }
        }
        return cleaned;
      });
    }
  }, [hasTextCues, importedLocales]);

  if (!isOpen) return null;

  // Handle locale checkbox change
  const handleLocaleToggle = (locale: string) => {
    setSelectedLocales(prev => {
      const next = new Set(prev);
      if (next.has(locale)) {
        next.delete(locale);
      } else {
        next.add(locale);
      }
      return next;
    });
  };

  // Check if export should be disabled
  const isExportDisabled = !video || (hasTextCues && selectedLocales.size === 0);

  // Handle start export
  const handleStartExport = () => {
    if (isExportDisabled) return;

    if (hasTextCues && selectedLocales.size > 0) {
      // Batch export with selected locales
      if (!onStartBatchExport) {
        console.error('Batch export not supported in this environment');
        return;
      }

      // Prepare batch items with cue layouts for each selected locale
      const frameGeometry = { width: tw, height: th };
      const measure = createCanvasMeasurer();
      const batchItems = Array.from(selectedLocales).map(locale => {
        const catalog = text.catalogs[locale];
        const cueLayouts = text.cues.map(cue => {
          return layoutCue({ cue, locale, catalog, frame: frameGeometry, measure });
        });
        return { locale, cueLayouts };
      });

      onStartBatchExport({ items: batchItems });
    } else {
      // Single video export (no text or no locales selected)
      onStartExport();
    }
  };

  // Calculate warnings
  const warnings: string[] = [];
  if (video) {
    // 1. Duration warning: iOS App Store previews must be 15s to 30s
    const editedDuration = getEditedVideoDuration(project);
    if (editedDuration < 15 || editedDuration > 30) {
      warnings.push(
        `Duration is ${editedDuration.toFixed(1)}s. App Store Previews must be between 15 and 30 seconds.`
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
          {/* Multilingual Batch Export Section */}
          {hasTextCues && (
            <div className="sheet-section">
              <span className="sheet-section-title">Multilingual Text Export</span>

              {!supportsDirectoryPicker ? (
                <div className="info-panel">
                  <div className="info-panel-header">
                    <Info size={18} />
                    <span>Browser Limitation</span>
                  </div>
                  <p className="info-panel-text">
                    Batch export requires a Chromium-based browser (Chrome, Edge, Opera). Your browser doesn't support folder selection for batch export.
                  </p>
                  <p className="info-panel-text">
                    <strong>Single locale only:</strong> Select one locale below to export a single video file.
                  </p>
                </div>
              ) : null}

              {importedLocales.length === 0 ? (
                <div className="info-panel">
                  <p className="info-panel-text">
                    No locale catalogs imported yet. Import JSON files to enable multilingual export.
                  </p>
                </div>
              ) : (
                <div className="locale-checkbox-list">
                  {importedLocales.map(locale => {
                    const validation = localeValidations.get(locale);
                    const isBlocked = validation?.blocked ?? false;
                    const missingKeys = validation?.missingKeys ?? [];
                    const isSelected = selectedLocales.has(locale);

                    return (
                      <label key={locale} className="locale-checkbox-item">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleLocaleToggle(locale)}
                          disabled={isBlocked}
                          className="locale-checkbox-input"
                        />
                        <div className="locale-checkbox-content">
                          <span className="locale-name">{locale}</span>
                          {isBlocked && missingKeys.length > 0 && (
                            <span className="locale-blocked-reason">
                              Missing {missingKeys.length} key(s)
                            </span>
                          )}
                        </div>
                        {isBlocked && (
                          <div className="locale-missing-keys">
                            {missingKeys.join(', ')}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {selectedLocales.size === 0 && importedLocales.length > 0 && (
                <p className="locale-selection-hint">
                  Select at least one locale to enable export
                </p>
              )}
            </div>
          )}

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
              <button className="btn-primary" onClick={handleStartExport} disabled={isExportDisabled}>
                <AlertTriangle size={18} />
                Export Anyway
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Review Settings
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={handleStartExport} disabled={isExportDisabled}>
              <Check size={18} />
              {hasTextCues && selectedLocales.size > 0
                ? `Export ${selectedLocales.size} Locale${selectedLocales.size > 1 ? 's' : ''}`
                : `Export ${tw} x ${th} MP4`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
