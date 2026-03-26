import { buildServiceContextSnapshot } from '@/builder/service-context.ts';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { RenderIf } from '@/panels/right/components/renderif.tsx';
import { IncludesItem, Section, SectionActionTriggerButton } from '@/panels/right/components/sections.tsx';
import type { FieldNode, OptionNode, TagNode } from '@timeax/digital-service-engine/core';
import type { CatalogGroupNode, DgpServiceCapability, ServiceCatalogState } from '@timeax/digital-service-engine/schema';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BsPlus } from 'react-icons/bs';
import { FaFolderOpen } from 'react-icons/fa';
import { FiFilter } from 'react-icons/fi';

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
const UNGROUPED_TREE_VALUE = '__catalog_ungrouped__';

export function AddService({ className, data, disabled, disabledMessage, readOnly, readOnlyMessage, emptyMessage }: AddServiceProps) {
    const ws = useWorkspace();
    const canvas = useCanvas();
    const servicesMap = useMemo(() => (ws.services.data ?? {}) as Record<string, DgpServiceCapability>, [ws.services.data]);
    const connectedService =
        data.raw.service_id != null ? (servicesMap[data.raw.service_id as keyof typeof servicesMap] as DgpServiceCapability | undefined) : undefined;
    const isReadOnly = Boolean(disabled || readOnly);
    const helperMessage = readOnlyMessage ?? disabledMessage;

    return (
        <Section className={className}>
            <Section.Header>
                <Section.Title>Service</Section.Title>
                <Section.Actions>
                    {!isReadOnly ? <AddServicePopover data={data} services={Object.values(servicesMap)} servicesMap={servicesMap} /> : null}
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
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">
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

function AddServicePopover({
    data,
    services,
    servicesMap,
}: {
    data: FieldNode | TagNode | OptionNode;
    services: DgpServiceCapability[];
    servicesMap: Record<string, DgpServiceCapability>;
}) {
    const ws = useWorkspace();
    const canvas = useCanvas();
    const [open, setOpen] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string>('');
    const [contextFilterEnabled, setContextFilterEnabled] = useState(false);
    const [catalogState, setCatalogState] = useState<ServiceCatalogState | null>(null);
    const policies = ws.policies.policies.data ?? [];
    const currentTagId = canvas.api.selection.currentTag?.();
    const preferredTagId = currentTagId != null ? String(currentTagId) : canvas.layers.tags[0]?.id != null ? String(canvas.layers.tags[0]?.id) : null;
    const selectedButtons = useMemo(
        () => ((canvas.api.selection.selectedButtons?.() ?? []) as Array<string | number>).map((value) => String(value)),
        [canvas.api.selection, canvas.selectionInfo.ids, canvas.selectionInfo.optionIds],
    );

    const liveSelectionContext = useMemo(
        () => ({
            selectedTagId: preferredTagId,
            selectedButtons,
            strictSafety: true,
            enforcePolicies: true,
        }),
        [preferredTagId, selectedButtons],
    );
    const liveSnapshot = useMemo(
        () => buildServiceContextSnapshot({ props: canvas.props, services: servicesMap, state: liveSelectionContext }),
        [canvas.props, liveSelectionContext, servicesMap],
    );

    useEffect(() => {
        const editor = canvas.api.editor as any;
        const ensured = editor.getCatalog?.() ?? editor.ensureCatalog?.();
        if (ensured) setCatalogState(ensured);

        const offCatalogChange = canvas.api.on('catalog:change' as any, ({ catalog }: { catalog?: ServiceCatalogState }) => {
            const next = catalog ?? editor.getCatalog?.() ?? editor.ensureCatalog?.();
            setCatalogState(next ?? null);
        });
        const offCatalogActiveChange = canvas.api.on('catalog:active-change' as any, () => {
            const next = editor.getCatalog?.() ?? editor.ensureCatalog?.();
            setCatalogState(next ?? null);
        });

        return () => {
            offCatalogChange?.();
            offCatalogActiveChange?.();
        };
    }, [canvas.api]);

    const catalogMode = catalogState?.viewMode === 'grouped' ? 'catalog' : 'all';
    const catalogGroups = useMemo(
        () =>
            (catalogState?.nodes ?? [])
                .filter((node): node is CatalogGroupNode => node.kind === 'group')
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label)),
        [catalogState],
    );
    const selectedCatalogGroupId = catalogGroups.some((node) => node.id === catalogState?.activeNodeId) ? String(catalogState?.activeNodeId) : null;
    const groupedServiceIds = useMemo(() => {
        const ids = new Set<string>();
        for (const group of catalogGroups) {
            for (const serviceId of group.serviceIds) ids.add(String(serviceId));
        }
        return ids;
    }, [catalogGroups]);
    const allowedCatalogIds = useMemo(() => {
        if (catalogMode !== 'catalog') return null;
        if (!selectedCatalogGroupId) {
            const ids = new Set<string>();
            for (const service of services) {
                const id = String(service.id);
                if (!groupedServiceIds.has(id)) ids.add(id);
            }
            return ids;
        }

        const selectedGroup = catalogGroups.find((group) => group.id === selectedCatalogGroupId);
        if (!selectedGroup) {
            const ids = new Set<string>();
            for (const service of services) {
                const id = String(service.id);
                if (!groupedServiceIds.has(id)) ids.add(id);
            }
            return ids;
        }

        return new Set(selectedGroup.serviceIds.map((id) => String(id)));
    }, [catalogGroups, catalogMode, groupedServiceIds, selectedCatalogGroupId, services]);
    const compatibleIds = useMemo(() => {
        if (!contextFilterEnabled) return null;
        if (!liveSnapshot.selectedTag) return null;
        const checks = (canvas.api.editor as any).filterServicesForVisibleGroup?.(
            services.map((service) => service.id),
            {
                tagId: liveSnapshot.selectedTag.id,
                selectedButtons: liveSnapshot.state.selectedButtons,
                usedServiceIds: liveSnapshot.usedServiceIds,
                effectiveConstraints: liveSnapshot.selectedTag.constraints,
                policies,
            },
        );
        if (!Array.isArray(checks)) return null;

        const ids = new Set<string>();
        for (const check of checks) {
            if (check?.fitsConstraints && check?.passesRate && check?.passesPolicies) {
                ids.add(String(check.id));
            }
        }
        return ids;
    }, [canvas.api.editor, contextFilterEnabled, liveSnapshot, policies, services]);
    const setCatalogMode = useCallback(
        (mode: 'all' | 'catalog') => {
            const editor = canvas.api.editor as any;
            editor.ensureCatalog?.();
            editor.setCatalogViewMode?.(mode === 'catalog' ? 'grouped' : 'all');
        },
        [canvas.api.editor],
    );
    const filterActive = contextFilterEnabled || catalogMode === 'catalog';

    const options = useMemo<ServiceOption[]>(() => {
        const lower = query.trim().toLowerCase();
        return services
            .filter((service) => {
                if (!lower) return true;
                return `${service.name ?? ''} ${service.category ?? ''} ${String(service.id)}`.toLowerCase().includes(lower);
            })
            .filter((service) => (allowedCatalogIds ? allowedCatalogIds.has(String(service.id)) : true))
            .filter((service) => (compatibleIds ? compatibleIds.has(String(service.id)) : true))
            .map((service) => ({
                label: service.name ?? `Service ${service.id}`,
                value: String(service.id),
                description: service.category,
                service,
            }));
    }, [allowedCatalogIds, compatibleIds, services, query]);

    useEffect(() => {
        if (selected && !options.some((option) => option.value === selected)) {
            setSelected('');
        }
    }, [options, selected]);

    const treeValue = selectedCatalogGroupId ?? (catalogMode === 'catalog' ? UNGROUPED_TREE_VALUE : undefined);
    const treeOptions = buildCatalogGroupTreeOptions(catalogGroups);
    const selectedCatalogGroup = catalogGroups.find((group) => group.id === selectedCatalogGroupId) ?? null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <SectionActionTriggerButton icon={<BsPlus />}>Add</SectionActionTriggerButton>
            </PopoverTrigger>
            <PopoverContent className="w-96">
                <div className="flex flex-col gap-3">
                    <InputField
                        variant="text"
                        value={query}
                        onChange={(e) => setQuery(e.value ?? '')}
                        placeholder="Search services..."
                        extendBoxToControls
                        joinControls
                        trailingControl={
                            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label="Service list filter"
                                        className={`flex h-full w-8 cursor-pointer items-center justify-center text-sm transition ${
                                            filterActive
                                                ? 'text-blue-700 dark:text-blue-200'
                                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                                        }`}
                                    >
                                        <FiFilter />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="w-80 space-y-3 rounded-xl">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Service filters</div>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Combine catalog grouping with current context compatibility.
                                        </p>
                                    </div>
                                    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                        <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                                            Catalog scope
                                        </div>

                                        <InputField
                                            variant={'radio'}
                                            value={catalogMode}
                                            options={
                                                [
                                                    { key: 'all', label: 'All services' },
                                                    { key: 'catalog', label: 'Catalog group' },
                                                ] as const
                                            }
                                            onChange={(event) => setCatalogMode(event.value as any)}
                                        />

                                        <InputField
                                            variant="treeselect"
                                            mode="button"
                                            label="Select group"
                                            className="w-fit!"
                                            disabled={catalogMode !== 'catalog'}
                                            multiple={false}
                                            value={treeValue}
                                            options={[{ key: UNGROUPED_TREE_VALUE, label: 'Ungrouped' }, ...treeOptions] as any}
                                            searchable
                                            clearable
                                            onChange={(event) => {
                                                const next = event.value == null ? null : String(event.value);
                                                (canvas.api.editor as any).setActiveCatalogNode?.(
                                                    next === UNGROUPED_TREE_VALUE || next == null ? undefined : next,
                                                );
                                            }}
                                            button={<FaFolderOpen />}
                                        />
                                        {catalogMode === 'catalog' ? (
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Showing {selectedCatalogGroup?.label ?? 'Ungrouped'} services.
                                            </div>
                                        ) : null}
                                    </div>
                                    <label className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-900 dark:border-slate-800 dark:text-slate-100">
                                        <span className="min-w-0">
                                            <span className="block font-medium">Current context</span>
                                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                Filter services based on the current visible-group context.
                                            </span>
                                        </span>
                                        <input
                                            aria-label="Current context"
                                            type="checkbox"
                                            checked={contextFilterEnabled}
                                            onChange={(event) => setContextFilterEnabled(event.target.checked)}
                                        />
                                    </label>
                                </PopoverContent>
                            </Popover>
                        }
                    />
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

function buildCatalogGroupTreeOptions(groups: CatalogGroupNode[], parentId: string | null = null): Array<Record<string, unknown>> {
    return groups
        .filter((group) => (group.parentId ?? null) === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label))
        .map((group) => {
            const children = buildCatalogGroupTreeOptions(groups, group.id);
            return {
                key: group.id,
                label: group.label,
                description: `${group.serviceIds.length} service${group.serviceIds.length === 1 ? '' : 's'}`,
                children: children.length ? children : undefined,
            };
        });
}

export default AddService;
