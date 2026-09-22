# Baseline behavioral test inventory

Baseline: `0fba74f`. Audit: 2026-09-22. All 49 baseline test files are listed below, including retained tests. This is an acceptance-case inventory, not a claim that every mapped outcome passes. All canonical treatment is **preserve behavior / replace legacy contracts**. No retirement is approved. Checklist IDs refer to `COMPLETION-AUDIT.md`.

New tests and the current 167-test pass are recorded in the audit; new case counts cannot be compared one-for-one with old counts as a completeness measure. Retained tests prove their own components only, not that the shipped shell reaches those components.

## `backend/memory/create-backend.test.ts`

- Destination/evidence: `backend/canonical/create-backend.test.ts`; `src/react/workspace.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V04.
- Assessment: Workspace owns backend authorization, template scope and revisions; current seed tests cover hydration and conflicts, not every baseline case.

- rejects snapshot writes for unknown actors
- allows comment thread creation for the configured actor when comment write is enabled
- normalizes template create branchId null to undefined for authorization/backend
- normalizes template clone branchId null to undefined for authorization/backend
- returns branch + global templates on refresh when branchId is provided
- returns branch + global templates on list when branchId is provided

## `src/builder/bottom-panel.test.ts`

- Destination/evidence: `src/react/bottom-panel-model.test.ts`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V02.
- Assessment: Recursive attachment breadcrumb output needs exact baseline outcome coverage.

- includes services attached to nested options with breadcrumb labels

## `src/builder/compatibility-runner.test.ts`

- Destination/evidence: `src/builder/compatibility-runner.test.ts`.
- Status: retained component evidence.
- Closure items: F01, V05.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- reuses cache entries and only computes missing ids
- stops work when aborted
- builds stable keys regardless of button ordering
- compares service context states structurally

## `src/builder/node-context-menu.test.tsx`

- Destination/evidence: `src/react/canonical-node-context-menu.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F03, F04, F11.
- Assessment: Name/scope save dialog and batch include selection are missing.

- requires name and sends branchId null when save-to-current-branch is unchecked
- opens include dialog and executes includeMany after selecting a target

## `src/builder/node-context/components/ContextMenu.test.tsx`

- Destination/evidence: `src/react/canonical-node-context-menu.test.tsx`; `src/react/canonical-edge-menu.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F04, V02.
- Assessment: Option visibility exists; batch dialogs and wireframe movement/shortcuts are absent.

- shows "Show option nodes" for field nodes and triggers action
- shows fallback action and routes clicks to the fallback editor opener
- does not show option visibility action for tag nodes
- shows wireframe move actions only on wireframe surface
- does not show wireframe move actions on non-wireframe surfaces
- disables move buttons when movement is unavailable
- routes wireframe move button clicks to handlers
- supports wireframe keyboard shortcuts while menu is open
- ignores wireframe keyboard shortcuts from editable targets
- opens rebind target dialog from batch menu
- opens include target dialog from batch menu
- opens exclude target dialog from batch menu

## `src/builder/node-context/components/RenameNodeField.test.tsx`

- Destination/evidence: `src/react/canonical-node-context-menu.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V02.
- Assessment: Rename dialog exists; payload and Escape outcome need direct replacement evidence.

- updates value through InputField payload
- triggers escape handler on Escape key

## `src/builder/node-context/hooks.test.tsx`

- Destination/evidence: `src/react/canonical-node-context-menu.test.tsx`; `src/react/canonical-canvas-surface.test.tsx`; `Workspace template/Editor tests`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F03, F04, F06, F07, V02.
- Assessment: Partial drop coverage does not cover template identity/group relationships or wireframe movement.

- toggles field option node visibility through canvas api
- moves field globally by reordering fields array
- moves field in context by placing node inside current tag order
- exposes quick add only for nodes with service_id
- hides quick add for nodes without service_id
- regenerates option ids for template options and preserves option data
- adds generated option ids when template options were saved without ids
- regenerates nested option ids when dropping templates with child options
- leaves options undefined when template has no options array
- supports structured single templates when dropping
- drops group templates with remapped ids and rewritten relations
- keeps include and exclude drop flows functional for template assets

