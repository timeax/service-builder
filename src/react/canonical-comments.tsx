// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState, PanelSearch } from '@/components/builder/index.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { CommentThreadView, type CommentThreadViewModel, type IdentityMap } from '@/panels/right/components/comments/comments.tsx';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useState } from 'react';
import { MdOutlineSend } from 'react-icons/md';
import { CanonicalWorkspaceBootInlineNotice } from './canonical-boot-status';
import { useCanvasAPI, useWorkspacePermission, useWorkspaceSelector } from './workspace';

function getCommentSyncErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error !== null && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
    return 'The comment change could not be synchronized.';
}

export function CanonicalComments() {
    const canvas = useCanvasAPI();
    const state = useWorkspaceSelector((current) => current);
    const canComment = useWorkspacePermission('comment.write');
    const [value, setValue] = useState('');
    const [query, setQuery] = useState('');
    const [commentsVersion, refresh] = useState(0);
    const [syncError, setSyncError] = useState<string>();

    useEffect(() => {
        if (canvas === undefined) return undefined;
        const offChange = canvas.on('comments:change', () => refresh((version) => version + 1));
        const offError = canvas.on('comments:error', ({ error }) => setSyncError(getCommentSyncErrorMessage(error)));
        const offSync = canvas.on('comment:sync', ({ status }) => {
            if (status === 'succeeded') setSyncError(undefined);
        });
        return () => {
            offChange();
            offError();
            offSync();
        };
    }, [canvas]);

    const identities = useMemo<IdentityMap>(
        () =>
            Object.fromEntries(
                state.authors.map((author) => [
                    author.id,
                    {
                        name: author.display_name,
                        avatar: author.avatar_url ? { src: author.avatar_url, alt: `Avatar of ${author.display_name}` } : undefined,
                    },
                ]),
            ),
        [state.authors],
    );
    const threads = useMemo<CommentThreadViewModel[]>(() => {
        const lower = query.trim().toLowerCase();
        const source = canvas?.comments.list() ?? state.comments;
        return source
            .map((thread) => ({
                id: thread.id,
                resolved: thread.resolved,
                messages: thread.messages.map((message, index) => ({
                    id: message.id,
                    authorId: message.author_id,
                    authorName: identities[message.author_id]?.name,
                    body: message.body,
                    createdAt: Date.parse(message.created_at),
                    isMain: index === 0,
                })),
            }))
            .filter(
                (thread) => !lower || thread.messages.some((message) => `${message.authorName ?? ''} ${message.body}`.toLowerCase().includes(lower)),
            );
        // commentsVersion is an event revision that intentionally invalidates CommentsAPI.list().
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvas, commentsVersion, identities, query, state.comments]);

    const actorName = identities[state.actor.id]?.name ?? state.actor.display_name ?? 'You';

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">All comments</h3>
                </div>
                <button className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-300">Mark as read</button>
            </div>
            <div className="px-4 pt-3">
                <PanelSearch value={query} onChange={setQuery} placeholder="Search comments or authors" />
                <CanonicalWorkspaceBootInlineNotice sections={['comments']} className="mt-3" />
                {syncError ? <div role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"><span className="font-semibold">Comment sync failed.</span> {syncError}</div> : null}
            </div>
            <ScrollArea className="mt-3 min-h-0 flex-1 px-4">
                <div className="flex flex-col gap-3 pb-4">
                    {threads.length ? (
                        threads.map((thread) => (
                            <CommentThreadView
                                key={thread.id}
                                thread={thread}
                                identities={identities}
                                highlight={!thread.resolved}
                                you={{ id: state.actor.id, name: actorName }}
                                onReply={({ threadId, text }) => {
                                    if (canComment) canvas?.comments.reply(threadId, text);
                                }}
                            />
                        ))
                    ) : (
                        <EmptyState
                            title="No matching comments"
                            description="Try a broader search or add a new thread to the current branch."
                            className="mt-4"
                        />
                    )}
                </div>
            </ScrollArea>
            <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                <InputField
                    variant="textarea"
                    value={value}
                    placeholder="Add a new branch comment..."
                    px={-4}
                    onChange={(event) => setValue(String(event.value ?? ''))}
                    extendBoxToControls
                    trailingControl={
                        <button
                            type="button"
                            aria-label="Add comment"
                            onClick={() => {
                                const body = value.trim();
                                if (!canComment || !body || canvas === undefined) return;
                                canvas.comments.create(canvas.selection.primary() ?? 'canvas@0,0', body);
                                setValue('');
                            }}
                            className="cursor-pointer rounded-full bg-blue-600 px-2 py-2 text-white transition hover:bg-blue-700"
                            title={!canComment ? 'You do not have permission to add comments.' : undefined}
                            disabled={state.status !== 'ready' || !canComment}
                        >
                            <MdOutlineSend />
                        </button>
                    }
                />
            </div>
        </div>
    );
}
