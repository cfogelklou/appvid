/**
 * Export filename generation and collision handling.
 *
 * Format: <sanitized-project>-<sanitized-preset>-<canonical-locale>.mp4
 * Existing files are never overwritten; append -2, -3, etc.
 */
import type { LocaleCode } from './types';

/** Sanitize a name segment for use in a filename: keep alphanumerics + dash, collapse runs. */
export const sanitizeName = (input: string): string => {
  const cleaned = input
    .trim()
    .toLowerCase()
    // Replace any run of non [a-z0-9] with a single dash.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned === '' ? 'untitled' : cleaned;
};

export interface ExportFilenameInput {
  projectName: string;
  presetName: string;
  locale: LocaleCode;
  extension?: string;
}

/** Build the base export filename for one locale. */
export const buildExportFilename = (input: ExportFilenameInput): string => {
  const ext = (input.extension ?? 'mp4').replace(/^\.*/, '');
  const project = sanitizeName(input.projectName);
  const preset = sanitizeName(input.presetName);
  // Locale is canonical (e.g. "pt-BR"), not sanitized/lowercased — the plan
  // specifies "<canonical-locale>". Canonical BCP 47 is already filename-safe.
  const locale = input.locale;
  return `${project}-${preset}-${locale}.${ext}`;
};

/**
 * Resolve a filename collision against existing names without overwriting.
 * Returns `base` when not taken; otherwise `stem-2.ext`, `stem-3.ext`, etc.
 */
export const resolveCollision = (base: string, existing: Iterable<string>): string => {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let counter = 2;
  // Upper bound guards against pathological inputs.
  while (taken.has(`${stem}-${counter}${ext}`) && counter < 100000) {
    counter++;
  }
  return `${stem}-${counter}${ext}`;
};
