import Dropdown from '@/components/dropdown';
import type { MenuData } from '@/components/dropdown/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { cn } from '@/lib/utils.ts';
import { type BranchParticipant } from '@timeax/digital-service-engine/workspace';
import { useMemo, type FC } from 'react';
import { GoChevronDown } from 'react-icons/go';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { PiUserPlusThin } from 'react-icons/pi';

export interface User extends BranchParticipant {
    name: string;
    avatar: string;
    isOnline: boolean;
}

interface UsersProps {
    users: User[];
    onSetMain?: (user: User) => void;
    onToggleAdmin?: (user: User) => void;
    onRemoveUser?: (user: User) => void;
    onInviteUser?: () => void;
}

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function formatRole(role: string) {
    return role.replace(/[-_]/g, ' ');
}

function roleClass(role: string) {
    if (role === 'owner') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200';
    if (role === 'admin') return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200';
    if (role === 'assistant') return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200';
    return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
}

function buildUserMenu(user: User, handlers: Omit<UsersProps, 'users'>): MenuData {
    const { onSetMain, onToggleAdmin, onRemoveUser } = handlers;

    return [
        {
            type: 'group',
            label: user.name,
            items: [
                {
                    type: 'checkbox',
                    label: 'Main owner',
                    checked: !!user.roles?.includes('owner'),
                    onCheckedChange: () => onSetMain?.(user),
                },
                {
                    type: 'checkbox',
                    label: 'Administrator',
                    checked: !!user.roles?.includes('admin'),
                    onCheckedChange: () => onToggleAdmin?.(user),
                },
            ],
        },
        { type: 'separator' },
        {
            type: 'action',
            label: 'Remove collaborator',
            danger: true,
            command: () => onRemoveUser?.(user),
            confirm: 'Remove this collaborator from the branch?',
        },
    ];
}

const Users: FC<UsersProps> = ({ users, onSetMain, onToggleAdmin, onRemoveUser, onInviteUser }) => {
    const visibleUsers = users.slice(0, 3);
    const extra = Math.max(users.length - visibleUsers.length, 0);

    const orderedUsers = useMemo(() => {
        return [...users].sort((a, b) => {
            const aScore = (a.isOnline ? 10 : 0) + (a.roles?.includes('owner') ? 3 : 0) + (a.roles?.includes('admin') ? 2 : 0);
            const bScore = (b.isOnline ? 10 : 0) + (b.roles?.includes('owner') ? 3 : 0) + (b.roles?.includes('admin') ? 2 : 0);
            return bScore - aScore || a.name.localeCompare(b.name);
        });
    }, [users]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl border border-transparent px-1 py-1 transition hover:border-slate-200 hover:bg-white dark:hover:border-slate-800 dark:hover:bg-slate-950"
                >
                    <div className="flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-white dark:*:data-[slot=avatar]:ring-slate-950">
                        {visibleUsers.map((user) => (
                            <div key={user.id} className="relative">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.avatar} alt={user.name} />
                                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                </Avatar>
                                {user.isOnline ? (
                                    <span className="absolute right-0 bottom-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
                                ) : null}
                            </div>
                        ))}
                        {extra > 0 ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-100 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                +{extra}
                            </div>
                        ) : null}
                    </div>
                    <GoChevronDown className="shrink-0 text-slate-500" />
                </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-[380px] rounded-3xl border-slate-200 bg-white/98 p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950/98">
                <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Collaborators</div>
                            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">Branch authors</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Presence, roles, and access for the active branch.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            onClick={onInviteUser}
                        >
                            <PiUserPlusThin className="text-base" />
                            Invite
                        </Button>
                    </div>
                </div>

                <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
                    {orderedUsers.map((user) => {
                        const permissionsLabel = user.canWrite ? 'Can edit this branch' : user.canRead ? 'Can view this branch' : 'No branch access';
                        const statusLabel = user.isOnline ? 'Online now' : 'Offline';

                        return (
                            <div
                                key={user.id}
                                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="relative">
                                        <Avatar className="h-11 w-11 border border-white shadow-sm dark:border-slate-950">
                                            <AvatarImage src={user.avatar} alt={user.name} />
                                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                        </Avatar>
                                        <span
                                            className={cn(
                                                'absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900',
                                                user.isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
                                            )}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user.name}</div>
                                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{statusLabel}</div>
                                            </div>

                                            <Dropdown
                                                menu={buildUserMenu(user, {
                                                    onSetMain,
                                                    onToggleAdmin,
                                                    onRemoveUser,
                                                    onInviteUser,
                                                })}
                                                align="end"
                                            >
                                                <button
                                                    type="button"
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
                                                >
                                                    <HiOutlineDotsHorizontal />
                                                </button>
                                            </Dropdown>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {(user.roles?.length ? user.roles : ['viewer']).map((role) => (
                                                <span key={`${user.id}-${role}`} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize', roleClass(role))}>
                                                    {formatRole(role)}
                                                </span>
                                            ))}
                                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                                {permissionsLabel}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default Users;
