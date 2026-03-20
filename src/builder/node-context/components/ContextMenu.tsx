import { getNodeLabel } from '../utils.ts';
import { useNodeActions } from '../hooks.ts';

export function ContextMenu({
    target,
    setTarget,
    setDialogTarget,
    setRenameOpen,
    setDeleteOpen,
    openNoticeManager,
    activeNode,
    anchorStyle,
    menuRef,
    setRenameValue
}) {
    const { handleDuplicate, handleCopyId, handleSaveAsTemplate } = useNodeActions(
        target,
        setTarget,
        setDialogTarget,
        setRenameOpen,
        setDeleteOpen,
        openNoticeManager,
    );

    return (
        <div
            ref={menuRef}
            className="fixed z-40 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
            style={{ left: anchorStyle.left, top: anchorStyle.top }}
            role="menu"
        >
            <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={() => {
                    setRenameValue(getNodeLabel(activeNode, target.nodeId));
                    setDialogTarget(target);
                    setRenameOpen(true);
                    setTarget(null);
                }}
            >
                Rename
            </button>
            <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={handleDuplicate}
            >
                Duplicate
            </button>
            <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={() => void handleCopyId()}
            >
                Copy ID
            </button>
            <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={() => {
                    openNoticeManager({
                        mode: 'create',
                        target: {
                            scope: 'node',
                            node_kind: target.nodeKind,
                            node_id: target.nodeId,
                        },
                    });
                    setTarget(null);
                }}
            >
                Add notice
            </button>
            {target.nodeKind === 'field' ? (
                <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                    onClick={() => void handleSaveAsTemplate()}
                >
                    Save as template
                </button>
            ) : null}
            <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
            <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                onClick={() => {
                    setDialogTarget(target);
                    setDeleteOpen(true);
                    setTarget(null);
                }}
            >
                Delete
            </button>
        </div>
    );
}
