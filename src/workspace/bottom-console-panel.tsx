import type { BottomConsolePanelState, BottomPanelTab, BuilderServiceSummary } from '@/builder/bottom-panel.ts';
import {
    buildServiceContextSnapshot,
    buildServiceRowVM,
    createDefaultServiceContext,
    sanitizeServiceContext,
    type ServiceContextSnapshot,
    type ServiceContextState,
    type ServiceListRowVM,
} from '@/builder/service-context.ts';
import { EmptyState, StatusDot } from '@/components/builder/index.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Panel } from '@/components/ui/panel.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { cn } from '@/lib/utils.ts';
import { useCanvas, useWorkspace, type ErrorLog, type UseErrorsReturn, type ValidationRow } from '@timeax/digital-service-engine/workspace';
import { startTransition, type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle, FiFilter, FiInfo, FiLoader, FiSearch, FiTerminal, FiTrash2, FiX } from 'react-icons/fi';
import { LuGripHorizontal, LuLayers3 } from 'react-icons/lu';
import { MdOutlineSync } from 'react-icons/md';

type BottomConsolePanelProps = {
    controller: BottomConsolePanelState;
    errors: UseErrorsReturn;
    activeServices: BuilderServiceSummary[];
    allServices: BuilderServiceSummary[];
    onServiceDragStateChange?: (serviceId: string | null) => void;
};

const DRAG_MIME = 'application/x-service-builder-service';

