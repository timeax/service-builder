import type { BottomConsolePanelState } from '@/builder/bottom-panel.ts';
import { CanvasOverlay, EmptyState } from '@/components/builder/index.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { getNodePropertyCapabilities } from '@/panels/right/partials/properties/components/node-capabilities.ts';
import { useCanvas, useWorkspace, type UseErrorsReturn } from '@timeax/digital-service-engine/workspace';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiEye, FiEyeOff, FiRotateCw, FiSave, FiTerminal } from 'react-icons/fi';
import { LuGitCommitHorizontal, LuHistory, LuRedo2, LuUndo2 } from 'react-icons/lu';
import { MdOutlineVisibility } from 'react-icons/md';
import type { AdapterOptions } from './adapter.ts';
import { FlowCanvas } from './flow-canvas.tsx';
import type { LabelPlacement, ToolbarOrientation, ToolsConfig } from './toolbar/types.ts';

type OverlayId = 'pulse' | 'focus' | 'comments';
type OverlayState = Record<OverlayId, { closed: boolean; minimized: boolean }>;

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
    const ws = useWorkspace();
    const canvasViewportRef = useRef<HTMLDivElement | null>(null);

    const [pendingServiceDrop, setPendingServiceDrop] = useState<{
        nodeId: string;
        serviceId: string;
        currentServiceId?: number | string;
        nodeLabel: string;
        x: number;
        y: number;
    } | null>(null);
    const [showErrorBadges, setShowErrorBadges] = useState(true);
    const [actionPending, setActionPending] = useState<'save' | 'publish' | null>(null);
    const [overlayState, setOverlayState] = useState<OverlayState>(() => loadOverlayState(storageKey(ws), OVERLAY_DEFAULTS));

    const freeThreads = useMemo(() => (ws.comments.threads.data ?? []).filter((thread) => thread.anchor?.type === 'free'), [ws.comments.threads.data]);
    const errorNodeIds = useMemo(() => new Set((errors.merged.validation ?? []).map((row) => row.nodeId).filter(Boolean) as string[]), [errors.merged.validation]);

    const stats = {
        tags: canvas.layers.tags.length,
        fields: canvas.layers.fields.length,
        comments: (ws.comments.threads.data ?? []).length,
    };

    useEffect(() => {
        setOverlayState(loadOverlayState(storageKey(ws), OVERLAY_DEFAULTS));
    }, [ws.info.id, ws.branches.currentId]);

    useEffect(() => {
        persistOverlayState(storageKey(ws), overlayState);
    }, [overlayState, ws]);

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
        if (draggingServiceId == null) setPendingServiceDrop(null);
    }, [draggingServiceId]);

    const nodeDecorators = useMemo<NonNullable<AdapterOptions['nodeDecorators']>>(
        () => (nodeId) => {
            const node = canvas.selector.getNode(nodeId);
            const canAssign = canAssignService(canvas, nodeId);
            const selected = canvas.selection.includes(nodeId) || canvas.activeId === nodeId;
            return {
                selected,
                data: {
                    hasError: errorNodeIds.has(nodeId),
                    showErrorBadge: showErrorBadges,
                    canAssignService: canAssign,
                    draggingService: !!draggingServiceId,
                    onServiceDrop: ({ nodeId: targetNodeId, serviceId, clientX, clientY }) => {
                        if (!canAssignService(canvas, targetNodeId)) return;
                        const targetNode = canvas.selector.getNode(targetNodeId);
                        setPendingServiceDrop({
                            nodeId: targetNodeId,
                            serviceId,
                            currentServiceId: getNodeServiceId(targetNode),
                            nodeLabel: getNodeLabel(targetNode) || 'this node',
                            ...getDropPopupPosition(canvasViewportRef.current, clientX, clientY),
                        });
                    },
                    node: {
                        id: node.id,
                        label: getNodeLabel(node),
                        kind: node.kind,
                    },
                },
            };
        },
        [canvas, draggingServiceId, errorNodeIds, showErrorBadges],
    );

    const edgeDecorators = useMemo<NonNullable<AdapterOptions['edgeDecorators']>>(
        () => (edgeId) => {
            const highlighted = canvas.api.snapshot().highlighted;
            const parsed = parseEdgeId(edgeId);
            const isHighlighted = parsed ? highlighted.has(parsed.from) || highlighted.has(parsed.to) : false;
            return {
                style: {
                    stroke: isHighlighted ? '#f59e0b' : '#64748b',
                    strokeWidth: isHighlighted ? 2.2 : 1.6,
                },
            };
        },
        [canvas.api],
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
        <div ref={canvasViewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(19,91,236,0.08),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(19,91,236,0.12),transparent_35%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
            <FlowCanvas
                tools={tools}
                showToolbar={showToolbar}
                labelPlacement={labelPlacement}
                initialShowGrid={initialShowGrid}
                initialShowMiniMap={initialShowMiniMap}
                toolbarOrientation={toolbarOrientation}
                persistToolbarOrientation={persistToolbarOrientation}
                options={mergedOptions}
                toolbarPositionClassName="left-4 top-4"
            >
                {showAppTools ? (
                    <AppToolbar
                        errors={errors}
                        showErrorBadges={showErrorBadges}
                        setShowErrorBadges={setShowErrorBadges}
                        bottomPanelOpen={bottomPanel.isOpen}
                        onConsoleToggle={() => bottomPanel.toggle()}
                        onUndo={() => canvas.api.undo()}
                        onRedo={() => canvas.api.editor.redo()}
                        onSave={async () => {
                            setActionPending('save');
                            try {
                                const res = await ws.snapshot.save('Canvas save');
                                if (!res.ok && 'error' in res) canvas.api.emit('error', { message: res.error.message, code: res.error.code, meta: res.error.meta });
                            } finally {
                                setActionPending(null);
                            }
                        }}
                        onPublish={async () => {
                            setActionPending('publish');
                            try {
                                const res = await ws.snapshot.publish('Canvas publish');
                                if (!res.ok && 'error' in res) canvas.api.emit('error', { message: res.error.message, code: res.error.code, meta: res.error.meta });
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

                {pendingServiceDrop ? (
                    <div
                        className="pointer-events-auto absolute z-20 w-72"
                        style={{
                            left: `${pendingServiceDrop.x}px`,
                            top: `${pendingServiceDrop.y}px`,
                        }}
                    >
                        <CanvasOverlay
                            title={pendingServiceDrop.currentServiceId != null ? 'Replace service on node' : 'Set service on node'}
                            description={`Assign service #${pendingServiceDrop.serviceId} to ${pendingServiceDrop.nodeLabel}.`}
                            className="border-slate-300 bg-white/95 shadow-2xl dark:border-slate-700 dark:bg-slate-950/95"
                        >
                            <div className="space-y-2">
                                <Button
                                    type="button"
                                    onClick={() => {
                                        canvas.api.editor.setService(pendingServiceDrop.nodeId, { service_id: Number(pendingServiceDrop.serviceId) });
                                        setPendingServiceDrop(null);
                                        onServiceDragStateChange(null);
                                    }}
                                    className="w-full justify-center rounded-xl"
                                >
                                    {pendingServiceDrop.currentServiceId != null ? 'Replace service' : 'Set service'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setPendingServiceDrop(null);
                                        onServiceDragStateChange(null);
                                    }}
                                    className="w-full justify-center rounded-xl"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </CanvasOverlay>
                    </div>
                ) : null}
            </FlowCanvas>

        </div>
    );
}

function AppToolbar({
    errors,
    bottomPanelOpen,
    onConsoleToggle,
    onUndo,
    onRedo,
    onSave,
    onPublish,
    onRelayout,
    showErrorBadges,
    setShowErrorBadges,
    pendingAction,
}: {
    errors: UseErrorsReturn;
    bottomPanelOpen: boolean;
    onConsoleToggle: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void | Promise<void>;
    onPublish: () => void | Promise<void>;
    onRelayout: () => void;
    showErrorBadges: boolean;
    setShowErrorBadges: (value: boolean) => void;
    pendingAction: 'save' | 'publish' | null;
}) {
    return (
        <div className="pointer-events-none absolute top-4 right-4 z-20 flex items-center gap-2">
            <div className="pointer-events-auto inline-flex items-center rounded-lg border border-slate-200 bg-white/95 shadow-md dark:border-slate-800 dark:bg-slate-950/95">
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-r-none" title="Save snapshot" onClick={onSave} disabled={pendingAction === 'save'}>
                    <FiSave />
                </Button>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-l-none" title="Publish commit" onClick={onPublish} disabled={pendingAction === 'publish'}>
                    <LuGitCommitHorizontal />
                </Button>
            </div>

            <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-0.5 shadow-md dark:border-slate-800 dark:bg-slate-950/95">
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Undo" onClick={onUndo}>
                    <LuUndo2 />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Redo" onClick={onRedo}>
                    <LuRedo2 />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Relayout (coming soon)" onClick={onRelayout}>
                    <LuHistory />
                </Button>
                <Button size="icon" variant="ghost" className={cn('h-8 w-8', showErrorBadges && 'text-blue-600')} title="Toggle error markers" onClick={() => setShowErrorBadges(!showErrorBadges)}>
                    {showErrorBadges ? <FiEye /> : <FiEyeOff />}
                </Button>
                <Button size="icon" variant="ghost" className={cn('relative h-8 w-8', bottomPanelOpen && 'text-blue-600')} title="Toggle console" onClick={onConsoleToggle}>
                    <FiTerminal />
                    {errors.merged.counts.total > 0 ? <span className="absolute top-1.5 right-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" /> : null}
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
    const toggleMinimized = (id: OverlayId) => setState((current) => ({ ...current, [id]: { ...current[id], minimized: !current[id].minimized, closed: false } }));
    const closeOverlay = (id: OverlayId) => setState((current) => ({ ...current, [id]: { ...current[id], closed: true } }));
    const restoreOverlay = (id: OverlayId) => setState((current) => ({ ...current, [id]: { minimized: false, closed: false } }));

    const closed = (Object.keys(state) as OverlayId[]).filter((id) => state[id].closed);

    return (
        <>
            <div className="pointer-events-none absolute top-4 right-56 z-20 flex flex-col gap-3">
                {!state.pulse.closed ? (
                    <OverlayCard title="Workspace pulse" minimized={state.pulse.minimized} onMinimize={() => toggleMinimized('pulse')} onClose={() => closeOverlay('pulse')}>
                        <div className="grid grid-cols-3 gap-2">
                            <Stat label="Tags" value={stats.tags} />
                            <Stat label="Fields" value={stats.fields} />
                            <Stat label="Comments" value={stats.comments} />
                        </div>
                    </OverlayCard>
                ) : null}
                {!state.focus.closed ? (
                    <OverlayCard title={activeId ? `Focused: ${activeId}` : 'Nothing focused'} minimized={state.focus.minimized} onMinimize={() => toggleMinimized('focus')} onClose={() => closeOverlay('focus')}>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <MdOutlineVisibility />
                            <span>{selectedCount} selected nodes</span>
                        </div>
                    </OverlayCard>
                ) : null}
                {!state.comments.closed ? (
                    <OverlayCard title="Free comments" minimized={state.comments.minimized} onMinimize={() => toggleMinimized('comments')} onClose={() => closeOverlay('comments')}>
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
                            <button type="button" className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100" onClick={onMinimize}>
                                {minimized ? 'Expand' : 'Minimize'}
                            </button>
                            <button type="button" className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100" onClick={onClose}>
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
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</div>
        </div>
    );
}

function canAssignService(canvas: ReturnType<typeof useCanvas>, nodeId: string) {
    const node = canvas.selector.getNode(nodeId);
    if (!node || (node.kind !== 'tag' && node.kind !== 'field' && node.kind !== 'option')) return false;
    return getNodePropertyCapabilities(node).service.canEdit;
}

function parseEdgeId(id: string): { from: string; to: string; kind: string } | null {
    const [kind, rest] = id.split(':');
    if (!kind || !rest) return null;
    const [from, to] = rest.split('->');
    if (!from || !to) return null;
    return { kind, from, to };
}

function getNodeLabel(node: unknown) {
    if (node && typeof node === 'object' && 'raw' in node && node.raw && typeof node.raw === 'object' && 'label' in node.raw) {
        return String((node.raw as { label?: string }).label ?? '');
    }
    if (node && typeof node === 'object' && 'id' in node) return String((node as { id?: string }).id ?? '');
    return '';
}

function getNodeServiceId(node: unknown) {
    if (node && typeof node === 'object' && 'raw' in node && node.raw && typeof node.raw === 'object' && 'service_id' in node.raw) {
        return (node.raw as { service_id?: number | string }).service_id;
    }
    return undefined;
}

function getDropPopupPosition(container: HTMLDivElement | null, clientX: number, clientY: number) {
    const fallback = { x: 24, y: 24 };
    if (!container) return fallback;

    const rect = container.getBoundingClientRect();
    const width = 288;
    const height = 176;
    const margin = 16;
    const offset = 12;

    return {
        x: clamp(clientX - rect.left + offset, margin, Math.max(margin, rect.width - width - margin)),
        y: clamp(clientY - rect.top + offset, margin, Math.max(margin, rect.height - height - margin)),
    };
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function storageKey(ws: ReturnType<typeof useWorkspace>) {
    return `service-builder.canvas.overlays.${ws.info.id}.${ws.branches.currentId ?? 'none'}`;
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

function restoreAllOverlays(): OverlayState {
    return {
        pulse: { closed: false, minimized: false },
        focus: { closed: false, minimized: false },
        comments: { closed: false, minimized: false },
    };
}
