# Service Builder AI generation guide

This file is the stable, provider-neutral reference for AI-assisted authoring in Service Builder. It explains the canonical data contracts and the Builder behavior an AI must respect. Host-specific data and the user's request are supplied separately for each generation request; they do not belong in this file.

The contracts below are transcribed from the currently installed `@elqora/dgp-spec`, `@elqora/dgp-workspace`, and `@elqora/dgp-validation` declarations. Keep them aligned with those package declarations when dependencies change. The available input list and wrapper behavior are from the currently installed `@elqora/dgp-ordering-form-palette` package and this Service Builder's current registry wiring.

## Authoritative type exports

The names in this guide refer to these public package exports. The TypeScript blocks below expand their dependencies for AI context; the packages remain the source of truth for application code and validation.

```ts
import type {
    ProductDefinition,
    OrderSnapshot,
    HandlerService,
} from "@elqora/dgp-spec";
import type {
    ServiceCatalogState,
    FieldTemplate,
} from "@elqora/dgp-workspace";
import type {
    ServicePublicationPolicyRule,
} from "@elqora/dgp-validation";
import { BUILT_IN_INPUT_TYPES } from "@elqora/dgp-ordering-form-palette";
```

`ProductDefinition`, `OrderSnapshot`, and `HandlerService` are defined by DGP Spec. The catalog and field-template shapes are Workspace editorial contracts. Service publication policy rules are defined by DGP Validation. The input list is an adapter registry constant, not a field of any of these data contracts.

This copy was checked against installed `@elqora/dgp-spec` 1.4.0, `@elqora/dgp-workspace` 1.0.2-validation.0, `@elqora/dgp-validation` 1.2.0, and `@elqora/dgp-ordering-form-palette` 1.0.2-validation.0. When any of those packages change, recheck both the copied declarations and the behavior notes before using this guide as AI context.

## Instructions to the generation model

- Treat this guide as the static contract. Treat the request payload as the authority for the current definition, services, catalog, templates, policies, and host capabilities.
- Generate only the artifact or artifacts requested by the user: a canonical `ProductDefinition`, a `ServiceCatalogState`, or service publication policy rules. Use the complete contract for the requested artifact.
- Return valid JSON for the requested artifact, without Markdown fences or explanatory text. Do not invent a combined envelope unless the caller's request contract explicitly defines one.
- Preserve existing IDs and relationships when editing supplied data unless the user asks to replace or remove them. Create IDs only where the requested artifact requires them and no ID is supplied.
- Use only supplied `HandlerService` IDs and facts. Never invent or change handler rates, capabilities, state, quantity bounds, service metadata, or existing template content. Create new policy rules only from the user's requested policy intent and the supported policy contract; do not present invented policy requirements as host facts.
- Handler service rates, browser utility calculations, quantities, and preview amounts are not authoritative final prices or charges. The handler remains authoritative for submitted-input validation and fulfillment.
- Use canonical DGP v1 names and shapes exactly. Do not emit legacy aliases, camelCase wire fields, `flags`, `estimates`, legacy wrappers, or fields absent from the relevant contract.
- For product fields, use input types present in the supplied registry capability data. If no registry manifest is supplied, use the built-in type list below, which describes this Service Builder's current default registry.
- Put Form Palette input configuration in a field's `defaults` only when the requested input descriptor supports those properties. Do not put renderer/component identifiers in `ProductDefinition`.
- Use host templates only when the needed context exists. Do not assume `snapshot` or custom host values are available merely because the template syntax can address them.
- For policy generation, use the supplied policy rules and policy requirements as context. Do not put host publication policy rules inside `ProductDefinition`.

## Generation tasks

### Product definitions

Create or update the canonical DGP v1 `ProductDefinition` contract below. `filters` describe service contexts; `fields` describe authored customer choices. Preserve recursive options, service bindings, relationships, validation, quantity rules, utility declarations, notices, and fallbacks as requested. Use explicit capability requirements on filters when needed; do not encode derived/inherited capability state into the authored document.

Use `meta` only for opaque host metadata. Do not hide protocol meaning such as quantity defaults, utility definitions, input variants, multiple selection, or capability requirements in `meta`.

