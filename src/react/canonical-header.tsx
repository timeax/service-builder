// SPDX-License-Identifier: GPL-3.0-only
import { BuilderIconButton } from '@/components/builder';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMemo, useState } from 'react';
import { BsChevronDown, BsChevronRight } from 'react-icons/bs';
import { MdMenuOpen, MdOutlineSpaceDashboard } from 'react-icons/md';
import { createCanonicalBootModel, getCanonicalBootHeadline } from './boot';
import { CanonicalDrafts } from './canonical-drafts';
import type { ServiceBuilderMenuItem } from './contracts';
import { useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

function runAfterPaint(callback: () => void) {
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.setTimeout(callback, 0));
    } else {
        window.setTimeout(callback, 0);
    }
}

function MenuRenderer({ items, runtime, onCommand }: { items: ServiceBuilderMenuItem[]; runtime: ReturnType<typeof useWorkspaceRuntime>; onCommand: (command: NonNullable<ServiceBuilderMenuItem['command']>) => void }) {
    const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
    return (
        <ul className="flex flex-col gap-1">
            {items.map((item, index) => {
                const hasChildren = (item.children?.length ?? 0) > 0;
                const isOpen = openSubmenus[item.name];
                if (item.render) return <li key={index}>{item.render()}</li>;
                return (
                    <li key={index} className="flex flex-col">
                        <button type="button" onClick={() => { if (hasChildren) setOpenSubmenus((current) => ({ ...current, [item.name]: !current[item.name] })); else if (item.command) onCommand(item.command); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                            {item.icon ? <span className="flex h-4 w-4 items-center justify-center text-slate-500">{item.icon}</span> : null}
                            <span className="flex-1 text-left">{item.name}</span>
                            {hasChildren ? <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}><BsChevronRight className="h-3 w-3" /></span> : null}
                        </button>
                        {hasChildren && isOpen ? <div className="mt-1 ml-4 border-l border-slate-200 pl-2 dark:border-slate-800"><MenuRenderer items={item.children!} runtime={runtime} onCommand={onCommand} /></div> : null}
                    </li>
                );
            })}
        </ul>
    );
}

export interface CanonicalHeaderProps {
    menu?: ServiceBuilderMenuItem[];
}

export function CanonicalHeader({ menu = [] }: CanonicalHeaderProps) {
    const runtime = useWorkspaceRuntime();
    const state = useWorkspaceSelector((current) => current);
    const boot = useMemo(() => createCanonicalBootModel(state, runtime), [runtime, state]);
    const currentBranch = state.branches.find((branch) => branch.id === state.current_branch_id);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const fullMenu: ServiceBuilderMenuItem[] = [
        { name: 'Status', render: () => <div className="px-2 py-1.5 text-xs font-medium tracking-wider text-slate-500 uppercase">{getCanonicalBootHeadline(boot)}</div> },
        ...menu,
    ];

    return (
        <>
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><MdOutlineSpaceDashboard className="text-base" /></span>
                        <div className="flex flex-col justify-center gap-0">
                            <h1 className="text-base leading-tight font-semibold text-slate-900 dark:text-slate-100">Service Builder</h1>
                            <CanonicalDrafts trigger={<button type="button" className="inline-flex cursor-pointer items-center gap-1 rounded-md text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"><span>Active branch - <b>{currentBranch?.name ?? 'Main branch'}</b></span><BsChevronDown /></button>} />
                        </div>
                    </div>
                    <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                        <PopoverTrigger asChild><span><BuilderIconButton title="Menu"><MdMenuOpen /></BuilderIconButton></span></PopoverTrigger>
                        {isMenuOpen ? <PopoverContent className="w-56 p-2" align="end"><MenuRenderer items={fullMenu} runtime={runtime} onCommand={(command) => { setIsMenuOpen(false); runAfterPaint(() => void command(runtime)); }} /></PopoverContent> : null}
                    </Popover>
                </div>
            </div>
        </>
    );
}
