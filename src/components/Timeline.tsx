import React, { useRef, useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import { Playhead } from './Playhead';
import { TimelineZoomControls } from './TimelineZoomControls';
import { timeToX, xToTime } from '../utils/timelineMath';
import { Video } from 'lucide-react';
import './Timeline.css';

export const Timeline: React.FC = () => {
  const { 
    project, 
    setPlayhead, 
    zoom, 
    selectedSegmentId, 
    setSelectedSegmentId, 
    removeSegment, 
    updateSegment 
  } = useProject();
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // States
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Calculate total duration
  const videoDuration = project.video?.duration || 0;
  const maxSegmentEnd = project.segments.reduce((max, s) => {
    const asset = project.audioAssets.find(a => a.id === s.assetId);
    const duration = asset ? asset.duration : 0;
    return Math.max(max, s.startTime + duration);
  }, 0);
  const totalDuration = Math.max(videoDuration, maxSegmentEnd, 30); // minimum 30s

  const contentWidth = timeToX(totalDuration, zoom) + 100; // 100px padding at the end

  // Playhead scrubber pointer handlers
  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!contentRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    updatePlayheadPosition(e);
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    updatePlayheadPosition(e);
  };

  const handleRulerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsScrubbing(false);
  };

  const updatePlayheadPosition = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min(xToTime(x, zoom), totalDuration));
    setPlayhead(time);
  };

  // Keyboard navigation for nudge/delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea/select
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (!selectedSegmentId) return;

      const segment = project.segments.find(s => s.id === selectedSegmentId);
      if (!segment) return;

      const step = e.shiftKey ? 1.0 : 0.1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newTime = Math.max(0, segment.startTime - step);
        updateSegment(selectedSegmentId, { startTime: newTime });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newTime = segment.startTime + step;
        updateSegment(selectedSegmentId, { startTime: newTime });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSegment(selectedSegmentId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSegmentId, project.segments, updateSegment, removeSegment]);

  return (
    <div className="timeline-container">
      <div className="timeline-toolbar">
        <span className="timeline-title">Audio Timeline</span>
        <TimelineZoomControls />
      </div>

      <div className="timeline-viewport" ref={viewportRef} onClick={(e) => {
        // Deselect if clicking on empty space in timeline
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('timeline-content') || (e.target as HTMLElement).classList.contains('timeline-tracks')) {
          setSelectedSegmentId(null);
        }
      }}>
        <div 
          className="timeline-content" 
          ref={contentRef}
          style={{ width: `${contentWidth}px` }}
        >
          <div 
            className="timeline-ruler-wrapper"
            onPointerDown={handleRulerPointerDown}
            onPointerMove={handleRulerPointerMove}
            onPointerUp={handleRulerPointerUp}
          >
            <TimelineRuler duration={totalDuration} />
          </div>

          <div className="timeline-tracks">
            {/* Visual Video Track Lane */}
            {project.video && (
              <div className="video-track-lane">
                <div 
                  className="video-track-clip"
                  style={{ width: `${timeToX(project.video.duration, zoom)}px` }}
                >
                  <Video size={13} className="video-clip-icon" />
                  <span className="video-clip-name">{project.video.name}</span>
                  <span className="video-clip-duration">({project.video.duration.toFixed(1)}s)</span>
                </div>
              </div>
            )}

            {/* Visual marker for Video Duration end */}
            {project.video && (
              <div 
                className="video-end-marker"
                style={{ left: `${timeToX(project.video.duration, zoom)}px` }}
              >
                <div className="video-end-label">Video End ({project.video.duration.toFixed(1)}s)</div>
              </div>
            )}

            <TimelineTrack />
          </div>

          <Playhead timelineRef={contentRef} onDragStart={handleRulerPointerDown} />
        </div>
      </div>
    </div>
  );
};
