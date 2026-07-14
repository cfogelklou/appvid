import { describe, expect, it } from 'vitest';
import { slugifyForKey, fontFamilyForLocale } from '../../src/text';

describe('constants.slugifyForKey', () => {
  it('lowercases and dash-joins words', () => {
    expect(slugifyForKey('Hello, World!')).toBe('hello-world');
    expect(slugifyForKey('Create something amazing')).toBe('create-something-amazing');
    expect(slugifyForKey('MixED Case')).toBe('mixed-case');
  });

  it('trims surrounding whitespace and dashes', () => {
    expect(slugifyForKey('  spaced  ')).toBe('spaced');
    expect(slugifyForKey('---edges---')).toBe('edges');
  });

  it('collapses non-alphanumeric runs to a single dash', () => {
    expect(slugifyForKey('a-b c')).toBe('a-b-c');
    expect(slugifyForKey('foo...bar___baz')).toBe('foo-bar-baz');
  });

  it('keeps digits', () => {
    expect(slugifyForKey('Step 1')).toBe('step-1');
    expect(slugifyForKey('123')).toBe('123');
  });

  it('falls back to "text" for punctuation-only input', () => {
    expect(slugifyForKey('!!!')).toBe('text');
    expect(slugifyForKey('...---...')).toBe('text');
  });

  it('falls back to "text" for non-Latin scripts (e.g. Japanese)', () => {
    expect(slugifyForKey('素晴らしいものを作成')).toBe('text');
    expect(slugifyForKey('你好世界')).toBe('text');
  });

  it('falls back to "text" for empty input', () => {
    expect(slugifyForKey('')).toBe('text');
    expect(slugifyForKey('   ')).toBe('text');
  });
});

describe('constants.fontFamilyForLocale', () => {
  it('selects Noto Sans JP for Japanese', () => {
    expect(fontFamilyForLocale('ja')).toBe('noto-sans-jp');
    expect(fontFamilyForLocale('ja-JP')).toBe('noto-sans-jp');
  });

  it('falls back to Noto Sans for other locales', () => {
    expect(fontFamilyForLocale('en')).toBe('noto-sans');
    expect(fontFamilyForLocale('sv')).toBe('noto-sans');
    expect(fontFamilyForLocale('pt-BR')).toBe('noto-sans');
  });
});
