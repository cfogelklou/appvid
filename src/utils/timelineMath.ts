export const timeToX = (time: number, pxPerSecond: number): number => {
  return time * pxPerSecond;
};

export const xToTime = (x: number, pxPerSecond: number): number => {
  return x / pxPerSecond;
};

export const getSnappedTime = (
  rawTime: number,
  pxPerSecond: number,
  targets: number[],
  snapThresholdPx: number = 8,
): number => {
  const thresholdSeconds = snapThresholdPx / pxPerSecond;
  let closestTarget = rawTime;
  let minDiff = thresholdSeconds;

  for (const target of targets) {
    const diff = Math.abs(rawTime - target);
    if (diff < minDiff) {
      minDiff = diff;
      closestTarget = target;
    }
  }
  return closestTarget;
};
