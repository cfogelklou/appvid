import { describe, expect, it } from 'vitest';
import type { Project, VideoSegment } from '../../src/types';
import { getEditedVideoDuration } from '../../src/context/ProjectContext';

// Mock simple mapping function implementations to test their correctness
function timelineTimeToSourceTime(t: number, segments: VideoSegment[]): number {
  if (segments.length === 0) return t;
  const seg = segments.find(s => t >= s.startTime && t <= s.startTime + s.duration);
  if (!seg) {
    const lastSeg = segments[segments.length - 1];
    return lastSeg.clipStart + lastSeg.duration * lastSeg.playbackRate;
  }
  return seg.clipStart + (t - seg.startTime) * seg.playbackRate;
}

function sourceTimeToTimelineTime(srcTime: number, segments: VideoSegment[]): number {
  if (segments.length === 0) return srcTime;
  const seg = segments.find(s => srcTime >= s.clipStart && srcTime <= s.clipStart + s.duration * s.playbackRate);
  if (!seg) {
    const lastSeg = segments[segments.length - 1];
    return lastSeg.startTime + lastSeg.duration;
  }
  return seg.startTime + (srcTime - seg.clipStart) / seg.playbackRate;
}

describe('Timeline Virtual Math Mappings', () => {
  const mockSegments: VideoSegment[] = [
    { id: '1', startTime: 0, duration: 5, clipStart: 0, playbackRate: 1.0 }, // 0s - 5s on timeline (source 0s - 5s)
    { id: '2', startTime: 5, duration: 2.5, clipStart: 10, playbackRate: 2.0 }, // 5s - 7.5s on timeline (source 10s - 15s at 2x speed)
  ];

  it('calculates edited video duration correctly', () => {
    const mockProject = {
      video: { duration: 20 } as any,
      videoSegments: mockSegments
    } as Project;
    expect(getEditedVideoDuration(mockProject)).toBe(7.5);
  });

  it('maps timeline time to source time correctly', () => {
    // Inside segment 1 (1.0x speed)
    expect(timelineTimeToSourceTime(3.0, mockSegments)).toBe(3.0);
    // Inside segment 2 (2.0x speed, starting at source 10s)
    // 6.0s on timeline is 1.0s into segment 2 -> source: 10 + 1 * 2.0 = 12.0s
    expect(timelineTimeToSourceTime(6.0, mockSegments)).toBe(12.0);
  });

  it('maps source time to timeline time correctly', () => {
    // Inside segment 1
    expect(sourceTimeToTimelineTime(3.0, mockSegments)).toBe(3.0);
    // Inside segment 2
    // Source 12s is 2.0s into source clip segment -> timeline: 5 + (12 - 10) / 2.0 = 6.0s
    expect(sourceTimeToTimelineTime(12.0, mockSegments)).toBe(6.0);
  });
});