export function BottomConsolePanel({ controller, errors, activeServices, allServices, onServiceDragStateChange }: BottomConsolePanelProps) {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const servicesMap = (ws.services.data ?? {}) as Record<string, any>;
    const policies = ws.policies.policies.data ?? [];
    const currentTagId = canvas.api.selection.currentTag?.();
    const preferredTagId = currentTagId != null ? String(currentTagId) : (canvas.layers.tags[0]?.id != null ? String(canvas.layers.tags[0]?.id) : null);

    const [activeSearch, setActiveSearch] = useState('');
    const [allSearch, setAllSearch] = useState('');
    const [hideActiveServices, setHideActiveServices] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedActiveServiceId, setSelectedActiveServiceId] = useState<string | null>(null);
    const [selectedAllServiceId, setSelectedAllServiceId] = useState<string | null>(null);
    const [appliedContext, setAppliedContext] = useState<ServiceContextState>(() => createDefaultServiceContext(canvas.props, preferredTagId));
    const [draftContext, setDraftContext] = useState<ServiceContextState>(() => createDefaultServiceContext(canvas.props, preferredTagId));
    const lastHighlightedIdsRef = useRef<string[]>([]);

    const activeServiceIds = useMemo(() => new Set(activeServices.map((service) => String(service.id))), [activeServices]);

    useEffect(() => {
        const next = createDefaultServiceContext(canvas.props, preferredTagId);
        setAppliedContext((current) => normalizeContextState(current, next));
        setDraftContext((current) => normalizeContextState(current, next));
    }, [canvas.props, preferredTagId]);

    const appliedSnapshot = useMemo(
        () => buildServiceContextSnapshot({ props: canvas.props, services: servicesMap, state: appliedContext }),
        [appliedContext, canvas.props, servicesMap],
    );
    const draftSnapshot = useMemo(
        () => buildServiceContextSnapshot({ props: canvas.props, services: servicesMap, state: draftContext }),
        [canvas.props, draftContext, servicesMap],
    );

    const allChecksById = useMemo(() => {
        if (!appliedSnapshot.selectedTag) return new Map<string, any>();
        const candidateIds = Object.values(servicesMap).map((service: any) => service.id);
        const checks = (canvas.api.editor as any).filterServicesForVisibleGroup(candidateIds, {
            tagId: appliedSnapshot.selectedTag.id,
            selectedButtons: appliedSnapshot.state.selectedButtons,
            usedServiceIds: appliedSnapshot.usedServiceIds,
            effectiveConstraints: appliedSnapshot.selectedTag.constraints,
            policies,
        });
        return new Map(checks.map((check: any) => [String(check.id), check]));
    }, [appliedSnapshot, canvas.api.editor, policies, servicesMap]);

    useEffect(() => {
        const next = sanitizeServiceContext(appliedSnapshot, appliedContext);
        if (!sameContextState(appliedContext, next)) setAppliedContext(next);
    }, [appliedContext, appliedSnapshot]);

    useEffect(() => {
        const next = sanitizeServiceContext(draftSnapshot, draftContext);
        if (!sameContextState(draftContext, next)) setDraftContext(next);
    }, [draftContext, draftSnapshot]);

    const activeRows = useMemo(
        () =>
            activeServices
                .map((summary) => buildServiceRowVM({ summary, services: servicesMap, search: activeSearch }))
                .filter((row) => row.passesCurrentFilter),
        [activeSearch, activeServices, servicesMap],
    );

    const allRows = useMemo(
        () =>
            allServices
                .map((summary) =>
                    buildServiceRowVM({
                        summary,
                        services: servicesMap,
                        check: allChecksById.get(String(summary.id)),
                        state: appliedSnapshot.state,
                        search: allSearch,
                    }),
                )
                .filter((row) => row.passesCurrentFilter)
                .filter((row) => !hideActiveServices || !activeServiceIds.has(row.id)),
        [activeServiceIds, allChecksById, allSearch, allServices, appliedSnapshot.state, hideActiveServices, servicesMap],
    );

    useEffect(() => {
        setSelectedActiveServiceId((current) => ensureSelectedRow(current, activeRows));
    }, [activeRows]);

    useEffect(() => {
        setSelectedAllServiceId((current) => ensureSelectedRow(current, allRows));
    }, [allRows]);

    useEffect(() => {
        const desiredIds =
            controller.isOpen && controller.activeTab === 'activeServices' && selectedActiveServiceId
                ? (activeRows.find((row) => row.id === selectedActiveServiceId)?.summary.attachedNodeIds ?? [])
                : [];

        if (!sameIds(lastHighlightedIdsRef.current, desiredIds)) {
            canvas.api.setHighlighted(desiredIds);
            lastHighlightedIdsRef.current = [...desiredIds];
        }

        return () => {
            if (lastHighlightedIdsRef.current.length > 0) {
                canvas.api.setHighlighted([]);
                lastHighlightedIdsRef.current = [];
            }
        };
    }, [activeRows, canvas.api, controller.activeTab, controller.isOpen, selectedActiveServiceId]);

    const tabs: Array<{ id: BottomPanelTab; label: string; icon: ReactNode; count?: number }> = [
        { id: 'console', label: 'Console', icon: <FiTerminal />, count: errors.merged.counts.total },
        { id: 'activeServices', label: 'Active Services', icon: <MdOutlineSync />, count: activeServices.length },
        { id: 'allServices', label: 'All Services', icon: <LuLayers3 />, count: allServices.length },
    ];

    const selectedActiveRow = activeRows.find((row) => row.id === selectedActiveServiceId) ?? null;
    const selectedAllRow = allRows.find((row) => row.id === selectedAllServiceId) ?? null;

    return (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-30">
            <Panel
                edges={['top']}
                defaultHeight={controller.height}
                minHeight={220}
                maxHeight={460}
                maintainPosition
                onResizeEnd={({ height }) => controller.setHeight(height)}
                className={cn(
                    'pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-md transition-all duration-300',
                    'dark:border-slate-800/90 dark:bg-slate-950/95',
                    controller.isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+1rem)] opacity-0',
                )}
            >
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-3 py-2 dark:border-slate-800/80">
                    <div className="flex min-w-0 items-center gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => controller.setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                                    controller.activeTab === tab.id
                                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                                )}
                            >
                                <span className="text-base">{tab.icon}</span>
                                <span className="truncate">{tab.label}</span>
                                {typeof tab.count === 'number' ? (
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]',
                                            tab.id === 'console' && tab.count > 0
                                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
                                                : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                                        )}
                                    >
                                        {tab.count}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1">
                        <div className="hidden items-center gap-2 rounded-xl border border-slate-200/80 px-2 py-1 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 md:flex">
                            <LuGripHorizontal />
                            <span>Resize from top edge</span>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => controller.close()}
                            className="h-8 rounded-xl px-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                        >
                            <FiX />
                        </Button>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800/70">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {controller.activeTab === 'console'
                                    ? 'Workspace console'
                                    : controller.activeTab === 'activeServices'
                                      ? 'Connected services'
                                      : 'Service catalog'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {controller.activeTab === 'console'
                                    ? 'Validation rows come from the engine validator. Logs come from the workspace error stream.'
                                    : controller.activeTab === 'activeServices'
                                      ? 'Bound services can be highlighted back onto the canvas from here.'
                                      : 'Search every service, test it against a safe visible-group context, and drag it onto nodes.'}
                            </p>
                        </div>
                        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                            {controller.activeTab === 'console' ? (
                                <div className="flex items-center justify-end gap-2">
                                    {errors.validating ? <FiLoader className="animate-spin" /> : null}
                                    <span>{errors.validating ? 'Validating...' : 'Console idle'}</span>
                                </div>
                            ) : null}
                            <div className="mt-1">{controller.shortcutLabel}</div>
                            <div className="mt-1">Press Escape to close</div>
                        </div>
                    </div>

                    <ScrollArea className="min-h-0 flex-1">
                        <div className="p-4">
                            {controller.activeTab === 'console' ? <ConsoleTab errors={errors} /> : null}
                            {controller.activeTab === 'activeServices' ? (
                                <ServicesSplitPane
                                    mode="active"
                                    rows={activeRows}
                                    selectedRowId={selectedActiveServiceId}
                                    onSelectRow={setSelectedActiveServiceId}
                                    detailRow={selectedActiveRow}
                                    search={activeSearch}
                                    onSearchChange={setActiveSearch}
                                    onNodeClick={(nodeId) => focusNode(canvas, nodeId)}
                                />
                            ) : null}
                            {controller.activeTab === 'allServices' ? (
                                <ServicesSplitPane
                                    mode="all"
                                    rows={allRows}
                                    selectedRowId={selectedAllServiceId}
                                    onSelectRow={setSelectedAllServiceId}
                                    detailRow={selectedAllRow}
                                    search={allSearch}
                                    onSearchChange={setAllSearch}
                                    filterOpen={filterOpen}
                                    onFilterOpenChange={setFilterOpen}
                                    hideActiveServices={hideActiveServices}
                                    onHideActiveServicesChange={setHideActiveServices}
                                    appliedSnapshot={appliedSnapshot}
                                    draftSnapshot={draftSnapshot}
                                    draftContext={draftContext}
                                    onDraftContextChange={setDraftContext}
                                    onApplyContext={() => {
                                        setAppliedContext(draftContext);
                                        setFilterOpen(false);
                                    }}
                                    onResetContext={() => {
                                        const next = createDefaultServiceContext(canvas.props, preferredTagId);
                                        setDraftContext(next);
                                        setAppliedContext(next);
                                        setFilterOpen(false);
                                    }}
                                    onNodeClick={(nodeId) => focusNode(canvas, nodeId)}
                                    onRowDragStart={(serviceId, event) => {
                                        event.dataTransfer.setData(DRAG_MIME, serviceId);
                                        event.dataTransfer.effectAllowed = 'copy';
                                        onServiceDragStateChange?.(serviceId);
                                    }}
                                    onRowDragEnd={() => onServiceDragStateChange?.(null)}
                                />
                            ) : null}
                        </div>
                    </ScrollArea>
                </div>
            </Panel>
        </div>
    );
}

