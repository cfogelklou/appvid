/**
 * Shared pure utilities for timeline intervals — movement, clamping, nudging,
 * lane assignment. Audio segments and text cues consume the same behavior.
 *
 * These functions are lead-owned (Wave 0). Agent B builds the generic interval
 * clip/track *components* on top of them.
 */
import type { TimelineInterval } from '../text/types';
import { stopTimeOf } from '../text/types';

/** Allowed movement bounds: interval must stay within [0, maxEnd]. */
export interface IntervalBounds {
  /** Inclusive maximum end time. Null = unbounded above (no video imported). */
  maxEnd: number | null;
}

/** Clamp a candidate start time to valid bounds preserving duration. */
export const clampStartTime = (
  startTime: number,
  duration: number,
  bounds: IntervalBounds,
): number => {
  const lo = 0;
  const hi = bounds.maxEnd == null ? Infinity : Math.max(0, bounds.maxEnd - duration);
  return Math.max(lo, Math.min(startTime, hi));
};

/**
 * Move an interval by a signed delta, clamped to bounds. Returns a new interval
 * with the same duration. Never produces a negative start or an end past maxEnd.
 */
export const moveInterval = (
  interval: TimelineInterval,
  delta: number,
  bounds: IntervalBounds,
): TimelineInterval => ({
  ...interval,
  startTime: clampStartTime(interval.startTime + delta, interval.duration, bounds),
});

/** Clamp an interval's start/duration in place to the given bounds. */
export const clampInterval = (
  interval: TimelineInterval,
  bounds: IntervalBounds,
): TimelineInterval => ({
  ...interval,
  startTime: clampStartTime(interval.startTime, interval.duration, bounds),
});

/** Keyboard nudge: move by a fixed step, clamped. */
export const nudgeInterval = (
  interval: TimelineInterval,
  stepSeconds: number,
  bounds: IntervalBounds,
): TimelineInterval => moveInterval(interval, stepSeconds, bounds);

/**
 * Assign each interval a 0-based lane so overlapping intervals stack.
 * Greedy: sort by start, place each interval in the lowest lane whose last end
 * is <= this interval's start. Deterministic given input order tiebreak by id.
 */
export interface LanedInterval extends TimelineInterval {
  id: string;
}

export const assignLanes = <T extends LanedInterval>(intervals: T[]): (T & { lane: number })[] => {
  const sorted = [...intervals].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  // laneEnds[lane] = end time of the last interval placed in that lane.
  const laneEnds: number[] = [];
  const placed = sorted.map((iv) => {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] > iv.startTime) lane++;
    laneEnds[lane] = stopTimeOf(iv);
    return { ...iv, lane };
  });
  // Return in the original caller order, not sorted order.
  const byId = new Map(placed.map((p) => [p.id, p]));
  return intervals.map((iv) => byId.get(iv.id)!);
};

/** Number of lanes required to display a set of intervals without overlap. */
export const laneCount = (intervals: LanedInterval[]): number => {
  if (intervals.length === 0) return 0;
  return assignLanes(intervals).reduce((max, iv) => Math.max(max, iv.lane + 1), 0);
};

/** Do two intervals overlap on the half-open range? Adjacent (touching) = no. */
export const intervalsOverlap = (a: TimelineInterval, b: TimelineInterval): boolean =>
  a.startTime < stopTimeOf(b) && b.startTime < stopTimeOf(a);
