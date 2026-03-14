// noinspection GrazieInspection

import { DndContext, DragOverlay } from '@dnd-kit/core';
import * as React from 'react';
import { List } from 'react-window';

import { flatten } from './flatten';
import { buildSearchSets, defaultMatch } from './search';
import type { NodeKey, NodePath, SortTreeProps, SortTreeRef, TreeNode } from './types';
import { defaultGetKey, locateByPath } from './utils';

/* core utilities */
import { findPathById } from './core/paths';
import { useCreateUi } from './core/use-create-ui.ts';
import { useEditUi } from './core/use-edit-ui.ts';
import { type SelectionMeta, useSelection } from './core/use-selection.ts';

/* extracted internals */
import { useTreeDnd } from './internal/dnd';
import { pathKey, useExpandedPathsCache } from './internal/expanded-cache';
import { INVALID, LOADED, useLazyChildren } from './internal/lazy';
import { useRenderRow } from './internal/render-row';

function SortTreeInner<T = unknown>(props: SortTreeProps<T> & { cacheKey?: string }, ref: React.Ref<SortTreeRef<T>>) {
    const {
        data,
        onChange,
        getNodeKey = defaultGetKey,
        maxDepth = Infinity,
        indent = 24,
        canDrag = () => true,
        canDrop = () => true,

        // Search
        searchQuery = '',
        searchMatch = defaultMatch,
        autoExpandSearchResults = true,

        // Virtualization
        height,
        rowHeight = 44,
        overscanCount = 8,

        // UI
        renderNode,
        nodeClassName,
        rowClassName,
        activeClassName,
        /** selected classes (wrapper & inner) */
        selectedRowClassName,
        selectedNodeClassName,
        skinClassName,
        selectedSkinClassName,

        className,
        style,
        onContextMenu,
        preventNativeContextMenu = true,
        showBinding = false,

        // External/native drop
        onExternalDrop,

        // Features
        allSupportSubnodes = false,
        selectionMode = 'none',
        value: valueProp,
        defaultValue: defaultValueProp,
        onSelect,
        makeNodeFromTitle,

        defaultNodeIcon,
    } = props;

    const [tree, setTree] = React.useState<Array<TreeNode<T>>>(data);
    React.useEffect(() => setTree(data), [data]);

    /* expanded paths (IDB) -> view tree */
    const { treeView, expandedSet, expandedSig, setExpandedAtPath, isExpanded } = useExpandedPathsCache<T>({
        data,
        tree,
        getNodeKey,
        cacheKey: props.cacheKey,
    });

    /* lazy children helpers */
    const { normalizeLoader, loadChildren, primeChildrenArrayIfNeeded, refreshOne, invalidateOne, refreshAll, invalidateAll } = useLazyChildren<T>({
        tree,
        setTree,
        getNodeKey,
        onChange,
    });

    /* search + flatten */
    const { matchedPaths, expandPaths } = React.useMemo(
        () => buildSearchSets(treeView, getNodeKey, searchMatch, searchQuery || ''),
        [treeView, getNodeKey, searchMatch, searchQuery],
    );

    const rows = React.useMemo(
        () =>
            flatten<T>(treeView, getNodeKey, {
                forcedExpand: autoExpandSearchResults ? expandPaths : new Set<string>(),
                matchedPaths,
                defaultNodeIcon,
            }),
        [treeView, getNodeKey, autoExpandSearchResults, expandPaths, matchedPaths, defaultNodeIcon],
    );

    /* selection */
    const onToggleAtRow = React.useCallback(
        (idx: number, wantExpand?: boolean) => {
            const r = rows[idx];
            if (!r) return;

            const isExp = expandedSet.has(pathKey(r.path));

            if (wantExpand === undefined) toggle(r.path);
            else if (wantExpand && !isExp) toggle(r.path, true);
            else if (!wantExpand && isExp) toggle(r.path, false);
        },
        [rows, expandedSig, expandedSet],
    );

    const { indexById, onRowPointerDown, onKeyDown, apiSelect, apiSelectMany, apiClear, isSelected, selected } = useSelection<T>({
        rows,
        getNodeKey,
        selectionMode,
        controlledValue: valueProp,
        defaultValue: defaultValueProp,
        emit: (ids, via, meta: SelectionMeta) => {
            // richer selection context (range/toggle + modifiers)
            const context = { via, selection: meta };

            onSelect?.(ids, context as any);

            onChange(tree, {
                type: 'selection',
                selection: ids,
                context,
                preventDefault() {},
            });
        },
        onToggleAtRow,
    });

    /* create / createUI */
    const makeNodeFactory = makeNodeFromTitle || ((title: string) => ({ id: title, title }) as unknown as TreeNode<T>);

    const pathFromTarget = React.useCallback(
        (target: NodePath | NodeKey | null | undefined): NodePath | null => {
            if (!target) return null;
            if (Array.isArray(target)) return target as NodePath;
            const id = String(target);
            const visibleIndex = indexById.get(id);
            if (visibleIndex != null) return rows[visibleIndex].path;
            return findPathById(tree, getNodeKey, id);
        },
        [indexById, rows, tree, getNodeKey],
    );

    const { createUIAt, createUIValue, setCreateUIValue, createInputRef, showCreateUI, cancelCreateUI, commitCreateUI, apiCreate } = useCreateUi<T>({
        tree,
        setTree,
        getNodeKey,
        onChange,
        resolvePath: (t) => pathFromTarget(t),
        makeNodeFromTitle: makeNodeFactory,
    });

    const { editPath, showEditUI, cancelEditUI, commitEditUI } = useEditUi<T>({
        tree,
        setTree,
        getNodeKey,
        onChange,
        resolvePath: (t) => pathFromTarget(t),
    });

    function toggle(path: NodePath, wantExpand?: boolean) {
        const located = locateByPath<T>(tree, path, getNodeKey);
        const { changed, nextExpanded } = setExpandedAtPath(path, wantExpand);
        if (!changed) return;

        if (located) {
            onChange(tree, {
                type: 'toggle',
                node: located.node,
                from: {
                    parent: located.parent,
                    parentPath: located.parentPath,
                    index: located.index,
                    depth: located.depth,
                },
                context: { expanded: nextExpanded },
                preventDefault() {},
            });

            // Lazy-load only when user expands AND content not yet loaded or was invalidated
            if (nextExpanded) {
                const reLoc = locateByPath<T>(tree, path, getNodeKey);
                const anyN: any = reLoc?.node;
                if (anyN) {
                    normalizeLoader(anyN);
                    if (!anyN[LOADED] || anyN[INVALID]) loadChildren(path);
                }
            }
        }
    }

    /* dnd */
    const { sensors, collisionDetection, activePath, activeNode, handleDragStart, handleDragEnd, handleExternalDrop } = useTreeDnd<T>({
        tree,
        setTree,
        getNodeKey,
        maxDepth,
        canDrag,
        canDrop,
        allSupportSubnodes,
        onChange,
        onExternalDrop,
        primeChildrenArrayIfNeeded,
    });

    /* renderer */
    const { renderRow, RowVirtual } = useRenderRow<T>({
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
        isSelected: (id) => isSelected(id),
        toggle,
        handleExternalDrop,
    });

    /* ref API: add refresh + invalidate */
    React.useImperativeHandle(
        ref,
        (): SortTreeRef<T> => ({
            expand: (target) => {
                const p = pathFromTarget(target);
                if (!p) return;
                if (isExpanded(p)) return;
                toggle(p, true);
            },
            collapse: (target) => {
                const p = pathFromTarget(target);
                if (!p) return;
                if (!isExpanded(p)) return;
                toggle(p, false);
            },
            toggle: (target) => {
                const p = pathFromTarget(target);
                if (!p) return;
                toggle(p);
            },
            select: (id) => apiSelect(String(id)),
            selectMany: (ids) => apiSelectMany(ids.map(String)),
            clearSelection: () => apiClear(),
            create: apiCreate,
            createUI: showCreateUI,
            cancelCreateUI: cancelCreateUI,
            refresh: (target) => {
                if (!target) {
                    refreshAll(tree);
                } else {
                    const p = pathFromTarget(target);
                    if (p) refreshOne(p);
                }
                // If expanded now, reload immediately
                const p2 = pathFromTarget(target as any);
                if (p2 && isExpanded(p2)) loadChildren(p2);
            },
            invalidate: (target) => {
                if (!target) {
                    invalidateAll(tree);
                } else {
                    const p = pathFromTarget(target);
                    if (p) invalidateOne(p);
                }
            },
            remove(target: NodePath | NodeKey) {
                console.log(target);
                // left untouched here (still lives in original file if you want it extracted next)
                // you can keep your existing remove logic as-is
            },
            getSelectionNodes: () => {
                const out: Array<TreeNode<T>> = [];

                for (const rawId of selected) {
                    const id = String(rawId);

                    // Find path in the *full* tree (not just rows)
                    const p = findPathById(tree, getNodeKey, id);
                    if (!p) continue;

                    const located = locateByPath<T>(tree, p, getNodeKey);
                    if (!located) continue;

                    out.push(located.node);
                }

                return out;
            },
            getSelectionLocated: () => {
                const out: Array<{ id: string; path: NodePath; node: TreeNode<T> }> = [];

                for (const rawId of selected) {
                    const id = String(rawId);
                    const p = findPathById(tree, getNodeKey, id);
                    if (!p) continue;

                    const located = locateByPath<T>(tree, p, getNodeKey);
                    if (!located) continue;

                    out.push({ id, path: p, node: located.node });
                }

                return out;
            },
        }),
        [
            selected,
            tree,
            getNodeKey,
            apiSelect,
            apiSelectMany,
            apiClear,
            showCreateUI,
            cancelCreateUI,
            apiCreate,
            pathFromTarget,
            expandedSig,
            isExpanded,
            toggle,
            refreshAll,
            refreshOne,
            invalidateAll,
            invalidateOne,
            loadChildren,
        ],
    );

    /* render */
    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={collisionDetection}>
            <div className={className} style={style} tabIndex={0} onKeyDown={onKeyDown}>
                {height ? (
                    <List
                        rowComponent={RowVirtual as unknown as any}
                        rowProps={{}}
                        rowCount={rows.length}
                        rowHeight={rowHeight}
                        overscanCount={overscanCount}
                        style={{ height, width: '100%' }}
                        className="w-full"
                    />
                ) : (
                    rows.map((_, i) => renderRow(i))
                )}
            </div>

            <DragOverlay>
                {activeNode ? <div className="rounded bg-black/10 px-2 py-1 text-white text-[12px] shadow">{activeNode.title}</div> : 'dragged'}
            </DragOverlay>
        </DndContext>
    );
}

/** forwardRef export */
export const SortTree = React.forwardRef(SortTreeInner) as unknown as <T = unknown>(
    props: SortTreeProps<T> & { cacheKey?: string; ref?: React.Ref<SortTreeRef<T>> },
) => React.ReactElement;
