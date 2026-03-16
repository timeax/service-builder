import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { RenderIf } from '@/panels/right/components/renderif.tsx';
import { IncludesItem, Section, SectionActionButton } from '@/panels/right/components/sections.tsx';
import type { FieldNode, OptionNode, TagNode } from '@timeax/digital-service-engine/core';
import type { DgpServiceCapability } from '@timeax/digital-service-engine/schema';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useMemo, useState } from 'react';
import { BsPlus } from 'react-icons/bs';

export interface AddServiceProps {
    className?: string;
    data: FieldNode | TagNode | OptionNode;
    disabled?: boolean;
    disabledMessage?: string;
    readOnly?: boolean;
    readOnlyMessage?: string;
    emptyMessage?: string | null;
}

type ServiceOption = {
    label: string;
    value: string;
    description?: string;
    service: DgpServiceCapability;
};

export function AddService({ className, data, disabled, disabledMessage, readOnly, readOnlyMessage, emptyMessage }: AddServiceProps) {
    const ws = useWorkspace();
    const canvas = useCanvas();
    const services = useMemo(() => ws.services.data ?? {}, [ws.services.data]);
    const connectedService = data.raw.service_id != null ? (services[data.raw.service_id as keyof typeof services] as DgpServiceCapability | undefined) : undefined;
    const isReadOnly = Boolean(disabled || readOnly);
    const helperMessage = readOnlyMessage ?? disabledMessage;

    return (
        <Section className={className}>
            <Section.Header>
                <Section.Title>Service</Section.Title>
                <Section.Actions>
                    {!isReadOnly ? <AddServicePopover data={data} services={Object.values(services)} /> : null}
                </Section.Actions>
            </Section.Header>

            <Section.Content>
                {helperMessage ? <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{helperMessage}</p> : null}
                <RenderIf data={connectedService} emptyMessage={isReadOnly ? (emptyMessage ?? null) : (emptyMessage ?? 'None')}>
                    {(service) => (
                        <>
                            <IncludesItem
                                title={service.name ?? `Service ${service.id}`}
                                className="items-start!"
                                badge={
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        #{service.id}
                                    </span>
                                }
                                actions={
                                    !isReadOnly && data.raw.service_id != null
                                        ? [
                                              {
                                                  kind: 'remove',
                                                  title: 'Clear service',
                                                  onClick: () => canvas.api.editor.setService(data.id, { service_id: undefined }),
                                              },
                                          ]
                                        : undefined
                                }
                            />
                        </>
                    )}
                </RenderIf>
                {connectedService ? <ServiceSummary service={connectedService} nodeId={data.id} disabled={isReadOnly} /> : null}
            </Section.Content>
        </Section>
    );
}

function ServiceSummary({ service, nodeId, disabled }: { service: DgpServiceCapability; nodeId: string; disabled?: boolean }) {
    const canvas = useCanvas();

    return (
        <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800/50">
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <p>
                    <span className="font-medium text-gray-800 dark:text-gray-200">Category:</span> {service.category ?? 'Uncategorised'}
                </p>
                <p>
                    <span className="font-medium text-gray-800 dark:text-gray-200">Rate:</span> {service.rate}
                </p>
                <p>
                    <span className="font-medium text-gray-800 dark:text-gray-200">Range:</span> {service.min ?? 0} - {service.max ?? '∞'}
                </p>
            </div>
            {!disabled ? (
                <div className="mt-3 flex justify-end">
                    <button
                        type="button"
                        onClick={() => canvas.api.editor.setService(nodeId, { service_id: undefined })}
                        className="text-xs font-medium text-red-500 transition hover:text-red-600 dark:hover:text-red-400"
                    >
                        Clear
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function AddServicePopover({ data, services }: { data: FieldNode | TagNode | OptionNode; services: DgpServiceCapability[] }) {
    const canvas = useCanvas();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string>('');

    const options = useMemo<ServiceOption[]>(() => {
        const lower = query.trim().toLowerCase();
        return services
            .filter((service) => {
                if (!lower) return true;
                return `${service.name ?? ''} ${service.category ?? ''} ${String(service.id)}`.toLowerCase().includes(lower);
            })
            .map((service) => ({
                label: service.name ?? `Service ${service.id}`,
                value: String(service.id),
                description: service.category,
                service,
            }));
    }, [services, query]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <SectionActionButton icon={<BsPlus />}>Add</SectionActionButton>
            </PopoverTrigger>
            <PopoverContent className="w-96">
                <div className="flex flex-col gap-3">
                    <InputField variant="text" value={query} onChange={(e) => setQuery(e.value ?? '')} placeholder="Search services..." />
                    <ScrollArea className="h-72 pr-1">
                        <div className="space-y-2 pr-2">
                            {options.length ? (
                                options.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setSelected(option.value)}
                                        className={`w-full rounded-md border px-3 py-2 text-left transition ${
                                            selected === option.value
                                                ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900'
                                        }`}
                                    >
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{option.label}</div>
                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {option.description ?? 'Uncategorised'} • Rate {option.service.rate}
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                    No services found.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <Button
                        onClick={() => {
                            if (!selected) return;
                            canvas.api.editor.setService(data.id, { service_id: Number(selected) });
                            setOpen(false);
                            setSelected('');
                            setQuery('');
                        }}
                        type="button"
                        size="sm"
                    >
                        Save
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default AddService;
