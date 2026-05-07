import { DRAG_MIME_ASSET_BUILTIN, DRAG_MIME_ASSET_TEMPLATE } from '@/builder/node-context/types.ts';
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
import { WorkspaceBootInlineNotice } from '@/workspace/boot-status.tsx';
import { useInputs } from '@timeax/digital-service-engine/react';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineReload } from 'react-icons/ai';
import { CiSearch } from 'react-icons/ci';
import { LuBox, LuShapes } from 'react-icons/lu';

type BuiltinAsset = {
    key: string;
    kind: string;
    variant?: string;
    label: string;
};

type TemplateContextTarget = {
    id: string;
    name: string;
    clientX: number;
    clientY: number;
};
type TemplateActionTarget = {
    id: string;
    name: string;
};

function toTitle(value: string) {
    return value
        .split(/[-_:]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export default function AssetsPanel() {
    const ws = useWorkspace();
    const { registry } = useInputs();
    const [query, setQuery] = useState('');
    const [menuTarget, setMenuTarget] = useState<TemplateContextTarget | null>(null);
    const [actionTarget, setActionTarget] = useState<TemplateActionTarget | null>(null);
    const [renameOpen, setRenameOpen] = useState(false);
    const [cloneOpen, setCloneOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [saveToCurrentBranch, setSaveToCurrentBranch] = useState(true);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const normalizedBuiltins = useMemo<BuiltinAsset[]>(() => {
        const items: BuiltinAsset[] = [];
        for (const [kind, variants] of registry._store.entries()) {
            for (const [variant] of variants.entries()) {
                const key = `${String(kind)}::${String(variant)}`;
                const label = variant === 'default' ? toTitle(String(kind)) : `${toTitle(String(kind))} (${toTitle(String(variant))})`;
                items.push({
                    key,
                    kind: String(kind),
                    variant: variant === 'default' ? undefined : String(variant),
                    label,
                });
            }
        }
        return items.sort((a, b) => a.label.localeCompare(b.label));
    }, [registry._store]);

    const templates = useMemo(() => {
        return [...(ws.templates.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    }, [ws.templates.data]);

    const lower = query.trim().toLowerCase();
    const filteredBuiltins = lower
        ? normalizedBuiltins.filter((item) => item.label.toLowerCase().includes(lower) || item.kind.toLowerCase().includes(lower))
        : normalizedBuiltins;
    const filteredTemplates = lower
        ? templates.filter(
              (item) =>
                  item.name.toLowerCase().includes(lower) ||
                  String(item.kind ?? '')
                      .toLowerCase()
                      .includes(lower),
          )
        : templates;

    const closeTemplateContextMenu = useCallback(() => setMenuTarget(null), []);
    const openTemplateContextMenu = useCallback((item: { id: string; name: string }, clientX: number, clientY: number) => {
        setMenuTarget({
            id: item.id,
            name: item.name,
            clientX,
            clientY,
        });
    }, []);

    useEffect(() => {
        if (!menuTarget) return;
        const onPointerDown = (event: PointerEvent) => {
            const el = menuRef.current;
            if (!el || el.contains(event.target as Node)) return;
            setMenuTarget(null);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuTarget(null);
        };
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [menuTarget]);

    const templateMenuAnchorStyle = useMemo(() => {
        if (!menuTarget || typeof window === 'undefined') return null;
        const width = 220;
        const height = 164;
        const padding = 12;
        const left = Math.max(padding, Math.min(menuTarget.clientX, window.innerWidth - width - padding));
        const top = Math.max(padding, Math.min(menuTarget.clientY, window.innerHeight - height - padding));
        return { left, top };
    }, [menuTarget]);

    const applyBranchScope = useCallback(() => {
        if (saveToCurrentBranch) return ws.branches.currentId ?? undefined;
        return null as string | null;
    }, [saveToCurrentBranch, ws.branches.currentId]);

    const refreshTemplates = useCallback(async () => {
        await ws.refresh.templates({ branchId: ws.branches.currentId ?? undefined });
    }, [ws]);

    const openRenameDialog = useCallback(() => {
        if (!menuTarget) return;
        setActionTarget({ id: menuTarget.id, name: menuTarget.name });
        setTemplateName(menuTarget.name);
        setSaveToCurrentBranch(true);
        setRenameOpen(true);
        closeTemplateContextMenu();
    }, [closeTemplateContextMenu, menuTarget]);

    const openCloneDialog = useCallback(() => {
        if (!menuTarget) return;
        setActionTarget({ id: menuTarget.id, name: menuTarget.name });
        setTemplateName(`Copy of ${menuTarget.name}`);
        setSaveToCurrentBranch(true);
        setCloneOpen(true);
        closeTemplateContextMenu();
    }, [closeTemplateContextMenu, menuTarget]);

    const openDeleteDialog = useCallback(() => {
        if (!menuTarget) return;
        setActionTarget({ id: menuTarget.id, name: menuTarget.name });
        setDeleteOpen(true);
        closeTemplateContextMenu();
    }, [closeTemplateContextMenu, menuTarget]);

    const handleRenameTemplate = useCallback(async () => {
        if (!actionTarget || !templateName.trim()) return;
        const result = await ws.updateTemplate(actionTarget.id, {
            name: templateName.trim(),
            branchId: applyBranchScope(),
        });
        if (!result.ok) return;
        setRenameOpen(false);
        setActionTarget(null);
        await refreshTemplates();
    }, [actionTarget, applyBranchScope, refreshTemplates, templateName, ws]);

    const handleCloneTemplate = useCallback(async () => {
        if (!actionTarget || !templateName.trim()) return;
        const result = await ws.cloneTemplate(
            { id: actionTarget.id },
            {
                name: templateName.trim(),
                branchId: applyBranchScope() as unknown as string | undefined,
            },
        );
        if (!result.ok) return;
        setCloneOpen(false);
        setActionTarget(null);
        await refreshTemplates();
    }, [actionTarget, applyBranchScope, refreshTemplates, templateName, ws]);

    const handleDeleteTemplate = useCallback(async () => {
        if (!actionTarget) return;
        const result = await ws.deleteTemplate(actionTarget.id);
        if (!result.ok) return;
        setDeleteOpen(false);
        setActionTarget(null);
        await refreshTemplates();
    }, [actionTarget, refreshTemplates, ws]);

    return (
        <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <label className="relative">
                <InputField
                    value={query}
                    onChange={(event) => setQuery(event.value)}
                    placeholder="Search assets"
                    variant={'text'}
                    icon={<CiSearch className="pointer-events-none text-slate-400" />}
                    trailingControl={
                        <span
                            className="px-2"
                            onClick={() => void ws.refresh.templates({ branchId: ws.branches.currentId ?? undefined, since: 0 })}
                        >
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
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData(
                                            DRAG_MIME_ASSET_BUILTIN,
                                            JSON.stringify({
                                                kind: item.kind,
                                                variant: item.variant,
                                                label: item.label,
                                            }),
                                        );
                                        event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700"
                                >
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {item.variant ? `${item.kind} / ${item.variant}` : item.kind}
                                    </p>
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
                    <WorkspaceBootInlineNotice boot={ws.boot} sections={['templates']} className="mb-3" />
                    <div className="grid grid-cols-2 gap-2">
                        {filteredTemplates.length ? (
                            filteredTemplates.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData(
                                            DRAG_MIME_ASSET_TEMPLATE,
                                            JSON.stringify({
                                                id: item.id,
                                                name: item.name,
                                                kind: item.kind,
                                            }),
                                        );
                                        event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onPointerDownCapture={(event) => {
                                        const isSecondaryClick = event.button === 2 || (event.button === 0 && event.ctrlKey);
                                        if (!isSecondaryClick) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openTemplateContextMenu(item, event.clientX, event.clientY);
                                    }}
                                    onContextMenu={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openTemplateContextMenu(item, event.clientX, event.clientY);
                                    }}
                                    onAuxClick={(event) => {
                                        if (event.button !== 2) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openTemplateContextMenu(item, event.clientX, event.clientY);
                                    }}
                                    className="w-full *:pointer-events-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700"
                                >
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {item?.definition?.mode === 'group'
                                            ? 'Group'
                                            : String((item?.definition as Record<string, unknown>)?.type ?? item.kind ?? 'template')}
                                    </p>
                                </button>
                            ))
                        ) : (
                            <EmptyState title="No templates" description="No saved templates matched your search." className="min-h-36" />
                        )}
                    </div>
                </section>
            </ScrollArea>
            {menuTarget && templateMenuAnchorStyle ? (
                <div
                    ref={menuRef}
                    className="fixed z-40 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
                    style={{ left: templateMenuAnchorStyle.left, top: templateMenuAnchorStyle.top }}
                    role="menu"
                >
                    <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                        onClick={openRenameDialog}
                    >
                        Rename template
                    </button>
                    <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                        onClick={openCloneDialog}
                    >
                        Clone template
                    </button>
                    <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
                    <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        onClick={openDeleteDialog}
                    >
                        Delete template
                    </button>
                </div>
            ) : null}

            <AlertDialog
                open={renameOpen}
                onOpenChange={(open) => {
                    setRenameOpen(open);
                    if (!open) setActionTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rename template</AlertDialogTitle>
                        <AlertDialogDescription>Update template name and scope.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <InputField
                            variant={'text'}
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
                        <AlertDialogAction type="button" disabled={!templateName.trim()} onClick={() => void handleRenameTemplate()}>
                            Save
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={cloneOpen}
                onOpenChange={(open) => {
                    setCloneOpen(open);
                    if (!open) setActionTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clone template</AlertDialogTitle>
                        <AlertDialogDescription>Create a copy with a new name and scope.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <InputField
                            variant={'text'}
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
                        <AlertDialogAction type="button" disabled={!templateName.trim()} onClick={() => void handleCloneTemplate()}>
                            Clone
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={deleteOpen}
                onOpenChange={(open) => {
                    setDeleteOpen(open);
                    if (!open) setActionTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete template</AlertDialogTitle>
                        <AlertDialogDescription>This action permanently removes the selected template.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction type="button" className="bg-rose-600 hover:bg-rose-700" onClick={() => void handleDeleteTemplate()}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
