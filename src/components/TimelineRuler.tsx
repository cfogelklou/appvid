import React from 'react';
import { useProject } from '../context/ProjectContext';
import { timeToX } from '../utils/timelineMath';

interface TimelineRulerProps {
  duration: number;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ duration }) => {
  const { zoom } = useProject();

  // Find nice adaptive tick interval
  const niceIntervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  let interval = niceIntervals[niceIntervals.length - 1];
  for (const val of niceIntervals) {
    if (val * zoom >= 60) {
      interval = val;
      break;
    }
  }

  // Major ticks
  const majorTicks: number[] = [];
  for (let t = 0; t <= duration; t += interval) {
    majorTicks.push(t);
  }

  // Minor ticks (subdivisions)
  // Let's divide the interval into 5 subdivisions
  const minorTicks: number[] = [];
  const subdivisions = 5;
  const minorInterval = interval / subdivisions;
  for (let t = 0; t <= duration; t += minorInterval) {
    // Avoid overlap with major ticks
    const isMajor = majorTicks.some(mt => Math.abs(mt - t) < 0.001);
    if (!isMajor) {
      minorTicks.push(t);
    }
  }

  const formatTickLabel = (time: number, totalDuration: number) => {
    const roundedTime = Math.round(time * 100) / 100;
    if (totalDuration < 60) {
      if (roundedTime % 1 !== 0) {
        return `${roundedTime.toFixed(1)}s`;
      }
      return `${roundedTime}s`;
    } else {
      const m = Math.floor(roundedTime / 60);
      const s = Math.floor(roundedTime % 60);
      const ms = Math.floor((roundedTime % 1) * 10);
      if (ms > 0) {
        return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
      }
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  };

  return (
    <div className="timeline-ruler">
      {majorTicks.map(time => (
        <div
          key={`major-${time}`}
          className="ruler-tick major"
          style={{ left: `${timeToX(time, zoom)}px` }}
        >
          <span className="tick-label">{formatTickLabel(time, duration)}</span>
        </div>
      ))}
      {minorTicks.map(time => (
        <div
          key={`minor-${time}`}
          className="ruler-tick minor"
          style={{ left: `${timeToX(time, zoom)}px` }}
        />
      ))}
    </div>
  );
};
