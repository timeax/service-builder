import { describeBinding } from '@/builder/view-models.tsx';
import { PropertyList } from '@/components/builder/index.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Section } from '@/panels/right/components/sections.tsx';
import { AddService } from '@/panels/right/partials/global/add-service.tsx';
import type { OptionNode } from '@timeax/digital-service-engine/core';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { getOptionPropertyCapabilities } from './components/node-capabilities.ts';
import QuantitySection from './components/quantity-section.tsx';
import UtilitySection from './components/utility-section.tsx';
import { IncExcludeSection } from './components/Union';

export interface OptionPropertiesProps {
    className?: string;
    node: OptionNode;
}

export function OptionProperties({ className, node }: OptionPropertiesProps) {
    const canvas = useCanvas();
    const capabilities = getOptionPropertyCapabilities(node);
    const field = node.field();
    const options = field.raw.options ?? [];

    return (
        <div className={className}>
            <div className="space-y-4">
                <Section>
                    <Section.Header>
                        <Section.Title>Option identity</Section.Title>
                    </Section.Header>
                    <Section.Content>
                        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Edit the currently focused option node.</p>
                        <div className="space-y-3">
                            <InputField
                                variant="text"
                                label="Label"
                                value={node.raw.label}
                                onChange={(e) => {
                                    const next = options.map((option) => (option.id === node.id ? { ...option, label: e.value } : option));
                                    canvas.api.editor.updateField(field.id, { options: next });
                                }}
                            />
                            <InputField
                                variant="text"
                                label="Value"
                                value={String(node.raw.value ?? '')}
                                onChange={(e) => {
                                    const next = options.map((option) =>
                                        option.id === node.id
                                            ? {
                                                  ...option,
                                                  value: e.value,
                                              }
                                            : option,
                                    );
                                    canvas.api.editor.updateField(field.id, { options: next });
                                }}
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
                        <Section.Title>Option mapping</Section.Title>
                    </Section.Header>
                    <Section.Content>
                        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">How this option participates in visible field mappings.</p>
                        <PropertyList
                            items={
                                [
                                    { label: 'Parent field', value: field.raw.label },
                                    { label: 'Binding', value: describeBinding(node) },
                                    capabilities.service.canEdit
                                        ? { label: 'Service id', value: String(node.raw.service_id ?? 'None') }
                                        : null,
                                ].filter(Boolean) as Array<{ label: string; value: string }>
                            }
                        />
                    </Section.Content>
                </Section>
                <Separator />

                <IncExcludeSection node={node} mode="includes" capability={capabilities.triggerMappings} />
                <Separator />

                <IncExcludeSection node={node} mode="excludes" capability={capabilities.triggerMappings} />
                <Separator />
                <AddService data={node} readOnly={!capabilities.service.canEdit} readOnlyMessage={capabilities.service.message} />
            </div>
        </div>
    );
}

export default OptionProperties;
