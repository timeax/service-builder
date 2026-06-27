# Digital Service Engine Nested Option Update Overview

## Purpose

This note summarizes the recent `digital-service-ui-builder` / `@timeax/digital-service-engine` updates around option effects, recursive option children, input descriptor capabilities, and flat nested-option identity.

It is written for the `service-builder` project because that project consumes the engine package and owns the authoring UI around fields, options, mappings, service attachments, previews, layers, and service context tools.

## What Changed In The Engine

### 1. Recursive `FieldOption.children`

`FieldOption` now supports recursive children:

```ts
type FieldOption = {
  id: string;
  label: string;
  children?: FieldOption[];
};
```

The key rule is that `children` is structure only. It is for rendering a tree and grouping options visually. It does not create a separate identity model.

Every top-level option and every child option must have its own globally unique `id`.

Correct:

```ts
selectedOptionIds = ["o:premium-fast"];
optionById.get("o:premium-fast");
```

Incorrect:

```ts
selectedOptionIds = ["f:package/o:premium/o:premium-fast"];
selectedOptionIds = ["f:package:o:premium:o:premium-fast"];
selectedOptionIds = ["f:package::o:premium-fast"];
```

### 2. Flat Option Identity Everywhere

The engine now treats all options, including nested options, as first-class flat option nodes.

This affects:

- selection
- visibility
- node maps
- service maps
- order kind resolution
- fallback and policy context
- validation
- runtime snapshots
- React order flow
- input wrapper option filtering

The engine recursively walks `field.options[].children[]`, but every discovered option is indexed by its own `option.id`. Parent/child relationships may exist only as metadata for UI rendering, breadcrumbs, tree display, or ordering controls.

### 3. No Composite Option Ids

The old compatibility pattern `fieldId::optionId` is no longer valid option identity.

The engine no longer decomposes strings like:

```ts
"f:package::o:premium-fast"
```

into field and option parts for selection or trigger resolution.

If such a string appears as a trigger key, selected key, or option id, it is treated as a literal id. Unless there is actually a node with exactly that id, it is ignored or rejected by validation.

### 4. `option_effects_for_buttons`

`ServiceProps` now supports `option_effects_for_buttons`.

This feature lets selected button or option ids filter the visible options of target fields. It can also force a target field visible when explicitly requested.

Conceptual shape:

```ts
option_effects_for_buttons: {
  "o:premium": {
    "f:speed": {
      forceVisible: true,
      include: ["o:fast", "o:priority"],
      exclude: ["o:legacy"]
    }
  }
}
```

Rules:

- trigger keys are raw button field ids or raw option ids
- nested child options can be triggers by their own ids
- target option ids are raw option ids under the target field, including nested children
- `include` is applied before `exclude`
- `exclude` wins
- unknown option ids are ignored by runtime resolution and pruned/reported by cleanup and validation
- hidden selected options are removed from runtime contribution

### 5. Centralized Visibility Resolution

The engine now has a resolved visibility model:

```ts
type ResolvedVisibility = {
  fieldIds: string[];
  optionsByFieldId: Record<string, string[]>;
  forcedFieldIds: string[];
};
```

The builder exposes `resolveVisibility(tagId, selectedKeys?)`.

Runtime code should prefer this over manually combining:

- `visibleFields(...)`
- includes/excludes
- selected option filtering
- forced field visibility
- visible option filtering

`visibleFields()` still returns only field ids for compatibility, but it delegates through the shared resolver.

### 6. React Runtime Exports More Visibility State

The React order flow now exposes:

- `visibleOptionsByFieldId`
- `forcedFieldIds`

The input wrapper filters field options before passing them to `InputField`.

Filtering is recursive:

- top-level options are kept only if allowed
- child options are kept only if allowed
- if a field has no entry in `visibleOptionsByFieldId`, all options remain available

### 7. Input Descriptor Child Option Capability

Input descriptors can now advertise nested option support:

```ts
descriptor.options.children.supported === true
```

The new capability shape is future-safe:

```ts
options: {
  supported: true,
  autoCreate: true,
  children: {
    supported: true,
    autoCreate?: boolean,
    defaultLabel?: string,
    defaultValue?: string | number
  }
}
```

Only the built-in `treeselect` descriptor currently advertises child option support.

The built-in `InputField` prop mapper now passes `children` recursively and applies notice/tag decoration to child options as well as top-level options.

## What Got Better

### More Expressive Product Modeling

Fields can now model hierarchical choice sets directly.

Example:

```ts
{
  id: "f:package",
  type: "select",
  meta: { variant: "treeselect" },
  options: [
    {
      id: "o:premium",
      label: "Premium",
      children: [
        { id: "o:premium-fast", label: "Fast delivery" },
        { id: "o:premium-safe", label: "Safer delivery" }
      ]
    }
  ]
}
```

The nested options can carry the same runtime meaning as any other option:

- service id
- pricing role
- utility metadata
- quantity defaults
- order kind
- notices
- include/exclude triggers
- option effects

### Less Duplicate Visibility Logic

Visibility is now resolved once by the engine and consumed by React and snapshot building.

That reduces drift between:

- preview form rendering
- selected option pruning
- order snapshot output
- service contribution
- utility contribution
- fallback and policy context

### Safer Snapshots

Hidden selected options no longer contribute to snapshots.

If an option is hidden by `option_effects_for_buttons`, it should not appear in:

- `selection.fields[].selectedOptions`
- `inputs.selections`
- `services`
- `serviceMap`
- utilities
- quantity source
- node context
- policy/fallback context

### Clearer Identity Rules

Nested position is structure. Option id is identity.

This makes selection logic simpler and avoids bugs where the same option could be represented by both:

```ts
"o:fast"
```

and:

```ts
"f:speed::o:fast"
```

## Impact On `service-builder`

The `service-builder` project is not just a passive consumer. It contains authoring UI and helper logic that walks fields/options directly. Several places currently assume `field.options` is one level deep.

Those paths should be updated before service-builder fully supports nested option authoring.

### Package Version Alignment

`service-builder` currently declares:

- peer dependency: `@timeax/digital-service-engine ^0.3.5`
- dev dependency: `@timeax/digital-service-engine ^0.3.1`
- dev dependency: `@timeax/form-palette ^0.1.34`
- peer dependency: `@timeax/form-palette ^0.2.1`

After publishing the engine update, service-builder should align its dev dependency to the updated engine version so local tests and builds see:

- `FieldOption.children`
- `ServiceProps.option_effects_for_buttons`
- `descriptor.options.children`
- `resolveVisibility(...)`
- recursive input prop mapping

If the local dev dependency stays older than the peer expectation, TypeScript and tests may not reflect the new runtime contract.

### Descriptor Capability UI

File inspected:

```txt
src/panels/right/partials/properties/components/descriptor-options.ts
```

Current behavior resolves:

- `descriptor.options.supported`
- `descriptor.options.autoCreate`
- `descriptor.options.defaultLabel`
- `descriptor.options.defaultValue`

It does not yet expose:

```ts
descriptor.options.children.supported
```

Recommended update:

- extend `ResolvedOptionCapability` with `supportsChildOptions`
- read `descriptor?.options?.children?.supported === true`
- optionally expose child defaults for future add-child-option UI
- use this to decide whether a field's options can receive child options

This matters because only treeselect should advertise nested options. Select, multiselect, radio, and toggle-group should keep flat authoring unless they later gain nested rendering support.

### Field Option Rendering In Properties

File inspected:

```txt
src/panels/right/partials/properties/field-properties.tsx
```

Current behavior:

- uses `const options = node.raw.options ?? []`
- displays only top-level options in the "Options" section
- counts only `options.length`
- selects top-level options by id

Recommended update:

- display option trees recursively when `supportsChildOptions` is true
- count all options recursively, or show both top-level and total counts
- keep selection using the option's own id
- add child-option creation only when descriptor capability allows it

