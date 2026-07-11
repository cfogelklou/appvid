# AppVid

AppStore and PlayStore video preview creator. High fidelity, offline, and local-first video styling.

AppVid operates completely client-side in the browser. Absolute data privacy is a core requirement: *"No uploads. No accounts. Your files never leave your browser."*

---

## ⚠️ Important: System Requirements & RAM Constraints

Because AppVid runs **FFmpeg WebAssembly (WASM)** locally inside your web browser without a server backend, video transcoding is extremely CPU and memory-intensive:

* **High Memory Usage:** Transcoding large video files (especially portrait recordings > 30s) requires significant RAM. The browser's WASM runtime must load video frames, filter graphs, and audio streams in-memory.
* **Device Limits:** On mobile devices (like iPhones or Android phones) or machines with low RAM (< 16 GB), large exports may hit the browser's tab memory limit and cause the tab to crash (reload).
* **Recommendations:**
  * Use a desktop/laptop browser (Chrome, Safari, Firefox) with plenty of free system RAM for exporting.
  * Keep screen recording files short (15s to 30s) and close other high-memory tabs before exporting.
  * Keep the browser tab active and focused while encoding is in progress.

---

## Features
- **Local-First Processing:** FFmpeg single-threaded WASM compiles filter graphs directly in-browser.
- **Store-Compliant Resolution Presets:** 6.9", 6.7", 6.5", and 5.5" portrait crop/pad ratios.
- **Audio Overlays:** Layer voiceover and background music tracks onto the timeline with millisecond precision and interactive snapping.
- **Store Readiness validation:** Inline warning panel checking duration and resolution compliance parameters.

## Technology Stack
- React 19 + TypeScript (under strict `verbatimModuleSyntax`)
- Vite
- Bun
- `@ffmpeg/ffmpeg` (WASM)
- Vitest

## Getting Started

### Install Dependencies
```bash
bun install
```

### Run Local Development Server
```bash
bun run dev
```

### Run Vitest Sanity Tests
```bash
bun run test
```

### Compile Production Build
```bash
bun run build
```
