/**
 * Frozen text/timeline contracts for the multilingual text feature.
 *
 * These types are the shared contract between the lead and every Wave 1/2
 * subagent. Only the lead changes this file after Wave 0. See
 * docs/multilingual-text-timeline-plan.md and docs/text-subagent-contracts.md.
 */

/** Canonical BCP 47 locale code (e.g. "en", "pt-BR", "ja"). */
export type LocaleCode = string;

export type HorizontalTextAlign = 'left' | 'center' | 'right';
export type VerticalTextAlign = 'top' | 'middle' | 'bottom';

/** Shared interval shape used by audio segments, video segments, and text cues. */
export interface TimelineInterval {
  startTime: number;
  duration: number;
}

/** Half-open end time: a cue is active on `[startTime, stopTime)`. */
export const stopTimeOf = (i: TimelineInterval): number => i.startTime + i.duration;

/** A cue active at time `t` satisfies `startTime <= t < stopTime`. */
export const isIntervalActive = (i: TimelineInterval, t: number): boolean =>
  t >= i.startTime && t < stopTimeOf(i);

/** Fully-resolved text definition (base merged with overrides). */
export interface TextCueDefinition extends TimelineInterval {
  stringKey: string;
  horizontalAlign: HorizontalTextAlign;
  verticalAlign: VerticalTextAlign;
  /** Normalized uppercase #RRGGBB. */
  color: string;
  /** Output pixels. */
  fontSize: number;
}

/** Merge base with overrides, overrides winning. */
export const resolveTextCue = (cue: TextCue): TextCueDefinition => ({
  ...cue.base,
  ...cue.overrides,
});

/** A cue in the project, either imported from timeline.json or placed manually. */
export interface TextCue {
  id: string;
  origin: 'timeline-import' | 'manual';
  base: TextCueDefinition;
  /** Non-destructive editor changes; cleared by "Reset to imported defaults". */
  overrides: Partial<TextCueDefinition>;
}

/** One imported locale dictionary. */
export interface TranslationCatalog {
  locale: LocaleCode;
  sourceFileName: string;
  strings: Record<string, string>;
}

/** Text-specific slice of project state (lives inside ProjectContext). */
export interface TextProjectState {
  catalogs: Record<LocaleCode, TranslationCatalog>;
  cues: TextCue[];
  /** Independent of export locale selections. */
  previewLocale: LocaleCode | null;
}

/** Discriminated project selection replaces several nullable IDs. */
export type ProjectSelection =
  | { kind: 'audio'; id: string }
  | { kind: 'video'; id: string }
  | { kind: 'text'; id: string }
  | null;

/** Which font a resolved cue renders with. */
export type TextFontFamily = 'noto-sans' | 'noto-sans-jp';

/**
 * Frozen layout contract. Preview (DOM) and exporter (drawtext) MUST consume
 * the SAME computed line breaks and line-height. Neither may re-wrap.
 */
export interface LaidOutTextCue {
  id: string;
  startTime: number;
  duration: number;
  stopTime: number;
  /** Explicit wrapped lines: explicit-newline paragraphs first, then auto wrap. */
  lines: string[];
  fontFamily: TextFontFamily;
  /** Asset/virtual filename used by drawtext `fontfile`. */
  fontFileName: string;
  fontSize: number;
  /** Total line height in output px (fontSize * lineHeightMultiplier). */
  lineHeight: number;
  horizontalAlign: HorizontalTextAlign;
  verticalAlign: VerticalTextAlign;
  color: string;
  /** Safe-area inset in output px per axis (5% by default). */
  safeAreaInset: number;
  /** Wrap target width in output px (central 90% of frame). */
  contentWidth: number;
  /** Measured width of the widest line in output px. */
  blockWidth: number;
  /** Measured total block height in output px. */
  blockHeight: number;
  overflow: boolean;
  overflowAxis: 'none' | 'horizontal' | 'vertical' | 'both';
}

/** Measures rendered text width in output pixels. Injectable for tests. */
export type MeasureText = (text: string, fontFamily: TextFontFamily, fontSize: number) => number;

/** Frame dimensions for layout. */
export interface FrameGeometry {
  width: number;
  height: number;
}

/** Result of importing a locale catalog file. */
export interface CatalogImportResult {
  ok: boolean;
  catalog?: TranslationCatalog;
  /** Fatal errors that rejected this file. */
  errors: string[];
}

/** Result of importing many catalog files at once. */
export interface CatalogBatchResult {
  /** canonical locale -> catalog, only accepted files. */
  accepted: Record<LocaleCode, TranslationCatalog>;
  /** one entry per input file (accepted or rejected). */
  summaries: CatalogFileSummary[];
  /** canonical locales that collided with another file in the same batch. */
  duplicateLocales: LocaleCode[];
}

export interface CatalogFileSummary {
  fileName: string;
  locale: LocaleCode | null;
  accepted: boolean;
  stringCount: number;
  reasons: string[];
}

/** Raw cue as parsed from timeline.json (before defaulting/validation). */
export interface RawTimelineCue {
  id?: unknown;
  stringKey?: unknown;
  startTime?: unknown;
  duration?: unknown;
  horizontalAlign?: unknown;
  verticalAlign?: unknown;
  color?: unknown;
  fontSize?: unknown;
  [key: string]: unknown;
}

/** Result of importing a timeline.json file. */
export interface TimelineImportResult {
  ok: boolean;
  version: number | null;
  /** Valid cues parsed (invalid cues skipped while valid import). */
  cues: TextCue[];
  errors: string[];
  warnings: string[];
}

/** Result of merging imported cues into existing cues on reimport. */
export interface CueMergeResult {
  cues: TextCue[];
  appended: string[];
  updated: string[];
  /** Existing IDs that the import did not touch. */
  retained: string[];
  /** Imported IDs that collided with manual cue IDs and were skipped. */
  skipped: string[];
}

/** Missing-key validation for one locale. */
export interface LocaleKeyValidation {
  locale: LocaleCode;
  /** True when export of this locale is allowed. */
  blocked: boolean;
  /** Resolved keys this locale is missing (blocks only this locale). */
  missingKeys: string[];
  reasons: string[];
}

export type BatchItemStatus =
  'queued' | 'blocked' | 'rendering' | 'writing' | 'completed' | 'failed' | 'cancelled';

export interface BatchRecoveryItem {
  locale: LocaleCode;
  status: BatchItemStatus;
  /** Non-blocking human message for failed/blocked items. */
  message?: string;
}
