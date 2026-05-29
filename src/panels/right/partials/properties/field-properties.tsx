import { describeBinding } from '@/builder/view-models.tsx';
import { PropertyList } from '@/components/builder/index.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Section } from '@/panels/right/components/sections.tsx';
import { AddService } from '@/panels/right/partials/global/add-service.tsx';
import type { FieldNode } from '@timeax/digital-service-engine/core';
import { resolveInputDescriptor, useInputs } from '@timeax/digital-service-engine/react';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useState } from 'react';
import { DescriptorSettings, getDescriptorUiKeys } from './components/descriptor-settings.tsx';
import { fieldHasOptions } from './components/descriptor-options.ts';
import { mergeNodeMeta } from './components/meta.ts';
import { getFieldPropertyCapabilities } from './components/node-capabilities.ts';
import OrderKindSection from './components/order-kind-section.tsx';
import QuantitySection from './components/quantity-section.tsx';
import UtilitySection from './components/utility-section.tsx';
import ValidationSection from './components/validation-section.tsx';
import { IncExcludeSection } from './components/Union';

export interface FieldPropertiesProps {
    className?: string;
    node: FieldNode;
    kinds?: string[];
    defaultKind?: string;
}

const getVariant = (node: FieldNode) => {
    const variant = (node.raw.meta as Record<string, unknown> | undefined)?.variant;
    return typeof variant === 'string' && variant.trim() ? variant.trim() : undefined;
};

