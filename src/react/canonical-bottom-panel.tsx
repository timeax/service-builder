// SPDX-License-Identifier: GPL-3.0-only
import { Button } from '@/components/ui/button.tsx';
import { Panel } from '@/components/ui/panel.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import { CatalogToolbar, type CatalogGroupView } from '@/workspace/bottom-panel/catalog-toolbar.tsx';
import { ServicePickerDialog } from '@/workspace/bottom-panel/service-picker-dialog.tsx';
import { filterHandlerServices } from '@elqora/dgp-core';
import type { HandlerService } from '@elqora/dgp-spec';
import type { ServiceCatalogState } from '@elqora/dgp-workspace';
import { InputField } from '@timeax/form-palette';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { FiEye, FiEyeOff, FiFilter, FiSearch, FiTerminal, FiX } from 'react-icons/fi';
import { LuGripHorizontal, LuLayers3 } from 'react-icons/lu';
import { MdOutlineSync } from 'react-icons/md';
import { buildCanonicalServiceSummaries } from './bottom-panel-model';
import { CanonicalConsole } from './canonical-console';
import { DEFAULT_CANONICAL_FALLBACK_POLICY, useCanonicalFallbacks } from './canonical-fallbacks';
import { CanonicalServicesSplitPane } from './canonical-services-split-pane';
import { buildCatalogContext, type CatalogContextSnapshot, type CatalogContextState } from './catalog-context-model';
import { useServiceBuilderCanvasModel } from './presentation';
import { useWorkspacePermission, useWorkspaceSelector } from './workspace';

export type CanonicalBottomPanelTab = 'console' | 'activeServices' | 'allServices';
export interface CanonicalBottomPanelController {
    isOpen: boolean;
    activeTab: CanonicalBottomPanelTab;
    width: number;
    height: number;
    toggle(): void;
    open(tab?: CanonicalBottomPanelTab): void;
    close(): void;
    setActiveTab(tab: CanonicalBottomPanelTab): void;
    setWidth(width: number): void;
    setHeight(height: number): void;
    shortcutLabel: string;
}
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(Math.round(value), min), max);
const PANEL_MARGIN = 8;
const PANEL_LEFT_KEY = 'service-builder.bottom-panel.pos-x';
const PANEL_BOTTOM_KEY = 'service-builder.bottom-panel.pos-y';
type PanelPosition = { left: number | null; bottom: number | null };

function readPanelPosition(): PanelPosition {
    if (typeof window === 'undefined') return { left: null, bottom: null };
    try {
        const left = window.localStorage.getItem(PANEL_LEFT_KEY);
        const bottom = window.localStorage.getItem(PANEL_BOTTOM_KEY);
        const leftNumber = left === null ? null : Number(left);
        const bottomNumber = bottom === null ? null : Number(bottom);
        return {
            left: leftNumber !== null && Number.isFinite(leftNumber) ? leftNumber : null,
            bottom: bottomNumber !== null && Number.isFinite(bottomNumber) ? bottomNumber : null,
        };
    } catch {
        return { left: null, bottom: null };
    }
}

function clampPanelPosition(position: { left: number; bottom: number }, panel: HTMLElement | null, container: HTMLElement | null) {
    if (!panel || !container) return position;
    const panelRect = panel.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const maxLeft = Math.max(PANEL_MARGIN, containerRect.width - panelRect.width - PANEL_MARGIN);
    const maxBottom = Math.max(PANEL_MARGIN, containerRect.height - panelRect.height - PANEL_MARGIN);
    return { left: Math.min(Math.max(position.left, PANEL_MARGIN), maxLeft), bottom: Math.min(Math.max(position.bottom, PANEL_MARGIN), maxBottom) };
}

function resolvePanelPosition(position: PanelPosition, panel: HTMLElement | null, container: HTMLElement | null) {
    const panelWidth = panel?.getBoundingClientRect().width ?? 0;
    const containerWidth = container?.getBoundingClientRect().width ?? 0;
    const defaultLeft = Math.max(PANEL_MARGIN, (containerWidth - panelWidth) / 2);
    return clampPanelPosition({ left: position.left ?? defaultLeft, bottom: position.bottom ?? PANEL_MARGIN }, panel, container);
}