For `BrowserJavaScriptExpression`, use only trusted host-authored JavaScript function bodies when the user explicitly requests an expression. Expressions receive only the current field's `value` and `values`, not unrelated field values. Quantity expressions must return a finite number; customer-field expressions must return a JSON-compatible value. Do not generate arbitrary executable expressions as a substitute for declarative rules.

### Service catalogs

Create or update `ServiceCatalogState` using the supplied handler services. Explicit groups list service IDs. Smart groups use supported rule variants and may only resolve against supplied services. Keep every referenced service ID valid. Do not add service facts or change handler-owned service records.

### Service publication policies

Create or update a `ServicePublicationPolicyRule[]` using the supplied rule set and host policy intent. Policies are host configuration compiled by DGP Validation; they are not part of `ProductDefinition`. Use the supported scopes, filter properties, operators, and severities in the contract. `projection` and `where.path` are strings; their useful paths depend on the host's service data and policy requirements, so do not guess them from the TypeScript shape alone.

## Data supplied at generation time

The caller should send the live data needed for the requested task, as structured JSON:

- Current `ProductDefinition` and current `ServiceCatalogState`, when available.
- Current `HandlerService[]`.
- Current `FieldTemplate[]` and the registered input/variant/property capabilities available to this Builder host.
- Current `ServicePublicationPolicyRule[]` and the host's policy requirements.
- Any `OrderSnapshot` or custom template-context values the host actually has and intends the model to use.
- The user's request and any explicit keep/change/remove constraints.

If a context item is absent, do not invent it. The canonical types in this file describe valid shapes; they are not a substitute for the host's live values.

## Current input types and field properties

The current default Form Palette registry supports these field `type` values:

```text
text, textarea, number, password, phone, date, color,
checkbox, toggle, toggle-group, radio, select, multiselect,
treeselect, chips, slider, file, editor, json-editor,
keyvalue, lister, icon, image-icon
```

The host may register additional types or variants. The canonical `variant` selects an authoring descriptor; the ordering registry may fall back to that type's default variant when a requested variant is unavailable. Service Builder's authoring adapter requires an explicitly requested non-default variant to resolve exactly. Form Palette has its own renderer variant, but that is adapter configuration, not a `ProductDefinition` field.

`ProductField.defaults` contains JSON-compatible input properties for the resolved descriptor. The supported property keys and value choices are descriptor-specific. Use a runtime-supplied descriptor/property manifest when available; do not assume every input accepts every property. The Builder's registry also declares whether an input supports options, recursive options, and multiple selection. Set `multiple: true` only when the resolved descriptor supports it; the `ProductDefinition` type alone cannot guarantee that registry capability.

## Wrapper templates and variables

The Form Palette wrapper interpolates `{...}` expressions recursively in strings inside descriptor defaults and host `extra_props`. A path expression such as `{code}` resolves the `code` property from the merged template context. Nested properties use dot paths, such as `{snapshot.quantity}`. Values are rendered as strings; object values are serialized as JSON. Missing or blocked paths render as an empty string.

The interpolation syntax supports literal values and simple fallbacks with `??` or `||`, for example `{value ?? "fallback"}`. It is safe path lookup and literal handling, not general JavaScript execution. Do not use it as if it supported arbitrary expressions, function calls, or a full template language.

The wrapper context includes the current `field`, `definition`, ordering session context as `ordering`, `state`, `value`, and `error`. When the provider enables snapshot construction, `snapshot_result` describes its result and `snapshot` contains a successfully built `OrderSnapshot` when one exists. Provider-level and input-level custom `template_context` values can add host properties. Standard wrapper values are then applied and take precedence over same-named custom values.

`OrderSnapshot` is exposed to templates only when the host enables snapshot construction and a valid snapshot can be built. It is absent while the relevant ordering input is invalid. In the current Service Builder wireframe, the provider receives the session, definition, and registry, but no `snapshot_options` or custom `template_context`; therefore snapshot and custom host variables are not currently available there. Do not generate a field default that depends on them unless the target host context explicitly enables and supplies them.

## Canonical TypeScript contracts

These are the complete public contract families relevant to generation. Imports are expanded so the declarations can be read together.

TypeScript declarations do not express every wire constraint. In particular, `Integer` means a JSON integer even though its TypeScript representation is `number`; `BrowserJavaScriptExpression.body` must be nonempty; and `OrderSnapshot.built_at` and `ProductNotice.marked_at` use date-time strings. Generated JSON must also satisfy the canonical package schemas and validation behavior.

