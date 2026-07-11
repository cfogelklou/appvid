# AppVid UX Plan

AppVid is a static, client-side PWA hosted at `/appvid/`. It helps users create app preview videos for the iOS App Store and Google Play by combining portrait-mode screen recordings with audio files placed at specific timestamps. All media processing happens locally in the browser with React, TypeScript, and FFmpeg WASM. No backend is part of the product.

## Product Direction

AppVid should feel like a focused pro-sumer app preview editor, not a full nonlinear video editor. The core promise is: import a portrait app recording, choose a store-ready output preset, place audio clips precisely, preview timing, and export an exact-resolution video locally.

Primary product decisions:

- Original video audio is chosen during export, defaulting to `Keep original audio`.
- Main use case is app preview videos for iOS App Store and Google Play.
- Export should prioritize quality and exact store-required resolutions over speed.
- Audio clips are placement-only in MVP; no trimming or waveform editing.
- Draft persistence stores metadata only, not video or audio blobs.
- Store compliance issues warn but do not block export.
- Hard blocks are reserved for technical impossibilities such as missing media, unreadable files, or failed FFmpeg initialization.

## User Workflow

### 1. App Entry

The landing screen should be compact, confident, and mobile-friendly.

Required elements:

- App title: `AppVid`.
- Tagline: `Create app preview videos locally.`
- Primary CTA: `Import Screen Recording`.
- Secondary CTA: `Restore Draft` when local metadata exists.
- Trust note: `No upload. No account. Your files stay in this browser.`

First-run guidance should set expectations:

- Best with portrait MP4 or MOV screen recordings.
- Designed for App Store and Google Play preview exports.
- Large high-quality exports can take several minutes.
- Keep the tab open during export.

### 2. Video Import

The user imports a portrait-mode screen recording.

Flow:

1. User taps `Import Screen Recording`.
2. Native file picker accepts `video/*`.
3. App reads metadata with a hidden `HTMLVideoElement`.
4. App shows an import summary card with filename, duration, resolution, aspect ratio, and file size.
5. App warns if the video is landscape, square, unusually large, or outside likely store-preview duration expectations.
6. User can continue despite warnings.

The import step should not feel punitive. Warnings should explain risk and provide next steps, not block progress.

### 3. Store Preset Selection

After video import, the user selects a target store preset. This can appear as part of the import confirmation or as a prominent editor setting.

Recommended presets:

- iOS App Preview, 6.9 inch portrait: `1320 x 2868`.
- iOS App Preview, 6.7 inch portrait: `1290 x 2796`.
- iOS App Preview, 6.5 inch portrait: `1242 x 2688`.
- iOS App Preview, 5.5 inch portrait: `1080 x 1920`.
- Google Play portrait: `1080 x 1920`.
- Custom portrait: user-defined width and height.

The app should show a `Store Readiness` panel with warning-only checks for:

- Duration.
- Resolution.
- Aspect ratio.
- File size risk.
- Codec or browser decode risk when detectable.

Compliance issues should never block export. Recommended warning copy:

`This export may not meet App Store / Google Play preview requirements, but you can still export it.`

### 4. Editor Workspace

After import and preset selection, the app opens the editor.

Mobile layout:

- Sticky top bar with project name, selected preset, draft state, and export button.
- Portrait video preview.
- Playback controls.
- Timeline editor.
- Bottom-sheet actions for audio assets, clip inspector, and export settings.

Desktop/tablet layout:

- Main area with video preview and playback controls.
- Side panel for assets, store readiness, and selected clip settings.
- Timeline spanning the bottom.

The editor should preserve the sibling app visual language: dark zinc/slate surface, electric-blue primary actions, rounded cards, subtle borders, clear touch targets, and high-contrast timecodes.

### 5. Audio Import

The user can import multiple audio files.

Flow:

1. User taps `Add Audio`.
2. File picker accepts `audio/*` with multiple selection.
3. App reads metadata where possible.
4. Audio files appear in an asset panel.
5. User can add an audio asset at the current playhead.

Asset card information:

- Filename.
- Duration.
- File size.
- Number of placed instances.
- Metadata warning if duration cannot be read.

MVP should support placing the full audio file only. No trimming, split editing, or waveform editing is required.

### 6. Timeline Mapping

The timeline is the main interaction surface for mapping audio files to timestamps.

Required interactions:

- Tap timeline to move playhead.
- Scrub playhead.
- Add selected audio at playhead.
- Drag placed audio segment left or right.
- Select segment to open inspector.
- Nudge selected segment by `-1s`, `-0.1s`, `+0.1s`, and `+1s`.
- Enter exact start timestamp manually.
- Delete selected segment.

Mobile interaction requirements:

- Segment touch targets should be at least 44px tall.
- Drag handles must be forgiving.
- Show a timestamp bubble during drag.
- Use snap behavior for common alignment points.
- Keep precision controls in a bottom-sheet inspector.

Desktop interaction requirements:

- Support drag-to-place from asset panel as an enhancement.
- Show more timeline ticks and labels.
- Keep clip inspector visible in a side panel when space allows.

### 7. Preview

Preview should be available before export without running FFmpeg.

MVP preview strategy:

- Use native `<video>` playback for the source video.
- Use `HTMLAudioElement` or Web Audio API scheduling for placed audio clips.
- On play, schedule audio clips that intersect the current playhead.
- On seek, pause, or playhead jump, stop active audio and reschedule.
- Keep preview simple and responsive.

Playback controls:

- Play/pause.
- Jump to start.
- Current time and total duration.
- Scrubber.
- Original video audio toggle for preview.
- Selected store preset display.

If browser audio playback is blocked until a user gesture, show:

`Tap Play to enable audio preview.`

### 8. Export Setup

The export sheet should be explicit about exact output dimensions and audio behavior.

Settings:

- Store preset.
- Output resolution.
- Fit mode: `Fit with padding` or `Fill and crop`.
- Original audio: `Keep original audio` by default, or `Mute original audio`.
- Added audio volume, globally or per clip.
- Quality mode: high quality by default.

Primary CTA should include the target dimensions:

`Export 1320 x 2868 MP4`

If there are store-readiness warnings, the CTA pattern should be:

- Primary: `Export Anyway`.
- Secondary: `Review Settings`.

### 9. Processing

Processing must make it obvious that the browser is still working.

Stages:

1. Loading local video engine.
2. Preparing media files.
3. Applying store preset.
4. Scaling to exact resolution.
5. Aligning audio.
6. Mixing tracks.
7. Encoding high-quality MP4.
8. Preparing download.

Processing UI:

- Full-screen overlay.
- Large progress indicator.
- Current stage label.
- Elapsed time.
- Warning: `Keep this tab open.`
- Collapsible FFmpeg log details.
- Cancel action where safe.

The overlay should include local-processing reassurance:

`Your files are being processed locally in this browser.`

### 10. Export Complete

Completion screen:

- Preview exported video from a blob URL.
- Primary CTA: `Download Video`.
- Secondary CTA: `Edit More`.
- Optional share action through Web Share API when available.
- File size summary.
- Output resolution summary.

Completion copy:

`Export created locally. No files were uploaded.`

## Key UI Components

### Application Shell

`AppShell`

- Owns global layout and high-level app states.
- Handles startup, draft restore, editor, processing, and completion states.
- Displays PWA update notices.

`TopBar`

- App title.
- Project name or draft name.
- Selected store preset.
- Save/relink status.
- Export CTA.

`BottomSheet`

- Reusable mobile container for audio assets, clip inspector, export settings, and errors.

### Import Components

`VideoImportCard`

- File picker and desktop drag/drop.
- Explains accepted source files and privacy model.

`VideoMetadataPanel`

- Shows filename, duration, dimensions, aspect ratio, and size.
- Shows portrait and store-readiness warnings.

`StorePresetSelector`

- Lists iOS and Google Play presets.
- Shows exact target dimensions.
- Allows custom portrait dimensions.

`StoreReadinessPanel`

- Warning-only validation for duration, resolution, aspect ratio, and risk.
- Never blocks export by itself.

