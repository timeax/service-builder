import { useEffect } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { getNodeLabel } from '../utils.ts';
import { useNodeActions } from '../hooks.ts';

function BatchSection({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
                <DropdownMenuSubContent>{children}</DropdownMenuSubContent>
            </DropdownMenuPortal>
        </DropdownMenuSub>
    );
}

export function ContextMenu({
    target,
    setTarget,
    setDialogTarget,
    setRenameOpen,
    setDeleteOpen,
    openNoticeManager,
    openBatchTargetDialog,
    activeNode,
    anchorStyle,
    menuRef,
    setRenameValue,
    openRenameLabelsDialog,
}) {
    const {
        batchSelectionIds,
        handleDuplicate,
        hasServiceSelection,
        handleClearServiceMany,
        submitRebindMany,
        submitIncludeMany,
        submitExcludeMany,
        handleClearRelationsMany,
        handleSetPricingRoleMany,
        handleClearFieldValidationMany,
        handleClearFieldDefaultsMany,
        handleAutoCreateMissingOptions,
        handleClearAllOptionsMany,
        handleRemoveNoticesForNodes,
        handleSetNoticesVisibilityForNodes,
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
    const isBatchMenu = batchSelectionIds.length > 1 && batchSelectionIds.includes(target.nodeId);
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
        <div ref={menuRef} className="fixed z-40" style={{ left: anchorStyle.left, top: anchorStyle.top }}>
            <DropdownMenu open onOpenChange={(open) => !open && setTarget(null)}>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="sr-only">
                        Context menu
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    side="right"
                    sideOffset={0}
                    onEscapeKeyDown={() => setTarget(null)}
                    onInteractOutside={() => setTarget(null)}
                    className="w-64 max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
                >
                    <DropdownMenuItem
                        onSelect={() => {
                            setRenameValue(getNodeLabel(activeNode, target.nodeId));
                            setDialogTarget(target);
                            setRenameOpen(true);
                            setTarget(null);
                        }}
                    >
                        Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleDuplicate()}>{isBatchMenu ? 'Duplicate selected' : 'Duplicate'}</DropdownMenuItem>
                    {isBatchMenu ? (
                        <>
                            <BatchSection label="Primary">
                                <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => {
                                        setDialogTarget(target);
                                        setDeleteOpen(true);
                                        setTarget(null);
                                    }}
                                >
                                    Delete selected
                                </DropdownMenuItem>
                            </BatchSection>
                            {hasServiceSelection ? (
                                <BatchSection label="Service">
                                    <DropdownMenuItem onSelect={() => handleClearServiceMany()}>Unlink service IDs</DropdownMenuItem>
                                </BatchSection>
                            ) : null}
                            <BatchSection label="Structure / Visibility">
                                <DropdownMenuItem
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        if (!openBatchTargetDialog) return;
                                        openBatchTargetDialog('rebind', batchSelectionIds, {
                                            submit: (targetId: string, selectedIds: string[]) => submitRebindMany(targetId, selectedIds),
                                        });
                                    }}
                                >
                                    Move / Rebind to tag
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        if (!openBatchTargetDialog) return;
                                        openBatchTargetDialog('include', batchSelectionIds, {
                                            submit: (targetId: string, selectedIds: string[]) => submitIncludeMany(targetId, selectedIds),
                                        });
                                    }}
                                >
                                    Include in...
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        if (!openBatchTargetDialog) return;
                                        openBatchTargetDialog('exclude', batchSelectionIds, {
                                            submit: (targetId: string, selectedIds: string[]) => submitExcludeMany(targetId, selectedIds),
                                        });
                                    }}
                                >
                                    Exclude from...
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleClearRelationsMany()}>Clear includes/excludes</DropdownMenuItem>
                            </BatchSection>
                            <BatchSection label="Fields">
                                <DropdownMenuItem
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        openRenameLabelsDialog?.(batchSelectionIds);
                                    }}
                                >
                                    Rename labels...
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleSetPricingRoleMany('base')}>Set pricing role: Base</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleSetPricingRoleMany('utility')}>Set pricing role: Utility</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleClearFieldValidationMany()}>Clear validation</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleClearFieldDefaultsMany()}>Clear defaults</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleAutoCreateMissingOptions()}>Auto-create missing options</DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onSelect={() => handleClearAllOptionsMany()}>
                                    Clear all options
                                </DropdownMenuItem>
                            </BatchSection>
                            <BatchSection label="Notices">
                                <DropdownMenuItem
                                    onSelect={() => {
                                        openNoticeManager({
                                            mode: 'create',
                                            target: {
                                                scope: 'node',
                                                node_kind: target.nodeKind,
                                                node_id: batchSelectionIds[0],
                                            },
                                        });
                                        setTarget(null);
                                    }}
                                >
                                    Add notice to selected
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleRemoveNoticesForNodes()}>Remove notices for selected</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleSetNoticesVisibilityForNodes('public')}>Set notices public</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleSetNoticesVisibilityForNodes('private')}>Set notices private</DropdownMenuItem>
                            </BatchSection>
                        </>
                    ) : null}
                    {showWireframeMoveActions ? (
                        <>
                            <DropdownMenuItem disabled={!canMoveUp} onSelect={() => handleMoveUp()}>
                                Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!canMoveDown} onSelect={() => handleMoveDown()}>
                                Move down
                            </DropdownMenuItem>
                        </>
                    ) : null}
                    {showWireframeContextMoveActions ? (
                        <>
                            <DropdownMenuItem disabled={!canMoveContextUp} onSelect={() => handleMoveUpInContext()}>
                                Move up (in context)
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!canMoveContextDown} onSelect={() => handleMoveDownInContext()}>
                                Move down (in context)
                            </DropdownMenuItem>
                        </>
                    ) : null}
                    <DropdownMenuItem onSelect={() => void handleCopyId()}>Copy ID</DropdownMenuItem>
                    {canQuickAddFallbacks ? <DropdownMenuItem onSelect={() => handleOpenFallbackQuickAdd()}>Add fallbacks</DropdownMenuItem> : null}
                    <DropdownMenuItem
                        onSelect={() => {
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
                    </DropdownMenuItem>
                    {target.nodeKind === 'field' ? (
                        <DropdownMenuItem onSelect={() => handleToggleFieldOptions()}>
                            {isFieldOptionsShown ? 'Hide option nodes' : 'Show option nodes'}
                        </DropdownMenuItem>
                    ) : null}
                    {target.nodeKind === 'field' ? <DropdownMenuItem onSelect={() => void handleSaveAsTemplate()}>Save as template</DropdownMenuItem> : null}
                    {!isBatchMenu ? (
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                                setDialogTarget(target);
                                setDeleteOpen(true);
                                setTarget(null);
                            }}
                        >
                            Delete
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
