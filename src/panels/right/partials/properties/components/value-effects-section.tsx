import { optionBreadcrumb, walkFieldOptions } from '@/builder/option-helpers.ts';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { IncludesList, Section, SectionActionButton, SectionActionTriggerButton } from '@/panels/right/components/sections.tsx';
import type { FieldNode, OptionNode, TagNode } from '@timeax/digital-service-engine/core';
import type { Field } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useState } from 'react';
import { BsPencil, BsPlus } from 'react-icons/bs';
import { MdOutlineRemoveCircleOutline } from 'react-icons/md';
import type { TriggerMappingCapability } from './node-capabilities.ts';

type TriggerNode = TagNode | FieldNode | OptionNode;

type Scalar = string | number | boolean | null;

type FieldValueEffect = {
    value: Scalar | Scalar[];
    mode?: 'always' | 'if_empty';
    clearOnDeactivate?: boolean;
};

type ValueEffectsProps = {
    value_effects_for_triggers?: Record<string, Record<string, FieldValueEffect>>;
};

type ValueEffectEditorApi = {
    setValueEffect?(triggerId: string, targetFieldId: string, effect: FieldValueEffect | undefined | null): void;
    clearValueEffect?(triggerId: string, targetFieldId: string): void;
    updateField?(fieldId: string, patch: Partial<Field>): void;
    patchProps?(updater: (draft: ValueEffectsProps) => void): void;
};

type FieldChoice = {
    label: string;
    value: string;
    description?: string;
};

function arrayValue(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value) return [value];
    return [];
}

function scalarDraft(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.map(String).join(', ');
    return String(value);
}

