import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { CommentMessage, CommentThread, ThreadId } from '@timeax/digital-service-engine/schema';
import { InputField } from '@timeax/form-palette';
import * as React from 'react';

import { createCache, createIndexedDBDriver, createMemoryDriver, type CacheStore } from '@timeax/cache-store';

/** ---------------- Branch/thread open-state cache ---------------- */

// NOTE: thread.id is used as the key (as requested).
// We isolate this feature via a dedicated ns, so keys can be “just threadId”.
const OPEN_DB_NAME = 'dgp-cache';
const OPEN_STORE_NAME = 'kv';
const OPEN_NS = 'comment-thread-open';

let _openCache: CacheStore | null = null;

function getOpenCache(): CacheStore {
    if (_openCache) return _openCache;

    const isBrowser = typeof window !== 'undefined';

    _openCache = createCache({
        driver: isBrowser
            ? createIndexedDBDriver({
                  dbName: OPEN_DB_NAME,
                  storeName: OPEN_STORE_NAME,
                  ns: OPEN_NS,
              })
            : createMemoryDriver(),
        hydrate: isBrowser, // only hydrate in browser
        cleanupExpiredOnHydrate: true,
    });

    return _openCache;
}

function useThreadOpenState(threadId: string, defaultOpen = true) {
    const cache = React.useMemo(() => getOpenCache(), []);

    // Initialize from mirror (sync)
    const [open, setOpen] = React.useState<boolean>(() => {
        const v = cache.get<boolean>(threadId);
        return typeof v === 'boolean' ? v : defaultOpen;
    });

    // Keep local state synced with cache updates + hydration readiness.
    React.useEffect(() => {
        let mounted = true;

        const sync = () => {
            if (!mounted) return;
            const v = cache.get<boolean>(threadId);
            setOpen(typeof v === 'boolean' ? v : defaultOpen);
        };

        // Sync once now, then on key changes, and once hydration completes.
        sync();

        const unsubKey = cache.subscribeKey(threadId, sync);
        const unsubReady = cache.subscribeReady(sync);

        return () => {
            mounted = false;
            unsubKey();
            unsubReady();
        };
    }, [cache, threadId, defaultOpen]);

    const set = React.useCallback(
        (next: boolean) => {
            setOpen(next);
            cache.set<boolean>(threadId, next);
        },
        [cache, threadId],
    );

    return [open, set] as const;
}

/** ---------------- Props (UI needs) ---------------- */

export type IdentityMap = Readonly<
    Record<
        string,
        {
            name: string;
            avatar?: { src: string; alt?: string };
        }
    >
>;

export type YourIdentity = {
    id?: string;
    name: string;
    avatar?: { src: string; alt?: string };
};

export type CommentThreadProps = {
    thread: CommentThread;

    /** Used only for rendering author avatar/name (no layout changes) */
    identities?: IdentityMap;

    /** For the reply input avatar */
    you: YourIdentity;

    /** optional highlight (like your "active" thread) */
    highlight?: boolean;

    /** formatting hook for timestamps; defaults to a tiny relative formatter */
    formatTime?: (ts: number) => string;

    onReply?: (args: { threadId: ThreadId; text: string }) => void;
};

/** ---------------- Helpers ---------------- */

function cx(...v: Array<string | false | null | undefined>) {
    return v.filter(Boolean).join(' ');
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (a + b).toUpperCase() || '?';
}

function defaultFormatTime(ts: number) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

function resolveAuthor(msg: CommentMessage, identities?: IdentityMap): { name: string; avatar?: { src: string; alt?: string } } {
    const id = msg.authorId ?? '';
    const fromMap = id && identities ? identities[id] : undefined;

    const name = msg.authorName ?? fromMap?.name ?? (id ? `User ${id.slice(0, 6)}` : 'Unknown');
    const avatar = fromMap?.avatar;

    return { name, avatar };
}

function PersonAvatar({
    person,
    sizeClass = 'h-8 w-8',
    fallback,
}: {
    person: { name: string; avatar?: { src: string; alt?: string } };
    sizeClass?: string;
    fallback?: string;
}) {
    return (
        <Avatar className={sizeClass}>
            {person.avatar?.src ? <AvatarImage src={person.avatar.src} alt={person.avatar.alt ?? `Avatar of ${person.name}`} /> : null}
            <AvatarFallback>{fallback ?? initials(person.name)}</AvatarFallback>
        </Avatar>
    );
}

function ReplyInputRow({
    you,
    value,
    setValue,
    onSubmit,
    className,
}: {
    you: YourIdentity;
    id: string;
    value: string;
    setValue: (v: string) => void;
    onSubmit: () => void;
    className?: string;
}) {
    return (
        <div className={cx('flex items-center gap-3', className)}>
            <PersonAvatar person={{ name: you.name, avatar: you.avatar }} fallback={initials(you.name)} />
            <InputField
                variant={'textarea'}
                placeholder="Add a reply..."
                value={value}
                onChange={(e) => setValue(e.value ?? '')}
                onKeyDown={(e: any) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSubmit();
                    }
                }}
            />
        </div>
    );
}

/** ---------------- Components ---------------- */

export function CommentItem({ msg, identities, formatTime }: { msg: CommentMessage; identities?: IdentityMap; formatTime: (ts: number) => string }) {
    const author = resolveAuthor(msg, identities);

    return (
        <div className="flex items-start gap-3">
            <PersonAvatar person={author} />

            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{author.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(msg.createdAt)}</p>
                </div>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{msg.body}</p>
            </div>
        </div>
    );
}

export function CommentThreadView({ thread, identities, you, highlight, formatTime, onReply }: CommentThreadProps) {
    const fmt = formatTime ?? defaultFormatTime;

    const main = thread.messages.find((m) => m.isMain) ?? thread.messages[0];
    const replies = thread.messages.filter((m) => m.id !== main?.id);
    const isHighlighted = Boolean(highlight);

    const [value, setValue] = React.useState('');

    const submit = () => {
        const text = value.trim();
        if (!text) return;
        onReply?.({ threadId: thread.id, text });
        setValue('');
    };

    if (!main) return null;

    // ✅ persisted open state (key = thread.id)
    const [open, setOpen] = useThreadOpenState(thread.id, true);

    return (
        <div
            className={cx(
                isHighlighted
                    ? 'relative rounded-lg border-2 border-primary/50 bg-primary/5 dark:bg-primary/10'
                    : 'rounded-lg border border-gray-200 dark:border-gray-700',
            )}
        >
            {isHighlighted ? <ActiveDot /> : null}

            {/* replies block */}
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger asChild>
                    <div className="px-3 py-4">
                        <CommentItem msg={main} identities={identities} formatTime={fmt} />
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="border-t border-gray-200 bg-gray-50 p-4 pl-6 dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="flex items-start gap-4">
                            <div className="ml-1 w-px shrink-0 self-stretch bg-gray-300 dark:bg-gray-600" />

                            <div className="flex-1 space-y-4">
                                {replies.map((r) => (
                                    <CommentItem key={r.id} msg={r} identities={identities} formatTime={fmt} />
                                ))}

                                <ReplyInputRow id={thread.id} you={you} value={value} setValue={setValue} onSubmit={submit} />
                            </div>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

function ActiveDot() {
    return (
        <span className="absolute -top-1.5 -left-1.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
        </span>
    );
}