## `src/builder/node-context/template-utils.test.ts`

- Destination/evidence: `Workspace template instantiation`; `src/react/canonical-canvas-surface.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F03, F07.
- Assessment: Preserve fresh IDs and appropriate service treatment through canonical owner APIs.

- sanitizes nested option ids and service ids
- regenerates ids for nested options

## `src/builder/option-helpers.test.ts`

- Destination/evidence: `src/react/presentation.test.ts`; `src/react/layer-commands.test.ts`; `Core option traversal`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V02, V03.
- Assessment: Traversal/reorder have coverage; reconcile descendant visibility and exact update outcomes.

- walks, counts, and labels nested options by raw option id
- updates only the matched nested option
- finds and moves nested options within their sibling children list
- filters nested options while keeping parent structure for allowed descendants

## `src/builder/service-context.test.ts`

- Destination/evidence: `src/react/catalog-context-model.test.ts`; `src/react/canonical-service-context.test.ts`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F01, V02.
- Assessment: Visible context exists; add nested raw-ID visibility case.

- lists nested option buttons with raw ids and applies resolved option visibility

## `src/components/dropdown/index.test.tsx`

- Destination/evidence: `src/components/dropdown/index.test.tsx`.
- Status: retained component evidence.
- Closure items: V01, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- preserves indicator gutter class for checkbox rows and avoids generic x-padding override
- preserves indicator gutter class for radio rows and avoids generic x-padding override
- renders clean checkbox labels without prefixed symbol artifacts

## `src/components/service-meta-popover.test.tsx`

- Destination/evidence: `src/components/service-meta-popover.test.tsx`.
- Status: retained component evidence.
- Closure items: V01, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- opens on click and shows invoice rows
- opens on delayed hover
- shows empty state when no primitive meta exists

## `src/components/service-meta.test.ts`

- Destination/evidence: `src/components/service-meta.test.ts`.
- Status: retained component evidence.
- Closure items: V01, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- flattens nested keys and strips meta prefix
- includes primitive leaves and skips object/array containers
- handles empty and invalid values

## `src/panels/canvas/adapter.test.tsx`

- Destination/evidence: `src/react/canonical-flow-adapter.test.tsx`; `src/react/canonical-canvas-surface.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F08, V02.
- Assessment: Only broad adapter happy path is replaced; drag/pan/history/echo contracts require evidence.

- refreshes system node content when only system-node data changes
- uses current toolbar relation mode for wire start and connect
- resyncs edge graph on editor undo/redo events even when graph:update is not emitted
- applies latest decorator refs on selection sync without stale closure lag
- rebuilds rf state immediately when decorators change outside an active drag
- defers subscribed canvas sync while a node drag is active and flushes once on drag end
- defers decorator-driven rebuilds during drag and applies the latest decorator after drag end
- records one layout history transaction for a completed drag gesture
- skips layout history when a drag ends without a net position change
- defers subscribed canvas sync while panning and flushes once on move end
- keeps selection sync local during drag and reconciles final snapshot selection after drag end
- moves comment nodes during drag and defers comment resync until drag end
- avoids redundant selection sync calls during repeated equivalent updates
- suppresses immediate onNodesChange selection echoes right after adapter-driven structural sync
- handles decorator identity churn without forcing structural snapshot rebuilds

## `src/panels/canvas/app-toolbar.test.tsx`

- Destination/evidence: `src/panels/canvas/app-toolbar.test.tsx`.
- Status: retained component evidence.
- Closure items: V01, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- shows import actions from the toolbar menu

## `src/panels/canvas/canvas-surface.test.tsx`

