import type { BottomConsolePanelState, BottomPanelTab, BuilderServiceSummary } from '@/builder/bottom-panel.ts';
import {
    areServiceContextStatesEqual,
    createCompatibilityCacheKey,
    runCompatibilityChecksIncremental,
} from '@/builder/compatibility-runner.ts';
import {
    buildServiceContextSnapshot,
    buildServiceRowVM,
    createDefaultServiceContext,
    createEmptyServiceContextSnapshot,
    sanitizeServiceContext,
    type ServiceContextState,
} from '@/builder/service-context.ts';
import { Button } from '@/components/ui/button.tsx';
import { Panel } from '@/components/ui/panel.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import { useServiceCatalogState } from '@/hooks/use-service-catalog-state.ts';
import { useFallbackEditorModal } from '@/workspace/fallback-editor-modal.tsx';
import { useFallbackQuickAdd } from '@/workspace/fallback-quick-add.tsx';
import type { ServiceCatalogState } from '@timeax/digital-service-engine/schema';
import { useCanvas, type UseErrorsReturn, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiEye, FiEyeOff, FiSearch, FiTerminal, FiX } from 'react-icons/fi';
import { LuGripHorizontal, LuLayers3 } from 'react-icons/lu';
import { MdOutlineSync } from 'react-icons/md';
import { ConsoleTab } from './console-tab.tsx';
import { ServicePickerDialog } from './service-picker-dialog.tsx';
import { CatalogContextPopover, ServicesSplitPane } from './services-split-pane.tsx';
import {
    clampPanelPosition,
    type ConsoleIntroState,
    type ConsoleScopeFilter,
    type ConsoleSeverityFilter,
    type ConsoleSubTab,
    ensureSelectedRow,
    focusNode,
    normalizeNotices,
    PANEL_MARGIN,
    type PanelPosition,
    persistPanelPosition,
    readStoredPanelPosition,
    resolvePanelPosition,
    sameIds,
} from './utils.tsx';

type BottomConsolePanelProps = {
    controller: BottomConsolePanelState;
    errors: UseErrorsReturn;
    activeServices: BuilderServiceSummary[];
    allServices: BuilderServiceSummary[];
    onServiceDragStateChange?: (serviceId: string | null) => void;
};

const DRAG_MIME = 'application/x-service-builder-service';
type CatalogPanelMode = 'all' | 'catalog';
type RateContextMode = 'context' | 'custom_primary_rate';
type RateContextSource = 'service' | 'manual';