### JSON and expression contracts

```ts
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export declare const BROWSER_JAVASCRIPT_EXPRESSION_ARGUMENTS: readonly ["value", "values"];
export interface BrowserJavaScriptExpression {
    language: "javascript";
    body: string;
}
export interface BrowserJavaScriptExpressionInput {
    value: JsonValue;
    values: JsonValue[];
}
export type QuantityExpressionResult = number;
export type CustomerFieldExpressionResult = JsonValue;
export declare const EXPRESSION_FAILURE_CODES: readonly [
    "expression_source_missing",
    "expression_execution_failed",
    "expression_result_invalid"
];
export type ExpressionFailureCode = (typeof EXPRESSION_FAILURE_CODES)[number];
export interface ExpressionHostConfigurationFailure {
    kind: "host_configuration";
    code: ExpressionFailureCode;
    path: string;
    message: string;
    meta: Record<string, any>;
}
```

### Handler services

```ts
export type Integer = number;
export type ServiceId = string | Integer;
export declare const HANDLER_SERVICE_STATES: readonly ["enabled", "disabled", "locked"];
export type HandlerServiceState = (typeof HANDLER_SERVICE_STATES)[number];
export interface ServiceCapability {
    id: string;
    enabled: boolean;
    description: string | null;
    meta: Record<string, any>;
}
export type ServiceCapabilities = Record<string, ServiceCapability>;
export interface HandlerService {
    id: ServiceId;
    name: string;
    description: string | null;
    category: string | null;
    rate: number | null;
    min: Integer;
    max: Integer;
    capabilities: ServiceCapabilities;
    meta: Record<string, any>;
    state: HandlerServiceState;
    state_reason: string | null;
}
```

### Product definitions

```ts
export declare const PRODUCT_DEFINITION_SCHEMA_VERSION: "1";
export type ProductDefinitionSchemaVersion = typeof PRODUCT_DEFINITION_SCHEMA_VERSION;
export type PricingRole = "base" | "utility";
export type CapabilityRequirements = Record<string, boolean>;
export interface QuantityClamp {
    min?: number;
    max?: number;
}
interface QuantityRuleTransforms {
    multiply?: number;
    clamp?: QuantityClamp;
    fallback?: number;
}
export type QuantityRule = (QuantityRuleTransforms & {
    value_by: "value" | "length";
}) | (QuantityRuleTransforms & {
    value_by: "eval";
    expression: BrowserJavaScriptExpression;
});
export type UtilityMode = "flat" | "per_quantity" | "per_value" | "percent";
export interface UtilityDefinition {
    rate: number;
    mode: UtilityMode;
    value_by?: "value" | "length";
    percent_base?: "service_total" | "base_service" | "all";
    label?: string;
}
export type FieldValidationValueBy = "value" | "length" | "eval";
export type FieldValidationErrorMessageOn = "submit" | "change";
export type FieldValidationOperator =
    | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between"
    | "in" | "nin" | "truthy" | "falsy" | "match";
interface FieldValidationRuleBase {
    op: FieldValidationOperator;
    value?: JsonValue;
    min?: number;
    max?: number;
    values?: JsonValue[];
    pattern?: string;
    pattern_flags?: string;
    code?: string;
    message?: string;
    error_message_on?: FieldValidationErrorMessageOn;
}
export type FieldValidationRule = (FieldValidationRuleBase & {
    value_by?: "value" | "length";
}) | (FieldValidationRuleBase & {
    value_by: "eval";
    expression: BrowserJavaScriptExpression;
});
export interface FieldOption {
    id: string;
    label: string;
    value?: JsonPrimitive;
    service_id?: ServiceId;
    pricing_role?: PricingRole;
    quantity_default?: number;
    utility?: UtilityDefinition;
    meta?: Record<string, any>;
    children?: FieldOption[];
}
interface ProductFieldBase {
    id: string;
    type: string;
    variant?: string;
    label: string;
    bind_id?: string | string[];
    name?: string;
    required?: boolean;
    multiple?: boolean;
    default_value?: JsonValue;
    defaults?: Record<string, JsonValue>;
    options?: FieldOption[];
    description?: string;
    pricing_role?: PricingRole;
    validation?: FieldValidationRule[];
    quantity_default?: number;
    quantity?: QuantityRule;
    utility?: UtilityDefinition;
    meta?: Record<string, any>;
}
export type ProductField = ProductFieldBase & (
    { button?: false } | { button: true; service_id?: ServiceId }
);
export interface ProductFilter {
    id: string;
    label: string;
    bind_id?: string;
    service_id?: ServiceId;
    includes?: string[];
    excludes?: string[];
    capabilities?: CapabilityRequirements;
    quantity_default?: number;
    meta?: Record<string, any>;
}
export interface OptionEffectForButton {
    force_visible?: boolean;
    include?: string[];
    exclude?: string[];
}
export interface FieldValueEffect {
    value: JsonValue;
    mode?: "always" | "if_empty";
    clear_on_deactivate?: boolean;
}
export interface ServiceFallbacks {
    nodes?: Record<string, ServiceId[]>;
    global?: Record<string, ServiceId[]>;
}
export type ProductNoticeType = "public" | "private";
export type ProductNoticeSeverity = "info" | "warning" | "error";
export type ProductNoticeKind = "label" | "warning" | "deprecation" | "compat" | "migration" | "policy";
export type ProductNoticeTarget =
    | { scope: "global" }
    | { scope: "node"; node_kind: "tag" | "field" | "option"; node_id: string };
export interface ProductNotice {
    id: string;
    type: ProductNoticeType;
    kind: ProductNoticeKind;
    severity: ProductNoticeSeverity;
    target: ProductNoticeTarget;
    title: string;
    description?: string;
    reason?: string;
    marked_at?: string;
    meta?: Record<string, any>;
}
export interface ProductDefinition {
    id: string | Integer;
    name: string;
    filters: ProductFilter[];
    fields: ProductField[];
    order_for_tags: Record<string, string[]>;
    includes_for_buttons: Record<string, string[]>;
    excludes_for_buttons: Record<string, string[]>;
    option_effects_for_buttons: Record<string, Record<string, OptionEffectForButton>>;
    value_effects_for_triggers: Record<string, Record<string, FieldValueEffect>>;
    schema_version: ProductDefinitionSchemaVersion;
    fallbacks: ServiceFallbacks | null;
    description: string | null;
    notices: ProductNotice[];
    meta: Record<string, any>;
}
```

