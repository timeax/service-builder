import { formatEstimate, getCurrentTag, getServiceDetails, getVisiblePreviewFields } from '@/builder/view-models.tsx';
import { EmptyState, PanelSection, PropertyList, StatusDot } from '@/components/builder/index.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useMemo, useState } from 'react';

const inferVariant = (type: string) => {
    if (['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'toggle'].includes(type)) return type;
    return 'text';
};

export function Wireframe() {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const currentTag = getCurrentTag(canvas);
    const previewFields = useMemo(() => getVisiblePreviewFields(canvas, currentTag?.id), [canvas.props, canvas.selectionInfo, canvas.activeId]);
    const [formValues, setFormValues] = useState<Record<string, any>>({});

    const selectedService = previewFields
        .flatMap((field) => field.options)
        .map((option) => getServiceDetails(ws, option.service_id))
        .find(Boolean);

    if (!currentTag) {
        return (
            <div className="p-4">
                <EmptyState title="No preview context" description="Select a tag to render the visible service inputs in this tab." />
            </div>
        );
    }

    return (
        <ScrollArea className="h-full min-h-0 flex-1">
            <div className="space-y-4 px-4 py-4">
                <PanelSection title="Preview context" description={`Rendering visible inputs for ${currentTag.raw.label}.`}>
                    <div className="space-y-3">
                        <PropertyList
                            items={[
                                { label: 'Active tag', value: currentTag.raw.label },
                                { label: 'Visible fields', value: String(previewFields.length) },
                                { label: 'Selected options', value: String(canvas.selectionInfo.optionIds.length) },
                            ]}
                        />
                        {selectedService ? (
                            <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    <StatusDot tone="success" />
                                    <span>{selectedService.name}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatEstimate(selectedService) ?? 'No estimate metadata available.'}</p>
                            </div>
                        ) : null}
                    </div>
                </PanelSection>

                {previewFields.length ? (
                    <PanelSection title="Live wireframe" description="This preview uses the same visibility rules as the engine.">
                        <div className="space-y-4">
                            {previewFields.map(({ id, field, options }) => (
                                <div key={id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                    <InputField
                                        variant={inferVariant(field.type) as any}
                                        label={field.label}
                                        value={formValues[id]}
                                        options={options.map((option) => ({
                                            label: option.label,
                                            value: option.value ?? option.id,
                                            description: option.service_id ? `Service ${option.service_id}` : undefined,
                                        })) as any}
                                        placeholder={(field.defaults?.placeholder as string) ?? `Enter ${field.label}`}
                                        onChange={(e) => setFormValues((curr) => ({ ...curr, [id]: e.value }))}
                                    />
                                    {field.description ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{field.description}</p> : null}
                                    {field.defaults?.helpText ? (
                                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{String(field.defaults.helpText)}</p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </PanelSection>
                ) : (
                    <EmptyState
                        title="No visible fields for this tag"
                        description="Use includes, excludes, or option mappings to reveal fields in the preview flow."
                    />
                )}
            </div>
        </ScrollArea>
    );
}

export default Wireframe;
