import { CanvasOverlay } from '@/components/builder/index.tsx';
import { cn } from '@/lib/utils.ts';
import type { OverlayId, OverlayState } from '@/panels/canvas/utils.ts';
import { restoreAllOverlays } from '@/panels/canvas/utils.ts';
import { WorkspaceBootInlineNotice } from '@/workspace/boot-status.tsx';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import type React from 'react';
import { FiRotateCw } from 'react-icons/fi';
import { MdOutlineVisibility } from 'react-icons/md';

export function CanvasOverlays({
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
    const ws = useWorkspace();

    const toggleMinimized = (id: OverlayId) =>
        setState((current) => ({
            ...current,
            [id]: {
                ...current[id],
                minimized: !current[id].minimized,
                closed: false,
            },
        }));

    const closeOverlay = (id: OverlayId) =>
        setState((current) => ({
            ...current,
            [id]: { ...current[id], closed: true },
        }));

    const restoreOverlay = (id: OverlayId) =>
        setState((current) => ({
            ...current,
            [id]: { minimized: false, closed: false },
        }));

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
                        <div className="space-y-3">
                            <WorkspaceBootInlineNotice boot={ws.boot} sections={['snapshotBody', 'comments']} />
                            <div className="grid grid-cols-3 gap-2">
                                <Stat label="Tags" value={stats.tags} />
                                <Stat label="Fields" value={stats.fields} />
                                <Stat label="Comments" value={stats.comments} />
                            </div>
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
                            {freeThreadCount} unanchored thread
                            {freeThreadCount === 1 ? '' : 's'} on canvas
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
