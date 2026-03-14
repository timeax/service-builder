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
        <div className="flex items-center justify-between border-b border-gray-200 p-2.5 dark:border-gray-700">
            <div className="flex items-center gap-4">
                <Users users={users} />
                <button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                    <MdOutlinePlayArrow className="text-2xl" />
                </button>
            </div>
            <button className="flex h-7 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[#0095FF] text-white hover:bg-[#007edc]">
                <PiShareFatThin />
            </button>
        </div>
    );
};

export default Header;
