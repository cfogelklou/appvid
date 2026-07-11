# Video Trimming, Splitting, and Speed Adjustment Implementation Plan (Revised with Audio Splits & Reorganized Tests)

This document outlines the design to introduce video clip splitting, deletion (trimming), speed changes (up to 20x), placed audio clip splitting, and test folder reorganization in AppVid.

---

## 1. Goal Description

Currently, AppVid treats the imported video as a single, immutable file playing sequentially from start to finish. To support video editing features similar to iMovie, we will virtualize the video timeline by decomposing the video into a sequence of **Video Segments**.

Each video segment represents a portion of the source video file with its own start offset, duration, and playback rate. 

We need to implement:
1. **Split Clip:** Split the selected video segment at the playhead position.
2. **Audio Clip Splitting:** If the playhead overlaps any placed audio segments during a "split clip" operation, split those audio segments at the same timeline time (maintaining exact start offsets and durations).
3. **Delete Clip:** Remove the selected video segment and automatically close the gap (magnetic timeline).
4. **Speed Changes (up to 20x):** Set the playback speed of a clip up to `20x` (e.g., `0.5x`, `1.0x`, `1.5x`, `2.0x`, `4.0x`, `8.0x`, `20.0x`), updating its duration and shifting subsequent clips.
5. **Smooth Preview:** Update `PreviewPlayer` to handle playback, seeking, and speed composed rate changes across virtual boundaries.
6. **FFmpeg Export:** Build a single-pass filter chain to compile virtual video segments and speed up original audio using chained `atempo` filters.
7. **Test Reorganization:** Move test files into a dedicated `tests/` directory at the project root.

---

## 2. User Review Required

> [!IMPORTANT]
> **Audio Speed Chaining:**
> FFmpeg's native `atempo` filter only supports speed ratios between `0.5` and `2.0`. To support audio speed changes up to `20x` (when "Keep Original Audio" is active), we will dynamically chain multiple `atempo` filters (e.g. for `20x` speedup, we will generate the filter chain: `atempo=2.0,atempo=2.0,atempo=2.0,atempo=2.5`).
>
> **Placed Audio Splitting:**
> When splitting a video segment, we will also split any overlapping placed audio segment `A` at the same timeline position:
> - `A1` will play from `A.clipStart` with duration `splitTime - A.startTime`.
> - `A2` will play from `A.clipStart + (splitTime - A.startTime)` with the remainder of the duration.

---

## 3. Proposed Changes

### Core Types & Context

#### [MODIFY] [types.ts](file:///Volumes/Projects/dev/applicaudia_web/appvid/src/types.ts)
* Define the `VideoSegment` interface:
  ```typescript
  export interface VideoSegment {
    id: string;
    clipStart: number;      // Start offset within the raw source video file (seconds)
    duration: number;       // Visual duration on the timeline (seconds)
    startTime: number;      // Start position on the timeline (seconds)
    playbackRate: number;   // Speed multiplier (up to 20.0)
  }
  ```
* Update `AudioSegment` to support start offsets and customized durations:
  ```typescript
  export interface AudioSegment {
    id: string;
    assetId: string;
    startTime: number;
    volume: number;
    clipStart?: number;     // Offset within the source audio asset (seconds, defaults to 0)
    duration?: number;      // Played duration (seconds, defaults to asset.duration)
  }
  ```
* Update the `Project` interface to include `videoSegments: VideoSegment[]`.

---

#### [MODIFY] [ProjectContext.tsx](file:///Volumes/Projects/dev/applicaudia_web/appvid/src/context/ProjectContext.tsx)
* Add a new state variable `selectedVideoSegmentId: string | null` (and its setter `setSelectedVideoSegmentId`) to prevent collision with `selectedSegmentId`.
* Implement the derived duration helper `getEditedVideoDuration(project)` to calculate the sum of the visual durations of all video segments.
* Update context state initialization:
  * When a video is imported, create a default `VideoSegment` spanning the entire duration at `1.0x` speed.
  * In `restoreDraft`, if loaded draft projects lack `videoSegments`, initialize them dynamically using the video duration to maintain backward compatibility.
