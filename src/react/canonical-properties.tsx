// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState, PropertyList, SelectionBadge } from '@/components/builder/index.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Section } from '@/panels/right/components/sections.tsx';
import { FieldLabel } from '@/panels/right/components/text.tsx';
import { DescriptorSettings } from '@/panels/right/partials/properties/components/descriptor-settings.tsx';
import type { DescriptorUiSchema } from '@/panels/right/partials/properties/components/descriptor-ui-schema.ts';
import { BUILT_IN_INPUT_TYPES } from '@elqora/dgp-ordering-form-palette';
import type { FieldOption, JsonPrimitive, JsonValue, ProductField } from '@elqora/dgp-spec';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { MdOutlineContentCopy } from 'react-icons/md';
import { CanonicalWorkspaceBootInlineNotice } from './canonical-boot-status';
import { canonicalInputRegistry } from './canonical-input-registry';
import { CanonicalAdvancedPropertySections } from './canonical-property-sections';
import { useServiceBuilderCanvasModel } from './presentation';
import { createCanonicalInspectorNode, type CanonicalInspectorNode } from './property-model';
import { useWorkspacePermission } from './workspace';

function parsePrimitive(value: unknown): JsonPrimitive | undefined {
    const text = String(value ?? '');
    if (!text.length) return undefined;
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return Number(text);
    return text;
}

function optionChoices(options: readonly FieldOption[] = [], prefix = ''): Array<{ label: string; value: string }> {
    return options.flatMap((option) => {
        const label = prefix ? `${prefix} / ${option.label}` : option.label;
        return [...(option.id ? [{ label, value: option.id }] : []), ...optionChoices(option.children, label)];
    });
}

function canonicalDescriptorUi(
    ui: Record<string, Record<string, unknown>> | undefined,
    inherited: Record<string, unknown>,
): Record<string, DescriptorUiSchema> {
    return Object.fromEntries(
        Object.entries(ui ?? {}).map(([key, value]) => {
            if (value.type !== 'any') return [key, value as unknown as DescriptorUiSchema];
            const defaultValue = inherited[key];
            const type = typeof defaultValue === 'boolean' ? 'boolean' : typeof defaultValue === 'number' ? 'number' : 'string';
            return [key, { ...value, type } as DescriptorUiSchema];
        }),
    );
}

function FilterProperties({ node, disabled }: { node: Extract<CanonicalInspectorNode, { kind: 'filter' }>; disabled: boolean }) {
    void node;
    void disabled;
    return null;
}

