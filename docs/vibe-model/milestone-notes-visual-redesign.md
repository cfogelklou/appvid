# Visual redesign milestone notes

## M1 — Import desk

### Requirements

- [x] **VD-01:** The empty state leads with importing a screen recording, not an abstract product hero.
- [x] **VD-02:** Local-only processing and store-ready output appear as compact operational facts.
- [x] **VD-03:** Existing file selection, draft restoration, and getting-started content retain their behaviour.
- [x] **VD-04:** The screen adapts from a three-region desk to a single-column mobile order without horizontal overflow.
- [x] **VD-05:** Tablet widths use a compact workflow strip and a two-region import/reference desk; the three-region layout begins only when its content has room.
- [x] **VD-06:** On narrow editor screens, the preview, production tools, and timeline remain reachable as a deliberate vertical sequence without horizontal clipping.

### Design approval

The user approved a technical-editorial direction: graphite workspace, compact operational panels, electric-blue interaction states, and preview/timeline dominance.

### Verification plan

- Render the empty/import state at desktop and narrow widths.
- Render the import desk at 320px, 768px, and desktop widths; verify no horizontal overflow.
- Render a loaded editor at narrow and short viewport heights once a local video fixture is available.

### Verification evidence

- Playwright captures at 320×568, 390×844, 768×1024, and 1440×1000 show no document-level horizontal overflow.
- A temporary 390×844 recording was imported through the visible file flow. At 390×844, the editor keeps its preview, 54px tool tabs, and timeline in the app-content scroll sequence; the timeline retains its own horizontal scroll viewport (356px visible / 1600px content).
- Run existing lint, test, build, Unslop, and Impeccable detector checks.
