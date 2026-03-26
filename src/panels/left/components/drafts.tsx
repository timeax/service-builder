import { PanelSearch, StatusDot } from '@/components/builder/index.tsx';
import Dropdown from '@/components/dropdown';
import type { MenuData } from '@/components/dropdown/types';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { type MouseEventHandler, type ReactNode, useEffect, useMemo, useState } from 'react';
import { MdCheck, MdOutlineFileCopy, MdOutlineRefresh } from 'react-icons/md';
import { RiGitBranchLine, RiGitMergeLine, RiLoader4Line } from 'react-icons/ri';
import { getBootActionReason } from '@/workspace/boot.ts';
import { deriveWorkspaceAuthorization } from '@/workspace/authorization.ts';

type PermissionReason = {
    allowed: boolean;
    reason?: string;
};

type DraftsProps = {
    trigger: ReactNode;
};

function normalizeKey(input: string) {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function ActionIconButton({
    icon,
    label,
    onClick,
    disabled,
    reason,
}: {
    icon: ReactNode;
    label: string;
    onClick: MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    reason?: string;
}) {
    const button = (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition',
                'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
                'disabled:cursor-not-allowed disabled:opacity-45',
                'dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900',
            )}
            aria-label={label}
        >
            {icon}
        </button>
    );

    if (!reason) return button;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span>{button}</span>
            </TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
    );
}

