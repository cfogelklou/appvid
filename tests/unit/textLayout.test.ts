import { describe, expect, it } from 'vitest';
import {
  breakLongToken,
  createFixedCharMeasurer,
  fontForLocale,
  layoutCue,
  wrapParagraph,
  wrapText,
} from '../../src/text';
import type { TextCue } from '../../src/text';

const m = (charWidth: number) => createFixedCharMeasurer(charWidth);
const sansCue = (over: Partial<TextCue['base']> = {}): TextCue => ({
  id: 'c1',
  origin: 'manual',
  base: {
    id: 'c1',
    stringKey: 'k',
    startTime: 0,
    duration: 3,
    horizontalAlign: 'center',
    verticalAlign: 'bottom',
    color: '#FFFFFF',
    fontSize: 72,
    ...over,
  } as TextCue['base'],
  overrides: {},
});

describe('textLayout.fontForLocale', () => {
  it('selects JP font for Japanese, base font otherwise', () => {
    expect(fontForLocale('ja')).toBe('noto-sans-jp');
    expect(fontForLocale('ja-JP')).toBe('noto-sans-jp');
    expect(fontForLocale('en')).toBe('noto-sans');
    expect(fontForLocale('pt-BR')).toBe('noto-sans');
  });
});

describe('textLayout.wrapText', () => {
  it('preserves explicit newlines including empty lines', () => {
    expect(wrapText('a\n\nb', m(10), 1000, 'noto-sans', 16)).toEqual(['a', '', 'b']);
  });
  it('returns a single empty line for empty text', () => {
    expect(wrapText('', m(10), 1000, 'noto-sans', 16)).toEqual(['']);
  });
  it('prefers whitespace breaks', () => {
    // 2-char words (20px) with 25px width -> one word per line.
    expect(wrapText('aa bb cc', m(10), 25, 'noto-sans', 16)).toEqual(['aa', 'bb', 'cc']);
  });
  it('falls back to grapheme breaks for long tokens', () => {
    expect(wrapText('aaaa', m(10), 25, 'noto-sans', 16)).toEqual(['aa', 'aa']);
  });
  it('falls back to grapheme breaks for Japanese (no spaces)', () => {
    expect(wrapText('日本語', m(10), 25, 'noto-sans-jp', 16)).toEqual(['日本', '語']);
  });
});

describe('textLayout.wrapParagraph', () => {
  it('preserves a lone empty paragraph', () => {
    expect(wrapParagraph('', m(10), 1000, 'noto-sans', 16)).toEqual(['']);
  });
});

describe('textLayout.breakLongToken', () => {
  it('emits a lone oversized grapheme standalone', () => {
    // grapheme width 30 > maxWidth 25 -> emitted alone
    expect(breakLongToken('Ａ', m(30), 'noto-sans', 16, 25)).toEqual(['Ａ']);
  });
});

describe('textLayout.layoutCue', () => {
  it('selects font + safe area from frame', () => {
    const laid = layoutCue({
      cue: sansCue(),
      locale: 'ja',
      catalog: { strings: { k: '日本語' } },
      frame: { width: 1000, height: 2000 },
      measure: m(10),
    });
    expect(laid.fontFamily).toBe('noto-sans-jp');
    expect(laid.fontFileName).toBe('NotoSansJP-Regular.ttf');
    expect(laid.safeAreaInset).toBe(50); // 5% of 1000
    expect(laid.contentWidth).toBe(900); // 90% of 1000
  });
  it('reports vertical overflow when the block is too tall', () => {
    const laid = layoutCue({
      cue: sansCue({ fontSize: 200 }),
      locale: 'en',
      catalog: { strings: { k: 'x' } },
      frame: { width: 100, height: 100 },
      measure: m(10),
    });
    expect(laid.overflow).toBe(true);
    expect(laid.overflowAxis).toBe('vertical');
  });
  it('lays out empty text when the key is missing', () => {
    const laid = layoutCue({
      cue: sansCue(),
      locale: 'en',
      catalog: undefined,
      frame: { width: 1000, height: 2000 },
      measure: m(10),
    });
    expect(laid.lines).toEqual(['']);
    expect(laid.blockWidth).toBe(0);
  });
});
