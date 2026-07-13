/**
 * Generic interval clip component shared by audio and text tracks.
 * Handles drag-to-move, keyboard nudge, click-select, and renders in assigned lanes.
 */
import React, { useRef, useState, useEffect } from 'react';
import { timeToX, xToTime } from '../utils/timelineMath';
import { useProject } from '../context/ProjectContext';
import type { TimelineInterval } from '../text/types';
import { nudgeInterval, clampStartTime } from '../utils/intervalUtils';
import type { ProjectSelection } from '../text/types';

interface IntervalClipProps {
  /** Interval data (startTime, duration). */
  interval: TimelineInterval;
  /** Unique ID for this clip. */
  id: string;
  /** Display label for the clip. */
  label: string;
  /** Whether this clip is selected. */
  selected: boolean;
  /** Current selection state (discriminated union). */
  selection: ProjectSelection;
  /** Callback when selection changes. */
  onSelect: (selection: ProjectSelection) => void;
  /** Callback to update interval (for drag/nudge). */
  onUpdate: (id: string, updates: Partial<TimelineInterval>) => void;
  /** Computed lane index (0-based). */
  lane: number;
  /** Lane height in pixels. */
  laneHeight: number;
  /** Optional color override (for text cues). */
  color?: string;
  /** Optional additional class name. */
  className?: string;
  /** Optional warning state. */
  warning?: boolean;
}

export const IntervalClip: React.FC<IntervalClipProps> = ({
  interval,
  id,
  label,
  selected,
  selection,
  onSelect,
  onUpdate,
  lane,
  laneHeight,
  color,
  className = '',
  warning = false,
}) => {
  const { project, zoom } = useProject();
  const clipRef = useRef<HTMLDivElement>(null);

  // Local drag state
  const [dragState, setDragState] = useState<{
    startX: number;
    initialStartTime: number;
    previewTime: number;
  } | null>(null);

  const isDragging = dragState !== null;
  const currentStartTime = isDragging ? dragState.previewTime : interval.startTime;
  const left = timeToX(currentStartTime, zoom);
  const width = timeToX(interval.duration, zoom);

  // Format time for tooltip
  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag with primary mouse button / touch
    if (e.button !== 0) return;

    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect({ kind: 'text', id });

    setDragState({
      startX: e.clientX,
      initialStartTime: interval.startTime,
      previewTime: interval.startTime,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    e.stopPropagation();

    const dx = e.clientX - dragState.startX;
    const dt = xToTime(dx, zoom);

    // Get video duration for bounds
    const maxEnd = project.video ?
      (project.videoSegments && project.videoSegments.length > 0
        ? project.videoSegments.reduce((max, seg) => Math.max(max, seg.startTime + seg.duration), 0)
        : project.video.duration)
      : null;

    // Compute new start time with clamping
    const rawTime = dragState.initialStartTime + dt;
    const clampedTime = clampStartTime(rawTime, interval.duration, { maxEnd });

    setDragState(prev => prev ? {
      ...prev,
      previewTime: clampedTime,
    } : null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Commit changes
    onUpdate(id, { startTime: dragState.previewTime });
    setDragState(null);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragState(null);
  };

  // Keyboard nudge support (when selected)
  useEffect(() => {
    if (!selected || selection?.kind !== 'text' || selection.id !== id) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      const step = e.shiftKey ? 1.0 : 0.1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const maxEnd = project.video ?
          (project.videoSegments && project.videoSegments.length > 0
            ? project.videoSegments.reduce((max, seg) => Math.max(max, seg.startTime + seg.duration), 0)
            : project.video.duration)
          : null;

        const nudged = nudgeInterval(interval, -step, { maxEnd });
        onUpdate(id, { startTime: nudged.startTime });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const maxEnd = project.video ?
          (project.videoSegments && project.videoSegments.length > 0
            ? project.videoSegments.reduce((max, seg) => Math.max(max, seg.startTime + seg.duration), 0)
            : project.video.duration)
          : null;

        const nudged = nudgeInterval(interval, step, { maxEnd });
        onUpdate(id, { startTime: nudged.startTime });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, selection, interval, project, id, onUpdate]);

  return (
    <div
      ref={clipRef}
      className={`interval-clip ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${warning ? 'warning' : ''} ${className}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: `${lane * laneHeight}px`,
        height: `${laneHeight - 6}px`,
        ...(color ? { backgroundColor: color, borderColor: color } : {}),
      }}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${formatTime(currentStartTime)} - ${formatTime(currentStartTime + interval.duration)}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="interval-clip-content">
        <div className="interval-clip-label">{label}</div>
        <div className="interval-clip-timecode">
          {formatTime(currentStartTime)} - {formatTime(currentStartTime + interval.duration)}
        </div>
      </div>

      {/* Snap time overlay bubble (shown during drag) */}
      {isDragging && (
        <div className="interval-clip-drag-bubble">
          {formatTime(dragState.previewTime)}
        </div>
      )}
    </div>
  );
};
