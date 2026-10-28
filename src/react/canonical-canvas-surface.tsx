// SPDX-License-Identifier: GPL-3.0-only
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { AppToolbar } from '@/panels/canvas/app-toolbar.tsx';
import { walkOptions } from '@elqora/dgp-core';
import { edgeTypes, nodeTypes } from '@/panels/canvas/reactflow';
import { Icons } from '@/panels/canvas/toolbar/icons.tsx';
import { toolbarIconButtonClass, toolbarSurfaceClass } from '@/panels/canvas/toolbar/styles.ts';
import type { CanvasAPI } from '@elqora/dgp-workspace';
import type { ProductDefinition } from '@elqora/dgp-spec';
import type { ServiceCatalogState } from '@elqora/dgp-workspace';
import { Background, ConnectionMode, MiniMap, ReactFlow, useReactFlow, type Edge, type Node, type OnNodesChange, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuPanelBottom, LuPanelRight } from 'react-icons/lu';
import { createCanonicalBootModel, getCanonicalBootActionReason } from './boot';
import type { CanonicalBottomPanelController } from './canonical-bottom-panel';
import { CanonicalImportJsonModal, type ImportTarget } from './canonical-import-json-modal';
import { useCanonicalReactFlowAdapter } from './canonical-flow-adapter';
import { CanonicalHistoryPanel } from './canonical-history';
import { canonicalAuthoringDescriptor } from './canonical-input-registry';
import { CanonicalNoticeManager, type NoticeManagerRequest } from './canonical-notice-manager';
import { useOptionalCanonicalNodeContextMenu } from './canonical-node-context-menu';
import { buildCanonicalCanvasServiceContext } from './canonical-service-context';
import { acceptsCanonicalCanvasDrop, DRAG_MIME_SERVICE, readCanonicalAssetDrag } from './drag-contracts';
import { useServiceContextPosition } from './service-context-position';
import { useCanvasAPI, useCanvasSelector, useWorkspacePermission, useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

const SERVICE_CONTEXT_NODE_ID = 'sys::service-context';

function hasPersistedViewport(viewport: { x: number; y: number; zoom: number }) {
    return Math.abs(viewport.x) > 0.5 || Math.abs(viewport.y) > 0.5 || Math.abs(viewport.zoom - 1) > 1e-4;
}

function InitialFitController({ enabled, nodeIds }: { enabled: boolean; nodeIds: string[] }) {
    const flow = useReactFlow();
    const didFit = useRef(false);
    useEffect(() => {
        if (!enabled || didFit.current || nodeIds.length === 0) return;
        const frame = requestAnimationFrame(() => {
            didFit.current = true;
            void flow.fitView({ nodes: nodeIds.map((id) => ({ id })), padding: 0.08, maxZoom: 1 });
        });
        return () => cancelAnimationFrame(frame);
    }, [enabled, flow, nodeIds]);
    return null;
}

export interface CanonicalCanvasSurfaceProps {
    bottom_panel?: CanonicalBottomPanelController;
    on_node_drop?: (payload: {
        node_id: string;
        node_kind: 'filter' | 'field' | 'option';
        client_x: number;
        client_y: number;
        data_transfer: DataTransfer;
    }) => boolean;
    on_node_context_menu?: (payload: {
        node_id: string;
        node_kind: 'filter' | 'field' | 'option' | 'comment';
        client_x: number;
        client_y: number;
        event: React.MouseEvent;
    }) => void;
}

type EditableEdgeKind = 'bind' | 'include' | 'exclude';

export interface CanonicalEdgeMenuProps {
    relation: { kind: EditableEdgeKind; from: string; to: string };
    position: { x: number; y: number };
    can_edit: boolean;
    disabled_reason?: string;
    on_change(kind: EditableEdgeKind): void;
    on_disconnect(): void;
}

export function CanonicalEdgeMenu({ relation, position, can_edit, disabled_reason, on_change, on_disconnect }: CanonicalEdgeMenuProps) {
    const actionTitle = can_edit ? undefined : disabled_reason ?? 'Editing is disabled for this actor.';
    return (
        <div
            role="menu"
            className="fixed z-40 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
            style={{ left: position.x, top: position.y }}
        >
            <p className="px-3 py-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">{relation.kind} relationship</p>
            {(['bind', 'include', 'exclude'] as const)
                .filter((kind) => kind !== relation.kind)
                .map((kind) => (
                    <button
                        key={kind}
                        type="button"
                        disabled={!can_edit}
                        title={actionTitle}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-900"
                        onClick={() => on_change(kind)}
                    >
                        Change to {kind}
                    </button>
                ))}
            <button
                type="button"
                disabled={!can_edit}
                title={actionTitle}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-300"
                onClick={on_disconnect}
            >
                Disconnect
            </button>
        </div>
    );
}

function CanvasToolbar({
    showGrid,
    setShowGrid,
    showMiniMap,
    setShowMiniMap,
    showBind,
    setShowBind,
    showInclude,
    setShowInclude,
    showExclude,
    setShowExclude,
    showComments,
    setShowComments,
    showServiceContext,
    setShowServiceContext,
}: {
    showGrid: boolean;
    setShowGrid(value: boolean): void;
    showMiniMap: boolean;
    setShowMiniMap(value: boolean): void;
    showBind: boolean;
    setShowBind(value: boolean): void;
    showInclude: boolean;
    setShowInclude(value: boolean): void;
    showExclude: boolean;
    setShowExclude(value: boolean): void;
    showComments: boolean;
    setShowComments(value: boolean): void;
    showServiceContext: boolean;
    setShowServiceContext(value: boolean): void;
}) {
    const api = useCanvasAPI()!;
    const flow = useReactFlow();
    const [relation, setRelation] = useState(api.get_edge_mode());
    const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
    useEffect(() => api.on('edge:change', setRelation), [api]);
    const relationButton = (kind: 'bind' | 'include' | 'exclude', label: string, icon: React.ReactNode) => (
        <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={label}
            title={label}
            data-active={relation === kind || undefined}
            className={toolbarIconButtonClass(relation === kind)}
            onClick={() => api.set_edge_mode(kind)}
        >
            {icon}
        </Button>
    );
    return (
        <div className="pointer-events-none absolute top-4 left-4 z-20">
            <div className={orientation === 'horizontal' ? 'flex items-center gap-2' : 'grid gap-2'}>
                <div className={toolbarSurfaceClass(orientation === 'vertical' ? 'flex flex-col items-stretch' : undefined)}>
                    {relationButton('bind', 'Bind', Icons.bind(relation === 'bind'))}
                    {relationButton('include', 'Include', Icons.include(relation === 'include'))}
                    {relationButton('exclude', 'Exclude', Icons.exclude(relation === 'exclude'))}
                </div>
                <Popover>
                    <div className={toolbarSurfaceClass()}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Canvas view"
                                title="Canvas view"
                                className={toolbarIconButtonClass()}
                            >
                                {Icons.visibilityMenu(false)}
                            </Button>
                        </PopoverTrigger>
                    </div>
                    <PopoverContent align="start" className="w-52 space-y-1 p-2">
                        <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setShowGrid(!showGrid)}
                        >
                            Grid <span>{showGrid ? 'On' : 'Off'}</span>
                        </button>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setShowMiniMap(!showMiniMap)}
                        >
                            Mini map <span>{showMiniMap ? 'On' : 'Off'}</span>
                        </button>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setShowBind(!showBind)}
                        >
                            Bind edges <span>{showBind ? 'On' : 'Off'}</span>
                        </button>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setShowInclude(!showInclude)}
                        >
                            Include edges <span>{showInclude ? 'On' : 'Off'}</span>
                        </button>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setShowExclude(!showExclude)}
                        >
                            Exclude edges <span>{showExclude ? 'On' : 'Off'}</span>
                        </button>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setShowComments(!showComments)}
                        >
                            Comments <span>{showComments ? 'On' : 'Off'}</span>
                        </button>
                        <button
                            type="button"
                            aria-pressed={showServiceContext}
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setShowServiceContext(!showServiceContext)}
                        >
                            Service context <span>{showServiceContext ? 'On' : 'Off'}</span>
                        </button>
                        <button
                            type="button"
                            className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => void flow.fitView()}
                        >
                            Fit view
                        </button>
                    </PopoverContent>
                </Popover>
                <div className={toolbarSurfaceClass()}>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setOrientation((current) => (current === 'horizontal' ? 'vertical' : 'horizontal'))}
                        aria-label={orientation === 'horizontal' ? 'Switch to vertical toolbar' : 'Switch to horizontal toolbar'}
                        className={toolbarIconButtonClass()}
                        title={orientation === 'horizontal' ? 'Switch to vertical toolbar' : 'Switch to horizontal toolbar'}
                    >
                        {orientation === 'horizontal' ? <LuPanelRight /> : <LuPanelBottom />}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function CanonicalCanvasSurface({ on_node_context_menu, on_node_drop, bottom_panel }: CanonicalCanvasSurfaceProps) {
    const api = useCanvasAPI();
    if (api === undefined) return null;
    return <CanonicalCanvasReady api={api} on_node_context_menu={on_node_context_menu} on_node_drop={on_node_drop} bottom_panel={bottom_panel} />;
}