function FieldProperties({ node, disabled }: { node: Extract<CanonicalInspectorNode, { kind: 'field' }>; disabled: boolean }) {
    const canvas = useServiceBuilderCanvasModel();
    const field = node.raw;
    const descriptor = canonicalInputRegistry.resolve(field.type, field.variant);
    const variantEntries = field.type === 'checkbox' ? [{ label: 'Options', value: 'options' }] : [];
    const canEditVariant = variantEntries.length > 0 || Boolean(field.variant);
    const defaults = field.defaults ?? {};
    const choices = optionChoices(field.options);
    const selectedDefaults = Array.isArray(field.default_value)
        ? field.default_value.map(String)
        : field.default_value === undefined || field.default_value === null
          ? []
          : [String(field.default_value)];
    const descriptorUi = canonicalDescriptorUi(descriptor?.ui, descriptor?.default_props ?? {});
    const update = (patch: Partial<ProductField>) => canvas.editor?.update_field(node.id, patch);
    const updateDefaults = (next: Record<string, unknown> | undefined) => update({ defaults: next as ProductField['defaults'] });
    const updateGenericDefault = (key: string, value: unknown) => {
        const next = { ...defaults } as Record<string, JsonValue>;
        const normalized = String(value ?? '').trim();
        if (normalized) next[key] = normalized;
        else delete next[key];
        update({ defaults: Object.keys(next).length ? next : undefined });
    };
    return (
        <>
            <Section>
                <Section.Header>
                    <Section.Title>Field identity</Section.Title>
                </Section.Header>
                <Section.Content>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        Core field metadata used by the service engine and preview form.
                    </p>
                    <div className="space-y-3">
                        <InputField
                            variant="text"
                            label="Name"
                            disabled={disabled}
                            value={field.name ?? ''}
                            onChange={(event) => canvas.editor?.set_field_name(node.id, String(event.value ?? '') || undefined)}
                        />
                        <InputField
                            variant="select" autoCap
                            label="Type"
                            disabled={disabled}
                            value={field.type}
                            options={BUILT_IN_INPUT_TYPES.map((value) => ({ label: value.replaceAll('-', ' '), value }))}
                            onChange={(event) => update({ type: String(event.value ?? 'text') })}
                        />
                        {canEditVariant ? (
                            <InputField
                                variant="select" autoCap
                                label="Input variant"
                                disabled={disabled}
                                value={field.variant ?? 'default'}
                                options={[{ label: 'Default', value: 'default' }, ...variantEntries]}
                                onChange={(event) =>
                                    update({ variant: String(event.value ?? 'default') === 'default' ? undefined : String(event.value) })
                                }
                            />
                        ) : null}
                        <InputField
                            variant="toggle"
                            label="Required"
                            disabled={disabled}
                            value={Boolean(field.required)}
                            onChange={(event) => update({ required: Boolean(event.value) })}
                        />
                        <InputField
                            variant="toggle"
                            label="Button mode"
                            disabled={disabled}
                            value={field.button === true}
                            onChange={(event) => update({ button: Boolean(event.value) } as Partial<ProductField>)}
                        />
                        {field.options?.length ? (
                            <InputField
                                variant="toggle"
                                label="Is multiple"
                                disabled={disabled || Boolean(descriptor)}
                                value={descriptor?.multi_capability?.auto_enable ?? Boolean(field.multiple)}
                                onChange={(event) => canvas.editor?.set_field_multiple(node.id, Boolean(event.value))}
                            />
                        ) : null}
                    </div>
                </Section.Content>
            </Section>
            <Separator />
            <Section>
                <Section.Header>
                    <Section.Title>Order default value</Section.Title>
                </Section.Header>
                <Section.Content>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        Initial value for a new order. Input appearance props remain in field defaults below.
                    </p>
                    {choices.length && field.multiple ? (
                        <InputField
                            variant="checkbox"
                            label="Default value"
                            disabled={disabled}
                            value={selectedDefaults}
                            options={choices as never}
                            onChange={(event) => canvas.editor?.set_field_default(node.id, (event.value as JsonValue) || undefined)}
                        />
                    ) : choices.length ? (
                        <InputField
                            variant="select" autoCap
                            label="Default value"
                            disabled={disabled}
                            value={selectedDefaults[0] || undefined}
                            placeholder="None"
                            options={choices as never}
                            onChange={(event) =>
                                canvas.editor?.set_field_default(node.id, (String(event.value ?? '') || undefined) as JsonValue | undefined)
                            }
                        />
                    ) : (
                        <div className="space-y-2">
                            <InputField
                                variant="text"
                                label="Default value"
                                disabled={disabled}
                                value={String(field.default_value ?? '')}
                                onChange={(event) => canvas.editor?.set_field_default(node.id, parsePrimitive(event.value) as JsonValue | undefined)}
                            />
                            {field.default_value !== undefined ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={disabled}
                                    onClick={() => canvas.editor?.set_field_default(node.id, undefined)}
                                >
                                    Clear
                                </Button>
                            ) : null}
                        </div>
                    )}
                </Section.Content>
            </Section>
            <Separator />
            <Section>
                <Section.Header>
                    <Section.Title>Defaults and help</Section.Title>
                </Section.Header>
                <Section.Content>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Preview-oriented defaults passed to the form palette.</p>
                    <div className="space-y-3">
                        <InputField
                            variant="text"
                            label="Placeholder"
                            disabled={disabled}
                            value={String(defaults.placeholder ?? '')}
                            onChange={(event) => updateGenericDefault('placeholder', event.value)}
                        />
                        <InputField
                            variant="textarea"
                            label="Help text"
                            disabled={disabled}
                            value={String(defaults.helpText ?? '')}
                            onChange={(event) => updateGenericDefault('helpText', event.value)}
                        />
                    </div>
                </Section.Content>
            </Section>
            <Separator />
            <Section defaultOpen={false}>
                <Section.Header>
                    <Section.Title>Input appearance and behavior</Section.Title>
                </Section.Header>
                <Section.Content>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        Descriptor-owned runtime props. The schema comes from the input registry and overrides are stored in field defaults.
                    </p>
                    {descriptor ? (
                        <DescriptorSettings
                            schema={descriptorUi}
                            defaults={defaults}
                            inheritedDefaults={descriptor.default_props}
                            onChange={updateDefaults}
                        />
                    ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            No input descriptor was found for this field type{field.variant ? ` / ${field.variant}` : ''}.
                        </p>
                    )}
                </Section.Content>
            </Section>
        </>
    );
}

function OptionProperties({ node, disabled }: { node: Extract<CanonicalInspectorNode, { kind: 'option' }>; disabled: boolean }) {
    const canvas = useServiceBuilderCanvasModel();
    return (
        <Section>
            <Section.Header>
                <Section.Title>Option identity</Section.Title>
            </Section.Header>
            <Section.Content>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Edit the currently focused option node.</p>
                <div className="space-y-3">
                    <InputField
                        variant="text"
                        label="Label"
                        disabled={disabled}
                        value={node.raw.label}
                        onChange={(event) => canvas.editor?.update_option(node.id, { label: String(event.value ?? '') })}
                    />
                    <InputField
                        variant="text"
                        label="Value"
                        disabled={disabled}
                        value={String(node.raw.value ?? '')}
                        onChange={(event) => canvas.editor?.update_option(node.id, { value: parsePrimitive(event.value) })}
                    />
                </div>
            </Section.Content>
        </Section>
    );
}