Important: do not display or store path ids. Child option rows should select `option.id`.

### Option Properties Editing

File inspected:

```txt
src/panels/right/partials/properties/option-properties.tsx
```

Current behavior:

```ts
const options = field.raw.options ?? [];
const next = options.map((option) =>
  option.id === node.id ? { ...option, label: e.value } : option
);
canvas.api.editor.updateField(field.id, { options: next });
```

This edits only top-level options.

Impact:

- editing a nested option label/value will not update the child unless the engine's `OptionNode` editor methods already handle this elsewhere
- if service-builder keeps manual `options.map(...)`, it must become recursive

Recommended update:

- prefer engine editor methods if available for editing option labels/values by option id
- otherwise add a shared helper like `updateOptionById(options, optionId, patch)`
- recurse into `children`
- preserve all option objects and child arrays

### Template Utilities

File inspected:

```txt
src/builder/node-context/template-utils.ts
```

Current behavior:

- `sanitizeField` maps only top-level `next.options`
- `sanitizeOption` removes only the current option's `id` and `service_id`
- `withFreshOptionIds` regenerates ids only for top-level options

Impact:

- nested children could keep stale ids when a template is cloned
- nested child services could accidentally survive sanitization
- duplicate option ids could be introduced through nested template reuse

Recommended update:

- make `sanitizeOption` recursive
- remove `id` and `service_id` from every child option
- make `withFreshOptionIds` recursive
- generate fresh globally unique ids for every top-level and nested option
- preserve `children` structure

### Node Context Menu Movement

File inspected:

```txt
src/builder/node-context/hooks.ts
```

Current behavior finds an option owner using:

```ts
(field.options ?? []).some((option) => option.id === target.nodeId)
```

and moves options among:

```ts
ownerField.options
```

Impact:

- nested child options will not be found
- move up/down will only work for top-level option siblings
- moving nested options requires knowing the parent option's `children` list

Recommended update:

- use an engine helper if exported, such as recursive option owner lookup
- otherwise add service-builder local helpers:
  - `findOptionLocation(fields, optionId)`
  - returns `{ field, option, parentOption?, siblings, index }`
- use sibling list for move up/down
- call an engine editor method that understands nested placement if available
- keep move identity as `option.id`

### Layers Panel And Sort Tree

File inspected:

```txt
src/panels/left/layers/index.tsx
```

Current behavior:

- handles field and option tree changes through `SortTree`
- inserts an option under a field with `canvas.api.editor.addOption(parent, ...)`
- blocks option creation using descriptor option support

Impact:

- adding an option under another option should only be allowed for child-option-capable descriptors
- the drop/create logic needs to know whether the parent is a field or option
- nested option creation should create `children` under the selected parent option, not a path id

Recommended update:

- if the insert parent id is a field id, use existing top-level option creation
- if the insert parent id is an option id:
  - resolve the owner field and parent option
  - check the owner field descriptor supports `options.children.supported`
  - add the new option to `parentOption.children`
- ensure SortTree ids remain the option ids

### Service Context Panel

File inspected:

```txt
src/builder/service-context.ts
```

Current behavior:

- `buildButtonGroups` lists only `field.options`
- `collectUsedServiceIds` collects only top-level option services
- `sanitizeServiceContext` allows selected buttons only from those top-level options

Impact:

- nested option buttons will not appear in service context controls
- selected nested options may be pruned from service context state
- services attached to nested options may not be counted in used service ids

Recommended update:

- recursively flatten options for service context groups
- preserve field grouping, but use the child option's own id
- optionally include breadcrumb labels, for example `Premium / Fast delivery`
- collect service ids from nested options recursively
- use `builder.resolveVisibility(tagId, selectedButtons)` when available, so `optionsByFieldId` filters context options the same way runtime does

### Bottom Panel Service Summaries

File inspected:

```txt
src/builder/bottom-panel.ts
```

Current behavior:

- `buildServiceNodeMap` adds tags, fields, and top-level options
- it does not recurse into `option.children`

Impact:

