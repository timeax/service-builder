import {
    BuilderIconButton,
    CanvasOverlay,
    EmptyState,
    NodeCard,
    NodePill,
    StatusDot,
    ToolbarGroup,
} from '@/components/builder/index.tsx';
import { buildCanvasNodeViewModels, getServiceDetails } from '@/builder/view-models.tsx';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { startTransition, useMemo } from 'react';
import { BsChatSquareQuote } from 'react-icons/bs';
import { FiCrosshair } from 'react-icons/fi';
import { LuLayoutGrid, LuMousePointer2, LuPlus } from 'react-icons/lu';
import { MdOutlineFitScreen, MdOutlineVisibility } from 'react-icons/md';

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

    const nodes = useMemo(() => buildCanvasNodeViewModels(canvas, ws.comments.threads.data ?? []), [canvas.graph, canvas.activeId, canvas.selection, ws.comments.threads.data]);
    const freeThreads = (ws.comments.threads.data ?? []).filter((thread) => thread.anchor?.type === 'free');

    const stats = {
        tags: canvas.layers.tags.length,
        fields: canvas.layers.fields.length,
        comments: (ws.comments.threads.data ?? []).length,
    };

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
                        >
                            <NodeCard
                                view={node}
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