const toLabel = (value: string) =>
    value
        .split(/[-_:]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const pruneDescriptorDefaults = (
    defaults: Record<string, unknown>,
    previousDescriptorKeys: Set<string>,
    nextDescriptorKeys: Set<string>,
) => {
    const nextDefaults = Object.fromEntries(
        Object.entries(defaults).filter(([key]) => !previousDescriptorKeys.has(key) || nextDescriptorKeys.has(key)),
    );

    return Object.keys(nextDefaults).length ? nextDefaults : undefined;
};

export function FieldProperties({ className, node, kinds, defaultKind }: FieldPropertiesProps) {
    const canvas = useCanvas();
    const { registry } = useInputs();
    const capabilities = getFieldPropertyCapabilities(node);
    const defaults = node.raw.defaults ?? {};
    const options = node.raw.options ?? [];
    const currentType = String(node.raw.type ?? 'text');
    const currentVariant = getVariant(node);
    const nameValue = node.raw.name ?? '';
    const placeholderValue = (defaults.placeholder as string) ?? '';
    const helpTextValue = (defaults.helpText as string) ?? '';
    const [nameDraft, setNameDraft] = useState(nameValue);
    const [placeholderDraft, setPlaceholderDraft] = useState(placeholderValue);
    const [helpTextDraft, setHelpTextDraft] = useState(helpTextValue);

    const descriptor = useMemo(() => resolveInputDescriptor(registry, currentType as any, currentVariant as any), [currentType, currentVariant, registry]);
    const descriptorForMulti = useMemo(() => {
        if (!descriptor) return null;
        return descriptor.multi?.autoEnable === true;
    }, [descriptor]);
    const descriptorUi = descriptor?.ui ?? {};
    const descriptorKeySet = useMemo(() => new Set(getDescriptorUiKeys(descriptorUi)), [descriptorUi]);

    useEffect(() => {
        setNameDraft(nameValue);
    }, [node.id, nameValue]);

    useEffect(() => {
        setPlaceholderDraft(placeholderValue);
    }, [node.id, placeholderValue]);

    useEffect(() => {
        setHelpTextDraft(helpTextValue);
    }, [node.id, helpTextValue]);

    const fieldTypeOptions = useMemo(() => {
        const kinds = Array.from(registry._store.keys()).map((kind) => String(kind));

        if (!kinds.includes(currentType)) {
            kinds.push(currentType);
        }

        return kinds
            .map((value) => ({ label: toLabel(value), value }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [currentType, registry]);

    const variantEntries = useMemo(() => {
        const entries = Array.from(registry._store.get(currentType as any)?.entries() ?? []);
        return entries
            .filter(([variant]) => variant !== 'default')
            .map(([variant]) => ({
                label: toLabel(String(variant)),
                value: String(variant),
            }));
    }, [currentType, registry]);

    const canEditVariant = variantEntries.length > 0 || Boolean(currentVariant);
    const canSetOrderKind = capabilities.isButton && !capabilities.hasOptions;

    const updateDefaults = (nextDefaults: Record<string, unknown> | undefined) => {
        canvas.api.editor.updateField(node.id, { defaults: nextDefaults } as any);
    };

    const updateGenericDefault = (key: string, rawValue: unknown) => {
        const nextDefaults = { ...defaults };
        const nextValue = typeof rawValue === 'string' ? rawValue : undefined;

        if (!nextValue) {
            delete nextDefaults[key];
        } else {
            nextDefaults[key] = nextValue;
        }

        updateDefaults(Object.keys(nextDefaults).length ? nextDefaults : undefined);
    };

    const applyDescriptorTransition = (nextType: string, nextVariant: string | undefined) => {
        const nextDescriptor = resolveInputDescriptor(registry, nextType as any, nextVariant as any);
        const nextDescriptorKeys = new Set(getDescriptorUiKeys(nextDescriptor?.ui));
        const nextDefaults = pruneDescriptorDefaults(defaults, descriptorKeySet, nextDescriptorKeys);
        const nextMulti = nextDescriptor?.multi?.autoEnable === true;
        const nextMeta = mergeNodeMeta(node.raw.meta as Record<string, unknown> | undefined, {
            variant: nextVariant,
            multi: nextMulti,
        });

        canvas.api.editor.updateField(
            node.id,
            {
                type: nextType as any,
                defaults: nextDefaults,
                meta: nextMeta,
            } as any,
        );

        if (nextDescriptor?.options?.supported === true && nextDescriptor?.options?.autoCreate === true && !fieldHasOptions(node.raw)) {
            (canvas.api.editor as any).autoCreateOptionsMany([node.id]);
        }
    };

    const handleTypeChange = (rawType: unknown) => {
        const nextType = String(rawType ?? 'text');
        const variantMap = registry._store.get(nextType as any);
        const nextVariant = currentVariant && variantMap?.has(currentVariant as any) ? currentVariant : undefined;
        applyDescriptorTransition(nextType, nextVariant);
    };

    const handleVariantChange = (rawVariant: unknown) => {
        const nextVariant = String(rawVariant ?? 'default');
        applyDescriptorTransition(currentType, nextVariant === 'default' ? undefined : nextVariant);
    };

    return (
        <div className={className}>
            <div className="space-y-4">
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
                                value={nameDraft}
                                placeholder="Storage key"
                                onChange={(e) => setNameDraft(String(e.value ?? ''))}
                                onBlur={() => canvas.api.editor.editName(node.id, nameDraft || undefined)}
                            />
                            <InputField
                                variant="select"
                                label="Type"
                                value={currentType}
                                options={fieldTypeOptions as any}
                                onChange={(e) => handleTypeChange(e.value)}
                            />
                            {canEditVariant ? (
                                <InputField
                                    variant="select"
                                    label="Input variant"
                                    value={currentVariant ?? 'default'}
                                    options={[{ label: 'Default', value: 'default' }, ...variantEntries] as any}
                                    onChange={(e) => handleVariantChange(e.value)}
                                />
                            ) : null}
                            <InputField
                                variant="toggle"
                                label="Required"
                                value={Boolean(node.raw.required)}
                                onChange={(e) => canvas.api.editor.updateField(node.id, { required: Boolean(e.value) })}
                            />
                            <InputField
                                variant="toggle"
                                label="Button mode"
                                disabled={capabilities.buttonModeLocked}
                                value={capabilities.isButton}
                                onChange={(e) => canvas.api.editor.updateField(node.id, { button: Boolean(e.value) } as any)}
                            />
                            {options.length ? (
                                <InputField
                                    variant="toggle"
                                    label="Is multiple"
                                    disabled={Boolean(descriptor)}
                                    value={descriptorForMulti ?? Boolean(node.raw.meta?.multi)}
                                    onChange={(e) =>
                                        canvas.api.editor.updateField(node.id, {
                                            meta: mergeNodeMeta(node.raw.meta as Record<string, unknown> | undefined, {
                                                multi: Boolean(e.value),
                                            }),
                                        } as any)
                                    }
                                />
                            ) : null}
                            {capabilities.buttonModeMessage ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">{capabilities.buttonModeMessage}</p>
                            ) : null}
                        </div>
                    </Section.Content>
                </Section>
                <Separator />

                <OrderKindSection
                    nodeId={node.id}
                    nodeKind="field"
                    kinds={kinds}
                    defaultKind={defaultKind}
                    disabled={!canSetOrderKind}
                    disabledMessage={
                        !canSetOrderKind ? 'Order kind is supported only on button fields without options.' : undefined
                    }
                />
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
                                value={placeholderDraft}
                                onChange={(e) => setPlaceholderDraft(String(e.value ?? ''))}
                                onBlur={() => updateGenericDefault('placeholder', placeholderDraft)}
                            />
                            <InputField
                                variant="textarea"
                                label="Help text"
                                value={helpTextDraft}
                                onChange={(e) => setHelpTextDraft(String(e.value ?? ''))}
                                onBlur={() => updateGenericDefault('helpText', helpTextDraft)}
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
                            <DescriptorSettings schema={descriptorUi} defaults={defaults} onChange={updateDefaults} />
                        ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                No input descriptor was found for this field type{currentVariant ? ` / ${currentVariant}` : ''}.
                            </p>
                        )}
                    </Section.Content>
                </Section>
                <Separator />

                <ValidationSection node={node} />
                <Separator />

                <QuantitySection node={node} />
                <Separator />

                <UtilitySection node={node} />
                <Separator />

                <Section>
                    <Section.Header>
                        <Section.Title>Binding summary</Section.Title>
                    </Section.Header>
                    <Section.Content>
                        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                            Where this field appears and how it behaves in the active branch.
                        </p>
                        <PropertyList
                            items={[
                                { label: 'Owners', value: describeBinding(node) },
                                { label: 'Options', value: options.length ? String(options.length) : 'No options' },
                                { label: 'Selection mode', value: node.raw.meta?.multi ? 'Multiple' : 'Single' },
                            ]}
                        />
                    </Section.Content>
                </Section>
                <Separator />
                {options.length ? (
                    <>
                        <Section>
                            <Section.Header>
                                <Section.Title>Options</Section.Title>
                            </Section.Header>
                            <Section.Content>
                                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Current option labels available on this field.</p>
                                <div className="space-y-2">
                                    {options.map((option) => (
                                        <div
                                            key={option.id}
                                            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900"
                                        >
                                            <span className="font-medium text-slate-900 dark:text-slate-100">{option.label}</span>
                                            <button
                                                type="button"
                                                onClick={() => canvas.api.select([option.id])}
                                                className="text-xs font-semibold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-300"
                                            >
                                                Inspect
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </Section.Content>
                        </Section>
                        <Separator />
                    </>
                ) : null}

                {capabilities.triggerMappings.canEdit ? (
                    <>
                        <IncExcludeSection node={node} mode="includes" capability={capabilities.triggerMappings} />
                        <Separator />
                        <IncExcludeSection node={node} mode="excludes" capability={capabilities.triggerMappings} />
                    </>
                ) : (
                    <Section>
                        <Section.Header>
                            <Section.Title>Trigger mappings</Section.Title>
                        </Section.Header>
                        <Section.Content>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{capabilities.triggerMappings.message}</p>
                        </Section.Content>
                    </Section>
                )}
                <Separator />
                <AddService data={node} readOnly={!capabilities.service.canEdit} readOnlyMessage={capabilities.service.message} />
            </div>
        </div>
    );
}

export default FieldProperties;
