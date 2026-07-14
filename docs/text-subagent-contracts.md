# Multilingual Text Feature — Subagent Contracts

> **Frozen at Wave 0 (commit `<TBD>`).** Only the lead (Claude) may change this document. Subagents implement to these exact signatures.

## Table of Contents

- [Shared Types](#shared-types)
- [Wave 1 — Agent A (State/Import/Persistence)](#wave-1---agent-a-stateimportpersistence)
- [Wave 1 — Agent B (Timeline + Inspector)](#wave-1---agent-b-timeline--inspector)
- [Wave 1 — Agent C (Assets + Preview)](#wave-1---agent-c-assets--preview)
- [Wave 1 Integration — `LaidOutTextCue`](#wave-1-integration---laidouttextcue)
- [Wave 2 — Agent D (FFmpeg Locale Renderer)](#wave-2---agent-d-ffmpeg-locale-renderer)
- [Wave 2 — Agent E (Batch + Filesystem)](#wave-2---agent-e-batch--filesystem)
- [Wave 2 — Agent F (Export + Completion UI)](#wave-2---agent-f-export--completion-ui)
- [File Ownership](#file-ownership)

---

## Shared Types

All agents import from `src/text/` (the barrel export). Core types:

```ts
import type {
  LocaleCode,
  HorizontalTextAlign,
  VerticalTextAlign,
  TextCue,
  TextProjectState,
  ProjectSelection,
  MeasureText,
  FrameGeometry,
  LaidOutTextCue,
  // ...
} from '../text';
```

See `src/text/types.ts` for full definitions. Key contracts:

- `TextCue` — cue with `base` (imported defaults) and `overrides` (editor changes)
- `resolveTextCue(cue)` — merges `base` + `overrides`
- `TextProjectState` — shape stored inside `ProjectContext.text`

---

## Wave 1 — Agent A (State/Import/Persistence)

**Exclusive files:** `src/context/ProjectContext.tsx`, `src/text/importUtils.ts` (new), `src/context/*.test.ts` (new).

**Context API additions (implemented by Agent A, consumed by B/C):**

```ts
// Added to ProjectContextType
interface ProjectContextType {
  // ... existing audio/video fields ...

  // New: text state
  text: TextProjectState;
  setTextState: (state: TextProjectState) => void;

  // New: text cue CRUD
  addTextCue: (cue: Omit<TextCue, 'id' | 'origin'>) => void;
  updateTextCue: (id: string, updates: Partial<Pick<TextCue['base'], 'startTime' | 'duration' | 'stringKey' | 'horizontalAlign' | 'verticalAlign' | 'color' | 'fontSize'>>) & { overridesOnly?: boolean }) => void;
  deleteTextCue: (id: string) => void;

  // New: cue selection (discriminated union replaces multiple nullable IDs)
  selectedTextCueId: string | null;
  setSelectedTextCueId: (id: string | null) => void;

  // New: import functions
  importTextCatalogs: (files: FileList | File[], signal?: AbortSignal) => Promise<CatalogBatchResult>;
  importTextTimeline: (file: File, signal?: AbortSignal) => Promise<TimelineImportResult>;

  // New: export/batch state (managed by Agent E, exposed here)
  batchItems: BatchRecoveryItem[];
  setBatchItems: (items: BatchRecoveryItem[]) => void;

  // Existing: `draftVersion` bumps to 2 (text persistence)
  // Migration: unversioned drafts → empty `text` state
  // Corrupt v2: sanitize and restore what's possible
}
```

**Functions to implement (Agent A only):**

- `importTextCatalogs` — parse multiple JSON files, accumulate catalogs, populate `text.catalogs`, set `text.previewLocale` via `defaultPreviewLocale`. Return `CatalogBatchResult`.
- `importTextTimeline` — parse `timeline.json`, merge cues via `mergeCues`, populate `text.cues`.
- `addTextCue` — create manual cue with ID (`crypto.randomUUID()`), origin `'manual'`, `base` from defaults, push to `text.cues`.
- `updateTextCue` — if `overridesOnly`: update `overrides`. Else: update `base` and clear `overrides` (reset to imported defaults).
- `deleteTextCue` — remove cue, clear selection if matches.

**Persistence (Agent A):**

- `saveDraft` — serialize `text: { catalogs, cues, overrides, previewLocale }`. Bump `draftVersion` to 2. Store per-catalog only `locale` + `sourceFileName` + `strings` (no blob URLs).
- `restoreDraft` — if `draftVersion >= 2`, restore `text`. If `draftVersion` absent (unversioned), initialize `text` to empty. If corrupt v2, sanitize (drop fields that don't match schema) and restore partial.

**Tests (Agent A):**

- Import valid catalog + timeline → state populated.
- Reimport catalog → replaces dictionary wholesale.
- Reimport timeline → merge by ID preserving overrides.
- Manual cue + reimport same ID → manual cue unchanged.
- Reset to defaults → clears overrides.
- Missing key validation → blocks only that locale.
- Draft migration → unversioned → empty text, v2 → restored.

**Do NOT implement:**
- UI components (B/C own those)
- FFmpeg rendering (D owns)
- Batch/file writes (E owns)
- Export settings UI (F owns)

---

## Wave 1 — Agent B (Timeline + Inspector)

**Exclusive files:** All timeline/audio/inspector/workspace components and CSS. `src/components/Timeline.tsx`, `src/components/AudioSegment.tsx`, `src/components/ClipInspector.tsx`, `src/components/EditorWorkspace.tsx`, plus generic interval clip components (new).

**Component changes (Agent B):**

1. **Generic interval clip** (new `src/components/IntervalClip.tsx`) — shared by audio and text.
   - Props: `{ interval: TimelineInterval, label: string, selected: boolean, onSelect, onDrag, onNudge }`.
   - Supports drag-to-move, keyboard nudge, click-select.
   - Renders in assigned lane (via `assignLanes`).

2. **Timeline** — add a second stacked track for text (below audio).
   - Title: rename "Audio Timeline" → "Timeline".
   - Lanes: assign each cue a lane; render stacked cues without overlap.
   - Shared interactions: use `IntervalClip` for both audio and text.

3. **ClipInspector** — discriminated by `ProjectSelection`.
   - Existing: audio inspector (volume, clip start, duration, derived stop).
   - New: text inspector fields:
     - `stringKey` (select from catalog keys or type free)
     - `startTime` (exact input via timecode parser/formatter)
     - `duration` → derived `stopTime` label (`→ 0:03.000`)
     - `horizontalAlign` (9-position grid)
     - `verticalAlign`
     - `color` (color picker, normalized to #RRGGBB)
     - `fontSize` (input, output pixels)
     - "Reset to imported defaults" (clears `overrides`)
     - "Delete" button

4. **Keyboard shortcuts** (existing behavior, now shared):
   - `Delete`/`Backspace` → delete selected cue/segment
   - Arrow keys (with/without modifiers) → nudge start time

5. **EditorWorkspace** — update selection state to use `ProjectSelection` instead of multiple nullable IDs.

**Context usage (Agent B consumes from Agent A):**

- `text.cues` — render text track
- `selectedTextCueId` / `setSelectedTextCueId` — selection
- `updateTextCue` — updates from inspector
- `deleteTextCue` — delete action
- `playhead` — place at playhead on manual cue creation

**Do NOT implement:**
- `ProjectContext` internals (Agent A owns)
- Text import UI (C owns)
- DOM preview rendering (C owns)
- FFmpeg rendering (D owns)

---

## Wave 1 — Agent C (Assets + Preview)

**Exclusive files:** Asset panel, text asset components, video preview, preview locale selector. `src/components/AssetPanel.tsx`, `src/components/TextAssetPanel.tsx` (new), `src/components/VideoPreview.tsx`, `src/components/PreviewLocaleSelector.tsx` (new).

**Components (Agent C):**

1. **AssetPanel** — split into two sections: "Audio" (existing) and "Text" (new).

2. **TextAssetPanel** — new. Sections:
   - Multi-file JSON picker (`<input type="file" multiple accept=".json">`).
   - Import summary table (one row per file: status, locale, string count, reasons).
   - "Generate Example JSON Package" — user selects folder, write `en.json`, `sv.json`, ..., `timeline.json` with sample cues.
   - Locale status list (all imported locales + key counts).
   - Key search: filter to show keys matching query, "Place at Playhead" button per key.

3. **VideoPreview** — overlays for active text cues.
   - On every frame update, compute `activeCues = text.cues.filter(c => isIntervalActive(c, playhead))`.
   - For each active cue: call `layoutCue` with `previewLocale` catalog.
   - Render DOM overlays using `LaidOutTextCue` (absolute positioning, 9 alignments, clip to safe area).
   - Show overflow warning if any cue has `overflow: true`.
   - Load fonts (`@font-face` already in `index.css`) before rendering (browsers handle lazily).

4. **PreviewLocaleSelector** — new. Dropdown to choose `text.previewLocale` (independent of export selections). Defaults to browser match or first imported.

**Context usage (Agent C consumes):**

- `text.catalogs`, `text.previewLocale`, `setPreviewLocale` (from Agent A)
- `text.cues` — render overlays
- `activePreset` — frame geometry (width/height)
- `playhead`, `isPlaying` — update overlays

**Do NOT implement:**
- `ProjectContext` internals (Agent A)
- Timeline/inspector (Agent B)
- FFmpeg rendering (D owns)
- Export UI (F owns)

---

## Wave 1 Integration — `LaidOutTextCue`

**Frozen at Wave 1 integration gate.** Both DOM preview (Agent C) and FFmpeg exporter (Agent D) must consume the SAME computed layout contract. Neither may re-wrap text independently.

Definition (from `src/text/types.ts`):

```ts
interface LaidOutTextCue {
  id: string;
  startTime: number;
  duration: number;
  stopTime: number; // startTime + duration
  lines: string[]; // explicit wrapped lines
  fontFamily: 'noto-sans' | 'noto-sans-jp';
  fontFileName: string; // 'NotoSans-Regular.ttf' or 'NotoSansJP-Regular.ttf'
  fontSize: number; // output px
  lineHeight: number; // output px (fontSize * 1.2)
  horizontalAlign: HorizontalTextAlign;
  verticalAlign: VerticalTextAlign;
  color: string; // #RRGGBB
  safeAreaInset: number; // px (5% per axis)
  contentWidth: number; // px (central 90% of frame)
  blockWidth: number; // px (widest line)
  blockHeight: number; // px (total block)
  overflow: boolean;
  overflowAxis: 'none' | 'horizontal' | 'vertical' | 'both';
}
```

Computed by `layoutCue()` (from `src/text/textLayout.ts`). Agents C and D both call this function and render the exact `lines`, `lineHeight`, and alignment.

**Layout parity checkpoint (Wave 1 gate):**
- Run a fixture cue through `layoutCue` and snapshot `lines`/`blockWidth`/`blockHeight`.
- In DOM preview (Agent C), verify overlay CSS produces same block dims.
- After Wave 2D implementation, verify FFmpeg output frame matches.

---

## Wave 2 — Agent D (FFmpeg Locale Renderer)

**Exclusive files:** `src/utils/ffmpegEngine.ts`, `src/utils/video-filter.ts` (new), FFmpeg rendering tests.

**Function signature (Agent D implements):**

```ts
// Extend existing processVideo options
interface RenderVideoOptions {
  locale?: LocaleCode; // if set, render one locale with text
  textOverlays?: LaidOutTextCue[]; // from layoutCue()
  signal?: AbortSignal; // cancellation
}

async function renderVideo(
  project: Project,
  options: RenderVideoOptions,
  callbacks: RenderCallbacks, // { onProgress, onLog }
): Promise<Blob>;
```

**Behavior (Agent D):**

- **Preserve existing behavior:** when `options.locale` absent, process video exactly as before (trim/scale/audio mix). No text.
- **When `options.locale` present:**
  1. Stage fonts: copy `public/fonts/*.ttf` into FFmpeg virtual FS (`fonts/NotoSans-Regular.ttf`, etc.).
  2. For each `LaidOutTextCue` in `textOverlays`:
     - For each line in `cue.lines`: write a UTF-8 text file (`text/line_${cue.id}_${i}.txt`).
     - Build `drawtext` filter: `drawtext=textfile=text/line_${cue.id}_${i}.txt:fontfile=fonts/${cue.fontFileName}:fontsize=${cue.fontSize}:fontcolor=${cue.color.slice(1)}:x=${...}:y=${...}:alpha=${...}`.
     - Position using `safeAreaInset`, `contentWidth`, `blockWidth`, `blockHeight`, alignments.
  3. Use `enable='between(t,${cue.startTime},${cue.stopTime})'` for half-open interval (active only during cue).
  4. Apply text filters AFTER video scale/pad/crop (in the filter chain order).
  5. For each line: separately render to guarantee multiline alignment (horizontal alignment per line, vertical for block).
  6. Use sanitized virtual filenames (never translated content). `line_cueId_idx.txt`.

**Example filter chain:**
```
[0:v]trim=...:setpts=...[vtrim]; \
[vtrim]scale=...:pad=...[vscaled]; \
[vscaled]drawtext=textfile=text/line_a_0.txt:fontfile=fonts/NotoSans-Regular.ttf:fontsize=72:fontcolor=FFFFFF:x=...:y=...:enable='between(t,1.5,4.5)'[v0]; \
[v0]drawtext=textfile=text/line_a_1.txt:...[v1]; \
[v1]drawtext=textfile=text/line_b_0.txt:...[vout]
```

**Cleanup (Agent D):**
- Scope and remove all `on('progress')` and `on('log')` listeners after each job (don't leak between jobs).
- In `finally`, delete all temp media, fonts, text files from virtual FS.
- Abort safely: call `ffmpeg.terminate()`, then reload FFmpeg for next job (`resetFFmpegInstance`).

**Do NOT implement:**
- Batch state management (Agent E owns)
- Directory writes (Agent E owns)
- Export settings UI (Agent F owns)

---

## Wave 2 — Agent E (Batch + Filesystem)

**Exclusive files:** Batch orchestration utils, `src/AppShell.tsx` (processing overlay + recovery integration), batch tests.

**New types/functions (Agent E implements):**

```ts
type BatchItemStatus = 'queued' | 'blocked' | 'rendering' | 'writing' | 'completed' | 'failed' | 'cancelled';

interface BatchRecoveryItem {
  locale: LocaleCode;
  status: BatchItemStatus;
  message?: string; // non-blocking human message for failed/blocked
}

// Batch orchestration function
interface BatchOrchestrationInput {
  project: Project;
  // locales to export (already validated for missing keys)
  items: Array<{ locale: LocaleCode; cueLayouts: LaidOutTextCue[] }>;
  signal?: AbortSignal;
  callbacks: {
    onProgress: (locale: LocaleCode, status: BatchItemStatus, message?: string) => void;
    onLog: (log: ProcessLog) => void;
  };
  // Folder handle (from showDirectoryPicker) — reselected on recovery
  directoryHandle?: FileSystemDirectoryHandle;
}

async function executeBatch(
  input: BatchOrchestrationInput,
): Promise<{
  completed: LocaleCode[];
  failed: LocaleCode[];
  cancelled: LocaleCode[];
}>;
```

**Behavior (Agent E):**

1. **Detect support:** check `window.showDirectoryPicker` exists. If not, export UI (Agent F) shows single-locale fallback; batch not offered.
2. **Ask for folder:** call `showDirectoryPicker()` from a user gesture before encoding. Store handle (NOT persistable).
3. **Sequential processing:** locales strictly sequential (not parallel). For each:
   - Set status to `rendering`.
   - Call `renderVideo(project, { locale, textOverlays, signal })`.
   - On success: set status to `writing`, obtain `Blob`, write file via `directoryHandle.getFileHandle(..., { create })` then `createWritable()`. Close handle after write.
   - On failure (render or write): set status to `failed`, store message, continue to next locale.
   - On abort: mark active as `cancelled`, remaining as `cancelled`, preserve completed files.
4. **Wake lock:** acquire `navigator.wakeLock.request('screen')` when starting, release in `finally`.
5. **Recovery:** persist only serializable metadata (array of `BatchRecoveryItem` with `locale` + `status` + `message`). Never persist directory handle. On recovery re-open, ask user to reselect folder, queue unfinished/failed locales.
6. **Collision handling:** call `resolveCollision(filename, existingFilenames)` before writing. Never overwrite.

**AppShell integration (Agent E):**

- Show processing overlay when `batchItems.some(i => i.status === 'rendering' || i.status === 'writing')`.
- On "Resume interrupted export" → re-show folder picker → re-execute batch.
- Persist `batchItems` to localStorage on each status change (for recovery).

**Do NOT implement:**
- FFmpeg command construction (Agent D owns)
- Export settings UI (Agent F owns)

---

## Wave 2 — Agent F (Export + Completion UI)

**Exclusive files:** Export settings sheet, export completion panel. `src/components/ExportSettingsSheet.tsx`, `src/components/ExportCompletePanel.tsx`, export-specific CSS.

**UI changes (Agent F):**

1. **ExportSettingsSheet** — new section when `text.cues.length > 0`:
   - Locale checkboxes list:
     - Built-in initial locales (`BUILT_IN_LOCALES`) checked by default if imported.
     - Additional imported locales unchecked by default.
     - Each checkbox shows per-locale blocking details (missing keys).
   - "Start Export" button disabled when no locale checked.
   - When no text cues, hide section — keep existing single-video export.
   - When `showDirectoryPicker` unsupported, show explanation: "Batch export requires Chromium browser. Single locale only."

2. **ExportCompletePanel** — new columns for batch state:
   - Table rows: one per locale with `status`.
   - Columns: Locale, Status (badge), Message (if failed/blocked), Action (Download single locale if completed).
   - When all complete: "Download all as ZIP" (optional) or just individual downloads.
   - "Export more" button → clear batch state, return to settings.

**Context usage (Agent F consumes):**

- `text.catalogs`, `text.cues` — determine whether to show locale selector
- `batchItems`, `setBatchItems` — display progress
- `activePreset` — for filename

**Fallback for unsupported browsers:**
- Retain one-locale Blob download (existing behavior). No ZIP fallback.

**Do NOT implement:**
- Batch execution logic (Agent E owns)
- FFmpeg rendering (Agent D owns)

---

## File Ownership

| Wave | Agent | Exclusive Files | Shared Contract |
|------|-------|------------------|-----------------|
| **Wave 0** | Lead (me) | `src/text/*.ts`, `src/utils/intervalUtils.ts`, `src/utils/timecode.ts`, `public/fonts/*`, `src/index.css` (fonts) | All types/constants/pure modules |
| **Wave 1** | A | `src/context/ProjectContext.tsx` (text state + import), `src/text/importUtils.ts` (new), `src/context/*.test.ts` | Context API, persistence |
| **Wave 1** | B | `src/components/Timeline.tsx`, `src/components/AudioSegment.tsx`, `src/components/ClipInspector.tsx`, `src/components/EditorWorkspace.tsx`, `src/components/IntervalClip.tsx` (new) | Generic interval interactions |
| **Wave 1** | C | `src/components/AssetPanel.tsx`, `src/components/TextAssetPanel.tsx` (new), `src/components/VideoPreview.tsx`, `src/components/PreviewLocaleSelector.tsx` (new) | DOM preview overlays |
| **Wave 2** | D | `src/utils/ffmpegEngine.ts`, `src/utils/video-filter.ts` (new), `FFmpeg tests` | FFmpeg renderVideo |
| **Wave 2** | E | `src/text/batchUtils.ts` (new), `src/AppShell.tsx` (overlay + recovery), batch tests | Batch orchestration |
| **Wave 2** | F | `src/components/ExportSettingsSheet.tsx`, `src/components/ExportCompletePanel.tsx`, export CSS | Export UI |

**Rule:** Each agent edits ONLY its exclusive files. Integration points (context API, types) are frozen at Wave 0 and Wave 1 gate. Lead resolves conflicts at integration gates.
