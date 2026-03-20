import type { BottomConsolePanelState } from '@/builder/bottom-panel.ts';
import { useNodeContextMenu } from '@/builder/node-context-menu.tsx';
import { CanvasOverlay, EmptyState } from '@/components/builder/index.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { getNodePropertyCapabilities } from '@/panels/right/partials/properties/components/node-capabilities.ts';
import {
    defaultCanvasViewPrefs,
    deriveCanvasPresentation,
    edgeStyleForState,
    parseEdgeId as parseRelationEdgeId,
    type CanvasViewPrefs,
} from '@/panels/canvas/presentation.ts';
import { useCanvas, type UseErrorsReturn, useWorkspace } from '@timeax/digital-service-engine/workspace';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle, FiEye, FiEyeOff, FiRotateCw, FiSave, FiTerminal } from 'react-icons/fi';
import { LuGitCommitHorizontal, LuHistory, LuRedo2, LuUndo2 } from 'react-icons/lu';
import { MdOutlineVisibility } from 'react-icons/md';
import type { AdapterOptions } from './adapter.ts';
import { FlowCanvas } from './flow-canvas.tsx';
import type { LabelPlacement, ToolbarOrientation, ToolsConfig } from './toolbar/types.ts';

type OverlayId = 'pulse' | 'focus' | 'comments';
type OverlayState = Record<OverlayId, { closed: boolean; minimized: boolean }>;
type HistoryState = { canUndo: boolean; canRedo: boolean };
type CanvasViewPrefsState = CanvasViewPrefs;
type WorkspaceSnapshot = {
    props: unknown;
    layout: {
        canvas: {
            positions: Record<string, { x: number; y: number }>;
            viewport: { x: number; y: number; zoom: number };
        };
    };
};

const OVERLAY_DEFAULTS: OverlayState = {
    pulse: { closed: false, minimized: false },
    focus: { closed: false, minimized: false },
    comments: { closed: false, minimized: false },
};

export type CanvasPanelProps = {
    errors: UseErrorsReturn;
    bottomPanel: BottomConsolePanelState;
    draggingServiceId: string | null;
    onServiceDragStateChange: (serviceId: string | null) => void;
    tools?: ToolsConfig;
    showToolbar?: boolean;
    labelPlacement?: LabelPlacement;
    initialShowGrid?: boolean;
    initialShowMiniMap?: boolean;
    toolbarOrientation?: ToolbarOrientation;
    persistToolbarOrientation?: boolean;
    options?: AdapterOptions;
    showOverlays?: boolean;
    showAppTools?: boolean;
};

