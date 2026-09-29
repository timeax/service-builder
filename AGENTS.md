# Agent guidance: canonical Service Builder

This repository is the preserved visual Service Builder shell and, on the `plug-new-dgp-system` branch, the active canonical DGP v1 presentation migration target. The user explicitly approved changing this repository while deferring the separate `dgp-studio` UI.

## Accepted scope — 2026-09-29

Finish the existing UI integration with canonical DGP packages. Preserve the rendered interface and visible workflows from `0fba74f`; package contracts and APIs govern domain semantics. This task does not re-extract or re-audit the DGP engines. The scoped clarification in the parent workspace instructions applies here.

Read `COMPLETION-AUDIT.md` for the bounded follow-up and `GOAL-OBJECTIVE.md` for the proposed replacement goal. `BASELINE-TEST-INVENTORY.md` is a reference, not a port-every-test checklist. The implementation goal remains paused until the user separately resumes it.

## Boundaries

- Preserve the existing layout, density, styling, panel proportions, and workflows. Do not silently remove visible controls or redesign the interface. Canonical domain behavior need not reproduce legacy engine semantics.
- Author and emit canonical `ProductDefinition` data only. Do not add legacy aliases, compatibility modes, `flags`, `estimates`, or legacy persisted-definition support.
- Use `@elqora/dgp-workspace` for editorial runtime, CanvasAPI, Editor, Selection, Comments, branches, drafts, commits, autosave, collaboration, and publication orchestration.
- Use `@elqora/dgp-core` for interpretation and graph behavior, `@elqora/dgp-validation` for editorial/publication diagnostics, `@elqora/dgp-ordering` for customer state and snapshots, and `@elqora/dgp-ordering-form-palette` for the default React input integration.
- React providers, selectors, rendered canvas, panels, property editors, diagnostics, previews, and authorization presentation live here. Do not recreate lower-level behavior in React.
- Keep host persistence, transport, authentication, and authorization behind canonical Workspace ports.
- Treat the current `main` commit `0fba74f` as the visual and workflow baseline. Use existing UI tests selectively to identify observable regressions; canonical integration tests verify current package calls and results.
- Preserve unrelated working-tree changes in sibling repositories. Do not edit `dgp-studio` during this migration.

## Migration discipline

- Maintain `MIGRATION.md` with concrete UI defects, integration evidence, and precise dependency blockers. A difference from an old engine test is not automatically pending migration.
- Classify legacy assertions as UI reference, canonical integration reference, package-owned semantics, or obsolete implementation/contract detail. Retain useful existing tests; add focused regression coverage for changed behavior. Do not port the entire inventory or recreate package tests locally.
- If a visible workflow lacks a canonical operation, record the control, inspected API, missing operation and user impact. Continue independent work and request a scoped decision; do not implement new sibling-package behavior, hide the workflow, or fabricate success.
- Suspected package bugs require evidence against current contracts. Package differences alone do not authorize upstream changes. No sibling implementation changes are included in this goal.
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

Completion requires zero legacy-engine imports, canonical public exports, the scoped UI/integration findings resolved with evidence, representative visual and interaction checks including keyboard/focus on changed controls, production builds, and a clean intentional diff. Do not publish a release from this migration. Reuse passing checks until an intervening change could affect them; run one appropriate final verification checkpoint. Do not create a new exhaustive legacy-parity, accessibility, or performance program as a completion requirement. Report unresolved dependency blockers honestly rather than marking the goal complete.
