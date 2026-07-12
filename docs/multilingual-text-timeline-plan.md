# Multilingual Timeline Text Plan

## Summary

Add optional iMovie-style text clips to AppVid's existing timeline. Clips reference keys from imported locale JSON files, share timing and styling across languages, preview with deterministic multiline wrapping, and export selected locales sequentially into a user-chosen folder.

Implementation uses two contract-first parallel waves. The lead agent owns shared contracts and integration; subagents receive exclusive file ownership to minimize conflicts.

Estimated effort: 7–10 focused engineering days.

## Contracts and behavior

### Project types

```ts
type LocaleCode = string;
type HorizontalTextAlign = 'left' | 'center' | 'right';
type VerticalTextAlign = 'top' | 'middle' | 'bottom';

interface TimelineInterval {
  startTime: number;
  duration: number;
}

interface TextCueDefinition extends TimelineInterval {
  stringKey: string;
  horizontalAlign: HorizontalTextAlign;
  verticalAlign: VerticalTextAlign;
  color: string; // normalized uppercase #RRGGBB
  fontSize: number; // output pixels
}

interface TextCue {
  id: string;
  origin: 'timeline-import' | 'manual';
  base: TextCueDefinition;
  overrides: Partial<TextCueDefinition>;
}

interface TranslationCatalog {
  locale: LocaleCode;
  sourceFileName: string;
  strings: Record<string, string>;
}

interface TextProjectState {
  catalogs: Record<LocaleCode, TranslationCatalog>;
  cues: TextCue[];
  previewLocale: LocaleCode | null;
}

type ProjectSelection =
  | { kind: 'audio'; id: string }
  | { kind: 'video'; id: string }
  | { kind: 'text'; id: string }
  | null;
```

`resolveTextCue()` returns `base` merged with `overrides`. Imported defaults can therefore be updated without losing editor changes, and “Reset to imported defaults” clears overrides.

Audio and text consume shared utilities for interval movement, clamping, timecode handling, keyboard nudging, deletion, and collision-lane assignment.

### Locale files

Files are identified by canonical BCP 47 filename, such as `en.json`, `pt-BR.json`, or an optional additional locale such as `ar.json`.

```json
{
  "welcome_title": "Create something\namazing",
  "feature_export": "Export locally"
}
```

Rules:

- Top-level object containing string values only.
- Keys are non-empty, exact, and case-sensitive.
- Values may be empty and may contain newlines.
- Locale tags are canonicalized with `Intl.getCanonicalLocales`.
- `timeline.json` is a reserved filename.
- Duplicate files for the same canonical locale reject that locale import.
- Reimporting a locale replaces its dictionary wholesale.
- English and text generally are optional.

### Optional timeline file

```json
{
  "version": 1,
  "cues": [
    {
      "id": "intro-title",
      "stringKey": "welcome_title",
      "startTime": 1.5,
      "duration": 3,
      "horizontalAlign": "center",
      "verticalAlign": "bottom",
      "color": "#FFFFFF",
      "fontSize": 72
    }
  ]
}
```

Rules:

- `version`, `cues`, `id`, `stringKey`, `startTime`, and `duration` are required.
- Style fields are optional and default to center, bottom, white, and 72px.
- `startTime` must be finite and non-negative; `duration` must be finite and positive.
- Cue IDs must be unique within the file.
- Unknown fields produce warnings and are ignored.
- Invalid cues are skipped while valid cues import.
- Malformed JSON or an unsupported version rejects the whole timeline file.
- Timeline reimport updates imported cue bases by ID while preserving overrides.
- New IDs append; absent IDs remain; collisions with manual cue IDs are skipped.
- Cues outside the current video duration remain valid and produce warnings rather than being modified.

Manual placement uses the current playhead and a three-second duration, clamped to the remaining video. Placement at the exact video end is disabled because it would produce a zero-length cue.

### Rendering rules

- Active interval is `startTime <= time < startTime + duration`.
- All simultaneously active cues render.
- Text uses a fixed 5% safe-area inset and wraps within the central 90% of the frame.
- Explicit newlines split paragraphs before automatic wrapping.
- Wrapping prefers whitespace and falls back to grapheme boundaries for long tokens and Japanese.
- Empty explicit lines are preserved.
- Horizontal alignment applies to every rendered line.
- Vertical alignment positions the complete multiline block.
- Overflow is clipped and reported as a non-blocking warning.
- No automatic font shrinking, ellipsis, transparency, or font picker.
- Bundle TTF versions of Noto Sans and Noto Sans Japanese, including their licenses.
- Additional locales use Noto Sans on a best-effort basis.
- Preview and export consume the same computed line breaks and line-height contract.

### Validation and export

A locale is blocked only if its catalog is absent or lacks a key referenced by a resolved cue. Empty strings count as present. Other locales continue exporting.

Filename format:

```text
<sanitized-project>-<sanitized-preset>-<canonical-locale>.mp4
```

Existing files are not overwritten; append `-2`, `-3`, etc.