- services attached to nested options may not show as attached/active in the bottom panel
- active service counts can be wrong
- attached node labels can omit child options

Recommended update:

- recursively walk field options
- add every nested option to the service node map by its own id
- include parent field label and optionally option breadcrumb metadata

### Wireframe Preview

File inspected:

```txt
src/builder/view-models.tsx
```

Current behavior:

- `getVisiblePreviewFields` calls `builder.visibleFields(...)`
- it passes `canvas.selectionInfo.optionIds`
- it returns `options: node.raw.options ?? []`

Impact:

- field visibility should still mostly work because the engine keeps `visibleFields`
- option visibility filtering will be incomplete if the wireframe renders `field.options` directly
- nested child option labels may appear even when option effects hide them

Recommended update:

- where possible, use `builder.resolveVisibility(tagId, selectedOptionIds)`
- pass `optionsByFieldId` into preview rendering
- recursively filter field options before rendering the wireframe
- keep all options when no visibility entry exists

### Include/Exclude Mapping UI

File inspected:

```txt
src/panels/right/partials/properties/components/Union.tsx
```

Current behavior:

- include/exclude sections operate on node ids
- option nodes can trigger includes/excludes through `node.id`
- target choices are field ids/visible descendant ids

Impact:

- nested options should work naturally as triggers if the engine exposes them as option nodes
- the UI must not create composite trigger keys
- when selecting a nested option as the source node, calls like `canvas.api.editor.include(node.id, targetId)` are correct

Recommended update:

- verify nested option nodes are selectable in canvas/layers
- ensure option mapping display resolves nested option labels when needed
- keep mapping keys as `option.id`

### Add Service And Service Picker Surfaces

Observed files:

```txt
src/panels/right/partials/global/add-service.tsx
src/workspace/bottom-panel/services-split-pane.tsx
```

These already use treeselect patterns for service grouping in some places. They are relevant mostly because nested option authoring should feel consistent with existing tree selectors.

Recommended update:

- use treeselect only where nested choices are expected
- rely on `children` as the nested property
- keep selected values as raw ids

## Suggested Service-Builder Update Order

### Step 1. Update Dependencies

Update local dev dependencies after the engine package is published or linked:

```json
"@timeax/digital-service-engine": "<new-version>",
"@timeax/form-palette": "<version-with-treeselect-children-support>"
```

Then run:

```bash
npm install
npm run build
npm test
```

### Step 2. Add Local Recursive Option Helpers

Add small helpers in service-builder unless the engine exports equivalent helpers for this layer:

```ts
type OptionLocation = {
  field: Field;
  option: FieldOption;
  parentOption?: FieldOption;
  siblings: FieldOption[];
  index: number;
};

function walkFieldOptions(field: Field): Array<{
  field: Field;
  option: FieldOption;
  parentOption?: FieldOption;
  depth: number;
}> {}

function findOptionLocation(fields: Field[], optionId: string): OptionLocation | undefined {}

function mapOptionsRecursive(
  options: FieldOption[],
  mapper: (option: FieldOption) => FieldOption
): FieldOption[] {}
```

Use these anywhere service-builder currently does:

```ts
field.options?.find(...)
field.options?.some(...)
field.options?.map(...)
for (const option of field.options ?? [])
```

### Step 3. Wire Descriptor Child Capability

Update `descriptor-options.ts` so service-builder can distinguish:

- fields that support no options
- fields that support flat options
- fields that support nested child options

Only treeselect should enable nested option authoring by default.

### Step 4. Update Option Editing And Template Cloning

Make option property editing and template utilities recursive before enabling child-option UI.

This prevents a dangerous state where the UI can display nested options but cannot safely edit, clone, sanitize, or regenerate them.

### Step 5. Update Layers And Context Menus

Once recursive editing helpers exist:

- allow child option creation under option nodes only when supported
- update option move up/down to use the correct sibling list
- keep drag/drop ids as raw option ids
- avoid path ids entirely

### Step 6. Update Preview, Service Context, And Bottom Panel

