/**
 * Timecode parsing/formatting for the inspector "exact start" input and derived
 * stop timestamps. Accepts flexible input; outputs a compact deterministic form.
 */

/** Format seconds as M:SS.mmm (or H:MM:SS.mmm past one hour). */
export const formatTimecode = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const whole = Math.floor(seconds);
  const ms = Math.round((seconds - whole) * 1000);
  const totalSeconds = ms === 1000 ? whole + 1 : whole;
  const millis = ms === 1000 ? 0 : ms;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = (n: number) => n.toString().padStart(2, '0');
  const msStr = millis.toString().padStart(3, '0');
  if (h > 0) return `${h}:${mm(m)}:${mm(s)}.${msStr}`;
  return `${m}:${mm(s)}.${msStr}`;
};

/** Format seconds as a derived stop time, e.g. "→ 0:03.000". */
export const formatStopLabel = (seconds: number): string => `→ ${formatTimecode(seconds)}`;

/**
 * Parse a timecode string to seconds. Accepts:
 *   "1.5"          -> 1.5       (decimal seconds)
 *   "0:01.5"       -> 1.5       (M:SS.mmm — one colon)
 *   "1:02.5"       -> 62.5
 *   "90:00"        -> 5400      (minutes may exceed 59)
 *   "00:00:01.500" -> 1.5       (H:MM:SS.mmm — two colons)
 *   "90"           -> 90
 * Returns null when the input is not a recognizable timecode.
 */
export const parseTimecode = (input: string): number | null => {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  // Pure decimal seconds.
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  const parts = trimmed.split(':');
  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };
  if (parts.length === 2) {
    // M:SS[.mmm]
    if (!/^\d+$/.test(parts[0]) || !/^\d{1,2}(\.\d{1,3})?$/.test(parts[1])) return null;
    const sec = num(parts[1]);
    if (sec >= 60) return null;
    return num(parts[0]) * 60 + sec;
  }
  if (parts.length === 3) {
    // H:MM:SS[.mmm]
    if (
      !/^\d+$/.test(parts[0]) ||
      !/^\d{1,2}$/.test(parts[1]) ||
      !/^\d{1,2}(\.\d{1,3})?$/.test(parts[2])
    )
      return null;
    const min = num(parts[1]);
    const sec = num(parts[2]);
    if (min >= 60 || sec >= 60) return null;
    return num(parts[0]) * 3600 + min * 60 + sec;
  }
  return null;
};

/** True when `input` parses to a finite, non-negative number of seconds. */
export const isValidTimecode = (input: string): boolean => {
  const n = parseTimecode(input);
  return n != null && Number.isFinite(n) && n >= 0;
};