export function CanonicalProperties() {
    const canvas = useServiceBuilderCanvasModel();
    const canMutate = useWorkspacePermission('document.mutate');
    const mutationDeniedReason = canMutate ? undefined : 'You do not have permission to edit this definition.';
    const node = useMemo(() => createCanonicalInspectorNode(canvas.definition, canvas.active_id), [canvas.active_id, canvas.definition]);
    const selectedNodeId = node.kind === 'none' ? '' : node.id;
    const selectedRawLabel = node.kind === 'none' ? '' : node.raw.label;
    const [copying, setCopying] = useState(false);
    const lastLoadedLabelByNodeId = useRef<Record<string, string>>({});
    const labelDraftNodeId = useRef('');
    const isEditingLabel = useRef(false);
    const [labelDraft, setLabelDraft] = useState(selectedRawLabel || selectedNodeId);

    useEffect(() => {
        if (selectedNodeId && selectedRawLabel.trim()) lastLoadedLabelByNodeId.current[selectedNodeId] = selectedRawLabel;
    }, [selectedNodeId, selectedRawLabel]);
    useEffect(() => {
        if (!selectedNodeId) {
            setLabelDraft('');
            labelDraftNodeId.current = '';
            return;
        }
        const loaded = selectedRawLabel.trim() ? selectedRawLabel : (lastLoadedLabelByNodeId.current[selectedNodeId] ?? selectedNodeId);
        if (labelDraftNodeId.current !== selectedNodeId || !isEditingLabel.current) setLabelDraft(loaded);
        labelDraftNodeId.current = selectedNodeId;
    }, [selectedNodeId, selectedRawLabel]);
    const resetEmptyLabelDraft = () => {
        if (!selectedNodeId || labelDraft.trim()) return;
        setLabelDraft(selectedRawLabel.trim() ? selectedRawLabel : (lastLoadedLabelByNodeId.current[selectedNodeId] ?? selectedNodeId));
    };

    if (node.kind === 'none')
        return (
            <div className="p-4">
                <EmptyState
                    title="No active node selected"
                    description="Pick a tag, field, or option from the layers panel or canvas to inspect its core settings."
                />
            </div>
        );

    return (
        <div className="flex h-full flex-col overflow-hidden" title={mutationDeniedReason}>
            <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-4 px-4 py-4">
                    <CanonicalWorkspaceBootInlineNotice sections={['snapshot', 'policies']} />
                    <Section>
                        <Section.Header>
                            <Section.Title>Selection overview</Section.Title>
                        </Section.Header>
                        <Section.Content>
                            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                                The inspector stays synced with the active canvas and layers selection.
                            </p>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 capitalize dark:text-slate-100">
                                        {node.kind === 'filter' ? 'tag' : node.kind}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{node.summary}</p>
                                </div>
                                <SelectionBadge active selected />
                            </div>
                            <div className="mt-3 space-y-3">
                                <InputField
                                    variant="text"
                                    label={<FieldLabel>Label</FieldLabel>}
                                    disabled={!canMutate}
                                    value={labelDraft}
                                    onFocus={() => {
                                        isEditingLabel.current = true;
                                    }}
                                    onChange={(event) => {
                                        const next = String(event.value ?? '');
                                        setLabelDraft(next);
                                        if (next.trim()) canvas.editor?.relabel(node.id, next);
                                    }}
                                    onBlur={() => {
                                        isEditingLabel.current = false;
                                        resetEmptyLabelDraft();
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'Enter') return;
                                        event.preventDefault();
                                        isEditingLabel.current = false;
                                        resetEmptyLabelDraft();
                                        event.currentTarget.blur();
                                    }}
                                    placeholder={`Enter ${node.kind === 'filter' ? 'tag' : node.kind} display label`}
                                />
                                <InputField
                                    variant="text"
                                    label={<FieldLabel>ID</FieldLabel>}
                                    disabled
                                    value={node.id}
                                    extendBoxToControls
                                    joinControls
                                    trailingControl={
                                        <span
                                            className="cursor-pointer px-2"
                                            onClick={() => {
                                                setCopying(true);
                                                navigator.clipboard.writeText(node.id).finally(() => setCopying(false));
                                            }}
                                        >
                                            {copying ? (
                                                <AiOutlineLoading3Quarters className="animate-spin text-lg" />
                                            ) : (
                                                <MdOutlineContentCopy className="text-sm text-muted-foreground" />
                                            )}
                                        </span>
                                    }
                                    placeholder={`${node.kind} id`}
                                />
                            </div>
                            <PropertyList
                                className="mt-3"
                                items={[
                                    { label: 'Binding', value: node.binding },
                                    { label: 'Selection size', value: String(canvas.selection.ids.length) },
                                ]}
                            />
                        </Section.Content>
                    </Section>
                    <Separator />
                    {node.kind === 'filter' ? (
                        <FilterProperties node={node} disabled={!canMutate} />
                    ) : node.kind === 'field' ? (
                        <FieldProperties node={node} disabled={!canMutate} />
                    ) : (
                        <OptionProperties node={node} disabled={!canMutate} />
                    )}
                    <CanonicalAdvancedPropertySections node={node} disabled={!canMutate} />
                </div>
            </ScrollArea>
        </div>
    );
}