These are runtime-read surfaces and should consume the engine's resolved visibility:

```ts
const visibility = builder.resolveVisibility(tagId, selectedOptionIds);
```

Use:

- `visibility.fieldIds`
- `visibility.optionsByFieldId`
- `visibility.forcedFieldIds`

Then recursively filter option trees before rendering or summarizing.

### Step 7. Add Authoring UI For `option_effects_for_buttons`

The engine supports option effects, but service-builder does not yet appear to have authoring UI for that map.

Recommended minimal authoring model:

- source: selected button field or option node id
- target field: field id
- force visible: boolean
- include options: treeselect/multiselect of target field option ids
- exclude options: treeselect/multiselect of target field option ids

Important:

- source keys are raw ids
- target option values are raw ids
- nested option choices should show hierarchy, but selection values remain option ids
- cleanup should remove empty target rules

## Tests To Add In Service-Builder

### Descriptor Capability Tests

- treeselect resolves with `options.children.supported === true`
- non-tree option inputs do not enable child option authoring
- field type/variant switching can auto-create top-level options without creating child options accidentally

### Recursive Option Editing Tests

- editing a nested option label updates the child only
- editing a nested option value updates the child only
- top-level sibling options are preserved
- child arrays are preserved

### Template Tests

- cloning a field regenerates ids for top-level and nested options
- cloned nested option ids are globally unique
- sanitized templates remove `service_id` from child options
- template relation maps use raw option ids only

### Layers And Context Menu Tests

- child option can be added only under treeselect-capable fields
- child option cannot be added under select/radio/toggle-group fields
- nested option move up/down uses sibling children, not top-level field options
- selected nested option id remains raw, for example `o:premium-fast`

### Service Context Tests

- nested option appears in button groups with its raw id
- selecting nested option survives sanitization if visible
- hidden nested option is pruned when engine visibility hides it
- nested option service id contributes to used services only when visible

### Bottom Panel Tests

- service attached to nested option appears in attached services
- active service state works when nested option is selected
- attached labels include enough context to distinguish nested options

### Snapshot/Wireframe Tests

- wireframe renders only allowed child options from `optionsByFieldId`
- forced field appears in preview when `forceVisible: true`
- hidden child selections do not appear in snapshot-derived UI

## Gotchas

### Do Not Use `fieldId::optionId`

This is the biggest compatibility risk.

Do not create, persist, or compare option ids like:

```ts
`${fieldId}::${optionId}`
```

If service-builder needs field ownership, resolve it from the option id using a recursive owner lookup.

### Do Not Treat Parent Option As Identity

Parent option id can be useful for:

- tree indentation
- breadcrumbs
- move/reorder sibling lookup
- "Add child option" UI

It should not be part of:

- selected keys
- trigger keys
- include/exclude keys
- option effect keys
- service map keys
- snapshot selected options

### Watch Top-Level Option Loops

Any loop like this is now suspicious:

```ts
for (const option of field.options ?? []) {
  // ...
}
```

It might still be correct for a top-level-only UI section, but runtime/service/validation/summary surfaces usually need recursive walking.

### Keep `children` As The Tree Property

The form-palette treeselect variant expects nested options under `children`.

Do not rename this to:

- `subOptions`
- `items`
- `nodes`
- `options`

## Acceptance Criteria For Service-Builder Migration

The service-builder update should be considered done when:

- treeselect fields can author child options under `children`
- non-treeselect option fields remain flat unless explicitly supported later
- every child option has its own globally unique `id`
- no service-builder code creates composite option ids
- nested option labels/values can be edited
- nested options can be cloned through templates with fresh ids
- nested options appear in layers/canvas as normal option nodes
- nested options can trigger includes/excludes and option effects by raw id
- service context and bottom panel include nested option services
- preview/wireframe filters hidden child options using engine visibility state
- tests prove raw id selection for nested options end to end

## Short Implementation Principle

Structure is recursive. Identity is flat.

Use `children` to render the tree. Use `option.id` for everything else.
