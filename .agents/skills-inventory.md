# AppVid Skills Inventory

Use this repository catalog with the global skills inventory when running the Vibe Model.

## Product and codebase

- **AppVid UI:** Vite, React 19, and strict TypeScript. Application UI is in `src/components/`; project state is in `src/context/ProjectContext.tsx`.
- **Repository rules:** Read `AGENTS.md` and `docs/guidelines-typescript.md` before implementation. Existing repository instructions and validators take precedence.

## Workflow routing

| Surface | Skill or rule | Phase |
| --- | --- | --- |
| User-visible behaviour or visual change | `vibe-model` | All |
| Visual direction, hierarchy, spacing, responsive polish | `impeccable` | Intent and design; review |
| Avoid generic AI-default UI cues | `unslop-ui` | Intent and design; review |
| TypeScript state or domain logic | `typescript-defensive-programming` | Build when applicable |
| Isolated logic changes | `tdd` | Build when applicable |
| UI and interaction testing strategy | `testing-strategy` | Verify when applicable |

## Required verification

Run the repository gates appropriate to the change on Node 18 or newer:

```sh
bash scripts/lintall.sh
bash scripts/testall.sh
bash scripts/sanity_checks.sh
```

For user-visible UI changes, also inspect the rendered landing and editor states at desktop and narrow widths, then run the `unslop-ui` scanner against changed UI sources.
