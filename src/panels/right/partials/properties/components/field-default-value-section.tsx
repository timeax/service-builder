import { optionBreadcrumb, walkFieldOptions } from '@/builder/option-helpers.ts';
import { Button } from '@/components/ui/button.tsx';
import { Section } from '@/panels/right/components/sections.tsx';
import type { FieldNode } from '@timeax/digital-service-engine/core';
import type { Field } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useState } from 'react';

type FieldDefaultValue = string | number | boolean | null | Array<string | number | boolean | null>;

type FieldDefaultEditorApi = {
    setFieldDefaultValue?(fieldId: string, value: unknown): void;
    clearFieldDefaultValue?(fieldId: string): void;
    updateField?(fieldId: string, patch: Partial<Field> & { defaultValue?: unknown }): void;
};

function arrayValue(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value) return [value];
    return [];
}

function defaultToDraft(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
}

function parsePrimitiveDraft(value: string): FieldDefaultValue | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    const numeric = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(numeric) && String(numeric) === trimmed) return numeric;
    return trimmed;
}

function isMultiField(field: Field): boolean {
    return Boolean((field.meta as Record<string, unknown> | undefined)?.multi);
}

export function FieldDefaultValueSection({ node }: { node: FieldNode }) {
    const canvas = useCanvas();
    const editor = canvas.api.editor as unknown as FieldDefaultEditorApi;
    const field = node.raw as Field & { defaultValue?: unknown };
    const optionChoices = useMemo(
        () =>
            walkFieldOptions(field).map(({ option }) => ({
                label: optionBreadcrumb(field, option.id),
                value: option.id,
            })),
        [field],
    );
    const hasOptions = optionChoices.length > 0;
    const isMulti = isMultiField(field);
    const currentDefault = field.defaultValue;
    const [draft, setDraft] = useState(defaultToDraft(currentDefault));
    const [selected, setSelected] = useState<string[]>(arrayValue(currentDefault));

    useEffect(() => {
        setDraft(defaultToDraft(currentDefault));
        setSelected(arrayValue(currentDefault));
    }, [currentDefault, node.id]);

    const saveValue = (value: unknown) => {
        if (value === undefined || (Array.isArray(value) && value.length === 0)) {
            if (editor.clearFieldDefaultValue) {
                editor.clearFieldDefaultValue(node.id);
            } else {
                editor.updateField?.(node.id, { defaultValue: undefined });
            }
            return;
        }

        if (editor.setFieldDefaultValue) {
            editor.setFieldDefaultValue(node.id, value);
        } else {
            editor.updateField?.(node.id, { defaultValue: value });
        }
    };

    return (
        <Section>
            <Section.Header>
                <Section.Title>Order default value</Section.Title>
            </Section.Header>
            <Section.Content>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    Initial value for a new order. Input appearance props remain in field defaults below.
                </p>
                {hasOptions && isMulti ? (
                    <InputField
                        variant="checkbox"
                        label="Default value"
                        value={selected}
                        options={optionChoices as never}
                        onChange={(event) => {
                            const next = arrayValue(event.value);
                            setSelected(next);
                            saveValue(next);
                        }}
                    />
                ) : hasOptions ? (
                    <InputField
                        variant="select"
                        label="Default value"
                        value={selected[0] ?? ''}
                        options={[{ label: 'None', value: '' }, ...optionChoices] as never}
                        onChange={(event) => {
                            const next = arrayValue(event.value)[0];
                            setSelected(next ? [next] : []);
                            saveValue(next);
                        }}
                    />
                ) : (
                    <div className="space-y-2">
                        <InputField
                            variant="text"
                            label="Default value"
                            value={draft}
                            onChange={(event) => setDraft(String(event.value ?? ''))}
                            onBlur={() => saveValue(parsePrimitiveDraft(draft))}
                        />
                        {currentDefault !== undefined ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => saveValue(undefined)}>
                                Clear
                            </Button>
                        ) : null}
                    </div>
                )}
            </Section.Content>
        </Section>
    );
}

export default FieldDefaultValueSection;
