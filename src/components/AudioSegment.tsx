import React, { useState, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { timeToX, xToTime, getSnappedTime } from '../utils/timelineMath';
import type { AudioSegment as AudioSegmentType } from '../types';
import { AlertTriangle, Link } from 'lucide-react';

interface AudioSegmentProps {
  segment: AudioSegmentType;
  duration: number;
  lane: number;
  laneHeight: number;
}

export const AudioSegment: React.FC<AudioSegmentProps> = ({
  segment,
  duration,
  lane,
  laneHeight
}) => {
  const {
    project,
    playhead,
    zoom,
    selectedSegmentId,
    setSelectedSegmentId,
    updateSegment
  } = useProject();

  const segmentRef = useRef<HTMLDivElement>(null);

  // Find asset metadata
  const asset = project.audioAssets.find(a => a.id === segment.assetId);
  const name = asset ? asset.name : 'Unknown Audio';

  // Warnings
  const needsRelink = !asset || asset.blobUrl === '';
  const extendsPastVideo = project.video ? (segment.startTime + duration > project.video.duration) : false;
  const startsAfterVideo = project.video ? (segment.startTime >= project.video.duration) : false;
  const hasWarning = needsRelink || extendsPastVideo || startsAfterVideo;

  // Local drag state
  const [dragState, setDragState] = useState<{
    startX: number;
    initialStartTime: number;
    previewTime: number;
  } | null>(null);

  // Compute active position
  const isDragging = dragState !== null;
  const currentStartTime = isDragging ? dragState.previewTime : segment.startTime;
  
  const left = timeToX(currentStartTime, zoom);
  const width = timeToX(duration, zoom);
  const isSelected = selectedSegmentId === segment.id;

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
    setSelectedSegmentId(segment.id);

    setDragState({
      startX: e.clientX,
      initialStartTime: segment.startTime,
      previewTime: segment.startTime
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    e.stopPropagation();

    const dx = e.clientX - dragState.startX;
    const dt = xToTime(dx, zoom);
    let rawTime = dragState.initialStartTime + dt;
    
    // Clamp to 0 and maximum possible limit
    rawTime = Math.max(0, rawTime);
    if (project.video) {
      // Let them drag slightly past video end if they want, but clamp to a reasonable maximum
      rawTime = Math.min(rawTime, project.video.duration + 5);
    }

    // Build list of snap targets
    const snapTargets: number[] = [0];
    if (project.video) {
      snapTargets.push(project.video.duration);
    }
    snapTargets.push(playhead);

    // Add other segments start and end times
    project.segments.forEach(other => {
      if (other.id !== segment.id) {
        const otherAsset = project.audioAssets.find(a => a.id === other.assetId);
        const otherDur = otherAsset ? otherAsset.duration : 0;
        snapTargets.push(other.startTime);
        snapTargets.push(other.startTime + otherDur);
      }
    });

    // Add whole seconds within duration
    const maxTime = project.video?.duration || 120;
    for (let sec = 1; sec <= maxTime; sec++) {
      snapTargets.push(sec);
    }

    // Snapped time (8px threshold)
    const snappedTime = getSnappedTime(rawTime, zoom, snapTargets, 8);

    setDragState(prev => prev ? {
      ...prev,
      previewTime: snappedTime
    } : null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Commit changes
    updateSegment(segment.id, { startTime: dragState.previewTime });
    setDragState(null);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragState(null);
  };

  // Warning Message String
  let warningMessage = '';
  if (needsRelink) {
    warningMessage = 'Re-link audio file required';
  } else if (startsAfterVideo) {
    warningMessage = 'Starts after video ends (clip will not play)';
  } else if (extendsPastVideo) {
    warningMessage = 'Extends past video end (will be truncated)';
  }

  return (
    <div
      ref={segmentRef}
      className={`audio-segment-card ${isSelected ? 'selected' : ''} ${hasWarning ? 'warning' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: `${lane * laneHeight}px`,
        height: `${laneHeight - 6}px` // slightly smaller than lane height for spacing
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="audio-segment-content">
        <div className="audio-segment-title-bar">
          <span className="audio-segment-name">{name}</span>
          <div className="audio-segment-icons">
            {needsRelink && <Link size={14} className="icon-link" />}
            {hasWarning && (
              <span className="warning-tooltip-trigger" title={warningMessage}>
                <AlertTriangle size={14} className="icon-warning" />
              </span>
            )}
          </div>
        </div>

        <div className="audio-segment-timecode">
          {formatTime(currentStartTime)} - {formatTime(currentStartTime + duration)}
        </div>
      </div>

      {/* Snap time overlay bubble (shown during drag) */}
      {isDragging && (
        <div className="audio-segment-drag-bubble">
          {formatTime(dragState.previewTime)}
        </div>
      )}
    </div>
  );
};