function ConsoleTab({ errors }: { errors: UseErrorsReturn }) {
    if (errors.merged.counts.total === 0) {
        return (
            <EmptyState
                title="No console issues right now"
                description="The current workspace validates cleanly and there are no pending console logs."
            />
        );
    }

    return (
        <div className="space-y-5">
            {errors.merged.groups.map((group) => (
                <section key={group.kind} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{group.title}</h4>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {group.kind === 'validation'
                                    ? 'These rows come from `validate(props)` and cannot be cleared manually.'
                                    : 'Editor and runtime errors collected from the workspace stream.'}
                            </p>
                        </div>
                        {group.kind === 'log' && group.rows.length ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => errors.clear('logs')} className="h-8 rounded-xl px-3 text-xs">
                                <FiTrash2 />
                                Clear logs
                            </Button>
                        ) : (
                            <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {group.rows.length}
                            </span>
                        )}
                    </div>

                    {group.rows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                            {group.kind === 'validation' ? 'No validation issues.' : 'No logs captured yet.'}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {group.kind === 'validation'
                                ? group.rows.map((row) => <ValidationCard key={row.id} row={row} />)
                                : group.rows.map((row) => <LogCard key={row.id} row={row} onRemove={() => errors.removeLog(row.id)} />)}
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
}

type ServicesSplitPaneProps = {
    mode: 'active' | 'all';
    rows: ServiceListRowVM[];
    selectedRowId: string | null;
    onSelectRow: (id: string | null) => void;
    detailRow: ServiceListRowVM | null;
    onNodeClick: (nodeId: string) => void;
    search: string;
    onSearchChange: (value: string) => void;
    hideActiveServices?: boolean;
    onHideActiveServicesChange?: (value: boolean) => void;
    filterOpen?: boolean;
    onFilterOpenChange?: (open: boolean) => void;
    appliedSnapshot?: ServiceContextSnapshot;
    draftSnapshot?: ServiceContextSnapshot;
    draftContext?: ServiceContextState;
    onDraftContextChange?: (value: ServiceContextState) => void;
    onApplyContext?: () => void;
    onResetContext?: () => void;
    onRowDragStart?: (serviceId: string, event: DragEvent<HTMLButtonElement>) => void;
    onRowDragEnd?: () => void;
};

function ServicesSplitPane(props: ServicesSplitPaneProps) {
    const emptyTitle = props.mode === 'active' ? 'No active services yet' : 'No services match this view';
    const emptyDescription =
        props.mode === 'active'
            ? 'Connect a service to a tag, field, or option and it will appear here with its bindings.'
            : 'Try changing the search or relaxing the safe context filter to bring more services into view.';

    return (
        <div className="grid min-h-[360px] gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(360px,1.15fr)]">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.65rem] border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                <div className="space-y-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                {props.mode === 'active' ? 'Service bindings' : 'Searchable catalog'}
                            </p>
                            <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                                {props.mode === 'active' ? 'Attached services' : 'All services'}
                            </h4>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            {props.rows.length}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <label className="relative min-w-[220px] flex-1">
                            <FiSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                            <input
                                value={props.search}
                                onChange={(event) => props.onSearchChange(event.target.value)}
                                placeholder={props.mode === 'active' ? 'Search active services...' : 'Search by name, id, key, category...'}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm outline-none transition focus:border-blue-300 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:focus:border-blue-500/40"
                            />
                        </label>

                        {props.mode === 'all' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => props.onHideActiveServicesChange?.(!props.hideActiveServices)}
                                    className={cn(
                                        'rounded-2xl border px-3 py-2 text-sm font-medium transition',
                                        props.hideActiveServices
                                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                                            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
                                    )}
                                >
                                    Hide active
                                </button>

                                <SafeContextFilter
                                    open={props.filterOpen ?? false}
                                    onOpenChange={props.onFilterOpenChange ?? (() => {})}
                                    snapshot={props.draftSnapshot}
                                    context={props.draftContext}
                                    onContextChange={props.onDraftContextChange ?? (() => {})}
                                    onApply={props.onApplyContext ?? (() => {})}
                                    onReset={props.onResetContext ?? (() => {})}
                                />
                            </>
                        ) : null}
                    </div>

                    {props.mode === 'all' && props.appliedSnapshot?.selectedTag ? (
                        <div className="flex flex-wrap gap-2">
                            <FilterChip label={`Tag: ${props.appliedSnapshot.selectedTag.label}`} />
                            <FilterChip label={props.appliedSnapshot.state.strictSafety ? 'Strict safety on' : 'Strict safety off'} />
                            <FilterChip label={props.appliedSnapshot.state.enforcePolicies ? 'Policies enforced' : 'Policies relaxed'} />
                            <FilterChip label={`${props.appliedSnapshot.usedServiceIds.length} used service${props.appliedSnapshot.usedServiceIds.length === 1 ? '' : 's'} in context`} />
                        </div>
                    ) : null}
                </div>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-2 p-3">
                        {props.rows.length === 0 ? (
                            <EmptyState title={emptyTitle} description={emptyDescription} />
                        ) : (
                            props.rows.map((row) => (
                                <button
                                    key={row.id}
                                    type="button"
                                    draggable={props.mode === 'all'}
                                    onClick={() => props.onSelectRow(row.id)}
                                    onDragStart={(event) => props.onRowDragStart?.(row.id, event)}
                                    onDragEnd={props.onRowDragEnd}
                                    className={cn(
                                        'w-full rounded-2xl border px-4 py-3 text-left transition',
                                        props.selectedRowId === row.id
                                            ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/10'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <StatusDot tone={row.statusTone} />
                                                <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{row.summary.name}</span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <span>#{row.summary.id}</span>
                                                {row.summary.category ? <span>{row.summary.category}</span> : null}
                                                {row.summary.platformId ? <span>{row.summary.platformId}</span> : null}
                                            </div>
                                        </div>
                                        <span className={statusBadgeClassName(row.statusTone)}>{row.statusLabel}</span>
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                            {row.summary.attachmentCount} node{row.summary.attachmentCount === 1 ? '' : 's'}
                                        </span>
                                        {row.summary.rate != null ? (
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                Rate {row.summary.rate}
                                            </span>
                                        ) : null}
                                        {row.reasonLabels.slice(0, 2).map((reason) => (
                                            <span
                                                key={`${row.id}:${reason}`}
                                                className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                                            >
                                                {reason}
                                            </span>
                                        ))}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.65rem] border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Service detail</p>
                    <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                        {props.detailRow ? props.detailRow.summary.name : 'Select a service'}
                    </h4>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {props.mode === 'active'
                            ? 'Highlight connected nodes, inspect usage, and jump back into the canvas.'
                            : 'Inspect compatibility, pricing, and bindings before assigning the service to a node.'}
                    </p>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="p-5">
                        {props.detailRow ? (
                            <ServiceDetailCard mode={props.mode} row={props.detailRow} snapshot={props.appliedSnapshot ?? null} onNodeClick={props.onNodeClick} />
                        ) : (
                            <EmptyState
                                title="No service selected"
                                description={props.mode === 'active' ? 'Choose a connected service from the list to see its bindings.' : 'Pick a service to inspect how it fits the active safe context.'}
                            />
                        )}
                    </div>
                </ScrollArea>
            </section>
        </div>
    );
}

function SafeContextFilter({
    open,
    onOpenChange,
    snapshot,
    context,
    onContextChange,
    onApply,
    onReset,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    snapshot?: ServiceContextSnapshot;
    context?: ServiceContextState;
    onContextChange: (value: ServiceContextState) => void;
    onApply: () => void;
    onReset: () => void;
}) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition',
                        open
                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
                    )}
                >
                    <FiFilter />
                    Safe context filter
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[420px] rounded-[1.5rem] border-slate-200 bg-white/95 p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950/95">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Safe context filter</p>
                    <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">Visible-group sandbox</h4>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Pick one tag and the visible buttons that define the service-safe context.
                    </p>
                </div>

                <ScrollArea className="max-h-[420px]">
                    <div className="space-y-5 px-5 py-4">
                        <section className="space-y-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tag context</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tags are single-select so the visible group stays deterministic.</p>
                            </div>
                            <div className="space-y-2">
                                {(snapshot?.tags ?? []).map((tag) => {
                                    const selected = (context?.selectedTagId ?? '') === tag.id;
                                    return (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={() =>
                                                onContextChange({
                                                    ...(context ?? createDefaultServiceContext()),
                                                    selectedTagId: tag.id,
                                                    selectedButtons: [],
                                                })
                                            }
                                            className={cn(
                                                'w-full rounded-2xl border px-4 py-3 text-left transition',
                                                selected
                                                    ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10'
                                                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={cn('mt-1 h-3 w-3 rounded-full border-2', selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950')} />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{tag.label}</div>
                                                    {tag.description ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tag.description}</div> : null}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Visible buttons</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">These options are recomputed from the selected tag&apos;s current visible group.</p>
                            </div>

                            {snapshot?.buttonGroups.length ? (
                                <div className="space-y-3">
                                    {snapshot.buttonGroups.map((group) => (
                                        <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{group.label}</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {group.options.map((option) => {
                                                    const selected = context?.selectedButtons.includes(option.id) ?? false;
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            type="button"
                                                            onClick={() =>
                                                                onContextChange({
                                                                    ...(context ?? createDefaultServiceContext()),
                                                                    selectedButtons: selected
                                                                        ? (context?.selectedButtons ?? []).filter((id) => id !== option.id)
                                                                        : [...(context?.selectedButtons ?? []), option.id],
                                                                })
                                                            }
                                                            className={cn(
                                                                'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                                                                selected
                                                                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200'
                                                                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300',
                                                            )}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                    No button triggers are visible for the selected tag yet.
                                </div>
                            )}
                        </section>

                        <section className="grid gap-3 sm:grid-cols-2">
                            <ToggleCard
                                title="Strict safety"
                                description="Only surface services that fit this context cleanly."
                                enabled={context?.strictSafety ?? true}
                                onToggle={() =>
                                    onContextChange({
                                        ...(context ?? createDefaultServiceContext()),
                                        strictSafety: !(context?.strictSafety ?? true),
                                    })
                                }
                            />
                            <ToggleCard
                                title="Enforce policies"
                                description="Keep dynamic service policies active while filtering."
                                enabled={context?.enforcePolicies ?? true}
                                onToggle={() =>
                                    onContextChange({
                                        ...(context ?? createDefaultServiceContext()),
                                        enforcePolicies: !(context?.enforcePolicies ?? true),
                                    })
                                }
                            />
                        </section>
                    </div>
                </ScrollArea>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                    <Button type="button" variant="ghost" size="sm" onClick={onReset} className="rounded-xl">
                        Reset
                    </Button>
                    <Button type="button" size="sm" onClick={onApply} className="rounded-xl">
                        Apply context
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function ServiceDetailCard({
    mode,
    row,
    snapshot,
    onNodeClick,
}: {
    mode: 'active' | 'all';
    row: ServiceListRowVM;
    snapshot: ServiceContextSnapshot | null;
    onNodeClick: (nodeId: string) => void;
}) {
    const summary = row.summary;
    const service = row.service;

    return (
        <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <StatusDot tone={row.statusTone} className="mt-0.5" />
                            <h5 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{summary.name}</h5>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>#{summary.id}</span>
                            {summary.category ? <span>{summary.category}</span> : null}
                            {summary.platformId ? <span>{summary.platformId}</span> : null}
                        </div>
                    </div>
                    <span className={statusBadgeClassName(row.statusTone)}>{row.statusLabel}</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailMetric label="Rate" value={summary.rate != null ? String(summary.rate) : 'Not set'} />
                    <DetailMetric label="Estimate" value={summary.estimate ?? 'No estimate'} />
                    <DetailMetric label="Min" value={summary.min != null ? String(summary.min) : '0'} />
                    <DetailMetric label="Max" value={summary.max != null ? String(summary.max) : 'Unlimited'} />
                </div>
            </div>

            {mode === 'all' ? (
                <section className="space-y-3">
                    <SectionTitle title="Context fit" description="This summary comes from the current safe-context filter." />
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                        <div className="flex flex-wrap gap-2">
                            <FilterChip label={row.check?.fitsConstraints ? 'Constraints fit' : 'Constraint mismatch'} tone={row.check?.fitsConstraints ? 'success' : 'danger'} />
                            <FilterChip label={row.check?.passesRate ? 'Rate ok' : 'Rate blocked'} tone={row.check?.passesRate ? 'success' : 'warning'} />
                            <FilterChip
                                label={snapshot?.state.enforcePolicies === false ? 'Policies relaxed' : row.check?.passesPolicies ? 'Policies pass' : 'Policy blocked'}
                                tone={snapshot?.state.enforcePolicies === false ? 'default' : row.check?.passesPolicies ? 'success' : 'danger'}
                            />
                        </div>
                        {row.reasonLabels.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {row.reasonLabels.map((reason) => (
                                    <span key={`${row.id}:${reason}`} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                                        {reason}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">This service is a clean fit for the current tag and button context.</p>
                        )}
                    </div>
                </section>
            ) : null}

            <section className="space-y-3">
                <SectionTitle title="Capabilities" description="Flags and pricing hints attached to this service." />
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                    {summary.flags.length || service?.meta ? (
                        <div className="flex flex-wrap gap-2">
                            {summary.flags.map((flag) => (
                                <span key={flag} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                                    {flag}
                                </span>
                            ))}
                            {Object.keys(service?.meta ?? {})
                                .slice(0, 3)
                                .map((key) => (
                                    <span key={key} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                        {key}
                                    </span>
                                ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No capability flags were published for this service.</p>
                    )}
                </div>
            </section>

            <section className="space-y-3">
                <SectionTitle title="Bindings" description="Nodes currently connected to this service. Click any node to jump back into the canvas." />
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                    {summary.attachedNodeIds.length ? (
                        <div className="flex flex-wrap gap-2">
                            {summary.attachedNodeIds.map((nodeId, index) => (
                                <button
                                    key={`${row.id}:${nodeId}`}
                                    type="button"
                                    onClick={() => onNodeClick(nodeId)}
                                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {summary.attachedNodeLabels[index] ?? nodeId}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">This service is not attached to any node yet. Drag it from the catalog onto a node to assign it.</p>
                    )}
                </div>
            </section>
        </div>
    );
}

function ToggleCard({ title, description, enabled, onToggle }: { title: string; description: string; enabled: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={cn(
                'rounded-2xl border px-4 py-3 text-left transition',
                enabled
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                </div>
                <div className={cn('h-2.5 w-2.5 rounded-full', enabled ? 'bg-emerald-500' : 'bg-slate-400')} />
            </div>
        </button>
    );
}

function ValidationCard({ row }: { row: ValidationRow }) {
    const canvas = useCanvas();
    const scope = describeValidationScope(canvas, row);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{iconForSeverity(row.severity)}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={severityBadgeClassName(row.severity)}>{row.code.replaceAll('_', ' ')}</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.message}</span>
                    </div>
                    {scope.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {scope.map((item) => (
                                <span
                                    key={item}
                                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function LogCard({ row, onRemove }: { row: ErrorLog; onRemove: () => void }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex items-start gap-3">
                <div className="mt-0.5">
                    <FiInfo className="text-lg text-sky-500" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                            {row.code ?? 'log'}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.message}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>{new Date(row.createdAt).toLocaleTimeString()}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 rounded-xl px-2 text-xs">
                            <FiX />
                            Dismiss
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
    );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-950">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
    );
}

function FilterChip({ label, tone = 'default' }: { label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
    return <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', filterChipClassName(tone))}>{label}</span>;
}

function describeValidationScope(canvas: ReturnType<typeof useCanvas>, row: ValidationRow) {
    const chips: string[] = [];

    if (row.nodeId) {
        chips.push(toNodeChip(canvas, row.nodeId));
    }

    const affectedIds = Array.isArray(row.details?.affectedIds) ? row.details.affectedIds : [];
    for (const affectedId of affectedIds) {
        chips.push(toNodeChip(canvas, String(affectedId)));
    }

    return Array.from(new Set(chips));
}

function toNodeChip(canvas: ReturnType<typeof useCanvas>, id: string) {
    const node = canvas.selector.getNode(id);
    if (node && typeof node === 'object' && 'raw' in node && node.raw && typeof node.raw === 'object' && 'label' in node.raw) {
        const kind = 'kind' in node && typeof node.kind === 'string' ? node.kind : 'node';
        const label = typeof node.raw.label === 'string' ? node.raw.label : id;
        return `${capitalize(kind)}: ${label}`;
    }
    return `Node: ${id}`;
}

function focusNode(canvas: ReturnType<typeof useCanvas>, nodeId: string) {
    startTransition(() => {
        canvas.setActive(nodeId);
        canvas.api.select([nodeId]);
        canvas.api.setHighlighted([nodeId]);
    });
}

function ensureSelectedRow(current: string | null, rows: ServiceListRowVM[]) {
    if (current && rows.some((row) => row.id === current)) return current;
    return rows[0]?.id ?? null;
}

function normalizeContextState(current: ServiceContextState, fallback: ServiceContextState) {
    if (!current.selectedTagId) {
        return sameContextState(current, fallback) ? current : fallback;
    }
    return current;
}

function sameContextState(a: ServiceContextState, b: ServiceContextState) {
    return (
        a.selectedTagId === b.selectedTagId &&
        a.strictSafety === b.strictSafety &&
        a.enforcePolicies === b.enforcePolicies &&
        a.selectedButtons.length === b.selectedButtons.length &&
        a.selectedButtons.every((value, index) => value === b.selectedButtons[index])
    );
}

function sameIds(a: readonly string[], b: readonly string[]) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

function iconForSeverity(severity: ValidationRow['severity']) {
    if (severity === 'error') return <FiAlertCircle className="text-lg text-rose-500" />;
    if (severity === 'warning') return <FiAlertCircle className="text-lg text-amber-500" />;
    return <FiInfo className="text-lg text-sky-500" />;
}

function severityBadgeClassName(severity: ValidationRow['severity']) {
    return cn(
        'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
        severity === 'error' && 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
        severity === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
        severity === 'info' && 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
    );
}

function statusBadgeClassName(tone: 'success' | 'warning' | 'danger' | 'default') {
    return cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', filterChipClassName(tone));
}

function filterChipClassName(tone: 'success' | 'warning' | 'danger' | 'default') {
    if (tone === 'success') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';
    if (tone === 'warning') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
    if (tone === 'danger') return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300';
}

function capitalize(value: string) {
    return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
