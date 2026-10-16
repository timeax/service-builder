// SPDX-License-Identifier: GPL-3.0-only
import { Separator } from '@/components/ui/separator.tsx';
import { PropertyList } from '@/components/builder/index.tsx';
import { ServiceMetaPopover } from '@/components/service-meta-popover.tsx';
import { cn } from '@/lib/utils.ts';
import { RenderIf } from '@/panels/right/components/renderif.tsx';
import { IncludesItem, IncludesItemMissing, IncludesList, Section, SectionActionButton, SectionActionTriggerButton } from '@/panels/right/components/sections.tsx';
import { AddIncludesPopover } from '@/panels/right/partials/properties/components/AddIncludesPopover.tsx';
import ValidationRulesSection from '@/panels/right/partials/properties/components/validation-section.tsx';
import { Label } from '@/panels/right/components/text.tsx';
import { AddConstraintsPopover } from '@/panels/right/partials/properties/tag/AddConstraintsPopover.tsx';
import { ConstraintOriginPopover } from '@/panels/right/partials/properties/tag/ConstraintOriginPopover.tsx';
import { ConstraintOverridePopover } from '@/panels/right/partials/properties/tag/ConstraintOverridePopover.tsx';
import type { FieldOption, FieldValidationRule as CanonicalValidationRule, FieldValueEffect, QuantityRule, UtilityDefinition } from '@elqora/dgp-spec';
import { InputField } from '@timeax/form-palette';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BsPatchPlus, BsPencil, BsPlus } from 'react-icons/bs';
import { MdDeleteOutline, MdOutlineRemoveCircleOutline } from 'react-icons/md';
import { TiDelete } from 'react-icons/ti';
import { ArrowUpRight } from 'lucide-react';
import { useServiceBuilderCanvasModel } from './presentation';
import { CanonicalServicePicker } from './canonical-service-picker';
import type { CanonicalInspectorNode } from './property-model';
import { useWorkspaceSelector } from './workspace';

const numberOrUndefined = (value: unknown) => (value === '' || value === null || value === undefined ? undefined : Number(value));
const hasOption = (options: readonly FieldOption[] | undefined, id: string): boolean =>
    (options ?? []).some((option) => option.id === id || hasOption(option.children, id));

type OptionChoice = { label: string; value: string; description?: string };
const fieldOptionChoices = (options: readonly FieldOption[] | undefined, prefix = ''): OptionChoice[] =>
    (options ?? []).flatMap((option) => {
        const label = prefix ? `${prefix} / ${option.label}` : option.label;
        return [...(option.id ? [{ label, value: option.id }] : []), ...fieldOptionChoices(option.children, label)];
    });

const selectedValues = (value: unknown): string[] => Array.isArray(value) ? value.map(String).filter(Boolean) : value ? [String(value)] : [];

const toValidationEditorRule = (rule: CanonicalValidationRule) => ({
    op: rule.op,
    ...(rule.value_by === undefined ? {} : { valueBy: rule.value_by }),
    ...(rule.value === undefined ? {} : { value: rule.value }),
    ...(rule.min === undefined ? {} : { min: rule.min }),
    ...(rule.max === undefined ? {} : { max: rule.max }),
    ...(rule.values === undefined ? {} : { values: rule.values }),
    ...(rule.pattern === undefined ? {} : { pattern: rule.pattern }),
    ...(rule.pattern_flags === undefined ? {} : { flags: rule.pattern_flags }),
    ...(rule.code === undefined ? {} : { code: rule.code }),
    ...(rule.value_by === 'eval' ? { expressionBody: rule.expression.body } : {}),
    ...(rule.message === undefined ? {} : { message: rule.message }),
});

const fromValidationEditorRule = (rule: ReturnType<typeof toValidationEditorRule>): CanonicalValidationRule => {
    const base = {
        op: rule.op,
        ...(rule.value === undefined ? {} : { value: rule.value }),
        ...(rule.min === undefined ? {} : { min: rule.min }),
        ...(rule.max === undefined ? {} : { max: rule.max }),
        ...(rule.values === undefined ? {} : { values: rule.values }),
        ...(rule.pattern === undefined ? {} : { pattern: rule.pattern }),
        ...(rule.flags === undefined ? {} : { pattern_flags: rule.flags }),
        ...(rule.code === undefined ? {} : { code: rule.code }),
        ...(rule.message === undefined ? {} : { message: rule.message }),
    };
    if (rule.valueBy === 'eval') {
        return { ...base, value_by: 'eval', expression: { language: 'javascript', body: rule.expressionBody ?? '' } };
    }
    return { ...base, ...(rule.valueBy === 'length' ? { value_by: 'length' as const } : {}) };
};

function PropertySection({ title, description, children, actions }: { title: string; description: string; children: ReactNode; actions?: ReactNode }) {
    return (
        <>
            <Separator />
            <Section defaultOpen={false}>
                <Section.Header>
                    <Section.Title>{title}</Section.Title>
                    {actions ? <Section.Actions>{actions}</Section.Actions> : null}
                </Section.Header>
                <Section.Content>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                    <div className="space-y-3">{children}</div>
                </Section.Content>
            </Section>
        </>
    );
}

