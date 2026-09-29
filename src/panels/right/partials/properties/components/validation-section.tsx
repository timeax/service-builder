import { Button } from '@/components/ui/button.tsx';
import { Section, SectionActionButton } from '@/panels/right/components/sections.tsx';
import { InputField } from '@timeax/form-palette';
import { BsPlus } from 'react-icons/bs';
import { MdDeleteOutline } from 'react-icons/md';
import { parseFiniteNumber } from './meta.ts';

type FieldValidationOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'nin' | 'truthy' | 'falsy' | 'match';
type FieldValidationValueBy = 'value' | 'length' | 'eval';
export type FieldValidationEditorRule = {
    op: FieldValidationOp;
    valueBy?: FieldValidationValueBy;
    value?: string | number | boolean | null;
    min?: number;
    max?: number;
    values?: Array<string | number | boolean | null>;
    pattern?: string;
    flags?: string;
    code?: string;
    expressionBody?: string;
    message?: string;
};
type FieldValidationRule = FieldValidationEditorRule;

type ScalarType = 'string' | 'number' | 'boolean';
type ScalarValue = string | number | boolean;

const opOptions: Array<{ label: string; value: FieldValidationOp }> = [
    { label: 'Equals', value: 'eq' },
    { label: 'Not equal', value: 'neq' },
    { label: 'Greater than', value: 'gt' },
    { label: 'Greater or equal', value: 'gte' },
    { label: 'Less than', value: 'lt' },
    { label: 'Less or equal', value: 'lte' },
    { label: 'Between', value: 'between' },
    { label: 'In list', value: 'in' },
    { label: 'Not in list', value: 'nin' },
    { label: 'Truthy', value: 'truthy' },
    { label: 'Falsy', value: 'falsy' },
    { label: 'Matches pattern', value: 'match' },
] as const;

const valueByOptions: Array<{ label: string; value: FieldValidationValueBy }> = [
    { label: 'Value', value: 'value' },
    { label: 'Length', value: 'length' },
    { label: 'Eval', value: 'eval' },
] as const;

const singleValueOps = new Set<FieldValidationOp>(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);
const listValueOps = new Set<FieldValidationOp>(['in', 'nin']);

const createDefaultRule = (): FieldValidationRule => ({
    op: 'truthy',
});

const inferScalarType = (value: unknown): ScalarType => {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
};

const defaultScalarValue = (type: ScalarType): ScalarValue => {
    if (type === 'number') return 0;
    if (type === 'boolean') return false;
    return '';
};

const castScalarValue = (value: unknown, type: ScalarType): ScalarValue => {
    if (type === 'number') {
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }

    if (type === 'boolean') {
        return typeof value === 'boolean' ? value : Boolean(value);
    }

    return value === undefined || value === null ? '' : String(value);
};

const sanitizeRule = (rule: FieldValidationRule): FieldValidationRule => {
    const next: FieldValidationRule = {
        op: rule.op,
    };

    if (rule.valueBy && rule.valueBy !== 'value') next.valueBy = rule.valueBy;
    if (typeof rule.message === 'string' && rule.message.trim()) next.message = rule.message;
    if (typeof rule.code === 'string' && rule.code.trim()) next.code = rule.code;
    if (rule.valueBy === 'eval') next.expressionBody = rule.expressionBody ?? '';

    if (singleValueOps.has(rule.op)) {
        next.value = rule.value ?? '';
    }

    if (rule.op === 'between') {
        if (typeof rule.min === 'number' && Number.isFinite(rule.min)) next.min = rule.min;
        if (typeof rule.max === 'number' && Number.isFinite(rule.max)) next.max = rule.max;
    }

    if (listValueOps.has(rule.op)) {
        next.values = Array.isArray(rule.values) ? rule.values.filter((value) => ['string', 'number', 'boolean'].includes(typeof value)) : [];
    }

    if (rule.op === 'match') {
        if (typeof rule.pattern === 'string') next.pattern = rule.pattern;
        if (typeof rule.flags === 'string' && rule.flags) next.flags = rule.flags;
    }

    return next;
};

