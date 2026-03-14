import { EmptyState, PanelSearch } from '@/components/builder/index.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { CommentThreadView } from '@/panels/right/components/comments/comments.tsx';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useMemo, useState } from 'react';
import { MdOutlineSend } from 'react-icons/md';

const Comments = () => {
    const ws = useWorkspace();
    const [value, setValue] = useState('');
    const [query, setQuery] = useState('');

    const threads = useMemo(() => {
        const items = ws.comments.threads.data ?? [];
        const lower = query.trim().toLowerCase();
        if (!lower) return items;

        return items.filter((thread) =>
            thread.messages.some((message) => `${message.authorName ?? ''} ${message.body}`.toLowerCase().includes(lower)),
        );
    }, [ws.comments.threads.data, query]);

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
            </div>

            <ScrollArea className="mt-3 min-h-0 flex-1 px-4">
                <div className="flex flex-col gap-3 pb-4">
                    {threads.length ? (
                        threads.map((thread) => (
                            <CommentThreadView
                                key={thread.id}
                                thread={thread}
                                highlight={!thread.resolved}
                                you={{ id: ws.actor.id, name: ws.actor.name ?? 'You' }}
                                onReply={({ threadId, text }) =>
                                    ws.comments.addMessage({
                                        threadId,
                                        body: text,
                                        branchId: ws.branches.currentId,
                                    })
                                }
                            />
                        ))
                    ) : (
                        <EmptyState title="No matching comments" description="Try a broader search or add a new thread to the current branch." className="mt-4" />
                    )}
                </div>
            </ScrollArea>

            <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                <InputField
                    variant="textarea"
                    value={value}
                    placeholder="Add a new branch comment..."
                    px={-4}
                    onChange={(e) => setValue(e.value ?? '')}
                    extendBoxToControls
                    trailingControl={
                        <button
                            type="button"
                            onClick={() => {
                                const body = value.trim();
                                if (!body) return;

                                ws.comments
                                    .createThread({
                                        body,
                                        branchId: ws.branches.currentId,
                                    })
                                    .finally(() => setValue(''));
                            }}
                            className="cursor-pointer rounded-xl bg-blue-600 px-3 py-2 text-white transition hover:bg-blue-700"
                        >
                            <MdOutlineSend />
                        </button>
                    }
                />
            </div>
        </div>
    );
};

export default Comments;