export default function CanvasPanel({
    errors,
    bottomPanel,
    draggingServiceId,
    onServiceDragStateChange,
    tools,
    showToolbar = true,
    labelPlacement = 'tooltip',
    initialShowGrid = true,
    initialShowMiniMap = false,
    toolbarOrientation = 'horizontal',
    persistToolbarOrientation = true,
    options,
    showOverlays = true,
    showAppTools = true,
}: CanvasPanelProps) {
    const canvas = useCanvas();
    const { openNodeContextMenu, canAcceptDropPayload, handleNodeDrop, toggleNoticeManager, isNoticeManagerOpen } = useNodeContextMenu();
    const ws = useWorkspace();
    const initialSnapshotHash = useMemo(() => hashSnapshot(buildWorkspaceSnapshot(canvas.api)), [canvas.api]);
    const [showErrorBadges, setShowErrorBadges] = useState(true);
    const [actionPending, setActionPending] = useState<'save' | 'publish' | null>(null);
    const [historyState, setHistoryState] = useState<HistoryState>({ canUndo: false, canRedo: false });
    const [currentSnapshotHash, setCurrentSnapshotHash] = useState(initialSnapshotHash);
    const [persistedBaselineHash, setPersistedBaselineHash] = useState(initialSnapshotHash);
    const [overlayState, setOverlayState] = useState<OverlayState>(() => loadOverlayState(storageKey(ws), OVERLAY_DEFAULTS));
    const [viewPrefs, setViewPrefs] = useState<CanvasViewPrefsState>(() => loadCanvasViewPrefs(viewPrefsStorageKey(ws), defaultCanvasViewPrefs));
    const [presentationVersion, setPresentationVersion] = useState(0);
    const lastSyncedSnapshotHashRef = useRef<string>(initialSnapshotHash);

    const freeThreads = useMemo(
        () => (ws.comments.threads.data ?? []).filter((thread) => thread.anchor?.type === 'free'),
        [ws.comments.threads.data],
    );
    const errorNodeIds = useMemo(
        () => new Set((errors.merged.validation ?? []).map((row) => row.nodeId).filter(Boolean) as string[]),
        [errors.merged.validation],
    );

    const stats = {
        tags: canvas.layers.tags.length,
        fields: canvas.layers.fields.length,
        comments: (ws.comments.threads.data ?? []).length,
    };

    useEffect(() => {
        setOverlayState(loadOverlayState(storageKey(ws), OVERLAY_DEFAULTS));
        setViewPrefs(loadCanvasViewPrefs(viewPrefsStorageKey(ws), defaultCanvasViewPrefs));
    }, [ws.info.id, ws.branches.currentId]);

    useEffect(() => {
        persistOverlayState(storageKey(ws), overlayState);
    }, [overlayState, ws]);

    useEffect(() => {
        persistCanvasViewPrefs(viewPrefsStorageKey(ws), viewPrefs);
    }, [viewPrefs, ws]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const shortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'o';
            if (!shortcut) return;
            event.preventDefault();
            setOverlayState(restoreAllOverlays());
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        const resetHash = hashSnapshot(buildWorkspaceSnapshot(canvas.api));
        setCurrentSnapshotHash(resetHash);
        setPersistedBaselineHash(resetHash);
        lastSyncedSnapshotHashRef.current = resetHash;
        setHistoryState({ canUndo: false, canRedo: false });
    }, [canvas.api, ws.info.id, ws.branches.currentId]);

    const syncWorkspaceSnapshot = useCallback(() => {
        const nextSnapshot = buildWorkspaceSnapshot(canvas.api);
        const nextHash = hashSnapshot(nextSnapshot);
        setCurrentSnapshotHash((current) => (current === nextHash ? current : nextHash));
        if (nextHash === lastSyncedSnapshotHashRef.current) return;
        lastSyncedSnapshotHashRef.current = nextHash;
        ws.snapshot.set(() => nextSnapshot as any);
    }, [canvas.api, ws.snapshot]);

    useEffect(() => {
        const bump = () => setPresentationVersion((current) => current + 1);
        const offSelection = canvas.api.on('selection:change', bump);
        const offState = canvas.api.on('state:change', bump);
        const offGraph = canvas.api.on('graph:update', bump);
        return () => {
            offSelection();
            offState();
            offGraph();
        };
    }, [canvas.api]);

    useEffect(() => {
        const offState = canvas.api.on('state:change', () => syncWorkspaceSnapshot());
        const offEditorChange = (canvas.api.on as any)('editor:change', (event: { reason?: string }) => {
            syncWorkspaceSnapshot();
            if (event?.reason === 'mutation' || event?.reason === 'transaction') {
                setHistoryState({ canUndo: true, canRedo: false });
            }
        });
        const offUndo = (canvas.api.on as any)('editor:undo', (event: { index: number; stackSize: number }) => {
            const index = Number(event?.index ?? 0);
            const stackSize = Number(event?.stackSize ?? 0);
            setHistoryState({
                canUndo: index > 0,
                canRedo: index < stackSize - 1,
            });
        });
        const offRedo = (canvas.api.on as any)('editor:redo', (event: { index: number; stackSize: number }) => {
            const index = Number(event?.index ?? 0);
            const stackSize = Number(event?.stackSize ?? 0);
            setHistoryState({
                canUndo: index > 0,
                canRedo: index < stackSize - 1,
            });
        });

        return () => {
            offState();
            offEditorChange?.();
            offUndo?.();
            offRedo?.();
        };
    }, [canvas.api, syncWorkspaceSnapshot]);

    const hasChanges = currentSnapshotHash !== persistedBaselineHash;
    const canSave = hasChanges || !!ws.snapshot.draft;
    const canPublish = hasChanges || !!ws.snapshot.draft;

    const resolvedCurrentTagId = useMemo(() => {
        const activeId = canvas.activeId;
        if (activeId) {
            try {
                const activeNode = canvas.selector.getNode(activeId);
                if (activeNode?.kind === 'tag') return activeId;
            } catch {
                /* fall through to selection current tag */
            }
        }
        return canvas.api.selection.currentTag?.() ?? null;
    }, [canvas.activeId, canvas.api, canvas.selector, presentationVersion]);

    const resolvedVisibleFieldIds = useMemo(() => {
        if (!resolvedCurrentTagId) return [] as string[];
        const optionIds = (canvas.selectionInfo.optionIds ?? []) as string[];
        try {
            return canvas.api.builder.visibleFields(String(resolvedCurrentTagId), optionIds).map(String);
        } catch {
            return [];
        }
    }, [canvas.api, canvas.selectionInfo.optionIds, presentationVersion, resolvedCurrentTagId]);

    const presentation = useMemo(() => {
        const snapshot = canvas.api.snapshot();
        return deriveCanvasPresentation({
            nodes: snapshot.graph.nodes as Array<{ id: string; kind: 'tag' | 'field' | 'option' | string }>,
            edges: snapshot.graph.edges as Array<{ kind: string; from: string; to: string }>,
            activeId: canvas.activeId,
            currentTagId: resolvedCurrentTagId,
            visibleGroup: resolvedCurrentTagId
                ? {
                      kind: 'single',
                      group: {
                          tagId: resolvedCurrentTagId,
                          fieldIds: resolvedVisibleFieldIds,
                      },
                  }
                : null,
            highlightedIds: snapshot.highlighted ?? new Set<string>(),
            prefs: viewPrefs,
        });
    }, [canvas.activeId, canvas.api, resolvedCurrentTagId, resolvedVisibleFieldIds, viewPrefs, presentationVersion]);

    const nodeDecorators = useMemo<NonNullable<AdapterOptions['nodeDecorators']>>(
        () => (nodeId) => {
            const node = canvas.selector.getNode(nodeId);
            const canAssign = canAssignService(canvas, nodeId);
            const selected = canvas.selection.includes(nodeId) || canvas.activeId === nodeId;
            const nodeState = presentation.nodeStateById[nodeId];
            return {
                selected,
                data: {
                    hasError: errorNodeIds.has(nodeId),
                    showErrorBadge: showErrorBadges,
                    canAssignService: canAssign,
                    draggingService: !!draggingServiceId,
                    canAcceptDropPayload,
                    onNodeDrop: ({ nodeId: targetNodeId, clientX, clientY, dataTransfer }) => {
                        handleNodeDrop({
                            receiverId: targetNodeId,
                            receiverKind: node.kind as any,
                            surface: 'canvas',
                            clientX,
                            clientY,
                            dataTransfer,
                        });
                        onServiceDragStateChange(null);
                    },
                    node: {
                        id: node.id,
                        label: getNodeLabel(node),
                        kind: node.kind,
                    },
                    isActiveNode: nodeState?.isActiveNode ?? false,
                    isCurrentTag: nodeState?.isCurrentTag ?? false,
                    isVisibleGroupField: nodeState?.isVisibleGroupField ?? false,
                    isRelatedTag: nodeState?.isRelatedTag ?? false,
                    isManualHighlighted: nodeState?.isManualHighlighted ?? false,
                    showCurrentTagDot: nodeState?.showCurrentTagDot ?? false,
                    focusDimLevel: nodeState?.focusDimLevel ?? 'none',
                },
            };
        },
        [canvas, canAcceptDropPayload, draggingServiceId, errorNodeIds, handleNodeDrop, onServiceDragStateChange, presentation.nodeStateById, showErrorBadges],
    );

    const edgeDecorators = useMemo<NonNullable<AdapterOptions['edgeDecorators']>>(
        () => (edgeId) => {
            const edgeState = presentation.edgeStateById[edgeId];
            const parsed = parseRelationEdgeId(edgeId);
            const kind = parsed?.kind;
            const style = kind
                ? edgeStyleForState({
                      kind,
                      isContextBindEdge: edgeState?.isContextBindEdge ?? false,
                      isManualHighlighted: edgeState?.isManualHighlighted ?? false,
                      focusDimLevel: edgeState?.focusDimLevel ?? 'none',
                  })
                : undefined;
            return {
                hidden: edgeState?.hidden ?? false,
                style: style ?? undefined,
            };
        },
        [presentation.edgeStateById],
    );

    const mergedOptions = useMemo<AdapterOptions>(
        () => ({
            ...options,
            nodeDecorators: (nodeId) => {
                const base = nodeDecorators(nodeId);
                const extra = options?.nodeDecorators?.(nodeId) ?? {};
                return {
                    ...base,
                    ...extra,
                    data: { ...(base.data as object), ...((extra as any).data ?? {}) },
                };
            },
            edgeDecorators: (edgeId) => ({
                ...(edgeDecorators(edgeId) ?? {}),
                ...(options?.edgeDecorators?.(edgeId) ?? {}),
            }),
        }),
        [edgeDecorators, nodeDecorators, options],
    );

    if (!canvas.graph.nodes.length) {
        return (
            <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(19,91,236,0.08),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(19,91,236,0.12),transparent_35%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
                <div className="m-auto w-full max-w-xl px-6">
                    <EmptyState
                        title="Your service map is ready for components"
                        description="Add a tag or field from the left panel and the flow canvas will materialize with connected nodes, comments, and tools."
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(19,91,236,0.08),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(19,91,236,0.12),transparent_35%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
            <FlowCanvas
                tools={tools}
                showToolbar={showToolbar}
                labelPlacement={labelPlacement}
                canUndo={historyState.canUndo}
                canRedo={historyState.canRedo}
                initialShowGrid={initialShowGrid}
                initialShowMiniMap={initialShowMiniMap}
                toolbarOrientation={toolbarOrientation}
                persistToolbarOrientation={persistToolbarOrientation}
                options={mergedOptions}
                showBindEdges={viewPrefs.showBindEdges}
                setShowBindEdges={(value) => setViewPrefs((current) => ({ ...current, showBindEdges: value }))}
                showIncludeEdges={viewPrefs.showIncludeEdges}
                setShowIncludeEdges={(value) => setViewPrefs((current) => ({ ...current, showIncludeEdges: value }))}
                showExcludeEdges={viewPrefs.showExcludeEdges}
                setShowExcludeEdges={(value) => setViewPrefs((current) => ({ ...current, showExcludeEdges: value }))}
                focusCurrentContext={viewPrefs.focusCurrentContext}
                setFocusCurrentContext={(value) => setViewPrefs((current) => ({ ...current, focusCurrentContext: value }))}
                onNodeContextMenu={({ nodeId, nodeKind, clientX, clientY, event }) => {
                    if (nodeKind === 'comment' || nodeId.startsWith('c::')) return;
                    event.preventDefault();
                    openNodeContextMenu({
                        nodeId,
                        nodeKind,
                        surface: 'canvas',
                        clientX,
                        clientY,
                    });
                }}
                toolbarPositionClassName="left-4 top-4"
            >
                {showAppTools ? (
                    <AppToolbar
                        errors={errors}
                        showErrorBadges={showErrorBadges}
                        setShowErrorBadges={setShowErrorBadges}
                        bottomPanelOpen={bottomPanel.isOpen}
                        onConsoleToggle={() => bottomPanel.toggle()}
                        canUndo={historyState.canUndo}
                        canRedo={historyState.canRedo}
                        canSave={canSave}
                        canPublish={canPublish}
                        onUndo={() => {
                            if (!historyState.canUndo) return;
                            canvas.api.editor.undo();
                        }}
                        onRedo={() => {
                            if (!historyState.canRedo) return;
                            canvas.api.editor.redo();
                        }}
                        onSave={async () => {
                            if (!canSave) return;
                            const submittedHash = currentSnapshotHash;
                            setActionPending('save');
                            try {
                                const res = await ws.snapshot.save('Canvas save');
                                if (res.ok === false) {
                                    const { error } = res;
                                    canvas.api.emit('error', { message: error.message, code: error.code, meta: error.meta });
                                    return;
                                }
                                setPersistedBaselineHash(submittedHash);
                            } finally {
                                setActionPending(null);
                            }
                        }}
                        onPublish={async () => {
                            if (!canPublish) return;
                            const submittedHash = currentSnapshotHash;
                            setActionPending('publish');
                            try {
                                const res = await ws.snapshot.publish('Canvas publish');
                                if (res.ok === false) {
                                    const { error } = res;
                                    canvas.api.emit('error', { message: error.message, code: error.code, meta: error.meta });
                                    return;
                                }
                                setPersistedBaselineHash(submittedHash);
                            } finally {
                                setActionPending(null);
                            }
                        }}
                        onRelayout={() => {
                            canvas.api.emit('error', {
                                message: 'Relayout is not wired in this workspace yet.',
                                meta: { action: 'relayout' },
                            });
                        }}
                        noticesOpen={isNoticeManagerOpen}
                        onNoticesToggle={toggleNoticeManager}
                        pendingAction={actionPending}
                    />
                ) : null}

                {showOverlays ? (
                    <CanvasOverlays
                        state={overlayState}
                        setState={setOverlayState}
                        stats={stats}
                        activeId={canvas.activeId}
                        selectedCount={canvas.selectionInfo.ids.length}
                        freeThreadCount={freeThreads.length}
                    />
                ) : null}
            </FlowCanvas>
        </div>
    );
}