function TypedScalarEditor({
    label,
    value,
    onChange,
}: {
    label: string;
    value: unknown;
    onChange: (value: ScalarValue) => void;
}) {
    const scalarType = inferScalarType(value);

    return (
        <div className="space-y-3 rounded-lg border border-slate-200/80 p-3 dark:border-slate-800">
            <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                <InputField
                    variant="select"
                    label={`${label} type`}
                    value={scalarType}
                    options={[
                        { label: 'String', value: 'string' },
                        { label: 'Number', value: 'number' },
                        { label: 'Boolean', value: 'boolean' },
                    ]}
                    onChange={(event) => onChange(defaultScalarValue(String(event.value ?? 'string') as ScalarType))}
                />

                {scalarType === 'boolean' ? (
                    <InputField
                        variant="toggle"
                        label={label}
                        value={Boolean(value)}
                        onChange={(event) => onChange(Boolean(event.value))}
                    />
                ) : (
                    <InputField
                        variant="text"
                        label={label}
                        value={scalarType === 'number' ? String(castScalarValue(value, 'number')) : String(castScalarValue(value, 'string'))}
                        placeholder={scalarType === 'number' ? 'Enter a number' : `Enter ${label.toLowerCase()}`}
                        onChange={(event) => {
                            if (scalarType === 'number') {
                                onChange(parseFiniteNumber(event.value) ?? 0);
                                return;
                            }

                            onChange(String(event.value ?? ''));
                        }}
                    />
                )}
            </div>
        </div>
    );
}

function TypedScalarListEditor({
    values,
    onChange,
}: {
    values: unknown[] | undefined;
    onChange: (values: ScalarValue[]) => void;
}) {
    const items = (values ?? []).filter((value): value is ScalarValue => ['string', 'number', 'boolean'].includes(typeof value));

    return (
        <div className="space-y-3 rounded-lg border border-slate-200/80 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Allowed values</h4>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rule values are checked in the order shown here.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ''])}>
                    Add value
                </Button>
            </div>

            {items.length ? (
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="space-y-3 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                                    Value {index + 1}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                                >
                                    Remove
                                </Button>
                            </div>
                            <TypedScalarEditor
                                label="Value"
                                value={item}
                                onChange={(nextValue) => onChange(items.map((current, itemIndex) => (itemIndex === index ? nextValue : current)))}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">Add at least one typed value for this rule.</p>
            )}
        </div>
    );
}

function ValidationRuleCard({
    index,
    rule,
    onChange,
    onRemove,
}: {
    index: number;
    rule: FieldValidationRule;
    onChange: (nextRule: FieldValidationRule) => void;
    onRemove: () => void;
}) {
    const valueBy = rule.valueBy ?? 'value';

    return (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Rule {index + 1}</div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rules are evaluated in order, and the first failing rule provides the field message.</p>
                </div>
                <SectionActionButton
                    icon={<MdDeleteOutline />}
                    iconOnly
                    tooltip="Remove validation rule"
                    aria-label="Remove validation rule"
                    onClick={onRemove}
                />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <InputField
                    variant="select"
                    label="Operation"
                    value={rule.op}
                    options={opOptions}
                    onChange={(event) =>
                        onChange(
                            sanitizeRule({
                                ...rule,
                                op: String(event.value ?? 'truthy') as FieldValidationOp,
                            }),
                        )
                    }
                />
                <InputField
                    variant="select"
                    label="Value source"
                    value={valueBy}
                    options={valueByOptions}
                    onChange={(event) =>
                        onChange(
                            sanitizeRule({
                                ...rule,
                                valueBy: String(event.value ?? 'value') as FieldValidationValueBy,
                            }),
                        )
                    }
                />
            </div>

            <InputField
                variant="text"
                label="Message"
                value={rule.message ?? ''}
                placeholder="Shown when this rule fails"
                onChange={(event) =>
                    onChange(
                        sanitizeRule({
                            ...rule,
                            message: String(event.value ?? ''),
                        }),
                    )
                }
            />

            {singleValueOps.has(rule.op) ? (
                <TypedScalarEditor
                    label="Compare to"
                    value={rule.value}
                    onChange={(value) =>
                        onChange(
                            sanitizeRule({
                                ...rule,
                                value,
                            }),
                        )
                    }
                />
            ) : null}

            {rule.op === 'between' ? (
                <div className="grid gap-3 md:grid-cols-2">
                    <InputField
                        variant="text"
                        label="Minimum"
                        value={rule.min === undefined ? '' : String(rule.min)}
                        placeholder="Enter minimum"
                        onChange={(event) =>
                            onChange(
                                sanitizeRule({
                                    ...rule,
                                    min: parseFiniteNumber(event.value),
                                }),
                            )
                        }
                    />
                    <InputField
                        variant="text"
                        label="Maximum"
                        value={rule.max === undefined ? '' : String(rule.max)}
                        placeholder="Enter maximum"
                        onChange={(event) =>
                            onChange(
                                sanitizeRule({
                                    ...rule,
                                    max: parseFiniteNumber(event.value),
                                }),
                            )
                        }
                    />
                </div>
            ) : null}

            {listValueOps.has(rule.op) ? (
                <TypedScalarListEditor
                    values={rule.values}
                    onChange={(values) =>
                        onChange(
                            sanitizeRule({
                                ...rule,
                                values,
                            }),
                        )
                    }
                />
            ) : null}

            {rule.op === 'match' ? (
                <div className="grid gap-3 md:grid-cols-2">
                    <InputField
                        variant="text"
                        label="Pattern"
                        value={rule.pattern ?? ''}
                        placeholder="Regular expression"
                        onChange={(event) =>
                            onChange(
                                sanitizeRule({
                                    ...rule,
                                    pattern: String(event.value ?? ''),
                                }),
                            )
                        }
                    />
                    <InputField
                        variant="text"
                        label="Flags"
                        value={rule.flags ?? ''}
                        placeholder="e.g. i, gm"
                        onChange={(event) =>
                            onChange(
                                sanitizeRule({
                                    ...rule,
                                    flags: String(event.value ?? ''),
                                }),
                            )
                        }
                    />
                </div>
            ) : null}

            {valueBy === 'eval' ? (
                <InputField
                    variant="textarea"
                    label="Eval code"
                    value={rule.expressionBody ?? ''}
                    placeholder="return typeof value === 'string' ? value.length : 0;"
                    onChange={(event) =>
                        onChange(
                            sanitizeRule({
                                ...rule,
                                expressionBody: String(event.value ?? ''),
                            }),
                        )
                    }
                />
            ) : null}
        </div>
    );
}

