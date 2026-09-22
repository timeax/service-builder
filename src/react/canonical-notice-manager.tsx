// SPDX-License-Identifier: GPL-3.0-only
import { cn } from '@/lib/utils.ts';
import { walkOptions } from '@elqora/dgp-core';
import type { ProductNotice, ProductNoticeKind, ProductNoticeSeverity, ProductNoticeTarget, ProductNoticeType } from '@elqora/dgp-spec';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasAPI, useWorkspacePermission, useWorkspaceSelector } from './workspace';

export interface NoticeManagerRequest {
    mode: 'manage' | 'create';
    target?: ProductNoticeTarget;
    token: number;
}

const EMPTY_NOTICES: readonly ProductNotice[] = [];

type NoticeNodeKind = 'tag' | 'field' | 'option';
interface NoticeDraft {
    id: string;
    markedAt: string;
    type: ProductNoticeType;
    kind: ProductNoticeKind;
    severity: ProductNoticeSeverity;
    targetScope: 'global' | 'node';
    targetNodeKind: NoticeNodeKind;
    targetNodeId: string;
    title: string;
    description: string;
    reason: string;
    icon: string;
    color: string;
    metaText: string;
}

function draftFromNotice(notice?: ProductNotice, target?: ProductNoticeTarget): NoticeDraft {
    const resolvedTarget = target ?? notice?.target ?? { scope: 'global' as const };
    const meta = notice?.meta ?? {};
    const { icon, color } = meta;
    const otherMeta = { ...meta };
    if (typeof icon === 'string') delete otherMeta.icon;
    if (typeof color === 'string') delete otherMeta.color;
    return {
        id: notice?.id ?? `notice:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        markedAt: notice?.marked_at ?? '',
        type: notice?.type ?? 'private', kind: notice?.kind ?? 'label', severity: notice?.severity ?? 'info',
        targetScope: resolvedTarget.scope, targetNodeKind: resolvedTarget.scope === 'node' ? resolvedTarget.node_kind : 'tag',
        targetNodeId: resolvedTarget.scope === 'node' ? resolvedTarget.node_id : '',
        title: notice?.title ?? '', description: notice?.description ?? '', reason: notice?.reason ?? '',
        icon: typeof icon === 'string' ? icon : '', color: typeof color === 'string' ? color : '',
        metaText: Object.keys(otherMeta).length ? JSON.stringify(otherMeta, null, 2) : '',
    };
}

function noticeFromDraft(draft: NoticeDraft): ProductNotice {
    const rawMeta = draft.metaText.trim();
    const parsed: unknown = rawMeta ? JSON.parse(rawMeta) : {};
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Meta must be a JSON object');
    const meta = { ...(parsed as Record<string, unknown>) };
    if (draft.icon.trim()) meta.icon = draft.icon.trim();
    if (draft.color.trim()) meta.color = draft.color.trim();
    return {
        id: draft.id.trim(), type: draft.type, kind: draft.kind, severity: draft.severity,
        target: draft.targetScope === 'node'
            ? { scope: 'node', node_kind: draft.targetNodeKind, node_id: draft.targetNodeId.trim() }
            : { scope: 'global' },
        title: draft.title.trim(),
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
        ...(draft.markedAt.trim() ? { marked_at: draft.markedAt.trim() } : {}),
        meta,
    };
}

export function CanonicalNoticeManager({ request, onClose }: { request: NoticeManagerRequest | null; onClose(): void }) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const isOpen = request !== null;
    const canvas = useCanvasAPI();
    const definition = useWorkspaceSelector((state) => state.definition);
    const canEdit = useWorkspacePermission('document.mutate');
    const notices = definition?.notices ?? EMPTY_NOTICES;
    const [mode, setMode] = useState<'manage' | 'create' | 'edit'>('manage');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<NoticeDraft>(() => draftFromNotice());
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!request) return;
        setSearch('');
        setError(null);
        if (request.mode === 'create') {
            setMode('create');
            setEditingId(null);
            setDraft(draftFromNotice(undefined, request.target));
        } else {
            const first = notices[0];
            setMode(first ? 'edit' : 'manage');
            setEditingId(first?.id ?? null);
            setDraft(draftFromNotice(first));
        }
        // Each opening has a distinct token; later notice changes must not erase an in-progress draft.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request?.token]);

    useEffect(() => {
        if (!request) return;
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [onClose, request]);

    useEffect(() => {
        if (!isOpen) return;
        const opener = document.activeElement;
        dialogRef.current?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus();
        return () => {
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, [isOpen]);

    const keepFocusInDialog = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return;
        const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
            .filter((element) => !element.matches(':disabled') && element.tabIndex >= 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    };

    const nodeOptions = useMemo(() => {
        if (!definition) return [];
        return [
            ...definition.filters.map((filter) => ({ value: filter.id, kind: 'tag' as const, label: `tag: ${filter.label}` })),
            ...definition.fields.map((field) => ({ value: field.id, kind: 'field' as const, label: `field: ${field.label}` })),
            ...walkOptions(definition).map(({ option }) => ({ value: option.id, kind: 'option' as const, label: `option: ${option.label}` })),
        ];
    }, [definition]);
    const filteredNotices = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return notices;
        return notices.filter((notice) => {
            const target = notice.target.scope === 'node' ? notice.target.node_id : 'global';
            return `${notice.title} ${notice.kind} ${notice.severity} ${notice.id} ${target}`.toLowerCase().includes(query);
        });
    }, [notices, search]);
    const nodeOptionsForKind = nodeOptions.filter((item) => item.kind === draft.targetNodeKind).map((item) => ({ label: item.label, value: item.value }));

    const save = () => {
        if (!canEdit || !canvas) return;
        try {
            const notice = noticeFromDraft(draft);
            if (!notice.id) throw new Error('Notice id is required');
            if (!notice.title) throw new Error('Notice title is required');
            const noticeTarget = notice.target;
            if (noticeTarget.scope === 'node') {
                if (!noticeTarget.node_id) throw new Error('Node target is required');
                const matched = nodeOptions.find((item) => item.value === noticeTarget.node_id);
                if (!matched) throw new Error('Selected node target no longer exists');
                if (matched.kind !== noticeTarget.node_kind) throw new Error('Selected node does not match target kind');
            }
            if (notices.some((item) => item.id === notice.id && item.id !== editingId)) throw new Error('Notice id already exists');
            if (editingId && editingId !== notice.id) {
                canvas.editor.transact('notice:rename', () => {
                    canvas.editor.remove_notice(editingId);
                    canvas.editor.add_notice(notice);
                });
            } else if (editingId) canvas.editor.update_notice(editingId, notice);
            else canvas.editor.add_notice(notice);
            setEditingId(notice.id);
            setMode('edit');
            setDraft(draftFromNotice(notice));
            setError(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to save notice.');
        }
    };

    const remove = () => {
        if (!canEdit || !canvas || !editingId) return;
        try {
            canvas.editor.remove_notice(editingId);
            const next = notices.find((item) => item.id !== editingId);
            setEditingId(next?.id ?? null);
            setMode(next ? 'edit' : 'manage');
            setDraft(draftFromNotice(next));
            setError(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to delete notice.');
        }
    };

    const useCurrentSelection = () => {
        const primary = canvas?.selection.primary();
        const selected = canvas ? [...canvas.snapshot().selection] : [];
        const candidate = [primary, ...selected].filter((id): id is string => Boolean(id)).map((id) => nodeOptions.find((option) => option.value === id)).find(Boolean);
        if (!candidate) {
            setError('No eligible selected node for notice target');
            return;
        }
        setDraft((current) => ({ ...current, targetScope: 'node', targetNodeKind: candidate.kind, targetNodeId: candidate.value }));
        setError(null);
    };

    if (!request || typeof document === 'undefined') return null;
    const set = <K extends keyof NoticeDraft>(key: K, value: NoticeDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
    const select = <T extends string>(key: keyof NoticeDraft, value: T) => setDraft((current) => ({ ...current, [key]: value }));
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Notice Manager" onKeyDown={keepFocusInDialog} className="flex h-[min(80vh,720px)] w-[min(96vw,1080px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                <aside className="w-80 border-r border-slate-200 dark:border-slate-800">
                    <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notice Manager</p>
                            <button type="button" disabled={!canEdit} title={!canEdit ? 'Editing is disabled for this actor.' : undefined} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900" onClick={() => {
                                setMode('create'); setEditingId(null); setDraft(draftFromNotice()); setError(null);
                            }}>New</button>
                        </div>
                        <InputField variant="text" placeholder="Search notices..." value={search} onChange={(event) => setSearch(String(event.value ?? ''))} />
                    </div>
                    <div className="max-h-[calc(80vh-52px)] overflow-auto p-2">
                        {filteredNotices.length ? filteredNotices.map((notice) => (
                            <button key={notice.id} type="button" className={cn('mb-2 w-full rounded-lg border px-2 py-2 text-left', editingId === notice.id ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900')} onClick={() => {
                                setMode('edit'); setEditingId(notice.id); setDraft(draftFromNotice(notice)); setError(null);
                            }}>
                                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{notice.title}</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{notice.kind} · {notice.severity}</p>
                            </button>
                        )) : <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">No notices yet.</p>}
                    </div>
                </aside>
                <section className="min-w-0 flex-1 overflow-auto p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{mode === 'create' ? 'Create Notice' : mode === 'edit' ? 'Edit Notice' : 'Manage Notices'}</p>
                        <div className="flex items-center gap-2">
                            {editingId ? <button type="button" disabled={!canEdit} title={!canEdit ? 'Editing is disabled for this actor.' : undefined} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10" onClick={remove}>Delete</button> : null}
                            <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900" onClick={onClose}>Close</button>
                        </div>
                    </div>
                    <fieldset disabled={!canEdit} className="m-0 grid min-w-0 grid-cols-2 gap-3 border-0 p-0">
                        <InputField variant="text" label="ID" value={draft.id} onChange={(event) => set('id', String(event.value ?? ''))} />
                        <InputField variant="text" label="Marked At" value={draft.markedAt} placeholder="2026-03-18T12:00:00.000Z" onChange={(event) => set('markedAt', String(event.value ?? ''))} />
                        <p className="col-span-2 mt-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Classification</p>
                        <InputField variant="select" label="Type" value={draft.type} options={[{ label: 'Private', value: 'private' }, { label: 'Public', value: 'public' }]} onChange={(event) => select('type', String(event.value ?? 'private'))} />
                        <InputField variant="select" label="Kind" value={draft.kind} options={[{ label: 'Label', value: 'label' }, { label: 'Warning', value: 'warning' }, { label: 'Deprecation', value: 'deprecation' }, { label: 'Compat', value: 'compat' }, { label: 'Migration', value: 'migration' }, { label: 'Policy', value: 'policy' }]} onChange={(event) => select('kind', String(event.value ?? 'label'))} />
                        <InputField variant="select" label="Severity" value={draft.severity} options={[{ label: 'Info', value: 'info' }, { label: 'Warning', value: 'warning' }, { label: 'Error', value: 'error' }]} onChange={(event) => select('severity', String(event.value ?? 'info'))} />
                        <InputField variant="select" label="Target Scope" value={draft.targetScope} options={[{ label: 'Global', value: 'global' }, { label: 'Node', value: 'node' }]} onChange={(event) => {
                            const scope = event.value === 'node' ? 'node' : 'global';
                            setDraft((current) => ({ ...current, targetScope: scope, targetNodeId: scope === 'node' ? current.targetNodeId : '' }));
                        }} />
                        <p className="col-span-2 mt-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Content</p>
                        <div className="flex items-end"><button type="button" className="h-9 rounded-md border border-slate-200 px-2 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900" onClick={useCurrentSelection}>Use current selection</button></div>
                        {draft.targetScope === 'node' ? <>
                            <InputField variant="select" label="Target Node Kind" value={draft.targetNodeKind} options={[{ label: 'Tag', value: 'tag' }, { label: 'Field', value: 'field' }, { label: 'Option', value: 'option' }]} onChange={(event) => {
                                const kind = event.value as NoticeNodeKind;
                                setDraft((current) => ({ ...current, targetNodeKind: kind, targetNodeId: nodeOptions.find((item) => item.value === current.targetNodeId && item.kind === kind)?.value ?? '' }));
                            }} />
                            <InputField variant="select" label="Target Node" value={draft.targetNodeId} options={nodeOptionsForKind} placeholder="Select target node" onChange={(event) => set('targetNodeId', String(event.value ?? ''))} />
                        </> : null}
                        <div className="col-span-2"><InputField variant="text" label="Title" value={draft.title} onChange={(event) => set('title', String(event.value ?? ''))} /></div>
                        <div className="col-span-2"><InputField variant="textarea" label="Description" value={draft.description} onChange={(event) => set('description', String(event.value ?? ''))} /></div>
                        <div className="col-span-2"><InputField variant="textarea" label="Reason" value={draft.reason} onChange={(event) => set('reason', String(event.value ?? ''))} /></div>
                        <InputField variant="icon" label="Icon" value={draft.icon} onChange={(event) => set('icon', String(event.value ?? ''))} />
                        <InputField variant="text" label="Color" value={draft.color} onChange={(event) => set('color', String(event.value ?? ''))} />
                        <p className="col-span-2 mt-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Meta</p>
                        <div className="col-span-2"><InputField variant="textarea" label="Meta (JSON object)" value={draft.metaText} onChange={(event) => set('metaText', String(event.value ?? ''))} /></div>
                    </fieldset>
                    {error ? <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900" onClick={onClose}>Cancel</button>
                        <button type="button" disabled={!canEdit} title={!canEdit ? 'Editing is disabled for this actor.' : undefined} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={save}>Save Notice</button>
                    </div>
                </section>
            </div>
        </div>, document.body,
    );
}