- Destination/evidence: `src/react/canonical-canvas-surface.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F08, V01, V02.
- Assessment: Initial-fit, persisted viewport, bounded updates and comment placement cases are not all replaced.

- passes a default viewport without mounting ReactFlow with live fitView
- runs a one-time fit only when there is no persisted viewport
- skips the initial fit when a persisted viewport exists
- keeps controlled onNodesChange sequences bounded without callback cascades
- routes node and pane clicks into comment placement callbacks when comment placement is active

## `src/panels/canvas/import-json-modal.test.tsx`

- Destination/evidence: `src/react/canonical-import-json-modal.test.tsx`; `src/react/canonical-canvas-surface.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V01.
- Assessment: Five modal tests plus undoable integration exist; canonical shapes intentionally replace legacy props.

- parses pasted props JSON and applies it on confirm
- loads props JSON from a file upload
- shows a parse error for invalid JSON and stays disabled
- shows a shape validation error when props JSON is missing required arrays
- parses catalog JSON and imports it through the catalog callback

## `src/panels/canvas/index.test.tsx`

- Destination/evidence: `src/react/canonical-canvas-surface.test.tsx`; `src/react/canonical-boot-status.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V02, V04.
- Assessment: Boot and undo paths partly covered; live presentation and callback binding need matching integration cases.

- shows seeded boot status while keeping the canvas visible
- updates from booting to ready and reports non-blocking issues cleanly
- preserves editor method context when wrapper invokes edit methods
- routes edge context menu requests into NodeContextMenuProvider API
- recomputes canvas presentation and history flags on undo/redo events

## `src/panels/canvas/presentation.test.ts`

- Destination/evidence: `src/panels/canvas/presentation.test.ts`.
- Status: retained component evidence.
- Closure items: V01, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- maps relation kinds to distinct base styles
- hides exclude edges by default and keeps include visible
- keeps active node, current tag, visible group, related tag, and manual highlight separate
- highlights context bind edges and dims unrelated edges in focus mode
- updates current-tag and visible-group highlight immediately when selection context changes

## `src/panels/canvas/reactflow/index.test.tsx`

- Destination/evidence: `src/panels/canvas/reactflow/index.test.tsx`.
- Status: retained component evidence.
- Closure items: V01, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- applies active outline classes for tag nodes
- applies lighter highlighted outline classes for tag nodes
- uses the same active/highlight classes for option nodes
- keeps selected-only nodes on blue ring styling
- marks system-inactive nodes as muted while keeping them visible
- applies active-node ring styling to comment nodes when selected

## `src/panels/canvas/toolbar/index.test.tsx`

- Destination/evidence: `src/react/canonical-canvas-surface.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V01, V02.
- Assessment: Toolbars render; external edge-mode event and exact compact geometry need evidence.

- keeps relation buttons visible and exposes view toggles via the compact popover
- uses the same standalone button sizing for the view trigger and orientation toggle
- updates the active relation button immediately after clicking a relation tool
- updates the active relation button when edge:change is emitted externally

## `src/panels/left/assets/index.test.tsx`

- Destination/evidence: `src/react/canonical-assets.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F03, F07, F11, V04.
- Assessment: Current tests cover rendering, record clone and denied mutation; rename/delete/global scope remain evidence gaps.

- opens template context menu on right click
- renames template and sends branch id when checked
- clones template with branchId null when unchecked
- deletes template from context menu

## `src/panels/left/components/header.test.tsx`

- Destination/evidence: `src/react/canonical-header.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V04.
- Assessment: Prompt test exists; custom leaf/nested/zero-argument commands need explicit coverage.

- calls a leaf menu command with workspace
- calls nested child menu commands with workspace
- still executes zero-arg command handlers
- shows default prompts menu item and opens prompts dialog

## `src/panels/left/layers/rename-permission.test.tsx`

- Destination/evidence: `src/react/canonical-layers.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V02, V04.
- Assessment: Denied controls covered; reject-after-attempt and no ghost label not directly proven.

- does not keep a ghost label in UI when rename is blocked upstream

## `src/panels/left/layers/reorder.test.ts`

- Destination/evidence: `src/react/layer-commands.test.ts`; `src/react/canonical-layers.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V02.
- Assessment: Pure sibling/context reorder tests exist; UI drop guards require direct outcome cases.