export default function ValidationRulesSection({
    rules,
    onChange,
    disabled = false,
}: {
    rules: FieldValidationRule[];
    onChange: (rules: FieldValidationRule[]) => void;
    disabled?: boolean;
}) {
    const persistRules = onChange;

    const addRule = () => {
        persistRules([...rules, createDefaultRule()]);
    };

    const clearRules = () => {
        persistRules([]);
    };

    const updateRuleAt = (index: number, nextRule: FieldValidationRule) => {
        persistRules(rules.map((rule, ruleIndex) => (ruleIndex === index ? sanitizeRule(nextRule) : rule)));
    };

    const removeRuleAt = (index: number) => {
        persistRules(rules.filter((_, ruleIndex) => ruleIndex !== index));
    };

    return (
        <Section>
            <Section.Header>
                <Section.Title>Validation</Section.Title>
                <Section.Actions>
                    {!rules.length ? (
                        <SectionActionButton disabled={disabled} icon={<BsPlus />} iconOnly tooltip="Add validation" aria-label="Add validation" onClick={addRule} />
                    ) : null}
                    {rules.length ? (
                        <SectionActionButton
                            icon={<MdDeleteOutline />}
                            iconOnly
                            tooltip="Clear validation"
                            aria-label="Clear validation"
                            disabled={disabled}
                            onClick={clearRules}
                        />
                    ) : null}
                </Section.Actions>
            </Section.Header>

            <Section.Content>
                <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
                {rules.length ? (
                    <div className="space-y-4">
                        {rules.map((rule, index) => (
                            <ValidationRuleCard
                                key={`${index}-${rule.op}-${rule.valueBy ?? 'value'}`}
                                index={index}
                                rule={rule}
                                onChange={(nextRule) => updateRuleAt(index, nextRule)}
                                onRemove={() => removeRuleAt(index)}
                            />
                        ))}

                        <Button type="button" variant="outline" size="sm" onClick={addRule}>
                            Add another rule
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-800">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No validation rules yet</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Add ordered rules to validate this field value, its length, or an eval-derived subject. The first failing rule supplies the
                            field message.
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={addRule}>
                            Add validation
                        </Button>
                    </div>
                )}
                </fieldset>
            </Section.Content>
        </Section>
    );
}
