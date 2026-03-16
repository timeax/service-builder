import { Section, SectionActionButton } from '@/panels/right/components/sections.tsx';
import type { FieldNode, OptionNode } from '@timeax/digital-service-engine/core';
import type { UtilityMode } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { BsPencil, BsPlus } from 'react-icons/bs';
import { MdDeleteOutline } from 'react-icons/md';
import { asInputValue, mergeNodeMeta, parseFiniteNumber } from './meta.ts';
import { getFieldPropertyCapabilities, getOptionPropertyCapabilities } from './node-capabilities.ts';

type UtilitySectionProps = {
    node: FieldNode | OptionNode;
};

type UtilityMeta = {
    rate?: number;
    mode?: UtilityMode;
    valueBy?: 'value' | 'length';
    percentBase?: 'service_total' | 'base_service' | 'all';
    label?: string;
};

const utilityModes: Array<{ label: string; value: UtilityMode }> = [
    { label: 'Flat', value: 'flat' },
    { label: 'Per quantity', value: 'per_quantity' },
    { label: 'Per value', value: 'per_value' },
    { label: 'Percent', value: 'percent' },
];

function defaultUtilityMeta(): UtilityMeta {
    return { rate: 0, mode: 'flat' };
}

export function UtilitySection({ node }: UtilitySectionProps) {
    const canvas = useCanvas();
    const capabilities = node.kind === 'field' ? getFieldPropertyCapabilities(node) : getOptionPropertyCapabilities(node);
    const role = capabilities.role;
    const utility = ((node.raw.meta as Record<string, unknown> | undefined)?.utility ?? undefined) as UtilityMeta | undefined;
    const hasStoredUtility = utility !== undefined;
    const hasUtilityConfiguration = role === 'utility' || hasStoredUtility;
    const resolvedUtility = utility ?? defaultUtilityMeta();
    const isActiveUtility = role === 'utility';

    const updateUtilityMeta = (patch: Partial<UtilityMeta>) => {
        const base = utility ?? defaultUtilityMeta();
        const nextMeta = mergeNodeMeta(node.raw.meta as Record<string, unknown> | undefined, {
            utility: {
                ...base,
                ...patch,
            },
        });

        if (node.kind === 'field') {
            canvas.api.editor.updateField(node.id, { meta: nextMeta } as any);
            return;
        }

        canvas.api.editor.updateOption(node.id, { meta: nextMeta } as any);
    };

    const addUtility = () => {
        canvas.api.editor.transact('addUtility', () => {
            canvas.api.editor.setService(node.id, { pricing_role: 'utility' });
            if (!utility) updateUtilityMeta(defaultUtilityMeta());
        });
    };

    const clearUtility = () => {
        canvas.api.editor.transact('clearUtility', () => {
            canvas.api.editor.setService(node.id, { pricing_role: 'base' });
            const nextMeta = mergeNodeMeta(node.raw.meta as Record<string, unknown> | undefined, {
                utility: undefined,
            });

            if (node.kind === 'field') {
                canvas.api.editor.updateField(node.id, { meta: nextMeta } as any);
                return;
            }

            canvas.api.editor.updateOption(node.id, { meta: nextMeta } as any);
        });
    };

    return (
        <Section>
            <Section.Header>
                <Section.Title>Utility</Section.Title>
                <Section.Actions>
                    {!hasStoredUtility && !isActiveUtility ? (
                        <SectionActionButton
                            icon={<BsPlus />}
                            iconOnly
                            tooltip="Add utility"
                            aria-label="Add utility"
                            onClick={addUtility}
                        />
                    ) : null}
                    {hasStoredUtility && !isActiveUtility ? (
                        <SectionActionButton
                            icon={<BsPencil />}
                            iconOnly
                            tooltip="Activate utility"
                            aria-label="Activate utility"
                            onClick={addUtility}
                        />
                    ) : null}
                    {hasUtilityConfiguration ? (
                        <SectionActionButton
                            icon={<MdDeleteOutline />}
                            iconOnly
                            tooltip="Clear utility"
                            aria-label="Clear utility"
                            onClick={clearUtility}
                        />
                    ) : null}
                </Section.Actions>
            </Section.Header>

            <Section.Content>
                {hasUtilityConfiguration ? (
                    <div className="space-y-3">
                        {!hasStoredUtility ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                This node is marked as utility-priced, but its utility marker is missing. Fill in the values below to repair it.
                            </p>
                        ) : null}

                        {hasStoredUtility && !isActiveUtility ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                This node still has utility marker values stored, but its pricing role is base. Activate utility to apply these
                                charges, or clear the marker.
                            </p>
                        ) : null}

                        <>
                            <InputField
                                variant="text"
                                label="Rate"
                                value={asInputValue(resolvedUtility.rate)}
                                placeholder="Enter utility rate"
                                onChange={(e) => updateUtilityMeta({ rate: parseFiniteNumber(e.value) })}
                            />
                            <InputField
                                variant="select"
                                label="Mode"
                                value={resolvedUtility.mode ?? 'flat'}
                                options={utilityModes as any}
                                onChange={(e) => {
                                    const nextMode = String(e.value ?? 'flat') as UtilityMode;
                                    updateUtilityMeta({
                                        mode: nextMode,
                                        valueBy: nextMode === 'per_value' ? (resolvedUtility.valueBy ?? 'value') : undefined,
                                        percentBase: nextMode === 'percent' ? resolvedUtility.percentBase : undefined,
                                    });
                                }}
                            />
                            {(resolvedUtility.mode ?? 'flat') === 'per_value' ? (
                                <InputField
                                    variant="select"
                                    label="Value source"
                                    value={resolvedUtility.valueBy ?? 'value'}
                                    options={
                                        [
                                            { label: 'Value', value: 'value' },
                                            { label: 'Length', value: 'length' },
                                        ] as any
                                    }
                                    onChange={(e) => updateUtilityMeta({ valueBy: String(e.value ?? 'value') as 'value' | 'length' })}
                                />
                            ) : null}
                            {(resolvedUtility.mode ?? 'flat') === 'percent' ? (
                                <InputField
                                    variant="select"
                                    label="Percent base"
                                    value={resolvedUtility.percentBase ?? ''}
                                    options={
                                        [
                                            { label: 'Service total', value: 'service_total' },
                                            { label: 'Base service', value: 'base_service' },
                                            { label: 'All', value: 'all' },
                                        ] as any
                                    }
                                    onChange={(e) =>
                                        updateUtilityMeta({
                                            percentBase: e.value ? (String(e.value) as 'service_total' | 'base_service' | 'all') : undefined,
                                        })
                                    }
                                />
                            ) : null}
                            <InputField
                                variant="text"
                                label="Label"
                                value={resolvedUtility.label ?? ''}
                                placeholder="Optional utility label"
                                onChange={(e) => updateUtilityMeta({ label: String(e.value ?? '').trim() || undefined })}
                            />
                        </>
                    </div>
                ) : null}
            </Section.Content>
        </Section>
    );
}

export default UtilitySection;