function AppToolbar({
    errors,
    bottomPanelOpen,
    onConsoleToggle,
    canUndo,
    canRedo,
    canSave,
    canPublish,
    onUndo,
    onRedo,
    onSave,
    onPublish,
    onRelayout,
    noticesOpen,
    onNoticesToggle,
    showErrorBadges,
    setShowErrorBadges,
    pendingAction,
}: {
    errors: UseErrorsReturn;
    bottomPanelOpen: boolean;
    onConsoleToggle: () => void;
    canUndo: boolean;
    canRedo: boolean;
    canSave: boolean;
    canPublish: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void | Promise<void>;
    onPublish: () => void | Promise<void>;
    onRelayout: () => void;
    noticesOpen: boolean;
    onNoticesToggle: () => void;
    showErrorBadges: boolean;
    setShowErrorBadges: (value: boolean) => void;
    pendingAction: 'save' | 'publish' | null;
}) {
    return (
        <div className="pointer-events-none absolute top-4 right-4 z-20 flex items-center gap-2">
            <div className="pointer-events-auto inline-flex items-center rounded-lg border border-slate-200 bg-white/95 shadow-md dark:border-slate-800 dark:bg-slate-950/95">
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-r-none"
                    title="Save snapshot"
                    onClick={onSave}
                    disabled={pendingAction === 'save' || !canSave}
                >
                    <FiSave />
                </Button>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-l-none"
                    title="Publish commit"
                    onClick={onPublish}
                    disabled={pendingAction === 'publish' || !canPublish}
                >
                    <LuGitCommitHorizontal />
                </Button>
            </div>

            <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-0.5 shadow-md dark:border-slate-800 dark:bg-slate-950/95">
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Undo" onClick={onUndo} disabled={!canUndo}>
                    <LuUndo2 />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Redo" onClick={onRedo} disabled={!canRedo}>
                    <LuRedo2 />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Relayout (coming soon)" onClick={onRelayout}>
                    <LuHistory />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn('h-8 w-8', showErrorBadges && 'text-blue-600')}
                    title="Toggle error markers"
                    onClick={() => setShowErrorBadges(!showErrorBadges)}
                >
                    {showErrorBadges ? <FiEye /> : <FiEyeOff />}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn('relative h-8 w-8', bottomPanelOpen && 'text-blue-600')}
                    title="Toggle console"
                    onClick={onConsoleToggle}
                >
                    <FiTerminal />
                    {errors.merged.counts.total > 0 ? (
                        <span className="absolute top-1.5 right-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                    ) : null}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn('h-8 w-8', noticesOpen && 'text-blue-600')}
                    title="Toggle notices manager"
                    onClick={onNoticesToggle}
                >
                    <FiAlertCircle />
                </Button>
            </div>
        </div>
    );
}

