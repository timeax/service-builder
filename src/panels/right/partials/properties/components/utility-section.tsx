import { Section } from '@/panels/right/components/sections.tsx';
import type { FieldNode, OptionNode } from '@timeax/digital-service-engine/core';
import type { UtilityMode } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { mergeNodeMeta, asInputValue, parseFiniteNumber } from './meta.ts';

type UtilitySectionProps = {
    node: FieldNode | OptionNode;
};

type UtilityMeta = {
    rate?: number;
    mode?: UtilityMode;
    valueBy?: 'value' | 'length';
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
    const role = (node.raw.pricing_role ?? 'base') as 'base' | 'utility';
    const utility = ((node.raw.meta as Record<string, unknown> | undefined)?.utility ?? undefined) as UtilityMeta | undefined;

    const patchField = (patch: Record<string, unknown>) => {
        canvas.api.editor.updateField(node.id, patch as any);
    };

    const patchOption = (patch: Record<string, unknown>) => {
        canvas.api.editor.updateOption(node.id, patch as any);
    };

    const updateUtilityMeta = (patch: Partial<UtilityMeta>) => {
        const base = utility ?? defaultUtilityMeta();
        const nextMeta = mergeNodeMeta(node.raw.meta as Record<string, unknown> | undefined, {
            utility: {
                ...base,
                ...patch,
            },
        });

        if (node.kind === 'field') {
            patchField({ meta: nextMeta });
            return;
        }

        patchOption({ meta: nextMeta });
    };

    const setRole = (nextRole: 'base' | 'utility') => {
        if (node.kind === 'option') {
            canvas.api.editor.setService(node.id, { pricing_role: nextRole });
        }

        const nextMeta = mergeNodeMeta(node.raw.meta as Record<string, unknown> | undefined, {
            utility: nextRole === 'utility' ? utility ?? defaultUtilityMeta() : undefined,
        });

        if (node.kind === 'field') {
            patchField({ pricing_role: nextRole, meta: nextMeta });
            return;
        }

        patchOption({ meta: nextMeta });
    };

    return (
        <Section>
            <Section.Header>
                <Section.Title>Utility</Section.Title>
            </Section.Header>

            <Section.Content>
                <div className="space-y-3">
                    <InputField
                        variant="select"
                        label="Pricing role"
                        value={role}
                        options={[
                            { label: 'Base', value: 'base' },
                            { label: 'Utility', value: 'utility' },
                        ] as any}
                        onChange={(e) => setRole(String(e.value ?? 'base') as 'base' | 'utility')}
                    />

                    {role === 'utility' ? (
                        <>
                            <InputField
                                variant="text"
                                label="Rate"
                                value={asInputValue(utility?.rate)}
                                placeholder="Enter utility rate"
                                onChange={(e) => updateUtilityMeta({ rate: parseFiniteNumber(e.value) })}
                            />
                            <InputField
                                variant="select"
                                label="Mode"
                                value={utility?.mode ?? 'flat'}
                                options={utilityModes as any}
                                onChange={(e) => updateUtilityMeta({ mode: String(e.value ?? 'flat') as UtilityMode })}
                            />
                            {(utility?.mode ?? 'flat') === 'per_value' ? (
                                <InputField
                                    variant="select"
                                    label="Value source"
                                    value={utility?.valueBy ?? 'value'}
                                    options={[
                                        { label: 'Value', value: 'value' },
                                        { label: 'Length', value: 'length' },
                                    ] as any}
                                    onChange={(e) => updateUtilityMeta({ valueBy: String(e.value ?? 'value') as 'value' | 'length' })}
                                />
                            ) : null}
                        </>
                    ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Switch this node to utility pricing to configure surcharge or fee behavior.
                        </p>
                    )}
                </div>
            </Section.Content>
        </Section>
    );
}

export default UtilitySection;
