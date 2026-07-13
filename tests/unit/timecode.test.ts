import { describe, expect, it } from 'vitest';
import { formatTimecode, isValidTimecode, parseTimecode } from '../../src/utils/timecode';

describe('timecode.formatTimecode', () => {
  it('formats seconds as M:SS.mmm', () => {
    expect(formatTimecode(0)).toBe('0:00.000');
    expect(formatTimecode(1.5)).toBe('0:01.500');
    expect(formatTimecode(62.5)).toBe('1:02.500');
  });
  it('switches to H:MM:SS.mmm past one hour', () => {
    expect(formatTimecode(3601.5)).toBe('1:00:01.500');
  });
  it('clamps negatives and non-finite to zero', () => {
    expect(formatTimecode(-5)).toBe('0:00.000');
    expect(formatTimecode(Number.NaN)).toBe('0:00.000');
  });
});

describe('timecode.parseTimecode', () => {
  it('parses decimal seconds', () => {
    expect(parseTimecode('1.5')).toBe(1.5);
    expect(parseTimecode('90')).toBe(90);
  });
  it('parses M:SS.mmm (one colon)', () => {
    expect(parseTimecode('0:01.5')).toBe(1.5);
    expect(parseTimecode('1:02.5')).toBe(62.5);
  });
  it('parses H:MM:SS.mmm (two colons)', () => {
    expect(parseTimecode('00:00:01.500')).toBe(1.5);
    expect(parseTimecode('1:00:00')).toBe(3600);
  });
  it('round-trips through formatTimecode', () => {
    for (const s of [0, 1.5, 62.5, 3601.5, 5400]) {
      expect(parseTimecode(formatTimecode(s))).toBeCloseTo(s, 3);
    }
  });
  it('rejects invalid input', () => {
    expect(parseTimecode('')).toBeNull();
    expect(parseTimecode('abc')).toBeNull();
    expect(parseTimecode('1:60')).toBeNull(); // seconds >= 60
    expect(parseTimecode('1:2:3:4')).toBeNull();
    expect(isValidTimecode('1:60')).toBe(false);
    expect(isValidTimecode('2.5')).toBe(true);
  });
});
