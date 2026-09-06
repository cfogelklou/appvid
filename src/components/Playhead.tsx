import React from 'react';
import { useProject } from '../context/ProjectContext';
import { timeToX } from '../utils/timelineMath';

interface PlayheadProps {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  onDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export const Playhead: React.FC<PlayheadProps> = ({ onDragStart }) => {
  const { playhead, zoom } = useProject();
  const left = timeToX(playhead, zoom);

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className='timeline-playhead' style={{ transform: `translateX(${left}px)` }}>
      <div className='playhead-handle' onPointerDown={onDragStart}>
        <div className='playhead-bubble'>{formatTime(playhead)}</div>
      </div>
      <div className='playhead-line' />
    </div>
  );
};