### Order snapshots

```ts
export declare const ORDER_SNAPSHOT_VERSION: "1";
export type OrderSnapshotVersion = typeof ORDER_SNAPSHOT_VERSION;
export type OrderSnapshotMode = "prod" | "dev";
export interface OrderSnapshotFieldSelection {
    field_id: string;
    field_type: string;
    selected_option_ids: string[];
}
export interface OrderSnapshotSelection {
    filter_id: string;
    trigger_ids: string[];
    fields: OrderSnapshotFieldSelection[];
}
export interface OrderSnapshotInputs {
    form: Record<string, JsonValue>;
    selections: Record<string, string[]>;
}
export type OrderSnapshotQuantitySource =
    | { kind: "field_rule"; node_id: string; rule: QuantityRule; defaulted_from_host: false }
    | {
        kind: "option_default" | "field_default" | "filter_default";
        node_id: string;
        rule: null;
        defaulted_from_host: false;
    }
    | { kind: "host_default"; node_id: null; rule: null; defaulted_from_host: true };
export interface OrderSnapshotUtilityInputs {
    quantity: number;
    value: number | null;
    value_by: "value" | "length" | null;
    base_amount: number | null;
}
export interface OrderSnapshotUtility {
    node_id: string;
    mode: UtilityMode;
    rate: number;
    percent_base: "service_total" | "base_service" | "all" | null;
    label: string | null;
    inputs: OrderSnapshotUtilityInputs;
    advisory_amount: number;
}
export interface OrderSnapshot {
    version: OrderSnapshotVersion;
    mode: OrderSnapshotMode;
    built_at: string;
    product_id: string | Integer;
    definition_schema_version: ProductDefinitionSchemaVersion;
    selection: OrderSnapshotSelection;
    inputs: OrderSnapshotInputs;
    quantity: number;
    quantity_source: OrderSnapshotQuantitySource;
    min: Integer;
    max: Integer;
    service_ids: ServiceId[];
    service_ids_by_node: Record<string, ServiceId[]>;
    fallbacks: ServiceFallbacks | null;
    utilities: OrderSnapshotUtility[];
    meta: Record<string, any>;
}
```

