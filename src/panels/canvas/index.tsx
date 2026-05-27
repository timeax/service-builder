import type { BottomConsolePanelState } from '@/builder/bottom-panel.ts';
import { useNodeContextMenu } from '@/builder/node-context-menu.tsx';
import { EmptyState } from '@/components/builder/index.tsx';
import { buildServiceContextSnapshot, buildServiceRowVM, createEmptyServiceContextSnapshot, type ServiceContextState } from '@/builder/service-context.ts';
import {
    defaultCanvasViewPrefs,
    deriveCanvasPresentation,
    edgeStyleForState,
    parseEdgeId as parseRelationEdgeId,
} from '@/panels/canvas/presentation.ts';
import type { BuilderServiceSummary } from '@/builder/bottom-panel.ts';
import { BOOT_SECTION_LABELS, getBootActionReason, getFailedBlockingSections } from '@/workspace/boot.ts';
import { deriveWorkspaceAuthorization, getAuthorizationDecision } from '@/workspace/authorization.ts';
import type { EditorSnapshot } from '@timeax/digital-service-engine';
import type { DgpServiceCapability, ServiceCatalogState, ServiceProps } from '@timeax/digital-service-engine/schema';
import { useCanvas, type UseErrorsReturn, useWorkspace } from '@timeax/digital-service-engine/workspace';
import cloneDeep from 'lodash/cloneDeep';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import type { AdapterOptions } from './adapter.ts';
import { AppToolbar } from './app-toolbar.tsx';
import { FlowCanvas } from './flow-canvas.tsx';
import { ImportJsonModal, type ImportTarget } from './import-json-modal.tsx';
import type { LabelPlacement, ToolbarOrientation, ToolsConfig } from './toolbar/types.ts';
import {
    canAssignService,
    type CanvasViewPrefsState,
    getNodeLabel,
    hashSnapshot,
    type HistoryState,
    loadCanvasViewPrefs,
    persistCanvasViewPrefs,
    viewPrefsStorageKey,
} from './utils.ts';

type EditorChangeEvent = {
    reason?: string;
    snapshot?: EditorSnapshot;
};
type EditorHistoryEvent = {
    index?: number;
    stackSize?: number;
    snapshot?: EditorSnapshot;
};