- dispatches tag reorder via editor.placeNode and prevents local mutation
- dispatches field reorder in context by seeding order map then placing field
- dispatches option reorder via editor.placeOption
- reorders nested options within their child sibling list when patchProps is available
- blocks reparenting in same-parent drop guard
- blocks invalid cross-kind nesting in fields tree
- allows option drops under option parents for capability checks in the insert handler

## `src/panels/left/layers/toolbar-add.test.tsx`

- Destination/evidence: `src/react/canonical-layers.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F05, F06.
- Assessment: Inline naming and invalid-selection feedback are missing.

- plain add creates a field in the current visible group even when an option is selected
- folder-plus opens inline option creation on a selected field
- folder-plus opens inline child-option creation on a selected option
- folder-plus emits an error when there is not one selected field or option

## `src/panels/right/components/header.test.tsx`

- Destination/evidence: `src/react/canonical-right-header.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V04.
- Assessment: Canonical callbacks replace legacy payloads; boot gating and absent callbacks need explicit coverage.

- calls onShare with snapshot data and onPlay with current canvas props payload
- falls back to api.getServiceProps when canvas.props is missing
- does not throw when callbacks are not provided
- disables preview and share until required workspace boot sections are ready

## `src/panels/right/index.test.tsx`

- Destination/evidence: `src/react/canonical-right-panel.test.tsx`; `src/react/canonical-wireframe-browser.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V02.
- Assessment: forceMount exists; composition test mocks preview, so real input preservation across tabs remains unproven.

- does not remount wireframe provider when toggling tabs repeatedly

## `src/panels/right/partials/global/add-service.test.tsx`

- Destination/evidence: `src/react/canonical-properties.test.tsx`; `src/react/canonical-bottom-panel.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F01, F02.
- Assessment: Bottom-panel filtering does not replace inspector-specific catalog/filter/meta workflow.

- renders trailing filter control and opens filter popover
- routes catalog scope and group selection through editor APIs
- applies catalog group and current context filters together
- shows meta info popover in selected service summary
- applies manual primary rate filtering without enabling current context
- does not apply custom primary filtering until a manual rate is valid

## `src/panels/right/partials/properties/components/descriptor-options.test.ts`

- Destination/evidence: `src/react/canonical-properties.test.tsx`; `Workspace descriptor creation`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F06, V03.
- Assessment: Nested/flat descriptor capability treatment must survive creation and type transitions.

- detects child option capability from descriptor options
- keeps flat descriptors flat

## `src/panels/right/partials/properties/components/descriptor-settings.test.tsx`

- Destination/evidence: `src/panels/right/partials/properties/components/descriptor-settings.test.tsx`.
- Status: retained component evidence.
- Closure items: F09, V03, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- renders label/color/bgColor for array object item after add
- keeps internal event-like keys hidden while allowing normal label field keys
- stores string text values and clears blank text values
- stores string enum selections normally
- stores finite numbers and clears invalid numbers
- stores boolean toggle values
- stores single anyOf selections
- stores and clears multiple anyOf selections
- resets overrides through the built-in field description reset control
- passes normalized props to custom renderers and writes through path callbacks
- writes custom renderer values inside object fields and array items
- renders a non-fatal message for unknown descriptor UI types

## `src/panels/right/partials/properties/components/descriptor-ui-renderers.test.tsx`

- Destination/evidence: `src/panels/right/partials/properties/components/descriptor-ui-renderers.test.tsx`.
- Status: retained component evidence.
- Closure items: F09, V03, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- registers the built-in descriptor renderers by default
- registers, replaces, resolves, and unregisters custom renderers
- returns undefined for unknown renderer types
- rejects invalid registration inputs

