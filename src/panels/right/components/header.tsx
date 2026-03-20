import { BuilderIconButton } from '@/components/builder/index.tsx';
import Users, { type User } from '@/panels/right/components/users.tsx';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useMemo } from 'react';
import { MdOutlinePlayArrow } from 'react-icons/md';
import { PiShareFatThin } from 'react-icons/pi';

const Header = () => {
    const ws = useWorkspace();

    const users = useMemo<User[]>(() => {
        const participants = ws.participants.data ?? [];
        const authors = ws.authors.data ?? [];

        const authorById = new Map(authors.map((a) => [a.id, a]));

        const actorAuthorId =
            (ws.actor?.meta as any)?.authorId && typeof (ws.actor?.meta as any)?.authorId === 'string'
                ? ((ws.actor?.meta as any).authorId as string)
                : authorById.has(ws.actor?.id ?? '')
                  ? (ws.actor!.id as string)
                  : undefined;

        return participants.map((p) => {
            const a = authorById.get(p.authorId);
            const meta = (p.meta ?? {}) as Record<string, unknown>;

            const presence = typeof meta.presence === 'string' ? meta.presence : undefined;
            const explicitOnline = typeof meta.online === 'boolean' ? meta.online : typeof meta.isOnline === 'boolean' ? meta.isOnline : undefined;
            const computedOnline = explicitOnline ?? (presence === 'online' || presence === 'idle');

            return {
                ...p,
                name: a?.name ?? (typeof meta.name === 'string' ? meta.name : undefined) ?? p.authorId,
                avatar: a?.avatarUrl ?? (typeof meta.avatar === 'string' ? meta.avatar : undefined) ?? '',
                isOnline: actorAuthorId && p.authorId === actorAuthorId ? true : computedOnline,
            };
        });
    }, [ws.participants.data, ws.authors.data, ws.actor]);

    return (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 dark:border-slate-800">
            <div className="min-w-0 flex items-center gap-3">
                <Users users={users} />
                <BuilderIconButton title="Preview current branch" className="h-9 w-9 rounded-xl border border-slate-200 bg-white/80 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
                    <MdOutlinePlayArrow className="text-2xl" />
                </BuilderIconButton>
            </div>
            <BuilderIconButton
                title="Share branch"
                className="h-9 w-9 rounded-xl bg-sky-500 text-white hover:border-sky-500 hover:bg-sky-600 hover:text-white dark:bg-sky-500 dark:text-white"
            >
                <PiShareFatThin />
            </BuilderIconButton>
        </div>
    );
};

export default Header;
