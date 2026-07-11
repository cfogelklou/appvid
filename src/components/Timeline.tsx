import React, { useRef, useState, useEffect } from 'react';
import { useProject, getEditedVideoDuration } from '../context/ProjectContext';
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
    selectedVideoSegmentId,
    setSelectedVideoSegmentId,
    removeSegment, 
    updateSegment,
    splitVideoSegment,
    deleteVideoSegment,
    updateVideoSegmentSpeed,
    playhead
  } = useProject();
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // States
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    segmentId: string;
  } | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Calculate total duration
  const videoDuration = getEditedVideoDuration(project);
  const maxSegmentEnd = project.segments.reduce((max, s) => {
    const asset = project.audioAssets.find(a => a.id === s.assetId);
    const duration = s.duration !== undefined ? s.duration : (asset ? asset.duration : 0);
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

  const handleVideoSegmentContextMenu = (e: React.MouseEvent, segId: string) => {
    e.preventDefault();
    setSelectedVideoSegmentId(segId);
    setSelectedSegmentId(null);
    
    // Clamp context menu to screen viewport bounds to prevent clipping at bottom/right
    const menuWidth = 180;
    const menuHeight = 250;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    setContextMenu({
      x,
      y,
      segmentId: segId
    });
  };

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
          setSelectedVideoSegmentId(null);
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
            {project.video && project.videoSegments && (
              <div className="video-track-lane">
                {project.videoSegments.map((seg) => (
                  <div 
                    key={seg.id}
                    className={`video-track-clip ${selectedVideoSegmentId === seg.id ? 'selected' : ''}`}
                    style={{ 
                      left: `${timeToX(seg.startTime, zoom)}px`,
                      width: `${timeToX(seg.duration, zoom)}px` 
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVideoSegmentId(seg.id);
                      setSelectedSegmentId(null);
                    }}
                    onContextMenu={(e) => handleVideoSegmentContextMenu(e, seg.id)}
                  >
                    <Video size={13} className="video-clip-icon" />
                    <span className="video-clip-name">
                      {project.video?.name} {seg.playbackRate !== 1.0 ? `(${seg.playbackRate}x)` : ''}
                    </span>
                    <span className="video-clip-duration">({seg.duration.toFixed(1)}s)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Visual marker for Video Duration end */}
            {project.video && (
              <div 
                className="video-end-marker"
                style={{ left: `${timeToX(videoDuration, zoom)}px` }}
              >
                <div className="video-end-label">Video End ({videoDuration.toFixed(1)}s)</div>
              </div>
            )}

            <TimelineTrack />
          </div>

          <Playhead timelineRef={contentRef} onDragStart={handleRulerPointerDown} />
        </div>
      </div>

      {/* Context Menu for Video Segments */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              splitVideoSegment(contextMenu.segmentId, playhead);
              setContextMenu(null);
            }}
          >
            Split Clip at Playhead
          </button>
          <button 
            onClick={() => {
              deleteVideoSegment(contextMenu.segmentId);
              setContextMenu(null);
            }}
            disabled={project.videoSegments && project.videoSegments.length <= 1}
          >
            Delete Clip
          </button>
          <div className="context-menu-divider" />
          <div className="context-menu-header">Set Speed</div>
          <div className="speed-options-grid">
            {[0.5, 1.0, 1.5, 2.0, 4.0, 8.0, 20.0].map(speed => (
              <button 
                key={speed}
                onClick={() => {
                  updateVideoSegmentSpeed(contextMenu.segmentId, speed);
                  setContextMenu(null);
                }}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
