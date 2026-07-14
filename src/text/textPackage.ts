/**
 * Text package parsing and validation: catalog imports, optional timeline.json,
 * non-destructive cue merge, and per-locale missing-key validation.
 *
 * Lead-owned. Agent A consumes these to drive ProjectContext.
 */
import {
  createDefaultCueBase,
  DEFAULT_CUE_DURATION,
  DEFAULT_FONT_SIZE,
  DEFAULT_HORIZONTAL_ALIGN,
  DEFAULT_TEXT_COLOR,
  DEFAULT_VERTICAL_ALIGN,
  TIMELINE_VERSION,
} from './constants';
import type {
  CatalogBatchResult,
  CatalogFileSummary,
  CatalogImportResult,
  CueMergeResult,
  LocaleCode,
  LocaleKeyValidation,
  RawTimelineCue,
  TextCue,
  TextCueDefinition,
  TimelineImportResult,
  TranslationCatalog,
} from './types';
import { localeFromFile, validateCatalogValue } from './localeValidation';

export interface CatalogFileInput {
  fileName: string;
  /** Raw file text (already UTF-8 decoded by the caller). */
  text: string;
}

/** Normalize a color to uppercase #RRGGBB, or null if not a valid hex color. */
export const normalizeColor = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.replace(/^#/, '').toUpperCase()}`;
  }
  return null;
};

/** Validate + parse a single catalog file text into a TranslationCatalog. */
export const parseCatalog = (fileName: string, text: string): CatalogImportResult => {
  const errors: string[] = [];
  const locale = localeFromFile(fileName);
  if (locale == null) {
    errors.push(
      `Filename "${fileName}" is reserved or is not a valid BCP 47 locale file (e.g. en.json, pt-BR.json).`,
    );
    return { ok: false, errors };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    errors.push(`Malformed JSON: ${(e as Error).message}`);
    return { ok: false, errors };
  }
  const { strings, summary } = validateCatalogValue(fileName, value);
  if (strings == null) {
    return { ok: false, errors: errors.concat(summary.reasons) };
  }
  const catalog: TranslationCatalog = { locale, sourceFileName: fileName, strings };
  return { ok: true, catalog, errors: summary.reasons };
};

/**
 * Parse many catalog files at once. Duplicate canonical locales (two files for
 * the same locale in one batch) are rejected — neither is accepted.
 */
export const parseCatalogBatch = (inputs: CatalogFileInput[]): CatalogBatchResult => {
  const accepted: Record<LocaleCode, TranslationCatalog> = {};
  const summaries: CatalogFileSummary[] = [];
  // Map locale -> files that claim it, to detect duplicates.
  const localeToFiles = new Map<LocaleCode, string[]>();

  const perFile: { fileName: string; locale: LocaleCode | null; result: CatalogImportResult }[] =
    [];
  for (const { fileName, text } of inputs) {
    const result = parseCatalog(fileName, text);
    const locale = result.ok ? result.catalog!.locale : null;
    perFile.push({ fileName, locale, result });
    if (result.ok && locale) {
      const list = localeToFiles.get(locale) ?? [];
      list.push(fileName);
      localeToFiles.set(locale, list);
    }
  }

  const duplicateLocales: LocaleCode[] = [];
  for (const [locale, files] of localeToFiles) {
    if (files.length > 1) duplicateLocales.push(locale);
  }
  const dupSet = new Set(duplicateLocales);

  for (const { fileName, locale, result } of perFile) {
    if (!result.ok) {
      summaries.push({
        fileName,
        locale,
        accepted: false,
        stringCount: 0,
        reasons: result.errors,
      });
      continue;
    }
    if (locale && dupSet.has(locale)) {
      summaries.push({
        fileName,
        locale,
        accepted: false,
        stringCount: Object.keys(result.catalog!.strings).length,
        reasons: [`Duplicate locale "${locale}" — another file in this import also targets it.`],
      });
      continue;
    }
    accepted[locale!] = result.catalog!;
    summaries.push({
      fileName,
      locale,
      accepted: true,
      stringCount: Object.keys(result.catalog!.strings).length,
      reasons: result.errors,
    });
  }

  return { accepted, summaries, duplicateLocales };
};

const isFiniteNonNegative = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0;
const isFinitePositive = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

const knownCueFields = new Set<keyof RawTimelineCue>([
  'id',
  'stringKey',
  'startTime',
  'duration',
  'horizontalAlign',
  'verticalAlign',
  'color',
  'fontSize',
]);

const isHorizontalAlign = (v: unknown): v is TextCueDefinition['horizontalAlign'] =>
  v === 'left' || v === 'center' || v === 'right';
const isVerticalAlign = (v: unknown): v is TextCueDefinition['verticalAlign'] =>
  v === 'top' || v === 'middle' || v === 'bottom';

/**
 * Parse timeline.json. Malformed JSON or an unsupported version rejects the
 * whole file. Otherwise each cue is validated; invalid cues are skipped while
 * valid cues import. Duplicate IDs within the file are skipped. Unknown fields
 * warn and are ignored.
 */
