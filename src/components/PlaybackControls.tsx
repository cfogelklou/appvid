import React, { useState, useEffect } from 'react';
import { useProject, getEditedVideoDuration } from '../context/ProjectContext';
import { previewPlayer } from '../utils/previewPlayer';
import './PlaybackControls.css';

export const PlaybackControls: React.FC = () => {
  const { project, playhead, isPlaying, setPlayhead, setIsPlaying, updateSettings } = useProject();

  const [rate, setRate] = useState<number>(1.0);

  // Keep internal rate in sync if it changes externally
  useEffect(() => {
    previewPlayer.setPlaybackRate(rate);
  }, [rate]);

  const hasVideo = !!(project.video && project.video.blobUrl);
  const duration = getEditedVideoDuration(project);

  const handlePlayPause = () => {
    if (!hasVideo) return;
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasVideo) return;
    const newTime = parseFloat(e.target.value);
    setPlayhead(newTime);
  };

  const handleOriginalAudioToggle = () => {
    const currentMode = project.settings.originalAudioMode;
    const nextMode = currentMode === 'keep' ? 'mute' : 'keep';
    updateSettings({ originalAudioMode: nextMode });
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRate = parseFloat(e.target.value);
    setRate(newRate);
  };

  // Formats time in seconds to mm:ss.s (minutes:seconds.tenths)
  const formatTimecode = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '00:00.0';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const tenths = Math.floor((timeInSeconds % 1) * 10);

    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
  };

  const isOriginalAudioMuted = project.settings.originalAudioMode === 'mute';

  // Calculate track progress percentage for CSS styling
  const progressPercent = duration > 0 ? (playhead / duration) * 100 : 0;

  return (
    <div className='playback-controls-container'>
      {/* Scrubber row */}
      <div className='scrubber-row'>
        <input
          type='range'
          className='scrubber-slider'
          min={0}
          max={duration}
          step={0.01}
          value={playhead}
          onChange={handleSeek}
          disabled={!hasVideo}
          style={{
            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${progressPercent}%, rgba(255, 255, 255, 0.1) ${progressPercent}%, rgba(255, 255, 255, 0.1) 100%)`,
          }}
        />
      </div>

      {/* Control bar buttons and timecodes */}
      <div className='controls-row'>
        {/* Left Action Buttons */}
        <div className='controls-left'>
          {/* Play/Pause Button */}
          <button
            className='control-btn play-btn'
            onClick={handlePlayPause}
            disabled={!hasVideo}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              /* Pause Icon */
              <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M6 19h4V5H6v14zm8-14v14h4V5h-4z' />
              </svg>
            ) : (
              /* Play Icon */
              <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M8 5v14l11-7z' />
              </svg>
            )}
          </button>

          {/* Toggle Video Original Sound Button */}
          <button
            className={`control-btn ${isOriginalAudioMuted ? '' : 'active-toggle'}`}
            onClick={handleOriginalAudioToggle}
            disabled={!hasVideo}
            title={
              isOriginalAudioMuted
                ? 'Preview: Original Audio Muted'
                : 'Preview: Original Audio Playing'
            }
            aria-label={isOriginalAudioMuted ? 'Unmute Original Audio' : 'Mute Original Audio'}
          >
            {isOriginalAudioMuted ? (
              /* Mute Icon */
              <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.03c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z' />
              </svg>
            ) : (
              /* Speaker Icon */
              <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z' />
              </svg>
            )}
          </button>

          {/* Speed Selector */}
          <select
            className='rate-select'
            value={rate.toString()}
            onChange={handleRateChange}
            disabled={!hasVideo}
            title='Playback Speed'
            aria-label='Playback Speed'
          >
            <option value='0.5'>0.5x</option>
            <option value='1'>1.0x</option>
            <option value='1.25'>1.25x</option>
            <option value='1.5'>1.5x</option>
            <option value='2'>2.0x</option>
          </select>
        </div>

        {/* Right Info Section */}
        <div className='controls-right'>
          {/* Courier Styled Timecode Display */}
          <div className='timecode-display'>
            <span className='timecode-current'>{formatTimecode(playhead)}</span>
            <span className='timecode-divider'>/</span>
            <span className='timecode-duration'>{formatTimecode(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
