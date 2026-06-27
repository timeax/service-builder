import { optionBreadcrumb, walkFieldOptions } from '@/builder/option-helpers.ts';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { IncludesList, Section, SectionActionButton, SectionActionTriggerButton } from '@/panels/right/components/sections.tsx';
import type { FieldNode, OptionNode } from '@timeax/digital-service-engine/core';
import type { Field } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useState } from 'react';
import { BsPencil, BsPlus } from 'react-icons/bs';
import { MdOutlineRemoveCircleOutline } from 'react-icons/md';
import type { TriggerMappingCapability } from './node-capabilities.ts';

type OptionEffectsSectionProps = {
    node: FieldNode | OptionNode;
    capability?: TriggerMappingCapability;
};

type OptionChoice = {
    label: string;
    value: string;
    depth: number;
    description?: string;
};

type FieldChoice = {
    label: string;
    value: string;
    description?: string;
};

type OptionEffectForButton = {
    forceVisible?: boolean;
    include?: string[];
    exclude?: string[];
};

type OptionEffectsProps = {
    option_effects_for_buttons?: Record<string, Record<string, OptionEffectForButton>>;
};

type OptionEffectEditorApi = {
    setOptionEffect(triggerId: string, targetFieldId: string, effect: OptionEffectForButton | undefined | null): void;
    clearOptionEffect(triggerId: string, targetFieldId: string): void;
};

function arrayValue(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value) return [value];
    return [];
}

function effectSummary(field: Field | undefined, ids: readonly string[] | undefined): string {
    if (!field || !ids?.length) return 'None';
    return ids.map((id) => optionBreadcrumb(field, id)).join(', ');
}

function getFieldOptions(field: Field | undefined): OptionChoice[] {
    if (!field) return [];
    return walkFieldOptions(field).map(({ option, depth }) => ({
        label: optionBreadcrumb(field, option.id),
        value: option.id,
        depth,
        description: depth ? `Child option on ${field.label}` : field.label,
    }));
}

function normalizeDraft(effect: OptionEffectForButton): OptionEffectForButton {
    const next: OptionEffectForButton = {};
    if (effect.forceVisible === true) next.forceVisible = true;
    if (effect.include?.length) next.include = effect.include;
    if (effect.exclude?.length) next.exclude = effect.exclude;
    return next;
}

export function OptionEffectsSection({ node, capability }: OptionEffectsSectionProps) {
    const canvas = useCanvas();
    const [open, setOpen] = useState(false);
    const [editingTargetId, setEditingTargetId] = useState<string | undefined>();
    const canEdit = capability?.canEdit ?? true;
    const sourceFieldId = node.kind === 'option' ? node.field().id : undefined;
    const fields = (canvas.props.fields ?? []).filter((field) => field.id !== sourceFieldId);
    const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
    const effectMap = ((canvas.props as OptionEffectsProps).option_effects_for_buttons?.[node.id] ?? {}) as Record<string, OptionEffectForButton>;
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

    return (
        <Section>
            <Section.Header>
                <Section.Title>Option effects</Section.Title>
                <Section.Actions>
                    <OptionEffectEditor
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
                            const include = effectSummary(field, effect.include);
                            const exclude = effectSummary(field, effect.exclude);
                            return (
                                <div key={targetFieldId} className="rounded-md bg-gray-50 p-2 dark:bg-gray-800/50">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                                                {field?.label ?? `Missing Target (ID: ${targetFieldId})`}
                                            </div>
                                            <dl className="mt-1 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                <div>
                                                    <dt className="inline font-semibold">Force visible:</dt>{' '}
                                                    <dd className="inline">{effect.forceVisible ? 'Yes' : 'No'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="inline font-semibold">Include:</dt> <dd className="inline">{include}</dd>
                                                </div>
                                                <div>
                                                    <dt className="inline font-semibold">Exclude:</dt> <dd className="inline">{exclude}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                                                aria-label={`Edit ${field?.label ?? targetFieldId} option effect`}
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
                                                aria-label={`Remove ${field?.label ?? targetFieldId} option effect`}
                                                title="Remove"
                                                onClick={() =>
                                                    (canvas.api.editor as unknown as OptionEffectEditorApi).clearOptionEffect(node.id, targetFieldId)
                                                }
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

type OptionEffectEditorProps = {
    open: boolean;
    onOpenChange(open: boolean): void;
    triggerId: string;
    targetFieldId?: string;
    fields: Field[];
    fieldOptions: FieldChoice[];
    effect?: OptionEffectForButton;
    onClose(): void;
};

function OptionEffectEditor({ open, onOpenChange, triggerId, targetFieldId, fields, fieldOptions, effect, onClose }: OptionEffectEditorProps) {
    const canvas = useCanvas();
    const [target, setTarget] = useState(targetFieldId ?? fields[0]?.id ?? '');
    const [forceVisible, setForceVisible] = useState(Boolean(effect?.forceVisible));
    const [include, setInclude] = useState<string[]>(effect?.include ?? []);
    const [exclude, setExclude] = useState<string[]>(effect?.exclude ?? []);

    useEffect(() => {
        setTarget(targetFieldId ?? fields[0]?.id ?? '');
        setForceVisible(Boolean(effect?.forceVisible));
        setInclude(effect?.include ?? []);
        setExclude(effect?.exclude ?? []);
    }, [effect, fields, targetFieldId, open]);

    const targetField = fields.find((field) => field.id === target);
    const optionChoices = useMemo(() => getFieldOptions(targetField), [targetField]);
    const hasOptions = optionChoices.length > 0;

    const handleTargetChange = (value: unknown) => {
        const nextTarget = String(value ?? '');
        setTarget(nextTarget);
        const nextField = fields.find((field) => field.id === nextTarget);
        if (!getFieldOptions(nextField).length) {
            setInclude([]);
            setExclude([]);
        }
    };

    const save = () => {
        if (!target) return;
        (canvas.api.editor as unknown as OptionEffectEditorApi).setOptionEffect(
            triggerId,
            target,
            normalizeDraft({
                forceVisible,
                include: hasOptions ? include : undefined,
                exclude: hasOptions ? exclude : undefined,
            }),
        );
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
                        options={fieldOptions as any}
                        onChange={(e) => handleTargetChange(e.value)}
                    />
                    <InputField variant="toggle" label="Force visible" value={forceVisible} onChange={(e) => setForceVisible(Boolean(e.value))} />
                    {hasOptions ? (
                        <>
                            <InputField
                                variant="checkbox"
                                label="Include options"
                                value={include}
                                options={optionChoices as any}
                                onChange={(e) => setInclude(arrayValue(e.value))}
                            />
                            <InputField
                                variant="checkbox"
                                label="Exclude options"
                                value={exclude}
                                options={optionChoices as any}
                                onChange={(e) => setExclude(arrayValue(e.value))}
                            />
                        </>
                    ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            This target field has no options. Only force-visible behavior can be saved.
                        </p>
                    )}
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

export default OptionEffectsSection;
