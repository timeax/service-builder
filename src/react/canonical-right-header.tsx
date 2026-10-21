// SPDX-License-Identifier: GPL-3.0-only
import { BuilderIconButton } from '@/components/builder/index.tsx';
import Users, { type User } from '@/panels/right/components/users.tsx';
import { useMemo } from 'react';
import { MdOutlinePlayArrow } from 'react-icons/md';
import { PiShareFatThin } from 'react-icons/pi';
import { createCanonicalBootModel, getCanonicalBootActionReason } from './boot';
import type { ServiceBuilderCallbacks } from './contracts';
import { useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

const WRITE_ROLES = new Set(['owner', 'admin', 'editor', 'assistant']);

function toCollaboratorUsers(
    state: ReturnType<typeof useWorkspaceRuntime>['state'],
): User[] {
    const authorById = new Map(state.authors.map((author) => [author.id, author]));
    const actorAuthorId =
        typeof state.actor.meta.author_id === 'string'
            ? state.actor.meta.author_id
            : state.actor.id;

    return state.participants.map((participant) => {
        const author = authorById.get(participant.actor_id);
        const presence = typeof participant.meta.presence === 'string' ? participant.meta.presence : undefined;
        const explicitOnline =
            typeof participant.meta.online === 'boolean'
                ? participant.meta.online
                : typeof participant.meta.is_online === 'boolean'
                  ? participant.meta.is_online
                  : undefined;
        const role = participant.role || 'viewer';

        return {
            id: participant.actor_id,
            name: author?.display_name ??
                (typeof participant.meta.name === 'string' ? participant.meta.name : participant.actor_id),
            avatar: author?.avatar_url ??
                (typeof participant.meta.avatar_url === 'string' ? participant.meta.avatar_url : ''),
            isOnline: participant.actor_id === actorAuthorId ||
                (explicitOnline ?? (presence === 'online' || presence === 'idle')),
            roles: [role],
            canWrite: WRITE_ROLES.has(role),
            canRead: role !== 'none',
        };
    });
}

export type CanonicalRightHeaderProps = ServiceBuilderCallbacks;

export function CanonicalRightHeader({ onShare, onPlay }: CanonicalRightHeaderProps) {
    const runtime = useWorkspaceRuntime();
    const state = useWorkspaceSelector((current) => current);
    const boot = useMemo(() => createCanonicalBootModel(state, runtime), [runtime, state]);
    const bootActionReason = getCanonicalBootActionReason(boot);
    const users = useMemo(() => toCollaboratorUsers(state), [state]);

    const onPlayClick = () => {
        if (!boot.is_ready || state.definition === null || state.workspace_id === null) return;
        void onPlay?.({
            definition: structuredClone(state.definition),
            services: structuredClone(state.services),
            workspace_id: state.workspace_id,
            branch_id: state.current_branch_id ?? undefined,
        });
    };

    const onShareClick = () => {
        if (!boot.is_ready || state.definition === null) return;
        void onShare?.(structuredClone(state.definition));
    };

    return (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 dark:border-slate-800">
            <div className="min-w-0 flex items-center gap-3">
                <Users users={users} />
                <BuilderIconButton
                    title={bootActionReason ?? 'Preview current branch'}
                    onClick={onPlayClick}
                    disabled={!boot.is_ready}
                    className="h-9 w-9 rounded-xl border border-slate-200 bg-white/80 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300"
                >
                    <MdOutlinePlayArrow className="text-2xl" />
                </BuilderIconButton>
            </div>
            <BuilderIconButton
                title={bootActionReason ?? 'Share branch'}
                onClick={onShareClick}
                disabled={!boot.is_ready}
                className="h-9 w-9 rounded-xl bg-sky-500 text-white hover:border-sky-500 hover:bg-sky-600 hover:text-white dark:bg-sky-500 dark:text-white"
            >
                <PiShareFatThin />
            </BuilderIconButton>
        </div>
    );
}