function CanonicalCanvasReady({ api, on_node_context_menu, on_node_drop, bottom_panel }: CanonicalCanvasSurfaceProps & { api: CanvasAPI }) {
    const runtime = useWorkspaceRuntime();
    const contextMenu = useOptionalCanonicalNodeContextMenu();
    const canEdit = useWorkspacePermission('document.mutate');
    const canSave = useWorkspacePermission('draft.save');
    const canPublish = useWorkspacePermission('publish');
    const canComment = useWorkspacePermission('comment.write');
    const workspaceState = useWorkspaceSelector((state) => state);
    const boot = useMemo(() => createCanonicalBootModel(workspaceState, runtime), [runtime, workspaceState]);
    const workspaceId = useWorkspaceSelector((state) => state.workspace_id);
    const branchId = useWorkspaceSelector((state) => state.current_branch_id);
    const selectionKey = useCanvasSelector((state) => `${[...state.selection].sort().join('\u0000')}\u0001${api.selection.primary() ?? ''}`, '\u0001');
    const [showGrid, setShowGrid] = useState(true);
    const [showMiniMap, setShowMiniMap] = useState(false);
    const [showBind, setShowBind] = useState(true);
    const [showInclude, setShowInclude] = useState(true);
    const [showExclude, setShowExclude] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showServiceContext, setShowServiceContext] = useState(true);
    const [showErrorBadges, setShowErrorBadges] = useState(true);
    const [localNoticeRequest, setLocalNoticeRequest] = useState<NoticeManagerRequest | null>(null);
    const localNoticeToken = useRef(0);
    const noticesOpen = contextMenu?.is_notice_manager_open ?? localNoticeRequest !== null;
    const [historyOpen, setHistoryOpen] = useState(false);
    const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
    const [commentPlacementActive, setCommentPlacementActive] = useState(false);
    const [pendingAction, setPendingAction] = useState<'save' | 'publish' | null>(null);
    const [actionError, setActionError] = useState<{ action: 'save' | 'publish'; code: string; message: string } | null>(null);
    const [dropError, setDropError] = useState<string | null>(null);
    const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [edgeMenu, setEdgeMenu] = useState<{ edge: Edge; x: number; y: number } | null>(null);
    const serviceContextStorageKey = `service-builder.canvas.system-node.service-context.${workspaceId ?? 'none'}.${branchId ?? 'none'}`;
    const { position: serviceContextPosition, onPositionChange: onServiceContextPositionChange, onDragStop: onServiceContextDragStop } = useServiceContextPosition(serviceContextStorageKey);
    const [serviceContextSelected, setServiceContextSelected] = useState(false);
    const adapter = useCanonicalReactFlowAdapter(api, { can_edit: canEdit, snap_to_grid: false, comments_revision: workspaceState.comments, scope_key: serviceContextStorageKey });
    const initialViewport = useMemo(() => api.get_viewport(), [api]);
    const fitNodeIds = useMemo(() => adapter.nodes.map((node) => node.id), [adapter.nodes]);
    const serviceContext = useMemo(() => {
        const definition = workspaceState.definition;
        const selectedPart = selectionKey.split('\u0001')[0] ?? '';
        const selectedIds = selectedPart ? selectedPart.split('\u0000') : [];
        const optionIds = new Set(definition ? walkOptions(definition).map((visit) => visit.optionId) : []);
        const buttonFieldIds = new Set(definition?.fields.filter((field) => field.button === true).map((field) => field.id) ?? []);
        const selectedTriggers = selectedIds.filter((id) => optionIds.has(id) || buttonFieldIds.has(id));
        const filterId = api.selection.current_filter() ?? definition?.filters[0]?.id;
        return buildCanonicalCanvasServiceContext(definition, workspaceState.services, filterId, selectedTriggers);
    }, [api, selectionKey, workspaceState.definition, workspaceState.services]);
    const onCanvasNodesChange: OnNodesChange = useCallback((changes) => {
        for (const change of changes) {
            if (!('id' in change) || change.id !== SERVICE_CONTEXT_NODE_ID) continue;
            if (change.type === 'position' && change.position !== undefined) {
                onServiceContextPositionChange(change.position, change.dragging);
            } else if (change.type === 'select') setServiceContextSelected(change.selected);
        }
        const documentChanges = changes.filter((change) => !('id' in change) || change.id !== SERVICE_CONTEXT_NODE_ID);
        if (documentChanges.length) adapter.onNodesChange(documentChanges);
    }, [adapter, onServiceContextPositionChange]);
    const onCanvasNodeDragStop: NonNullable<React.ComponentProps<typeof ReactFlow>['onNodeDragStop']> = useCallback((event, node, nodes) => {
        adapter.onNodeDragStop(event, node, nodes);
        onServiceContextDragStop(nodes.find((candidate) => candidate.id === SERVICE_CONTEXT_NODE_ID)?.position);
    }, [adapter, onServiceContextDragStop]);
    const edges = useMemo(
        () =>
            adapter.edges.filter((edge) => {
                const kind = (edge.data?.edge as { kind?: string } | undefined)?.kind;
                if (kind === 'bind') return showBind;
                if (kind === 'include') return showInclude;
                if (kind === 'exclude') return showExclude;
                return true;
            }),
        [adapter.edges, showBind, showExclude, showInclude],
    );
    const createDraggedField = useCallback((dataTransfer: DataTransfer, bindId?: string, position?: { x: number; y: number }) => {
        if (!canEdit) return;
        const asset = readCanonicalAssetDrag(dataTransfer);
        if (!asset) return;
        let id: string;
        if (asset.kind === 'template') {
            const result = runtime.instantiate_template(asset.template_id, bindId === undefined ? undefined : { bind_id: bindId });
            if (result.ok === false) {
                setDropError(result.error.message);
                return;
            }
            id = result.value.root_id;
        } else {
            id = api.editor.add_field_from_descriptor(canonicalAuthoringDescriptor(asset.field_type, asset.variant), { label: asset.label, bind_id: bindId });
        }
        if (position) api.editor.place_node(id, position.x, position.y);
        api.select([id], id);
    }, [api, canEdit, runtime]);
    const canvasNodes = useMemo(
        () =>
            adapter.nodes
                .filter((node) => showComments || node.type !== 'comment')
                .map((node) => ({
                    ...node,
                    data: {
                        ...node.data,
                        canAcceptDropPayload: acceptsCanonicalCanvasDrop,
                        onToggleResolved: node.type === 'comment' && canComment ? () => {
                            const thread = node.data.thread as { id: string; resolved: boolean };
                            api.comments.resolve(thread.id, !thread.resolved);
                        } : undefined,
                        onNodeDrop: ({ nodeId, clientX, clientY, dataTransfer }: { nodeId: string; clientX: number; clientY: number; dataTransfer: DataTransfer }) => {
                            if (!canEdit) return;
                            const indexed = api.editor.get_node(nodeId);
                            const nodeKind = indexed.kind === 'filter' || indexed.kind === 'field' || indexed.kind === 'option' ? indexed.kind : undefined;
                            if (nodeKind && on_node_drop?.({ node_id: nodeId, node_kind: nodeKind, client_x: clientX, client_y: clientY, data_transfer: dataTransfer })) return;
                            const service = dataTransfer.getData(DRAG_MIME_SERVICE);
                            if (service) {
                                api.editor.set_service(nodeId, service);
                                return;
                            }
                            if (indexed.kind === 'filter') createDraggedField(dataTransfer, indexed.id);
                            else if (indexed.kind === 'field') {
                                const asset = readCanonicalAssetDrag(dataTransfer);
                                if (asset?.kind === 'builtin') api.editor.update_field(indexed.id, { type: asset.field_type });
                            }
                        },
                    },
                })),
        [adapter.nodes, api, canComment, canEdit, createDraggedField, on_node_drop, showComments],
    );
    const edgeRelation = edgeMenu?.edge.data?.edge as { kind?: 'bind' | 'include' | 'exclude'; from?: string; to?: string } | undefined;

    return (
        <div className="relative h-full w-full" data-workspace={workspaceId ?? undefined} data-branch={branchId ?? undefined}>
            <ReactFlow
                nodes={[...canvasNodes, ...(showServiceContext ? [{ id: SERVICE_CONTEXT_NODE_ID, type: 'serviceContextSystem', data: { serviceContext }, position: serviceContextPosition, selected: serviceContextSelected, draggable: true, selectable: true }] : [])] as Node[]}
                edges={edges}
                defaultViewport={initialViewport}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                onNodesChange={onCanvasNodesChange}
                onNodeDragStop={onCanvasNodeDragStop}
                onEdgesChange={adapter.onEdgesChange}
                onConnectStart={adapter.onConnectStart}
                onConnectEnd={adapter.onConnectEnd}
                onConnect={adapter.onConnect}
                onMoveEnd={adapter.onMoveEnd}
                isValidConnection={adapter.isValidConnection}
                snapToGrid={adapter.snap_to_grid}
                snapGrid={adapter.snap_grid}
                nodesDraggable={canEdit}
                nodesConnectable={canEdit}
                className="bg-transparent!"
                onInit={setFlowInstance}
                onPaneClick={(event) => {
                    if (!commentPlacementActive || !canComment || flowInstance === null) return;
                    const position = flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                    const thread = api.comments.create(`canvas@${position.x},${position.y}`, 'New canvas comment');
                    api.select_comment(thread.id);
                    setCommentPlacementActive(false);
                }}
                onNodeContextMenu={(event, node) => {
                    const kind =
                        node.type === 'tag'
                            ? 'filter'
                            : node.type === 'field' || node.type === 'option' || node.type === 'comment'
                              ? node.type
                              : undefined;
                    if (kind === undefined) return;
                    on_node_context_menu?.({ node_id: node.id, node_kind: kind, client_x: event.clientX, client_y: event.clientY, event });
                }}
                onEdgeContextMenu={(event, edge) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEdgeMenu({ edge, x: event.clientX, y: event.clientY });
                }}
                onPaneContextMenu={() => setEdgeMenu(null)}
                onDragOver={(event) => {
                    if (!acceptsCanonicalCanvasDrop(event.dataTransfer)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(event) => {
                    if (!acceptsCanonicalCanvasDrop(event.dataTransfer) || flowInstance === null) return;
                    event.preventDefault();
                    const projected = flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                    const position = Number.isFinite(projected.x) && Number.isFinite(projected.y)
                        ? projected
                        : { x: event.clientX, y: event.clientY };
                    createDraggedField(event.dataTransfer, undefined, position);
                }}
            >
                <InitialFitController enabled={!hasPersistedViewport(initialViewport)} nodeIds={fitNodeIds} />
                {showGrid ? <Background gap={18} size={1} /> : null}
                {showMiniMap ? <MiniMap position="bottom-right" pannable zoomable /> : null}
                <CanvasToolbar
                    showGrid={showGrid}
                    setShowGrid={setShowGrid}
                    showMiniMap={showMiniMap}
                    setShowMiniMap={setShowMiniMap}
                    showBind={showBind}
                    setShowBind={setShowBind}
                    showInclude={showInclude}
                    setShowInclude={setShowInclude}
                    showExclude={showExclude}
                    setShowExclude={setShowExclude}
                    showComments={showComments}
                    setShowComments={setShowComments}
                    showServiceContext={showServiceContext}
                    setShowServiceContext={setShowServiceContext}
                />
                <AppToolbar
                    bootActionReason={getCanonicalBootActionReason(boot)}
                    editDisabledReason="Editing is disabled for this actor."
                    publishDisabledReason="Publishing is disabled for this actor."
                    commentDisabledReason="Comment write access is disabled for this actor."
                    errors={{ merged: { counts: { total: (workspaceState.validation?.protocol.diagnostics.length ?? 0) + (workspaceState.validation?.policyDiagnostics.length ?? 0) } } }}
                    bottomPanelOpen={bottom_panel?.isOpen ?? false}
                    onConsoleToggle={() => bottom_panel?.toggle()}
                    canUndo={api.editor.can_undo()}
                    canRedo={api.editor.can_redo()}
                    canSave={canSave && boot.is_ready}
                    canPublish={canPublish && boot.is_ready}
                    canImport={canEdit}
                    canPlaceComment={canComment}
                    commentPlacementActive={commentPlacementActive}
                    onUndo={() => api.editor.undo()}
                    onRedo={() => api.editor.redo()}
                    onSave={async () => {
                        setPendingAction('save');
                        setActionError(null);
                        try {
                            const result = await runtime.autosave();
                            if (result.ok === false) setActionError({ action: 'save', code: result.error.code, message: result.error.message });
                        } catch (error) {
                            setActionError({ action: 'save', code: 'unexpected', message: error instanceof Error ? error.message : 'Save failed.' });
                        } finally {
                            setPendingAction(null);
                        }
                    }}
                    onPublish={async () => {
                        setPendingAction('publish');
                        setActionError(null);
                        try {
                            const result = await runtime.publish('Published from Service Builder');
                            if (result.ok === false) setActionError({ action: 'publish', code: result.error.code, message: result.error.message });
                        } catch (error) {
                            setActionError({ action: 'publish', code: 'unexpected', message: error instanceof Error ? error.message : 'Publication failed.' });
                        } finally {
                            setPendingAction(null);
                        }
                    }}
                    onRelayout={() => void flowInstance?.fitView()}
                    historyOpen={historyOpen}
                    onHistoryToggle={() => {
                        setHistoryOpen((open) => !open);
                        if (contextMenu?.is_notice_manager_open) contextMenu.toggle_notice_manager();
                        setLocalNoticeRequest(null);
                    }}
                    onImportProps={() => setImportTarget('props')}
                    onImportCatalog={() => setImportTarget('catalog')}
                    onToggleCommentPlacement={() => setCommentPlacementActive((active) => !active)}
                    noticesOpen={noticesOpen}
                    onNoticesToggle={() => {
                        if (contextMenu) contextMenu.toggle_notice_manager();
                        else setLocalNoticeRequest((current) => current ? null : { mode: 'manage', token: ++localNoticeToken.current });
                        setHistoryOpen(false);
                    }}
                    showErrorBadges={showErrorBadges}
                    setShowErrorBadges={setShowErrorBadges}
                    pendingAction={pendingAction}
                />
                {historyOpen ? <CanonicalHistoryPanel onClose={() => setHistoryOpen(false)} /> : null}
            </ReactFlow>
            {!contextMenu ? <CanonicalNoticeManager request={localNoticeRequest} onClose={() => setLocalNoticeRequest(null)} /> : null}
            {actionError ? (
                <div role="alert" className="pointer-events-auto absolute top-16 left-4 z-30 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-rose-200 bg-white/95 p-3 text-sm text-rose-800 shadow-2xl backdrop-blur dark:border-rose-500/30 dark:bg-slate-950/95 dark:text-rose-200">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-semibold">{actionError.action === 'save' ? 'Save failed' : 'Publication failed'}</p>
                            <p className="mt-1">{actionError.message}</p>
                        </div>
                        <button type="button" className="text-xs font-medium hover:underline" onClick={() => setActionError(null)}>Dismiss</button>
                    </div>
                    {actionError.code === 'publication_validation_failed' && bottom_panel ? (
                        <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => bottom_panel.open('console')}>Review diagnostics</button>
                    ) : null}
                </div>
            ) : null}
            {dropError ? (
                <div role="alert" className="pointer-events-auto absolute top-16 right-4 z-30 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-amber-200 bg-white/95 p-3 text-sm text-amber-900 shadow-2xl dark:border-amber-500/30 dark:bg-slate-950/95 dark:text-amber-200">
                    <div className="flex items-start justify-between gap-3"><p>{dropError}</p><button type="button" className="text-xs font-medium underline" onClick={() => setDropError(null)}>Dismiss</button></div>
                </div>
            ) : null}
            <CanonicalImportJsonModal
                open={importTarget !== null}
                target={importTarget}
                currentDefinition={workspaceState.definition}
                currentCatalog={api.editor.get_catalog()}
                onClose={() => setImportTarget(null)}
                onImportProps={(definition: ProductDefinition) => {
                    const result = runtime.replace(definition);
                    if (result.ok === false) throw new Error(result.error.message);
                }}
                onImportCatalog={(catalog: ServiceCatalogState) => api.editor.set_catalog(catalog)}
            />
            {edgeMenu && edgeRelation?.kind && edgeRelation.from && edgeRelation.to ? (
                <CanonicalEdgeMenu
                    relation={{ kind: edgeRelation.kind, from: edgeRelation.from, to: edgeRelation.to }}
                    position={{ x: edgeMenu.x, y: edgeMenu.y }}
                    can_edit={canEdit}
                    disabled_reason="Editing is disabled for this actor."
                    on_change={(kind) => {
                        api.editor.disconnect(edgeRelation.kind!, edgeRelation.from!, edgeRelation.to!);
                        api.editor.connect(kind, edgeRelation.from!, edgeRelation.to!);
                        setEdgeMenu(null);
                    }}
                    on_disconnect={() => {
                        api.editor.disconnect(edgeRelation.kind!, edgeRelation.from!, edgeRelation.to!);
                        setEdgeMenu(null);
                    }}
                />
            ) : null}
        </div>
    );
}
