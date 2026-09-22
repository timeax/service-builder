// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState } from '@/components/builder/index.tsx';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { BUILT_IN_INPUT_TYPES } from '@elqora/dgp-ordering-form-palette';
import { InputField } from '@timeax/form-palette';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineReload } from 'react-icons/ai';
import { CiSearch } from 'react-icons/ci';
import { LuBox, LuShapes } from 'react-icons/lu';
import { CanonicalWorkspaceBootInlineNotice } from './canonical-boot-status';
import { DRAG_MIME_ASSET_BUILTIN, DRAG_MIME_ASSET_TEMPLATE } from './drag-contracts';
import { useWorkspacePermission, useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

type MenuTarget = { id: string; name: string; clientX: number; clientY: number };
type ActionTarget = Pick<MenuTarget, 'id' | 'name'>;
const title = (value: string) =>
    value
        .split(/[-_:]/g)
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join(' ');

export function CanonicalAssets() {
    const runtime = useWorkspaceRuntime();
    const templates = useWorkspaceSelector((state) => [...state.templates].sort((a, b) => a.name.localeCompare(b.name)));
    const branchId = useWorkspaceSelector((state) => state.current_branch_id);
    const canMutate = useWorkspacePermission('document.mutate');
    const canWrite = useWorkspacePermission('template.write');
    const mutationDeniedReason = canMutate ? undefined : 'You do not have permission to edit this definition.';
    const templateDeniedReason = canWrite ? undefined : 'You do not have permission to manage templates.';
    const [query, setQuery] = useState('');
    const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
    const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
    const [dialog, setDialog] = useState<'rename' | 'clone' | 'delete' | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [saveToCurrentBranch, setSaveToCurrentBranch] = useState(true);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const builtins = useMemo(() => BUILT_IN_INPUT_TYPES.map((kind) => ({ key: `${kind}::default`, kind, label: title(kind) })), []);
    const lower = query.trim().toLowerCase();
    const filteredBuiltins = lower ? builtins.filter((item) => item.label.toLowerCase().includes(lower)) : builtins;
    const filteredTemplates = lower
        ? templates.filter((item) => item.name.toLowerCase().includes(lower) || item.field.type.toLowerCase().includes(lower))
        : templates;

    useEffect(() => {
        if (!menuTarget) return;
        const close = (event: PointerEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuTarget(null);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuTarget(null);
        };
        window.addEventListener('pointerdown', close);
        window.addEventListener('keydown', escape);
        return () => {
            window.removeEventListener('pointerdown', close);
            window.removeEventListener('keydown', escape);
        };
    }, [menuTarget]);
    const anchor = useMemo(
        () =>
            menuTarget && typeof window !== 'undefined'
                ? {
                      left: Math.max(12, Math.min(menuTarget.clientX, window.innerWidth - 232)),
                      top: Math.max(12, Math.min(menuTarget.clientY, window.innerHeight - 176)),
                  }
                : null,
        [menuTarget],
    );
    const openMenu = useCallback((item: ActionTarget, clientX: number, clientY: number) => setMenuTarget({ ...item, clientX, clientY }), []);
    const openDialog = (kind: NonNullable<typeof dialog>) => {
        if (!menuTarget) return;
        setActionTarget({ id: menuTarget.id, name: menuTarget.name });
        setTemplateName(kind === 'clone' ? `Copy of ${menuTarget.name}` : menuTarget.name);
        setSaveToCurrentBranch(true);
        setDialog(kind);
        setMenuTarget(null);
    };
    const scope = () => (saveToCurrentBranch ? branchId : null);
    const applyRename = async () => {
        if (!actionTarget || !templateName.trim()) return;
        const result = await runtime.update_template(actionTarget.id, { name: templateName.trim(), branch_id: scope() });
        if (result.ok) setDialog(null);
    };
    const applyClone = async () => {
        if (!actionTarget || !templateName.trim()) return;
        const result = await runtime.clone_template({ id: actionTarget.id }, { name: templateName.trim(), branch_id: scope() });
        if (result.ok) setDialog(null);
    };
    const applyDelete = async () => {
        if (!actionTarget) return;
        const result = await runtime.delete_template(actionTarget.id);
        if (result.ok) setDialog(null);
    };

    return (
        <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <label className="relative">
                <InputField
                    value={query}
                    onChange={(event) => setQuery(String(event.value ?? ''))}
                    placeholder="Search assets"
                    variant="text"
                    icon={<CiSearch className="pointer-events-none text-slate-400" />}
                    trailingControl={
                        <span className="px-2" onClick={() => void runtime.refresh_branch()}>
                            <AiOutlineReload />
                        </span>
                    }
                />
            </label>
            <ScrollArea className="mt-3 min-h-0 flex-1 pr-1">
                <section>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                        <LuShapes />
                        Built-in Inputs
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {filteredBuiltins.length ? (
                            filteredBuiltins.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    draggable={canMutate}
                                    title={mutationDeniedReason}
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData(DRAG_MIME_ASSET_BUILTIN, JSON.stringify({ kind: item.kind, label: item.label }));
                                        event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700"
                                >
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.kind}</p>
                                </button>
                            ))
                        ) : (
                            <EmptyState title="No built-ins" description="No registry input entries matched your search." className="min-h-36" />
                        )}
                    </div>
                </section>
                <section className="mt-5">
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                        <LuBox />
                        Saved Templates
                    </h4>
                    <CanonicalWorkspaceBootInlineNotice sections={['templates']} className="mb-3" />
                    <div className="grid grid-cols-2 gap-2">
                        {filteredTemplates.length ? (
                            filteredTemplates.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    draggable={canMutate}
                                    title={mutationDeniedReason}
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData(
                                            DRAG_MIME_ASSET_TEMPLATE,
                                            JSON.stringify({ id: item.id, name: item.name, kind: item.field.type }),
                                        );
                                        event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onContextMenu={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openMenu(item, event.clientX, event.clientY);
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition *:pointer-events-none hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700"
                                >
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.field.type}</p>
                                </button>
                            ))
                        ) : (
                            <EmptyState title="No templates" description="No saved templates matched your search." className="min-h-36" />
                        )}
                    </div>
                </section>
            </ScrollArea>
            {menuTarget && anchor ? (
                <div
                    ref={menuRef}
                    className="fixed z-40 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
                    style={anchor}
                    role="menu"
                >
                    <button
                        type="button"
                        disabled={!canWrite}
                        title={templateDeniedReason}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                        onClick={() => openDialog('rename')}
                    >
                        Rename template
                    </button>
                    <button
                        type="button"
                        disabled={!canWrite}
                        title={templateDeniedReason}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                        onClick={() => openDialog('clone')}
                    >
                        Clone template
                    </button>
                    <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
                    <button
                        type="button"
                        disabled={!canWrite}
                        title={templateDeniedReason}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        onClick={() => openDialog('delete')}
                    >
                        Delete template
                    </button>
                </div>
            ) : null}
            <AlertDialog
                open={dialog === 'rename'}
                onOpenChange={(open) => {
                    if (!open) setDialog(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rename template</AlertDialogTitle>
                        <AlertDialogDescription>Update template name and scope.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <InputField
                            variant="text"
                            value={templateName}
                            onChange={(event) => setTemplateName(String(event.value ?? ''))}
                            placeholder="Template name"
                        />
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={saveToCurrentBranch} onChange={(event) => setSaveToCurrentBranch(event.target.checked)} />
                            <span>Save to current branch</span>
                        </label>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction type="button" disabled={!templateName.trim()} onClick={() => void applyRename()}>
                            Save
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
                open={dialog === 'clone'}
                onOpenChange={(open) => {
                    if (!open) setDialog(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clone template</AlertDialogTitle>
                        <AlertDialogDescription>Create a copy with a new name and scope.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <InputField
                            variant="text"
                            value={templateName}
                            onChange={(event) => setTemplateName(String(event.value ?? ''))}
                            placeholder="Template name"
                        />
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={saveToCurrentBranch} onChange={(event) => setSaveToCurrentBranch(event.target.checked)} />
                            <span>Save to current branch</span>
                        </label>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction type="button" disabled={!templateName.trim()} onClick={() => void applyClone()}>
                            Clone
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
                open={dialog === 'delete'}
                onOpenChange={(open) => {
                    if (!open) setDialog(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete template</AlertDialogTitle>
                        <AlertDialogDescription>This action permanently removes the selected template.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction type="button" className="bg-rose-600 hover:bg-rose-700" onClick={() => void applyDelete()}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
