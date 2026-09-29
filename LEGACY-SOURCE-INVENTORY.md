# Legacy source removal ledger

Scope note, 2026-09-29: this is historical removal/ownership evidence, not an acceptance checklist. Removed tests and source do not create a requirement to reproduce legacy engine semantics or exports. Use the revised `COMPLETION-AUDIT.md` for UI integration completion and `BASELINE-TEST-INVENTORY.md` as selective reference. Removal evidence below records prior checks; it does not establish full UI correctness or fresh verification.

This ledger records the 68 production files that imported `@timeax/digital-service-engine` after the canonical Service Builder cutover. The user explicitly authorized deletion, and these superseded files have now been removed together with their legacy-only wrappers and tests. Git retains the recoverable history.

`npm run check:boundaries` now reports `0/0` legacy production files, traverses both shipped entrypoints (`src/index.tsx` and `src/main.tsx`), and rejects any future transitive legacy-engine import. The dependency itself has also been removed from the manifest and lockfile.

Presentation-only files that do not import the legacy engine, such as the existing node-context dial component reused by the canonical UI, are intentionally outside this list and are not deletion candidates merely because they originated in the legacy codebase.

## Canonical backend seed — 12 files

Replacement: `backend/canonical/**`. Evidence: `backend/canonical/create-backend.test.ts` and the backend row in `MIGRATION.md`.

- `backend/memory/create-backend.ts`
- `backend/memory/initial.ts`
- `backend/memory/seed/authors.ts`
- `backend/memory/seed/branches.ts`
- `backend/memory/seed/comments.ts`
- `backend/memory/seed/meta.ts`
- `backend/memory/seed/participants.ts`
- `backend/memory/seed/permissions.ts`
- `backend/memory/seed/policies.ts`
- `backend/memory/seed/services.ts`
- `backend/memory/seed/snapshots.ts`
- `backend/memory/seed/templates.ts`

## Builder orchestration — 6 files

Replacement: `src/react/workspace.tsx`, `canonical-node-context-menu.tsx`, `canonical-notice-manager.tsx`, `canonical-bottom-panel.tsx`, `presentation.ts`, and package-owned Core/Workspace behavior. The original Notice Manager composition is restored over canonical notice mutations. Evidence: canonical workspace, notice-manager, node-menu, canvas, and bottom-panel tests listed in `MIGRATION.md`.

- `src/builder/bottom-panel.ts`
- `src/builder/node-context-menu.tsx`
- `src/builder/node-context/hooks.ts`
- `src/builder/option-helpers.ts`
- `src/builder/service-context.ts`
- `src/builder/view-models.tsx`

## Legacy catalog hook — 1 file

Replacement: canonical Workspace catalog state consumed by `canonical-bottom-panel.tsx` and the preserved catalog controls. Evidence: `canonical-bottom-panel.test.tsx`.

- `src/hooks/use-service-catalog-state.ts`

## Canvas runtime — 9 files

Replacement: `canonical-canvas-surface.tsx`, `canonical-import-json-modal.tsx`, `canonical-service-context.ts`, `canonical-flow-adapter.ts`, `canvas-model.ts`, `drag-contracts.ts`, and canonical node-context composition. The original import dialog's layout and paste/file/preview workflow are preserved with canonical definitions and catalog state; the existing `Service context` system-node renderer is again fed by canonical Core interpretation. Existing engine-free React Flow node renderers, toolbar presentation, and icons remain reusable UI assets. Evidence: canvas, import-dialog, and context-model tests plus the real-browser workflow recorded in `MIGRATION.md`.

- `src/panels/canvas/adapter.ts`
- `src/panels/canvas/canvas-overlays.tsx`
- `src/panels/canvas/canvas-surface.tsx`
- `src/panels/canvas/flow-canvas.tsx`
- `src/panels/canvas/import-json-modal.tsx`
- `src/panels/canvas/index.tsx`
- `src/panels/canvas/toolbar/index.tsx`
- `src/panels/canvas/toolbar/types.ts`
- `src/panels/canvas/utils.ts`

## Left panel runtime — 4 files

Replacement: `canonical-left-panel.tsx`, `canonical-layers.tsx`, `canonical-assets.tsx`, `canonical-drafts.tsx`, `canonical-header.tsx`, and canonical layer commands. Existing engine-free tree and panel presentation remains reusable. Evidence: left-panel tests listed in `MIGRATION.md`.