Projects without text retain the existing single-video export workflow.

## Parallel implementation

### Wave 0: lead agent foundation

Complete and commit this foundation before subagents begin:

1. Verify the checked-in FFmpeg WASM executes `drawtext` with explicit `fontfile`, Unicode text files, and both bundled fonts. If this fails, stop and replace/build a compatible core before proceeding.
2. Add the frozen types above and pure modules for:
   - intervals, lanes, and timecodes;
   - text package parsing and validation contracts;
   - locale validation;
   - text wrapping/layout;
   - export filename generation.
3. Add font assets and `@font-face` declarations.
4. Fix the stale default project preset: derive initial settings from `STORE_PRESETS[0]` instead of the removed `ios-6.9`/`1320×2868` preset.
5. Publish the exact context, layout, renderer, and batch interfaces for subagents.

Only the lead changes shared contracts after this commit.

### Wave 1: three parallel agents

#### Agent A — state, import, and persistence

Exclusive ownership:

- `ProjectContext.tsx`
- new text-package/import utilities
- context/import tests

Implement:

- Catalog and timeline imports with structured summaries.
- Non-destructive cue merge and reset-to-default behavior.
- Manual cue creation, update, deletion, and selection.
- Preview locale selection and browser-locale default.
- Missing-key validation per locale.
- `draftVersion: 2` persistence for catalogs, cues, overrides, preview locale, and batch recovery metadata.
- Migration of unversioned drafts to empty text state.
- Sanitized restoration of corrupt v2 data.

Handoff: final context API, fixture packages, and import-summary shape. Do not edit UI or export files.

#### Agent B — shared timeline and inspector

Exclusive ownership:

- timeline, audio segment, clip inspector, and editor workspace components
- generic interval clip/track components
- associated CSS and component tests

Implement:

- Generic interval clip interactions reused by audio and text.
- Shared drag-to-move, selection, nudge, delete, exact start input, and lane allocation.
- Separate stacked text track with overlapping cues.
- Discriminated project selection instead of multiple nullable IDs.
- Text inspector with key, start, duration/derived stop, nine-position alignment, color, font size, reset, and delete.
- Preserve existing audio behavior and volume controls.
- Rename “Audio Timeline” to “Timeline.”

Do not implement context internals or preview/export rendering.

#### Agent C — text assets and preview

Exclusive ownership:

- asset panel and new text asset components
- video preview and preview-locale components
- associated CSS and component tests

Implement:

- Audio/Text sections in Assets.
- Multi-file JSON picker, import summaries, locale status, key search, and “Place at Playhead.”
- “Generate Example JSON Package” using a user-selected folder.
- DOM preview overlays using the frozen layout contract.
- Locale selector independent of export selections.
- Multiple active cues, multiline wrapping, nine alignments, clipping, and overflow warnings.
- Load fonts before showing overlays to avoid reflow.

Do not edit timeline, context implementation, or export files.

### Wave 1 integration gate

The lead integrates A, B, and C, resolves contract seams, and runs targeted tests plus a production build.

Freeze a `LaidOutTextCue` contract containing resolved timing, explicit wrapped lines, font selection, font size, line height, alignment, safe-area geometry, and overflow status. Preview and exporter may not independently wrap text.

### Wave 2: three parallel agents

#### Agent D — FFmpeg locale renderer

Exclusive ownership:

- `ffmpegEngine.ts`
- video-filter command builder
- FFmpeg rendering tests

Expose:

```ts
interface RenderVideoOptions {
  locale?: LocaleCode;
  textOverlays?: LaidOutTextCue[];
  signal?: AbortSignal;
}

async function renderVideo(
  project: Project,
  options: RenderVideoOptions,
  callbacks: RenderCallbacks,
): Promise<Blob>;
```

Implement:

- Preserve existing video trimming, scaling, audio mixing, and output settings.
- Apply text only after scale/pad/crop.
- Stage fonts and one UTF-8 text file per rendered line.
- Use `drawtext=textfile=...` with explicit `fontfile`.
- Render lines separately to guarantee multiline alignment.
- Use timed `enable` expressions matching the half-open active interval.
- Generate virtual filenames from sanitized IDs, never translated content.
- Scope and remove log/progress listeners for every job.
- Clean all temporary media, fonts, text, and output files in `finally`.
- Abort safely; reload FFmpeg for the next job after termination.

Do not implement batch state, directory writes, or export UI.

#### Agent E — batch orchestration and file output

Exclusive ownership:

- new batch/filesystem utilities
- `AppShell`
- processing overlay and recovery integration
- batch tests

Implement statuses:

```ts
type BatchItemStatus =
  | 'queued'
  | 'blocked'
  | 'rendering'
  | 'writing'
  | 'completed'
  | 'failed'
  | 'cancelled';
```

Behavior:

- Detect secure-context `showDirectoryPicker` support.
- Ask for the folder from a user gesture before encoding.
- Process locales strictly sequentially.
- Write and close each file before rendering the next.
- Continue after individual render or write failures.
- Acquire a wake lock when supported and always release it.
- Cancellation aborts the active render, marks remaining items cancelled, and preserves completed files.
- Persist only serializable recovery metadata; never promise persisted directory permission.
- Recovery requires folder reselection and queues unfinished or failed locales.
- Resolve collisions without overwriting.

Do not edit FFmpeg command construction or export settings UI.

#### Agent F — export and completion UI

Exclusive ownership:

- export settings sheet
- export completion panel
- export-specific CSS and component tests

Implement:

- Locale checkboxes when text cues exist.
- Imported built-in locales checked by default.
- Additional locales imported but unchecked by default.
- Per-locale missing-key blocking details.
- Preview locale and export selections remain independent.
- Batch state display for every status.
- Disable start when no locale is checked.
- Chrome/Edge explanation when folder access is unavailable.
- Unsupported browsers retain one-locale Blob download; no ZIP fallback.
- No-text projects retain the current export interface.

### Final integration

The lead alone resolves shared-file conflicts and performs:

1. Foundation → Wave 1A → Wave 1B/1C integration.
2. Layout parity checkpoint.
3. Wave 2D → Wave 2E → Wave 2F integration.
4. Draft/backward-compatibility pass.
5. Full formatting, linting, tests, FFmpeg smoke test, and build.

Each subagent must:

- Stay within assigned files unless the lead approves a change.
- List exported symbols and assumptions in its handoff.
- Add tests for its contract.
- Run targeted Vitest and typechecking.
- Avoid repository-wide formatting while other agents are active.

## Test and acceptance plan

### Unit tests

- Shared interval/lane behavior remains identical for audio and works for text.
- Timecode parsing, nudging, clamping, and derived stop timestamps.
- Locale canonicalization including `pt-br` → `pt-BR`.
- Additional valid tags accepted; invalid/reserved filenames rejected.
- Multiline, empty values, malformed catalogs, and duplicate locale files.
- Timeline defaults, partial valid import, duplicate IDs, and invalid values.
- Reimport replaces bases while preserving overrides and absent cues.
- Unversioned draft migration and corrupt-v2 recovery.
- Missing keys block only their locale; empty strings are valid.
- Explicit newlines, whitespace wrapping, Japanese/grapheme wrapping, and empty lines.
- Nine alignment combinations and overflow warnings.
- Filename sanitization and `-2`/`-3` collision handling.
- Sequential batch execution, continue-on-failure, cancellation, wake-lock failure, and directory-write failure.

### Component tests

- Text files populate a searchable key library.
- Timeline import creates clips; keys can be manually placed.
- Text and audio use the same drag, selection, nudge, and delete behavior.
- Preview locale defaults to browser match or first imported locale.
- Changing locale changes only rendered text/wrapping.
- Overlapping cues render simultaneously.
- Alignment applies per line and vertically to the whole block.
- Overflow warns without disabling export.
- Export checkboxes show per-locale blocking reasons and all batch statuses.
- Unsupported folder access exposes only the single-locale fallback.

### FFmpeg smoke test

Add a separate slow script using the checked-in browser WASM:

- Generate a short solid-color source.
- Render accented Latin, Japanese, punctuation/backslashes, explicit newlines, and overlapping cues.
- Cover portrait and landscape.
- Extract frames before, during, and at/after a cue.
- Verify text is absent before, present during, and absent at the exclusive end.
- Fail clearly when `drawtext` or a font cannot load.

### Browser integration

In Chromium:

- Import a short fixture plus two locales and an optional timeline.
- Preview multiline localized text.
- Stub directory handles in CI and verify sequential writes.
- Verify language-tagged filenames and collision suffixes.
- Force one locale failure and confirm the other completes.
- Confirm cancellation clears processing UI and preserves completed status.

Keep a manual real-folder smoke test for permission prompts, playable output files, wake lock, cancellation, and recovery after folder reselection.

Final commands:

```sh
bun run format
bun run lint
bun run test -- --run
bun run build
```

Expose the slower FFmpeg smoke test as a separate Bun script.

## Assumptions and defaults

- Text, locale files, and `timeline.json` are optional.
- Built-in initial locales are `en`, `sv`, `it`, `tr`, `pt-BR`, `de`, `fr`, `ja`, and `es`.
- Extra BCP 47 locales are accepted but not selected by default.
- Default cue: center/bottom, `#FFFFFF`, `72px`, three seconds, 5% safe inset.
- Font sizes are fixed output pixels; active portrait presets share a 1920px height.
- Landscape text is supported.
- Colors are opaque `#RRGGBB`.
- Overflow and out-of-range timing warn but do not block.
- Missing translation keys block only the affected locale.
- Folder batches require supported Chromium browsers and an open tab.
- Interrupted recovery requires the user to reselect a folder.
- Already-written files are never removed or overwritten.
- No ZIP fallback, font picker, opacity control, font shrinking, or full complex-script guarantee in v1.