An `OrderSnapshot` is evidence of the customer-visible ordering decision, not a price or fulfillment authority. `advisory_amount` is a browser calculation; handlers determine actual charges. Canonical v1 wire names are snake_case and do not accept legacy camelCase aliases.

### Service catalog state

```ts
interface CatalogNodeBase {
    id: string;
    label: string;
    parent_id?: string;
    description?: string;
    collapsed?: boolean;
    order?: number;
    color?: string;
    icon?: string;
    meta: Record<string, unknown>;
}
export interface CatalogGroup extends CatalogNodeBase {
    kind: "group";
    service_ids: ServiceId[];
}
export type CatalogSmartRule =
    | { type: "service_field"; field: string; op: string; value?: JsonValue }
    | { type: "policy_family"; key: string; value?: JsonValue }
    | { type: "compatibility"; scope: string; target_id: string; mode?: string }
    | { type: "capability"; capability: string; enabled?: boolean }
    | { type: "state"; state: HandlerService["state"] };
export interface CatalogSmartGroup extends CatalogNodeBase {
    kind: "smart";
    match: "all" | "any";
    rules: CatalogSmartRule[];
    resolved_service_ids: ServiceId[];
    resolved_at?: number;
}
export type CatalogNode = CatalogGroup | CatalogSmartGroup;
export interface ServiceCatalogState {
    version: 1;
    nodes: CatalogNode[];
    active_node_id?: string;
    expanded_ids: string[];
    pinned_node_ids: string[];
    selected_service_id?: ServiceId;
    view_mode: "all" | "grouped" | "assigned";
}
```

### Field templates

```ts
export interface FieldTemplate {
    id: string;
    key: string;
    name: string;
    group_label?: string;
    field: ProductField;
    connected_fields?: ProductField[];
    relationships?: Pick<
        ProductDefinition,
        | "includes_for_buttons"
        | "excludes_for_buttons"
        | "option_effects_for_buttons"
        | "value_effects_for_triggers"
    >;
    notices?: ProductNotice[];
    fallbacks?: Pick<ServiceFallbacks, "nodes">;
    branch_id: string | null;
    published: boolean;
    updated_at: string;
    meta: Record<string, unknown>;
}
```

Templates are host-supplied reusable field data, not input types. Their availability and contents must come from the current host request. The host may supply connected fields, relationships, notices, and node fallbacks along with the root field.

### Service publication policy rules

```ts
export type ServicePolicyScope = "global" | "visible_group";
export type ServicePolicyRole = "base" | "utility" | "both";
export type ServicePolicyOperator =
    | "all_equal" | "no_mix" | "unique" | "all_true" | "any_true"
    | "max_count" | "min_count";
export type ServicePolicyWhereOperator =
    | "eq" | "neq" | "in" | "nin" | "exists" | "truthy" | "falsy";
export interface ServicePolicyWhereClause {
    path: string;
    op?: ServicePolicyWhereOperator;
    value?: unknown;
}
export interface ServicePublicationPolicyRule {
    id: string;
    label: string;
    scope: ServicePolicyScope;
    subject: "services";
    filter: {
        role: ServicePolicyRole;
        filter_id?: string[];
        field_id?: string[];
        where?: ServicePolicyWhereClause[];
    };
    projection: string;
    op: ServicePolicyOperator;
    value?: number;
    severity: "error" | "warning";
    message?: string;
}
```

## Contract boundaries to preserve

- `ProductDefinition` is the canonical authored product document. Workspace/editorial state such as canvas positions and catalog state is stored separately by DGP Workspace.
- Catalog rates, quantity bounds, and calculated utility amounts are advisory in browser consumers. They do not define final charges.
- `OrderSnapshot` contains customer selections, inputs, quantity provenance, service IDs, fallback evidence, utility calculation evidence, and host metadata. It does not contain editorial diagnostics.
- Host publication policies are separate JSON host configuration, validated and adapted by DGP Validation.
- The live host remains authoritative for registered input descriptors, templates, services, policies, and any extra variable context.
