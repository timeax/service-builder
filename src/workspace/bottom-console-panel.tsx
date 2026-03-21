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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import { useCanvas, useWorkspace, type ErrorLog, type UseErrorsReturn, type ValidationRow } from '@timeax/digital-service-engine/workspace';
import { startTransition, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle, FiChevronRight, FiFilter, FiInfo, FiLoader, FiSearch, FiTerminal, FiTrash2, FiX } from 'react-icons/fi';
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
const PANEL_MARGIN = 16;
const PANEL_LEFT_KEY = 'service-builder.bottom-panel.pos-x';
const PANEL_BOTTOM_KEY = 'service-builder.bottom-panel.pos-y';
type PanelPosition = { left: number | null; bottom: number | null };
type ConsoleSubTab = 'validation' | 'logs' | 'notices';
type ConsoleScopeFilter = 'all' | 'activeNode';
type ConsoleSeverityFilter = 'all' | 'error' | 'warning' | 'info';
type ConsoleIntroState = Record<ConsoleSubTab, { minimized: boolean; closed: boolean }>;

type ServiceNotice = {
    id: string;
    type: 'public' | 'private';
    kind: 'label' | 'warning' | 'deprecation' | 'compat' | 'migration' | 'policy' | string;
    severity: 'info' | 'warning' | 'error';
    target: { scope: 'global' } | { scope: 'node'; node_kind: 'tag' | 'field' | 'option' | string; node_id: string };
    title: string;
    description?: string;
    reason?: string;
    marked_at?: string;
    icon?: string;
    color?: string;
    meta?: Record<string, unknown>;
};

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
    const [panelPosition, setPanelPosition] = useState<PanelPosition>(() => readStoredPanelPosition());
    const [draggingPanel, setDraggingPanel] = useState(false);
    const [consoleSubTab, setConsoleSubTab] = useState<ConsoleSubTab>('validation');
    const [consoleScopeFilter, setConsoleScopeFilter] = useState<ConsoleScopeFilter>('all');
    const [consoleSeverityFilter, setConsoleSeverityFilter] = useState<ConsoleSeverityFilter>('all');
    const [consoleIntroState, setConsoleIntroState] = useState<ConsoleIntroState>({
        validation: { minimized: false, closed: false },
        logs: { minimized: false, closed: false },
        notices: { minimized: false, closed: false },
    });
    const lastHighlightedIdsRef = useRef<string[]>([]);
    const panelContainerRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const dragStartRef = useRef<{ x: number; y: number; position: { left: number; bottom: number } } | null>(null);

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

    const notices = useMemo(() => normalizeNotices((canvas.props as { notices?: unknown[] } | null | undefined)?.notices), [canvas.props]);
    const activeNodeIds = useMemo(() => {
        const ids = new Set<string>();
        if (canvas.activeId) ids.add(String(canvas.activeId));
        for (const id of canvas.selectionInfo.ids as string[]) ids.add(String(id));
        return ids;
    }, [canvas.activeId, canvas.selectionInfo.ids]);
    const consoleIssueCount = errors.validation.length + errors.logs.length + notices.length;

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
    }, [activeRows, canvas.api, controller.activeTab, controller.isOpen, selectedActiveServiceId]);

    useEffect(() => {
        return () => {
            if (lastHighlightedIdsRef.current.length) {
                canvas.api.setHighlighted([]);
                lastHighlightedIdsRef.current = [];
            }
        };
    }, [canvas.api]);

    useEffect(() => {
        setPanelPosition((current) => {
            const resolved = resolvePanelPosition(current, panelRef.current, panelContainerRef.current);
            persistPanelPosition(resolved);
            return resolved;
        });
    }, [controller.height, controller.width]);

    const onPanelDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        const resolved = resolvePanelPosition(panelPosition, panelRef.current, panelContainerRef.current);
        dragStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            position: resolved,
        };
        setDraggingPanel(true);
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Ignore capture failures and continue with window listeners.
        }
        event.preventDefault();
    };

    useEffect(() => {
        if (!draggingPanel) return;

        const onPointerMove = (event: PointerEvent) => {
            const start = dragStartRef.current;
            if (!start) return;

            const next = {
                left: start.position.left + (event.clientX - start.x),
                bottom: start.position.bottom - (event.clientY - start.y),
            };

            setPanelPosition(clampPanelPosition(next, panelRef.current, panelContainerRef.current));
        };

        const onPointerUp = () => {
            setDraggingPanel(false);
            dragStartRef.current = null;
            setPanelPosition((current) => {
                persistPanelPosition(current);
                return current;
            });
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp, { once: true });
        window.addEventListener('pointercancel', onPointerUp, { once: true });
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
        };
    }, [draggingPanel, panelPosition]);

    const tabs: Array<{ id: BottomPanelTab; label: string; icon: ReactNode; count?: number }> = [
        { id: 'console', label: 'Console', icon: <FiTerminal />, count: consoleIssueCount },
        { id: 'activeServices', label: 'Active Services', icon: <MdOutlineSync />, count: activeServices.length },
        { id: 'allServices', label: 'All Services', icon: <LuLayers3 />, count: allServices.length },
    ];

    const selectedActiveRow = activeRows.find((row) => row.id === selectedActiveServiceId) ?? null;
    const selectedAllRow = allRows.find((row) => row.id === selectedAllServiceId) ?? null;

    return (
        <div
            ref={panelContainerRef}
            className="pointer-events-none absolute inset-0"
        >
            <Panel
                ref={panelRef}
                edges={['left', 'right', 'top']}
                defaultWidth={controller.width}
                defaultHeight={controller.height}
                minWidth={520}
                maxWidth={1600}
                minHeight={220}
                maxHeight={460}
                onResizeEnd={({ width, height }) => {
                    controller.setWidth(width);
                    controller.setHeight(height);
                    setPanelPosition((current) => {
                        const clamped = resolvePanelPosition(current, panelRef.current, panelContainerRef.current);
                        persistPanelPosition(clamped);
                        return clamped;
                    });
                }}
                className={cn(
                    'pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-md transition-all duration-300',
                    'dark:border-slate-800/90 dark:bg-slate-950/95',
                    controller.isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+1rem)] opacity-0',
                )}
                style={{
                    left: panelPosition.left != null ? `${panelPosition.left}px` : `${PANEL_MARGIN}px`,
                    bottom: panelPosition.bottom != null ? `${panelPosition.bottom}px` : `${PANEL_MARGIN}px`,
                }}
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
                        <button
                            type="button"
                            onPointerDown={onPanelDragStart}
                            className={cn(
                                'flex items-center gap-2 rounded-xl border border-slate-200/80 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900',
                                draggingPanel && 'cursor-grabbing',
                            )}
                        >
                            <LuGripHorizontal />
                            <span>{draggingPanel ? 'Dragging panel...' : 'Drag panel'}</span>
                        </button>
                        <div className="hidden items-center gap-2 rounded-xl border border-slate-200/80 px-2 py-1 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 md:flex">
                            <LuGripHorizontal />
                            <span>Resize from top or side edges</span>
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
                    {controller.activeTab !== 'console' ? (
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800/70">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {controller.activeTab === 'activeServices' ? 'Connected services' : 'Service catalog'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {controller.activeTab === 'activeServices'
                                        ? 'Bound services can be highlighted back onto the canvas from here.'
                                        : 'Search every service, test it against a safe visible-group context, and drag it onto nodes.'}
                                </p>
                            </div>
                            <div className="text-right text-xs text-slate-500 dark:text-slate-400">{controller.shortcutLabel}</div>
                        </div>
                    ) : null}

                    <ScrollArea className="min-h-0 flex-1">
                        <div className="p-4">
                            {controller.activeTab === 'console' ? (
                                <ConsoleTab
                                    errors={errors}
                                    notices={notices}
                                    activeNodeIds={activeNodeIds}
                                    subTab={consoleSubTab}
                                    onSubTabChange={setConsoleSubTab}
                                    scopeFilter={consoleScopeFilter}
                                    onScopeFilterChange={setConsoleScopeFilter}
                                    severityFilter={consoleSeverityFilter}
                                    onSeverityFilterChange={setConsoleSeverityFilter}
                                    validating={errors.validating}
                                    shortcutLabel={controller.shortcutLabel}
                                    introState={consoleIntroState}
                                    onToggleIntroMinimized={(tab) =>
                                        setConsoleIntroState((current) => ({
                                            ...current,
                                            [tab]: { ...current[tab], minimized: !current[tab].minimized },
                                        }))
                                    }
                                    onCloseIntro={(tab) =>
                                        setConsoleIntroState((current) => ({
                                            ...current,
                                            [tab]: { ...current[tab], closed: true },
                                        }))
                                    }
                                    onNodeClick={(nodeId) => focusNode(canvas, nodeId)}
                                />
                            ) : null}
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

