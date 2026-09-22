// SPDX-License-Identifier: GPL-3.0-only
import { PanelSearch, StatusDot } from '@/components/builder/index.tsx';
import Dropdown from '@/components/dropdown';
import type { MenuData } from '@/components/dropdown/types';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { cn } from '@/lib/utils.ts';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { MdCheck, MdOutlineFileCopy, MdOutlineRefresh } from 'react-icons/md';
import { RiGitBranchLine, RiGitMergeLine, RiLoader4Line } from 'react-icons/ri';
import { createCanonicalBootModel, getCanonicalBootActionReason } from './boot';
import { useWorkspacePermission, useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

export interface CanonicalDraftsProps {
    trigger: ReactNode;
}

function normalizeKey(input: string): string {
    return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function CanonicalDrafts({ trigger }: CanonicalDraftsProps) {
    const runtime = useWorkspaceRuntime();
    const state = useWorkspaceSelector((current) => current);
    const canCreate = useWorkspacePermission('branch.create');
    const canSetMain = useWorkspacePermission('branch.set_main');
    const canMerge = useWorkspacePermission('branch.merge');
    const canDelete = useWorkspacePermission('branch.delete');
    const boot = useMemo(() => createCanonicalBootModel(state, runtime), [runtime, state]);
    const bootReason = getCanonicalBootActionReason(boot);
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [createName, setCreateName] = useState('');
    const [createFromId, setCreateFromId] = useState<string | undefined>(state.current_branch_id ?? undefined);
    const [actionKey, setActionKey] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const visibleBranches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return state.branches.filter((branch) => needle === '' || branch.name.toLowerCase().includes(needle));
    }, [query, state.branches]);

    useEffect(() => {
        if (!state.branches.some((branch) => branch.id === createFromId)) {
            setCreateFromId(state.current_branch_id ?? state.branches[0]?.id);
        }
    }, [createFromId, state.branches, state.current_branch_id]);

    async function run(key: string, operation: () => Promise<{ ok: boolean; error?: { message: string } }>) {
        setActionKey(key);
        setActionError(null);
        try {
            const result = await operation();
            if (!result.ok) setActionError(result.error?.message ?? 'The workspace action failed.');
            return result.ok;
        } finally {
            setActionKey(null);
        }
    }

    async function createBranch() {
        const name = normalizeKey(createName);
        if (name === '') return;
        const ok = await run(`create:${name}`, () => runtime.create_branch(name, createFromId));
        if (!ok) return;
        setCreateName('');
        setCreateFromId(runtime.state.current_branch_id ?? undefined);
        setCreateOpen(false);
    }

    async function switchBranch(id: string) {
        if (await run(`switch:${id}`, () => runtime.switch_branch(id))) setOpen(false);
    }

    function branchMenu(branch: (typeof state.branches)[number]): MenuData {
        const mergeTargets = state.branches.filter((target) => target.id !== branch.id);
        return [
            {
                type: 'group',
                label: branch.name,
                items: [
                    {
                        type: 'action',
                        label: 'Switch to branch',
                        disabled: !boot.is_ready || branch.id === state.current_branch_id,
                        tooltip: !boot.is_ready ? bootReason : branch.id === state.current_branch_id ? 'This branch is already active.' : undefined,
                        command: () => void switchBranch(branch.id),
                    },
                    {
                        type: 'action',
                        label: 'Set as main branch',
                        disabled: !boot.is_ready || branch.main || !canSetMain,
                        tooltip: !canSetMain ? 'Setting the main branch is disabled by workspace permissions.' : undefined,
                        command: () => void run(`main:${branch.id}`, () => runtime.set_main(branch.id)),
                    },
                    {
                        type: 'submenu',
                        label: 'Merge branch',
                        disabled: !canMerge || mergeTargets.length === 0,
                        items: mergeTargets.map((target) => ({
                            type: 'action' as const,
                            label: `Into ${target.name}`,
                            command: () => void run(`merge:${branch.id}:${target.id}`, () => runtime.merge_branch(branch.id, target.id)),
                            confirm: `Merge ${branch.name} into ${target.name}?`,
                        })),
                    },
                    {
                        type: 'action',
                        label: 'Delete branch',
                        danger: true,
                        disabled: !boot.is_ready || branch.main || !canDelete,
                        tooltip: branch.main ? 'Set another branch as main before deleting this branch.' : !canDelete ? 'Deleting branches is disabled by workspace permissions.' : undefined,
                        command: () => void run(`delete:${branch.id}`, () => runtime.delete_branch(branch.id)),
                        confirm: `Delete branch ${branch.name}?`,
                    },
                ],
            },
        ];
    }

    return (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setCreateOpen(false); }}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="start" sideOffset={10} className="w-[420px] rounded-[28px] border-slate-200 bg-white/98 p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950/98">
                <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500">Branch manager</div>
                            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">Workspace drafts</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Switch, merge, delete, and refresh branches.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Popover modal={false} open={createOpen} onOpenChange={setCreateOpen}>
                                <PopoverTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><MdOutlineFileCopy /> Create branch</Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" side="right" sideOffset={8} collisionPadding={16} className="w-[320px] rounded-2xl border-slate-200 bg-white/98 p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950/98">
                                    <div className="space-y-3">
                                        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create branch</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Branch names are normalized to lowercase slug format.</p></div>
                                        <label className="space-y-2"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">Branch name</span><input aria-label="Branch name" value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="feature-checkout" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500/40" /></label>
                                        <label className="space-y-2"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">Create from</span><select aria-label="Create from" value={createFromId} onChange={(event) => setCreateFromId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500/40">{state.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
                                        <Button type="button" onClick={() => void createBranch()} disabled={!boot.is_ready || !canCreate || normalizeKey(createName) === '' || actionKey !== null} className="w-full rounded-xl">{actionKey?.startsWith('create:') ? <RiLoader4Line className="animate-spin" /> : <MdOutlineFileCopy />} Create branch</Button>
                                        {!canCreate || !boot.is_ready ? <p className="text-xs text-amber-600 dark:text-amber-300">{bootReason ?? 'Branch creation is disabled by workspace permissions.'}</p> : null}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <button type="button" onClick={() => void run('refresh', () => runtime.refresh())} disabled={actionKey !== null} aria-label="Refresh branches" className={cn('flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-45 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300')}><MdOutlineRefresh className={actionKey === 'refresh' ? 'animate-spin' : ''} /></button>
                        </div>
                    </div>
                    {actionError ? <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-300">{actionError}</p> : null}
                    <PanelSearch value={query} onChange={setQuery} placeholder="Search branches" className="mt-4" />
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
                    {visibleBranches.map((branch) => (
                        <div key={branch.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                            <div className="min-w-0 flex items-center gap-3">
                                <StatusDot tone={branch.id === state.current_branch_id ? 'success' : 'default'} />
                                <RiGitBranchLine className="shrink-0 text-slate-400" />
                                <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{branch.name}</div><div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{branch.main ? 'Main branch' : 'Workspace branch'}</div></div>
                            </div>
                            <div className="flex items-center gap-2">
                                {branch.id !== state.current_branch_id ? <Button type="button" variant="outline" size="sm" className="rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950" onClick={() => void switchBranch(branch.id)} disabled={actionKey !== null}>{actionKey === `switch:${branch.id}` ? <RiLoader4Line className="animate-spin" /> : <MdCheck />} Switch</Button> : <span className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">Active branch</span>}
                                <Dropdown menu={branchMenu(branch)} align="end"><button type="button" aria-label={`Manage ${branch.name}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"><RiGitMergeLine /></button></Dropdown>
                            </div>
                        </div>
                    ))}
                    {visibleBranches.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">No readable branches matched your search.</div> : null}
                </div>
            </PopoverContent>
        </Popover>
    );
}