function parseScalarDraft(value: string): Scalar | undefined {
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

function isSystemInactive(node: unknown): boolean {
    const value = node as { inactive?: unknown; disabled?: unknown; meta?: { inactive?: unknown; disabled?: unknown } };
    return value?.inactive === true || value?.disabled === true || value?.meta?.inactive === true || value?.meta?.disabled === true;
}

function triggerOwnerFieldId(node: TriggerNode): string | undefined {
    if (node.kind === 'field') return node.id;
    if (node.kind === 'option') return node.field().id;
    return undefined;
}

function effectValueSummary(field: Field | undefined, effect: FieldValueEffect | undefined): string {
    if (!effect) return 'None';
    const values = Array.isArray(effect.value) ? effect.value : [effect.value];
    if (!field?.options?.length) return values.map((value) => String(value)).join(', ');
    return values.map((id) => optionBreadcrumb(field, String(id))).join(', ');
}

function optionChoices(field: Field | undefined): FieldChoice[] {
    if (!field) return [];
    return walkFieldOptions(field).map(({ option }) => ({
        label: optionBreadcrumb(field, option.id),
        value: option.id,
    }));
}

function fallbackSetValueEffect(
    canvas: ReturnType<typeof useCanvas>,
    triggerId: string,
    targetFieldId: string,
    effect: FieldValueEffect | undefined | null,
) {
    const props = canvas.props as ValueEffectsProps;
    const nextMap: Record<string, Record<string, FieldValueEffect>> = {
        ...(props.value_effects_for_triggers ?? {}),
    };
    const targetMap = { ...(nextMap[triggerId] ?? {}) };
    if (!effect) delete targetMap[targetFieldId];
    else targetMap[targetFieldId] = effect;

    if (Object.keys(targetMap).length) nextMap[triggerId] = targetMap;
    else delete nextMap[triggerId];

    (canvas.api.editor as unknown as ValueEffectEditorApi).patchProps?.((draft) => {
        if (Object.keys(nextMap).length) draft.value_effects_for_triggers = nextMap;
        else delete draft.value_effects_for_triggers;
    });
}

export function ValueEffectsSection({ node, capability }: { node: TriggerNode; capability?: TriggerMappingCapability }) {
    const canvas = useCanvas();
    const [open, setOpen] = useState(false);
    const [editingTargetId, setEditingTargetId] = useState<string | undefined>();
    const canEdit = capability?.canEdit ?? true;
    const ownerFieldId = triggerOwnerFieldId(node);
    const fields = (canvas.props.fields ?? []).filter((field) => field.id !== ownerFieldId && !isSystemInactive(field));
    const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
    const effectMap = useMemo(
        () => ((canvas.props as ValueEffectsProps).value_effects_for_triggers?.[node.id] ?? {}) as Record<string, FieldValueEffect>,
        [canvas.props, node.id],
    );
    const rules = useMemo(
        () =>
            Object.entries(effectMap).sort(([left], [right]) => {
                const leftLabel = fieldsById.get(left)?.label ?? left;
                const rightLabel = fieldsById.get(right)?.label ?? right;
                return leftLabel.localeCompare(rightLabel);
            }),
        [effectMap, fieldsById],
    );
    const fieldOptions = useMemo<FieldChoice[]>(
        () =>
            fields.map((field) => ({
                label: field.label,
                value: field.id,
                description: field.description,
            })),
        [fields],
    );

    if (!canEdit) return null;

    const closeEditor = () => {
        setEditingTargetId(undefined);
        setOpen(false);
    };

    const clear = (targetFieldId: string) => {
        const editor = canvas.api.editor as unknown as ValueEffectEditorApi;
        if (editor.clearValueEffect) editor.clearValueEffect(node.id, targetFieldId);
        else fallbackSetValueEffect(canvas, node.id, targetFieldId, undefined);
    };

    return (
        <Section>
            <Section.Header>
                <Section.Title>Value effects</Section.Title>
                <Section.Actions>
                    <ValueEffectEditor
                        open={open}
                        onOpenChange={(nextOpen) => {
                            setOpen(nextOpen);
                            if (!nextOpen) setEditingTargetId(undefined);
                        }}
                        triggerId={node.id}
                        targetFieldId={editingTargetId}
                        fields={fields}
                        fieldOptions={fieldOptions}
                        effect={editingTargetId ? effectMap[editingTargetId] : undefined}
                        onClose={closeEditor}
                    />
                </Section.Actions>
            </Section.Header>
            <Section.Content>
                {capability?.message ? <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{capability.message}</p> : null}
                {rules.length ? (
                    <IncludesList>
                        {rules.map(([targetFieldId, effect]) => {
                            const field = fieldsById.get(targetFieldId);
                            return (
                                <div key={targetFieldId} className="rounded-md bg-gray-50 p-2 dark:bg-gray-800/50">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                                                {field?.label ?? `Missing Target (ID: ${targetFieldId})`}
                                            </div>
                                            <dl className="mt-1 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                <div>
                                                    <dt className="inline font-semibold">Value:</dt>{' '}
                                                    <dd className="inline">{effectValueSummary(field, effect)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="inline font-semibold">Mode:</dt>{' '}
                                                    <dd className="inline">{effect.mode === 'if_empty' ? 'If empty' : 'Always'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="inline font-semibold">Clear on deactivation:</dt>{' '}
                                                    <dd className="inline">{effect.clearOnDeactivate ? 'Yes' : 'No'}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                                                aria-label={`Edit ${field?.label ?? targetFieldId} value effect`}
                                                title="Edit"
                                                onClick={() => {
                                                    setEditingTargetId(targetFieldId);
                                                    setOpen(true);
                                                }}
                                            >
                                                <span className="text-lg">
                                                    <BsPencil />
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                                                aria-label={`Remove ${field?.label ?? targetFieldId} value effect`}
                                                title="Remove"
                                                onClick={() => clear(targetFieldId)}
                                            >
                                                <span className="text-lg">
                                                    <MdOutlineRemoveCircleOutline />
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </IncludesList>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
                )}
            </Section.Content>
        </Section>
    );
}

type ValueEffectEditorProps = {
    open: boolean;
    onOpenChange(open: boolean): void;
    triggerId: string;
    targetFieldId?: string;
    fields: Field[];
    fieldOptions: FieldChoice[];
    effect?: FieldValueEffect;
    onClose(): void;
};

function ValueEffectEditor({ open, onOpenChange, triggerId, targetFieldId, fields, fieldOptions, effect, onClose }: ValueEffectEditorProps) {
    const canvas = useCanvas();
    const [target, setTarget] = useState(targetFieldId ?? fields[0]?.id ?? '');
    const [mode, setMode] = useState<'always' | 'if_empty'>(effect?.mode === 'if_empty' ? 'if_empty' : 'always');
    const [clearOnDeactivate, setClearOnDeactivate] = useState(Boolean(effect?.clearOnDeactivate));
    const [primitiveDraft, setPrimitiveDraft] = useState(scalarDraft(effect?.value));
    const [selectedOptions, setSelectedOptions] = useState<string[]>(arrayValue(effect?.value));

    useEffect(() => {
        setTarget(targetFieldId ?? fields[0]?.id ?? '');
        setMode(effect?.mode === 'if_empty' ? 'if_empty' : 'always');
        setClearOnDeactivate(Boolean(effect?.clearOnDeactivate));
        setPrimitiveDraft(scalarDraft(effect?.value));
        setSelectedOptions(arrayValue(effect?.value));
    }, [effect, fields, targetFieldId, open]);

    const targetField = fields.find((field) => field.id === target);
    const choices = useMemo(() => optionChoices(targetField), [targetField]);
    const hasOptions = choices.length > 0;
    const isMulti = targetField ? isMultiField(targetField) : false;

    const save = () => {
        if (!target) return;
        const value = hasOptions ? (isMulti ? selectedOptions : selectedOptions[0]) : parseScalarDraft(primitiveDraft);
        if (value === undefined || (Array.isArray(value) && !value.length)) return;
        const effect: FieldValueEffect = {
            value,
            ...(mode === 'if_empty' ? { mode } : {}),
            ...(clearOnDeactivate ? { clearOnDeactivate: true } : {}),
        };
        const editor = canvas.api.editor as unknown as ValueEffectEditorApi;
        if (editor.setValueEffect) editor.setValueEffect(triggerId, target, effect);
        else fallbackSetValueEffect(canvas, triggerId, target, effect);
        onClose();
    };

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <SectionActionTriggerButton icon={<BsPlus />}>Add</SectionActionTriggerButton>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
                <div className="flex flex-col gap-3">
                    <InputField
                        variant="select"
                        label="Target field"
                        value={target}
                        options={fieldOptions as never}
                        onChange={(event) => {
                            setTarget(String(event.value ?? ''));
                            setSelectedOptions([]);
                            setPrimitiveDraft('');
                        }}
                    />
                    {hasOptions && isMulti ? (
                        <InputField
                            variant="checkbox"
                            label="Value"
                            value={selectedOptions}
                            options={choices as never}
                            onChange={(event) => setSelectedOptions(arrayValue(event.value))}
                        />
                    ) : hasOptions ? (
                        <InputField
                            variant="select"
                            label="Value"
                            clearable
                            value={selectedOptions[0] ?? ''}
                            options={choices as never}
                            onChange={(event) => setSelectedOptions(arrayValue(event.value))}
                        />
                    ) : (
                        <InputField
                            variant="text"
                            label="Value"
                            value={primitiveDraft}
                            onChange={(event) => setPrimitiveDraft(String(event.value ?? ''))}
                        />
                    )}
                    <InputField
                        variant="select"
                        label="Assignment mode"
                        value={mode}
                        options={
                            [
                                { label: 'Always', value: 'always' },
                                { label: 'If empty', value: 'if_empty' },
                            ] as never
                        }
                        onChange={(event) => setMode(event.value === 'if_empty' ? 'if_empty' : 'always')}
                    />
                    <InputField
                        variant="toggle"
                        label="Clear on deactivation"
                        value={clearOnDeactivate}
                        onChange={(event) => setClearOnDeactivate(Boolean(event.value))}
                    />
                    <div className="flex justify-end gap-2">
                        <SectionActionButton onClick={onClose}>Cancel</SectionActionButton>
                        <Button type="button" size="sm" onClick={save} disabled={!target}>
                            Save
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default ValueEffectsSection;
