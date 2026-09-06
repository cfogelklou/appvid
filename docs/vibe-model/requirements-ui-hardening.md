# AppVid accessibility and resilience hardening

## Scope

Address the Impeccable audit's verified interaction, motion, and theme-consistency findings without changing AppVid's import, editor, or export behaviour.

## Acceptance criteria

- [x] **UH-01:** A keyboard user can open the empty video-preview file chooser with a native, named button.
- [x] **UH-02:** Export settings and reusable bottom sheets expose dialog semantics, focus their close control when opened, close on Escape, keep Tab focus within the dialog, and restore focus to the opener when closed.
- [x] **UH-03:** People who prefer reduced motion receive no non-essential animation or transition.
- [x] **UH-04:** The timeline playhead uses non-overshooting motion; shared primary and playhead colours use semantic theme tokens where touched.
- [x] **UH-05:** Focused tests cover dialog semantics, Escape dismissal, focus trapping, and focus return. Repository gates and the Impeccable detector pass.

## BDD scenarios

```gherkin
Scenario: Importing a video without a pointer
  Given the preview is empty
  When a keyboard user tabs to "Choose video file" and activates it
  Then the video file chooser opens

Scenario: Closing export settings returns the user to their work
  Given the user opens Export Video Settings
  When they press Escape
  Then the settings dialog closes
  And focus returns to the control that opened it
```

## Verification

- `tests/unit/BottomSheet.test.tsx` verifies dialog semantics, initial focus, Tab/Shift+Tab trapping, Escape dismissal, and focus return.
- `bash scripts/lintall.sh` — passed
- `bash scripts/testall.sh` — passed (15 files, 145 tests)
- `bash scripts/sanity_checks.sh` — passed, including the production build
- Unslop scanner — 0 findings
- Impeccable detector — 0 findings
