# Service Builder UI integration completion audit

Scope revised with user approval: 2026-09-29. Source observations: 2026-09-22. Baseline UI: `0fba74f`; incomplete implementation checkpoint: `e264a92` on `plug-new-dgp-system`.

This revision corrects the earlier audit's excessive legacy-parity requirements. It changes acceptance scope, not implementation status. No code was repaired or freshly verified by this revision. The goal remains paused.

## Acceptance boundary

Preserve the existing UI, layout, styling, controls, and visible workflows. Bind them correctly to current canonical DGP APIs and present their results, permissions, pending states, and failures. The packages govern domain semantics. Legacy engine algorithms, wire shapes, event order, transaction counts, and all 222 old test titles are not completion requirements.

The inventory is a reference for selecting relevant UI checks. Existing passing canonical tests count as evidence. A package capability question is not an instruction to implement it upstream. Where an actual visible workflow is blocked, record the control, required operation, inspected API/version, and user impact for a scoped decision. Do not silently remove controls or report success for failed operations.

## Reclassified findings

IDs are retained for traceability. “Defect” below describes the September 22 source assessment; confirm it still exists before editing. “Investigate” is not a proven failure. Close each relevant finding with a focused fix/test, existing evidence, a supported canonical explanation, or an explicit dependency blocker. An unresolved blocker is not a completed workflow.

| ID | Disposition | Bounded follow-up |
| --- | --- | --- |
| F01 | Package semantics question; UI truthfulness check | Candidate-policy and context-rate evaluation differ from legacy. Present the results the installed Core/Validation/Workspace APIs actually provide; do not imply an unchecked result passed. No new evaluator or package API is required solely for legacy parity. Record a blocker only if a concrete visible operation cannot be supported. |
| F02 | UI regression | Inspector service selection was reduced to a plain select. Compare the original picker controls, grouping, search/filter and metadata presentation; restore applicable UI over available canonical catalog data. Candidate eligibility follows canonical results, not a port of legacy policy logic. |
| F03 | UI regression plus capability question | Template save bypasses the name/scope dialog and uses an automatic name/current branch. Restore the dialog using supported Workspace operations and show failures. Group-template support is a separate API question; do not invent a new contract to close this row. |
| F04 | UI workflow wiring | Check missing batch/context-menu and wireframe actions against existing canonical commands. Restore supported visible actions and shortcuts. Record an exact unsupported action as a blocker; old command names and history counts are not requirements. |
| F05 | UI regression | Layers Add option bypasses inline naming and invalid selections can fail silently. Restore naming/cancel and meaningful disabled/error feedback around canonical creation. |
| F06 | Canonical integration defect/risk | Check descriptor creation and variant propagation against the available descriptor-aware API. Use canonical descriptor defaults/variants and preserve host metadata as its contract permits. Do not copy legacy type-transition/pruning algorithms or require the old fixture matrix. |
| F07 | Investigate identity handling | September source inspection found nested option IDs retained during template drops; corruption was not reproduced. Exercise repeated instantiation using the canonical API and check valid identity/relationships. If an owner defect is reproduced, report its contract and reproduction; do not implement an identity engine locally or require new group-template APIs. |
| F08 | React integration review; legacy internal requirements removed | Check side effects inside React state updaters and visible drag, selection and viewport behavior. Fix reproducible React integration defects. Exact refresh counts, event order and one-transaction-per-drag assertions are not acceptance criteria. Bind undo/redo to supported Workspace history; any unsupported visible layout-undo expectation is a specific capability question. |
| F09 | Public API scope question | Missing legacy renderer/provider or fallback exports do not alone prove a defect. Verify current documented canonical public entrypoints and required host customization. Do not restore aliases or add an extension framework solely because the old barrel exported one. Record an actual required customization blocker if found. |
| F10 | Data-conversion defect | The validation editor maps expression text into both expression body and diagnostic code. Keep them separate; verify a rule round-trip and expression edit retain the diagnostic identifier and canonical serialized shape. |
| F11 | Failure-presentation defect | Template/asset rename, clone, delete and context save lack useful failed-result feedback. Preserve user input, show the returned reason and permit retry/cancel. Cover shared handlers with representative failures rather than every backend-operation permutation. |
| F12 | Scoped distribution/configuration review | Check obsolete engine configuration and declared dependency versions against actual imports/features. Retain the existing legacy-import boundary check. Do not invent a broad semantic-drift enforcement project as a finishing condition. Verify package contents/public imports at final build. Do not invoke the publishing `push` script or publish a release. |

## Bounded verification

| ID | Required evidence |
| --- | --- |
| V01 | Compare the assembled shell and changed UI surfaces against the baseline with equivalent data at a representative viewport. Check panel proportions, node scale, overlap and dialog controls. Expand viewport/state coverage only for an observed responsive issue; no exhaustive screenshot matrix. |
| V02 | Focused canonical integration checks for touched canvas, Layers, menus and preview paths. Assert visible outcomes and correct canonical commands. Reuse existing passing evidence; do not port every original adapter test. |
| V03 | Focused property/descriptor round-trip checks for changed bindings, including F10. Package-owned defaults, eligibility and algorithms are trusted according to current contracts, not independently reimplemented or exhaustively re-proven here. |
| V04 | Representative permissions, pending/error and retry behavior for changed lifecycle controls. Existing canonical boot, branch, comments, draft and publication evidence remains useful. No mandatory all-surfaces/all-failures matrix. |
| V05 | Keyboard, focus and cancellation checks on changed interactive controls. Investigate performance only when a concrete regression appears; keep existing budgets without adding a new benchmarking program. |
| V06 | At the final implementation checkpoint, run tests, lint, type checking, existing boundary checks, library/app builds and a focused public-entrypoint/package-content smoke check. Count still-valid previous passes; do not repeatedly run unrelated suites. Record unresolved blockers and distinguish verified findings from source suspicions. |

## Work already present

Continue from `e264a92`. The canonical shell, providers, backend seed, panels, comments, boot/retry surfaces, Ordering preview, fallback editor, import modal, Notice Manager, console, history and catalog controls already exist. Preserve working integration. Historical slice claims in `MIGRATION.md` are evidence, not a reason to restart each slice. The mocked shell test does not establish browser appearance; the wireframe test named “browser” uses jsdom and real Form Palette components.

## Historical checkpoint verification — 2026-09-22

The following results are historical, not new runs performed for the scope revision:


- `npm test`: **46 files / 167 tests pass**, 113.01 seconds on this audit machine. One full run only. Existing source-map, Form Palette self-managed-provider and React `act(...)` warnings appeared; they were not suppressed or treated as failures.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run check:boundaries`: passed, **0/0 legacy production files**.
- `npm run build`: passed, including library JavaScript/CSS, TypeScript declarations and Vite application. Existing large-chunk and plugin-timing advisories remain; no warning was suppressed.
- `git diff --check`: passed before staging; staged whitespace validation is repeated before commit.
- No install, dependency upgrade, product-code fix, release, push, or goal resumption is part of this checkpoint.

## Implementation order after explicit resumption

1. Confirm and fix local UI/conversion/failure defects: F02–F06, F10–F11. Reuse available canonical APIs and focused tests.
2. Resolve F07/F08 through small reproductions and contract inspection. Triage F01/F09 as scoped questions; do not let speculative package work hold up independent fixes. Review F12 without expanding tooling scope.
3. Perform the representative V checks once applicable fixes are ready. Record each finding's disposition and any exact dependency blocker. Finish when the scoped requirements are met; do not start a new blanket legacy audit.

No release, sibling-package implementation, dgp-studio work, or automatic goal resumption is authorized by this document.
