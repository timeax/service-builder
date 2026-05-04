import { cn } from '@/lib/utils.ts';
import { Section, SectionActionButton } from '@/panels/right/components/sections.tsx';
import type { FieldNode, OptionNode, TagNode } from '@timeax/digital-service-engine/core';
import type { QuantityRule } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useMemo } from 'react';
import { BsPatchPlus, BsPlus } from 'react-icons/bs';
import { MdDeleteOutline } from 'react-icons/md';
import { asInputValue, buildQuantityRule, mergeNodeMeta, parseFiniteNumber } from './meta.ts';
import { getNodePropertyCapabilities } from './node-capabilities.ts';

type QuantitySectionProps = {
    node: TagNode | FieldNode | OptionNode;
};

const ruleOptions: Array<{ label: string; value: QuantityRule['valueBy'] }> = [
    { label: 'Value', value: 'value' },
    { label: 'Length', value: 'length' },
    { label: 'Eval', value: 'eval' },
];

export function QuantitySection({ node }: QuantitySectionProps) {
    const canvas = useCanvas();
    const capabilities = getNodePropertyCapabilities(node);

    const fieldRule = useMemo(
        () => (node.kind === 'field' ? canvas.api.editor.getFieldQuantityRule(node.id) : undefined),
        [canvas.api.editor, canvas.props, node],
    );

    const quantityDefault =
        node.kind === 'field'
            ? (node.raw as any).quantityDefault
            : (node.raw.meta as Record<string, unknown> | undefined)?.quantityDefault;

    const clearQuantityRule = () => {
        if (node.kind !== 'field') return;
        canvas.api.editor.clearFieldQuantityRule(node.id);
    };

    const initializeQuantityRule = () => {
        if (node.kind !== 'field') return;
        canvas.api.editor.setFieldQuantityRule(node.id, buildQuantityRule('value'));
    };

    const clearQuantityDefault = () => {
        updateQuantityDefault(undefined);
    };

    const initializeQuantityDefault = () => {
        updateQuantityDefault(1);
    };

    const updateQuantityDefault = (value: unknown) => {
        const parsed = parseFiniteNumber(value);

        if (node.kind === 'field') {
            canvas.api.editor.updateField(node.id, { quantityDefault: parsed } as any);
            return;
        }

        const nextMeta = mergeNodeMeta(node.raw.meta as Record<string, unknown> | undefined, {
            quantityDefault: parsed,
        });

        if (node.kind === 'tag') {
            canvas.api.editor.updateTag(node.id, { meta: nextMeta } as any);
            return;
        }

        canvas.api.editor.updateOption(node.id, { meta: nextMeta } as any);
    };

    const setRuleValueBy = (valueBy: QuantityRule['valueBy']) => {
        if (node.kind !== 'field') return;
        const next = buildQuantityRule(valueBy, fieldRule ?? {});
        canvas.api.editor.setFieldQuantityRule(node.id, next);
    };

    const updateRule = (patch: Partial<QuantityRule>) => {
        if (node.kind !== 'field') return;
        const next = buildQuantityRule(fieldRule?.valueBy ?? 'value', {
            ...(fieldRule ?? {}),
            ...patch,
        });
        canvas.api.editor.setFieldQuantityRule(node.id, next);
    };

    const hasFieldRule = capabilities.quantity.canEditRule && Boolean(fieldRule);
    const hasQuantityDefault = capabilities.quantity.canEditDefault && quantityDefault !== undefined;
    const canAddRule = capabilities.quantity.canEditRule && !hasFieldRule;
    const canAddDefault = capabilities.quantity.canEditDefault && !hasQuantityDefault;

    return (
        <Section>
            <Section.Header>
                <Section.Title>Quantity</Section.Title>
                {canAddRule || canAddDefault || hasFieldRule || hasQuantityDefault ? (
                    <Section.Actions>
                        {canAddRule ? (
                            <SectionActionButton
                                icon={<BsPlus />}
                                iconOnly
                                tooltip="Add quantity rule"
                                aria-label="Add quantity rule"
                                onClick={initializeQuantityRule}
                            />
                        ) : null}
                        {canAddDefault ? (
                            <SectionActionButton
                                icon={<BsPatchPlus />}
                                badge="1"
                                iconOnly
                                tooltip="Add quantity default"
                                aria-label="Add quantity default"
                                onClick={initializeQuantityDefault}
                            />
                        ) : null}
                        {hasFieldRule ? (
                            <SectionActionButton
                                icon={<MdDeleteOutline />}
                                badge="fx"
                                iconOnly
                                tooltip="Clear quantity rule"
                                aria-label="Clear quantity rule"
                                onClick={clearQuantityRule}
                            />
                        ) : null}
                        {hasQuantityDefault ? (
                            <SectionActionButton
                                icon={<MdDeleteOutline />}
                                badge="1"
                                iconOnly
                                tooltip="Clear quantity default"
                                aria-label="Clear quantity default"
                                onClick={clearQuantityDefault}
                            />
                        ) : null}
                    </Section.Actions>
                ) : null}
            </Section.Header>

            <Section.Content>
                {node.kind === 'field' ? (
                    <div className="space-y-4">
                        {hasFieldRule ? (
                            <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                                        {ruleOptions.map((option) => {
                                            const active = fieldRule?.valueBy === option.value;

                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setRuleValueBy(option.value)}
                                                    className={cn(
                                                        'rounded-md px-3 py-2 text-sm font-medium transition',
                                                        active
                                                            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                                                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
                                                    )}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {capabilities.quantity.ruleHelp ? (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{capabilities.quantity.ruleHelp}</p>
                                    ) : null}
                                </div>

                                {fieldRule?.valueBy === 'eval' ? (
                                    <InputField
                                        variant="textarea"
                                        label="Eval code"
                                        value={fieldRule.code ?? ''}
                                        placeholder="return Number(value) * 2;"
                                        onChange={(e) => updateRule({ code: String(e.value ?? '') })}
                                    />
                                ) : null}

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <InputField
                                        variant="text"
                                        label="Multiply"
                                        value={asInputValue(fieldRule?.multiply)}
                                        placeholder="Optional multiplier"
                                        onChange={(e) => updateRule({ multiply: parseFiniteNumber(e.value) })}
                                    />
                                    <InputField
                                        variant="text"
                                        label="Fallback"
                                        value={asInputValue(fieldRule?.fallback)}
                                        placeholder="Optional fallback quantity"
                                        onChange={(e) => updateRule({ fallback: parseFiniteNumber(e.value) })}
                                    />
                                    <InputField
                                        variant="text"
                                        label="Clamp min"
                                        value={asInputValue(fieldRule?.clamp?.min)}
                                        placeholder="Optional minimum"
                                        onChange={(e) =>
                                            updateRule({
                                                clamp: {
                                                    min: parseFiniteNumber(e.value),
                                                    max: fieldRule?.clamp?.max,
                                                },
                                            })
                                        }
                                    />
                                    <InputField
                                        variant="text"
                                        label="Clamp max"
                                        value={asInputValue(fieldRule?.clamp?.max)}
                                        placeholder="Optional maximum"
                                        onChange={(e) =>
                                            updateRule({
                                                clamp: {
                                                    min: fieldRule?.clamp?.min,
                                                    max: parseFiniteNumber(e.value),
                                                },
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        ) : null}

                        {capabilities.quantity.canEditDefault ? (
                            hasQuantityDefault ? (
                                <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                    <InputField
                                        variant="text"
                                        label="Quantity default"
                                        value={asInputValue((node.raw as any).quantityDefault)}
                                        placeholder="Leave blank to fall back"
                                        onChange={(e) => updateQuantityDefault(e.value)}
                                    />
                                    {capabilities.quantity.defaultHelp ? (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{capabilities.quantity.defaultHelp}</p>
                                    ) : null}
                                </div>
                            ) : null
                        ) : null}
                    </div>
                ) : (
                    hasQuantityDefault ? (
                        <div className="space-y-2">
                            <InputField
                                variant="text"
                                label="Quantity default"
                                value={asInputValue(quantityDefault)}
                                placeholder="Leave blank to inherit/fall back"
                                onChange={(e) => updateQuantityDefault(e.value)}
                            />
                            {capabilities.quantity.defaultHelp ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">{capabilities.quantity.defaultHelp}</p>
                            ) : null}
                        </div>
                    ) : null
                )}
            </Section.Content>
        </Section>
    );
}

export default QuantitySection;