function CanvasOverlays({
    state,
    setState,
    stats,
    activeId,
    selectedCount,
    freeThreadCount,
}: {
    state: OverlayState;
    setState: React.Dispatch<React.SetStateAction<OverlayState>>;
    stats: { tags: number; fields: number; comments: number };
    activeId: string | null;
    selectedCount: number;
    freeThreadCount: number;
}) {
    const toggleMinimized = (id: OverlayId) =>
        setState((current) => ({ ...current, [id]: { ...current[id], minimized: !current[id].minimized, closed: false } }));
    const closeOverlay = (id: OverlayId) => setState((current) => ({ ...current, [id]: { ...current[id], closed: true } }));
    const restoreOverlay = (id: OverlayId) => setState((current) => ({ ...current, [id]: { minimized: false, closed: false } }));

    const closed = (Object.keys(state) as OverlayId[]).filter((id) => state[id].closed);

    return (
        <>
            <div className="pointer-events-none absolute top-4 right-56 z-20 flex flex-col gap-3">
                {!state.pulse.closed ? (
                    <OverlayCard
                        title="Workspace pulse"
                        minimized={state.pulse.minimized}
                        onMinimize={() => toggleMinimized('pulse')}
                        onClose={() => closeOverlay('pulse')}
                    >
                        <div className="grid grid-cols-3 gap-2">
                            <Stat label="Tags" value={stats.tags} />
                            <Stat label="Fields" value={stats.fields} />
                            <Stat label="Comments" value={stats.comments} />
                        </div>
                    </OverlayCard>
                ) : null}
                {!state.focus.closed ? (
                    <OverlayCard
                        title={activeId ? `Focused: ${activeId}` : 'Nothing focused'}
                        minimized={state.focus.minimized}
                        onMinimize={() => toggleMinimized('focus')}
                        onClose={() => closeOverlay('focus')}
                    >
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <MdOutlineVisibility />
                            <span>{selectedCount} selected nodes</span>
                        </div>
                    </OverlayCard>
                ) : null}
                {!state.comments.closed ? (
                    <OverlayCard
                        title="Free comments"
                        minimized={state.comments.minimized}
                        onMinimize={() => toggleMinimized('comments')}
                        onClose={() => closeOverlay('comments')}
                    >
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {freeThreadCount} unanchored thread{freeThreadCount === 1 ? '' : 's'} on canvas
                        </div>
                    </OverlayCard>
                ) : null}
            </div>

            <div className="pointer-events-none absolute right-4 bottom-4 z-20 flex flex-col items-end gap-2">
                {closed.map((id) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => restoreOverlay(id)}
                        className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-300"
                    >
                        Restore {id}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setState(restoreAllOverlays())}
                    className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-300"
                    title="Restore all overlays (Ctrl/Cmd + Shift + O)"
                >
                    <FiRotateCw />
                    Restore all
                </button>
            </div>
        </>
    );
}

