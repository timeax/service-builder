import type { BottomConsolePanelState } from '@/builder/bottom-panel.ts';
import { useNodeContextMenu } from '@/builder/node-context-menu.tsx';
import { EmptyState } from '@/components/builder/index.tsx';
import {
    defaultCanvasViewPrefs,
    deriveCanvasPresentation,
    edgeStyleForState,
    parseEdgeId as parseRelationEdgeId,
} from '@/panels/canvas/presentation.ts';
import { BOOT_SECTION_LABELS, getBootActionReason, getFailedBlockingSections } from '@/workspace/boot.ts';
import type { EditorSnapshot } from '@timeax/digital-service-engine';
import { useCanvas, type UseErrorsReturn, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import type { AdapterOptions } from './adapter.ts';
import { AppToolbar } from './app-toolbar.tsx';
import { CanvasOverlays } from './canvas-overlays.tsx';
import { FlowCanvas } from './flow-canvas.tsx';
import type { LabelPlacement, ToolbarOrientation, ToolsConfig } from './toolbar/types.ts';
import {
    canAssignService,
    type CanvasViewPrefsState,
    getNodeLabel,
    hashSnapshot,
    type HistoryState,
    loadCanvasViewPrefs,
    loadOverlayState,
    OVERLAY_DEFAULTS,
    type OverlayState,
    persistCanvasViewPrefs,
    persistOverlayState,
    restoreAllOverlays,
    storageKey,
    viewPrefsStorageKey,
} from './utils.ts';

type EditorChangeEvent = {
    reason?: string;
    snapshot?: EditorSnapshot;
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

    const activeWorkspaceSnapshot = ws.snapshot.data as EditorSnapshot | undefined;
    const initialSnapshotHash = useMemo(() => hashSnapshot(activeWorkspaceSnapshot ?? null), [activeWorkspaceSnapshot]);

    const [showErrorBadges, setShowErrorBadges] = useState(true);
    const [actionPending, setActionPending] = useState<'save' | 'publish' | null>(null);
    const [historyState, setHistoryState] = useState<HistoryState>({
        canUndo: false,
        canRedo: false,
    });
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
        const resetHash = hashSnapshot((ws.snapshot.data as EditorSnapshot | undefined) ?? null);

        setCurrentSnapshotHash(resetHash);
        setPersistedBaselineHash(resetHash);
        lastSyncedSnapshotHashRef.current = resetHash;
        setHistoryState({ canUndo: false, canRedo: false });
    }, [canvas.api, ws.info.id, ws.branches.currentId]);

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

    function setSnapshot(event: any) {
        const nextSnapshot = event?.snapshot;
        if (!nextSnapshot) return;

        const nextHash = hashSnapshot(nextSnapshot);

        setCurrentSnapshotHash((current) => (current === nextHash ? current : nextHash));

        if (nextHash !== lastSyncedSnapshotHashRef.current) {
            lastSyncedSnapshotHashRef.current = nextHash;
            ws.snapshot.set(() => nextSnapshot);
        }
    }

    useEffect(() => {
        const catalogChange = canvas.api.on('catalog:change', setSnapshot);

        const offEditorChange = (canvas.api.on as any)('editor:change', (event: EditorChangeEvent) => {
            setSnapshot(event);
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
            offEditorChange?.();
            offUndo?.();
            offRedo?.();
            catalogChange?.();
        };
    }, [canvas.api, ws.snapshot]);

    const hasChanges = currentSnapshotHash !== persistedBaselineHash;

    const canSave = hasChanges;
    const canPublish = !!ws.snapshot.draft && !hasChanges;

    const bootActionReason = getBootActionReason(ws.boot);
    const failedBlockingSections = getFailedBlockingSections(ws.boot);

    const resolvedCurrentTagId = useMemo(() => {
        const activeId = canvas.activeId;

        if (activeId) {
            try {
                const activeNode = canvas.selector.getNode(activeId);
                if (activeNode?.kind === 'tag') return activeId;
            } catch {
                /* fall through */
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
            nodes: snapshot.graph.nodes as Array<{
                id: string;
                kind: 'tag' | 'field' | 'option' | string;
            }>,
            edges: snapshot.graph.edges as Array<{
                kind: string;
                from: string;
                to: string;
            }>,
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
        [
            canvas,
            canAcceptDropPayload,
            draggingServiceId,
            errorNodeIds,
            handleNodeDrop,
            onServiceDragStateChange,
            presentation.nodeStateById,
            showErrorBadges,
        ],
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
                    data: {
                        ...(base.data as object),
                        ...((extra as any).data ?? {}),
                    },
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
                setShowBindEdges={(value) =>
                    setViewPrefs((current) => ({
                        ...current,
                        showBindEdges: value,
                    }))
                }
                showIncludeEdges={viewPrefs.showIncludeEdges}
                setShowIncludeEdges={(value) =>
                    setViewPrefs((current) => ({
                        ...current,
                        showIncludeEdges: value,
                    }))
                }
                showExcludeEdges={viewPrefs.showExcludeEdges}
                setShowExcludeEdges={(value) =>
                    setViewPrefs((current) => ({
                        ...current,
                        showExcludeEdges: value,
                    }))
                }
                focusCurrentContext={viewPrefs.focusCurrentContext}
                setFocusCurrentContext={(value) =>
                    setViewPrefs((current) => ({
                        ...current,
                        focusCurrentContext: value,
                    }))
                }
                onNodeContextMenu={({ nodeId, nodeKind, clientX, clientY, event }) => {
                    if (nodeKind === 'comment' || nodeId.startsWith('c::')) {
                        return;
                    }

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
                        bootActionReason={bootActionReason}
                        errors={errors}
                        showErrorBadges={showErrorBadges}
                        setShowErrorBadges={setShowErrorBadges}
                        bottomPanelOpen={bottomPanel.isOpen}
                        onConsoleToggle={() => bottomPanel.toggle()}
                        canUndo={historyState.canUndo}
                        canRedo={historyState.canRedo}
                        canSave={canSave && ws.boot.isReady}
                        canPublish={canPublish && ws.boot.isReady}
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
                                    canvas.api.emit('error', {
                                        message: error.message,
                                        code: error.code,
                                        meta: error.meta,
                                    });
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
                                    canvas.api.emit('error', {
                                        message: error.message,
                                        code: error.code,
                                        meta: error.meta,
                                    });
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

                {failedBlockingSections.length ? (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
                        <div className="pointer-events-auto w-full max-w-xl rounded-[28px] border border-rose-200 bg-white/96 p-5 shadow-2xl backdrop-blur dark:border-rose-500/30 dark:bg-slate-950/96">
                            <div className="flex items-start gap-3">
                                <FiAlertCircle className="mt-0.5 text-xl text-rose-500" />
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                        Editor waiting for required workspace data
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                        The canvas stays visible, but editing should wait until these required sections recover:{' '}
                                        {failedBlockingSections.map((section) => BOOT_SECTION_LABELS[section]).join(', ')}.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </FlowCanvas>
        </div>
    );
}
