/**
 * Unit tests for FFmpeg locale renderer (Agent D).
 * Tests drawtext filter construction, text file writing, and font staging.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { LaidOutTextCue } from '../../src/text/types';
import {
  buildTextOverlayFilterChain,
  getRequiredTextFiles,
  getRequiredFontFiles,
} from '../../src/utils/video-filter';

// Mock LaidOutTextCue fixtures
const createMockCue = (id: string, overrides?: Partial<LaidOutTextCue>): LaidOutTextCue => ({
  id,
  startTime: 1.5,
  duration: 3.0,
  stopTime: 4.5,
  lines: ['Hello World', 'Second Line'],
  fontFamily: 'noto-sans',
  fontFileName: 'NotoSans-Regular.ttf',
  fontSize: 72,
  lineHeight: 86.4, // 72 * 1.2
  horizontalAlign: 'center',
  verticalAlign: 'bottom',
  color: '#FFFFFF',
  safeAreaInset: 96, // 5% of 1920
  contentWidth: 1728, // 90% of 1920
  blockWidth: 400,
  blockHeight: 172.8, // 2 lines * 86.4
  overflow: false,
  overflowAxis: 'none',
  ...overrides,
});

describe('video-filter.buildTextOverlayFilterChain', () => {
  it('should return base filter unchanged when no text overlays', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const result = buildTextOverlayFilterChain(baseFilter, [], 1920, 1080);
    expect(result).toBe(baseFilter);
  });

  it('should chain drawtext filters after base video filter', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue = createMockCue('cue_a');

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1920, 1080);

    // Should contain base filter
    expect(result).toContain('[0:v]scale=1920:1080[out_v]');

    // Should contain drawtext filters
    expect(result).toContain('drawtext=');
    expect(result).toContain('textfile=text/line_cue_a_0.txt');
    expect(result).toContain('textfile=text/line_cue_a_1.txt');

    // Should end with [vout]
    expect(result).toMatch(/\[vout\]$/);
  });

  it('should calculate correct horizontal alignment positions', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';

    // Test left align
    const leftCue = createMockCue('left', { horizontalAlign: 'left', blockWidth: 400 });
    const leftResult = buildTextOverlayFilterChain(baseFilter, [leftCue], 1920, 1080);
    // Left: x = safeAreaInset = 96
    expect(leftResult).toContain('x=96.000');

    // Test center align
    const centerCue = createMockCue('center', { horizontalAlign: 'center', blockWidth: 400 });
    const centerResult = buildTextOverlayFilterChain(baseFilter, [centerCue], 1920, 1080);
    // Center: x = 96 + (1728 - 400) / 2 = 96 + 664 = 760
    expect(centerResult).toContain('x=760.000');

    // Test right align
    const rightCue = createMockCue('right', { horizontalAlign: 'right', blockWidth: 400 });
    const rightResult = buildTextOverlayFilterChain(baseFilter, [rightCue], 1920, 1080);
    // Right: x = 96 + 1728 - 400 = 1424
    expect(rightResult).toContain('x=1424.000');
  });

  it('should calculate correct vertical alignment positions', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';

    // Test top align
    const topCue = createMockCue('top', { verticalAlign: 'top', blockHeight: 100 });
    const topResult = buildTextOverlayFilterChain(baseFilter, [topCue], 1920, 1080);
    // Top: y = insetY = 1080 * 0.05 = 54
    expect(topResult).toContain('y=54.000');

    // Test middle align
    const middleCue = createMockCue('middle', { verticalAlign: 'middle', blockHeight: 100 });
    const middleResult = buildTextOverlayFilterChain(baseFilter, [middleCue], 1920, 1080);
    // Middle: y = 54 + (972 - 100) / 2 = 54 + 436 = 490
    expect(middleResult).toContain('y=490.000');

    // Test bottom align
    const bottomCue = createMockCue('bottom', { verticalAlign: 'bottom', blockHeight: 100 });
    const bottomResult = buildTextOverlayFilterChain(baseFilter, [bottomCue], 1920, 1080);
    // Bottom: y = 54 + 972 - 100 = 926
    expect(bottomResult).toContain('y=926.000');
  });

  it('should calculate line positions with correct line height', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue = createMockCue('multiline', {
      lines: ['Line 1', 'Line 2', 'Line 3'],
      lineHeight: 86.4,
      verticalAlign: 'top',
    });

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1920, 1080);

    // Line 0: y = 54 + (0 * 86.4) = 54
    expect(result).toMatch(/textfile=text\/line_multiline_0\.txt.*y=54\.000/);
    // Line 1: y = 54 + (1 * 86.4) = 140.4
    expect(result).toMatch(/textfile=text\/line_multiline_1\.txt.*y=140\.400/);
    // Line 2: y = 54 + (2 * 86.4) = 226.8
    expect(result).toMatch(/textfile=text\/line_multiline_2\.txt.*y=226\.800/);
  });

  it('should include fontfile and fontsize in drawtext filter', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue = createMockCue('font_test', {
      fontFileName: 'NotoSansJP-Regular.ttf',
      fontSize: 96,
    });

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1920, 1080);

    expect(result).toContain('fontfile=fonts/NotoSansJP-Regular.ttf');
    expect(result).toContain('fontsize=96');
  });

  it('should sanitize color from #RRGGBB to RRGGBB', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue = createMockCue('color_test', { color: '#FF0000' });

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1920, 1080);

    expect(result).toContain('fontcolor=FF0000');
  });

  it('should add time-based enable for cue visibility interval', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue = createMockCue('time_test', {
      startTime: 2.5,
      stopTime: 7.8,
    });

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1920, 1080);

    expect(result).toContain("enable='between(t,2.500,7.800)'");
  });

  it('should chain multiple cues in order', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue1 = createMockCue('early', { startTime: 0, stopTime: 3 });
    const cue2 = createMockCue('late', { startTime: 5, stopTime: 8 });

    const result = buildTextOverlayFilterChain(baseFilter, [cue2, cue1], 1920, 1080);

    // Should sort by start time and chain sequentially
    const earlyIndex = result.indexOf('early');
    const lateIndex = result.indexOf('late');
    expect(earlyIndex).toBeLessThan(lateIndex);
  });

  it('should handle multiple cues with multiple lines', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue1 = createMockCue('cue1', { lines: ['A1', 'A2'] });
    const cue2 = createMockCue('cue2', { lines: ['B1'] });

    const result = buildTextOverlayFilterChain(baseFilter, [cue1, cue2], 1920, 1080);

    // Should have 3 text files total (2 for cue1, 1 for cue2)
    expect(result).toContain('text/line_cue1_0.txt');
    expect(result).toContain('text/line_cue1_1.txt');
    expect(result).toContain('text/line_cue2_0.txt');

    // Should chain all filters
    const filterParts = result.split(';');
    expect(filterParts.length).toBeGreaterThan(3);
  });
});

describe('video-filter.getRequiredTextFiles', () => {
  it('should return empty array for no overlays', () => {
    const result = getRequiredTextFiles([]);
    expect(result).toEqual([]);
  });

  it('should return text file paths for each line', () => {
    const cue = createMockCue('test', { lines: ['Line 1', 'Line 2', 'Line 3'] });
    const result = getRequiredTextFiles([cue]);

    expect(result).toEqual([
      'text/line_test_0.txt',
      'text/line_test_1.txt',
      'text/line_test_2.txt',
    ]);
  });

  it('should handle multiple cues', () => {
    const cue1 = createMockCue('cue1', { lines: ['A'] });
    const cue2 = createMockCue('cue2', { lines: ['B1', 'B2'] });
    const result = getRequiredTextFiles([cue1, cue2]);

    expect(result).toEqual([
      'text/line_cue1_0.txt',
      'text/line_cue2_0.txt',
      'text/line_cue2_1.txt',
    ]);
  });
});

describe('video-filter.getRequiredFontFiles', () => {
  it('should return empty set for no overlays', () => {
    const result = getRequiredFontFiles([]);
    expect(result.size).toBe(0);
  });

  it('should collect unique font files', () => {
    const cue1 = createMockCue('c1', { fontFileName: 'NotoSans-Regular.ttf' });
    const cue2 = createMockCue('c2', { fontFileName: 'NotoSansJP-Regular.ttf' });
    const cue3 = createMockCue('c3', { fontFileName: 'NotoSans-Regular.ttf' }); // Duplicate

    const result = getRequiredFontFiles([cue1, cue2, cue3]);

    expect(result.size).toBe(2);
    expect(result.has('NotoSans-Regular.ttf')).toBe(true);
    expect(result.has('NotoSansJP-Regular.ttf')).toBe(true);
  });

  it('should handle single font', () => {
    const cue = createMockCue('test', { fontFileName: 'NotoSans-Regular.ttf' });
    const result = getRequiredFontFiles([cue]);

    expect(result.size).toBe(1);
    expect(result.has('NotoSans-Regular.ttf')).toBe(true);
  });
});

describe('video-filter edge cases', () => {
  it('should handle empty line in multiline text', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue = createMockCue('empty', { lines: ['First', '', 'Third'] });

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1920, 1080);

    // Should still create text files for all lines (including empty)
    expect(result).toContain('text/line_empty_0.txt');
    expect(result).toContain('text/line_empty_1.txt');
    expect(result).toContain('text/line_empty_2.txt');
  });

  it('should handle zero-duration cue (boundary case)', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue = createMockCue('zero', { startTime: 5, duration: 0, stopTime: 5 });

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1920, 1080);

    // Should still generate filter with correct enable interval
    expect(result).toContain("enable='between(t,5.000,5.000)'");
  });

  it('should handle very large font size', () => {
    const baseFilter = '[0:v]scale=1920:1080[out_v]';
    const cue = createMockCue('large', { fontSize: 200 });

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1920, 1080);

    expect(result).toContain('fontsize=200');
  });

  it('should handle different frame dimensions', () => {
    const baseFilter = '[0:v]scale=1280:720[out_v]';
    const cue = createMockCue('720p', {
      safeAreaInset: 64, // 5% of 1280
      contentWidth: 1152, // 90% of 1280
      verticalAlign: 'top',
    });

    const result = buildTextOverlayFilterChain(baseFilter, [cue], 1280, 720);

    // Vertical inset should be 5% of 720 = 36
    expect(result).toContain('y=36.000');
  });
});