function OverlayCard({
    title,
    minimized,
    onMinimize,
    onClose,
    children,
}: {
    title: string;
    minimized: boolean;
    onMinimize: () => void;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="pointer-events-auto w-72">
            <CanvasOverlay
                title={title}
                description={minimized ? 'Minimized' : undefined}
                className={cn(minimized && 'py-2')}
                children={
                    <div className="space-y-3">
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                onClick={onMinimize}
                            >
                                {minimized ? 'Expand' : 'Minimize'}
                            </button>
                            <button
                                type="button"
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                onClick={onClose}
                            >
                                Close
                            </button>
                        </div>
                        {!minimized ? children : null}
                    </div>
                }
            />
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <div className="text-[11px] tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</div>
        </div>
    );
}

function canAssignService(canvas: ReturnType<typeof useCanvas>, nodeId: string) {
    const node = canvas.selector.getNode(nodeId);
    if (!node || (node.kind !== 'tag' && node.kind !== 'field' && node.kind !== 'option')) return false;
    return getNodePropertyCapabilities(node).service.canEdit;
}

function getNodeLabel(node: unknown) {
    if (node && typeof node === 'object' && 'raw' in node && node.raw && typeof node.raw === 'object' && 'label' in node.raw) {
        return String((node.raw as { label?: string }).label ?? '');
    }
    if (node && typeof node === 'object' && 'id' in node) return String((node as { id?: string }).id ?? '');
    return '';
}

