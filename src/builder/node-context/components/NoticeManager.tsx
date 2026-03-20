import { cn } from '@/lib/utils.ts';
import { InputField } from '@timeax/form-palette';
import type { NodeKind, NoticeKind, NoticeSeverity, NoticeType } from '../types.ts';
import { toDraft } from '../utils.ts';

export function NoticeManager({
    noticeManagerOpen,
    closeNoticeManager,
    noticeSearch,
    setNoticeSearch,
    filteredNotices,
    editingNoticeId,
    setNoticeMode,
    setEditingNoticeId,
    setNoticeDraft,
    noticeMode,
    handleNoticeDelete,
    noticeDraft,
    handleUseCurrentSelection,
    nodeOptions,
    nodeOptionsForKind,
    handleNoticeSave,
}) {
    const noticeSelectContentClassName = '';

    return (
        <div
            className="fixed inset-0 z-5 flex items-center justify-center bg-slate-950/40 p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) closeNoticeManager();
            }}
        >
            <div className="flex h-[min(80vh,720px)] w-[min(96vw,1080px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                <aside className="w-80 border-r border-slate-200 dark:border-slate-800">
                    <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notice Manager</p>
                            <button
                                type="button"
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                onClick={() => {
                                    setNoticeMode('create');
                                    setEditingNoticeId(null);
                                    setNoticeDraft(toDraft());
                                }}
                            >
                                New
                            </button>
                        </div>
                        <InputField
                            variant="text"
                            placeholder="Search notices..."
                            value={noticeSearch}
                            onChange={(e: any) => setNoticeSearch(String(e.value ?? ''))}
                        />
                    </div>
                    <div className="max-h-[calc(80vh-52px)] overflow-auto p-2">
                        {filteredNotices.length ? (
                            filteredNotices.map((notice) => (
                                <button
                                    key={notice.id}
                                    type="button"
                                    className={cn(
                                        'mb-2 w-full rounded-lg border px-2 py-2 text-left',
                                        editingNoticeId === notice.id
                                            ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10'
                                            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900',
                                    )}
                                    onClick={() => {
                                        setNoticeMode('edit');
                                        setEditingNoticeId(notice.id);
                                        setNoticeDraft(toDraft(notice));
                                    }}
                                >
                                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{notice.title}</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {notice.kind} · {notice.severity}
                                    </p>
                                </button>
                            ))
                        ) : (
                            <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">No notices yet.</p>
                        )}
                    </div>
                </aside>
                <section className="min-w-0 flex-1 overflow-auto p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {noticeMode === 'create' ? 'Create Notice' : noticeMode === 'edit' ? 'Edit Notice' : 'Manage Notices'}
                        </p>
                        <div className="flex items-center gap-2">
                            {editingNoticeId ? (
                                <button
                                    type="button"
                                    className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                    onClick={() => handleNoticeDelete(editingNoticeId)}
                                >
                                    Delete
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                onClick={closeNoticeManager}
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <InputField
                            variant="text"
                            label="ID"
                            value={noticeDraft.id}
                            onChange={(e: any) => setNoticeDraft((current) => ({ ...current, id: String(e.value ?? '') }))}
                        />
                        <InputField
                            variant="text"
                            label="Marked At"
                            value={noticeDraft.markedAt}
                            placeholder="2026-03-18T12:00:00.000Z"
                            onChange={(e: any) => setNoticeDraft((current) => ({ ...current, markedAt: String(e.value ?? '') }))}
                        />
                        <p className="col-span-2 mt-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            Classification
                        </p>
                        <InputField
                            variant="select"
                            label="Type"
                            value={noticeDraft.type}
                            contentClassName={noticeSelectContentClassName}
                            options={
                                [
                                    { label: 'Private', value: 'private' },
                                    { label: 'Public', value: 'public' },
                                ] as any
                            }
                            onChange={(e: any) => setNoticeDraft((current) => ({ ...current, type: e.value as NoticeType }))}
                        />
                        <InputField
                            variant="select"
                            label="Kind"
                            value={noticeDraft.kind}
                            contentClassName={noticeSelectContentClassName}
                            options={
                                [
                                    { label: 'Label', value: 'label' },
                                    { label: 'Warning', value: 'warning' },
                                    { label: 'Deprecation', value: 'deprecation' },
                                    { label: 'Compat', value: 'compat' },
                                    { label: 'Migration', value: 'migration' },
                                    { label: 'Policy', value: 'policy' },
                                ] as any
                            }
                            onChange={(e: any) => setNoticeDraft((current) => ({ ...current, kind: e.value as NoticeKind }))}
                        />
                        <InputField
                            variant="select"
                            label="Severity"
                            value={noticeDraft.severity}
                            contentClassName={noticeSelectContentClassName}
                            options={
                                [
                                    { label: 'Info', value: 'info' },
                                    { label: 'Warning', value: 'warning' },
                                    { label: 'Error', value: 'error' },
                                ] as any
                            }
                            onChange={(e: any) => setNoticeDraft((current) => ({ ...current, severity: e.value as NoticeSeverity }))}
                        />
                        <InputField
                            variant="select"
                            label="Target Scope"
                            value={noticeDraft.targetScope}
                            contentClassName={noticeSelectContentClassName}
                            options={
                                [
                                    { label: 'Global', value: 'global' },
                                    { label: 'Node', value: 'node' },
                                ] as any
                            }
                            onChange={(e: any) => {
                                const nextScope = e.value as 'global' | 'node';
                                setNoticeDraft((current) => ({
                                    ...current,
                                    targetScope: nextScope,
                                    targetNodeId: nextScope === 'node' ? current.targetNodeId : '',
                                }));
                            }}
                        />
                        <p className="col-span-2 mt-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            Content
                        </p>
                        <div className="flex items-end">
                            <button
                                type="button"
                                className="h-9 rounded-md border border-slate-200 px-2 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                onClick={handleUseCurrentSelection}
                            >
                                Use current selection
                            </button>
                        </div>
                        {noticeDraft.targetScope === 'node' ? (
                            <>
                                <InputField
                                    variant="select"
                                    label="Target Node Kind"
                                    value={noticeDraft.targetNodeKind}
                                    contentClassName={noticeSelectContentClassName}
                                    options={
                                        [
                                            { label: 'Tag', value: 'tag' },
                                            { label: 'Field', value: 'field' },
                                            { label: 'Option', value: 'option' },
                                        ] as any
                                    }
                                    onChange={(e: any) => {
                                        const kind = e.value as NodeKind;
                                        setNoticeDraft((current) => ({
                                            ...current,
                                            targetNodeKind: kind,
                                            targetNodeId:
                                                nodeOptions.find((option) => option.value === current.targetNodeId && option.kind === kind)?.value ??
                                                '',
                                        }));
                                    }}
                                />
                                <InputField
                                    variant="select"
                                    label="Target Node"
                                    value={noticeDraft.targetNodeId}
                                    contentClassName={noticeSelectContentClassName}
                                    options={nodeOptionsForKind as any}
                                    placeholder="Select target node"
                                    onChange={(e: any) => setNoticeDraft((current) => ({ ...current, targetNodeId: String(e.value ?? '') }))}
                                />
                            </>
                        ) : null}
                        <div className="col-span-2">
                            <InputField
                                variant="text"
                                label="Title"
                                value={noticeDraft.title}
                                onChange={(e: any) => setNoticeDraft((current) => ({ ...current, title: String(e.value ?? '') }))}
                            />
                        </div>
                        <div className="col-span-2">
                            <InputField
                                variant="textarea"
                                label="Description"
                                value={noticeDraft.description}
                                onChange={(e: any) => setNoticeDraft((current) => ({ ...current, description: String(e.value ?? '') }))}
                            />
                        </div>
                        <div className="col-span-2">
                            <InputField
                                variant="textarea"
                                label="Reason"
                                value={noticeDraft.reason}
                                onChange={(e: any) => setNoticeDraft((current) => ({ ...current, reason: String(e.value ?? '') }))}
                            />
                        </div>
                        <InputField
                            variant="icon"
                            label="Icon"
                            value={noticeDraft.icon}
                            onChange={(e: any) => setNoticeDraft((current) => ({ ...current, icon: String(e.value ?? '') }))}
                        />
                        <InputField
                            variant="text"
                            label="Color"
                            value={noticeDraft.color}
                            onChange={(e: any) => setNoticeDraft((current) => ({ ...current, color: String(e.value ?? '') }))}
                        />
                        <p className="col-span-2 mt-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Meta</p>
                        <div className="col-span-2">
                            <InputField
                                variant="textarea"
                                label="Meta (JSON object)"
                                value={noticeDraft.metaText}
                                onChange={(e: any) => setNoticeDraft((current) => ({ ...current, metaText: String(e.value ?? '') }))}
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                            onClick={closeNoticeManager}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                            onClick={handleNoticeSave}
                        >
                            Save Notice
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