- `src/panels/left/assets/index.tsx`
- `src/panels/left/components/drafts.tsx`
- `src/panels/left/components/header.tsx`
- `src/panels/left/layers/index.tsx`

## Right panel runtime — 20 files

Replacement: `canonical-right-panel.tsx`, `canonical-right-header.tsx`, `canonical-properties.tsx`, `canonical-property-sections.tsx`, `canonical-comments.tsx`, and `canonical-wireframe.tsx`. Engine-free presentation components remain reused where they preserve the established interface. Evidence: right-header, properties, comments, and wireframe tests listed in `MIGRATION.md`.

- `src/panels/right/components/header.tsx`
- `src/panels/right/index.tsx`
- `src/panels/right/partials/global/add-service.tsx`
- `src/panels/right/partials/properties/components/descriptor-options.ts`
- `src/panels/right/partials/properties/components/field-default-value-section.tsx`
- `src/panels/right/partials/properties/components/Includes.tsx`
- `src/panels/right/partials/properties/components/node-capabilities.ts`
- `src/panels/right/partials/properties/components/option-effects-section.tsx`
- `src/panels/right/partials/properties/components/quantity-section.tsx`
- `src/panels/right/partials/properties/components/Union.tsx`
- `src/panels/right/partials/properties/components/utility-section.tsx`
- `src/panels/right/partials/properties/components/value-effects-section.tsx`
- `src/panels/right/partials/properties/field-properties.tsx`
- `src/panels/right/partials/properties/option-properties.tsx`
- `src/panels/right/partials/properties/tag.tsx`
- `src/panels/right/partials/properties/tag/TagConstraintsSection.tsx`
- `src/panels/right/partials/properties/tag/TagIncludesSection.tsx`
- `src/panels/right/tabs/comments.tsx`
- `src/panels/right/tabs/properties.tsx`
- `src/panels/right/tabs/wireframe.tsx`

## Workspace host runtime — 18 files

Replacement: canonical Workspace boot/permission presentation, `canonical-bottom-panel.tsx`, `canonical-console.tsx`, `canonical-services-split-pane.tsx`, and `canonical-fallbacks.tsx`. The legacy console's subtabs, filters, log cards, and panel dragging, plus the resizable service list/detail layout, are restored over canonical Workspace/Validation/Core data. Existing engine-free fallback and catalog presentation components remain reusable. Evidence: boot, authorization, bottom-panel, and fallback tests listed in `MIGRATION.md`.

- `src/workspace/authorization.ts`
- `src/workspace/boot-status.tsx`
- `src/workspace/boot.ts`
- `src/workspace/bottom-panel/console-tab.tsx`
- `src/workspace/bottom-panel/index.tsx`
- `src/workspace/bottom-panel/service-detail-card.tsx`
- `src/workspace/bottom-panel/services-split-pane.tsx`
- `src/workspace/bottom-panel/utils.tsx`
- `src/workspace/fallback-editor-modal.tsx`
- `src/workspace/fallback-editor/fallback-details-panel.tsx`
- `src/workspace/fallback-editor/fallback-dialogs.tsx`
- `src/workspace/fallback-editor/fallback-registrations-panel.tsx`
- `src/workspace/fallback-editor/fallback-service-sidebar.tsx`
- `src/workspace/fallback-editor/fallback-settings-panel.tsx`
- `src/workspace/fallback-editor/native-fallback-editor.tsx`
- `src/workspace/fallback-quick-add-helpers.ts`
- `src/workspace/fallback-quick-add.tsx`
- `src/workspace/permissions.ts`

## Removal evidence

The listed production files and their superseded tests were removed only after the canonical replacement evidence passed and the user explicitly authorized deletion. Orphaned legacy-only barrels, wrappers, and self-contained tests discovered by TypeScript/test discovery were removed as part of the same authorized cleanup; presentation-only assets still used by the canonical application, including the node-context Dial, were retained.

Post-removal evidence includes the zero-budget boundary check, repository-wide lint, TypeScript checks, focused interaction tests, the repository-wide behavioral suite, and both library and application production builds. Visual comparison remains anchored to commit `0fba74f`; deletion does not authorize an interface redesign.