function storageKey(ws: ReturnType<typeof useWorkspace>) {
    return `service-builder.canvas.overlays.${ws.info.id}.${ws.branches.currentId ?? 'none'}`;
}

function viewPrefsStorageKey(ws: ReturnType<typeof useWorkspace>) {
    return `service-builder.canvas.view-prefs.${ws.info.id}.${ws.branches.currentId ?? 'none'}`;
}

function loadOverlayState(key: string, fallback: OverlayState): OverlayState {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return {
            pulse: parsed?.pulse ?? fallback.pulse,
            focus: parsed?.focus ?? fallback.focus,
            comments: parsed?.comments ?? fallback.comments,
        };
    } catch {
        return fallback;
    }
}

function persistOverlayState(key: string, state: OverlayState) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
        /* ignore storage failures */
    }
}

function loadCanvasViewPrefs(key: string, fallback: CanvasViewPrefsState): CanvasViewPrefsState {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return {
            showBindEdges: parsed?.showBindEdges ?? fallback.showBindEdges,
            showIncludeEdges: parsed?.showIncludeEdges ?? fallback.showIncludeEdges,
            showExcludeEdges: parsed?.showExcludeEdges ?? fallback.showExcludeEdges,
            focusCurrentContext: parsed?.focusCurrentContext ?? fallback.focusCurrentContext,
        };
    } catch {
        return fallback;
    }
}