function ConsoleTab({
    errors,
    notices,
    activeNodeIds,
    subTab,
    onSubTabChange,
    scopeFilter,
    onScopeFilterChange,
    severityFilter,
    onSeverityFilterChange,
    validating,
    shortcutLabel,
    introState,
    onToggleIntroMinimized,
    onCloseIntro,
    onNodeClick,
}: {
    errors: UseErrorsReturn;
    notices: ServiceNotice[];
    activeNodeIds: ReadonlySet<string>;
    subTab: ConsoleSubTab;
    onSubTabChange: (tab: ConsoleSubTab) => void;
    scopeFilter: ConsoleScopeFilter;
    onScopeFilterChange: (scope: ConsoleScopeFilter) => void;
    severityFilter: ConsoleSeverityFilter;
    onSeverityFilterChange: (severity: ConsoleSeverityFilter) => void;
    validating: boolean;
    shortcutLabel: string;
    introState: ConsoleIntroState;
    onToggleIntroMinimized: (tab: ConsoleSubTab) => void;
    onCloseIntro: (tab: ConsoleSubTab) => void;
    onNodeClick: (nodeId: string) => void;
}) {
    const hasActiveSelection = activeNodeIds.size > 0;
    const validationRows = errors.validation.filter((row) => matchesValidationScope(row, scopeFilter, activeNodeIds)).filter((row) => matchesSeverity(row.severity, severityFilter));
    const logRows = errors.logs.filter((row) => matchesLogScope(row, scopeFilter, activeNodeIds));
    const noticeRows = notices.filter((notice) => matchesNoticeScope(notice, scopeFilter, activeNodeIds)).filter((notice) => matchesSeverity(notice.severity, severityFilter));

    const subTabs: Array<{ id: ConsoleSubTab; label: string; count: number }> = [
        { id: 'validation', label: 'Validation', count: validationRows.length },
        { id: 'logs', label: 'Logs', count: logRows.length },
        { id: 'notices', label: 'Notices', count: noticeRows.length },
    ];
    const activeIntro = introState[subTab];
    const introCopy = getConsoleIntroCopy(subTab);

    return (
        <div className="space-y-4">
            {!activeIntro.closed ? (
                <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 p-3 dark:border-sky-500/20 dark:bg-sky-500/10">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{introCopy.title}</p>
                            {!activeIntro.minimized ? (
                                <>
                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{introCopy.description}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                        <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">
                                            {validating ? 'Validating...' : 'Console idle'}
                                        </span>
                                        <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">{shortcutLabel}</span>
                                        <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">Press Escape to close</span>
                                    </div>
                                </>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => onToggleIntroMinimized(subTab)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                            >
                                {activeIntro.minimized ? 'Expand' : 'Minimize'}
                            </button>
                            <button
                                type="button"
                                onClick={() => onCloseIntro(subTab)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {subTabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onSubTabChange(tab.id)}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors',
                                    subTab === tab.id
                                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                                )}
                            >
                                <span>{tab.label}</span>
                                <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{tab.count}</span>
                            </button>
                        ))}
                    </div>

                    {subTab === 'logs' && logRows.length ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => errors.clear('logs')} className="h-8 rounded-xl px-3 text-xs">
                            <FiTrash2 />
                            Clear logs
                        </Button>
                    ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Scope</span>
                    <button
                        type="button"
                        onClick={() => onScopeFilterChange('all')}
                        className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium transition',
                            scopeFilter === 'all'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                        )}
                    >
                        All items
                    </button>
                    <button
                        type="button"
                        onClick={() => onScopeFilterChange('activeNode')}
                        className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium transition',
                            scopeFilter === 'activeNode'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                        )}
                    >
                        Active node
                    </button>

                    {subTab !== 'logs' ? (
                        <>
                            <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Severity</span>
                            {(['all', 'error', 'warning', 'info'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => onSeverityFilterChange(option)}
                                    className={cn(
                                        'rounded-full px-2.5 py-1 text-xs font-medium capitalize transition',
                                        severityFilter === option
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                                    )}
                                >
                                    {option}
                                </button>
                            ))}
                        </>
                    ) : null}
                </div>

                {scopeFilter === 'activeNode' && !hasActiveSelection ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">No active node selected. Select a node to filter by active scope.</p>
                ) : null}
            </div>

            {subTab === 'validation' ? (
                validationRows.length ? (
                    <div className="space-y-3">{validationRows.map((row) => <ValidationCard key={row.id} row={row} />)}</div>
                ) : (
                    <EmptyState
                        title="No validation rows for this filter"
                        description={scopeFilter === 'activeNode' ? 'No validation rows match the current active node scope.' : 'No validation rows match the current severity filter.'}
                    />
                )
            ) : null}

            {subTab === 'logs' ? (
                logRows.length ? (
                    <div className="space-y-3">{logRows.map((row) => <LogCard key={row.id} row={row} onRemove={() => errors.removeLog(row.id)} />)}</div>
                ) : (
                    <EmptyState
                        title="No logs for this filter"
                        description={scopeFilter === 'activeNode' ? 'No logs are linked to the current active node scope.' : 'No logs have been captured yet.'}
                    />
                )
            ) : null}

            {subTab === 'notices' ? (
                noticeRows.length ? (
                    <div className="space-y-3">{noticeRows.map((row) => <NoticeCard key={row.id} notice={row} onNodeClick={onNodeClick} />)}</div>
                ) : (
                    <EmptyState
                        title="No notices for this filter"
                        description={scopeFilter === 'activeNode' ? 'No node-scoped notices match the current active node.' : 'No notices match the current severity filter.'}
                    />
                )
            ) : null}
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
        <div className="min-h-90">
            <ResizablePanelGroup direction="horizontal" className="min-h-90">
                <ResizablePanel defaultSize={44} minSize={30}>
                    <section className="flex h-full min-h-0 flex-col overflow-hidden">
                        <div className="space-y-3 border-b pr-4 border-slate-100 dark:border-slate-800">
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
                                <label className="relative min-w-55 flex-1">
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
                            <div className="space-y-2 p-3 pl-0">
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
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={56} minSize={36}>
                    <section className="flex h-full min-h-0 flex-col overflow-hidden">
                        <div className="border-b border-slate-100 px-4 dark:border-slate-800">
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
                </ResizablePanel>
            </ResizablePanelGroup>
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
    const [selectionMode, setSelectionMode] = useState<'all' | 'any'>('all');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const nextGroups = snapshot?.buttonGroups ?? [];
        setExpandedGroups((current) => {
            const next: Record<string, boolean> = {};
            let changed = false;

            nextGroups.forEach((group, index) => {
                const hasSelectedOption = group.options.some((option) => context?.selectedButtons.includes(option.id));
                const fallback = hasSelectedOption || index === 0;
                next[group.id] = current[group.id] ?? fallback;
                if (next[group.id] !== current[group.id]) changed = true;
            });

            if (Object.keys(current).length !== nextGroups.length) changed = true;
            return changed ? next : current;
        });
    }, [context?.selectedButtons, snapshot?.buttonGroups]);

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
            <PopoverContent
                align="end"
                sideOffset={8}
                avoidCollisions
                collisionPadding={16}
                className="flex h-[min(34rem,var(--radix-popover-content-available-height))] w-[26rem] min-w-80 max-w-[min(26rem,var(--radix-popover-content-available-width))] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl shadow-black/20 dark:border-slate-800 dark:bg-slate-950"
            >
                <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-4 dark:border-slate-800/80 dark:bg-slate-900/30">
                    <h3 className="text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">Safe Context Filter</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Define the evaluation context for services.</p>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-4 p-4">
                        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tags</h4>
                            <div className="mt-3 space-y-2.5">
                                {(snapshot?.tags ?? []).map((tag) => {
                                    const selected = (context?.selectedTagId ?? '') === tag.id;
                                    return (
                                        <label
                                            key={tag.id}
                                            className={cn(
                                                'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm text-slate-900 transition-colors dark:text-slate-100',
                                                selected
                                                    ? 'border-blue-200 bg-blue-50/70 dark:border-blue-500/30 dark:bg-blue-500/10'
                                                    : 'border-transparent hover:border-slate-200 hover:bg-white/70 dark:hover:border-slate-700 dark:hover:bg-slate-950/60',
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="safe-context-tag"
                                                checked={selected}
                                                onChange={() =>
                                                    onContextChange({
                                                        ...(context ?? createDefaultServiceContext()),
                                                        selectedTagId: tag.id,
                                                        selectedButtons: [],
                                                    })
                                                }
                                                className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-950"
                                            />
                                            <span className="min-w-0">
                                                <span className={cn('block', selected ? 'font-semibold' : 'font-medium')}>{tag.label}</span>
                                                {tag.description ? <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{tag.description}</span> : null}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-1 text-sm dark:border-slate-700 dark:bg-slate-950">
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('all')}
                                    className={cn(
                                        'w-1/2 rounded-lg px-2 py-1.5 transition-all duration-200',
                                        selectionMode === 'all'
                                            ? 'bg-slate-100 font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                                            : 'text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800/70',
                                    )}
                                >
                                    All selected
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('any')}
                                    className={cn(
                                        'w-1/2 rounded-lg px-2 py-1.5 transition-all duration-200',
                                        selectionMode === 'any'
                                            ? 'bg-slate-100 font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                                            : 'text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800/70',
                                    )}
                                >
                                    Any selected
                                </button>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Buttons (Context Options)</h4>

                            {snapshot?.buttonGroups.length ? (
                                <div className="mt-3 space-y-3">
                                    {snapshot.buttonGroups.map((group) => (
                                        <div key={group.id} className="relative rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/70">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}
                                                className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100"
                                            >
                                                <FiChevronRight className={cn('text-slate-400 transition-transform duration-200', expandedGroups[group.id] ? 'rotate-90' : 'rotate-0')} />
                                                <span>{group.label}</span>
                                            </button>
                                            {expandedGroups[group.id] ? (
                                                <div className="space-y-2 pt-2 pl-7">
                                                    {group.options.map((option) => {
                                                        const selected = context?.selectedButtons.includes(option.id) ?? false;
                                                        return (
                                                            <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-900 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selected}
                                                                    onChange={() =>
                                                                        onContextChange({
                                                                            ...(context ?? createDefaultServiceContext()),
                                                                            selectedButtons: selected
                                                                                ? (context?.selectedButtons ?? []).filter((id) => id !== option.id)
                                                                                : [...(context?.selectedButtons ?? []), option.id],
                                                                        })
                                                                    }
                                                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-950"
                                                                />
                                                                <span className="min-w-0">
                                                                    <span className="block">{option.label}</span>
                                                                    {option.description ? <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{option.description}</span> : null}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                                    No button triggers are visible for the selected tag yet.
                                </div>
                            )}
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Safety Toggles</h4>
                            <div className="mt-3 space-y-2">
                                <SafetyToggleRow
                                    title="Strict safety"
                                    checked={context?.strictSafety ?? true}
                                    tooltip="Omit services causing rate mismatches or utility services lacking a visible base."
                                    onChange={() =>
                                        onContextChange({
                                            ...(context ?? createDefaultServiceContext()),
                                            strictSafety: !(context?.strictSafety ?? true),
                                        })
                                    }
                                />
                                <SafetyToggleRow
                                    title="Enforce policies"
                                    checked={context?.enforcePolicies ?? true}
                                    tooltip="Omit services implicated by policy violations."
                                    onChange={() =>
                                        onContextChange({
                                            ...(context ?? createDefaultServiceContext()),
                                            enforcePolicies: !(context?.enforcePolicies ?? true),
                                        })
                                    }
                                />
                            </div>
                        </section>
                    </div>
                </ScrollArea>

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <button
                        type="button"
                        onClick={onReset}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onApply}
                        className="rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                    >
                        Apply
                    </button>
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

function PopoverSectionDivider() {
    return <div className="h-px bg-slate-200 dark:bg-slate-800" />;
}

function SafetyToggleRow({ title, checked, tooltip, onChange }: { title: string; checked: boolean; tooltip: string; onChange: () => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-900 dark:text-slate-100">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-950"
                />
                {title}
            </label>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" className="text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                        <FiInfo className="h-4 w-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="max-w-60 rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-950">
                    {tooltip}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}

function NoticeCard({ notice, onNodeClick }: { notice: ServiceNotice; onNodeClick: (nodeId: string) => void }) {
    const canvas = useCanvas();
    const targetNodeId = notice.target.scope === 'node' ? notice.target.node_id : null;
    const targetChip =
        notice.target.scope === 'node'
            ? toNodeChip(canvas, notice.target.node_id)
            : 'Global notice';

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{iconForSeverity(notice.severity)}</div>
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={severityBadgeClassName(notice.severity)}>{notice.kind}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            {notice.type}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{notice.title}</span>
                    </div>
                    {notice.description ? <p className="text-sm text-slate-600 dark:text-slate-300">{notice.description}</p> : null}
                    {notice.reason ? <p className="text-xs text-slate-500 dark:text-slate-400">Reason: {notice.reason}</p> : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {notice.target.scope === 'node' ? (
                            <button
                                type="button"
                                onClick={() => targetNodeId && onNodeClick(targetNodeId)}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                {targetChip}
                            </button>
                        ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">{targetChip}</span>
                        )}
                        {notice.marked_at ? <span>{new Date(notice.marked_at).toLocaleString()}</span> : null}
                        {notice.icon ? <span>Icon: {notice.icon}</span> : null}
                        {notice.color ? <span>Color: {notice.color}</span> : null}
                    </div>
                </div>
            </div>
        </div>
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

function getConsoleIntroCopy(tab: ConsoleSubTab) {
    if (tab === 'validation') {
        return {
            title: 'Validation Console',
            description: 'Validation rows come from the engine validator and reflect service/schema consistency checks.',
        };
    }
    if (tab === 'logs') {
        return {
            title: 'Runtime Logs',
            description: 'Logs come from workspace/editor runtime events and can be cleared or dismissed.',
        };
    }
    return {
        title: 'Schema Notices',
        description: 'Notices come from schema props and include public/private messaging with global or node scope.',
    };
}

function normalizeNotices(input: unknown[] | undefined): ServiceNotice[] {
    if (!Array.isArray(input)) return [];
    return input
        .map((entry, index) => {
            if (!entry || typeof entry !== 'object') return null;
            const row = entry as Record<string, unknown>;
            const rawTarget = row.target as Record<string, unknown> | undefined;
            const scope = rawTarget?.scope === 'node' ? 'node' : 'global';
            const target =
                scope === 'node'
                    ? {
                          scope: 'node' as const,
                          node_kind: String(rawTarget?.node_kind ?? 'node'),
                          node_id: String(rawTarget?.node_id ?? ''),
                      }
                    : ({ scope: 'global' } as const);
            return {
                id: typeof row.id === 'string' ? row.id : `notice:${index}`,
                type: row.type === 'private' ? 'private' : 'public',
                kind: typeof row.kind === 'string' ? row.kind : 'warning',
                severity: row.severity === 'error' || row.severity === 'warning' ? row.severity : 'info',
                target,
                title: typeof row.title === 'string' && row.title.trim() ? row.title : 'Untitled notice',
                description: typeof row.description === 'string' ? row.description : undefined,
                reason: typeof row.reason === 'string' ? row.reason : undefined,
                marked_at: typeof row.marked_at === 'string' ? row.marked_at : undefined,
                icon: typeof row.icon === 'string' ? row.icon : undefined,
                color: typeof row.color === 'string' ? row.color : undefined,
                meta: row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : undefined,
            } satisfies ServiceNotice;
        })
        .filter(Boolean) as ServiceNotice[];
}

function matchesSeverity(severity: 'error' | 'warning' | 'info', filter: ConsoleSeverityFilter) {
    return filter === 'all' || severity === filter;
}

function matchesValidationScope(row: ValidationRow, scopeFilter: ConsoleScopeFilter, activeNodeIds: ReadonlySet<string>) {
    if (scopeFilter === 'all') return true;
    if (!activeNodeIds.size) return false;
    const ids = new Set<string>();
    if (row.nodeId) ids.add(String(row.nodeId));
    const affectedIds = Array.isArray(row.details?.affectedIds) ? row.details.affectedIds : [];
    for (const id of affectedIds) ids.add(String(id));
    for (const id of ids) {
        if (activeNodeIds.has(id)) return true;
    }
    return false;
}

function matchesLogScope(row: ErrorLog, scopeFilter: ConsoleScopeFilter, activeNodeIds: ReadonlySet<string>) {
    if (scopeFilter === 'all') return true;
    if (!activeNodeIds.size) return false;
    const ids = extractLogNodeIds(row);
    return ids.some((id) => activeNodeIds.has(id));
}

function matchesNoticeScope(notice: ServiceNotice, scopeFilter: ConsoleScopeFilter, activeNodeIds: ReadonlySet<string>) {
    if (scopeFilter === 'all') return true;
    if (!activeNodeIds.size) return false;
    if (notice.target.scope !== 'node') return false;
    return activeNodeIds.has(String(notice.target.node_id));
}

function extractLogNodeIds(row: ErrorLog) {
    const ids = new Set<string>();
    const meta = row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : {};
    const directNodeId = meta.nodeId ?? meta.node_id;
    if (typeof directNodeId === 'string') ids.add(directNodeId);

    const affected = meta.affectedIds ?? meta.affected_ids;
    if (Array.isArray(affected)) {
        for (const id of affected) {
            if (typeof id === 'string' || typeof id === 'number') ids.add(String(id));
        }
    }

    return Array.from(ids);
}

function clampPanelPosition(
    position: { left: number; bottom: number },
    panelEl: HTMLDivElement | null,
    containerEl: HTMLDivElement | null,
) {
    if (!panelEl || !containerEl) return position;

    const panelRect = panelEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const maxLeft = Math.max(PANEL_MARGIN, containerRect.width - panelRect.width - PANEL_MARGIN);
    const maxBottom = Math.max(PANEL_MARGIN, containerRect.height - panelRect.height - PANEL_MARGIN);

    return {
        left: clampNumber(position.left, PANEL_MARGIN, maxLeft),
        bottom: clampNumber(position.bottom, PANEL_MARGIN, maxBottom),
    };
}

function resolvePanelPosition(position: PanelPosition, panelEl: HTMLDivElement | null, containerEl: HTMLDivElement | null) {
    if (!panelEl || !containerEl) {
        return {
            left: position.left ?? PANEL_MARGIN,
            bottom: position.bottom ?? PANEL_MARGIN,
        };
    }

    const panelRect = panelEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const defaultLeft = Math.max(PANEL_MARGIN, (containerRect.width - panelRect.width) / 2);
    const defaultBottom = PANEL_MARGIN;
    return clampPanelPosition(
        {
            left: position.left ?? defaultLeft,
            bottom: position.bottom ?? defaultBottom,
        },
        panelEl,
        containerEl,
    );
}

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function readStoredPanelPosition(): PanelPosition {
    if (typeof window === 'undefined') return { left: null, bottom: null };
    const left = Number(window.localStorage.getItem(PANEL_LEFT_KEY));
    const bottom = Number(window.localStorage.getItem(PANEL_BOTTOM_KEY));
    return {
        left: Number.isFinite(left) ? left : null,
        bottom: Number.isFinite(bottom) ? bottom : null,
    };
}

function persistPanelPosition(position: { left: number; bottom: number }) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PANEL_LEFT_KEY, String(Math.round(position.left)));
    window.localStorage.setItem(PANEL_BOTTOM_KEY, String(Math.round(position.bottom)));
}
