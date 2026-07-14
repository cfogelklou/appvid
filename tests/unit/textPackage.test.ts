import { describe, expect, it } from 'vitest';
import {
  mergeCues,
  normalizeColor,
  parseCatalog,
  parseCatalogBatch,
  parseTimeline,
  validateLocaleKeys,
} from '../../src/text';
import type { TextCue } from '../../src/text';

const cue = (
  id: string,
  stringKey: string,
  startTime: number,
  duration: number,
  extra: Partial<TextCue['base']> = {},
): TextCue => ({
  id,
  origin: 'timeline-import',
  base: { id, stringKey, startTime, duration, ...extra } as TextCue['base'],
  overrides: {},
});

describe('textPackage.normalizeColor', () => {
  it('normalizes to uppercase #RRGGBB', () => {
    expect(normalizeColor('#FFFFFF')).toBe('#FFFFFF');
    expect(normalizeColor('ffffff')).toBe('#FFFFFF');
    expect(normalizeColor('#aabbcc')).toBe('#AABBCC');
    expect(normalizeColor('#aaBBcc')).toBe('#AABBCC');
  });
  it('rejects invalid colors', () => {
    expect(normalizeColor('FFF')).toBeNull(); // 3 digits
    expect(normalizeColor('#GGGGGG')).toBeNull();
    expect(normalizeColor(123)).toBeNull();
    expect(normalizeColor(undefined)).toBeNull();
  });
});

describe('textPackage.parseCatalog', () => {
  it('parses a valid catalog', () => {
    const r = parseCatalog('en.json', JSON.stringify({ a: 'Hello', b: 'World\n!' }));
    expect(r.ok).toBe(true);
    expect(r.catalog?.locale).toBe('en');
    expect(r.catalog?.strings.b).toBe('World\n!');
  });
  it('accepts empty string values', () => {
    const r = parseCatalog('en.json', JSON.stringify({ a: '' }));
    expect(r.ok).toBe(true);
    expect(r.catalog?.strings.a).toBe('');
  });
  it('rejects malformed JSON', () => {
    expect(parseCatalog('en.json', '{not json').ok).toBe(false);
  });
  it('rejects reserved filenames', () => {
    expect(parseCatalog('timeline.json', '{}').ok).toBe(false);
  });
  it('rejects non-object JSON', () => {
    expect(parseCatalog('en.json', '["a"]').ok).toBe(false);
  });
});

describe('textPackage.parseCatalogBatch', () => {
  it('rejects duplicate canonical locales in one batch', () => {
    const r = parseCatalogBatch([
      { fileName: 'pt-br.json', text: '{"k":"x"}' },
      { fileName: 'pt-BR.json', text: '{"k":"y"}' },
    ]);
    expect(r.duplicateLocales).toContain('pt-BR');
    expect(Object.keys(r.accepted)).toHaveLength(0);
    expect(r.summaries.every((s) => !s.accepted)).toBe(true);
  });
  it('accepts distinct locales', () => {
    const r = parseCatalogBatch([
      { fileName: 'en.json', text: '{"k":"x"}' },
      { fileName: 'sv.json', text: '{"k":"y"}' },
    ]);
    expect(Object.keys(r.accepted).sort()).toEqual(['en', 'sv']);
  });
});

describe('textPackage.parseTimeline', () => {
  const baseCue = `"id":"a","stringKey":"k","startTime":1.5,"duration":3`;
  it('applies defaults to a minimal cue', () => {
    const r = parseTimeline(`{"version":1,"cues":[{${baseCue}}]}`);
    expect(r.ok).toBe(true);
    expect(r.cues).toHaveLength(1);
    const c = r.cues[0]!;
    expect(c.base.horizontalAlign).toBe('center');
    expect(c.base.verticalAlign).toBe('bottom');
    expect(c.base.color).toBe('#FFFFFF');
    expect(c.base.fontSize).toBe(72);
    expect(c.origin).toBe('timeline-import');
  });
  it('imports valid cues while skipping invalid ones', () => {
    const r = parseTimeline(`{"version":1,"cues":[
      {${baseCue}},
      {"id":"b","stringKey":"k","startTime":-1,"duration":2}
    ]}`);
    expect(r.ok).toBe(true);
    expect(r.cues.map((c) => c.id)).toEqual(['a']);
    expect(r.warnings.some((w) => w.includes('startTime'))).toBe(true);
  });
  it('skips duplicate ids within the file', () => {
    const r = parseTimeline(`{"version":1,"cues":[{${baseCue}},{${baseCue}}]}`);
    expect(r.cues).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });
  it('warns on unknown fields but still imports', () => {
    const r = parseTimeline(
      `{"version":1,"cues":[{${baseCue},"bogus":42}]}`,
    );
    expect(r.cues).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes('bogus'))).toBe(true);
  });
  it('rejects the whole file on malformed JSON', () => {
    expect(parseTimeline('{broken').ok).toBe(false);
  });
  it('rejects unsupported version', () => {
    expect(parseTimeline('{"version":99,"cues":[]}').ok).toBe(false);
  });
  it('rejects zero/negative duration', () => {
    const r = parseTimeline(
      `{"version":1,"cues":[{"id":"a","stringKey":"k","startTime":0,"duration":0}]}`,
    );
    expect(r.cues).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('textPackage.mergeCues', () => {
  it('updates base on reimport while preserving overrides', () => {
    const existing: TextCue[] = [
      { ...cue('a', 'k', 1, 3), overrides: { color: '#FF0000' } },
    ];
    const imported = [cue('a', 'k', 9, 2)];
    const r = mergeCues(existing, imported);
    expect(r.updated).toEqual(['a']);
    expect(r.cues[0]!.base.startTime).toBe(9);
    expect(r.cues[0]!.base.duration).toBe(2);
    expect(r.cues[0]!.overrides.color).toBe('#FF0000'); // preserved
  });
  it('appends new ids', () => {
    const r = mergeCues([cue('a', 'k', 1, 3)], [cue('b', 'k', 2, 3)]);
    expect(r.appended).toEqual(['b']);
    expect(r.cues.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });
  it('retains ids absent from the import', () => {
    const r = mergeCues([cue('a', 'k', 1, 3)], []);
    expect(r.retained).toEqual(['a']);
  });
  it('skips imported ids that collide with manual cues', () => {
    const existing: TextCue[] = [
      { ...cue('a', 'k', 1, 3), origin: 'manual' as const },
    ];
    const r = mergeCues(existing, [cue('a', 'k', 9, 2)]);
    expect(r.skipped).toEqual(['a']);
    expect(r.cues[0]!.origin).toBe('manual');
    expect(r.cues[0]!.base.startTime).toBe(1); // unchanged
  });
});

describe('textPackage.validateLocaleKeys', () => {
  const keys = ['welcome', 'bye'];
  it('is not blocked when all keys present (empty string counts)', () => {
    const v = validateLocaleKeys(keys, 'en', {
      locale: 'en',
      sourceFileName: 'en.json',
      strings: { welcome: '', bye: 'x' },
    });
    expect(v.blocked).toBe(false);
    expect(v.missingKeys).toEqual([]);
  });
  it('blocks only the affected locale when a key is missing', () => {
    const v = validateLocaleKeys(keys, 'sv', {
      locale: 'sv',
      sourceFileName: 'sv.json',
      strings: { welcome: 'x' },
    });
    expect(v.blocked).toBe(true);
    expect(v.missingKeys).toEqual(['bye']);
  });
  it('blocks when the catalog is absent', () => {
    const v = validateLocaleKeys(keys, 'de', undefined);
    expect(v.blocked).toBe(true);
  });
});