function persistCanvasViewPrefs(key: string, state: CanvasViewPrefsState) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
        /* ignore storage failures */
    }
}

function restoreAllOverlays(): OverlayState {
    return {
        pulse: { closed: false, minimized: false },
        focus: { closed: false, minimized: false },
        comments: { closed: false, minimized: false },
    };
}

function buildWorkspaceSnapshot(api: ReturnType<typeof useCanvas>['api']): WorkspaceSnapshot {
    const state = api.snapshot();
    const sortedPositionKeys = Object.keys(state.positions).sort();
    const positions: Record<string, { x: number; y: number }> = {};
    for (const key of sortedPositionKeys) {
        const pos = state.positions[key];
        positions[key] = { x: Number(pos?.x ?? 0), y: Number(pos?.y ?? 0) };
    }

    return {
        props: api.editor.getProps(),
        layout: {
            canvas: {
                positions,
                viewport: {
                    x: Number(state.viewport.x ?? 0),
                    y: Number(state.viewport.y ?? 0),
                    zoom: Number(state.viewport.zoom ?? 1),
                },
            },
        },
    };
}

function hashSnapshot(value: unknown): string {
    return JSON.stringify(toStableValue(value));
}

function toStableValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => toStableValue(item));
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        out[key] = toStableValue((value as Record<string, unknown>)[key]);
    }
    return out;
}