### Editor Components

`EditorWorkspace`

- Composes preview, controls, timeline, assets, and inspector.

`VideoPreview`

- Maintains portrait frame.
- Shows selected preset crop or padding overlay.
- Displays loading, decode, or relink-required states.

`PlaybackControls`

- Play/pause.
- Scrubber.
- Timecode.
- Jump to start.
- Preview original-audio toggle.

`AssetPanel`

- Lists imported audio assets.
- Allows adding an asset at playhead.
- Shows duration, size, warnings, and placed count.

`ClipInspector`

- Shows selected audio placement.
- Controls start timestamp, volume, nudge actions, move-to-playhead, and delete.
- Does not expose trim controls in MVP.

### Timeline Components

`Timeline`

- Main horizontal editing surface.
- Owns zoom, scroll, playhead, selected segment, and drag state.

`TimelineRuler`

- Renders adaptive time ticks.
- Uses seconds for short videos and `mm:ss` for longer recordings.

`TimelineTrack`

- Renders placed audio segments.
- MVP can use one audio lane with collision-aware stacking.

`AudioSegment`

- Visual block for a placed audio file.
- Shows filename, start time, and duration.
- Shows selected and warning states.

`Playhead`

- Vertical line with draggable hit area.
- Shows timestamp bubble during scrub or drag.

`TimelineZoomControls`

- Fit timeline to screen.
- Zoom in/out.
- Optional pinch-to-zoom later.

### Export Components

`ExportSettingsSheet`

- Shows preset, dimensions, fit mode, original audio choice, quality, and warnings.

`ProcessingOverlay`

- Shows stage, progress, elapsed time, logs, and cancel/retry state.

`ProcessingLog`

- Collapsible FFmpeg logs for transparency and debugging.

`ExportCompletePanel`

- Shows final preview, download, share, file size, and output dimensions.

## Interactive Timeline Strategy

### Data Model

Use seconds as the canonical unit. Persist time values, not pixel positions.

```ts
type Project = {
  id: string;
  name: string;
  video: VideoAssetMetadata | null;
  audioAssets: AudioAssetMetadata[];
  segments: AudioSegment[];
  settings: ExportSettings;
  updatedAt: number;
};

type AudioSegment = {
  id: string;
  assetId: string;
  startTime: number;
  volume: number;
};

type ExportSettings = {
  presetId: string;
  width: number;
  height: number;
  fitMode: 'fit' | 'fill';
  originalAudioMode: 'keep' | 'mute';
  quality: 'high';
};
```

### Coordinate Conversion

Timeline math should be isolated and testable.

```ts
const timeToX = (time: number, pxPerSecond: number) => time * pxPerSecond;
const xToTime = (x: number, pxPerSecond: number) => x / pxPerSecond;
```

Inputs:

- Timeline container bounds.
- Horizontal scroll offset.
- Zoom level.
- Pointer position.

State should store seconds. UI should convert to pixels only for rendering.

### Dragging Audio Segments

Use pointer events for mouse, touch, and stylus support.

Drag flow:

1. `pointerdown` on an audio segment.
2. Capture pointer.
3. Store initial pointer position and segment start time.
4. On `pointermove`, convert pixel delta to time delta.
5. Apply snapping.
6. Clamp to a valid range.
7. Render transient preview position.
8. On `pointerup`, commit the new `startTime`.

Snapping targets:

- `0` seconds.
- Current playhead.
- Whole seconds.
- Other segment starts and ends.
- Video end.

Suggested snap threshold:

- Mobile: 8-12px.
- Desktop: 5-8px.

### Precision Editing

Dragging must be supported by precise controls.

Selected segment controls:

- Exact timestamp input using `mm:ss.s`.
- Nudge `-1s`.
- Nudge `-0.1s`.
- Nudge `+0.1s`.
- Nudge `+1s`.
- Move to playhead.
- Delete.

Keyboard support:

- Left/right arrow nudges by 0.1s.
- Shift + left/right arrow nudges by 1s.
- Delete or Backspace removes selected segment.

### Timeline Performance