function persistPanelPosition(position: { left: number; bottom: number }) {
    try {
        window.localStorage.setItem(PANEL_LEFT_KEY, String(Math.round(position.left)));
        window.localStorage.setItem(PANEL_BOTTOM_KEY, String(Math.round(position.bottom)));
    } catch {
        /* The panel remains draggable without storage. */
    }
}

export function useCanonicalBottomPanel(): CanonicalBottomPanelController {
    const [isOpen, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<CanonicalBottomPanelTab>('console');
    const [width, setWidth] = useState(960);
    const [height, setHeight] = useState(300);
    const toggle = useCallback(() => setOpen((open) => !open), []);
    const close = useCallback(() => setOpen(false), []);
    const open = useCallback((tab?: CanonicalBottomPanelTab) => {
        if (tab) setActiveTab(tab);
        setOpen(true);
    }, []);
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const editable =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                Boolean(target?.isContentEditable);
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j' && !editable) {
                event.preventDefault();
                toggle();
            } else if (event.key === 'Escape' && isOpen) close();
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [close, isOpen, toggle]);
    return useMemo(
        () => ({
            isOpen,
            activeTab,
            width,
            height,
            toggle,
            open,
            close,
            setActiveTab,
            setWidth: (value: number) => setWidth(clamp(value, 520, 1600)),
            setHeight: (value: number) => setHeight(clamp(value, 220, 460)),
            shortcutLabel: 'Ctrl/Cmd + J',
        }),
        [activeTab, close, height, isOpen, open, toggle, width],
    );
}

