/**
 * Text wrapping and layout — the frozen contract shared by the DOM preview
 * (Agent C) and the FFmpeg exporter (Agent D). Neither may re-wrap; both
 * consume the same computed line breaks and line-height from layoutCue().
 *
 * Wrapping rules (see plan "Rendering rules"):
 *   - explicit newlines split paragraphs before automatic wrapping
 *   - empty explicit lines are preserved
 *   - wrapping prefers whitespace, falls back to grapheme boundaries for long
 *     tokens and Japanese
 *   - wraps within the central 90% of the frame (5% safe-area inset per axis)
 *   - overflow is clipped and reported (non-blocking), never auto-shrunk
 */
import {
  FONT_ASSET,
  LINE_HEIGHT_MULTIPLIER,
  SAFE_AREA_INSET_FRACTION,
} from './constants';
import type {
  FrameGeometry,
  LaidOutTextCue,
  LocaleCode,
  MeasureText,
  TextCue,
  TextFontFamily,
} from './types';
import { resolveTextCue, stopTimeOf } from './types';

/** Pick the font family for a locale: Japanese uses Noto Sans JP, else Noto Sans. */
export const fontForLocale = (locale: LocaleCode): TextFontFamily =>
  locale.split('-')[0] === 'ja' ? 'noto-sans-jp' : 'noto-sans';

/** Segment text into grapheme clusters (works for Japanese, emoji, etc.). */
export const segmentGraphemes = (text: string): string[] => {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(text), (s) => s.segment);
};

/**
 * Break a single long token (wider than maxWidth) at grapheme boundaries.
 * A single grapheme wider than maxWidth is emitted alone — it cannot break
 * smaller. Always returns at least one piece.
 */
export const breakLongToken = (
  token: string,
  measure: MeasureText,
  fontFamily: TextFontFamily,
  fontSize: number,
  maxWidth: number,
): string[] => {
  if (maxWidth <= 0) return [token];
  const pieces: string[] = [];
  let cur = '';
  for (const g of segmentGraphemes(token)) {
    if (measure(g, fontFamily, fontSize) > maxWidth && cur === '') {
      // Lone grapheme wider than the available width: emit it standalone.
      pieces.push(g);
      continue;
    }
    const cand = cur + g;
    if (measure(cand, fontFamily, fontSize) <= maxWidth) {
      cur = cand;
    } else {
      pieces.push(cur);
      cur = g;
    }
  }
  if (cur !== '' || pieces.length === 0) pieces.push(cur);
  return pieces;
};

/**
 * Wrap one paragraph (no newlines) to maxWidth, preferring whitespace breaks
 * and falling back to grapheme boundaries for long tokens / Japanese.
 */
export const wrapParagraph = (
  paragraph: string,
  measure: MeasureText,
  fontFamily: TextFontFamily,
  fontSize: number,
  maxWidth: number,
): string[] => {
  if (paragraph === '') return [''];
  if (maxWidth <= 0) return [paragraph];
  if (paragraph.trim() === '') return [''];

  const words = paragraph.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (measure(candidate, fontFamily, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    // The candidate does not fit. Flush current if any.
    if (current !== '') {
      lines.push(current);
      current = '';
    }
    if (measure(word, fontFamily, fontSize) <= maxWidth) {
      current = word;
      continue;
    }
    // Long token: break at grapheme boundaries.
    const pieces = breakLongToken(word, measure, fontFamily, fontSize, maxWidth);
    lines.push(...pieces.slice(0, -1));
    current = pieces[pieces.length - 1] ?? '';
  }
  if (current !== '' || lines.length === 0) lines.push(current);
  return lines;
};

/**
 * Wrap arbitrary text: split explicit newlines first (preserving empty lines),
 * then auto-wrap each paragraph. Returns the final ordered line list.
 */
export const wrapText = (
  text: string,
  measure: MeasureText,
  maxWidth: number,
  fontFamily: TextFontFamily,
  fontSize: number,
): string[] => {
  const paragraphs = text.split('\n');
  const out: string[] = [];
  for (const p of paragraphs) {
    out.push(...wrapParagraph(p, measure, fontFamily, fontSize, maxWidth));
  }
  return out.length === 0 ? [''] : out;
};

export interface LayoutCueInput {
  cue: TextCue;
  /** Locale used to choose font + look up the string. */
  locale: LocaleCode;
  /** Catalog for the locale; missing key resolves to empty text. */
  catalog: { strings: Record<string, string> } | undefined;
  frame: FrameGeometry;
  measure: MeasureText;
}

/** Compute the laid-out cue (frozen layout contract) for preview and export. */
export const layoutCue = (input: LayoutCueInput): LaidOutTextCue => {
  const resolved = resolveTextCue(input.cue);
  const fontFamily = fontForLocale(input.locale);
  const fontFileName = FONT_ASSET[fontFamily].fileName;
  const text = input.catalog?.strings[resolved.stringKey] ?? '';

  const insetX = input.frame.width * SAFE_AREA_INSET_FRACTION;
  const insetY = input.frame.height * SAFE_AREA_INSET_FRACTION;
  const contentWidth = input.frame.width - 2 * insetX;
  const contentHeight = input.frame.height - 2 * insetY;

  const lines = wrapText(text, input.measure, contentWidth, fontFamily, resolved.fontSize);
  const lineHeight = resolved.fontSize * LINE_HEIGHT_MULTIPLIER;

  let blockWidth = 0;
  for (const line of lines) {
    blockWidth = Math.max(blockWidth, input.measure(line, fontFamily, resolved.fontSize));
  }
  const blockHeight = lines.length * lineHeight;

  const overflowH = blockWidth > contentWidth;
  const overflowV = blockHeight > contentHeight;
  const overflowAxis: LaidOutTextCue['overflowAxis'] = overflowH && overflowV
    ? 'both'
    : overflowH
      ? 'horizontal'
      : overflowV
        ? 'vertical'
        : 'none';

  return {
    id: input.cue.id,
    startTime: resolved.startTime,
    duration: resolved.duration,
    stopTime: stopTimeOf(resolved),
    lines,
    fontFamily,
    fontFileName,
    fontSize: resolved.fontSize,
    lineHeight,
    horizontalAlign: resolved.horizontalAlign,
    verticalAlign: resolved.verticalAlign,
    color: resolved.color,
    safeAreaInset: insetX,
    contentWidth,
    blockWidth,
    blockHeight,
    overflow: overflowH || overflowV,
    overflowAxis,
  };
};

/**
 * Default text measurer using a Canvas 2D context. Returns 0 outside a browser
 * (e.g. jsdom tests) — tests should inject their own MeasureText.
 */
export const createCanvasMeasurer = (): MeasureText => {
  let ctx: CanvasRenderingContext2D | null = null;
  return (text, fontFamily, fontSize) => {
    if (typeof document === 'undefined') return 0;
    if (!ctx) {
      const canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }
    if (!ctx) return 0;
    ctx.font = `${fontSize}px ${FONT_ASSET[fontFamily].cssFamily}`;
    return ctx.measureText(text).width;
  };
};

/** Measurer where every character is exactly `charWidth` px wide (for tests). */
export const createFixedCharMeasurer = (charWidth: number): MeasureText => {
  // Intl.Segmenter counts graphemes, so match that for grapheme-based tests.
  return (text) => {
    const count = segmentGraphemes(text).length;
    return count * charWidth;
  };
};
