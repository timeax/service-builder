// SPDX-License-Identifier: GPL-3.0-only
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { SectionActionTriggerButton } from '@/panels/right/components/sections.tsx';
import { filterHandlerServices } from '@elqora/dgp-core';
import type { ServiceCatalogState } from '@elqora/dgp-workspace';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useState } from 'react';
import { BsPlus } from 'react-icons/bs';
import { FiFilter } from 'react-icons/fi';
import { buildCanonicalServiceSummaries } from './bottom-panel-model';
import { DEFAULT_CANONICAL_FALLBACK_POLICY } from './canonical-fallbacks';
import { buildCatalogContext } from './catalog-context-model';
import { useServiceBuilderCanvasModel } from './presentation';
import { useWorkspaceSelector } from './workspace';

const UNGROUPED_CATALOG_VALUE = '__catalog_ungrouped__';

export function CanonicalServicePicker({ nodeId }: { nodeId: string }) {
    const canvas = useServiceBuilderCanvasModel();
    const services = useWorkspaceSelector((state) => state.services);
    const [catalog, setCatalog] = useState<ServiceCatalogState | undefined>(() => canvas.editor?.get_catalog());
    const [open, setOpen] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [contextFilterEnabled, setContextFilterEnabled] = useState(false);
    const [rateMode, setRateMode] = useState<'context' | 'custom_primary_rate'>('context');
    const [rateSource, setRateSource] = useState<'service' | 'manual'>('service');
    const [primaryServiceId, setPrimaryServiceId] = useState('');
    const [manualPrimaryRate, setManualPrimaryRate] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setCatalog(canvas.editor?.get_catalog());
        if (!canvas.api) return;
        return canvas.api.on('catalog:change', ({ catalog: next }) => setCatalog(next));
    }, [canvas.api, canvas.editor]);

    const contextFilterId = canvas.context_filter_id ?? canvas.definition?.filters[0]?.id ?? null;
    const context = useMemo(() => buildCatalogContext(canvas.definition, {
        filterId: contextFilterId,
        triggerIds: [...canvas.selection.option_ids],
    }), [canvas.definition, contextFilterId, canvas.selection.option_ids]);
    const summaries = useMemo(() => buildCanonicalServiceSummaries(
        canvas.definition, services, canvas.selection.ids, contextFilterId,
    ).allServices, [canvas.definition, services, canvas.selection.ids, contextFilterId]);
    const matchingIds = useMemo(() => new Set(summaries.filter((item) => item.matchesSelectedFilter).map((item) => String(item.id))), [summaries]);
    const contextServices = services.filter((service) => context.usedServiceIds.includes(String(service.id)));
    useEffect(() => {
        if (contextServices.some((service) => String(service.id) === primaryServiceId)) return;
        setPrimaryServiceId(contextServices[0] ? String(contextServices[0].id) : '');
    }, [contextServices, primaryServiceId]);

    const customPrimaryRate = rateMode !== 'custom_primary_rate' ? undefined
        : rateSource === 'service' ? contextServices.find((service) => String(service.id) === primaryServiceId)?.rate
        : manualPrimaryRate.trim() === '' ? undefined : Number(manualPrimaryRate);
    const validPrimaryRate = typeof customPrimaryRate === 'number' && Number.isFinite(customPrimaryRate) && customPrimaryRate >= 0;
    const rateCompatibleIds = useMemo(() => {
        if (rateMode !== 'custom_primary_rate' || !validPrimaryRate) return null;
        return new Set(filterHandlerServices(services, {
            primary_rate: customPrimaryRate,
            rate_policy: DEFAULT_CANONICAL_FALLBACK_POLICY.rate_policy,
        }).accepted.map((service) => String(service.id)));
    }, [services, rateMode, validPrimaryRate, customPrimaryRate]);

    const groups = (catalog?.nodes ?? []).filter((node) => node.kind === 'group');
    const catalogMode = catalog?.view_mode === 'grouped' ? 'catalog' : 'all';
    const selectedGroup = groups.find((group) => group.id === catalog?.active_node_id);
    const groupedIds = new Set(groups.flatMap((group) => group.service_ids.map(String)));
    const allowedIds = catalogMode !== 'catalog' ? null : selectedGroup
        ? new Set(selectedGroup.service_ids.map(String))
        : new Set(services.filter((service) => !groupedIds.has(String(service.id))).map((service) => String(service.id)));
    const filtered = services.filter((service) => {
        const id = String(service.id);
        if (query.trim() && !`${service.name} ${service.category ?? ''} ${id}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
        if (allowedIds && !allowedIds.has(id)) return false;
        if (contextFilterEnabled && contextFilterId && !matchingIds.has(id)) return false;
        if (rateMode === 'custom_primary_rate' && rateCompatibleIds && !rateCompatibleIds.has(id)) return false;
        return true;
    });
    const selected = filtered.find((service) => String(service.id) === selectedId);
    const save = () => {
        if (!selected || !canvas.editor) return;
        try {
            canvas.editor.set_service(nodeId, selected.id);
            setError(null);
            setSelectedId('');
            setOpen(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not bind this service. Try again.');
        }
    };

    return (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
            <PopoverTrigger asChild>
                <SectionActionTriggerButton icon={<BsPlus />} aria-label="Add service">Add</SectionActionTriggerButton>
            </PopoverTrigger>
            <PopoverContent className="w-96">
                <div className="flex flex-col gap-3">
                    <div className="flex gap-1">
                        <InputField variant="text" value={query} onChange={(event) => setQuery(String(event.value ?? ''))} placeholder="Search services..." aria-label="Search services" />
                        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                            <PopoverTrigger asChild>
                                <button type="button" aria-label="Service list filter" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"><FiFilter /></button>
                            </PopoverTrigger>
                            <PopoverContent align="end" sideOffset={8} className="w-80 space-y-3 rounded-xl p-4">
                                <h4 className="text-sm font-semibold">Service filters</h4>
                                <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                    <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Catalog scope</p>
                                    <InputField variant="radio" value={catalogMode} options={[{ value: 'all', label: 'All services' }, { value: 'catalog', label: 'Catalog group' }]} onChange={({ value }) => canvas.editor?.set_catalog_view_mode(value === 'catalog' ? 'grouped' : 'all')} />
                                    <InputField variant="select" label="Catalog group" disabled={catalogMode !== 'catalog'} value={selectedGroup?.id ?? UNGROUPED_CATALOG_VALUE} options={[{ value: UNGROUPED_CATALOG_VALUE, label: 'Ungrouped' }, ...groups.map((group) => ({ value: group.id, label: group.label }))]} onChange={({ value }) => canvas.editor?.set_catalog_view({ active_node_id: value === UNGROUPED_CATALOG_VALUE ? undefined : String(value ?? '') || undefined })} />
                                    {catalogMode === 'catalog' ? <p className="text-xs text-slate-500">Showing {selectedGroup?.label ?? 'Ungrouped'} services.</p> : null}
                                </div>
                                <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                                    <span>Current context</span>
                                    <input type="checkbox" checked={contextFilterEnabled} onChange={(event) => setContextFilterEnabled(event.target.checked)} />
                                </label>
                                <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                    <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Rate compatibility</p>
                                    <InputField variant="radio" value={rateMode} options={[{ value: 'context', label: 'Context coherence' }, { value: 'custom_primary_rate', label: 'Custom primary rate' }]} onChange={({ value }) => setRateMode(value as typeof rateMode)} />
                                    {rateMode === 'context' ? <p className="text-xs text-slate-500">Context rate coherence is not checked by this picker.</p> : (
                                        <div className="space-y-2">
                                            <InputField variant="radio" value={rateSource} options={[{ value: 'service', label: 'From context service' }, { value: 'manual', label: 'Manual rate' }]} onChange={({ value }) => setRateSource(value as typeof rateSource)} />
                                            {rateSource === 'service' ? <InputField variant="select" label="Primary context service" value={primaryServiceId} options={contextServices.map((service) => ({ value: String(service.id), label: `${service.name} (Rate ${service.rate ?? 'unset'})` }))} onChange={({ value }) => setPrimaryServiceId(String(value ?? ''))} placeholder="Select service" />
                                                : <InputField variant="number" label="Primary rate" value={manualPrimaryRate === '' ? undefined : Number(manualPrimaryRate)} onChange={({ value }) => setManualPrimaryRate(String(value ?? ''))} placeholder="Enter rate" />}
                                            {!validPrimaryRate ? <p className="text-xs text-amber-700">Provide a valid primary rate to apply compatibility filtering.</p> : null}
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <ScrollArea className="h-72 pr-1">
                        <div className="space-y-2 pr-2">
                            {filtered.length ? filtered.map((service) => (
                                <button key={String(service.id)} type="button" aria-label={`Choose service ${String(service.id)}`} onClick={() => setSelectedId(String(service.id))} className={`w-full rounded-md border px-3 py-2 text-left transition ${selectedId === String(service.id) ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900'}`}>
                                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{service.name}</span>
                                    <span className="mt-1 block text-xs text-slate-500">{service.category ?? 'Uncategorised'} • Rate {service.rate ?? 'unset'}</span>
                                </button>
                            )) : <p className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">No services found.</p>}
                        </div>
                    </ScrollArea>
                    {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
                    <Button type="button" size="sm" disabled={!selected} onClick={save}>Save</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