const Drafts = ({ trigger }: DraftsProps) => {
    const ws = useWorkspace();
    const bootActionReason = getBootActionReason(ws.boot);
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [createName, setCreateName] = useState('');
    const [createFromId, setCreateFromId] = useState<string | undefined>(ws.branches.currentId);
    const [actionKey, setActionKey] = useState<string | null>(null);

    const auth = useMemo(
        () =>
            deriveWorkspaceAuthorization({
                actor: ws.actor,
                permissions: ws.permissions?.data,
                participants: ws.participants?.data,
                authors: ws.authors?.data,
            }),
        [ws.actor, ws.authors?.data, ws.participants?.data, ws.permissions?.data],
    );
    const workspaceRead = auth.canReadWorkspace;
    const branchesReadable = auth.permissions['branches.read'] === true;
    const canCreateBranch = auth.canCreateBranch;
    const canMergeBranches = auth.canMergeBranches;
    const canManageBranches = auth.canManageBranches;
    const canDeleteBranches = auth.canDeleteBranches;
    const canWriteBranchContent = auth.canEditBranchContent;

    const currentBranch = ws.branches.data?.find((branch) => branch.id === ws.branches.currentId);

    const branchItems = useMemo(() => {
        return (ws.branches.data ?? []).map((branch) => {
            const canRead = branchesReadable && workspaceRead;
            const canWrite = canWriteBranchContent;

            return {
                branch,
                canRead,
                canWrite,
            };
        });
    }, [branchesReadable, canWriteBranchContent, workspaceRead, ws.branches.data]);

    const visibleBranches = useMemo(() => {
        const lower = query.trim().toLowerCase();
        return branchItems.filter((item) => {
            if (!item.canRead) return false;
            if (!lower) return true;
            return item.branch.name.toLowerCase().includes(lower);
        });
    }, [branchItems, query]);

    const createSourceBranches = useMemo(() => branchItems.filter((item) => item.canRead), [branchItems]);

    useEffect(() => {
        if (!createSourceBranches.some((item) => item.branch.id === createFromId)) {
            setCreateFromId(ws.branches.currentId ?? createSourceBranches[0]?.branch.id);
        }
    }, [createFromId, createSourceBranches, ws.branches.currentId]);

    const pendingAccessCount = ws.participants.loading ? 1 : 0;

    const refreshEverything = async () => {
        setActionKey('refresh');
        try {
            await ws.refresh.branches();
            await ws.refresh.branchContext();
            await ws.refresh.participants({ branchId: ws.branches.currentId ?? undefined });
        } finally {
            setActionKey(null);
        }
    };

    const createBranch = async () => {
        const branchName = normalizeKey(createName);
        const baseBranchId = createFromId ?? ws.branches.currentId;
        if (!branchName || !baseBranchId) return;

        setActionKey(`create:${branchName}`);
        try {
            const result = await ws.createBranch(branchName, { fromId: baseBranchId });
            if (result.ok) {
                ws.setCurrentBranch(result.value.id);
                await ws.refresh.branchContext();
                await Promise.all([
                    ws.refresh.branches(),
                    ws.refresh.participants({ branchId: result.value.id }),
                    ws.refresh.participants({ branchId: baseBranchId }),
                ]);
                setCreateName('');
                setCreateFromId(result.value.id);
                setCreateOpen(false);
            }
        } finally {
            setActionKey(null);
        }
    };

    const switchBranch = async (branchId: string) => {
        setActionKey(`switch:${branchId}`);
        try {
            ws.setCurrentBranch(branchId);
            setOpen(false);
        } finally {
            setActionKey(null);
        }
    };

    const setMainBranch = async (branchId: string) => {
        setActionKey(`main:${branchId}`);
        try {
            const result = await ws.setMain(branchId);
            if (!result.ok) return;
            await Promise.all([ws.refresh.branches(), ws.refresh.participants({ branchId })]);
        } finally {
            setActionKey(null);
        }
    };

    const deleteBranch = async (branchId: string) => {
        setActionKey(`delete:${branchId}`);
        try {
            const result = await ws.deleteBranch(branchId);
            if (!result.ok) return;
            await Promise.all([ws.refresh.branches(), ws.refresh.participants({ branchId: ws.branches.currentId ?? currentBranch?.id ?? branchId })]);
        } finally {
            setActionKey(null);
        }
    };

    const mergeBranch = async (sourceId: string, targetId: string) => {
        setActionKey(`merge:${sourceId}:${targetId}`);
        try {
            const result = await ws.mergeBranch(sourceId, targetId);
            if (!result.ok) return;
            await Promise.all([
                ws.refresh.branches(),
                ws.refresh.participants({ branchId: sourceId }),
                ws.refresh.participants({ branchId: targetId }),
            ]);
            await ws.refresh.branchContext();
        } finally {
            setActionKey(null);
        }
    };

    const createPermission = useMemo<PermissionReason>(() => {
        if (!ws.boot.isReady) return { allowed: false, reason: bootActionReason ?? 'Workspace data is still loading.' };
        if (!workspaceRead) return { allowed: false, reason: 'You do not have workspace access.' };
        if (!canCreateBranch) return { allowed: false, reason: 'Branch creation is disabled by workspace permissions.' };
        if (!createFromId) return { allowed: false, reason: 'Choose a source branch first.' };
        return { allowed: true };
    }, [bootActionReason, canCreateBranch, createFromId, workspaceRead, ws.boot.isReady]);

    const branchActionMenu = (item: (typeof visibleBranches)[number]): MenuData => {
        const currentId = ws.branches.currentId;

        const switchPermission: PermissionReason = !ws.boot.isReady
            ? { allowed: false, reason: bootActionReason ?? 'Workspace data is still loading.' }
            : item.branch.id === currentId
              ? { allowed: false, reason: 'This branch is already active.' }
              : { allowed: true };

        const setMainPermission: PermissionReason = !ws.boot.isReady
            ? { allowed: false, reason: bootActionReason ?? 'Workspace data is still loading.' }
            : item.branch.isMain
              ? { allowed: false, reason: 'This branch is already the main branch.' }
              : !canManageBranches
                ? { allowed: false, reason: 'Setting the main branch requires branches.manage.' }
                : !item.canWrite
                  ? { allowed: false, reason: 'You need write access to this branch to make it main.' }
                  : { allowed: true };

        const deletePermission: PermissionReason = !ws.boot.isReady
            ? { allowed: false, reason: bootActionReason ?? 'Workspace data is still loading.' }
            : item.branch.isMain
              ? { allowed: false, reason: 'Set another branch as main before deleting this branch.' }
              : !canDeleteBranches
                ? { allowed: false, reason: 'Deleting branches requires branches.delete.' }
                : !item.canWrite
                  ? { allowed: false, reason: 'You need write access to delete this branch.' }
                  : { allowed: true };

        const mergeTargets = visibleBranches
            .filter((target) => target.branch.id !== item.branch.id)
            .map((target) => {
                const mergePermission: PermissionReason = !ws.boot.isReady
                    ? { allowed: false, reason: bootActionReason ?? 'Workspace data is still loading.' }
                    : !canMergeBranches
                      ? { allowed: false, reason: 'Merging is disabled by workspace permissions.' }
                      : !item.canWrite
                        ? { allowed: false, reason: 'You need write access to the source branch to merge it.' }
                        : !target.canWrite
                          ? { allowed: false, reason: 'You need write access to the target branch to merge into it.' }
                          : { allowed: true };

                return {
                    type: 'action' as const,
                    id: `merge:${item.branch.id}:${target.branch.id}`,
                    label: `Into ${target.branch.name}`,
                    disabled: !mergePermission.allowed,
                    tooltip: mergePermission.reason,
                    command: () => mergeBranch(item.branch.id, target.branch.id),
                    confirm: mergePermission.allowed ? `Merge ${item.branch.name} into ${target.branch.name}?` : undefined,
                };
            });

        return [
            {
                type: 'group',
                label: item.branch.name,
                items: [
                    {
                        type: 'action',
                        label: 'Switch to branch',
                        disabled: !switchPermission.allowed,
                        tooltip: switchPermission.reason,
                        command: () => switchBranch(item.branch.id),
                    },
                    {
                        type: 'action',
                        label: 'Set as main branch',
                        disabled: !setMainPermission.allowed,
                        tooltip: setMainPermission.reason,
                        command: () => setMainBranch(item.branch.id),
                    },
                    {
                        type: 'submenu',
                        label: 'Merge branch',
                        disabled: !mergeTargets.length,
                        tooltip: !mergeTargets.length ? 'No other readable branches are available as merge targets.' : undefined,
                        items: mergeTargets.length
                            ? mergeTargets
                            : [
                                  {
                                      type: 'action',
                                      label: 'No merge targets',
                                      disabled: true,
                                  },
                              ],
                    },
                    {
                        type: 'action',
                        label: 'Delete branch',
                        danger: true,
                        disabled: !deletePermission.allowed,
                        tooltip: deletePermission.reason,
                        command: () => deleteBranch(item.branch.id),
                        confirm: deletePermission.allowed ? `Delete branch ${item.branch.name}?` : undefined,
                    },
                ],
            },
        ];
    };

    if (!workspaceRead) return null;

    return (
        <Popover
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) setCreateOpen(false);
            }}
        >
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={10}
                className="w-[420px] rounded-[28px] border-slate-200 bg-white/98 p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950/98"
            >
                <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500">
                                Branch manager
                            </div>
                            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">Workspace drafts</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Switch, merge, delete, and refresh branches.</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Popover modal={false} open={createOpen} onOpenChange={setCreateOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                                    >
                                        <MdOutlineFileCopy />
                                        Create branch
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    side="right"
                                    sideOffset={8}
                                    collisionPadding={16}
                                    className="w-[320px] rounded-2xl border-slate-200 bg-white/98 p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950/98"
                                >
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create branch</h4>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Branch names are normalized to lowercase slug format.
                                            </p>
                                        </div>

                                        <label className="space-y-2">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Branch name</span>
                                            <input
                                                value={createName}
                                                onChange={(event) => setCreateName(event.target.value)}
                                                placeholder="feature-checkout"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500/40"
                                            />
                                        </label>

                                        <label className="space-y-2">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Create from</span>
                                            <select
                                                value={createFromId}
                                                onChange={(event) => setCreateFromId(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500/40"
                                            >
                                                {createSourceBranches.map((item) => (
                                                    <option key={item.branch.id} value={item.branch.id}>
                                                        {item.branch.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <Button
                                            type="button"
                                            onClick={() => void createBranch()}
                                            disabled={!createPermission.allowed || !normalizeKey(createName) || !!actionKey}
                                            className="w-full rounded-xl"
                                        >
                                            {actionKey?.startsWith('create:') ? <RiLoader4Line className="animate-spin" /> : <MdOutlineFileCopy />}
                                            Create branch
                                        </Button>

                                        {!createPermission.allowed && createPermission.reason ? (
                                            <p className="text-xs text-amber-600 dark:text-amber-300">{createPermission.reason}</p>
                                        ) : null}
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <ActionIconButton
                                icon={actionKey === 'refresh' ? <RiLoader4Line className="animate-spin" /> : <MdOutlineRefresh />}
                                label="Refresh branch data"
                                onClick={() => void refreshEverything()}
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <PanelSearch value={query} onChange={setQuery} placeholder="Search readable branches" />
                    </div>
                </div>

                <div className="max-h-[430px] space-y-3 overflow-y-auto px-4 py-4">
                    {visibleBranches.map((item) => {
                        const isCurrent = item.branch.id === ws.branches.currentId;
                        const isBusy =
                            actionKey === `switch:${item.branch.id}` ||
                            actionKey === `main:${item.branch.id}` ||
                            actionKey === `delete:${item.branch.id}` ||
                            actionKey?.startsWith(`merge:${item.branch.id}:`);

                        return (
                            <div
                                key={item.branch.id}
                                className={cn(
                                    'rounded-2xl border p-3 shadow-sm transition',
                                    isCurrent
                                        ? 'border-blue-200 bg-blue-50/70 dark:border-blue-500/30 dark:bg-blue-500/10'
                                        : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/70',
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={cn(
                                            'flex h-10 w-10 items-center justify-center rounded-xl',
                                            isCurrent
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                                        )}
                                    >
                                        {isBusy ? <RiLoader4Line className="animate-spin text-lg" /> : <RiGitBranchLine className="text-lg" />}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {item.branch.name}
                                            </div>
                                            {isCurrent ? (
                                                <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-blue-700 uppercase dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                                                    Current
                                                </span>
                                            ) : null}
                                            {item.branch.isMain ? (
                                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-amber-700 uppercase dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                                    Main
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
                                                {item.canWrite ? <StatusDot tone="success" /> : <StatusDot tone="warning" />}
                                                {item.canWrite ? 'Can edit' : 'Read only'}
                                            </span>
                                            {item.branch.headVersionId ? (
                                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
                                                    Head {item.branch.headVersionId}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!isCurrent ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                                                onClick={() => void switchBranch(item.branch.id)}
                                                disabled={!!actionKey}
                                            >
                                                {actionKey === `switch:${item.branch.id}` ? <RiLoader4Line className="animate-spin" /> : <MdCheck />}
                                                Switch
                                            </Button>
                                        ) : (
                                            <span className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                                                Active branch
                                            </span>
                                        )}

                                        <Dropdown menu={branchActionMenu(item)} align="end">
                                            <button
                                                type="button"
                                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                                            >
                                                <RiGitMergeLine />
                                            </button>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {!visibleBranches.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                            No readable branches matched your search.
                        </div>
                    ) : null}

                    {pendingAccessCount > 0 ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                            <RiLoader4Line className="animate-spin" />
                            Checking branch access for {pendingAccessCount} branch{pendingAccessCount === 1 ? '' : 'es'}.
                        </div>
                    ) : null}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default Drafts;