The MVP should avoid expensive visualizations.

- Do not render waveforms initially.
- Render only visible tick labels.
- Move playhead with CSS transforms.
- During playback, avoid committing React state on every frame.
- Use `requestAnimationFrame` for visual playhead movement.
- Commit state only on user actions such as seek, drag end, or edit controls.

Waveform generation can be a later enhancement and should run in a Web Worker with low-resolution peak data.

## Technical UX Constraints

### Browser-Only Processing

All processing must happen in the browser. The app must not suggest server upload, backend processing, or cloud rendering.

The UX should repeat this promise in sensitive moments:

- Landing page.
- Import screen.
- Processing overlay.
- Export complete screen.

### FFmpeg WASM Initialization

FFmpeg WASM can be slow to fetch, compile, and initialize.

UX requirements:

- Lazy-load FFmpeg on first export.
- Optionally prewarm after video import when idle.
- Show stage: `Loading local video engine`.
- Cache PWA assets where feasible.
- If initialization fails, keep project state intact and offer retry.

Failure copy:

`The local video engine could not start. Refresh and try again, or use a smaller source video.`

### Memory Management

Browser memory limits are the main technical risk, especially on mobile.

UX requirements:

- Warn for large files before export.
- Recommend desktop browser for final high-quality exports when risk is high.
- Prefer exact store resolution and high quality, but clearly communicate longer processing time.
- Revoke object URLs when media is replaced.
- Do not store large `ArrayBuffer` values in React state.
- Load large bytes only when processing starts.
- Clean FFmpeg virtual filesystem after each export attempt.

Risk messaging examples:

- `High-quality app preview export may take several minutes.`
- `Large files can exceed mobile browser memory. If export fails, try a shorter source recording.`
- `Keep this tab open until export is complete.`

### Draft Persistence

Persist metadata only.

Persisted data:

- Project name.
- Video metadata.
- Audio metadata.
- Segment offsets.
- Selected store preset.
- Export settings.

Do not persist:

- Source video blob.
- Source audio blobs.
- Exported video blob.

Reload workflow:

1. App detects metadata draft.
2. User taps `Restore Draft`.
3. App shows relink-required state.
4. User reselects video and audio files.
5. App matches files by filename, size, and duration where possible.
6. Preview and export remain disabled until required media is relinked.

### Mobile PWA Constraints

UX should account for mobile browser behavior:

- Backgrounding the PWA may pause or kill export.
- iOS standalone mode needs safe-area padding.
- Touch targets should be at least 44px.
- Avoid hover-only controls.
- Use `100dvh` for full-height screens where appropriate.
- Keep export warnings explicit before long-running operations.

## Error Handling And Feedback

### Import Errors

Possible cases:

- Unsupported video file.
- Unreadable metadata.
- Non-portrait video.
- Audio metadata unavailable.
- File too large for reliable mobile processing.

UX behavior:

- Use inline warning cards.
- Avoid blocking unless the file cannot be read at all.
- Provide direct next actions: choose another file, continue anyway, or review settings.

### Store Readiness Warnings

Store readiness warnings should be visible but non-blocking.

Warning categories:

- Duration may not meet App Store or Google Play expectations.
- Resolution differs from selected preset.
- Source aspect ratio requires crop or padding.
- Source file is large and may export slowly.

CTA pattern:

- `Export Anyway`.
- `Review Settings`.

### Timeline Errors

Possible cases:

- Audio segment starts after video end.
- Audio extends past video duration.
- Audio file needs relinking.
- Audio asset metadata cannot be read.

UX behavior:

- Show a warning icon on affected segment.
- Explain issue in `ClipInspector`.
- Offer one-tap fixes where useful: move to playhead, move inside video, or delete.

If an audio segment extends past video end, export can still proceed. Only the portion within the video duration will be audible.

### Preview Errors

Possible cases:

- Browser blocks audio before user gesture.
- Video decode fails.
- Audio scheduling drifts.
- Media file needs relinking.

UX behavior:

- Keep timeline editable when possible.
- Disable preview/export only when required files are missing or unreadable.
- Show focused recovery actions.

