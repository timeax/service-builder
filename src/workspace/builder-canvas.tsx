import {
    BuilderIconButton,
    CanvasOverlay,
    EmptyState,
    NodeCard,
    NodePill,
    StatusDot,
    ToolbarGroup,
} from '@/components/builder/index.tsx';
import { buildServiceSummaries, useBottomConsolePanel } from '@/builder/bottom-panel.ts';
import { buildCanvasNodeViewModels, getServiceDetails } from '@/builder/view-models.tsx';
import { getNodePropertyCapabilities } from '@/panels/right/partials/properties/components/node-capabilities.ts';
import { useCanvas, useErrors, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { BsChatSquareQuote } from 'react-icons/bs';
import { FiCrosshair, FiTerminal } from 'react-icons/fi';
import { LuLayoutGrid, LuMousePointer2, LuPlus } from 'react-icons/lu';
import { MdOutlineFitScreen, MdOutlineVisibility } from 'react-icons/md';
import { BottomConsolePanel } from './bottom-console-panel.tsx';

const SERVICE_DRAG_MIME = 'application/x-service-builder-service';

function FieldCardDetails({ nodeId }: { nodeId: string }) {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const node = canvas.selector.getNode(nodeId);

    if (node.kind === 'tag') {
        const service = getServiceDetails(ws, node.raw.service_id);
        return (
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{node.getDescendants().length} fields inside</span>
                <span>{service?.name ?? 'No service linked'}</span>
            </div>
        );
    }

    if (node.kind === 'field') {
        return (
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="capitalize">{node.raw.type}</span>
                <span>{node.raw.options?.length ? `${node.raw.options.length} options` : 'Single input'}</span>
            </div>
        );
    }

    if (node.kind === 'option') {
        const service = getServiceDetails(ws, node.raw.service_id);
        return (
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Child of {node.field().raw.label}</span>
                <span>{service?.name ?? 'No service'}</span>
            </div>
        );
    }

    return null;
}

export default function BuilderCanvas() {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const errors = useErrors();
    const bottomPanel = useBottomConsolePanel();
    const [draggingServiceId, setDraggingServiceId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
    const [pendingServiceDrop, setPendingServiceDrop] = useState<{
        nodeId: string;
        serviceId: string;
        x: number;
        y: number;
        currentServiceId?: number | string;
    } | null>(null);

    const nodes = useMemo(() => buildCanvasNodeViewModels(canvas, ws.comments.threads.data ?? []), [canvas.graph, canvas.activeId, canvas.selection, ws.comments.threads.data]);
    const freeThreads = (ws.comments.threads.data ?? []).filter((thread) => thread.anchor?.type === 'free');
    const serviceSummary = useMemo(() => buildServiceSummaries(canvas, ws), [canvas.graph, canvas.selectionInfo, canvas.activeId, ws.services.data]);

    const stats = {
        tags: canvas.layers.tags.length,
        fields: canvas.layers.fields.length,
        comments: (ws.comments.threads.data ?? []).length,
    };

    useEffect(() => {
        const off = canvas.api.on('state:change', (snap: { highlighted?: ReadonlySet<string> }) => {
            setHighlightedIds(new Set(Array.from(snap.highlighted ?? [])));
        });
        return () => off?.();
    }, [canvas.api]);

    if (!nodes.length) {
        return (
            <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(19,91,236,0.08),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(19,91,236,0.12),_transparent_35%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
                <div className="m-auto w-full max-w-xl px-6">
                    <EmptyState
                        title="Your service map is ready for components"
                        description="Add a tag or field from the left panel and the canvas will materialize the connected nodes, comments, and preview flow here."
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(19,91,236,0.08),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(19,91,236,0.12),_transparent_35%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.13)_1px,transparent_1px)] bg-[size:32px_32px]" />

            <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
                <ToolbarGroup>
                    <BuilderIconButton title="Create">
                        <LuPlus />
                    </BuilderIconButton>
                    <BuilderIconButton active title="Select">
                        <LuMousePointer2 />
                    </BuilderIconButton>
                    <BuilderIconButton title="Inspect">
                        <FiCrosshair />
                    </BuilderIconButton>
                    <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-800" />
                    <BuilderIconButton title="Layout">
                        <LuLayoutGrid />
                    </BuilderIconButton>
                    <BuilderIconButton title="Fit">
                        <MdOutlineFitScreen />
                    </BuilderIconButton>
                    <BuilderIconButton active={bottomPanel.isOpen} title={`Toggle console (${bottomPanel.shortcutLabel})`} onClick={() => bottomPanel.toggle()}>
                        <div className="relative">
                            <FiTerminal />
                            {errors.merged.counts.total ? (
                                <span className="absolute -top-1.5 -right-2 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
                                    {errors.merged.counts.total}
                                </span>
                            ) : null}
                        </div>
                    </BuilderIconButton>
                </ToolbarGroup>
            </div>

            <div className="absolute top-5 right-5 z-20 flex w-72 flex-col gap-3">
                <CanvasOverlay title="Workspace pulse" description="Live summary of the active builder branch.">
                    <div className="grid grid-cols-3 gap-2">
                        <StatCard label="Tags" value={stats.tags} tone="default" />
                        <StatCard label="Fields" value={stats.fields} tone="success" />
                        <StatCard label="Comments" value={stats.comments} tone="warning" />
                    </div>
                </CanvasOverlay>

                <CanvasOverlay
                    title={canvas.activeId ? `Focused: ${canvas.selector.getNode(canvas.activeId).id}` : 'Nothing focused'}
                    description={canvas.activeId ? 'Selection in the layers panel, canvas, and inspector stays synced.' : 'Click any node to inspect it.'}
                >
                    {canvas.activeId ? (
                        <div className="space-y-2">
                            <NodePill
                                view={{
                                    nodeId: canvas.activeId,
                                    kind: canvas.selector.getNode(canvas.activeId).kind as any,
                                    label: canvas.selector.getNode(canvas.activeId).id,
                                    selected: true,
                                    active: true,
                                }}
                            />
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <MdOutlineVisibility />
                                <span>{canvas.selectionInfo.ids.length} selected nodes</span>
                            </div>
                        </div>
                    ) : null}
                </CanvasOverlay>
            </div>

            <div className="relative h-full min-h-0 overflow-auto px-8 pt-20 pb-8">
                <div className="relative mx-auto min-h-[900px] min-w-[960px]">
                    {nodes.map((node) => (
                        <div
                            key={node.nodeId}
                            className="absolute"
                            style={{
                                left: `${node.x}px`,
                                top: `${node.y}px`,
                                width: `${node.width ?? 220}px`,
                            }}
                            onDragOver={(event) => {
                                if (!canAssignService(canvas, node.nodeId)) return;
                                if (!event.dataTransfer.types.includes(SERVICE_DRAG_MIME)) return;
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'copy';
                                setDropTargetId(node.nodeId);
                            }}
                            onDragLeave={() => {
                                if (dropTargetId === node.nodeId) setDropTargetId(null);
                            }}
                            onDrop={(event) => {
                                const serviceId = event.dataTransfer.getData(SERVICE_DRAG_MIME);
                                setDraggingServiceId(null);
                                setDropTargetId(null);
                                if (!serviceId || !canAssignService(canvas, node.nodeId)) return;
                                event.preventDefault();
                                const target = canvas.selector.getNode(node.nodeId);
                                setPendingServiceDrop({
                                    nodeId: node.nodeId,
                                    serviceId,
                                    x: node.x + (node.width ?? 220) + 16,
                                    y: node.y,
                                    currentServiceId: getNodeServiceId(target),
                                });
                            }}
                        >
                            <NodeCard
                                view={node}
                                className={
                                    highlightedIds.has(node.nodeId)
                                        ? 'border-amber-300 ring-2 ring-amber-200 dark:border-amber-500/50 dark:ring-amber-500/20'
                                        : dropTargetId === node.nodeId
                                          ? 'border-emerald-300 ring-2 ring-emerald-200 dark:border-emerald-500/50 dark:ring-emerald-500/20'
                                          : draggingServiceId && canAssignService(canvas, node.nodeId)
                                            ? 'border-dashed border-emerald-200'
                                            : undefined
                                }
                                onClick={() => {
                                    startTransition(() => {
                                        canvas.setActive(node.nodeId);
                                        canvas.api.select([node.nodeId]);
                                    });
                                }}
                            >
                                <FieldCardDetails nodeId={node.nodeId} />
                                {node.threadCount ? (
                                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                                        <BsChatSquareQuote />
                                        <span>{node.threadCount} discussion thread{node.threadCount === 1 ? '' : 's'}</span>
                                    </div>
                                ) : null}
                            </NodeCard>
                        </div>
                    ))}

                    {pendingServiceDrop ? (
                        <div
                            className="absolute z-30 w-72"
                            style={{
                                left: `${pendingServiceDrop.x}px`,
                                top: `${pendingServiceDrop.y}px`,
                            }}
                        >
                            <CanvasOverlay
                                title={pendingServiceDrop.currentServiceId != null ? 'Replace service on node' : 'Set service on node'}
                                description={`Assign service #${pendingServiceDrop.serviceId} to ${getNodeLabel(canvas.selector.getNode(pendingServiceDrop.nodeId))}.`}
                            >
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            canvas.api.editor.setService(pendingServiceDrop.nodeId, { service_id: Number(pendingServiceDrop.serviceId) });
                                            setPendingServiceDrop(null);
                                        }}
                                        className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                                    >
                                        {pendingServiceDrop.currentServiceId != null ? 'Replace service' : 'Set service'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPendingServiceDrop(null)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </CanvasOverlay>
                        </div>
                    ) : null}

                    {freeThreads.map((thread, index) => {
                        const pos = thread.anchor?.type === 'free' ? thread.anchor.position : { x: 60, y: 60 + index * 120 };
                        const main = thread.messages.find((message) => message.isMain) ?? thread.messages[0];
                        return (
                            <div
                                key={thread.id}
                                className="absolute w-64"
                                style={{
                                    left: `${pos.x}px`,
                                    top: `${pos.y}px`,
                                }}
                            >
                                <CanvasOverlay title={main?.authorName ?? 'Comment'} description={main?.body}>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <StatusDot tone={thread.resolved ? 'success' : 'warning'} />
                                        <span>{thread.resolved ? 'Resolved' : 'Open thread'}</span>
                                    </div>
                                </CanvasOverlay>
                            </div>
                        );
                    })}
                </div>
            </div>

            <BottomConsolePanel
                controller={bottomPanel}
                errors={errors}
                activeServices={serviceSummary.activeServices}
                allServices={serviceSummary.allServices}
                onServiceDragStateChange={(serviceId) => {
                    setDraggingServiceId(serviceId);
                    if (!serviceId) setDropTargetId(null);
                }}
            />
        </div>
    );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'default' | 'success' | 'warning' }) {
    return (
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <div className="flex items-center gap-2">
                <StatusDot tone={tone} />
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</span>
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</div>
        </div>
    );
}

function canAssignService(canvas: ReturnType<typeof useCanvas>, nodeId: string) {
    const node = canvas.selector.getNode(nodeId);
    if (!node || (node.kind !== 'tag' && node.kind !== 'field' && node.kind !== 'option')) return false;
    return getNodePropertyCapabilities(node).service.canEdit;
}

function getNodeServiceId(node: unknown) {
    if (node && typeof node === 'object' && 'raw' in node && node.raw && typeof node.raw === 'object' && 'service_id' in node.raw) {
        const value = (node.raw as { service_id?: number | string }).service_id;
        return value;
    }
    return undefined;
}

function getNodeLabel(node: unknown) {
    if (node && typeof node === 'object' && 'raw' in node && node.raw && typeof node.raw === 'object' && 'label' in node.raw) {
        return String((node.raw as { label?: string }).label ?? 'this node');
    }
    return 'this node';
}