function ConstraintsSection({ node, disabled }: { node: Extract<CanonicalInspectorNode, { kind: 'filter' }>; disabled: boolean }) {
    const canvas = useServiceBuilderCanvasModel();
    const services = useWorkspaceSelector((state) => state.services);
    const [open, setOpen] = useState(false);
    const resolved = canvas.editor?.resolved_capabilities(node.id);
    const local = node.raw.capabilities ?? {};
    const constraints = [...new Set([...Object.keys(resolved?.values ?? {}), ...Object.keys(local)])].sort();
    const allConstraints = useMemo(() => {
        const byId = new Map<string, { label: string; value: string; description?: string }>();
        for (const service of services) {
            for (const capability of Object.values(service.capabilities)) {
                if (!byId.has(capability.id)) {
                    byId.set(capability.id, {
                        label: capability.id.replaceAll(/[-_]/g, ' '),
                        value: capability.id,
                        ...(capability.description ? { description: capability.description } : {}),
                    });
                }
            }
        }
        for (const id of constraints) if (!byId.has(id)) byId.set(id, { label: id.replaceAll(/[-_]/g, ' '), value: id });
        return [...byId.values()].sort((left, right) => left.label.localeCompare(right.label));
    }, [constraints, services]);
    return (
        <Section>
            <Section.Header>
                <Section.Title>Constraints</Section.Title>
                <Section.Actions>
                    {!disabled ? (
                        <AddConstraintsPopover
                            open={open}
                            onOpenChange={setOpen}
                            constraints={constraints}
                            allConstraints={allConstraints}
                            onSubmit={(data) => {
                                const submitted = data.constraints;
                                const submittedValues = Array.isArray(submitted)
                                    ? new Map(submitted.map((id) => [String(id), true] as const))
                                    : new Map(Object.entries((submitted ?? {}) as Record<string, unknown>).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
                                const known = new Set([...constraints, ...allConstraints.map((item) => item.value)]);
                                for (const id of known) {
                                    if (submittedValues.has(id)) canvas.editor?.set_capability(node.id, id, submittedValues.get(id));
                                    else canvas.editor?.clear_capability(node.id, id);
                                }
                            }}
                        />
                    ) : null}
                </Section.Actions>
            </Section.Header>
            <Section.Content>
                <RenderIf data={constraints}>
                    {constraints.map((constraint) => {
                        const originId = resolved?.origins[constraint];
                        const isOverride = Object.hasOwn(local, constraint) && originId !== undefined && originId !== node.id;
                        const tags: Array<{ label: ReactNode; icon?: ReactNode; className?: string; onClick?: () => void }> = [];
                        if (isOverride) {
                            tags.push({
                                label: <ConstraintOverridePopover constraint={constraint} onClear={() => canvas.editor?.clear_capability_override(node.id, constraint)} />,
                                className: 'cursor-pointer',
                            });
                        }
                        if (originId && originId !== node.id) {
                            tags.push({ label: 'Origin', icon: <ArrowUpRight className="h-3.5 w-3.5" />, className: 'cursor-pointer', onClick: () => canvas.api?.select([originId], originId) });
                        } else if (originId === node.id) {
                            tags.push({
                                label: <ConstraintOriginPopover constraint={constraint} onClearSelf={() => canvas.editor?.set_capability(node.id, constraint, undefined)} onClearSubtree={() => canvas.editor?.clear_capability(node.id, constraint)} />,
                                icon: <TiDelete className="h-3.5 w-3.5" />,
                                className: 'cursor-pointer',
                            });
                        }
                        return (
                            <InputField
                                key={constraint}
                                labelPlacement="left"
                                tags={tags as never}
                                tagClassName="px-1 cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-50"
                                disabled={disabled}
                                value={resolved?.values[constraint] ?? local[constraint]}
                                onChange={({ value }) => canvas.editor?.set_capability(node.id, constraint, Boolean(value))}
                                variant="toggle"
                                label={<Label variant="fieldLabel" className="capitalize">{constraint}</Label>}
                            />
                        );
                    })}
                </RenderIf>
            </Section.Content>
        </Section>
    );
}

function FieldBindingSummary({ node }: { node: Extract<CanonicalInspectorNode, { kind: 'field' }> }) {
    const canvas = useServiceBuilderCanvasModel();
    const definition = canvas.definition!;
    const topLevel = node.raw.options?.length ?? 0;
    const total = fieldOptionChoices(node.raw.options).length;
    const ownerIds = Array.isArray(node.raw.bind_id) ? node.raw.bind_id : node.raw.bind_id ? [node.raw.bind_id] : [];
    const owners = ownerIds.map((id) => definition.filters.find((filter) => filter.id === id)?.label ?? id).join(', ') || 'Unbound';
    return (
        <>
            <PropertySection title="Binding summary" description="Where this field appears and how it behaves in the active branch.">
                <PropertyList items={[
                    { label: 'Owners', value: owners },
                    { label: 'Options', value: total ? (topLevel === total ? String(total) : `${topLevel} top-level / ${total} total`) : 'No options' },
                    { label: 'Selection mode', value: node.raw.multiple ? 'Multiple' : 'Single' },
                ]} />
            </PropertySection>
            {total ? (
                <>
                    <Separator />
                    <Section>
                        <Section.Header><Section.Title>Options</Section.Title></Section.Header>
                        <Section.Content>
                            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Current option labels available on this field{node.raw.type === 'treeselect' ? ', including child options' : ''}.</p>
                            <div className="space-y-2">{fieldOptionChoices(node.raw.options).map((option) => <div key={option.value} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900"><span className="font-medium text-slate-900 dark:text-slate-100">{option.label}</span><button type="button" onClick={() => canvas.api?.select([option.value], option.value)} className="text-xs font-semibold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-300">Inspect</button></div>)}</div>
                        </Section.Content>
                    </Section>
                </>
            ) : null}
        </>
    );
}

function OptionMappingSection({ node }: { node: Extract<CanonicalInspectorNode, { kind: 'option' }> }) {
    const definition = useServiceBuilderCanvasModel().definition!;
    const parent = definition.fields.find((field) => hasOption(field.options, node.id));
    const path = fieldOptionChoices(parent?.options).find((option) => option.value === node.id)?.label ?? node.raw.label;
    return (
        <PropertySection title="Option mapping" description="How this option participates in visible field mappings.">
            <PropertyList items={[
                { label: 'Parent field', value: parent?.label ?? 'Missing field' },
                { label: 'Option path', value: path },
                { label: 'Binding', value: parent?.id ?? 'Unbound' },
                { label: 'Service id', value: String(node.raw.service_id ?? 'None') },
            ]} />
        </PropertySection>
    );
}

function ServiceSection({ node, disabled }: { node: Exclude<CanonicalInspectorNode, { kind: 'none' }>; disabled: boolean }) {
    const canvas = useServiceBuilderCanvasModel();
    const services = useWorkspaceSelector((state) => state.services);
    const serviceId =
        node.kind === 'filter'
            ? node.raw.service_id
            : node.kind === 'option'
              ? node.raw.service_id
              : node.raw.button === true
                ? node.raw.service_id
                : undefined;
    const supported = node.kind !== 'field' || node.raw.button === true;
    const connected = services.find((service) => String(service.id) === String(serviceId));
    return (
        <PropertySection title="Service" description="Bind this node to a handler-owned catalog service." actions={!disabled && supported ? <CanonicalServicePicker nodeId={node.id} /> : null}>
            {supported ? (
                connected ? <>
                    <IncludesItem title={connected.name} badge={<span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">#{String(connected.id)}</span>} actions={disabled ? undefined : [{ kind: 'remove', title: 'Clear service', onClick: () => canvas.editor?.set_service(node.id, undefined) }]} />
                    <div className="rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800/50">
                        <div className="mb-2 flex justify-end"><ServiceMetaPopover meta={connected.meta} className="h-6 w-6" /></div>
                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                            <p><span className="font-medium text-gray-800 dark:text-gray-200">Category:</span> {connected.category ?? 'Uncategorised'}</p>
                            <p><span className="font-medium text-gray-800 dark:text-gray-200">Rate:</span> {connected.rate ?? 'Not set'}</p>
                            <p><span className="font-medium text-gray-800 dark:text-gray-200">Range:</span> {connected.min} - {connected.max}</p>
                        </div>
                        {!disabled ? <div className="mt-3 flex justify-end"><button type="button" onClick={() => canvas.editor?.set_service(node.id, undefined)} className="text-xs font-medium text-red-500 transition hover:text-red-600 dark:hover:text-red-400">Clear</button></div> : null}
                    </div>
                </> : <p className="text-sm text-slate-500">None</p>
            ) : (
                <p className="text-xs text-slate-500">Enable Button mode to attach a service directly. Choice services belong to options.</p>
            )}
        </PropertySection>
    );
}

function QuantitySection({ node, disabled }: { node: Exclude<CanonicalInspectorNode, { kind: 'none' }>; disabled: boolean }) {
    const canvas = useServiceBuilderCanvasModel();
    const rule = node.kind === 'field' ? node.raw.quantity : undefined;
    const quantityDefault = node.raw.quantity_default;
    const updateDefault = (value: unknown) => {
        const quantity_default = numberOrUndefined(value);
        if (node.kind === 'filter') canvas.editor?.update_filter(node.id, { quantity_default });
        else if (node.kind === 'option') canvas.editor?.update_option(node.id, { quantity_default });
        else canvas.editor?.update_field(node.id, { quantity_default });
    };
    const setMode = (value_by: QuantityRule['value_by']) => {
        if (node.kind !== 'field') return;
        if (value_by === 'eval') {
            canvas.editor?.set_field_quantity(node.id, {
                ...(rule ?? {}),
                value_by: 'eval',
                expression: rule?.value_by === 'eval' ? rule.expression : { language: 'javascript', body: 'return Number(value);' },
            });
            return;
        }
        const { multiply, clamp, fallback } = rule ?? {};
        canvas.editor?.set_field_quantity(node.id, { value_by, multiply, clamp, fallback });
    };
    const patchRule = (patch: { multiply?: number; fallback?: number; clamp?: QuantityRule['clamp']; expressionBody?: string }) => {
        if (node.kind !== 'field') return;
        const base = rule ?? { value_by: 'value' as const };
        const { expressionBody, ...canonicalPatch } = patch;
        canvas.editor?.set_field_quantity(
            node.id,
            base.value_by === 'eval'
                ? {
                      ...base,
                      ...canonicalPatch,
                      expression: { language: 'javascript', body: expressionBody ?? base.expression.body },
                  }
                : { ...base, ...canonicalPatch },
        );
    };
    const hasRule = node.kind === 'field' && Boolean(rule);
    const hasDefault = quantityDefault !== undefined;
    return (
        <>
            <Separator />
            <Section>
                <Section.Header>
                    <Section.Title>Quantity</Section.Title>
                    <Section.Actions>
                        {node.kind === 'field' && !hasRule ? (
                            <SectionActionButton disabled={disabled} icon={<BsPlus />} iconOnly tooltip="Add quantity rule" aria-label="Add quantity rule" onClick={() => setMode('value')} />
                        ) : null}
                        {!hasDefault ? (
                            <SectionActionButton disabled={disabled} icon={<BsPatchPlus />} badge="1" iconOnly tooltip="Add quantity default" aria-label="Add quantity default" onClick={() => updateDefault(1)} />
                        ) : null}
                        {hasRule ? (
                            <SectionActionButton disabled={disabled} icon={<MdDeleteOutline />} badge="fx" iconOnly tooltip="Clear quantity rule" aria-label="Clear quantity rule" onClick={() => canvas.editor?.set_field_quantity(node.id, undefined)} />
                        ) : null}
                        {hasDefault ? (
                            <SectionActionButton disabled={disabled} icon={<MdDeleteOutline />} badge="1" iconOnly tooltip="Clear quantity default" aria-label="Clear quantity default" onClick={() => updateDefault(undefined)} />
                        ) : null}
                    </Section.Actions>
                </Section.Header>
                <Section.Content>
                    <fieldset disabled={disabled} className="m-0 min-w-0 space-y-4 border-0 p-0">
                        {node.kind === 'field' && rule ? (
                            <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                                    {(['value', 'length', 'eval'] as const).map((mode) => (
                                        <button key={mode} type="button" onClick={() => setMode(mode)} className={cn('rounded-md px-3 py-2 text-sm font-medium transition', rule.value_by === mode ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100')}>
                                            {mode === 'eval' ? 'Eval' : mode === 'length' ? 'Length' : 'Value'}
                                        </button>
                                    ))}
                                </div>
                                {rule.value_by === 'eval' ? (
                                    <InputField variant="textarea" label="Eval code" value={rule.expression.body} placeholder="return Number(value) * 2;" onChange={({ value }) => patchRule({ expressionBody: String(value ?? '') })} />
                                ) : null}
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <InputField variant="text" label="Multiply" value={String(rule.multiply ?? '')} placeholder="Optional multiplier" onChange={({ value }) => patchRule({ multiply: numberOrUndefined(value) })} />
                                    <InputField variant="text" label="Fallback" value={String(rule.fallback ?? '')} placeholder="Optional fallback quantity" onChange={({ value }) => patchRule({ fallback: numberOrUndefined(value) })} />
                                    <InputField variant="text" label="Clamp min" value={String(rule.clamp?.min ?? '')} placeholder="Optional minimum" onChange={({ value }) => patchRule({ clamp: { ...rule.clamp, min: numberOrUndefined(value) } })} />
                                    <InputField variant="text" label="Clamp max" value={String(rule.clamp?.max ?? '')} placeholder="Optional maximum" onChange={({ value }) => patchRule({ clamp: { ...rule.clamp, max: numberOrUndefined(value) } })} />
                                </div>
                            </div>
                        ) : null}
                        {hasDefault ? (
                            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                <InputField variant="text" label="Quantity default" value={String(quantityDefault ?? '')} placeholder={node.kind === 'field' ? 'Leave blank to fall back' : 'Leave blank to inherit/fall back'} onChange={({ value }) => updateDefault(value)} />
                            </div>
                        ) : null}
                    </fieldset>
                </Section.Content>
            </Section>
        </>
    );
}

function UtilitySection({ node, disabled }: { node: Extract<CanonicalInspectorNode, { kind: 'field' | 'option' }>; disabled: boolean }) {
    const canvas = useServiceBuilderCanvasModel();
    const utility = node.raw.utility;
    const hasStoredUtility = utility !== undefined;
    const isActiveUtility = node.raw.pricing_role === 'utility';
    const hasUtilityConfiguration = isActiveUtility || hasStoredUtility;
    const base: UtilityDefinition = utility ?? { rate: 0, mode: 'flat' };
    const update = (patch: Partial<UtilityDefinition>) => {
        const next = { ...base, ...patch };
        if (node.kind === 'field') canvas.editor?.update_field(node.id, { utility: next });
        else canvas.editor?.update_option(node.id, { utility: next });
    };
    const add = () => {
        if (node.kind === 'field') canvas.editor?.update_field(node.id, { utility: base, pricing_role: 'utility' });
        else canvas.editor?.update_option(node.id, { utility: base, pricing_role: 'utility' });
    };
    const clear = () => {
        if (node.kind === 'field') canvas.editor?.update_field(node.id, { utility: undefined, pricing_role: 'base' });
        else canvas.editor?.update_option(node.id, { utility: undefined, pricing_role: 'base' });
    };
    return (
        <>
            <Separator />
            <Section>
                <Section.Header>
                    <Section.Title>Utility</Section.Title>
                    <Section.Actions>
                        {!hasStoredUtility && !isActiveUtility ? <SectionActionButton disabled={disabled} icon={<BsPlus />} iconOnly tooltip="Add utility" aria-label="Add utility" onClick={add} /> : null}
                        {hasStoredUtility && !isActiveUtility ? <SectionActionButton disabled={disabled} icon={<BsPencil />} iconOnly tooltip="Activate utility" aria-label="Activate utility" onClick={add} /> : null}
                        {hasUtilityConfiguration ? <SectionActionButton disabled={disabled} icon={<MdDeleteOutline />} iconOnly tooltip="Clear utility" aria-label="Clear utility" onClick={clear} /> : null}
                    </Section.Actions>
                </Section.Header>
                <Section.Content>
                    {hasUtilityConfiguration ? (
                        <fieldset disabled={disabled} className="m-0 min-w-0 space-y-3 border-0 p-0">
                            {!hasStoredUtility ? <p className="text-xs text-slate-500 dark:text-slate-400">This node is marked as utility-priced, but its utility marker is missing. Fill in the values below to repair it.</p> : null}
                            {hasStoredUtility && !isActiveUtility ? <p className="text-xs text-slate-500 dark:text-slate-400">This node still has utility marker values stored, but its pricing role is base. Activate utility to apply these charges, or clear the marker.</p> : null}
                            <InputField variant="text" label="Rate" value={String(base.rate)} placeholder="Enter utility rate" onChange={({ value }) => update({ rate: numberOrUndefined(value) ?? 0 })} />
                            <InputField
                                variant="select" autoCap
                                label="Mode"
                                value={base.mode}
                                options={[
                                    { label: 'Flat', value: 'flat' },
                                    { label: 'Per quantity', value: 'per_quantity' },
                                    { label: 'Per value', value: 'per_value' },
                                    { label: 'Percent', value: 'percent' },
                                ]}
                                onChange={({ value }) => update({ mode: value as UtilityDefinition['mode'], value_by: value === 'per_value' ? (base.value_by ?? 'value') : undefined, percent_base: value === 'percent' ? base.percent_base : undefined })}
                            />
                            {base.mode === 'per_value' ? (
                        <InputField
                            variant="select" autoCap
                            label="Value source"
                            value={base.value_by ?? 'value'}
                            onChange={({ value }) => update({ value_by: value as 'value' | 'length' })}
                            options={[
                                { value: 'value', label: 'value' },
                                { value: 'length', label: 'length' },
                            ]}
                            clearable={false}
                        />
                    ) : null}
                            {base.mode === 'percent' ? (
                        <InputField
                            variant="select" autoCap
                            label="Percent base"
                            disabled={disabled}
                            value={base.percent_base ?? 'service_total'}
                            onChange={({ value }) => update({ percent_base: value as UtilityDefinition['percent_base'] })}
                            options={[
                                { value: 'service_total', label: 'service total' },
                                { value: 'base_service', label: 'base service' },
                                { value: 'all', label: 'all' },
                            ]}
                            clearable={false}
                        />
                            ) : null}
                            <InputField variant="text" label="Label" value={base.label ?? ''} placeholder="Optional utility label" onChange={({ value }) => update({ label: String(value ?? '').trim() || undefined })} />
                        </fieldset>
                    ) : null}
                </Section.Content>
            </Section>
        </>
    );
}

function RelationshipSection({
    node,
    mode,
    disabled,
}: {
    node: Exclude<CanonicalInspectorNode, { kind: 'none' }>;
    mode: 'includes' | 'excludes';
    disabled: boolean;
}) {
    const canvas = useServiceBuilderCanvasModel();
    const definition = canvas.definition!;
    const [open, setOpen] = useState(false);
    const ids = node.kind === 'filter'
        ? (node.raw[mode] ?? [])
        : ((mode === 'includes' ? definition.includes_for_buttons : definition.excludes_for_buttons)[node.id] ?? []);
    const fieldsById = useMemo(() => new Map(definition.fields.map((field) => [field.id, field])), [definition.fields]);
    const sourceFieldId = node.kind === 'field' ? node.id : node.kind === 'option' ? definition.fields.find((field) => hasOption(field.options, node.id))?.id : undefined;
    const available = definition.fields
        .filter((field) => field.id !== sourceFieldId && !ids.includes(field.id))
        .map((field) => ({ label: field.label, value: field.id, description: field.description, tags: [{ label: field.id, value: field.id }] }));
    const kind = mode === 'includes' ? 'include' : 'exclude';
    return (
        <Section>
            <Section.Header>
                <Section.Title>{mode === 'includes' ? 'Includes' : 'Excludes'}</Section.Title>
                <Section.Actions>
                    {!disabled ? <AddIncludesPopover open={open} onOpenChange={setOpen} options={available} onSelect={(selected) => canvas.editor?.[kind](node.id, selected)} /> : null}
                </Section.Actions>
            </Section.Header>
            <Section.Content>
                <RenderIf data={ids.length > 0} emptyMessage="None">
                    <IncludesList>
                        {ids.map((id) => {
                            const field = fieldsById.get(id);
                            return field ? (
                                <IncludesItem
                                    key={id}
                                    title={field.label}
                                    actions={[
                                        { title: 'Go to field', kind: 'open', onClick: () => canvas.api?.select([field.id], field.id) },
                                        { title: 'Remove', kind: 'remove', disabled, onClick: () => canvas.editor?.disconnect(kind, node.id, id) },
                                    ]}
                                />
                            ) : <IncludesItemMissing key={id} message={`Missing Target (ID: ${id})`} />;
                        })}
                    </IncludesList>
                </RenderIf>
            </Section.Content>
        </Section>
    );
}

function RelationshipsSection({ node, disabled }: { node: Exclude<CanonicalInspectorNode, { kind: 'none' }>; disabled: boolean }) {
    return <><Separator /><RelationshipSection node={node} mode="includes" disabled={disabled} /><Separator /><RelationshipSection node={node} mode="excludes" disabled={disabled} /></>;
}

function UnsupportedRelationshipsSection() {
    return <><Separator /><Section><Section.Header><Section.Title>Trigger mappings</Section.Title></Section.Header><Section.Content><p className="text-xs text-slate-500 dark:text-slate-400">Enable Button mode to configure includes, excludes, and trigger effects for this field.</p></Section.Content></Section></>;
}

function OptionEffectsSection({ node, disabled }: { node: Extract<CanonicalInspectorNode, { kind: 'field' | 'option' }>; disabled: boolean }) {
    const canvas = useServiceBuilderCanvasModel();
    const definition = canvas.definition!;
    const [open, setOpen] = useState(false);
    const [editingTargetId, setEditingTargetId] = useState<string>();
    const sourceFieldId = node.kind === 'field' ? node.id : definition.fields.find((field) => hasOption(field.options, node.id))?.id;
    const fields = useMemo(() => definition.fields.filter((field) => field.id !== sourceFieldId), [definition.fields, sourceFieldId]);
    const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
    const effectMap = definition.option_effects_for_buttons[node.id] ?? {};
    const rules = Object.entries(effectMap).sort(([left], [right]) => (fieldsById.get(left)?.label ?? left).localeCompare(fieldsById.get(right)?.label ?? right));
    const effect = editingTargetId ? effectMap[editingTargetId] : undefined;
    const [target, setTarget] = useState(fields[0]?.id ?? '');
    const [forceVisible, setForceVisible] = useState(false);
    const [include, setInclude] = useState<string[]>([]);
    const [exclude, setExclude] = useState<string[]>([]);
    useEffect(() => {
        if (!open) return;
        setTarget(editingTargetId ?? fields[0]?.id ?? '');
        setForceVisible(Boolean(effect?.force_visible));
        setInclude(effect?.include ?? []);
        setExclude(effect?.exclude ?? []);
    }, [editingTargetId, effect, fields, open]);
    const targetField = fields.find((field) => field.id === target);
    const choices = fieldOptionChoices(targetField?.options);
    const close = () => { setOpen(false); setEditingTargetId(undefined); };
    const save = () => {
        if (!target) return;
        canvas.editor?.set_option_effect(node.id, target, {
            ...(forceVisible ? { force_visible: true } : {}),
            ...(choices.length && include.length ? { include } : {}),
            ...(choices.length && exclude.length ? { exclude } : {}),
        });
        close();
    };
    const summary = (field: typeof targetField, ids: readonly string[] | undefined) => {
        if (!ids?.length) return 'None';
        const labels = new Map(fieldOptionChoices(field?.options).map((choice) => [choice.value, choice.label]));
        return ids.map((id) => labels.get(id) ?? id).join(', ');
    };
    return (
        <>
            <Separator />
            <Section>
                <Section.Header>
                    <Section.Title>Option effects</Section.Title>
                    <Section.Actions>
                        {!disabled ? (
                            <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setEditingTargetId(undefined); }}>
                                <PopoverTrigger asChild><SectionActionTriggerButton icon={<BsPlus />}>Add</SectionActionTriggerButton></PopoverTrigger>
                                <PopoverContent align="end" className="w-80">
                                    <div className="flex flex-col gap-3">
                                        <InputField variant="select" autoCap label="Target field" value={target || undefined} options={fields.map((field) => ({ label: field.label, value: field.id, description: field.description }))} onChange={({ value }) => { setTarget(String(value ?? '')); setInclude([]); setExclude([]); }} />
                                        <InputField variant="toggle" label="Force visible" value={forceVisible} onChange={({ value }) => setForceVisible(Boolean(value))} />
                                        {choices.length ? <><InputField variant="checkbox" label="Include options" value={include} options={choices as never} onChange={({ value }) => setInclude(selectedValues(value))} /><InputField variant="checkbox" label="Exclude options" value={exclude} options={choices as never} onChange={({ value }) => setExclude(selectedValues(value))} /></> : <p className="text-xs text-slate-500 dark:text-slate-400">This target field has no options. Only force-visible behavior can be saved.</p>}
                                        <div className="flex justify-end gap-2"><SectionActionButton onClick={close}>Cancel</SectionActionButton><Button type="button" size="sm" onClick={save} disabled={!target}>Save</Button></div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : null}
                    </Section.Actions>
                </Section.Header>
                <Section.Content>
                    {rules.length ? <IncludesList>{rules.map(([targetFieldId, rule]) => { const field = fieldsById.get(targetFieldId); return <div key={targetFieldId} className="rounded-md bg-gray-50 p-2 dark:bg-gray-800/50"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{field?.label ?? `Missing Target (ID: ${targetFieldId})`}</div><dl className="mt-1 space-y-1 text-xs text-slate-500 dark:text-slate-400"><div><dt className="inline font-semibold">Force visible:</dt>{' '}<dd className="inline">{rule.force_visible ? 'Yes' : 'No'}</dd></div><div><dt className="inline font-semibold">Include:</dt>{' '}<dd className="inline">{summary(field, rule.include)}</dd></div><div><dt className="inline font-semibold">Exclude:</dt>{' '}<dd className="inline">{summary(field, rule.exclude)}</dd></div></dl></div><div className="flex items-center gap-2"><button type="button" disabled={disabled} className="text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-300" aria-label={`Edit ${field?.label ?? targetFieldId} option effect`} title="Edit" onClick={() => { setEditingTargetId(targetFieldId); setOpen(true); }}><span className="text-lg"><BsPencil /></span></button><button type="button" disabled={disabled} className="text-gray-400 hover:text-red-500 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400" aria-label={`Remove ${field?.label ?? targetFieldId} option effect`} title="Remove" onClick={() => canvas.editor?.set_option_effect(node.id, targetFieldId, undefined)}><span className="text-lg"><MdOutlineRemoveCircleOutline /></span></button></div></div></div>; })}</IncludesList> : <p className="text-sm text-gray-500 dark:text-gray-400">None</p>}
                </Section.Content>
            </Section>
        </>
    );
}

const parseEffectValue = (value: string): string | number | boolean | null | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    const number = Number(trimmed);
    return Number.isFinite(number) && String(number) === trimmed ? number : trimmed;
};

function ValueEffectsSection({ node, disabled }: { node: Exclude<CanonicalInspectorNode, { kind: 'none' }>; disabled: boolean }) {
    const canvas = useServiceBuilderCanvasModel();
    const definition = canvas.definition!;
    const [open, setOpen] = useState(false);
    const [editingTargetId, setEditingTargetId] = useState<string>();
    const sourceFieldId = node.kind === 'field' ? node.id : node.kind === 'option' ? definition.fields.find((field) => hasOption(field.options, node.id))?.id : undefined;
    const fields = useMemo(() => definition.fields.filter((field) => field.id !== sourceFieldId && field.meta?.inactive !== true && field.meta?.disabled !== true), [definition.fields, sourceFieldId]);
    const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
    const effectMap = definition.value_effects_for_triggers[node.id] ?? {};
    const rules = Object.entries(effectMap).sort(([left], [right]) => (fieldsById.get(left)?.label ?? left).localeCompare(fieldsById.get(right)?.label ?? right));
    const effect = editingTargetId ? effectMap[editingTargetId] : undefined;
    const [target, setTarget] = useState(fields[0]?.id ?? '');
    const [mode, setMode] = useState<'always' | 'if_empty'>('always');
    const [clearOnDeactivate, setClearOnDeactivate] = useState(false);
    const [primitiveDraft, setPrimitiveDraft] = useState('');
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    useEffect(() => {
        if (!open) return;
        setTarget(editingTargetId ?? fields[0]?.id ?? '');
        setMode(effect?.mode === 'if_empty' ? 'if_empty' : 'always');
        setClearOnDeactivate(Boolean(effect?.clear_on_deactivate));
        setPrimitiveDraft(Array.isArray(effect?.value) ? effect.value.map(String).join(', ') : effect?.value == null ? '' : String(effect.value));
        setSelectedOptions(selectedValues(effect?.value));
    }, [editingTargetId, effect, fields, open]);
    const targetField = fields.find((field) => field.id === target);
    const choices = fieldOptionChoices(targetField?.options);
    const close = () => { setOpen(false); setEditingTargetId(undefined); };
    const save = () => {
        if (!target) return;
        const value = choices.length ? (targetField?.multiple ? selectedOptions : selectedOptions[0]) : parseEffectValue(primitiveDraft);
        if (value === undefined || (Array.isArray(value) && !value.length)) return;
        canvas.editor?.set_value_effect(node.id, target, {
            value,
            ...(mode === 'if_empty' ? { mode } : {}),
            ...(clearOnDeactivate ? { clear_on_deactivate: true } : {}),
        });
        close();
    };
    const summary = (targetId: string, rule: FieldValueEffect) => {
        const field = fieldsById.get(targetId);
        const labels = new Map(fieldOptionChoices(field?.options).map((choice) => [choice.value, choice.label]));
        const values = Array.isArray(rule.value) ? rule.value : [rule.value];
        return values.map((value) => labels.get(String(value)) ?? String(value)).join(', ');
    };
    return (
        <>
            <Separator />
            <Section>
                <Section.Header>
                    <Section.Title>Value effects</Section.Title>
                    <Section.Actions>
                        {!disabled ? (
                            <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setEditingTargetId(undefined); }}>
                                <PopoverTrigger asChild><SectionActionTriggerButton icon={<BsPlus />}>Add</SectionActionTriggerButton></PopoverTrigger>
                                <PopoverContent align="end" className="w-80">
                                    <div className="flex flex-col gap-3">
                                        <InputField variant="select" autoCap label="Target field" value={target || undefined} options={fields.map((field) => ({ label: field.label, value: field.id, description: field.description }))} onChange={({ value }) => { setTarget(String(value ?? '')); setSelectedOptions([]); setPrimitiveDraft(''); }} />
                                        {choices.length && targetField?.multiple ? <InputField variant="checkbox" label="Value" value={selectedOptions} options={choices as never} onChange={({ value }) => setSelectedOptions(selectedValues(value))} /> : choices.length ? <InputField variant="select" autoCap label="Value" clearable value={selectedOptions[0] || undefined} options={choices as never} onChange={({ value }) => setSelectedOptions(selectedValues(value))} /> : <InputField variant="text" label="Value" value={primitiveDraft} onChange={({ value }) => setPrimitiveDraft(String(value ?? ''))} />}
                                        <InputField variant="select" autoCap label="Assignment mode" value={mode} options={[{ label: 'Always', value: 'always' }, { label: 'If empty', value: 'if_empty' }]} onChange={({ value }) => setMode(value === 'if_empty' ? 'if_empty' : 'always')} />
                                        <InputField variant="toggle" label="Clear on deactivation" value={clearOnDeactivate} onChange={({ value }) => setClearOnDeactivate(Boolean(value))} />
                                        <div className="flex justify-end gap-2"><SectionActionButton onClick={close}>Cancel</SectionActionButton><Button type="button" size="sm" onClick={save} disabled={!target}>Save</Button></div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : null}
                    </Section.Actions>
                </Section.Header>
                <Section.Content>
                    {rules.length ? <IncludesList>{rules.map(([targetFieldId, rule]) => { const field = fieldsById.get(targetFieldId); return <div key={targetFieldId} className="rounded-md bg-gray-50 p-2 dark:bg-gray-800/50"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{field?.label ?? `Missing Target (ID: ${targetFieldId})`}</div><dl className="mt-1 space-y-1 text-xs text-slate-500 dark:text-slate-400"><div><dt className="inline font-semibold">Value:</dt>{' '}<dd className="inline">{summary(targetFieldId, rule)}</dd></div><div><dt className="inline font-semibold">Mode:</dt>{' '}<dd className="inline">{rule.mode === 'if_empty' ? 'If empty' : 'Always'}</dd></div><div><dt className="inline font-semibold">Clear on deactivation:</dt>{' '}<dd className="inline">{rule.clear_on_deactivate ? 'Yes' : 'No'}</dd></div></dl></div><div className="flex items-center gap-2"><button type="button" disabled={disabled} className="text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-300" aria-label={`Edit ${field?.label ?? targetFieldId} value effect`} title="Edit" onClick={() => { setEditingTargetId(targetFieldId); setOpen(true); }}><span className="text-lg"><BsPencil /></span></button><button type="button" disabled={disabled} className="text-gray-400 hover:text-red-500 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400" aria-label={`Remove ${field?.label ?? targetFieldId} value effect`} title="Remove" onClick={() => canvas.editor?.set_value_effect(node.id, targetFieldId, undefined)}><span className="text-lg"><MdOutlineRemoveCircleOutline /></span></button></div></div></div>; })}</IncludesList> : <p className="text-sm text-gray-500 dark:text-gray-400">None</p>}
                </Section.Content>
            </Section>
        </>
    );
}

export function CanonicalAdvancedPropertySections({
    node,
    disabled,
}: {
    node: Exclude<CanonicalInspectorNode, { kind: 'none' }>;
    disabled: boolean;
}) {
    const canvas = useServiceBuilderCanvasModel();
    if (node.kind === 'filter') return <><ConstraintsSection node={node} disabled={disabled} /><QuantitySection node={node} disabled={disabled} /><RelationshipsSection node={node} disabled={disabled} /><ValueEffectsSection node={node} disabled={disabled} /><ServiceSection node={node} disabled={disabled} /></>;
    if (node.kind === 'option') return <><QuantitySection node={node} disabled={disabled} /><UtilitySection node={node} disabled={disabled} /><OptionMappingSection node={node} /><RelationshipsSection node={node} disabled={disabled} /><OptionEffectsSection node={node} disabled={disabled} /><ValueEffectsSection node={node} disabled={disabled} /><ServiceSection node={node} disabled={disabled} /></>;
    const canMapTriggers = node.raw.button === true;
    return (
        <>
            <Separator />
            <ValidationRulesSection disabled={disabled} rules={(node.raw.validation ?? []).map(toValidationEditorRule) as never} onChange={(rules) => canvas.editor?.set_field_validation(node.id, rules.map((rule) => fromValidationEditorRule(rule as ReturnType<typeof toValidationEditorRule>)))} />
            <QuantitySection node={node} disabled={disabled} />
            <UtilitySection node={node} disabled={disabled} />
            <FieldBindingSummary node={node} />
            {canMapTriggers ? <RelationshipsSection node={node} disabled={disabled} /> : <UnsupportedRelationshipsSection />}
            {canMapTriggers ? <OptionEffectsSection node={node} disabled={disabled} /> : null}
            {canMapTriggers ? <ValueEffectsSection node={node} disabled={disabled} /> : null}
            <ServiceSection node={node} disabled={disabled} />
        </>
    );
}
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
