# Agent guidance: canonical Service Builder

This repository is the preserved visual Service Builder shell and, on the `plug-new-dgp-system` branch, the active canonical DGP v1 presentation migration target. The user explicitly approved changing this repository while deferring the separate `dgp-studio` UI.

## Boundaries

- Preserve the existing layout, density, styling, panel proportions, and workflows. Do not redesign or retire behavior without explicit user approval.
- Author and emit canonical `ProductDefinition` data only. Do not add legacy aliases, compatibility modes, `flags`, `estimates`, or legacy persisted-definition support.
- Use `@elqora/dgp-workspace` for editorial runtime, CanvasAPI, Editor, Selection, Comments, branches, drafts, commits, autosave, collaboration, and publication orchestration.
- Use `@elqora/dgp-core` for interpretation and graph behavior, `@elqora/dgp-validation` for editorial/publication diagnostics, `@elqora/dgp-ordering` for customer state and snapshots, and `@elqora/dgp-ordering-form-palette` for the default React input integration.
- React providers, selectors, rendered canvas, panels, property editors, diagnostics, previews, and authorization presentation live here. Do not recreate lower-level behavior in React.
- Keep host persistence, transport, authentication, and authorization behind canonical Workspace ports.
- Treat the current `main` commit `0fba74f` as the visual and workflow baseline. Existing tests are behavioral evidence even when their legacy types must change.
- Preserve unrelated working-tree changes in sibling repositories. Do not edit `dgp-studio` during this migration.

## Migration discipline

- Maintain `MIGRATION.md`. Missing behavior is `pending migration`, never retired.
- Migrate in vertical slices and remove each legacy import only after its canonical behavior is covered.
- Run tests associated with the changed slice first. Expand only when shared behavior changes; run the full gate at final verification.
- The temporary boundary allowlist may only shrink. New legacy-engine imports are forbidden.
- Use Timeax registry components first, official shadcn second, and local primitives only when neither is suitable. Preserve the established design when adopting a sourced primitive.

## Toolchain

- Supported runtime: Node.js 22 or newer; npm 11.
- Install: `npm install`
- Development: `npm run dev`
- Unit/interaction tests: `npm test`
- Focused test: `npm test -- <test-file>`
- Lint: `npm run lint`
- Canonical migration lint: `npm run lint:canonical`
- Type check: `npm run typecheck`
- Library/application build: `npm run build`
- Generated `dist/`, `app-dist/`, coverage, and browser reports are not committed.

Completion requires zero legacy-engine imports, canonical public exports, all migration rows evidenced, targeted visual/interaction/accessibility/performance coverage, production builds, and a clean intentional diff. Do not publish a release from this migration.