export const parseTimeline = (text: string): TimelineImportResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (e) {
    errors.push(`Malformed JSON: ${(e as Error).message}`);
    return { ok: false, version: null, cues: [], errors, warnings };
  }
  if (root == null || typeof root !== 'object' || Array.isArray(root)) {
    errors.push('Timeline file top level must be an object.');
    return { ok: false, version: null, cues: [], errors, warnings };
  }
  const obj = root as { version?: unknown; cues?: unknown };
  if (typeof obj.version !== 'number' || !Number.isFinite(obj.version)) {
    errors.push('Missing or invalid required field "version".');
    return { ok: false, version: null, cues: [], errors, warnings };
  }
  const version = obj.version;
  if (version !== TIMELINE_VERSION) {
    errors.push(`Unsupported timeline version ${version} (expected ${TIMELINE_VERSION}).`);
    return { ok: false, version, cues: [], errors, warnings };
  }
  if (!Array.isArray(obj.cues)) {
    errors.push('Missing or invalid required field "cues" (must be an array).');
    return { ok: false, version, cues: [], errors, warnings };
  }

  const cues: TextCue[] = [];
  const seenIds = new Set<string>();
  for (const [index, raw] of (obj.cues as RawTimelineCue[]).entries()) {
    const prefix = `cue[${index}]`;
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      warnings.push(`${prefix}: not an object, skipped.`);
      continue;
    }
    // Unknown fields warn (but do not reject the cue).
    for (const key of Object.keys(raw)) {
      if (!knownCueFields.has(key as keyof RawTimelineCue)) {
        warnings.push(`${prefix}: unknown field "${key}" ignored.`);
      }
    }
    if (typeof raw.id !== 'string' || raw.id === '') {
      warnings.push(`${prefix}: missing or invalid "id", skipped.`);
      continue;
    }
    if (seenIds.has(raw.id)) {
      warnings.push(`${prefix}: duplicate id "${raw.id}", skipped.`);
      continue;
    }
    if (typeof raw.stringKey !== 'string' || raw.stringKey === '') {
      warnings.push(`${prefix} (${raw.id}): missing "stringKey", skipped.`);
      continue;
    }
    if (!isFiniteNonNegative(raw.startTime)) {
      warnings.push(`${prefix} (${raw.id}): "startTime" must be finite and non-negative, skipped.`);
      continue;
    }
    if (!isFinitePositive(raw.duration)) {
      warnings.push(`${prefix} (${raw.id}): "duration" must be finite and positive, skipped.`);
      continue;
    }

    const color = normalizeColor(raw.color);
    if (raw.color !== undefined && color == null) {
      warnings.push(`${prefix} (${raw.id}): invalid color "${String(raw.color)}", using default.`);
    }

    const base: TextCueDefinition = createDefaultCueBase(raw.stringKey, raw.startTime, raw.duration);
    if (isHorizontalAlign(raw.horizontalAlign)) base.horizontalAlign = raw.horizontalAlign;
    else if (raw.horizontalAlign !== undefined)
      warnings.push(`${prefix} (${raw.id}): invalid horizontalAlign, using default.`);
    if (isVerticalAlign(raw.verticalAlign)) base.verticalAlign = raw.verticalAlign;
    else if (raw.verticalAlign !== undefined)
      warnings.push(`${prefix} (${raw.id}): invalid verticalAlign, using default.`);
    if (color) base.color = color;
    if (typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize) && raw.fontSize > 0) {
      base.fontSize = raw.fontSize;
    } else if (raw.fontSize !== undefined) {
      warnings.push(`${prefix} (${raw.id}): invalid fontSize, using default.`);
    }

    seenIds.add(raw.id);
    cues.push({ id: raw.id, origin: 'timeline-import', base, overrides: {} });
  }

  return { ok: true, version, cues, errors, warnings };
};

/**
 * Merge imported cues into existing cues on reimport. By ID: existing imported
 * cues get their base updated while preserving overrides; new IDs append; IDs
 * absent from the import remain; imported IDs that collide with MANUAL cue IDs
 * are skipped (never overwrite a user-placed cue).
 */
export const mergeCues = (existing: TextCue[], imported: TextCue[]): CueMergeResult => {
  const importedById = new Map(imported.map((c) => [c.id, c]));
  const appended: string[] = [];
  const updated: string[] = [];
  const retained: string[] = [];
  const skipped: string[] = [];

  const result: TextCue[] = existing.map((cue) => {
    const incoming = importedById.get(cue.id);
    if (!incoming) {
      retained.push(cue.id);
      return cue;
    }
    importedById.delete(cue.id);
    if (cue.origin === 'manual') {
      // Collision with a manual cue: skip the import for this id.
      skipped.push(cue.id);
      return cue;
    }
    // Update base, keep overrides (overrides still win after merge).
    updated.push(cue.id);
    return { ...cue, base: incoming.base };
  });

  // Remaining imported IDs are brand new -> append.
  for (const incoming of importedById.values()) {
    appended.push(incoming.id);
    result.push(incoming);
  }

  return { cues: result, appended, updated, retained, skipped };
};

/**
 * Validate one locale against resolved cue keys. A locale is blocked only if its
 * catalog is absent or lacks a key referenced by a resolved cue. Empty strings
 * count as present.
 */
export const validateLocaleKeys = (
  resolvedKeys: string[],
  locale: LocaleCode,
  catalog: TranslationCatalog | undefined,
): LocaleKeyValidation => {
  const reasons: string[] = [];
  if (!catalog) {
    return {
      locale,
      blocked: true,
      missingKeys: [],
      reasons: [`No catalog imported for "${locale}".`],
    };
  }
  const missingKeys = resolvedKeys.filter((k) => !(k in catalog.strings));
  if (missingKeys.length > 0) {
    reasons.push(`Missing ${missingKeys.length} key(s): ${missingKeys.join(', ')}.`);
  }
  return { locale, blocked: missingKeys.length > 0, missingKeys, reasons };
};

/** Re-export defaults for callers that build manual cues. */
export {
  DEFAULT_CUE_DURATION,
  DEFAULT_FONT_SIZE,
  DEFAULT_HORIZONTAL_ALIGN,
  DEFAULT_TEXT_COLOR,
  DEFAULT_VERTICAL_ALIGN,
};