export function BottomConsolePanel({ controller, errors, activeServices, allServices, onServiceDragStateChange }: BottomConsolePanelProps) {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const fallbackEditorModal = useFallbackEditorModal();
    const fallbackQuickAdd = useFallbackQuickAdd();
    const servicesMap = (ws.services.data ?? {}) as Record<string, any>;
    const policies = ws.policies.policies.data ?? [];
    const currentTagId = canvas.api.selection.currentTag?.();
    const preferredTagId = currentTagId != null ? String(currentTagId) : canvas.layers.tags[0]?.id != null ? String(canvas.layers.tags[0]?.id) : null;

    const [activeSearch, setActiveSearch] = useState('');
    const [allSearch, setAllSearch] = useState('');
    const [compatibleOnly, setCompatibleOnly] = useState(false);
    const [rateContextMode, setRateContextMode] = useState<RateContextMode>('context');
    const [rateContextSource, setRateContextSource] = useState<RateContextSource>('service');
    const [manualPrimaryRate, setManualPrimaryRate] = useState('');
    const [primaryServiceId, setPrimaryServiceId] = useState<string | null>(null);
    const [hideActiveServices, setHideActiveServices] = useState(false);
    const [hideNonEligibleServices, setHideNonEligibleServices] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [contextLinked, setContextLinked] = useState(false);
    const [servicePickerOpen, setServicePickerOpen] = useState(false);
    const [selectedActiveServiceId, setSelectedActiveServiceId] = useState<string | null>(null);
    const [selectedAllServiceId, setSelectedAllServiceId] = useState<string | null>(null);
    const [catalogContextDraft, setCatalogContextDraft] = useState<ServiceContextState>(() =>
        createDefaultServiceContext(canvas.props, preferredTagId),
    );
    const catalogState = useServiceCatalogState(canvas.api as any, canvas.api.editor as any);
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
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const dragStartRef = useRef<{ x: number; y: number; position: { left: number; bottom: number } } | null>(null);
    const appliedSnapshotRequestRef = useRef(0);
    const draftSnapshotRequestRef = useRef(0);
    const allChecksByIdRequestRef = useRef(0);
    const allChecksCacheRef = useRef<Map<string, any>>(new Map());

    const selectedButtons = useMemo(
        () => ((canvas.api.selection.selectedButtons?.() ?? []) as Array<string | number>).map((value) => String(value)),
        [canvas.api.selection, canvas.selectionInfo.ids, canvas.selectionInfo.optionIds],
    );
    const liveSelectionContext = useMemo<ServiceContextState>(
        () => ({
            selectedTagId: preferredTagId,
            selectedButtons,
            strictSafety: true,
            enforcePolicies: true,
        }),
        [preferredTagId, selectedButtons],
    );
    const effectiveCatalogContext = contextLinked ? liveSelectionContext : catalogContextDraft;
    const [appliedSnapshot, setAppliedSnapshot] = useState(() => createEmptyServiceContextSnapshot(effectiveCatalogContext, canvas.props));
    const [draftSnapshot, setDraftSnapshot] = useState(() => createEmptyServiceContextSnapshot(catalogContextDraft, canvas.props));
    useEffect(() => {
        const requestId = ++appliedSnapshotRequestRef.current;
        const fallback = createEmptyServiceContextSnapshot(effectiveCatalogContext, canvas.props);
        setAppliedSnapshot(fallback);

        buildServiceContextSnapshot({ props: canvas.props, services: servicesMap, state: effectiveCatalogContext })
            .then((snapshot) => {
                if (appliedSnapshotRequestRef.current !== requestId) return;
                setAppliedSnapshot(snapshot);
            })
            .catch(() => {
                if (appliedSnapshotRequestRef.current !== requestId) return;
                setAppliedSnapshot(fallback);
            });
    }, [canvas.props, effectiveCatalogContext, servicesMap]);
    useEffect(() => {
        const requestId = ++draftSnapshotRequestRef.current;
        const fallback = createEmptyServiceContextSnapshot(catalogContextDraft, canvas.props);
        setDraftSnapshot(fallback);

        buildServiceContextSnapshot({ props: canvas.props, services: servicesMap, state: catalogContextDraft })
            .then((snapshot) => {
                if (draftSnapshotRequestRef.current !== requestId) return;
                setDraftSnapshot(snapshot);
            })
            .catch(() => {
                if (draftSnapshotRequestRef.current !== requestId) return;
                setDraftSnapshot(fallback);
            });
    }, [canvas.props, catalogContextDraft, servicesMap]);
    const [allChecksById, setAllChecksById] = useState<Map<string, any>>(new Map());
    const allCandidateIds = useMemo(() => Object.values(servicesMap).map((service: any) => service.id), [servicesMap]);
    const policiesKey = useMemo(() => JSON.stringify(policies ?? []), [policies]);
    const contextServiceOptions = useMemo(
        () =>
            appliedSnapshot.usedServiceIds
                .map((id) => {
                    const service = servicesMap[id];
                    if (!service) return null;
                    return {
                        value: String(service.id),
                        label: `${service.name ?? `Service ${service.id}`}${service.rate != null ? ` (Rate ${service.rate})` : ''}`,
                    };
                })
                .filter(Boolean) as Array<{ value: string; label: string }>,
        [appliedSnapshot.usedServiceIds, servicesMap],
    );
    const parsedManualPrimaryRate = useMemo(() => {
        const value = Number(manualPrimaryRate.trim());
        return Number.isFinite(value) ? value : null;
    }, [manualPrimaryRate]);
    const hasValidCustomPrimary = useMemo(() => {
        if (rateContextMode !== 'custom_primary_rate') return true;
        if (rateContextSource === 'manual') return parsedManualPrimaryRate != null;
        return Boolean(primaryServiceId);
    }, [parsedManualPrimaryRate, primaryServiceId, rateContextMode, rateContextSource]);

    useEffect(() => {
        if (primaryServiceId && contextServiceOptions.some((option) => option.value === primaryServiceId)) return;
        setPrimaryServiceId(contextServiceOptions[0]?.value ?? null);
    }, [contextServiceOptions, primaryServiceId]);
    useEffect(() => {
        const requestId = ++allChecksByIdRequestRef.current;

        if (!appliedSnapshot.selectedTag) {
            setAllChecksById(new Map());
            return;
        }
        if (!hasValidCustomPrimary) {
            setAllChecksById(new Map());
            return;
        }

        const cacheKey = createCompatibilityCacheKey({
            tagId: appliedSnapshot.selectedTag.id,
            selectedButtons: appliedSnapshot.state.selectedButtons,
            usedServiceIds: appliedSnapshot.usedServiceIds,
            policiesKey,
            rateContextMode,
            rateContextSource,
            primaryRate: rateContextSource === 'manual' ? parsedManualPrimaryRate : null,
            primaryServiceId: rateContextSource === 'service' ? primaryServiceId : null,
        });

        runCompatibilityChecksIncremental<any>({
            editor: canvas.api.editor as any,
            candidateIds: allCandidateIds,
            args: {
                tagId: appliedSnapshot.selectedTag.id,
                selectedButtons: appliedSnapshot.state.selectedButtons,
                usedServiceIds: appliedSnapshot.usedServiceIds,
                effectiveConstraints: appliedSnapshot.selectedTag.constraints,
                policies,
                rateContext:
                    rateContextMode === 'custom_primary_rate'
                        ? {
                              mode: 'custom_primary_rate',
                              source: rateContextSource,
                              primaryRate: rateContextSource === 'manual' ? parsedManualPrimaryRate ?? undefined : undefined,
                              primaryServiceId: rateContextSource === 'service' ? primaryServiceId ?? undefined : undefined,
                          }
                        : { mode: 'context' },
            },
            cache: allChecksCacheRef.current,
            cacheKey,
            shouldAbort: () => allChecksByIdRequestRef.current !== requestId,
        })
            .then((checks) => {
                if (allChecksByIdRequestRef.current !== requestId) return;
                setAllChecksById(new Map(checks.map((check: any) => [String(check.id), check])));
            })
            .catch(() => {
                if (allChecksByIdRequestRef.current !== requestId) return;
                setAllChecksById(new Map());
            });
    }, [
        allCandidateIds,
        appliedSnapshot.selectedTag,
        appliedSnapshot.state.selectedButtons,
        appliedSnapshot.usedServiceIds,
        canvas.api.editor,
        hasValidCustomPrimary,
        parsedManualPrimaryRate,
        policies,
        policiesKey,
        primaryServiceId,
        rateContextMode,
        rateContextSource,
    ]);
    const hiddenServiceIds = useMemo(() => {
        const ids = new Set(activeServices.map((service) => String(service.id)));
        for (const id of appliedSnapshot.usedServiceIds) ids.add(String(id));
        return ids;
    }, [activeServices, appliedSnapshot.usedServiceIds]);

    const activeRows = useMemo(
        () =>
            activeServices
                .map((summary) => buildServiceRowVM({ summary, services: servicesMap, search: activeSearch }))
                .filter((row) => row.matchesSearch),
        [activeSearch, activeServices, servicesMap],
    );
    const filteredCatalogRows = useMemo(
        () =>
            allServices
                .map((summary) =>
                    buildServiceRowVM({
                        summary,
                        services: servicesMap,
                        check: allChecksById.get(String(summary.id)),
                        state: effectiveCatalogContext,
                        search: allSearch,
                    }),
                )
                .filter((row) => row.matchesSearch)
                .filter((row) => !compatibleOnly || row.isCompatible)
                .filter((row) => !hideNonEligibleServices || row.isCompatible)
                .filter((row) => !hideActiveServices || !hiddenServiceIds.has(row.id)),
        [
            allChecksById,
            allSearch,
            allServices,
            compatibleOnly,
            effectiveCatalogContext,
            hiddenServiceIds,
            hideActiveServices,
            hideNonEligibleServices,
            servicesMap,
        ],
    );

    useEffect(() => {
        const next = createDefaultServiceContext(canvas.props, preferredTagId);
        setCatalogContextDraft((current) => {
            if (contextLinked) return current;
            return current.selectedTagId ? current : next;
        });
    }, [canvas.props, contextLinked, preferredTagId]);

    useEffect(() => {
        if (!contextLinked) return;
        setCatalogContextDraft(liveSelectionContext);
    }, [contextLinked, liveSelectionContext]);

    useEffect(() => {
        if (contextLinked) return;
        const next = sanitizeServiceContext(draftSnapshot, catalogContextDraft);
        if (!areServiceContextStatesEqual(next, catalogContextDraft)) {
            setCatalogContextDraft(next);
        }
    }, [catalogContextDraft, contextLinked, draftSnapshot]);

    const catalogPanelMode: CatalogPanelMode = catalogState?.viewMode === 'grouped' ? 'catalog' : 'all';
    const catalogGroups = useMemo(
        () =>
            (catalogState?.nodes ?? [])
                .filter((node): node is Extract<NonNullable<ServiceCatalogState['nodes']>[number], { kind: 'group' }> => node.kind === 'group')
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
    const catalogRows = useMemo(() => {
        if (!selectedCatalogGroupId) return filteredCatalogRows.filter((row) => !groupedServiceIds.has(row.id));
        const selectedGroup = catalogGroups.find((group) => group.id === selectedCatalogGroupId);
        if (!selectedGroup) return filteredCatalogRows.filter((row) => !groupedServiceIds.has(row.id));
        const allowedIds = new Set(selectedGroup.serviceIds.map((id) => String(id)));
        return filteredCatalogRows.filter((row) => allowedIds.has(row.id));
    }, [catalogGroups, filteredCatalogRows, groupedServiceIds, selectedCatalogGroupId]);
    const visibleAllRows = catalogPanelMode === 'catalog' ? catalogRows : filteredCatalogRows;

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
        if (catalogState?.selectedServiceId == null) return;
        setSelectedAllServiceId(String(catalogState.selectedServiceId));
    }, [catalogState?.selectedServiceId]);

    useEffect(() => {
        setSelectedAllServiceId((current) => ensureSelectedRow(current, visibleAllRows));
    }, [visibleAllRows]);

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
        if (searchOpen) searchInputRef.current?.focus();
    }, [searchOpen]);

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

    const setCatalogMode = useCallback(
        (mode: CatalogPanelMode) => {
            const editor = canvas.api.editor as any;
            editor.ensureCatalog?.();
            editor.setCatalogViewMode?.(mode === 'catalog' ? 'grouped' : 'all');
        },
        [canvas.api.editor],
    );
    const handleSelectCatalogService = useCallback(
        (id: string | null) => {
            setSelectedAllServiceId(id);
            (canvas.api.editor as any).setSelectedCatalogService?.(id ?? undefined);
        },
        [canvas.api.editor],
    );
    const handleSelectCatalogGroup = useCallback(
        (groupId: string | null) => {
            (canvas.api.editor as any).setActiveCatalogNode?.(groupId ?? undefined);
        },
        [canvas.api.editor],
    );
    const handleCreateRootGroup = useCallback(
        (label: string) => {
            if (!label.trim()) return;
            (canvas.api.editor as any).createCatalogGroup?.({ label: label.trim() });
        },
        [canvas.api.editor],
    );
    const handleCreateChildGroup = useCallback(
        (label: string) => {
            if (!selectedCatalogGroupId) return;
            const editor = canvas.api.editor as any;
            editor.createCatalogGroup?.({ label: label.trim(), parentId: selectedCatalogGroupId });
            editor.setCatalogExpanded?.(selectedCatalogGroupId, true);
        },
        [canvas.api.editor, selectedCatalogGroupId],
    );
    const handleRenameGroup = useCallback(
        (label: string) => {
            if (!selectedCatalogGroupId) return;
            const group = catalogGroups.find((item) => item.id === selectedCatalogGroupId);
            if (!group) return;
            if (!label.trim() || label.trim() === group.label) return;
            (canvas.api.editor as any).updateCatalogNode?.(selectedCatalogGroupId, { label: label.trim() });
        },
        [canvas.api.editor, catalogGroups, selectedCatalogGroupId],
    );
    const handleDeleteGroup = useCallback(() => {
        if (!selectedCatalogGroupId) return;
        (canvas.api.editor as any).removeCatalogNode?.(selectedCatalogGroupId, { cascade: true });
    }, [canvas.api.editor, selectedCatalogGroupId]);
    const handleAssignServices = useCallback(() => {
        if (!selectedCatalogGroupId) return;
        setServicePickerOpen(true);
    }, [selectedCatalogGroupId]);
    const handleConfirmAssignServices = useCallback(
        (serviceIds: string[]) => {
            if (!selectedCatalogGroupId || !serviceIds.length) return;
            (canvas.api.editor as any).assignServicesToCatalogGroup?.(selectedCatalogGroupId, serviceIds, 'append');
        },
        [canvas.api.editor, selectedCatalogGroupId],
    );

    const tabs: Array<{ id: BottomPanelTab; label: string; icon: ReactNode; count?: number }> = [
        { id: 'console', label: 'Console', icon: <FiTerminal />, count: consoleIssueCount },
        { id: 'activeServices', label: 'Active Services', icon: <MdOutlineSync />, count: activeServices.length },
        { id: 'allServices', label: 'All Services', icon: <LuLayers3 />, count: allServices.length },
    ];
    const selectedActiveRow = activeRows.find((row) => row.id === selectedActiveServiceId) ?? null;
    const selectedAllRow = visibleAllRows.find((row) => row.id === selectedAllServiceId) ?? null;
    const selectedCatalogGroup = catalogGroups.find((group) => group.id === selectedCatalogGroupId) ?? null;
    const parentCatalogGroup =
        selectedCatalogGroup?.parentId != null ? catalogGroups.find((group) => group.id === selectedCatalogGroup.parentId) ?? null : null;
    const parentCatalogServiceIds = useMemo(
        () => new Set((parentCatalogGroup?.serviceIds ?? []).map((id) => String(id))),
        [parentCatalogGroup],
    );

    const Search = useMemo(() => {
        if (!['allServices', 'activeServices'].includes(controller.activeTab)) return;
        const method = controller.activeTab == 'allServices' ? setAllSearch : setActiveSearch;
        const value = controller.activeTab == 'allServices' ? allSearch : activeSearch;
        return (
            <div className="absolute top-0 right-0 z-10">
                <input
                    ref={searchInputRef}
                    value={value}
                    onChange={(event) => method(event.target.value)}
                    onBlur={() => {
                        if (!value.trim()) setSearchOpen(false);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            method('');
                            setSearchOpen(false);
                            event.currentTarget.blur();
                        }
                    }}
                    placeholder="Search services..."
                    aria-label="Search services"
                    className="h-9 w-72 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-lg outline-none dark:border-slate-800 dark:bg-slate-950"
                />
            </div>
        );
    }, [controller.activeTab, activeSearch, allSearch, setActiveSearch, setAllSearch]);
    return (
        <div ref={panelContainerRef} className="pointer-events-none absolute inset-0">
            <ServicePickerDialog
                open={servicePickerOpen}
                onOpenChange={setServicePickerOpen}
                groupLabel={selectedCatalogGroup?.label ?? null}
                selectedGroupId={selectedCatalogGroupId}
                parentGroupId={selectedCatalogGroup?.parentId ?? null}
                parentServiceIds={parentCatalogServiceIds}
                services={allServices}
                serviceMap={servicesMap}
                activeIds={hiddenServiceIds}
                existingGroupServiceIds={new Set((selectedCatalogGroup?.serviceIds ?? []).map((id) => String(id)))}
                onConfirm={handleConfirmAssignServices}
            />
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
                    ['--bottom-panel-height' as any]: controller.height + 'px',
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
                                            'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] uppercase',
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
                        <div className="hidden items-center gap-2 rounded-xl border border-slate-200/80 px-2 py-1 text-xs text-slate-500 md:flex dark:border-slate-800 dark:text-slate-400">
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
                                        : catalogPanelMode === 'catalog'
                                          ? 'Browse source services through manual editor-side catalog groups while keeping detail and compatibility visible.'
                                          : 'Browse every source service, filter by current visible-group compatibility, and drag it onto nodes.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative flex items-center gap-2">
                                    {searchOpen ? Search : null}
                                    <HeaderIconButton
                                        label="Search services"
                                        active={searchOpen || Boolean(allSearch)}
                                        onClick={() => setSearchOpen(true)}
                                    >
                                        <FiSearch />
                                    </HeaderIconButton>
                                    {controller.activeTab === 'allServices' ? (
                                        <>
                                            <CatalogContextPopover
                                                open={filterOpen}
                                                onOpenChange={setFilterOpen}
                                                compatibleOnly={compatibleOnly}
                                                onCompatibleOnlyChange={setCompatibleOnly}
                                                rateContextMode={rateContextMode}
                                                onRateContextModeChange={setRateContextMode}
                                                rateContextSource={rateContextSource}
                                                onRateContextSourceChange={setRateContextSource}
                                                manualPrimaryRate={manualPrimaryRate}
                                                onManualPrimaryRateChange={setManualPrimaryRate}
                                                primaryServiceId={primaryServiceId}
                                                onPrimaryServiceIdChange={setPrimaryServiceId}
                                                contextServiceOptions={contextServiceOptions}
                                                customRateError={
                                                    hasValidCustomPrimary ? null : 'Provide a primary service or valid primary rate to apply compatibility filtering.'
                                                }
                                                contextLinked={contextLinked}
                                                onContextLinkedChange={setContextLinked}
                                                draftContext={catalogContextDraft}
                                                draftSnapshot={draftSnapshot}
                                                onDraftContextChange={setCatalogContextDraft}
                                            />
                                            <CatalogModeSwitch mode={catalogPanelMode} onChange={setCatalogMode} />
                                            <HideServicesMenu
                                                hideActiveServices={hideActiveServices}
                                                hideNonEligibleServices={hideNonEligibleServices}
                                                onHideActiveServicesChange={setHideActiveServices}
                                                onHideNonEligibleServicesChange={setHideNonEligibleServices}
                                            />
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {controller.activeTab === 'console' ? (
                        <ScrollArea className="min-h-0 flex-1">
                            <div className="p-4">
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
                            </div>
                        </ScrollArea>
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
                            onOpenFallbackQuickAdd={(service) =>
                                fallbackQuickAdd.openForService({
                                    serviceId: service.id,
                                    serviceName: service.name,
                                })
                            }
                            onOpenFallbackEditor={(service) =>
                                fallbackEditorModal.openForService({
                                    serviceId: service.id,
                                    serviceName: service.name,
                                })
                            }
                        />
                    ) : null}
                    {controller.activeTab === 'allServices' ? (
                        <ServicesSplitPane
                            mode={catalogPanelMode}
                            rows={visibleAllRows}
                            selectedRowId={selectedAllServiceId}
                            onSelectRow={handleSelectCatalogService}
                            detailRow={selectedAllRow}
                            search={allSearch}
                            onSearchChange={setAllSearch}
                            appliedSnapshot={appliedSnapshot}
                            draftSnapshot={draftSnapshot}
                            draftContext={catalogContextDraft}
                            contextLinked={contextLinked}
                            compatibleOnly={compatibleOnly}
                            filterOpen={filterOpen}
                            onFilterOpenChange={setFilterOpen}
                            onCompatibleOnlyChange={setCompatibleOnly}
                            onContextLinkedChange={setContextLinked}
                            onDraftContextChange={setCatalogContextDraft}
                            catalogGroups={catalogGroups}
                            catalogExpandedIds={catalogState?.expandedIds ?? []}
                            catalogActiveGroupId={selectedCatalogGroupId}
                            catalogUngrouped={!selectedCatalogGroupId}
                            onCatalogSelectGroup={handleSelectCatalogGroup}
                            onCatalogToggleGroupExpanded={(groupId, expanded) => (canvas.api.editor as any).setCatalogExpanded?.(groupId, expanded)}
                            selectedCatalogGroupLabel={selectedCatalogGroup?.label ?? null}
                            onCatalogCreateRootGroup={handleCreateRootGroup}
                            onCatalogCreateChildGroup={handleCreateChildGroup}
                            onCatalogRenameGroup={handleRenameGroup}
                            onCatalogDeleteGroup={handleDeleteGroup}
                            onCatalogAssignServices={handleAssignServices}
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
            </Panel>
        </div>
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
    onHideActiveServicesChange: (value: boolean) => void;
    onHideNonEligibleServicesChange: (value: boolean) => void;
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
                        <input
                            type="checkbox"
                            checked={hideActiveServices}
                            onChange={(event) => onHideActiveServicesChange(event.target.checked)}
                        />
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

function HeaderIconButton({
    children,
    label,
    active = false,
    onClick,
}: {
    children: ReactNode;
    label: string;
    active?: boolean;
    onClick: () => void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    onClick={onClick}
                    className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                        active
                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                    )}
                >
                    {children}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}

function CatalogModeSwitch({ mode, onChange }: { mode: CatalogPanelMode; onChange: (mode: CatalogPanelMode) => void }) {
    return (
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
            <button
                type="button"
                onClick={() => onChange('all')}
                className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    mode === 'all'
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
                )}
            >
                All
            </button>
            <button
                type="button"
                onClick={() => onChange('catalog')}
                className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    mode === 'catalog'
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
                )}
            >
                Catalog
            </button>
        </div>
    );
}
