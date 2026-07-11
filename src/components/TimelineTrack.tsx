import React from 'react';
import { useProject } from '../context/ProjectContext';
import { AudioSegment } from './AudioSegment';
import type { AudioSegment as AudioSegmentType } from '../types';

interface PositionedSegment extends AudioSegmentType {
  duration: number;
  lane: number;
}

export const TimelineTrack: React.FC = () => {
  const { project } = useProject();

  // Sort and assign lanes to segments to handle overlap / collision stacking
  const sorted = [...project.segments]
    .map(s => {
      const asset = project.audioAssets.find(a => a.id === s.assetId);
      return {
        ...s,
        duration: asset ? asset.duration : 0
      };
    })
    .sort((a, b) => a.startTime - b.startTime);

  const lanes: number[] = []; // stores end times for each lane
  const positioned: PositionedSegment[] = [];

  for (const s of sorted) {
    let laneIndex = 0;
    // Find the first lane that ends before this segment starts
    // We can add a very small tolerance (0.01 seconds) to prevent visual overlap
    while (laneIndex < lanes.length && lanes[laneIndex] > s.startTime) {
      laneIndex++;
    }
    // Update the lane's end time
    lanes[laneIndex] = s.startTime + s.duration;
    positioned.push({
      ...s,
      lane: laneIndex
    });
  }

  const laneCount = Math.max(1, lanes.length);
  const laneHeight = 52; // Height of each lane in pixels
  const trackHeight = laneCount * laneHeight;

  return (
    <div 
      className="timeline-track-container"
      style={{ height: `${trackHeight}px` }}
    >
      {/* Background track lanes for visual guidance */}
      {Array.from({ length: laneCount }).map((_, index) => (
        <div 
          key={`lane-bg-${index}`} 
          className="track-lane-bg"
          style={{ 
            top: `${index * laneHeight}px`,
            height: `${laneHeight}px` 
          }}
        />
      ))}

      {/* Place segments */}
      {positioned.map(seg => (
        <AudioSegment
          key={seg.id}
          segment={seg}
          duration={seg.duration}
          lane={seg.lane}
          laneHeight={laneHeight}
        />
      ))}

      {/* Empty State */}
      {project.segments.length === 0 && (
        <div className="timeline-empty-message">
          No audio clips placed. Add audio clips from the asset panel to start.
        </div>
      )}
    </div>
  );
};
