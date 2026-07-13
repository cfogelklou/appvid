/**
 * Locale canonicalization and catalog-file validation.
 *
 * Files are identified by canonical BCP 47 filename (en.json, pt-BR.json,
 * ar.json). Locale tags are canonicalized with Intl.getCanonicalLocales.
 */
import { RESERVED_LOCALE_FILENAMES } from './constants';
import type { CatalogFileSummary, LocaleCode } from './types';

/**
 * Canonicalize a BCP 47 tag, e.g. "pt-br" -> "pt-BR". Returns null when the tag
 * is invalid (Intl.getCanonicalLocales throws).
 */
export const canonicalizeLocale = (tag: string): LocaleCode | null => {
  try {
    const [canonical] = Intl.getCanonicalLocales(tag);
    return typeof canonical === 'string' ? canonical : null;
  } catch {
    return null;
  }
};

/** Extract the locale tag from a catalog filename ("pt-BR.json" -> "pt-BR"). */
export const localeTagFromFileName = (fileName: string): string | null => {
  const base = fileName.split('/').pop() ?? fileName;
  if (!/\.json$/i.test(base)) return null;
  const stem = base.replace(/\.json$/i, '');
  if (stem === '') return null;
  return stem;
};

/** Reserved filenames (timeline.json) may not be locale catalogs. */
export const isReservedFileName = (fileName: string): boolean => {
  const base = (fileName.split('/').pop() ?? fileName).toLowerCase();
  return RESERVED_LOCALE_FILENAMES.some((r) => r.toLowerCase() === base);
};

/**
 * Derive the canonical locale for a catalog file, or null when the filename is
 * reserved or its tag is invalid.
 */
export const localeFromFile = (fileName: string): LocaleCode | null => {
  if (isReservedFileName(fileName)) return null;
  const tag = localeTagFromFileName(fileName);
  if (tag == null) return null;
  return canonicalizeLocale(tag);
};

/** Is this locale one of the built-in initial locales? */
export const isBuiltInLocale = (
  locale: LocaleCode,
  builtIns: LocaleCode[],
): boolean => builtIns.some((b) => b === locale);

/**
 * Validate the raw JSON value of a catalog file. Accepts a top-level object of
 * string values only. Keys are non-empty, exact, case-sensitive. Values may be
 * empty and may contain newlines. Unknown JSON shapes are rejected.
 *
 * Returns the validated strings record plus a summary; never throws.
 */
export const validateCatalogValue = (
  fileName: string,
  value: unknown,
): { strings: Record<string, string> | null; summary: CatalogFileSummary } => {
  const reasons: string[] = [];
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    reasons.push('Top level must be an object of string values.');
    return { strings: null, summary: { fileName, locale: null, accepted: false, stringCount: 0, reasons } };
  }
  const obj = value as Record<string, unknown>;
  const strings: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === '') {
      reasons.push('Empty string keys are not allowed.');
      continue;
    }
    if (typeof val !== 'string') {
      reasons.push(`Value for key "${key}" must be a string.`);
      continue;
    }
    strings[key] = val;
  }
  return {
    strings,
    summary: {
      fileName,
      locale: null, // filled in by caller once locale is resolved
      accepted: true,
      stringCount: Object.keys(strings).length,
      reasons,
    },
  };
};

/** Locale the preview should default to: the browser locale if imported, else the first imported locale, else null. */
export const defaultPreviewLocale = (
  importedLocales: LocaleCode[],
  browserLocale: string | undefined,
): LocaleCode | null => {
  if (importedLocales.length === 0) return null;
  if (browserLocale) {
    const canon = canonicalizeLocale(browserLocale);
    if (canon && importedLocales.includes(canon)) return canon;
    // Fall back to language-only match (e.g. browser "en-US" -> imported "en").
    const lang = browserLocale.split('-')[0];
    const langMatch = importedLocales.find((l) => l === lang || l.split('-')[0] === lang);
    if (langMatch) return langMatch;
  }
  return importedLocales[0]!;
};
