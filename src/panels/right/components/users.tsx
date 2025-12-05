// Users.tsx
import Dropdown from '@/components/dropdown';
import type { MenuData, MenuNode } from '@/components/dropdown/types'; // adjust path to where you defined the types
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { FC } from 'react';
import * as React from 'react';
import { GoChevronDown } from 'react-icons/go';

interface User {
    name: string;
    avatar: string;
    isMain?: boolean;
    isOnline?: boolean;
    isAdmin?: boolean;
}

interface UsersProps {
    users: User[];

    // Optional handlers – you can plug real logic here
    onViewUser?: (user: User) => void;
    onSetMain?: (user: User) => void;
    onToggleAdmin?: (user: User) => void;
    onRemoveUser?: (user: User) => void;
    onInviteUser?: () => void;
}

/**
 * Helper: get initials for fallback avatar
 */
function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
}

/**
 * Build the dropdown menu for the current list of users.
 * Uses group + submenu + checkbox + actions based on your MenuNode types.
 */
function buildUsersMenu(
    users: User[],
    handlers: {
        onViewUser?: (u: User) => void;
        onSetMain?: (u: User) => void;
        onToggleAdmin?: (u: User) => void;
        onRemoveUser?: (u: User) => void;
        onInviteUser?: () => void;
    },
): MenuData {
    const { onViewUser, onSetMain, onToggleAdmin, onRemoveUser, onInviteUser } = handlers;

    const memberSubmenus: MenuNode[] = users.map((u, idx) => ({
        type: 'submenu',
        id: idx,
        label: u.name,
        description: u.isMain ? 'Owner' : u.isAdmin ? 'Admin' : 'Collaborator',
        icon: (
            <Avatar data-slot="avatar" className="h-6 w-6">
                <AvatarImage src={u.avatar} alt={u.name} />
                <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
            </Avatar>
        ),
        items: [
            {
                type: 'action',
                label: 'View profile',
                command: () => onViewUser?.(u),
            },
            {
                type: 'checkbox',
                label: 'Main owner',
                checked: !!u.isMain,
                onCheckedChange: () => onSetMain?.(u),
            },
            {
                type: 'checkbox',
                label: 'Administrator',
                checked: !!u.isAdmin,
                onCheckedChange: () => onToggleAdmin?.(u),
            },
            {
                type: 'action',
                label: 'Remove from service',
                danger: true,
                command: () => onRemoveUser?.(u),
                confirm: 'Remove this member from the service?',
            },
        ],
    }));

    return [
        {
            type: 'group',
            label: 'Members',
            items: memberSubmenus,
        },
        { type: 'separator' },
        {
            type: 'action',
            label: 'Invite member…',
            shortcut: 'I',
            command: () => onInviteUser?.(),
        },
    ];
}

const Users: FC<UsersProps> = ({ users, onViewUser, onSetMain, onToggleAdmin, onRemoveUser, onInviteUser }) => {
    const visibleUsers = users.slice(0, 3);
    const extra = users.length - visibleUsers.length;

    const menu = React.useMemo(
        () =>
            buildUsersMenu(users, {
                onViewUser,
                onSetMain,
                onToggleAdmin,
                onRemoveUser,
                onInviteUser,
            }),
        [users, onViewUser, onSetMain, onToggleAdmin, onRemoveUser, onInviteUser],
    );

    return (
        <Dropdown  menu={menu}>
            <div className="flex items-center gap-2">
                <div className="flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background *:data-[slot=avatar]:grayscale">
                    {visibleUsers.map((u, idx) => (
                        <Avatar key={`${u.name}-${idx}`} data-slot="avatar" className="relative h-8 w-8">
                            <AvatarImage src={u.avatar} alt={u.name} />
                            <AvatarFallback>{getInitials(u.name)}</AvatarFallback>

                            {/* Online indicator */}
                            {u.isOnline && <span className="absolute right-0 bottom-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />}

                            {/* Main / Admin badge (tiny corner tag) */}
                            {u.isMain && (
                                <span className="absolute -top-0.5 -right-0.5 rounded-full bg-amber-500 px-1 text-[9px] font-semibold text-amber-50">
                                M
                            </span>
                            )}
                            {!u.isMain && u.isAdmin && (
                                <span className="absolute -top-0.5 -right-0.5 rounded-full bg-sky-500 px-1 text-[9px] font-semibold text-sky-50">A</span>
                            )}
                        </Avatar>
                    ))}

                    {extra > 0 && (
                        <Avatar
                            data-slot="avatar"
                            className="h-8 w-8 border border-dashed border-border bg-muted text-xs font-medium text-muted-foreground"
                        >
                            <AvatarFallback>+{extra}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
                <GoChevronDown />
            </div>
        </Dropdown>
    );
};

export default Users;


export const mockUsers: User[] = [
    {
        name: 'Davy Okafor',
        avatar: 'https://api.dicebear.com/9.x/thumbs/svg?seed=davy-okafor',
        isMain: true,
        isOnline: true,
        isAdmin: true,
    },
    {
        name: 'Amaka Johnson',
        avatar: 'https://api.dicebear.com/9.x/thumbs/svg?seed=amaka-johnson',
        isOnline: true,
        isAdmin: true,
    },
    {
        name: 'Mustapha Bello',
        avatar: 'https://api.dicebear.com/9.x/thumbs/svg?seed=mustapha-bello',
        isOnline: false,
        isAdmin: false,
    },
    {
        name: 'Chioma Ade',
        avatar: 'https://api.dicebear.com/9.x/thumbs/svg?seed=chioma-ade',
        isOnline: true,
        isAdmin: false,
    },
    {
        name: 'Kelvin Adebayo',
        avatar: 'https://api.dicebear.com/9.x/thumbs/svg?seed=kelvin-adebayo',
        isOnline: false,
        isAdmin: false,
    },
];