export function CanonicalBottomConsolePanel({ controller }: { controller: CanonicalBottomPanelController }) {
    const canvas = useServiceBuilderCanvasModel();
    const fallbacks = useCanonicalFallbacks();
    const canMutate = useWorkspacePermission('document.mutate');
    const services = useWorkspaceSelector((state) => state.services);
    const validation = useWorkspaceSelector((state) => state.validation);
    const workspaceError = useWorkspaceSelector((state) => state.error);
    const linkedFilterId = canvas.selection.filter_ids[0] ?? canvas.definition?.filters[0]?.id ?? null;
    const [contextLinked, setContextLinked] = useState(false);
    const [draftContext, setDraftContext] = useState<CatalogContextState>(() => ({ filterId: linkedFilterId, triggerIds: [] }));
    useEffect(() => {
        if (!contextLinked && !draftContext.filterId && linkedFilterId) {
            setDraftContext((current) => ({ ...current, filterId: linkedFilterId }));
        }
    }, [contextLinked, draftContext.filterId, linkedFilterId]);
    const contextFilterId = contextLinked ? linkedFilterId : draftContext.filterId;
    const contextTriggerIds = contextLinked ? canvas.selection.option_ids : draftContext.triggerIds;
    const contextTriggerKey = contextTriggerIds.join('\u0000');
    const contextSnapshot = useMemo(
        () =>
            buildCatalogContext(canvas.definition, {
                filterId: contextFilterId,
                triggerIds: contextTriggerKey ? contextTriggerKey.split('\u0000') : [],
            }),
        [canvas.definition, contextFilterId, contextTriggerKey],
    );
    const { activeServices, allServices } = useMemo(
        () => buildCanonicalServiceSummaries(canvas.definition, services, canvas.selection.ids, contextFilterId),
        [canvas.definition, canvas.selection.ids, contextFilterId, services],
    );
    const [activeSearch, setActiveSearch] = useState('');
    const [allSearch, setAllSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const search = controller.activeTab === 'activeServices' ? activeSearch : allSearch;
    const setSearch = controller.activeTab === 'activeServices' ? setActiveSearch : setAllSearch;
    const [hideActiveServices, setHideActiveServices] = useState(false);
    const [hideNonEligibleServices, setHideNonEligibleServices] = useState(false);
    const [compatibleOnly, setCompatibleOnly] = useState(false);
    const [strictSafety, setStrictSafety] = useState(true);
    const effectiveStrictSafety = contextLinked || strictSafety;
    const [rateContextMode, setRateContextMode] = useState<'context' | 'custom_primary_rate'>('context');
    const [rateContextSource, setRateContextSource] = useState<'service' | 'manual'>('service');
    const [primaryServiceId, setPrimaryServiceId] = useState('');
    const [manualPrimaryRate, setManualPrimaryRate] = useState('');
    const [catalog, setCatalog] = useState<ServiceCatalogState | undefined>(() => canvas.editor?.get_catalog());
    const [servicePickerOpen, setServicePickerOpen] = useState(false);
    const [selectedActiveServiceId, setSelectedActiveServiceId] = useState<string | null>(null);
    const [selectedAllServiceId, setSelectedAllServiceId] = useState<string | null>(null);
    const [consoleLogCount, setConsoleLogCount] = useState(0);
    const panelContainerRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const [panelPosition, setPanelPosition] = useState<PanelPosition>(readPanelPosition);
    const [draggingPanel, setDraggingPanel] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number; position: { left: number; bottom: number } } | null>(null);
    const diagnostics = validation ? [...validation.protocol.diagnostics, ...validation.policyDiagnostics] : [];
    useEffect(() => {
        if (searchOpen) searchInputRef.current?.focus();
    }, [searchOpen]);
    const notices = canvas.definition?.notices ?? [];
    const contextServiceIds = useMemo(() => new Set(contextSnapshot.usedServiceIds), [contextSnapshot.usedServiceIds]);
    const contextServices = useMemo(() => services.filter((service) => contextServiceIds.has(String(service.id))), [contextServiceIds, services]);
    useEffect(() => {
        if (rateContextSource !== 'service' || contextServices.some((service) => String(service.id) === primaryServiceId)) return;
        const next = contextServices[0] ? String(contextServices[0].id) : '';
        if (primaryServiceId !== next) setPrimaryServiceId(next);
    }, [contextServices, primaryServiceId, rateContextSource]);
    const source = controller.activeTab === 'activeServices' ? activeServices : allServices;
    useEffect(() => {
        if (!controller.isOpen) return;
        setPanelPosition((current) => resolvePanelPosition(current, panelRef.current, panelContainerRef.current));
    }, [controller.height, controller.width, controller.isOpen]);
    useEffect(() => {
        if (!draggingPanel) return;
        const move = (event: PointerEvent) => {
            const start = dragStartRef.current;
            if (!start) return;
            setPanelPosition(
                clampPanelPosition(
                    { left: start.position.left + event.clientX - start.x, bottom: start.position.bottom - (event.clientY - start.y) },
                    panelRef.current,
                    panelContainerRef.current,
                ),
            );
        };
        const stop = () => {
            setDraggingPanel(false);
            dragStartRef.current = null;
            setPanelPosition((current) => {
                const resolved = resolvePanelPosition(current, panelRef.current, panelContainerRef.current);
                persistPanelPosition(resolved);
                return resolved;
            });
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
    }, [draggingPanel]);
    const onPanelDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        dragStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            position: resolvePanelPosition(panelPosition, panelRef.current, panelContainerRef.current),
        };
        setDraggingPanel(true);
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            /* Window listeners continue the drag. */
        }
        event.preventDefault();
    };
    useEffect(() => {
        setCatalog(canvas.editor?.get_catalog());
        if (!canvas.api) return;
        return canvas.api.on('catalog:change', ({ catalog: next }) => setCatalog(next));
    }, [canvas.api, canvas.editor]);
    const catalogMode = controller.activeTab === 'allServices' && catalog?.view_mode === 'grouped';
    const catalogGroups = useMemo<CatalogGroupView[]>(
        () =>
            (catalog?.nodes ?? [])
                .filter((node) => node.kind === 'group')
                .map((group) => ({ id: group.id, label: group.label, parentId: group.parent_id, order: group.order, serviceIds: group.service_ids })),
        [catalog],
    );
    const activeCatalogGroup = catalogGroups.find((group) => group.id === catalog?.active_node_id) ?? null;
    const groupedServiceIds = useMemo(() => new Set(catalogGroups.flatMap((group) => group.serviceIds.map(String))), [catalogGroups]);
    const customPrimaryRate =
        rateContextMode !== 'custom_primary_rate'
            ? undefined
            : rateContextSource === 'service'
              ? (contextServices.find((service) => String(service.id) === primaryServiceId)?.rate ?? undefined)
              : manualPrimaryRate.trim() === ''
                ? undefined
                : Number(manualPrimaryRate);
    const validCustomPrimaryRate = typeof customPrimaryRate === 'number' && Number.isFinite(customPrimaryRate) && customPrimaryRate >= 0;
    const rateEvaluation = useMemo(
        () =>
            rateContextMode === 'custom_primary_rate' && validCustomPrimaryRate
                ? filterHandlerServices(services, {
                      primary_rate: customPrimaryRate,
                      rate_policy: DEFAULT_CANONICAL_FALLBACK_POLICY.rate_policy,
                  })
                : null,
        [customPrimaryRate, rateContextMode, services, validCustomPrimaryRate],
    );
    const rateCompatibleIds = useMemo(
        () => (rateEvaluation ? new Set(rateEvaluation.accepted.map((service) => String(service.id))) : null),
        [rateEvaluation],
    );
    const rateMismatchIds = useMemo(
        () =>
            rateEvaluation
                ? new Set(rateEvaluation.rejected.filter((item) => item.reasons.includes('rate_mismatch')).map((item) => String(item.service.id)))
                : null,
        [rateEvaluation],
    );
    const catalogSource = !catalogMode
        ? source
        : activeCatalogGroup
          ? source.filter((service) => activeCatalogGroup.serviceIds.some((id) => String(id) === String(service.id)))
          : source.filter((service) => !groupedServiceIds.has(String(service.id)));
    const visibleSource = catalogSource
        .filter((service) => !hideActiveServices || service.attachmentCount === 0)
        .filter((service) => !hideNonEligibleServices || !effectiveStrictSafety || service.matchesSelectedFilter !== false)
        .filter(
            (service) =>
                !compatibleOnly ||
                !effectiveStrictSafety ||
                (service.matchesSelectedFilter !== false &&
                    (rateContextMode !== 'custom_primary_rate' || !validCustomPrimaryRate || rateCompatibleIds?.has(String(service.id)))),
        );
    const rows = search.trim()
        ? visibleSource.filter((service) =>
              `${service.name} ${service.id} ${service.category ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
          )
        : visibleSource;
    const requestedSelection = controller.activeTab === 'activeServices' ? selectedActiveServiceId : selectedAllServiceId;
    const selectedServiceId = rows.some((service) => String(service.id) === requestedSelection)
        ? requestedSelection
        : rows[0]
          ? String(rows[0].id)
          : null;
    const selectedService = rows.find((service) => String(service.id) === selectedServiceId);
    const selectedAttachmentKey = selectedService?.attachedNodeIds.join('\u0000') ?? '';
    const selectedFilterLabel = contextSnapshot.filterLabel ?? undefined;
    useEffect(() => {
        if (!controller.isOpen || controller.activeTab !== 'activeServices' || !selectedAttachmentKey) return;
        canvas.api?.set_highlighted(selectedAttachmentKey.split('\u0000'));
        return () => canvas.api?.set_highlighted([]);
    }, [canvas.api, controller.isOpen, controller.activeTab, selectedAttachmentKey]);
    const tabs = [
        { id: 'console' as const, label: 'Console', icon: <FiTerminal />, count: diagnostics.length + notices.length + consoleLogCount },
        { id: 'activeServices' as const, label: 'Active Services', icon: <MdOutlineSync />, count: activeServices.length },
        { id: 'allServices' as const, label: 'All Services', icon: <LuLayers3 />, count: allServices.length },
    ];
    return (
        <div ref={panelContainerRef} className="pointer-events-none absolute inset-0">
            <Panel
                ref={panelRef}
                edges={['left', 'right', 'top']}
                defaultWidth={controller.width}
                defaultHeight={controller.height}
                minWidth={520}
                maxWidth={1600}
                minHeight={320}
                maxHeight={460}
                onResizeEnd={({ width, height }) => {
                    controller.setWidth(width);
                    controller.setHeight(height);
                    setPanelPosition((current) => {
                        const resolved = resolvePanelPosition(current, panelRef.current, panelContainerRef.current);
                        persistPanelPosition(resolved);
                        return resolved;
                    });
                }}
                className={cn(
                    'pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-md transition-all duration-300 dark:border-slate-800/90 dark:bg-slate-950/95',
                    controller.isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+1rem)] opacity-0',
                )}
                style={
                    {
                        left: panelPosition.left ?? 16,
                        bottom: panelPosition.bottom ?? 16,
                        '--bottom-panel-height': `${controller.height}px`,
                    } as CSSProperties
                }
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
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] uppercase',
                                        tab.id === 'console' && tab.count > 0
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
                                            : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                                    )}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onPointerDown={onPanelDragStart}
                            className={cn(
                                'flex items-center gap-2 rounded-xl border border-slate-200/80 px-2 py-1 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400',
                                draggingPanel && 'cursor-grabbing',
                            )}
                        >
                            <LuGripHorizontal />
                            <span>{draggingPanel ? 'Dragging panel...' : 'Drag panel'}</span>
                        </button>
                        <Button type="button" variant="ghost" size="sm" onClick={controller.close} className="h-8 rounded-xl px-2 text-slate-500">
                            <FiX /> Close
                        </Button>
                    </div>
                </div>
                <div hidden={controller.activeTab !== 'console'} className="min-h-0 flex-1">
                    <ScrollArea className="h-full">
                        <div className="p-4">
                            <CanonicalConsole
                                validation={validation}
                                notices={notices}
                                definition={canvas.definition}
                                selectedIds={canvas.selection.ids}
                                api={canvas.api}
                                workspaceError={workspaceError}
                                shortcutLabel={controller.shortcutLabel}
                                onLogCountChange={setConsoleLogCount}
                            />
                        </div>
                    </ScrollArea>
                </div>
                {controller.activeTab !== 'console' ? (
                    <div className="min-h-0 flex-1">
                        <div className="flex items-center gap-2 px-4 pt-4">
                            {controller.activeTab === 'allServices' ? (
                                <CatalogModeSwitch
                                    mode={catalogMode ? 'catalog' : 'all'}
                                    onChange={(mode) => canvas.editor?.set_catalog_view_mode(mode === 'catalog' ? 'grouped' : 'all')}
                                />
                            ) : null}
                            <div className="relative flex items-center gap-2">
                                {searchOpen ? (
                                    <div className="absolute top-0 right-0 z-10">
                                        <input
                                            ref={searchInputRef}
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            onBlur={() => { if (!search.trim()) setSearchOpen(false); }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Escape') {
                                                    setSearch('');
                                                    setSearchOpen(false);
                                                    event.currentTarget.blur();
                                                }
                                            }}
                                            placeholder="Search services..."
                                            aria-label="Search services"
                                            className="h-9 w-72 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-lg outline-none dark:border-slate-800 dark:bg-slate-950"
                                        />
                                    </div>
                                ) : null}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label="Search services"
                                            onClick={() => setSearchOpen(true)}
                                            className={cn(
                                                'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                                                searchOpen || Boolean(search)
                                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                                            )}
                                        >
                                            <FiSearch />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" sideOffset={8}>Search services</TooltipContent>
                                </Tooltip>
                                <HideServicesMenu
                                    hideActiveServices={hideActiveServices}
                                    hideNonEligibleServices={hideNonEligibleServices}
                                    onHideActiveServicesChange={setHideActiveServices}
                                    onHideNonEligibleServicesChange={setHideNonEligibleServices}
                                />
                                {controller.activeTab === 'allServices' ? (
                                <CatalogContextPopover
                                    contextLinked={contextLinked}
                                    onContextLinkedChange={(linked) => {
                                        if (!linked) {
                                            setDraftContext({ filterId: linkedFilterId, triggerIds: [...canvas.selection.option_ids] });
                                            setStrictSafety(true);
                                        }
                                        setContextLinked(linked);
                                    }}
                                    contextState={{ filterId: contextFilterId, triggerIds: [...contextTriggerIds] }}
                                    contextSnapshot={contextSnapshot}
                                    onFilterChange={(filterId) => setDraftContext({ filterId, triggerIds: [] })}
                                    onTriggerToggle={(triggerId) =>
                                        setDraftContext((current) => ({
                                            ...current,
                                            triggerIds: current.triggerIds.includes(triggerId)
                                                ? current.triggerIds.filter((id) => id !== triggerId)
                                                : [...current.triggerIds, triggerId],
                                        }))
                                    }
                                    compatibleOnly={compatibleOnly}
                                    onCompatibleOnlyChange={setCompatibleOnly}
                                    strictSafety={effectiveStrictSafety}
                                    onStrictSafetyChange={setStrictSafety}
                                    rateContextMode={rateContextMode}
                                    onRateContextModeChange={setRateContextMode}
                                    rateContextSource={rateContextSource}
                                    onRateContextSourceChange={setRateContextSource}
                                    primaryServiceId={primaryServiceId}
                                    onPrimaryServiceIdChange={setPrimaryServiceId}
                                    manualPrimaryRate={manualPrimaryRate}
                                    onManualPrimaryRateChange={setManualPrimaryRate}
                                    services={contextServices}
                                    customRateError={
                                        rateContextMode === 'custom_primary_rate' && !validCustomPrimaryRate
                                            ? 'Provide a primary service or valid primary rate to apply compatibility filtering.'
                                            : null
                                    }
                                />
                                ) : null}
                            </div>
                        </div>
                        <CanonicalServicesSplitPane
                            mode={controller.activeTab === 'activeServices' ? 'active' : catalogMode ? 'catalog' : 'all'}
                            rows={rows}
                            selectedId={selectedServiceId}
                            onSelect={(id) =>
                                controller.activeTab === 'activeServices' ? setSelectedActiveServiceId(id) : setSelectedAllServiceId(id)
                            }
                            services={services}
                            canEdit={canMutate}
                            rateMismatchIds={rateMismatchIds}
                            strictSafety={effectiveStrictSafety}
                            contextFilterLabel={catalogMode ? activeCatalogGroup?.label : selectedFilterLabel}
                            selectedTriggerCount={contextTriggerIds.length}
                            usedServiceCount={contextSnapshot.usedServiceIds.length}
                            onNodeClick={(id) => {
                                canvas.api?.select([id], id);
                                canvas.api?.set_highlighted([id]);
                            }}
                            onOpenFallbackQuickAdd={(service) =>
                                fallbacks.open_quick_add_for_service({ service_id: service.id, service_name: service.name })
                            }
                            onOpenFallbackEditor={(service) =>
                                fallbacks.open_editor_for_service({ service_id: service.id, service_name: service.name })
                            }
                            leftHeader={
                                catalogMode ? (
                                    <CatalogToolbar
                                        groups={catalogGroups}
                                        selectedGroupId={activeCatalogGroup?.id ?? null}
                                        selectedGroupLabel={activeCatalogGroup?.label ?? null}
                                        ungroupedSelected={!activeCatalogGroup}
                                        disabled={!canMutate}
                                        disabledReason="You do not have permission to edit this definition."
                                        onSelectGroup={(id) => canvas.editor?.set_active_catalog_node(id ?? undefined)}
                                        onCreateRootGroup={(label) => {
                                            if (canMutate) canvas.editor?.create_catalog_group({ label });
                                        }}
                                        onCreateChildGroup={(label) => {
                                            if (canMutate && activeCatalogGroup)
                                                canvas.editor?.create_catalog_group({ label, parent_id: activeCatalogGroup.id });
                                        }}
                                        onRenameGroup={(label) => {
                                            if (canMutate && activeCatalogGroup) canvas.editor?.update_catalog_node(activeCatalogGroup.id, { label });
                                        }}
                                        onDeleteGroup={() => {
                                            if (canMutate && activeCatalogGroup) canvas.editor?.remove_catalog_node(activeCatalogGroup.id, true);
                                        }}
                                        onAssignServices={() => {
                                            if (canMutate && activeCatalogGroup) setServicePickerOpen(true);
                                        }}
                                    />
                                ) : undefined
                            }
                        />
                    </div>
                ) : null}
            </Panel>
            <ServicePickerDialog
                open={servicePickerOpen}
                groupLabel={activeCatalogGroup?.label}
                selectedGroupId={activeCatalogGroup?.id}
                parentGroupId={activeCatalogGroup?.parentId ?? null}
                parentServiceIds={new Set(catalogGroups.find((group) => group.id === activeCatalogGroup?.parentId)?.serviceIds.map(String) ?? [])}
                services={allServices.map((service) => ({
                    id: service.id,
                    name: service.name,
                    category: service.category,
                    rate: service.rate,
                    platformId: service.platformId,
                    flags: service.enabledCapabilityIds,
                }))}
                serviceMap={Object.fromEntries(services.map((service) => [String(service.id), service]))}
                activeIds={new Set(activeServices.map((service) => String(service.id)))}
                existingGroupServiceIds={new Set(activeCatalogGroup?.serviceIds.map(String) ?? [])}
                onOpenChange={setServicePickerOpen}
                onConfirm={(ids) => {
                    if (activeCatalogGroup) canvas.editor?.assign_catalog_services(activeCatalogGroup.id, ids, 'append');
                    setServicePickerOpen(false);
                }}
            />
        </div>
    );
}

function CatalogModeSwitch({ mode, onChange }: { mode: 'all' | 'catalog'; onChange(mode: 'all' | 'catalog'): void }) {
    return (
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
            {(['all', 'catalog'] as const).map((value) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => onChange(value)}
                    className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                        mode === value
                            ? 'bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100'
                            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
                    )}
                >
                    {value === 'all' ? 'All' : 'Catalog'}
                </button>
            ))}
        </div>
    );
}

function CatalogContextPopover({
    contextLinked,
    onContextLinkedChange,
    contextState,
    contextSnapshot,
    onFilterChange,
    onTriggerToggle,
    compatibleOnly,
    onCompatibleOnlyChange,
    strictSafety,
    onStrictSafetyChange,
    rateContextMode,
    onRateContextModeChange,
    rateContextSource,
    onRateContextSourceChange,
    primaryServiceId,
    onPrimaryServiceIdChange,
    manualPrimaryRate,
    onManualPrimaryRateChange,
    services,
    customRateError,
}: {
    contextLinked: boolean;
    onContextLinkedChange(value: boolean): void;
    contextState: CatalogContextState;
    contextSnapshot: CatalogContextSnapshot;
    onFilterChange(id: string): void;
    onTriggerToggle(id: string): void;
    compatibleOnly: boolean;
    onCompatibleOnlyChange(value: boolean): void;
    strictSafety: boolean;
    onStrictSafetyChange(value: boolean): void;
    rateContextMode: 'context' | 'custom_primary_rate';
    onRateContextModeChange(value: 'context' | 'custom_primary_rate'): void;
    rateContextSource: 'service' | 'manual';
    onRateContextSourceChange(value: 'service' | 'manual'): void;
    primaryServiceId: string;
    onPrimaryServiceIdChange(value: string): void;
    manualPrimaryRate: string;
    onManualPrimaryRateChange(value: string): void;
    services: readonly HandlerService[];
    customRateError: string | null;
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Catalog context filter"
                    className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                        compatibleOnly
                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                    )}
                >
                    <FiFilter />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                collisionPadding={16}
                className="max-h-[32rem] w-[min(24rem,calc(100vw-2rem))] overflow-auto rounded-2xl p-0"
            >
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Catalog context</div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Control compatibility checks here, or link them to the current workspace context.
                    </p>
                </div>
                <div className="space-y-4 p-4">
                    <label className="flex items-start justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                        <span className="min-w-0">
                            <span className="block font-medium">Compatible only</span>
                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                Show services matching checked capabilities and the configured rate rule. Host policies are not checked yet.
                            </span>
                        </span>
                        <input type="checkbox" checked={compatibleOnly} onChange={(event) => onCompatibleOnlyChange(event.target.checked)} />
                    </label>
                    <label className="flex items-start justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                        <span className="min-w-0">
                            <span className="block font-medium">Link to current context</span>
                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                Mirror the current canvas tag and selected buttons while linked.
                            </span>
                        </span>
                        <input type="checkbox" checked={contextLinked} onChange={(event) => onContextLinkedChange(event.target.checked)} />
                    </label>
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                        <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Tags</div>
                        {contextSnapshot.filters.map((filter) => (
                            <label key={filter.id} className="flex items-start gap-3 text-sm text-slate-900 dark:text-slate-100">
                                <input
                                    type="radio"
                                    name="catalog-context-filter"
                                    disabled={contextLinked}
                                    checked={contextState.filterId === filter.id}
                                    onChange={() => onFilterChange(filter.id)}
                                />
                                <span className="font-medium">{filter.label}</span>
                            </label>
                        ))}
                    </div>
                    {contextSnapshot.buttonGroups.length ? (
                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                            <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Buttons</div>
                            {contextSnapshot.buttonGroups.map((group) => (
                                <div key={group.id} className="space-y-1">
                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{group.label}</div>
                                    {group.options.map((option) => (
                                        <label key={option.id} className="flex items-start gap-3 text-sm text-slate-900 dark:text-slate-100">
                                            <input
                                                type="checkbox"
                                                disabled={contextLinked}
                                                checked={contextState.triggerIds.includes(option.id)}
                                                onChange={() => onTriggerToggle(option.id)}
                                            />
                                            <span>{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                        <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Safety</div>
                        <label className="flex items-center justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                            <span>Strict safety</span>
                            <input
                                type="checkbox"
                                disabled={contextLinked}
                                checked={strictSafety}
                                onChange={(event) => onStrictSafetyChange(event.target.checked)}
                            />
                        </label>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                        <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                            Rate compatibility mode
                        </div>
                        <InputField
                            variant="radio"
                            value={rateContextMode}
                            options={[
                                { value: 'context', label: 'Context coherence', description: 'Use current tag and triggers; context-rate checks are not yet available.' },
                                {
                                    value: 'custom_primary_rate',
                                    label: 'Custom primary rate',
                                    description: 'Use a chosen service or manual rate as primary.',
                                },
                            ]}
                            onChange={({ value }) => onRateContextModeChange(value as 'context' | 'custom_primary_rate')}
                        />
                        {rateContextMode === 'custom_primary_rate' ? (
                            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950/40">
                                <InputField
                                    variant="radio"
                                    value={rateContextSource}
                                    options={[
                                        { value: 'service', label: 'From context service', description: 'Use a catalog service rate.' },
                                        { value: 'manual', label: 'Manual rate', description: 'Provide a numeric primary rate.' },
                                    ]}
                                    onChange={({ value }) => onRateContextSourceChange(value as 'service' | 'manual')}
                                />
                                {rateContextSource === 'service' ? (
                                    <InputField
                                        variant="select" autoCap
                                        label="Primary context service"
                                        options={services.map((service) => ({
                                            value: String(service.id),
                                            label: `#${String(service.id)} - ${service.name}`,
                                        }))}
                                        value={primaryServiceId || undefined}
                                        onChange={({ value }) => onPrimaryServiceIdChange(String(value ?? ''))}
                                        placeholder="Select service"
                                    />
                                ) : (
                                    <InputField
                                        variant="number"
                                        label="Primary rate"
                                        value={manualPrimaryRate === '' ? undefined : Number(manualPrimaryRate)}
                                        onChange={({ value }) => onManualPrimaryRateChange(String(value ?? ''))}
                                        placeholder="Enter rate"
                                    />
                                )}
                                {customRateError ? <p className="text-xs text-amber-700 dark:text-amber-300">{customRateError}</p> : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function HideServicesMenu({
    hideActiveServices,
    hideNonEligibleServices,
    onHideActiveServicesChange,
    onHideNonEligibleServicesChange,
}: {
    hideActiveServices: boolean;
    hideNonEligibleServices: boolean;
    onHideActiveServicesChange(value: boolean): void;
    onHideNonEligibleServicesChange(value: boolean): void;
}) {
    const active = hideActiveServices || hideNonEligibleServices;
    return (
        <Popover>
            <Tooltip>
                <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            aria-label="Hide services options"
                            className={cn(
                                'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                                active
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                            )}
                        >
                            {active ? <FiEyeOff /> : <FiEye />}
                        </button>
                    </TooltipTrigger>
                </PopoverTrigger>
                <TooltipContent side="top" sideOffset={8}>
                    Hide services options
                </TooltipContent>
            </Tooltip>
            <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="w-80 rounded-2xl p-4">
                <div className="space-y-3">
                    <label className="flex items-start justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                        <span className="min-w-0">
                            <span className="block font-medium">Hide active services</span>
                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                Hide services already active in the current context.
                            </span>
                        </span>
                        <input type="checkbox" checked={hideActiveServices} onChange={(event) => onHideActiveServicesChange(event.target.checked)} />
                    </label>
                    <label className="flex items-start justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                        <span className="min-w-0">
                            <span className="block font-medium">Hide non-eligible for context</span>
                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                Hide services currently marked as incompatible with this context.
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={hideNonEligibleServices}
                            onChange={(event) => onHideNonEligibleServicesChange(event.target.checked)}
                        />
                    </label>
                </div>
            </PopoverContent>
        </Popover>
    );
}
