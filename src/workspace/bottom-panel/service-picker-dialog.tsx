import type { BuilderServiceSummary } from '@/builder/bottom-panel.ts';
import { Button } from '@/components/ui/button.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { cn } from '@/lib/utils.ts';
import type { DgpServiceCapability } from '@timeax/digital-service-engine/schema';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createDefaultServicePickerFilters, discoverServiceMetaPaths, filterServicePickerServices, type ServicePickerFilters } from './service-picker.ts';

type ServicePickerDialogProps = {
    open: boolean;
    groupLabel?: string | null;
    services: BuilderServiceSummary[];
    serviceMap: Record<string, DgpServiceCapability>;
    activeIds?: Set<string>;
    existingGroupServiceIds?: Set<string>;
    onOpenChange: (open: boolean) => void;
    onConfirm: (serviceIds: string[]) => void;
};

export function ServicePickerDialog({
    open,
    groupLabel,
    services,
    serviceMap,
    activeIds = new Set<string>(),
    existingGroupServiceIds = new Set<string>(),
    onOpenChange,
    onConfirm,
}: ServicePickerDialogProps) {
    const [filters, setFilters] = useState<ServicePickerFilters>(() => createDefaultServicePickerFilters());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!open) return;
        setFilters(createDefaultServicePickerFilters());
        setSelectedIds(new Set());
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onOpenChange(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onOpenChange, open]);

    const categories = useMemo(
        () => Array.from(new Set(services.map((service) => service.category).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
        [services],
    );
    const flags = useMemo(() => Array.from(new Set(services.flatMap((service) => service.flags))).sort((a, b) => a.localeCompare(b)), [services]);
    const metaPaths = useMemo(() => discoverServiceMetaPaths(Object.values(serviceMap)), [serviceMap]);
    const metaValues = metaPaths.find((entry) => entry.path === filters.metaPath)?.values ?? [];
    const filteredServices = useMemo(
        () =>
            filterServicePickerServices({
                services,
                serviceMap,
                filters,
                activeIds,
            }),
        [activeIds, filters, serviceMap, services],
    );

    if (!open || typeof document === 'undefined') return null;

    const selectedCount = selectedIds.size;
    const canConfirm = selectedCount > 0;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Service picker"
                className="flex h-[min(80vh,42rem)] w-[min(72rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            >
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Assign services to group</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {groupLabel ? `Pick one or more services to append into ${groupLabel}.` : 'Pick one or more services to append into the selected catalog group.'}
                            </p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl">
                            Close
                        </Button>
                    </div>
                </div>

                <div className="grid h-full min-h-0 flex-1 overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)]">
                    <div className="min-h-0 border-r border-slate-200 dark:border-slate-800">
                        <ScrollArea className="h-full min-h-0">
                            <div className="space-y-4 p-4">
                            <FilterField label="Search">
                                <InputField
                                    variant="text"
                                    label="Picker search"
                                    value={filters.query}
                                    onChange={(event) => setFilters((current) => ({ ...current, query: String(event.value ?? '') }))}
                                    placeholder="Name, id, category..."
                                    autoComplete="off"
                                />
                            </FilterField>

                            <FilterField label="Category">
                                <InputField
                                    variant="select"
                                    label="Category filter"
                                    value={filters.category}
                                    placeholder="All categories"
                                    options={toPickerSelectOptions(categories)}
                                    onChange={(event) => setFilters((current) => ({ ...current, category: String(event.value ?? '') }))}
                                />
                            </FilterField>

                            <FilterField label="Flag">
                                <InputField
                                    variant="select"
                                    label="Flag filter"
                                    value={filters.flag}
                                    placeholder="Any flag"
                                    options={toPickerSelectOptions(flags)}
                                    onChange={(event) => setFilters((current) => ({ ...current, flag: String(event.value ?? '') }))}
                                />
                            </FilterField>

                            <FilterField label="Activity">
                                <InputField
                                    variant="select"
                                    label="Activity filter"
                                    value={filters.activity}
                                    options={
                                        [
                                            { label: 'All services', value: 'all' },
                                            { label: 'Hide active', value: 'hide-active' },
                                            { label: 'Active only', value: 'active-only' },
                                        ] as any
                                    }
                                    onChange={(event) =>
                                        setFilters((current) => ({
                                            ...current,
                                            activity: (event.value as ServicePickerFilters['activity']) ?? 'all',
                                        }))
                                    }
                                />
                            </FilterField>

                            <div className="grid grid-cols-2 gap-2">
                                <FilterField label="Min rate">
                                    <InputField
                                        variant="number"
                                        label="Minimum rate filter"
                                        value={filters.rateMin === '' ? undefined : Number(filters.rateMin)}
                                        onChange={(event) => setFilters((current) => ({ ...current, rateMin: String(event.value ?? '') }))}
                                        placeholder="0"
                                        autoComplete="off"
                                    />
                                </FilterField>
                                <FilterField label="Max rate">
                                    <InputField
                                        variant="number"
                                        label="Maximum rate filter"
                                        value={filters.rateMax === '' ? undefined : Number(filters.rateMax)}
                                        onChange={(event) => setFilters((current) => ({ ...current, rateMax: String(event.value ?? '') }))}
                                        placeholder="100"
                                        autoComplete="off"
                                    />
                                </FilterField>
                            </div>

                            <FilterField label="Name keyword">
                                <div className="space-y-2">
                                    <InputField
                                        variant="select"
                                        label="Keyword mode"
                                        value={filters.keywordMode}
                                        options={
                                            [
                                                { label: 'Must include', value: 'include' },
                                                { label: 'Must not include', value: 'exclude' },
                                            ] as any
                                        }
                                        onChange={(event) =>
                                            setFilters((current) => ({
                                                ...current,
                                                keywordMode: (event.value as ServicePickerFilters['keywordMode']) ?? 'include',
                                            }))
                                        }
                                    />
                                    <InputField
                                        variant="text"
                                        label="Keyword filter"
                                        value={filters.keyword}
                                        onChange={(event) => setFilters((current) => ({ ...current, keyword: String(event.value ?? '') }))}
                                        placeholder="Service name keyword"
                                        autoComplete="off"
                                    />
                                </div>
                            </FilterField>

                            <FilterField label="Meta key">
                                    <InputField
                                        variant="select"
                                        label="Meta key filter"
                                    value={filters.metaPath}
                                    placeholder="Any meta key"
                                    options={toPickerSelectOptions(metaPaths.map((entry) => entry.path))}
                                    onChange={(event) =>
                                        setFilters((current) => ({
                                            ...current,
                                                metaPath: String(event.value ?? ''),
                                                metaValue: '',
                                            }))
                                        }
                                />
                            </FilterField>

                            <FilterField label="Meta value">
                                <InputField
                                    variant="select"
                                    label="Meta value filter"
                                    disabled={!filters.metaPath}
                                    value={filters.metaValue}
                                    placeholder="Any value"
                                    options={toPickerSelectOptions(metaValues)}
                                    onChange={(event) => setFilters((current) => ({ ...current, metaValue: String(event.value ?? '') }))}
                                />
                            </FilterField>

                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFilters(createDefaultServicePickerFilters());
                                        setSelectedIds(new Set());
                                    }}
                                    className="rounded-xl"
                                >
                                    Clear filters
                                </Button>
                            </div>
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="flex min-h-0 flex-col overflow-hidden">
                        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            {filteredServices.length} service{filteredServices.length === 1 ? '' : 's'} found
                        </div>
                        <ScrollArea className="h-full min-h-0 flex-1">
                            <div className="space-y-2 p-4">
                                {filteredServices.length ? (
                                    filteredServices.map((service) => {
                                        const id = String(service.id);
                                        const selected = selectedIds.has(id);
                                        const alreadyAssigned = existingGroupServiceIds.has(id);
                                        return (
                                            <label
                                                key={id}
                                                className={cn(
                                                    'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition',
                                                    selected
                                                        ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10'
                                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700',
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${service.name}`}
                                                    checked={selected}
                                                    onChange={() =>
                                                        setSelectedIds((current) => {
                                                            const next = new Set(current);
                                                            if (next.has(id)) next.delete(id);
                                                            else next.add(id);
                                                            return next;
                                                        })
                                                    }
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{service.name}</div>
                                                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                                <span>#{service.id}</span>
                                                                {service.category ? <span>{service.category}</span> : null}
                                                                {service.platformId ? <span>{service.platformId}</span> : null}
                                                            </div>
                                                        </div>
                                                        {alreadyAssigned ? (
                                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                                                                Already in group
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {service.rate != null ? (
                                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                                Rate {service.rate}
                                                            </span>
                                                        ) : null}
                                                        {service.flags.slice(0, 3).map((flag) => (
                                                            <span key={flag} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                                                                {flag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                        No services match the current filters.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {selectedCount} service{selectedCount === 1 ? '' : 's'} selected
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={!canConfirm}
                            onClick={() => {
                                onConfirm(Array.from(selectedIds));
                                onOpenChange(false);
                            }}
                            className="rounded-xl"
                        >
                            Add selected services
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</span>
            {children}
        </label>
    );
}

function toPickerSelectOptions(values: string[]) {
    return values.map((value) => ({
        label: value,
        value,
    })) as any;
}
