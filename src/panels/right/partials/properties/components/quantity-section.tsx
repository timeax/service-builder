import { cn } from '@/lib/utils.ts';
import { Section, SectionActionButton } from '@/panels/right/components/sections.tsx';
import type { FieldNode, OptionNode, TagNode } from '@timeax/digital-service-engine/core';
import type { QuantityRule } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useMemo } from 'react';
import { TiDelete } from 'react-icons/ti';
import { asInputValue, buildQuantityRule, mergeNodeMeta, parseFiniteNumber } from './meta.ts';

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

    const fieldRule = useMemo(
        () => (node.kind === 'field' ? canvas.api.editor.getFieldQuantityRule(node.id) : undefined),
        [canvas.api.editor, canvas.props, node],
    );

    const quantityDefault =
        node.kind === 'field'
            ? (node.raw as any).quantityDefault
            : (node.raw.meta as Record<string, unknown> | undefined)?.quantityDefault;

    const clearQuantity = () => {
        if (node.kind === 'field') {
            canvas.api.editor.clearFieldQuantityRule(node.id);
            return;
        }

        const nextMeta = mergeNodeMeta(node.raw.meta as Record<string, unknown> | undefined, {
            quantityDefault: undefined,
        });

        if (node.kind === 'tag') {
            canvas.api.editor.updateTag(node.id, { meta: nextMeta } as any);
            return;
        }

        canvas.api.editor.updateOption(node.id, { meta: nextMeta } as any);
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
        const next = buildQuantityRule(valueBy, valueBy === 'eval' ? fieldRule?.code : undefined);
        canvas.api.editor.setFieldQuantityRule(node.id, next);
    };

    const setRuleCode = (code: string) => {
        if (node.kind !== 'field') return;
        const next = buildQuantityRule(fieldRule?.valueBy ?? 'eval', code);
        canvas.api.editor.setFieldQuantityRule(node.id, next);
    };

    const showClearAction = node.kind === 'field' ? Boolean(fieldRule) : quantityDefault !== undefined;

    return (
        <Section>
            <Section.Header>
                <Section.Title>Quantity</Section.Title>
                {showClearAction ? (
                    <Section.Actions>
                        <SectionActionButton icon={<TiDelete />} onClick={clearQuantity}>
                            Clear
                        </SectionActionButton>
                    </Section.Actions>
                ) : null}
            </Section.Header>

            <Section.Content>
                {node.kind === 'field' ? (
                    <div className="space-y-4">
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
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                The first visible field with a quantity rule drives the snapshot quantity.
                            </p>
                        </div>

                        {fieldRule?.valueBy === 'eval' ? (
                            <InputField
                                variant="textarea"
                                label="Eval code"
                                value={fieldRule.code ?? ''}
                                placeholder="return Number(value) * 2;"
                                onChange={(e) => setRuleCode(String(e.value ?? ''))}
                            />
                        ) : null}

                        {node.raw.button ? (
                            <InputField
                                variant="text"
                                label="Quantity default"
                                value={asInputValue((node.raw as any).quantityDefault)}
                                placeholder="Leave blank to use host defaults"
                                onChange={(e) => updateQuantityDefault(e.value)}
                            />
                        ) : null}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <InputField
                            variant="text"
                            label="Quantity default"
                            value={asInputValue(quantityDefault)}
                            placeholder="Leave blank to inherit/fall back"
                            onChange={(e) => updateQuantityDefault(e.value)}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Stores the schema-backed quantity seed for this {node.kind}.
                        </p>
                    </div>
                )}
            </Section.Content>
        </Section>
    );
}

export default QuantitySection;
