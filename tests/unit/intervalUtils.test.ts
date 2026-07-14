import { describe, expect, it } from 'vitest';
import {
  assignLanes,
  clampStartTime,
  clampInterval,
  intervalsOverlap,
  laneCount,
  moveInterval,
  nudgeInterval,
} from '../../src/utils/intervalUtils';

const bounds = (maxEnd: number | null) => ({ maxEnd });

describe('intervalUtils.clampStartTime', () => {
  it('clamps to [0, maxEnd-duration]', () => {
    expect(clampStartTime(5, 2, bounds(10))).toBe(5);
    expect(clampStartTime(9, 2, bounds(10))).toBe(8); // end would exceed 10
    expect(clampStartTime(-3, 2, bounds(10))).toBe(0);
  });
  it('allows any non-negative start when unbounded', () => {
    expect(clampStartTime(1000, 2, bounds(null))).toBe(1000);
    expect(clampStartTime(-1, 2, bounds(null))).toBe(0);
  });
});

describe('intervalUtils.moveInterval / nudgeInterval', () => {
  const iv = { startTime: 1, duration: 2 };
  it('moves and clamps', () => {
    expect(moveInterval(iv, +5, bounds(10))).toEqual({ startTime: 6, duration: 2 });
    expect(moveInterval(iv, +100, bounds(10))).toEqual({ startTime: 8, duration: 2 });
    expect(moveInterval(iv, -5, bounds(10))).toEqual({ startTime: 0, duration: 2 });
  });
  it('nudges by a step', () => {
    expect(nudgeInterval(iv, 0.1, bounds(10))).toEqual({ startTime: 1.1, duration: 2 });
  });
});

describe('intervalUtils.clampInterval', () => {
  it('clamps an interval in place', () => {
    expect(clampInterval({ startTime: 50, duration: 2 }, bounds(10))).toEqual({
      startTime: 8,
      duration: 2,
    });
  });
});

describe('intervalUtils.assignLanes', () => {
  it('stacks overlapping intervals into minimal lanes', () => {
    const a = { id: 'a', startTime: 0, duration: 2 };
    const b = { id: 'b', startTime: 1, duration: 2 };
    const c = { id: 'c', startTime: 2, duration: 2 }; // touches a's end -> same lane
    const result = assignLanes([a, b, c]);
    const lane = (id: string) => result.find((r) => r.id === id)!.lane;
    expect(lane('a')).toBe(0);
    expect(lane('b')).toBe(1);
    expect(lane('c')).toBe(0); // adjacent (touching) -> no overlap
    expect(laneCount([a, b, c])).toBe(2);
  });
  it('returns input order, not sorted order', () => {
    const result = assignLanes([
      { id: 'z', startTime: 5, duration: 1 },
      { id: 'a', startTime: 0, duration: 1 },
    ]);
    expect(result.map((r) => r.id)).toEqual(['z', 'a']);
  });
});

describe('intervalUtils.intervalsOverlap', () => {
  it('is true for overlap, false for adjacent (half-open)', () => {
    const a = { startTime: 0, duration: 2 };
    expect(intervalsOverlap(a, { startTime: 1, duration: 2 })).toBe(true);
    expect(intervalsOverlap(a, { startTime: 2, duration: 2 })).toBe(false); // touching
    expect(intervalsOverlap(a, { startTime: 3, duration: 2 })).toBe(false);
  });
});
