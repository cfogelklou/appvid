import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { STORE_PRESETS } from '../constants';
import './components.css';

export const StorePresetSelector: React.FC = () => {
  const { project, updateSettings } = useProject();

  const [customWidth, setCustomWidth] = useState<string>(project.settings.width.toString());
  const [customHeight, setCustomHeight] = useState<string>(project.settings.height.toString());

  // Keep custom input states in sync with settings when settings change
  useEffect(() => {
    setCustomWidth(project.settings.width.toString());
    setCustomHeight(project.settings.height.toString());
  }, [project.settings.width, project.settings.height]);

  const handlePresetSelect = (presetId: string) => {
    updateSettings({ presetId });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string so user can delete and type
    setCustomWidth(val);

    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      updateSettings({ width: parsed });
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string so user can delete and type
    setCustomHeight(val);

    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      updateSettings({ height: parsed });
    }
  };

  return (
    <div className='preset-selector appvid-card'>
      <div className='preset-title-row'>
        <h3 className='import-title'>Store Export Preset</h3>
        <span className='platform-badge ios' style={{ textTransform: 'none' }}>
          Target: {project.settings.width} × {project.settings.height}
        </span>
      </div>
      <p className='preset-subtitle'>
        Select the target store layout and resolution requirements. AppVid will scale or pad your
        video during export to match these exact dimensions.
      </p>

      <div className='preset-grid'>
        {STORE_PRESETS.map((preset) => {
          const isActive = project.settings.presetId === preset.id;
          return (
            <div
              key={preset.id}
              className={`preset-card ${isActive ? 'active' : ''}`}
              onClick={() => handlePresetSelect(preset.id)}
            >
              <div className='preset-header'>
                <span className='preset-name'>{preset.name}</span>
                <span className={`platform-badge ${preset.platform}`}>{preset.platform}</span>
              </div>
              <p className='preset-desc'>{preset.description}</p>
            </div>
          );
        })}
      </div>

      {project.settings.presetId === 'custom' && (
        <div className='custom-dimensions-form'>
          <div className='custom-input-group'>
            <label htmlFor='custom-width'>Width</label>
            <div className='custom-input-wrapper'>
              <input
                id='custom-width'
                type='number'
                min='1'
                step='1'
                className='custom-input'
                value={customWidth}
                onChange={handleWidthChange}
                placeholder='e.g. 1080'
              />
              <span className='custom-input-suffix'>px</span>
            </div>
          </div>

          <div className='custom-input-group'>
            <label htmlFor='custom-height'>Height</label>
            <div className='custom-input-wrapper'>
              <input
                id='custom-height'
                type='number'
                min='1'
                step='1'
                className='custom-input'
                value={customHeight}
                onChange={handleHeightChange}
                placeholder='e.g. 1920'
              />
              <span className='custom-input-suffix'>px</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
