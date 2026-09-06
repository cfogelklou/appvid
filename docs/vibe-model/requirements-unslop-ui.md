# AppVid visual refinement requirements

## Intent

Preserve AppVid's dark, import-first video-editor workflow while removing visual cues that make it look like a generic AI/SaaS landing page.

## Approved design decision

- **Primary interaction colour:** AppVid electric blue (`#007ee6`), chosen for clear video-editor controls and to distinguish video interactions from audio and success states.
- **Landing expression:** solid, high-contrast title typography; no decorative purple/blue gradients or ambient neon glow.

## Acceptance criteria

- [x] **VR-01:** Primary video controls, slider progress, selected states, and video-preview affordances use the approved blue palette; the former indigo/purple palette is absent from source UI code.
- [x] **VR-02:** The landing title is rendered in a solid colour, and the landing badge has a solid low-emphasis surface rather than a multi-colour gradient.
- [x] **VR-03:** The landing screen has no decorative coloured ambient glow.
- [x] **VR-04:** The existing import-first workflow, local-processing privacy message, and all controls remain unchanged in behaviour.
- [x] **VR-05:** `unslop-ui` reports no high-severity findings in `src`, and repository lint, tests, and build pass on Node 18+.

## BDD scenarios

```gherkin
Scenario: First-time visitor sees a deliberate editor identity
  Given no video has been imported
  When the landing screen opens
  Then AppVid appears with solid typography and restrained electric-blue interaction cues
  And the visitor can choose a screen recording exactly as before

Scenario: Editor control states remain understandable
  Given a video is loaded
  When the visitor plays, seeks, or toggles a video control
  Then the active state is indicated with the AppVid electric-blue palette
  And the control behaviour is unchanged
```

## Verification

- `bash scripts/lintall.sh` — passed
- `bash scripts/testall.sh` — passed (14 files, 144 tests)
- `bash scripts/sanity_checks.sh` — passed, including the production build
- `python3 .../devibe_scan.py src --severity high` — 0 findings, vibe score 0
- `node .../detect.mjs --json <changed UI files>` — no findings