const EDITOR_GUARD_ORIGINALS = Symbol('service-builder.editor-guard-originals');
const EDITOR_GUARD_WRAPPED = Symbol('service-builder.editor-guard-wrapped');

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
    const { openNodeContextMenu, openEdgeContextMenu, canAcceptDropPayload, handleNodeDrop, toggleNoticeManager, isNoticeManagerOpen } = useNodeContextMenu();
    const ws = useWorkspace();

    const activeWorkspaceSnapshot = ws.snapshot.data as EditorSnapshot | undefined;
    const initialSnapshotHash = useMemo(() => hashSnapshot(activeWorkspaceSnapshot ?? null), [activeWorkspaceSnapshot]);

    const [showErrorBadges, setShowErrorBadges] = useState(true);
    const [actionPending, setActionPending] = useState<'save' | 'publish' | null>(null);
    const [commentPlacementActive, setCommentPlacementActive] = useState(false);
    const [activeImportTarget, setActiveImportTarget] = useState<ImportTarget | null>(null);
    const [historyState, setHistoryState] = useState<HistoryState>({
        canUndo: false,
        canRedo: false,
    });
    const [currentSnapshotHash, setCurrentSnapshotHash] = useState(initialSnapshotHash);
    const [persistedBaselineHash, setPersistedBaselineHash] = useState(initialSnapshotHash);
    const [viewPrefs, setViewPrefs] = useState<CanvasViewPrefsState>(() => loadCanvasViewPrefs(viewPrefsStorageKey(ws), defaultCanvasViewPrefs));
    const [presentationVersion, setPresentationVersion] = useState(0);
    const lastSyncedSnapshotHashRef = useRef<string>(initialSnapshotHash);
    const guardedEditorRef = useRef<object | null>(null);
    const liveSnapshotRequestRef = useRef(0);
    const checksByIdRequestRef = useRef(0);

    const servicesMap = (ws.services?.data ?? {}) as Record<string, DgpServiceCapability>;

    const errorNodeIds = useMemo(
        () => new Set((errors.merged.validation ?? []).map((row) => row.nodeId).filter(Boolean) as string[]),
        [errors.merged.validation],
    );

    const auth = useMemo(
        () =>
            deriveWorkspaceAuthorization({
                actor: ws.actor,
                permissions: ws.permissions?.data,
                participants: ws.participants?.data,
                authors: ws.authors?.data,
            }),
        [ws.actor, ws.permissions?.data, ws.participants?.data, ws.authors?.data],
    );

    const canEditBranchContent = auth.canEditBranchContent;
    const canCommentWrite = auth.canCommentWrite;
    const canPublishBranch = auth.canPublishBranches;
    const editDecision = getAuthorizationDecision(auth, 'branch-content-edit');
    const publishDecision = getAuthorizationDecision(auth, 'branch-publish');
    const commentWriteDecision = getAuthorizationDecision(auth, 'comment-write');

    const emitPermissionDenied = useCallback(
        (reason: string, action: string, meta?: Record<string, unknown>) => {
            canvas.api.emit('error', {
                code: 'forbidden',
                message: reason,
                meta: { action, ...(meta ?? {}) },
            });
        },
        [canvas.api],
    );


    useEffect(() => {
        setViewPrefs(loadCanvasViewPrefs(viewPrefsStorageKey(ws), defaultCanvasViewPrefs));
    }, [ws.info.id, ws.branches.currentId]);

    useEffect(() => {
        persistCanvasViewPrefs(viewPrefsStorageKey(ws), viewPrefs);
    }, [viewPrefs, ws]);

    useEffect(() => {
        const resetHash = hashSnapshot((ws.snapshot.data as EditorSnapshot | undefined) ?? null);

        setCurrentSnapshotHash(resetHash);
        setPersistedBaselineHash(resetHash);
        lastSyncedSnapshotHashRef.current = resetHash;
        setHistoryState({ canUndo: false, canRedo: false });
    }, [canvas.api, ws.info.id, ws.branches.currentId]);

    useEffect(() => {
        if (canCommentWrite) return;
        setCommentPlacementActive(false);
    }, [canCommentWrite]);

    useEffect(() => {
        const editorAny = canvas.api.editor as unknown as Record<string, unknown>;
        const mutatingMethods = [
            'addTag',
            'addField',
            'setService',
            'connect',
            'disconnect',
            'editLabel',
            'remove',
            'duplicate',
            'placeNode',
            'placeOption',
            'patchProps',
            'replaceProps',
            'setCatalog',
            'addNotice',
            'updateNotice',
            'removeNotice',
            'transact',
        ] as const;

        const editorObject = editorAny as Record<PropertyKey, unknown>;
        const wrappedSet = (editorObject[EDITOR_GUARD_WRAPPED] as Set<string> | undefined) ?? new Set<string>();
        const originalsByMethod =
            (editorObject[EDITOR_GUARD_ORIGINALS] as Map<string, (...args: unknown[]) => unknown> | undefined) ??
            new Map<string, (...args: unknown[]) => unknown>();

        editorObject[EDITOR_GUARD_WRAPPED] = wrappedSet;
        editorObject[EDITOR_GUARD_ORIGINALS] = originalsByMethod;

        guardedEditorRef.current = editorObject;

        for (const method of mutatingMethods) {
            if (wrappedSet.has(method)) continue;

            const original = editorObject[method];
            if (typeof original !== 'function') continue;

            const originalFn = original as (...args: unknown[]) => unknown;
            originalsByMethod.set(method, originalFn);
            wrappedSet.add(method);

            editorObject[method] = (...args: unknown[]) => {
                if (!canEditBranchContent) {
                    emitPermissionDenied(editDecision.reason ?? 'Editing is disabled for this actor.', method);
                    return undefined;
                }

                return Reflect.apply(originalFn, editorObject, args);
            };
        }

        return () => {
            if (guardedEditorRef.current !== editorObject) return;

            for (const method of mutatingMethods) {
                const original = originalsByMethod.get(method);
                if (!original) continue;
                editorObject[method] = original;
                wrappedSet.delete(method);
            }

            originalsByMethod.clear();
        };
    }, [canvas.api.editor, canEditBranchContent, editDecision.reason, emitPermissionDenied]);

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
        const bumpPresentationVersion = () => setPresentationVersion((current) => current + 1);

        const offEditorChange = (canvas.api.on as any)('editor:change', (event: EditorChangeEvent) => {
            setSnapshot(event);
            if (event?.reason === 'mutation' || event?.reason === 'transaction') {
                setHistoryState({ canUndo: true, canRedo: false });
            }
        });

        const offUndo = (canvas.api.on as any)('editor:undo', (event: EditorHistoryEvent) => {
            setSnapshot(event);
            const index = Number(event?.index ?? 0);
            const stackSize = Number(event?.stackSize ?? 0);

            setHistoryState({
                canUndo: index > 0,
                canRedo: index < stackSize - 1,
            });
            bumpPresentationVersion();
        });

        const offRedo = (canvas.api.on as any)('editor:redo', (event: EditorHistoryEvent) => {
            setSnapshot(event);
            const index = Number(event?.index ?? 0);
            const stackSize = Number(event?.stackSize ?? 0);

            setHistoryState({
                canUndo: index > 0,
                canRedo: index < stackSize - 1,
            });
            bumpPresentationVersion();
        });

        return () => {
            offEditorChange?.();
            offUndo?.();
            offRedo?.();
            catalogChange?.();
        };
    }, [canvas.api, ws.snapshot]);

    const hasChanges = currentSnapshotHash !== persistedBaselineHash;

    const canSave = hasChanges && canEditBranchContent;
    const canPublish = !!ws.snapshot.draft && !hasChanges && canPublishBranch;

    const importProps = async (nextProps: ServiceProps) => {
        if (!canEditBranchContent) {
            emitPermissionDenied(editDecision.reason ?? 'Editing is disabled for this actor.', 'import-props');
            return;
        }
        const editorAny = canvas.api.editor as unknown as {
            transact?: (label: string, work: () => void) => void;
            replaceProps?: (next: ServiceProps) => void;
        };

        if (typeof editorAny.transact !== 'function' || typeof editorAny.replaceProps !== 'function') {
            throw new Error('Props import is unavailable on this editor instance.');
        }

        editorAny.transact('Import props', () => {
            editorAny.replaceProps?.(cloneDeep(nextProps));
        });
    };

    const importCatalog = async (nextCatalog: ServiceCatalogState) => {
        if (!canEditBranchContent) {
            emitPermissionDenied(editDecision.reason ?? 'Editing is disabled for this actor.', 'import-catalog');
            return;
        }
        const editorAny = canvas.api.editor as unknown as {
            transact?: (label: string, work: () => void) => void;
            setCatalog?: (next?: ServiceCatalogState) => void;
        };

        if (typeof editorAny.transact !== 'function' || typeof editorAny.setCatalog !== 'function') {
            throw new Error('Catalog import is unavailable on this editor instance.');
        }

        editorAny.transact('Import catalog', () => {
            editorAny.setCatalog?.(cloneDeep(nextCatalog));
        });
    };

    const bootActionReason = getBootActionReason(ws.boot);
    const failedBlockingSections = getFailedBlockingSections(ws.boot);

    const resolvedCurrentTagId = useMemo<string | null>(() => {
        const activeId = canvas.activeId;

        if (activeId) {
            try {
                const activeNode = canvas.selector.getNode(activeId);
                if (activeNode?.kind === 'tag') return String(activeId);
            } catch {
                /* fall through */
            }
        }

        const fromSelection = canvas.api.selection.currentTag?.();
        if (fromSelection != null) return String(fromSelection);

        const visibleTagFallback = canvas.layers.tags[0]?.id ?? null;
        return visibleTagFallback != null ? String(visibleTagFallback) : null;
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

    const selectedButtons = useMemo(() => {
        const fromButtons = ((canvas.api.selection.selectedButtons?.() ?? []) as Array<string | number>).map((value) => String(value));
        const fromOptions = ((canvas.selectionInfo.optionIds ?? []) as Array<string | number>).map((value) => String(value));
        return Array.from(new Set([...fromButtons, ...fromOptions]));
    }, [canvas.api.selection, canvas.selectionInfo.optionIds]);
    const liveContextState = useMemo<ServiceContextState>(
        () => ({
            selectedTagId: resolvedCurrentTagId != null ? String(resolvedCurrentTagId) : null,
            selectedButtons,
            strictSafety: true,
            enforcePolicies: true,
        }),
        [resolvedCurrentTagId, selectedButtons],
    );
    const [liveContextSnapshot, setLiveContextSnapshot] = useState(() => createEmptyServiceContextSnapshot(liveContextState, canvas.props));
    useEffect(() => {
        const requestId = ++liveSnapshotRequestRef.current;
        const fallback = createEmptyServiceContextSnapshot(liveContextState, canvas.props);
        setLiveContextSnapshot(fallback);

        buildServiceContextSnapshot({ props: canvas.props, services: servicesMap, state: liveContextState })
            .then((snapshot) => {
                if (liveSnapshotRequestRef.current !== requestId) return;
                setLiveContextSnapshot(snapshot);
            })
            .catch(() => {
                if (liveSnapshotRequestRef.current !== requestId) return;
                setLiveContextSnapshot(fallback);
            });
    }, [canvas.props, liveContextState, servicesMap]);
    const [checksById, setChecksById] = useState<Map<string, any>>(new Map());
    useEffect(() => {
        const requestId = ++checksByIdRequestRef.current;

        if (!liveContextSnapshot.selectedTag) {
            setChecksById(new Map());
            return;
        }

        const candidateIds = Object.values(servicesMap).map((service: any) => service.id);
        new Promise<any[]>((resolve) => {
            setTimeout(() => {
                const checks = (canvas.api.editor as any).filterServicesForVisibleGroup(candidateIds, {
                    tagId: liveContextSnapshot.selectedTag!.id,
                    selectedButtons: liveContextSnapshot.state.selectedButtons,
                    usedServiceIds: liveContextSnapshot.usedServiceIds,
                    effectiveConstraints: liveContextSnapshot.selectedTag!.constraints,
                    policies: ws.policies?.policies?.data ?? [],
                });
                resolve(Array.isArray(checks) ? checks : []);
            }, 0);
        })
            .then((checks) => {
                if (checksByIdRequestRef.current !== requestId) return;
                setChecksById(new Map(checks.map((check: any) => [String(check.id), check])));
            })
            .catch(() => {
                if (checksByIdRequestRef.current !== requestId) return;
                setChecksById(new Map());
            });
    }, [canvas.api.editor, liveContextSnapshot, servicesMap, ws.policies?.policies?.data]);
    const serviceContextRows = useMemo(() => {
        return liveContextSnapshot.usedServiceIds
            .map((id) => {
                const service = servicesMap[id as keyof typeof servicesMap];
                if (!service) return null;
                const summary: BuilderServiceSummary = {
                    id: service.id,
                    name: service.name,
                    category: service.category,
                    rate: service.rate,
                    min: service.min,
                    max: service.max,
                    platformId: typeof service.platform_id === 'string' ? service.platform_id : undefined,
                    estimate: null,
                    flags: [],
                    attachmentCount: 0,
                    attachedNodeIds: [],
                    attachedNodeLabels: [],
                    active: false,
                };
                return buildServiceRowVM({
                    summary,
                    services: servicesMap,
                    check: checksById.get(String(service.id)),
                    state: liveContextState,
                });
            })
            .filter(Boolean);
    }, [checksById, liveContextSnapshot.usedServiceIds, liveContextState, servicesMap]);
    const serviceContextSystemData = useMemo(
        () => ({
            serviceContext: {
                selectedTagLabel: liveContextSnapshot.selectedTag?.label ?? 'No tag selected',
                selectedButtonsCount: selectedButtons.length,
                services: serviceContextRows.slice(0, 6).map((row: any) => ({
                    id: row.id,
                    name: row.summary.name,
                    rateLabel: row.summary.rate != null ? `Rate ${row.summary.rate}` : 'Rate n/a',
                    statusLabel: row.statusLabel,
                    reasonLabels: row.reasonLabels,
                })),
            },
        }),
        [liveContextSnapshot.selectedTag?.label, selectedButtons.length, serviceContextRows],
    );

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
            canEditGraph: canEditBranchContent,
            canWriteComments: canCommentWrite,
            onPermissionDenied: (reason, meta) => {
                emitPermissionDenied(reason, 'canvas-mutation', meta);
            },
            beforeConnect: (ctx) => {
                if (!canEditBranchContent) {
                    return {
                        ok: false,
                        reason: editDecision.reason ?? 'Editing is disabled for this actor.',
                    };
                }

                return options?.beforeConnect?.(ctx) ?? { ok: true };
            },
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
            systemNode: showOverlays
                ? {
                      enabled: true,
                      id: 'sys::service-context',
                      storageKey: `service-builder.canvas.system-node.service-context.${ws.info.id}.${ws.branches.currentId ?? 'none'}`,
                      defaultPosition: { x: 520, y: 64 },
                      data: serviceContextSystemData,
                  }
                : { enabled: false, storageKey: `service-builder.canvas.system-node.service-context.${ws.info.id}.${ws.branches.currentId ?? 'none'}`, data: serviceContextSystemData },
        }),
        [canCommentWrite, canEditBranchContent, edgeDecorators, editDecision.reason, emitPermissionDenied, nodeDecorators, options, serviceContextSystemData, showOverlays, ws.branches.currentId, ws.info.id],
    );

    const createAnchoredComment = useCallback(
        async (
            anchor:
                | { type: 'node'; nodeId: string; offset?: { dx: number; dy: number } }
                | { type: 'free'; position: { x: number; y: number } },
        ) => {
            if (!canCommentWrite) {
                emitPermissionDenied(commentWriteDecision.reason ?? 'Comment write access is disabled for this actor.', 'comment-create');
                return;
            }

            const res = await ws.comments.createThread({
                branchId: ws.branches.currentId,
                body: 'New canvas comment',
                anchor,
            });

            if ((res as any)?.ok === false) {
                const error = (res as any).error;
                emitPermissionDenied(error?.message ?? 'Failed to create comment thread.', 'comment-create');
                return;
            }

            const threadId = (res as any)?.value?.id;
            if (threadId) {
                canvas.api.selectComments?.(threadId);
                canvas.setActive(`c::${threadId}`);
            }
            setCommentPlacementActive(false);
        },
        [canCommentWrite, canvas, commentWriteDecision.reason, emitPermissionDenied, ws],
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
                commentPlacement={{
                    active: commentPlacementActive,
                    onPlaceOnNode: ({ nodeId, nodePosition, pointerPosition }) =>
                        createAnchoredComment({
                            type: 'node',
                            nodeId,
                            offset: {
                                dx: pointerPosition.x - nodePosition.x,
                                dy: pointerPosition.y - nodePosition.y,
                            },
                        }),
                    onPlaceOnCanvas: ({ pointerPosition }) =>
                        createAnchoredComment({
                            type: 'free',
                            position: pointerPosition,
                        }),
                    onCancel: () => setCommentPlacementActive(false),
                }}
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
                    if (nodeKind === 'comment' || nodeKind === 'service-context-system' || nodeId.startsWith('c::') || nodeId.startsWith('sys::')) {
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
                onEdgeContextMenu={({ edgeId, clientX, clientY, event }) => {
                    event.preventDefault();
                    const parsed = parseRelationEdgeId(edgeId);
                    if (!parsed) return;
                    openEdgeContextMenu({
                        edgeId,
                        kind: parsed.kind,
                        from: parsed.from,
                        to: parsed.to,
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
                        editDisabledReason={!canEditBranchContent ? (editDecision.reason ?? 'Editing is disabled for this actor.') : undefined}
                        publishDisabledReason={!canPublishBranch ? (publishDecision.reason ?? 'Publishing is disabled for this actor.') : undefined}
                        commentDisabledReason={!canCommentWrite ? (commentWriteDecision.reason ?? 'Comment write access is disabled for this actor.') : undefined}
                        errors={errors}
                        showErrorBadges={showErrorBadges}
                        setShowErrorBadges={setShowErrorBadges}
                        bottomPanelOpen={bottomPanel.isOpen}
                        onConsoleToggle={() => bottomPanel.toggle()}
                        canUndo={historyState.canUndo}
                        canRedo={historyState.canRedo}
                        canSave={canSave && ws.boot.isReady}
                        canPublish={canPublish && ws.boot.isReady}
                        canImport={canEditBranchContent}
                        canPlaceComment={canCommentWrite}
                        commentPlacementActive={commentPlacementActive}
                        onUndo={() => {
                            if (!historyState.canUndo) return;
                            canvas.api.editor.undo();
                        }}
                        onRedo={() => {
                            if (!historyState.canRedo) return;
                            canvas.api.editor.redo();
                        }}
                        onSave={async () => {
                            if (!canEditBranchContent) {
                                emitPermissionDenied(editDecision.reason ?? 'Editing is disabled for this actor.', 'snapshot-save');
                                return;
                            }
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
                            if (!canPublishBranch) {
                                emitPermissionDenied(publishDecision.reason ?? 'Publishing is disabled for this actor.', 'snapshot-publish');
                                return;
                            }
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
                        onImportProps={() => setActiveImportTarget('props')}
                        onImportCatalog={() => setActiveImportTarget('catalog')}
                        onToggleCommentPlacement={() => {
                            if (!canCommentWrite) {
                                emitPermissionDenied(commentWriteDecision.reason ?? 'Comment write access is disabled for this actor.', 'comment-placement-toggle');
                                return;
                            }
                            setCommentPlacementActive((current) => !current);
                        }}
                        noticesOpen={isNoticeManagerOpen}
                        onNoticesToggle={toggleNoticeManager}
                        pendingAction={actionPending}
                    />
                ) : null}

                <ImportJsonModal
                    open={activeImportTarget != null}
                    target={activeImportTarget}
                    onClose={() => setActiveImportTarget(null)}
                    onImportProps={importProps}
                    onImportCatalog={importCatalog}
                />

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
