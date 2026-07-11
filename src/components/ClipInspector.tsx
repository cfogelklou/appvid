import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { Trash2, Anchor, Sparkles } from 'lucide-react';
import './ClipInspector.css';

export const ClipInspector: React.FC = () => {
  const { project, playhead, selectedSegmentId, updateSegment, removeSegment } = useProject();

  // Find the selected segment and its asset
  const selectedSegment = project.segments.find((s) => s.id === selectedSegmentId);
  const asset = selectedSegment
    ? project.audioAssets.find((a) => a.id === selectedSegment.assetId)
    : null;

  // Local state for start time input to allow smooth typing without lag
  const [startTimeInput, setStartTimeInput] = useState('');

  // Helper to format seconds into mm:ss.s
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // Helper to parse time string (mm:ss.s or ss.s or seconds) into seconds
  const parseTime = (str: string): number | null => {
    const parts = str.trim().split(':');
    if (parts.length === 2) {
      const m = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      if (!isNaN(m) && !isNaN(s)) {
        return m * 60 + s;
      }
    } else if (parts.length === 1) {
      const s = parseFloat(parts[0]);
      if (!isNaN(s)) {
        return s;
      }
    }
    return null;
  };

  // Update input text when selection changes or segment start time changes from elsewhere (e.g. dragging)
  useEffect(() => {
    if (selectedSegment) {
      setStartTimeInput(formatTime(selectedSegment.startTime));
    } else {
      setStartTimeInput('');
    }
  }, [selectedSegmentId, selectedSegment]);

  if (!selectedSegment || !asset) {
    return (
      <div className='clip-inspector-empty'>
        <Sparkles size={24} className='inspector-empty-icon' />
        <h3>Clip Inspector</h3>
        <p>Select a placed audio clip in the timeline to view settings and nudge position.</p>
      </div>
    );
  }

  const handleStartTimeBlur = () => {
    const parsed = parseTime(startTimeInput);
    if (parsed !== null && parsed >= 0) {
      // Clamp to video duration if video exists
      let finalTime = parsed;
      if (project.video) {
        finalTime = Math.min(parsed, project.video.duration);
      }
      updateSegment(selectedSegment.id, { startTime: finalTime });
      setStartTimeInput(formatTime(finalTime));
    } else {
      // Revert if invalid
      setStartTimeInput(formatTime(selectedSegment.startTime));
    }
  };

  const handleStartTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartTimeBlur();
      e.currentTarget.blur();
    }
  };

  const nudge = (delta: number) => {
    const newTime = Math.max(0, selectedSegment.startTime + delta);
    updateSegment(selectedSegment.id, { startTime: newTime });
  };

  const handleAlignToPlayhead = () => {
    updateSegment(selectedSegment.id, { startTime: playhead });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value) / 100;
    updateSegment(selectedSegment.id, { volume });
  };

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
            onBlur={handleStartTimeBlur}
            onKeyDown={handleStartTimeKeyDown}
            placeholder='00:00.0'
          />
          <button
            type='button'
            className='action-button-secondary'
            onClick={handleAlignToPlayhead}
            title='Snap clip start to current playhead position'
          >
            <Anchor size={16} />
            <span>Align Playhead</span>
          </button>
        </div>
        <span className='section-help-text'>Format as mm:ss.s or raw seconds (e.g. 12.5)</span>
      </div>

      <div className='inspector-section'>
        <label className='section-label'>Nudge Position</label>
        <div className='nudge-buttons-grid'>
          <button type='button' className='nudge-btn' onClick={() => nudge(-1.0)}>
            -1.0s
          </button>
          <button type='button' className='nudge-btn' onClick={() => nudge(-0.1)}>
            -0.1s
          </button>
          <button type='button' className='nudge-btn' onClick={() => nudge(0.1)}>
            +0.1s
          </button>
          <button type='button' className='nudge-btn' onClick={() => nudge(1.0)}>
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
