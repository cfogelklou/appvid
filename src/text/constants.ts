/**
 * Frozen defaults and constants for the text feature. Lead-owned.
 */
import type {
  HorizontalTextAlign,
  LocaleCode,
  TextCueDefinition,
  TextFontFamily,
  VerticalTextAlign,
} from './types';

/** Timeline.json schema version this build reads/writes. */
export const TIMELINE_VERSION = 1;

/** Persistence draft schema version. Unversioned drafts migrate to v2. */
export const DRAFT_VERSION = 2;

/** Manual cue default duration (seconds). */
export const DEFAULT_CUE_DURATION = 3;

/** Safe-area inset as a fraction of each frame axis. */
export const SAFE_AREA_INSET_FRACTION = 0.05;

/** Multiplier applied to fontSize to get line height. Shared preview/export. */
export const LINE_HEIGHT_MULTIPLIER = 1.2;

export const DEFAULT_HORIZONTAL_ALIGN: HorizontalTextAlign = 'center';
export const DEFAULT_VERTICAL_ALIGN: VerticalTextAlign = 'bottom';
export const DEFAULT_TEXT_COLOR = '#FFFFFF';
export const DEFAULT_FONT_SIZE = 72;

/** Shared portrait target height for font-size scaling parity. */
export const PORTRAIT_REFERENCE_HEIGHT = 1920;

/** Built-in locales imported automatically (English and text are optional). */
export const BUILT_IN_LOCALES: LocaleCode[] = [
  'en',
  'sv',
  'it',
  'tr',
  'pt-BR',
  'de',
  'fr',
  'ja',
  'es',
];

/** Reserved filename; cannot be used as a locale catalog. */
export const RESERVED_LOCALE_FILENAMES = ['timeline.json'];

/** drawtext expects the path relative to FFmpeg's virtual FS root. */
export const FONT_ASSET: Record<TextFontFamily, { fileName: string; cssFamily: string }> = {
  'noto-sans': {
    fileName: 'NotoSans-Regular.ttf',
    cssFamily: "'Noto Sans', sans-serif",
  },
  'noto-sans-jp': {
    fileName: 'NotoSansJP-Regular.ttf',
    cssFamily: "'Noto Sans JP', sans-serif",
  },
};

/**
 * Build a cue base definition using frozen defaults. Wave 0/agents use this so
 * the default cue stays consistent everywhere (timeline.json defaults match
 * manual placement defaults match inspector reset).
 */
export const createDefaultCueBase = (
  stringKey: string,
  startTime: number,
  duration: number = DEFAULT_CUE_DURATION,
): TextCueDefinition => ({
  stringKey,
  startTime,
  duration,
  horizontalAlign: DEFAULT_HORIZONTAL_ALIGN,
  verticalAlign: DEFAULT_VERTICAL_ALIGN,
  color: DEFAULT_TEXT_COLOR,
  fontSize: DEFAULT_FONT_SIZE,
});
