import * as React from 'react';

import { OnDroppableWrap } from '../core/droppable-wrap';
import { isPrefix, samePath } from '../core/paths';
import { dragId, zoneId } from '../dnd-ids';
import { DraggableRow } from '../draggable-row';
import { DropZone as Zone } from '../drop-zone';
import { NodeRow } from '../node-row';
import type { NodeKey, NodePath, TreeNode } from '../types';
import { locateByPath } from '../utils';
import { cn } from '@/lib/utils.ts';

const ZONE_HEIGHT = 6;

export function useRenderRow<T>(args: {
    rows: any[];
    tree: Array<TreeNode<T>>;
    getNodeKey: (n: TreeNode<T>) => NodeKey;

    indent: number;
    canDrag: (n: TreeNode<T>) => boolean;
    activePath: NodePath | null;

    renderNode: any;
    showBinding: boolean;

    nodeClassName: any;
    activeClassName: any;
    rowClassName: any;

    skinClassName: any;
    selectedSkinClassName: any;
    selectedRowClassName: any;
    selectedNodeClassName: any;

    preventNativeContextMenu: boolean;
    onContextMenu?: any;

    createUIAt: NodePath | null;
    createUIValue: string;
    setCreateUIValue: (v: string) => void;
    createInputRef: React.RefObject<HTMLInputElement>;
    commitCreateUI: () => void;
    cancelCreateUI: () => void;

    editPath: NodePath | null;
    showEditUI: (at: NodePath | NodeKey) => void;
    cancelEditUI: () => void;
    commitEditUI: (at: NodePath | NodeKey, title: string) => void;

    onRowPointerDown: (e: React.MouseEvent, idx: number, node: TreeNode<T>) => void;
    isSelected: (id: string) => boolean;

    toggle: (path: NodePath) => void;

    handleExternalDrop: (e: React.DragEvent<HTMLDivElement>, dzId: string) => void;
}) {
    const {
        rows,
        tree,
        getNodeKey,
        indent,
        canDrag,
        activePath,
        renderNode,
        showBinding,
        nodeClassName,
        rowClassName,
        skinClassName,
        activeClassName,
        selectedSkinClassName,
        selectedRowClassName,
        selectedNodeClassName,
        preventNativeContextMenu,
        onContextMenu,
        createUIAt,
        createUIValue,
        setCreateUIValue,
        createInputRef,
        commitCreateUI,
        cancelCreateUI,
        editPath,
        showEditUI,
        cancelEditUI,
        commitEditUI,
        onRowPointerDown,
        isSelected,
        toggle,
        handleExternalDrop,
    } = args;

    const renderRow = React.useCallback(
        (rIndex: number, itemStyle?: React.CSSProperties) => {
            const r = rows[rIndex];
            const draggableId = dragId(r.path);
            const disabledDrag = !canDrag(r.node);
            const disableZones = !!activePath && isPrefix(activePath, r.path);

            const sel = isSelected(String(getNodeKey(r.node)));
            const isEditing = !!editPath && samePath(r.path, editPath);

            const baseInner =
                typeof nodeClassName === 'function'
                    ? nodeClassName({
                          node: r.node,
                          depth: r.depth,
                          path: r.path,
                          matched: r.matched,
                          isDragging: !!activePath && r.path.join('/') === activePath.join('/'),
                      })
                    : nodeClassName || '';

            const activeClassString =
                typeof activeClassName === 'function'
                    ? activeClassName({
                          node: r.node,
                          depth: r.depth,
                          path: r.path,
                          matched: r.matched,
                      })
                    : activeClassName || '';

            const baseWrapper =
                typeof rowClassName === 'function'
                    ? rowClassName({
                          node: r.node,
                          depth: r.depth,
                          path: r.path,
                          matched: r.matched,
                          isDragging: !!activePath && r.path.join('/') === activePath.join('/'),
                      })
                    : rowClassName || '';

            // New: skin classes (visual selection surface starting at content edge)
            const baseSkin =
                typeof skinClassName === 'function'
                    ? skinClassName({
                          node: r.node,
                          depth: r.depth,
                          path: r.path,
                          matched: r.matched,
                          isDragging: !!activePath && r.path.join('/') === activePath.join('/'),
                      })
                    : skinClassName || '';

            const selSkin =
                sel && selectedSkinClassName
                    ? typeof selectedSkinClassName === 'function'
                        ? selectedSkinClassName({ node: r.node, depth: r.depth, path: r.path, matched: r.matched })
                        : selectedSkinClassName
                    : // Back-compat: if no selectedSkinClassName supplied, fall back to selectedRowClassName
                      sel && selectedRowClassName
                      ? typeof selectedRowClassName === 'function'
                          ? selectedRowClassName({ node: r.node, depth: r.depth, path: r.path, matched: r.matched })
                          : selectedRowClassName
                      : '';

            // Selected styles applied to *skin*, not wrapper (so radius shows on the left)
            const wrapperClass = [baseWrapper].filter(Boolean).join(' ').trim();
            const skinClass = [baseSkin, selSkin].filter(Boolean).join(' ').trim();

            const innerSelected =
                sel && selectedNodeClassName
                    ? typeof selectedNodeClassName === 'function'
                        ? selectedNodeClassName({ node: r.node, depth: r.depth, path: r.path, matched: r.matched })
                        : selectedNodeClassName
                    : '';

            const innerRowClass = [baseInner, innerSelected].filter(Boolean).join(' ').trim();

            // caret hint even before load
            const hasChildrenHint =
                typeof (r.node as any).__childrenLoader === 'function' ||
                typeof (r.node as any).children === 'function' ||
                (Array.isArray(r.node.children) && r.node.children.length > 0);

            // root (depth=1) => 0px; otherwise indent*(depth-1)
            const indentPx = indent * Math.max(0, r.depth - 1);

            return (
                <div style={itemStyle} key={`row-${r.path.join('/')}`}>
                    {/* WRAPPER owns layout + indent; no bg clipping */}
                    <div
                        className={wrapperClass}
                        style={{
                            paddingInlineStart: indentPx,
                            paddingLeft: indentPx, // fallback
                        }}
                        onMouseDown={(e) => onRowPointerDown(e, rIndex, r.node)}
                    >
                        {/* SKIN owns visual selection (bg, radius). Inherit radius from wrapper. */}
                        <div className={cn(skinClass, activeClassString)} style={{ borderRadius: 'inherit' }}>
                            {/* BEFORE (inside wrapper/skin to behave like padding-y) */}
                            <Zone id={zoneId(r.path, 'before')} height={ZONE_HEIGHT} onNativeDrop={handleExternalDrop} disabled={disableZones} />

                            {/* ON (whole row) */}
                            <OnDroppableWrap id={zoneId(r.path, 'on')} onNativeDrop={handleExternalDrop} disabled={disableZones}>
                                <DraggableRow id={draggableId} disabled={disabledDrag}>
                                    <NodeRow
                                        node={r.node}
                                        path={r.path}
                                        depth={r.depth}
                                        indent={0} // prevent spacer; indent comes from wrapper padding
                                        matched={r.matched}
                                        isDragging={!!activePath && r.path.join('/') === activePath.join('/')}
                                        onToggle={() => toggle(r.path)}
                                        renderNode={renderNode}
                                        rowClassName={innerRowClass}
                                        hasChildren={hasChildrenHint}
                                        binding={{
                                            show: showBinding,
                                            guides: (r as any).guides,
                                            isLast: (r as any).sibling?.isLast ?? true,
                                        }}
                                        onContextMenu={(e) => {
                                            if (preventNativeContextMenu) e.preventDefault();
                                            if (!onContextMenu) return;
                                            const located = locateByPath<T>(tree, r.path, getNodeKey);
                                            if (!located) return;
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            onContextMenu({
                                                node: r.node,
                                                path: r.path,
                                                depth: r.depth,
                                                index: located.index,
                                                parent: located.parent,
                                                parentPath: located.parentPath,
                                                rowIndex: rIndex,
                                                rect,
                                                event: e,
                                            });
                                        }}
                                        onDoubleClick={() => showEditUI(r.path)}
                                        isEditing={isEditing}
                                        onCommit={(newTitle) => commitEditUI(r.path, newTitle)}
                                        onCancel={cancelEditUI}
                                    />
                                </DraggableRow>
                            </OnDroppableWrap>

                            {/* AFTER (inside wrapper/skin to behave like padding-y) */}
                            <Zone id={zoneId(r.path, 'after')} height={ZONE_HEIGHT} onNativeDrop={handleExternalDrop} disabled={disableZones} />

                            {/* Inline create UI (under target row, inherits wrapper indent via block flow) */}
                            {samePath(createUIAt, r.path) && (
                                <div style={{ paddingLeft: indent * Math.max(0, r.depth) }} className="w-full bg-background py-1">
                                    <div className="w-full rounded border border-dashed px-2 py-1">
                                        <input
                                            ref={createInputRef}
                                            value={createUIValue}
                                            onChange={(e) => setCreateUIValue(e.target.value)}
                                            onBlur={commitCreateUI}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    commitCreateUI();
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    cancelCreateUI();
                                                }
                                            }}
                                            placeholder="New node title…"
                                            className="w-full bg-transparent text-[13px] outline-none"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        },
        [
            rows,
            tree,
            getNodeKey,
            indent,
            canDrag,
            activePath,
            renderNode,
            showBinding,
            nodeClassName,
            rowClassName,
            skinClassName,
            selectedSkinClassName,
            selectedRowClassName,
            selectedNodeClassName,
            preventNativeContextMenu,
            onContextMenu,
            createUIAt,
            createUIValue,
            setCreateUIValue,
            createInputRef,
            commitCreateUI,
            cancelCreateUI,
            editPath,
            showEditUI,
            cancelEditUI,
            commitEditUI,
            onRowPointerDown,
            isSelected,
            toggle,
            handleExternalDrop,
        ],
    );

    const RowVirtual = React.useCallback(({ index, style }: any) => renderRow(index, style), [renderRow]);

    return { renderRow, RowVirtual } as const;
}
