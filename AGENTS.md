# Repository Guidelines

## CRITICAL: Take Ownership of Build/Lint/Test Failures

**Never dismiss a local failure as "pre-existing" or "not my fault."** CI builds this app on every push, so if `bun run build` or `bun run lint` fails locally, it is almost always your environment — fix it, don't rationalize it.

The most common trap: **wrong Node version**. Vite 6 and oxlint 1.x require **Node 18+** (see `engines.node` in `package.json`). On Node 16 they fail with misleading errors that look unrelated to your change:

- `bun run build` → `TypeError: crypto.getRandomValues is not a function` (Vite config resolution)
- `bun run lint` → `ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension "" for .../oxlint/bin/oxlint` (ESM shim)

**Before claiming any failure is environmental, do this:**

1. Check `node --version`. If below 18, switch: `nvm use 24` (or any installed version ≥ 18).
2. Re-run the failing command on the corrected Node.
3. Only if it still fails on the correct Node, then investigate further.

`bun run build` and `bun run lint` are expected to pass on Node 18+. They run in CI. A local failure on the wrong Node version is a local problem, not a code defect, and not a reason to skip verification of your own changes. Verify your edits end-to-end on a supported Node before handing off.

## Project Structure & Module Organization

AppVid is a Vite + React 19 + TypeScript browser application for creating app-store preview videos locally. Application code is in `src/`: reusable UI lives in `src/components/`, project state in `src/context/ProjectContext.tsx`, domain types in `src/types.ts`, constants in `src/constants.ts`, and media/timeline helpers in `src/utils/`. Keep component-specific CSS next to its component; global styles belong in `src/index.css` or `src/App.css`. Static runtime assets, including FFmpeg WASM files, live in `public/`.

Unit tests are in `tests/unit/`; the manual browser workflow is in `tests/e2e/test_appvid.ts`. Design notes are kept at the repository root.

## Build, Test, and Development Commands

Use Bun for dependency management and scripts:

```sh
bun install           # install dependencies
bun run dev           # start Vite at the development URL
bun run build         # type-check and build production assets
bun run preview       # serve the production build locally
bun run test          # run Vitest in watch mode
bun run lint          # run oxlint
bun run format:check  # verify Prettier formatting
bun run format        # format src TypeScript/TSX files
```

The Playwright script is an environment-specific end-to-end smoke test: start `bun run preview` first, update its local media fixture paths if needed, then run it with Bun.

## Coding Style & Naming Conventions

Write strict TypeScript and React function components. Follow the existing two-space indentation, semicolons, single quotes, and trailing commas. Use PascalCase for components and component files (`VideoPreview.tsx`), camelCase for functions and variables (`getEditedVideoDuration`), and descriptive CSS class names. Prefer type-only imports where applicable. Run Prettier and oxlint before handing off changes.

## Testing Guidelines

Use Vitest with Testing Library and the jsdom environment. Put focused tests in `tests/unit/` using `*.test.ts` or `*.test.tsx` names; describe observable behavior, particularly timeline calculations, project-state changes, and export settings. Add or update tests whenever changing user-visible logic. No coverage threshold is configured, so prioritize meaningful assertions over superficial line coverage.

## Commit & Pull Request Guidelines

Recent history uses concise, imperative messages with conventional prefixes such as `feat:`, `fix:`, and `refactor:`; follow that pattern (for example, `fix: clamp timeline playhead`). Keep commits scoped. Pull requests should explain the user impact, list validation commands run, link the relevant issue when available, and include screenshots or recordings for visual/editor changes. Call out changes affecting FFmpeg assets, PWA behavior, or store-export presets.
