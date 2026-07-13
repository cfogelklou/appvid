import React, { useState, useEffect } from 'react';
import { useProject, getEditedVideoDuration } from '../context/ProjectContext';
import { Trash2, Anchor, Sparkles } from 'lucide-react';
import { parseTimecode, formatTimecode, formatStopLabel } from '../utils/timecode';
import { normalizeColor } from '../utils/colorUtils';
import type { ProjectSelection } from '../text/types';
import { DEFAULT_HORIZONTAL_ALIGN, DEFAULT_VERTICAL_ALIGN, DEFAULT_TEXT_COLOR, DEFAULT_FONT_SIZE } from '../text/constants';
import type { HorizontalTextAlign, VerticalTextAlign } from '../text/types';
import './ClipInspector.css';

export const ClipInspector: React.FC = () => {
  const {
    project,
    playhead,
    selectedSegmentId,
    updateSegment,
    removeSegment,
    text,
    updateTextCue,
    deleteTextCue,
  } = useProject();

  // Determine selection kind (audio vs text)
  const selection: ProjectSelection = selectedSegmentId
    ? (text.cues.find(c => c.id === selectedSegmentId)
        ? { kind: 'text', id: selectedSegmentId }
        : { kind: 'audio', id: selectedSegmentId })
    : null;

  // Find the selected segment and its asset (audio only)
  const selectedSegment = selection?.kind === 'audio'
    ? project.segments.find((s) => s.id === selection.id)
    : null;
  const asset = selectedSegment
    ? project.audioAssets.find((a) => a.id === selectedSegment.assetId)
    : null;

  // Find selected text cue (text only)
  const selectedTextCue = selection?.kind === 'text'
    ? text.cues.find((c) => c.id === selection.id)
    : null;

  // Local state for start time input to allow smooth typing without lag
  const [startTimeInput, setStartTimeInput] = useState('');

  // Local state for text cue inputs
  const [textStringKeyInput, setTextStringKeyInput] = useState('');
  const [textStartTimeInput, setTextStartTimeInput] = useState('');
  const [textDurationInput, setTextDurationInput] = useState('');
  const [textColorInput, setTextColorInput] = useState('');
  const [textFontSizeInput, setTextFontSizeInput] = useState('');
  const [textHorizontalAlign, setTextHorizontalAlign] = useState<HorizontalTextAlign>(DEFAULT_HORIZONTAL_ALIGN);
  const [textVerticalAlign, setTextVerticalAlign] = useState<VerticalTextAlign>(DEFAULT_VERTICAL_ALIGN);

  // Get all catalog keys for dropdown
  const catalogKeys = Object.keys(text.catalogs).length > 0
    ? Object.values(text.catalogs).flatMap(c => Object.keys(c.strings))
    : [];

  // Update text cue inputs when text cue selection changes
  useEffect(() => {
    if (selectedTextCue) {
      const resolved = selectedTextCue; // Use the resolved cue (base merged with overrides)
      setTextStringKeyInput(resolved.base.stringKey || '');
      setTextStartTimeInput(formatTimecode(resolved.base.startTime));
      setTextDurationInput(resolved.base.duration.toString());
      setTextColorInput(resolved.base.color || DEFAULT_TEXT_COLOR);
      setTextFontSizeInput(resolved.base.fontSize.toString());
      setTextHorizontalAlign(resolved.base.horizontalAlign || DEFAULT_HORIZONTAL_ALIGN);
      setTextVerticalAlign(resolved.base.verticalAlign || DEFAULT_VERTICAL_ALIGN);
    } else {
      setTextStringKeyInput('');
      setTextStartTimeInput('');
      setTextDurationInput('');
      setTextColorInput(DEFAULT_TEXT_COLOR);
      setTextFontSizeInput(DEFAULT_FONT_SIZE.toString());
      setTextHorizontalAlign(DEFAULT_HORIZONTAL_ALIGN);
      setTextVerticalAlign(DEFAULT_VERTICAL_ALIGN);
    }
  }, [selectedTextCue]);

  // Show empty state when nothing selected
  if (!selection) {
    return (
      <div className='clip-inspector-empty'>
        <Sparkles size={24} className='inspector-empty-icon' />
        <h3>Clip Inspector</h3>
        <p>Select a clip in the timeline to view settings and nudge position.</p>
      </div>
    );
  }

  // Audio inspector handlers
  const handleAudioStartTimeBlur = () => {
    if (!selectedSegment) return;
    const parsed = parseTimecode(startTimeInput);
    if (parsed !== null && parsed >= 0) {
      // Clamp to video duration if video exists
      let finalTime = parsed;
      if (project.video) {
        finalTime = Math.min(parsed, getEditedVideoDuration(project));
      }
      updateSegment(selectedSegment.id, { startTime: finalTime });
      setStartTimeInput(formatTimecode(finalTime));
    } else {
      // Revert if invalid
      setStartTimeInput(formatTimecode(selectedSegment.startTime));
    }
  };

  const handleAudioStartTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAudioStartTimeBlur();
      e.currentTarget.blur();
    }
  };

  const audioNudge = (delta: number) => {
    if (!selectedSegment) return;
    const newTime = Math.max(0, selectedSegment.startTime + delta);
    updateSegment(selectedSegment.id, { startTime: newTime });
  };

  const handleAudioAlignToPlayhead = () => {
    if (!selectedSegment) return;
    updateSegment(selectedSegment.id, { startTime: playhead });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedSegment) return;
    const volume = parseFloat(e.target.value) / 100;
    updateSegment(selectedSegment.id, { volume });
  };

  // Text inspector handlers
  const handleTextStringKeyChange = (value: string) => {
    setTextStringKeyInput(value);
    if (selectedTextCue && value.trim()) {
      updateTextCue(selectedTextCue.id, { stringKey: value.trim() });
    }
  };

  const handleTextStartTimeBlur = () => {
    if (!selectedTextCue) return;
    const parsed = parseTimecode(textStartTimeInput);
    if (parsed !== null && parsed >= 0) {
      let finalTime = parsed;
      if (project.video) {
        finalTime = Math.min(parsed, getEditedVideoDuration(project));
      }
      updateTextCue(selectedTextCue.id, { startTime: finalTime });
      setTextStartTimeInput(formatTimecode(finalTime));
    } else {
      // Revert if invalid
      setTextStartTimeInput(formatTimecode(selectedTextCue.base.startTime));
    }
  };

  const handleTextStartTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTextStartTimeBlur();
      e.currentTarget.blur();
    }
  };

  const handleTextDurationBlur = () => {
    if (!selectedTextCue) return;
    const parsed = parseFloat(textDurationInput);
    if (!isNaN(parsed) && parsed > 0) {
      updateTextCue(selectedTextCue.id, { duration: parsed });
      setTextDurationInput(parsed.toString());
    } else {
      // Revert if invalid
      setTextDurationInput(selectedTextCue.base.duration.toString());
    }
  };

  const handleTextDurationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTextDurationBlur();
      e.currentTarget.blur();
    }
  };

  const handleTextColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeColor(e.target.value);
    setTextColorInput(normalized);
    if (selectedTextCue) {
      updateTextCue(selectedTextCue.id, { color: normalized });
    }
  };

  const handleTextFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTextFontSizeInput(value);
    if (selectedTextCue) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) {
        updateTextCue(selectedTextCue.id, { fontSize: parsed });
      }
    }
  };

  const handleTextAlignToPlayhead = () => {
    if (!selectedTextCue) return;
    updateTextCue(selectedTextCue.id, { startTime: playhead });
    setTextStartTimeInput(formatTimecode(playhead));
  };

  const handleResetToDefaults = () => {
    if (!selectedTextCue) return;
    // Reset to imported defaults by clearing overrides (pass base as updates, overridesOnly=false)
    updateTextCue(selectedTextCue.id, { ...selectedTextCue.base, overridesOnly: false as any });
  };

  const handleDeleteTextCue = () => {
    if (!selectedTextCue) return;
    deleteTextCue(selectedTextCue.id);
  };

  // Render text inspector
  if (selection.kind === 'text' && selectedTextCue) {
    const resolved = selectedTextCue;
    const stopTime = resolved.base.startTime + resolved.base.duration;

    return (
      <div className='clip-inspector-panel'>
        <h3 className='inspector-title'>Text Cue Inspector</h3>

        <div className='inspector-section'>
          <label className='section-label' htmlFor='text-string-key'>
            String Key
          </label>
          <div className='input-with-action'>
            <input
              id='text-string-key'
              type='text'
              className='text-input'
              list='catalog-keys'
              value={textStringKeyInput}
              onChange={(e) => handleTextStringKeyChange(e.target.value)}
              placeholder='Enter translation key'
            />
            <datalist id='catalog-keys'>
              {catalogKeys.map(key => (
                <option key={key} value={key} />
              ))}
            </datalist>
            <button
              type='button'
              className='action-button-secondary'
              onClick={handleTextAlignToPlayhead}
              title='Align cue start to current playhead position'
            >
              <Anchor size={16} />
              <span>Align Playhead</span>
            </button>
          </div>
          <span className='section-help-text'>Translation key from catalogs or custom text</span>
        </div>

        <div className='inspector-section'>
          <label className='section-label' htmlFor='text-start-time'>
            Start Time
          </label>
          <input
            id='text-start-time'
            type='text'
            className='text-input'
            value={textStartTimeInput}
            onChange={(e) => setTextStartTimeInput(e.target.value)}
            onBlur={handleTextStartTimeBlur}
            onKeyDown={handleTextStartTimeKeyDown}
            placeholder='0:00.000'
          />
          <span className='section-help-text'>Format as M:SS.mmm or raw seconds</span>
        </div>

        <div className='inspector-section'>
          <label className='section-label' htmlFor='text-duration'>
            Duration
          </label>
          <div className='input-with-derived'>
            <input
              id='text-duration'
              type='text'
              className='text-input'
              value={textDurationInput}
              onChange={(e) => setTextDurationInput(e.target.value)}
              onBlur={handleTextDurationBlur}
              onKeyDown={handleTextDurationKeyDown}
              placeholder='3.0'
            />
            <span className='derived-value'>{formatStopLabel(stopTime)}</span>
          </div>
          <span className='section-help-text'>Duration in seconds (stop time derived)</span>
        </div>

        <div className='inspector-section'>
          <label className='section-label'>Position (9-Point Grid)</label>
          <div className='alignment-grid'>
            <div className='alignment-row'>
              {(['left', 'center', 'right'] as const).map((hAlign) => (
                <button
                  key={`top-${hAlign}`}
                  type='button'
                  className={`alignment-btn ${textVerticalAlign === 'top' && textHorizontalAlign === hAlign ? 'active' : ''}`}
                  onClick={() => {
                    setTextHorizontalAlign(hAlign);
                    setTextVerticalAlign('top');
                    updateTextCue(selectedTextCue.id, { horizontalAlign: hAlign, verticalAlign: 'top' });
                  }}
                  title={`Top ${hAlign}`}
                />
              ))}
            </div>
            <div className='alignment-row'>
              {(['left', 'center', 'right'] as const).map((hAlign) => (
                <button
                  key={`middle-${hAlign}`}
                  type='button'
                  className={`alignment-btn ${textVerticalAlign === 'middle' && textHorizontalAlign === hAlign ? 'active' : ''}`}
                  onClick={() => {
                    setTextHorizontalAlign(hAlign);
                    setTextVerticalAlign('middle');
                    updateTextCue(selectedTextCue.id, { horizontalAlign: hAlign, verticalAlign: 'middle' });
                  }}
                  title={`Middle ${hAlign}`}
                />
              ))}
            </div>
            <div className='alignment-row'>
              {(['left', 'center', 'right'] as const).map((hAlign) => (
                <button
                  key={`bottom-${hAlign}`}
                  type='button'
                  className={`alignment-btn ${textVerticalAlign === 'bottom' && textHorizontalAlign === hAlign ? 'active' : ''}`}
                  onClick={() => {
                    setTextHorizontalAlign(hAlign);
                    setTextVerticalAlign('bottom');
                    updateTextCue(selectedTextCue.id, { horizontalAlign: hAlign, verticalAlign: 'bottom' });
                  }}
                  title={`Bottom ${hAlign}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className='inspector-section'>
          <label className='section-label' htmlFor='text-color'>
            Color
          </label>
          <div className='color-picker-row'>
            <input
              id='text-color'
              type='color'
              className='color-picker-input'
              value={textColorInput}
              onChange={handleTextColorChange}
            />
            <input
              type='text'
              className='text-input color-hex-input'
              value={textColorInput}
              onChange={(e) => {
                setTextColorInput(e.target.value);
                const normalized = normalizeColor(e.target.value);
                if (selectedTextCue && normalized) {
                  updateTextCue(selectedTextCue.id, { color: normalized });
                }
              }}
              placeholder='#FFFFFF'
              maxLength={7}
            />
          </div>
          <span className='section-help-text'>Text color in hex (#RRGGBB)</span>
        </div>

        <div className='inspector-section'>
          <label className='section-label' htmlFor='text-font-size'>
            Font Size (pixels)
          </label>
          <input
            id='text-font-size'
            type='number'
            className='text-input'
            value={textFontSizeInput}
            onChange={handleTextFontSizeChange}
            placeholder={DEFAULT_FONT_SIZE.toString()}
            min='1'
            step='1'
          />
          <span className='section-help-text'>Output font size in pixels</span>
        </div>

        <div className='inspector-footer'>
          <button
            type='button'
            className='reset-clip-btn'
            onClick={handleResetToDefaults}
            style={{ marginRight: '8px' }}
          >
            <span>Reset to Defaults</span>
          </button>
          <button
            type='button'
            className='delete-clip-btn'
            onClick={handleDeleteTextCue}
          >
            <Trash2 size={16} />
            <span>Delete Cue</span>
          </button>
        </div>
      </div>
    );
  }

  // Render audio inspector (original code)
  if (selection.kind === 'audio' && (!selectedSegment || !asset)) {
    return (
      <div className='clip-inspector-empty'>
        <Sparkles size={24} className='inspector-empty-icon' />
        <h3>Clip Inspector</h3>
        <p>Select an audio clip in the timeline to view settings and nudge position.</p>
      </div>
    );
  }

  return (
    <div className='clip-inspector-panel'>
      <h3 className='inspector-title'>Clip Inspector</h3>

      <div className='inspector-clip-details'>
        <div className='detail-row'>
          <span className='detail-label'>File Name</span>
          <span className='detail-value text-ellipsis' title={asset.name}>
            {asset.name}
          </span>
        </div>
        <div className='detail-row'>
          <span className='detail-label'>Duration</span>
          <span className='detail-value'>{asset.duration.toFixed(2)}s</span>
        </div>
      </div>

      <div className='inspector-section'>
        <label className='section-label' htmlFor='start-time-input'>
          Start Time
        </label>
        <div className='input-with-action'>
          <input
            id='start-time-input'
            type='text'
            className='text-input'
            value={startTimeInput}
            onChange={(e) => setStartTimeInput(e.target.value)}
            onBlur={handleAudioStartTimeBlur}
            onKeyDown={handleAudioStartTimeKeyDown}
            placeholder='0:00.000'
          />
          <button
            type='button'
            className='action-button-secondary'
            onClick={handleAudioAlignToPlayhead}
            title='Snap clip start to current playhead position'
          >
            <Anchor size={16} />
            <span>Align Playhead</span>
          </button>
        </div>
        <span className='section-help-text'>Format as M:SS.mmm or raw seconds (e.g. 12.5)</span>
      </div>

      <div className='inspector-section'>
        <label className='section-label'>Nudge Position</label>
        <div className='nudge-buttons-grid'>
          <button type='button' className='nudge-btn' onClick={() => audioNudge(-1.0)}>
            -1.0s
          </button>
          <button type='button' className='nudge-btn' onClick={() => audioNudge(-0.1)}>
            -0.1s
          </button>
          <button type='button' className='nudge-btn' onClick={() => audioNudge(0.1)}>
            +0.1s
          </button>
          <button type='button' className='nudge-btn' onClick={() => audioNudge(1.0)}>
            +1.0s
          </button>
        </div>
      </div>

      <div className='inspector-section'>
        <div className='volume-label-container'>
          <label className='section-label' htmlFor='clip-volume-slider'>
            Volume
          </label>
          <span className='volume-percentage'>{Math.round(selectedSegment.volume * 100)}%</span>
        </div>
        <input
          id='clip-volume-slider'
          type='range'
          min='0'
          max='100'
          step='1'
          className='volume-slider'
          value={Math.round(selectedSegment.volume * 100)}
          onChange={handleVolumeChange}
        />
      </div>

      <div className='inspector-footer'>
        <button
          type='button'
          className='delete-clip-btn'
          onClick={() => removeSegment(selectedSegment.id)}
        >
          <Trash2 size={16} />
          <span>Delete Clip</span>
        </button>
      </div>

      <div className="nudge-help-guide" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <span className="section-label" style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Keyboard Shortcuts</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Nudge Clip (0.1s)</span>
            <kbd style={{ background: 'var(--color-bg-card)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--color-text-primary)', fontFamily: 'var(--mono)', fontSize: '10px' }}>← / →</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Fast Nudge (1.0s)</span>
            <kbd style={{ background: 'var(--color-bg-card)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--color-text-primary)', fontFamily: 'var(--mono)', fontSize: '10px' }}>Shift + ← / →</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Delete Clip</span>
            <kbd style={{ background: 'var(--color-bg-card)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--color-text-primary)', fontFamily: 'var(--mono)', fontSize: '10px' }}>Del / Backspace</kbd>
          </div>
        </div>
      </div>
    </div>
  );
};