## `src/panels/right/partials/properties/components/field-default-value-section.test.tsx`

- Destination/evidence: `src/react/canonical-properties.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V03.
- Assessment: Canonical default editor exists; selection IDs, primitive parse and clear cases need direct assertions.

- saves selectable default option ids through the editor api
- parses primitive draft defaults and clears empty values

## `src/panels/right/partials/properties/components/option-effects-section.test.tsx`

- Destination/evidence: `src/react/canonical-properties.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V03.
- Assessment: Basic create covered; removal, breadcrumbs, parent exclusion and force-visible-only cases remain evidence gaps.

- renders existing effects with nested breadcrumb labels for option triggers
- saves raw field and nested option ids through the editor api
- filters an option trigger parent field out of target choices
- removes an effect through the editor api
- allows force-visible-only effects for fields without options
- does not render when trigger mappings are unsupported

## `src/panels/right/partials/properties/components/value-effects-section.test.tsx`

- Destination/evidence: `src/react/canonical-properties.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V03.
- Assessment: Basic create covered; target eligibility, removal and mode details need evidence.

- renders existing effects with option labels and mode details
- saves raw ids and filters parent/inactive fields from target choices
- removes an effect through the editor api

## `src/panels/right/partials/properties/field-properties.test.tsx`

- Destination/evidence: `src/react/canonical-properties.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F06, V03.
- Assessment: Multiple/default behavior is partly projected but descriptor transitions are incomplete.

- disables Is multiple and reflects descriptor autoEnable=true
- disables Is multiple and reflects descriptor autoEnable=false
- shows Is multiple toggle only when field has options
- sets multi=true and preserves existing meta keys
- sets multi=false when toggled off

## `src/panels/right/partials/properties/option-properties.test.tsx`

- Destination/evidence: `src/react/canonical-properties.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V03.
- Assessment: Nested option inspector exists; exact raw-ID relabel case needs evidence.

- updates a nested option label by raw option id

## `src/panels/right/tabs/properties.test.tsx`

- Destination/evidence: `src/react/canonical-properties.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V03.
- Assessment: Local label draft exists; empty blur/Enter acceptance cases need direct coverage.

- keeps empty label drafts local and restores the loaded label on blur or Enter

## `src/panels/right/tabs/wireframe.test.tsx`

- Destination/evidence: `src/react/canonical-wireframe.test.tsx`; `src/react/canonical-wireframe-browser.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F04, V01, V02.
- Assessment: Footer and failure paths implemented; collapse/popovers/invalid numbers and context-menu parity need evidence.

- renders footer summary chips with quantity, range, pricing, and counts
- supports collapsing and expanding the footer summary
- opens a services popover when the services pill is clicked
- renders fallback placeholders for invalid numeric pricing values and no active tag

## `src/workspace/authorization.test.ts`

- Destination/evidence: `src/react/workspace.test.tsx`; `canonical denied-interaction suites`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V04.
- Assessment: Canonical permissions replace old keys; default-deny and read-only/comment-write split must be demonstrated.

- allows full editing for an editor with branch write permissions
- blocks branch edits for read-only users while still allowing comment writes when permitted
- denies by default when permission keys are missing

## `src/workspace/boot-status.test.tsx`

- Destination/evidence: `src/react/boot.test.ts`; `src/react/canonical-boot-status.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V01, V04.
- Assessment: Real partial/full recovery tests pass; ready dismissal and seeded/loading presentation remain explicit checks.

- renders booting state with seeded view messaging
- renders fully ready state
- renders partial failure while remaining ready for optional section errors
- renders blocking failure when required sections fail
- retries all sections and individual sections
- lets completed boot status be dismissed from the centralized surface

## `src/workspace/bottom-panel/index.test.tsx`

