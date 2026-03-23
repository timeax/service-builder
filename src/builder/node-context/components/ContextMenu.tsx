import { useEffect } from 'react';
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
    const {
        handleDuplicate,
        handleCopyId,
        handleSaveAsTemplate,
        canQuickAddFallbacks,
        handleOpenFallbackQuickAdd,
        isFieldOptionsShown,
        handleToggleFieldOptions,
        canMoveUp,
        canMoveDown,
        canMoveContextUp,
        canMoveContextDown,
        handleMoveUp,
        handleMoveDown,
        handleMoveUpInContext,
        handleMoveDownInContext,
    } = useNodeActions(target, setTarget, setDialogTarget, setRenameOpen, setDeleteOpen, openNoticeManager);
    const showWireframeMoveActions = target.surface === 'wireframe';
    const showWireframeContextMoveActions = showWireframeMoveActions && target.nodeKind === 'field';

    useEffect(() => {
        if (!showWireframeMoveActions) return;

        const isEditableTarget = (eventTarget: EventTarget | null) => {
            const element = eventTarget as HTMLElement | null;
            if (!element) return false;
            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return true;
            if (element.isContentEditable) return true;
            if (typeof (element as any).closest !== 'function') return false;
            return element.closest('[contenteditable=""],[contenteditable="true"],[role="combobox"],input,textarea') !== null;
        };

        const onKeyDown = (event: KeyboardEvent) => {
            const isArrow = event.key === 'ArrowUp' || event.key === 'ArrowDown';
            if (!isArrow || !event.altKey || event.ctrlKey || event.metaKey) return;
            if (isEditableTarget(event.target)) return;

            if (event.shiftKey) {
                if (!showWireframeContextMoveActions) return;
                if (event.key === 'ArrowUp' && canMoveContextUp) {
                    event.preventDefault();
                    handleMoveUpInContext();
                }
                if (event.key === 'ArrowDown' && canMoveContextDown) {
                    event.preventDefault();
                    handleMoveDownInContext();
                }
                return;
            }

            if (event.key === 'ArrowUp' && canMoveUp) {
                event.preventDefault();
                handleMoveUp();
            }
            if (event.key === 'ArrowDown' && canMoveDown) {
                event.preventDefault();
                handleMoveDown();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [
        canMoveContextDown,
        canMoveContextUp,
        canMoveDown,
        canMoveUp,
        handleMoveDown,
        handleMoveDownInContext,
        handleMoveUp,
        handleMoveUpInContext,
        showWireframeContextMoveActions,
        showWireframeMoveActions,
    ]);

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
            {showWireframeMoveActions ? (
                <>
                    <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-900"
                        onClick={handleMoveUp}
                        disabled={!canMoveUp}
                    >
                        Move up
                    </button>
                    <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-900"
                        onClick={handleMoveDown}
                        disabled={!canMoveDown}
                    >
                        Move down
                    </button>
                </>
            ) : null}
            {showWireframeContextMoveActions ? (
                <>
                    <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-900"
                        onClick={handleMoveUpInContext}
                        disabled={!canMoveContextUp}
                    >
                        Move up (in context)
                    </button>
                    <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-900"
                        onClick={handleMoveDownInContext}
                        disabled={!canMoveContextDown}
                    >
                        Move down (in context)
                    </button>
                </>
            ) : null}
            <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={() => void handleCopyId()}
            >
                Copy ID
            </button>
            {canQuickAddFallbacks ? (
                <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                    onClick={handleOpenFallbackQuickAdd}
                >
                    Add fallbacks
                </button>
            ) : null}
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
                    onClick={handleToggleFieldOptions}
                >
                    {isFieldOptionsShown ? 'Hide option nodes' : 'Show option nodes'}
                </button>
            ) : null}
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
