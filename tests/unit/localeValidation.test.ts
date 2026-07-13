import { describe, expect, it } from 'vitest';
import {
  canonicalizeLocale,
  defaultPreviewLocale,
  isReservedFileName,
  localeFromFile,
  localeTagFromFileName,
  validateCatalogValue,
} from '../../src/text';
import { BUILT_IN_LOCALES } from '../../src/text';

describe('localeValidation.canonicalizeLocale', () => {
  it('canonicalizes BCP 47 tags', () => {
    expect(canonicalizeLocale('pt-br')).toBe('pt-BR');
    expect(canonicalizeLocale('en')).toBe('en');
    expect(canonicalizeLocale('EN-us')).toBe('en-US');
    expect(canonicalizeLocale('ja-jp')).toBe('ja-JP');
  });
  it('returns null for invalid tags', () => {
    expect(canonicalizeLocale('not-a-locale!!')).toBeNull();
  });
});

describe('localeValidation.fileName rules', () => {
  it('extracts locale tag from filename', () => {
    expect(localeTagFromFileName('en.json')).toBe('en');
    expect(localeTagFromFileName('pt-BR.json')).toBe('pt-BR');
    expect(localeTagFromFileName('dir/ar.json')).toBe('ar');
    expect(localeTagFromFileName('readme.txt')).toBeNull();
  });
  it('rejects reserved filenames', () => {
    expect(isReservedFileName('timeline.json')).toBe(true);
    expect(isReservedFileName('TIMELINE.JSON')).toBe(true);
    expect(isReservedFileName('en.json')).toBe(false);
  });
  it('localeFromFile resolves canonical or null', () => {
    expect(localeFromFile('pt-BR.json')).toBe('pt-BR');
    expect(localeFromFile('timeline.json')).toBeNull();
    expect(localeFromFile('garbage!!json.json')).toBeNull();
  });
});

describe('localeValidation.validateCatalogValue', () => {
  it('accepts a string map with multiline + empty values', () => {
    const { strings, summary } = validateCatalogValue('en.json', {
      welcome: 'Create something\namazing',
      empty: '',
    });
    expect(strings).toEqual({ welcome: 'Create something\namazing', empty: '' });
    expect(summary.accepted).toBe(true);
    expect(summary.stringCount).toBe(2);
  });
  it('rejects non-object top levels', () => {
    expect(validateCatalogValue('x.json', ['a', 'b']).strings).toBeNull();
    expect(validateCatalogValue('x.json', 'hello').strings).toBeNull();
    expect(validateCatalogValue('x.json', null).strings).toBeNull();
  });
  it('skips non-string values and reports reasons', () => {
    const { strings, summary } = validateCatalogValue('x.json', { ok: 'x', bad: 1 });
    expect(strings).toEqual({ ok: 'x' });
    expect(summary.reasons.some((r) => r.includes('bad'))).toBe(true);
  });
});

describe('localeValidation.defaultPreviewLocale', () => {
  it('matches browser locale when imported', () => {
    expect(defaultPreviewLocale(['en', 'sv'], 'en-US')).toBe('en');
    expect(defaultPreviewLocale(['en', 'pt-BR'], 'pt-br')).toBe('pt-BR');
  });
  it('falls back to first imported locale', () => {
    expect(defaultPreviewLocale(['sv', 'en'], 'fr-FR')).toBe('sv');
    expect(defaultPreviewLocale(['sv'], undefined)).toBe('sv');
    expect(defaultPreviewLocale([], 'en')).toBeNull();
  });
});

describe('BUILT_IN_LOCALES', () => {
  it('includes the documented initial locales', () => {
    expect(BUILT_IN_LOCALES).toEqual([
      'en',
      'sv',
      'it',
      'tr',
      'pt-BR',
      'de',
      'fr',
      'ja',
      'es',
    ]);
  });
});