- Destination/evidence: `src/react/canonical-bottom-panel.test.tsx`; `src/workspace/bottom-panel/service-picker-dialog.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: F01, V01, V04.
- Assessment: Eleven current panel tests cover restored controls; combined eligibility and catalog assignment/select-all still require reconciliation.

- uses manual popover context by default and applies compatibility independently from used services
- keeps hide active separate from compatibility filtering
- shows hide-services dropdown options with checkboxes
- hides non-eligible services when requested
- combines both hide toggles
- marks hide-services trigger as active when any hide option is enabled
- links to the current context only when explicitly enabled and preserves linked values after unlinking
- does not show the filter as active unless compatible-only is enabled
- passes custom primary rate context in all-services compatibility checks
- expands and collapses the header search overlay
- switches between All and Catalog modes and renders the catalog builder only in Catalog mode
- routes catalog builder actions through editor catalog APIs without touching props mutations or transactions
- uses form-palette inputs for group naming and resets picker filters on reopen
- assigns multiple services to the active group through the picker dialog
- supports select-all for filtered services with tri-state behavior
- shows the selected group chip beside the count and supports ungrouped via the toolbar treeselect

## `src/workspace/bottom-panel/service-picker-dialog.test.tsx`

- Destination/evidence: `src/workspace/bottom-panel/service-picker-dialog.test.tsx`.
- Status: retained component evidence.
- Closure items: V01, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- renders row-level meta info popover and opens it
- defaults source to parent when parent has assigned services and resets on clear filters
- defaults source to all for root groups

## `src/workspace/bottom-panel/service-picker.test.ts`

- Destination/evidence: `src/workspace/bottom-panel/service-picker.test.ts`.
- Status: retained component evidence.
- Closure items: V01, V06.
- Assessment: Retained test file; current checkpoint suite passes. Verify actual integration where callers changed; retention alone is not migration-complete evidence.

- defaults to parent for child groups when parent has assigned services
- defaults to all for child groups when parent has no assigned services
- defaults to all for root groups
- filters to parent services when source is parent
- uses all services when source is all
- applies existing filters after source filtering

## `src/workspace/fallback-editor-modal.test.tsx`

- Destination/evidence: `src/react/canonical-fallbacks.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V04.
- Assessment: Persistence is covered; failing persistence surface must have direct evidence.

- opens for a service and persists fallback edits through the canvas editor
- shows the surface error banner when persistence fails

## `src/workspace/fallback-editor/native-fallback-editor.test.tsx`

- Destination/evidence: `src/react/canonical-fallbacks.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V01, V04.
- Assessment: Add/remove/reset/settings covered partly; switching, required selection and loading controls need explicit checks.

- switches services and updates the visible registrations
- opens the registration flow, requires a valid node selection, and adds candidates
- removes and clears candidates from registrations
- saves settings through the provider callback
- reflects header loading states for save, validate, and reset

## `src/workspace/fallback-quick-add-helpers.test.ts`

- Destination/evidence: `src/react/canonical-fallbacks.test.tsx`; `Core fallback eligibility`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V04.
- Assessment: Global/node registration covered; exclude primary/bound/active/duplicate and initial discovery cases need owner/integration evidence.

- reads bound ids for a global service scope
- collects active service ids across tags, fields, and options
- passes node scope and excludes primary, bound, active, and duplicate services when building candidates
- discovers service-scoped candidates even when no globals are registered yet
- merges selected ids into the correct fallback scope without duplicates

## `src/workspace/fallback-quick-add.test.tsx`

- Destination/evidence: `src/react/canonical-fallbacks.test.tsx`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V01, V04.
- Assessment: Node/global launch flows exist; retain visual and cancellation evidence.

- opens the quick-add overlay for a node launch

## `src/workspace/permissions.test.ts`

- Destination/evidence: `src/react/workspace.test.tsx`; `canonical denied-interaction suites`.
- Status: replacement evidence partial; pending gates below.
- Closure items: V04.
- Assessment: Canonical keys replace legacy adaptation; preserve default-deny and grants, not legacy key aliases.

- denies by default when key is missing
- returns true when permission keys are present
- filters unknown keys when adapting engine permissions maps