* Implement segment modification actions:
  * **`splitVideoSegment(segmentId: string, splitTime: number)`**:
    Split the video segment `S` at `splitTime` into `S1` and `S2`.
    * *Validation:* Reject split if `splitTime - S.startTime < 0.1` or `S.startTime + S.duration - splitTime < 0.1`.
    * Update video segments:
      * `S1.duration = splitTime - S.startTime`
      * `S2.clipStart = S.clipStart + (splitTime - S.startTime) * S.playbackRate`
      * `S2.startTime = splitTime`
      * `S2.duration = S.duration - S1.duration`
    * Update placed audio segments:
      * Find any audio segment `A` that overlaps `splitTime` (i.e. `splitTime > A.startTime && splitTime < A.startTime + (A.duration || asset.duration)`).
      * Split `A` into `A1` and `A2`:
        * `A1.startTime = A.startTime`
        * `A1.clipStart = A.clipStart || 0`
        * `A1.duration = splitTime - A.startTime`
        * `A2.startTime = splitTime`
        * `A2.clipStart = (A.clipStart || 0) + (splitTime - A.startTime)`
        * `A2.duration = (A.duration || asset.duration) - A1.duration`
  * **`deleteVideoSegment(segmentId: string)`**:
    Remove the segment and re-compute all subsequent segment start times cumulatively (`S_next.startTime = S_prev.startTime + S_prev.duration`).
  * **`updateVideoSegmentSpeed(segmentId: string, speed: number)`**:
    Change the segment's speed, calculate its new duration (`newDuration = (S.duration * S.playbackRate) / speed`), set `S.playbackRate = speed`, and update subsequent segment start times.

---

### Timeline UI & Context Menus

#### [MODIFY] [Timeline.tsx](file:///Volumes/Projects/dev/applicaudia_web/appvid/src/components/Timeline.tsx)
* Instead of rendering a single video block, map over `project.videoSegments` to render each segment on the `.video-track-lane`.
* Add custom style triggers for selected segment highlighting using `selectedVideoSegmentId`.
* Handle click selections and implement a custom hover/popup Context Menu for right-click (`onContextMenu`) events. The context menu will offer:
  * **Split Clip** (disabled if the playhead is not within the selected clip bounds, or too close to borders).
  * **Delete Clip** (disabled if it is the only segment left).
  * **Speed** sub-menu (`0.5x`, `1.0x`, `1.5x`, `2.0x`, `4.0x`, `8.0x`, `20.0x`).

---

### Playback Engine

#### [MODIFY] [previewPlayer.ts](file:///Volumes/Projects/dev/applicaudia_web/appvid/src/utils/previewPlayer.ts)
* Pass `project` to `previewPlayer` so it can access `project.videoSegments`.
* Implement time mapping functions:
  * **`timelineTimeToSourceTime(t)`**:
    Find segment `S` where `t >= S.startTime && t < S.startTime + S.duration`.
    * `sourceTime = S.clipStart + (t - S.startTime) * S.playbackRate`.
  * **`sourceTimeToTimelineTime(srcTime)`**:
    Find segment `S` where `srcTime >= S.clipStart && srcTime < S.clipStart + S.duration * S.playbackRate`.
    * `t = S.startTime + (srcTime - S.clipStart) / S.playbackRate`.
* In `seek(time)`, map the virtual timeline `time` to `sourceTime` using `timelineTimeToSourceTime(time)`, and seek the raw HTML video element: `video.currentTime = sourceTime`.
* Drive the playhead smoothly:
  * In the `timeupdate` handler, check the raw `video.currentTime`. 
  * Map it back to the virtual timeline position using `sourceTimeToTimelineTime(video.currentTime)`.
  * Check if the video playhead has crossed the active segment boundary:
    * If `video.currentTime` exceeds the active segment's source end (`S.clipStart + S.duration * S.playbackRate`):
      * If a next segment `S_next` exists, seek the video element directly to `S_next.clipStart`, set `video.playbackRate = S_next.playbackRate * globalPlaybackSpeed`, and sync audio.
      * If no next segment exists, pause the player.
  * Trigger React updates using the mapped virtual timeline time.
