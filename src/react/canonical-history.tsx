// SPDX-License-Identifier: GPL-3.0-only
import { Button } from '@/components/ui/button.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { useState } from 'react';
import { LuGitCommitHorizontal, LuRotateCcw, LuTrash2, LuX } from 'react-icons/lu';
import { useWorkspacePermission, useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

export function CanonicalHistoryPanel({ onClose }: { onClose(): void }) {
    const runtime = useWorkspaceRuntime();
    const state = useWorkspaceSelector((current) => current);
    const canCommit = useWorkspacePermission('commit.create');
    const canSaveDraft = useWorkspacePermission('draft.save');
    const canMutate = useWorkspacePermission('document.mutate');
    const commitDeniedReason = canCommit ? undefined : 'You do not have permission to create commits.';
    const draftDeniedReason = canSaveDraft ? undefined : 'You do not have permission to discard drafts.';
    const mutationDeniedReason = canMutate ? undefined : 'You do not have permission to edit this definition.';
    const [pending, setPending] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const commits = [...state.commits].reverse();

    async function run(key: string, operation: () => Promise<{ ok: boolean; error?: { message: string } }>) {
        setPending(key);
        setError(null);
        try {
            const result = await operation();
            if (!result.ok) setError(result.error?.message ?? 'The history action failed.');
        } finally {
            setPending(null);
        }
    }

    return (
        <section
            aria-label="Version history"
            className="pointer-events-auto absolute top-16 right-4 z-20 flex max-h-[min(70vh,36rem)] w-96 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
        >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Version history</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Commits and snapshots for the active branch.</p>
                    <p className="mt-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">{state.snapshot_state}</p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" aria-label="Close version history" onClick={onClose}>
                    <LuX />
                </Button>
            </div>
            <div className="flex gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    title={commitDeniedReason}
                    disabled={!canCommit || state.snapshot_state === 'clean' || pending !== null}
                    onClick={() => void run('commit', () => runtime.commit('Saved from Service Builder'))}
                >
                    <LuGitCommitHorizontal />
                    {pending === 'commit' ? 'Creating...' : 'Create commit'}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    title={draftDeniedReason}
                    disabled={!canSaveDraft || state.draft === null || pending !== null}
                    onClick={() => void run('discard', () => runtime.discard_draft())}
                >
                    <LuTrash2 />
                    Discard draft
                </Button>
            </div>
            {error ? (
                <p
                    role="alert"
                    className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                >
                    {error}
                </p>
            ) : null}
            <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-2 p-4">
                    {commits.length ? (
                        commits.map((commit) => (
                            <article
                                key={commit.id}
                                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{commit.message}</p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Revision {commit.revision} · {new Date(commit.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    {state.head?.id === commit.id ? (
                                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                                            Head
                                        </span>
                                    ) : null}
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="mt-2 h-8 rounded-xl px-2"
                                    aria-label={`Restore ${commit.message}`}
                                    title={mutationDeniedReason}
                                    disabled={!canMutate || pending !== null}
                                    onClick={() => void run(`restore:${commit.id}`, () => runtime.restore_snapshot(commit.id))}
                                >
                                    <LuRotateCcw />
                                    {pending === `restore:${commit.id}` ? 'Restoring...' : 'Restore'}
                                </Button>
                            </article>
                        ))
                    ) : (
                        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No commits exist for this branch.</p>
                    )}
                </div>
            </ScrollArea>
        </section>
    );
}
