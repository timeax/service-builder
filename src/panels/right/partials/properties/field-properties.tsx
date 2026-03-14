import { describeBinding } from '@/builder/view-models.tsx';
import { PropertyList } from '@/components/builder/index.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Section } from '@/panels/right/components/sections.tsx';
import { AddService } from '@/panels/right/partials/global/add-service.tsx';
import type { FieldNode } from '@timeax/digital-service-engine/core';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import QuantitySection from './components/quantity-section.tsx';
import UtilitySection from './components/utility-section.tsx';
import { IncExcludeSection } from './components/Union';

export interface FieldPropertiesProps {
    className?: string;
    node: FieldNode;
}

export function FieldProperties({ className, node }: FieldPropertiesProps) {
    const canvas = useCanvas();
    const defaults = node.raw.defaults ?? {};
    const options = node.raw.options ?? [];

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
                                value={node.raw.name ?? ''}
                                placeholder="Storage key"
                                onChange={(e) => canvas.api.editor.editName(node.id, e.value || undefined)}
                            />
                            <InputField
                                variant="select"
                                label="Type"
                                value={node.raw.type}
                                options={
                                    [
                                        { label: 'Text', value: 'text' },
                                        { label: 'Textarea', value: 'textarea' },
                                        { label: 'Number', value: 'number' },
                                        { label: 'Select', value: 'select' },
                                        { label: 'Radio', value: 'radio' },
                                        { label: 'Checkbox', value: 'checkbox' },
                                    ] as any
                                }
                                onChange={(e) => canvas.api.editor.updateField(node.id, { type: String(e.value ?? 'text') as any })}
                            />
                            <InputField
                                variant="toggle"
                                label="Required"
                                value={Boolean(node.raw.required)}
                                onChange={(e) => canvas.api.editor.updateField(node.id, { required: Boolean(e.value) })}
                            />
                            <InputField
                                variant="toggle"
                                label="Button mode"
                                value={Boolean((node.raw as any).button)}
                                onChange={(e) => canvas.api.editor.updateField(node.id, { button: Boolean(e.value) } as any)}
                            />
                        </div>
                    </Section.Content>
                </Section>
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
                                value={(defaults.placeholder as string) ?? ''}
                                onChange={(e) =>
                                    canvas.api.editor.updateField(node.id, {
                                        defaults: {
                                            ...defaults,
                                            placeholder: e.value,
                                        },
                                    })
                                }
                            />
                            <InputField
                                variant="textarea"
                                label="Help text"
                                value={(defaults.helpText as string) ?? ''}
                                onChange={(e) =>
                                    canvas.api.editor.updateField(node.id, {
                                        defaults: {
                                            ...defaults,
                                            helpText: e.value,
                                        },
                                    })
                                }
                            />
                        </div>
                    </Section.Content>
                </Section>
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

                <IncExcludeSection node={node} mode="includes" />

                <Separator />
                <IncExcludeSection node={node} mode="excludes" />
                <Separator />
                <AddService data={node} />
            </div>
        </div>
    );
}

export default FieldProperties;
