import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { InputField } from '@timeax/form-palette';
import { useActiveFallbackRegistrations, useEligibleServiceList, useFallbackEditor } from '@timeax/digital-service-engine/react';
import type { FallbackRegistration, FallbackScopeRef, ServiceIdRef, ServiceProps } from '@timeax/digital-service-engine/schema';
import { Check, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ModalShell, ToneBadge } from './shared.tsx';

type NodeTarget = {
    id: string;
    kind: 'tag' | 'field' | 'option' | 'node';
    label: string;
    serviceId: ServiceIdRef;
};

type AddRegistrationDialogProps = {
    open: boolean;
    onClose: () => void;
    onSelect: (context: FallbackScopeRef, primaryId: ServiceIdRef) => void;
};

type RegistrationMode = 'snapshot' | 'props' | 'none';

export function FallbackAddRegistrationDialog({
    open,
    onClose,
    onSelect,
}: AddRegistrationDialogProps) {
    const { activeServiceId, serviceProps, snapshot } = useFallbackEditor();
    const registrations = useActiveFallbackRegistrations();

    const [scope, setScope] = useState<'global' | 'node'>('global');
    const [nodeId, setNodeId] = useState('');

    const mode = useMemo<RegistrationMode>(() => {
        if (snapshot) return 'snapshot';
        if (serviceProps) return 'props';
        return 'none';
    }, [snapshot, serviceProps]);

    useEffect(() => {
        if (open) {
            setScope('global');
            setNodeId('');
        }
    }, [open]);

    const hasGlobal = useMemo(() => registrations.some((registration) => registration.scope === 'global'), [registrations]);

    const nodeTargets = useMemo<NodeTarget[]>(() => {
        if (activeServiceId === undefined || activeServiceId === null) return [];

        if (mode === 'snapshot' && snapshot?.serviceMap) {
            const entries: NodeTarget[] = [];

            for (const [id, primaryIds] of Object.entries(snapshot.serviceMap)) {
                const matchesPrimary = (primaryIds ?? []).some((serviceId) => String(serviceId) === String(activeServiceId));
                if (!matchesPrimary) continue;

                const meta = resolveNodeMeta(serviceProps, id);
                entries.push({
                    id,
                    kind: meta.kind,
                    label: meta.label,
                    serviceId: activeServiceId,
                });
            }

            return dedupeNodeTargets(entries);
        }

        if (mode === 'props' && serviceProps) {
            const entries: NodeTarget[] = [];

            for (const tag of serviceProps.filters ?? []) {
                if (tag.service_id == null || String(tag.service_id) !== String(activeServiceId)) continue;

                entries.push({
                    id: tag.id,
                    kind: 'tag',
                    label: tag.label ?? (tag as { title?: string }).title ?? tag.id,
                    serviceId: tag.service_id,
                });
            }

            for (const field of serviceProps.fields ?? []) {
                if (field.service_id != null && String(field.service_id) === String(activeServiceId)) {
                    entries.push({
                        id: field.id,
                        kind: 'field',
                        label: field.label ?? (field as { title?: string }).title ?? field.id,
                        serviceId: field.service_id,
                    });
                }

                for (const option of field.options ?? []) {
                    if (option.service_id == null || String(option.service_id) !== String(activeServiceId)) continue;

                    entries.push({
                        id: option.id,
                        kind: 'option',
                        label:
                            option.label ??
                            (option as { title?: string }).title ??
                            String((option as { value?: unknown }).value ?? option.id),
                        serviceId: option.service_id,
                    });
                }
            }

            return dedupeNodeTargets(entries);
        }

        return [];
    }, [activeServiceId, mode, serviceProps, snapshot]);

    useEffect(() => {
        if (hasGlobal && scope === 'global') {
            setScope('node');
        }
    }, [hasGlobal, scope]);

    useEffect(() => {
        if (!nodeId) return;
        if (nodeTargets.some((entry) => entry.id === nodeId)) return;
        setNodeId('');
    }, [nodeId, nodeTargets]);

    function handleContinue() {
        if (activeServiceId === undefined || activeServiceId === null) return;

        if (scope === 'global') {
            onSelect(
                {
                    scope: 'global',
                    primary: activeServiceId,
                },
                activeServiceId,
            );
            return;
        }

        if (!nodeId) return;

        const node = nodeTargets.find((entry) => entry.id === nodeId);
        onSelect(
            {
                scope: 'node',
                nodeId,
            },
            node?.serviceId ?? activeServiceId,
        );
    }

    const nodeScopeDisabled = nodeTargets.length === 0;

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Add registration"
            description="Choose the registration scope before selecting fallback candidates."
            footer={
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose} className="rounded-md">
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleContinue} disabled={activeServiceId === undefined || (scope === 'node' && !nodeId)} className="rounded-md">
                        Continue
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-slate-100">Scope</label>
                    <InputField
                        variant="radio"
                        label="Scope"
                        value={scope}
                        onChange={({ value }) => setScope(value as 'global' | 'node')}
                        options={[
                            ...(!hasGlobal ? [{ value: 'global', label: 'Global' }] : []),
                            { value: 'node', label: nodeScopeDisabled ? 'Node (Unavailable)' : 'Node' },
                        ]}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {scope === 'global'
                            ? 'Use one global registration for this primary service.'
                            : mode === 'snapshot'
                              ? 'Pick a node currently active in the order snapshot for this primary service.'
                              : mode === 'props'
                                ? 'Pick a tag, field, or option from ServiceProps that maps to this primary service.'
                                : 'Node-scoped registration is unavailable without OrderSnapshot or ServiceProps.'}
                    </p>
                </div>

                {scope === 'node' ? (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900 dark:text-slate-100">Node id</label>
                        <InputField
                            variant="select"
                            label="Node id"
                            value={nodeId || undefined}
                            onChange={({ value }) => setNodeId(String(value ?? ''))}
                            options={nodeTargets.map((node) => ({
                                value: node.id,
                                label: `[${node.kind}] ${node.label} - #${String(node.serviceId)}`,
                            }))}
                            placeholder="Select node"
                            searchable
                            clearable={false}
                            fullWidth
                        />
                        {nodeScopeDisabled ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {mode === 'snapshot'
                                    ? 'No active snapshot nodes were found for this primary service.'
                                    : mode === 'props'
                                      ? 'No ServiceProps nodes were found for this primary service.'
                                      : 'Node-scoped registration requires either OrderSnapshot or ServiceProps.'}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </ModalShell>
    );
}

type AddCandidatesDialogProps = {
    open: boolean;
    onClose: () => void;
    context: FallbackScopeRef | null;
    primaryId?: ServiceIdRef;
};

export function FallbackAddCandidatesDialog({
    open,
    onClose,
    context,
    primaryId,
}: AddCandidatesDialogProps) {
    const { eligible, addMany } = useFallbackEditor();
    const eligibleServices = useEligibleServiceList();

    const [query, setQuery] = useState('');
    const [filterEligibleOnly, setFilterEligibleOnly] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setQuery('');
            setFilterEligibleOnly(true);
            setSelected(new Set());
        }
    }, [open]);

    const allowedIds = useMemo(() => {
        if (!context || !filterEligibleOnly) return null;
        return new Set(eligible(context).map((id) => String(id)));
    }, [context, eligible, filterEligibleOnly]);

    const items = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return eligibleServices.filter((service) => {
            if (primaryId !== undefined && String(service.id) === String(primaryId)) return false;
            if (allowedIds && !allowedIds.has(String(service.id))) return false;
            if (!normalizedQuery) return true;

            return (
                String(service.id).includes(normalizedQuery) ||
                String(service.name ?? '')
                    .toLowerCase()
                    .includes(normalizedQuery) ||
                String(service.platform ?? '')
                    .toLowerCase()
                    .includes(normalizedQuery)
            );
        });
    }, [allowedIds, eligibleServices, primaryId, query]);

    function toggle(id: ServiceIdRef) {
        setSelected((previous) => {
            const next = new Set(previous);
            const key = String(id);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    async function handleAdd() {
        if (!context || selected.size === 0) return;

        setSubmitting(true);
        try {
            const ids = items.filter((item) => selected.has(String(item.id))).map((item) => item.id);
            addMany(context, ids);
            onClose();
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <ModalShell
            open={open && Boolean(context)}
            onClose={onClose}
            title="Add fallback services"
            description="Search and select one or more eligible fallback candidates."
            size="wide"
            footer={
                <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selected.size} selected</p>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} className="rounded-md">
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void handleAdd()} disabled={selected.size === 0 || submitting} className="rounded-md">
                            {submitting ? 'Adding...' : 'Add selected'}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <InputField
                        variant="text"
                        label="Search eligible services"
                        value={query}
                        onChange={({ value }) => setQuery(String(value ?? ''))}
                        placeholder="Search eligible services"
                        leadingControl={<Search className="size-4 text-slate-400" />}
                        joinControls
                        extendBoxToControls
                        fullWidth
                    />
                    <div className="rounded-md border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <InputField
                            variant="toggle"
                            label="Filter eligible only"
                            value={filterEligibleOnly}
                            onChange={({ value }) => setFilterEligibleOnly(Boolean(value))}
                            onText="On"
                            offText="Off"
                        />
                    </div>
                </div>

                <VirtualServiceList
                    items={items}
                    selected={selected}
                    onToggle={toggle}
                    emptyText="No eligible services found."
                />
            </div>
        </ModalShell>
    );
}

type VirtualizedListItem = {
    id: ServiceIdRef;
    name?: string;
    platform?: string;
    rate?: number;
};

function VirtualServiceList({
    items,
    selected,
    onToggle,
    height = 420,
    rowHeight = 72,
    emptyText = 'No services found.',
}: {
    items: VirtualizedListItem[];
    selected: Set<string>;
    onToggle: (id: ServiceIdRef) => void;
    height?: number;
    rowHeight?: number;
    emptyText?: string;
}) {
    const [scrollTop, setScrollTop] = useState(0);

    const total = items.length;
    const visibleCount = Math.ceil(height / rowHeight);
    const overscan = 6;

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(total, start + visibleCount + overscan * 2);
    const visibleItems = items.slice(start, end);

    if (total === 0) {
        return (
            <div
                className="flex items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400"
                style={{ height }}
            >
                {emptyText}
            </div>
        );
    }

    return (
        <div
            className="overflow-auto rounded-md border border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/70"
            style={{ height }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
            <div className="relative" style={{ height: total * rowHeight }}>
                {visibleItems.map((item, index) => {
                    const absoluteIndex = start + index;
                    const key = String(item.id);
                    const checked = selected.has(key);

                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onToggle(item.id)}
                            className={cn(
                                'absolute left-0 right-0 flex items-center justify-between gap-3 border-b border-slate-100 px-4 text-left transition dark:border-slate-800',
                                checked
                                    ? 'bg-sky-50 dark:bg-sky-500/10'
                                    : 'bg-white/90 hover:bg-slate-50 dark:bg-slate-950/70 dark:hover:bg-slate-900',
                            )}
                            style={{ top: absoluteIndex * rowHeight, height: rowHeight }}
                        >
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    Service #{String(item.id)} - {item.name ?? 'Unnamed'}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {item.platform ?? 'Unknown platform'}
                                    {typeof item.rate === 'number' ? ` | Rate ${item.rate}` : ''}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {checked ? <ToneBadge label="Selected" tone="info" /> : null}
                                <span
                                    className={cn(
                                        'inline-flex size-5 items-center justify-center rounded-md border transition',
                                        checked
                                            ? 'border-sky-500 bg-sky-500 text-white'
                                            : 'border-slate-300 bg-white text-transparent dark:border-slate-700 dark:bg-slate-900',
                                    )}
                                >
                                    <Check className="size-3.5" />
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function resolveNodeMeta(
    props: ServiceProps | undefined,
    nodeId: string,
): { kind: 'tag' | 'field' | 'option' | 'node'; label: string } {
    if (!props) return { kind: 'node', label: nodeId };

    const tag = props.filters?.find((entry) => entry.id === nodeId);
    if (tag) {
        return {
            kind: 'tag',
            label: tag.label ?? (tag as { title?: string }).title ?? tag.id,
        };
    }

    const field = props.fields?.find((entry) => entry.id === nodeId);
    if (field) {
        return {
            kind: 'field',
            label: field.label ?? (field as { title?: string }).title ?? field.id,
        };
    }

    for (const fieldItem of props.fields ?? []) {
        const option = fieldItem.options?.find((entry) => entry.id === nodeId);
        if (!option) continue;

        return {
            kind: 'option',
            label: option.label ?? (option as { title?: string }).title ?? String((option as { value?: unknown }).value ?? option.id),
        };
    }

    return { kind: 'node', label: nodeId };
}

function dedupeNodeTargets(entries: NodeTarget[]) {
    const seen = new Set<string>();

    return entries.filter((entry) => {
        if (seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
    });
}

export function registrationToScope(registration: FallbackRegistration): FallbackScopeRef {
    if (registration.scope === 'global') {
        return {
            scope: 'global',
            primary: registration.primary,
        };
    }

    return {
        scope: 'node',
        nodeId: registration.scopeId!,
    };
}