### FFmpeg Processing Errors

Possible cases:

- WASM load failure.
- Out-of-memory failure.
- Unsupported source codec.
- Export command failure.
- Browser suspends the tab.

UX behavior:

- Keep project state intact.
- Transition processing overlay to an error state.
- Show a short plain-language summary.
- Put technical FFmpeg logs behind `Details`.
- Offer recovery actions: retry, review settings, choose smaller source video, or reload video engine.

### Stalled Processing Feedback

The processing UI must never appear frozen.

Required feedback:

- Animated progress indicator.
- Elapsed timer updated every second.
- Current stage label.
- Last log timestamp.
- Collapsible logs.
- Rotating reassurance messages when exact progress is unavailable.

Suggested stall messages:

- After 10 seconds without visible progress: `Still rendering. Large videos can pause between stages.`
- After 30 seconds: `High-quality encoding can take several minutes. Keep this tab open.`
- After 90 seconds: `Still working. If your device is low on memory, this export may fail.`
- After 180 seconds: make `Cancel Export` more prominent, but do not auto-cancel.

## FFmpeg UX Mapping

The UI should hide FFmpeg complexity by default while keeping logs available for debugging.

User-facing stages should map to technical operations:

- `Preparing media files`: write source files to FFmpeg filesystem.
- `Applying store preset`: compute scale, crop, or pad filter.
- `Aligning audio`: apply audio delays from segment start times.
- `Mixing tracks`: combine original audio and added audio according to export settings.
- `Encoding high-quality MP4`: render final output.
- `Preparing download`: read output file and create blob URL.

Do not show raw FFmpeg commands in the main UI. Raw commands and logs can appear in a collapsible debug/details area.

## Visual Design Direction

AppVid should reuse the successful patterns from sibling apps while feeling more like a compact media tool.

Design principles:

- Dark-only zinc/slate theme.
- Electric-blue primary actions.
- Green success states.
- Amber warning states.
- Red destructive or failed states.
- Rounded cards with subtle borders.
- High-contrast timecodes.
- Clear selected states for clips and controls.
- Minimal chrome around video preview.
- Bottom-sheet controls on mobile.

The visual tone should be more studio-console than playful editor: precise, compact, and trustworthy.

## PWA And Repository Setup

Recommended initial setup matching sibling apps:

- React 19.
- TypeScript.
- Vite.
- Bun.
- `vite-plugin-pwa`.
- Vitest and React Testing Library.
- ESLint and Prettier.

Recommended scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "test": "vitest",
  "preview": "vite preview",
  "format": "prettier --write \"src/**/*.{ts,tsx}\"",
  "format:check": "prettier --check \"src/**/*.{ts,tsx}\""
}
```

Vite requirements:

- `base: '/appvid/'`.
- PWA manifest with `start_url: '.'`.
- PWA `display: 'standalone'`.
- App icons under `/appvid/` paths.

CI strategy:

- Use Bun install.
- Run lint, typecheck, tests, and build.
- Deploy static `dist` output by SFTP to the `/appvid` webroot path.
- No Firebase, auth, backend, or server API.

## MVP Scope

MVP includes:

- Video import and metadata validation.
- Store preset selection.
- Store readiness warnings.
- Multi-audio import.
- Add audio at playhead.
- Drag and nudge audio segment offsets.
- Numeric timestamp editing.
- Native preview with scheduled audio.
- Export settings with original-audio choice defaulting to keep.
- Exact-resolution high-quality MP4 export via FFmpeg WASM.
- Processing overlay with progress, stages, elapsed time, and logs.
- Download exported video.
- Metadata-only draft persistence and relinking.
- PWA installability.

Post-MVP candidates:

- Waveform previews.
- Audio trimming.
- Fade in/out.
- Multiple audio lanes.
- More store presets.
- Preset-specific guidance copy.
- Share-sheet integration for exported files.
- Web Worker peak generation for waveforms.

Explicit non-goals:

- Backend processing.
- Cloud uploads.
- Accounts.
- Server-side storage.
- Full nonlinear video editing.