* Placed Audio Synchronization:
  * In `syncAudio()`, use the virtual timeline time `vTime` (derived from the playhead) to active-check placed audio segments.
  * Playback range check: active if `vTime >= seg.startTime && vTime < seg.startTime + (seg.duration || asset.duration)`.
  * Set current play position: `targetAudioTime = (vTime - seg.startTime) + (seg.clipStart || 0)`.
  * Set placed audio element speed to match `globalPlaybackSpeed` (not the video segment speed) so placed audio is never time-scaled but responds properly to the global transport rate.

---

### FFmpeg Export Compilation

#### [MODIFY] [ffmpegEngine.ts](file:///Volumes/Projects/dev/applicaudia_web/appvid/src/utils/ffmpegEngine.ts)
* Update video processing parameters:
  * Replace `-t project.video.duration` with the virtual edited duration: `getEditedVideoDuration(project)`.
* For video compilation, build a sub-graph that processes raw video segments, speeds them up/slows them down, and concatenates them to an intermediate stream `[trimmed_v]`:
  ```ffmpeg
  [0:v]trim=start=S0_clipStart:end=S0_clipEnd,setpts=(PTS-STARTPTS)/S0_rate[v0];
  [0:v]trim=start=S1_clipStart:end=S1_clipEnd,setpts=(PTS-STARTPTS)/S1_rate[v1];
  [v0][v1]concat=n=2:v=1:a=0[trimmed_v]
  ```
  Apply the fit/fill scaling/cropping filter chain to `[trimmed_v]` instead of `[0:v]` to yield `[out_v]`.
* If "Keep Original Audio" is active, apply matching audio trimming, scaling, and concatenation filters. For speed multipliers `rate > 2.0`, build an `atempo` chain:
  * E.g. `atempo=2.0,atempo=2.5` for `5.0x` speed.
  * E.g. `atempo=2.0,atempo=2.0,atempo=2.0,atempo=2.5` for `20.0x` speed.
  ```ffmpeg
  [0:a]atrim=start=S0_clipStart:end=S0_clipEnd,asetpts=PTS-STARTPTS,atempo=2.0,atempo=2.5[a0];
  [0:a]atrim=start=S1_clipStart:end=S1_clipEnd,asetpts=PTS-STARTPTS,atempo=1.0[a1];
  [a0][a1]concat=n=2:v=0:a=1[trimmed_a]
  ```
  Mix `[trimmed_a]` as `[aud_orig]` with the other placed audio tracks into `[out_a]`.
* For placed audio clips, apply the `atrim` and `asetpts` filters using `clipStart` and `duration` values to match virtual splits:
  ```ffmpeg
  [input_idx:a]atrim=start=A_clipStart:end=A_clipEnd,asetpts=PTS-STARTPTS,volume=volume=seg.volume,adelay=delays=delayMs:all=1
  ```

---

## 4. Reorganize Tests

#### [NEW] [tests/unit/App.test.tsx](file:///Volumes/Projects/dev/applicaudia_web/appvid/tests/unit/App.test.tsx)
* Move and rename unit tests from [src/App.test.tsx](file:///Volumes/Projects/dev/applicaudia_web/appvid/src/App.test.tsx).
* Adjust import paths from `./App` to `../../src/App`.

#### [DELETE] [src/App.test.tsx](file:///Volumes/Projects/dev/applicaudia_web/appvid/src/App.test.tsx)
* Remove the legacy unit test file from the source directory.

#### [NEW] [tests/e2e/test_appvid.ts](file:///Volumes/Projects/dev/applicaudia_web/appvid/tests/e2e/test_appvid.ts)
* Move and rename the Playwright workspace E2E testing file from the root directory [test_appvid.ts](file:///Volumes/Projects/dev/applicaudia_web/appvid/test_appvid.ts).

#### [DELETE] [test_appvid.ts](file:///Volumes/Projects/dev/applicaudia_web/appvid/test_appvid.ts)
* Remove the legacy E2E test file from the project root.

---

## 5. Verification Plan

### Automated Tests
* Run unit tests:
  ```bash
  bun run test run
  ```
* Run Playwright E2E tests:
  ```bash
  bun tests/e2e/test_appvid.ts
  ```

### Manual Verification
* Load a video file.
* Select the clip, seek the playhead, and split the clip.
* Verify that overlapping placed audio clips are also split at the same timecode.
* Delete a clip and verify that the timeline shifts magnetically.
* Speed up a segment to `20.0x` and verify playback and FFmpeg export compile correctly.
