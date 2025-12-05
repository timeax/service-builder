// noinspection GrazieInspection

import * as React from "react";
import {
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { List, type RowComponentProps } from "react-window";

import type {
    NodeKey,
    NodePath,
    PositionInfo,
    SortTreeProps,
    SortTreeRef,
    TreeNode,
    DropZone,
} from "./types";
import { buildSearchSets, defaultMatch } from "./search";
import { flatten } from "./flatten";
import { dragId, parseDragId, parseZoneId, zoneId } from "./dnd-ids";
import { DraggableRow } from "./DraggableRow";
import { DropZone as Zone } from "./DropZone";
import { NodeRow } from "./NodeRow";
import { defaultGetKey, locateByPath, subtreeDepth } from "./utils";
import { changeNodeAtPath, moveNode, removeNode } from "./helpers";

/* core utilities */
import { buildCollisionDetection } from "./core/collision";
import { OnDroppableWrap } from "./core/droppable-wrap";
import { isPrefix, samePath, findPathById } from "./core/paths";
import { useSelection } from "./core/useSelection";
import { useCreateUI } from "./core/useCreateUI";

const ZONE_HEIGHT = 6;

/** private flags kept on node objects (typed as `any` when used) */
const LOADER = "__childrenLoader";    // () => Promise<TreeNode[]>
const LOADING = "__childrenLoading";  // boolean
const LOADED  = "__childrenLoaded";   // boolean
const INVALID = "__childrenInvalid";  // boolean

function SortTreeInner<T = unknown>(
    props: SortTreeProps<T>,
    ref: React.Ref<SortTreeRef<T>>
) {
    const {
        data,
        onChange,
        getNodeKey = defaultGetKey,
        maxDepth = Infinity,
        indent = 24,
        canDrag = () => true,
        canDrop = () => true,

        // Search
        searchQuery = "",
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
        selectionMode = "none",
        value: valueProp,
        defaultValue: defaultValueProp,
        onSelect,
        makeNodeFromTitle,

        defaultNodeIcon
    } = props;

    const [tree, setTree] = React.useState<Array<TreeNode<T>>>(data);
    React.useEffect(() => setTree(data), [data]);

    const [activePath, setActivePath] = React.useState<NodePath | null>(null);
    const [activeNode, setActiveNode] = React.useState<TreeNode<T> | null>(null);
    const lastOverId = React.useRef<string | null>(null);

    /* search + flatten */
    const { matchedPaths, expandPaths } = React.useMemo(
        () => buildSearchSets(tree, getNodeKey, searchMatch, searchQuery || ""),
        [tree, getNodeKey, searchMatch, searchQuery]
    );
    const rows = React.useMemo(
        () =>
            flatten<T>(tree, getNodeKey, {
                forcedExpand: autoExpandSearchResults ? expandPaths : new Set<string>(),
                matchedPaths, defaultNodeIcon
            }),
        [tree, getNodeKey, autoExpandSearchResults, expandPaths, matchedPaths]
    );

    /* dnd sensors + collision */
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );
    const collisionBase = React.useMemo(buildCollisionDetection, []);
    const collisionDetection = React.useCallback<typeof collisionBase>(
        (args) => {
            const res = collisionBase(args);
            if (res.length) lastOverId.current = String(res[0].id);
            return res;
        },
        [collisionBase]
    );

    /* selection */
    const onToggleAtRow = React.useCallback(
        (idx: number, wantExpand?: boolean) => {
            const r = rows[idx];
            if (!r) return;
            const located = locateByPath<T>(tree, r.path, getNodeKey);
            if (!located) return;
            const isExpanded = !!(located.node as any).expanded;
            if (wantExpand === undefined) toggle(r.path);
            else if (wantExpand && !isExpanded) toggle(r.path);
            else if (!wantExpand && isExpanded) toggle(r.path);
        },
        [rows, tree, getNodeKey]
    );

    const {
        indexById,
        onRowPointerDown,
        onKeyDown,
        apiSelect,
        apiSelectMany,
        apiClear,
        isSelected,
    } = useSelection<T>({
        rows,
        getNodeKey,
        selectionMode,
        controlledValue: valueProp,
        defaultValue: defaultValueProp,
        emit: (ids, via) => {
            onSelect?.(ids, { via });
            onChange(tree, { type: "selection", selection: ids, context: { via } });
        },
        onToggleAtRow,
    });

    /* create / createUI */
    const makeNodeFactory =
        makeNodeFromTitle || ((title: string) => ({ id: title, title } as unknown as TreeNode<T>));

    const pathFromTarget = React.useCallback(
        (target: NodePath | NodeKey | null | undefined): NodePath | null => {
            if (!target) return null;
            if (Array.isArray(target)) return target as NodePath;
            const id = String(target);
            const visibleIndex = indexById.get(id);
            if (visibleIndex != null) return rows[visibleIndex].path;
            return findPathById(tree, getNodeKey, id);
        },
        [indexById, rows, tree, getNodeKey]
    );

    const {
        createUIAt,
        createUIValue,
        setCreateUIValue,
        createInputRef,
        showCreateUI,
        cancelCreateUI,
        commitCreateUI,
        apiCreate,
    } = useCreateUI<T>({
        tree,
        setTree,
        getNodeKey,
        onChange,
        resolvePath: (t) => pathFromTarget(t),
        makeNodeFromTitle: makeNodeFactory,
    });

    /* ───── lazy loading helpers ───── */

    /** Capture a function in LOADER; set LOADED depending on materialization. */
    function normalizeLoader(node: any) {
        if (typeof node.children === "function") {
            const f = node.children as () => Array<TreeNode<T>> | Promise<Array<TreeNode<T>>>;
            node[LOADER] = () => Promise.resolve(f());
            node.children = undefined;       // do not recurse into a function
            node[LOADED] = false;
        } else if (Array.isArray(node.children)) {
            node[LOADED] = true;
        } else if (typeof node[LOADER] === "function") {
            // has loader but not yet materialized
            if (node[LOADED] == null) node[LOADED] = false;
        }
    }

    function loadChildren(path: NodePath) {
        const located = locateByPath<T>(tree, path, getNodeKey);
        if (!located) return;
        const nAny: any = located.node;
        normalizeLoader(nAny);
        const loader = nAny[LOADER] as undefined | (() => Promise<Array<TreeNode<T>>>);
        if (!loader || nAny[LOADING]) return;

        nAny[LOADING] = true;
        loader()
            .then((kids) => {
                const next = changeNodeAtPath<T>(tree, path, (node) => {
                    const nn: any = { ...node };
                    normalizeLoader(nn);
                    nn.children = Array.isArray(kids) ? kids : [];
                    nn[LOADING] = false;
                    nn[LOADED] = true;
                    nn[INVALID] = false;
                    return nn;
                });
                setTree(next);
                onChange(next, { type: "update", node: located.node, context: { lazyLoaded: true } });
            })
            .catch(() => {
                const next = changeNodeAtPath<T>(tree, path, (node) => ({ ...(node as any), [LOADING]: false }));
                setTree(next);
            });
    }

    /** Ensure a children array exists for DnD target; treat as "loaded now". */
    function primeChildrenArrayIfNeeded(path: NodePath) {
        const located = locateByPath<T>(tree, path, getNodeKey);
        if (!located) return tree;
        const nAny: any = located.node;
        if (Array.isArray(nAny.children)) return tree;
        normalizeLoader(nAny);
        const next = changeNodeAtPath<T>(tree, path, (node) => {
            const nn: any = { ...node };
            normalizeLoader(nn);
            nn.children = [];   // materialize empty
            nn[LOADED] = true;  // mark as loaded until refresh/invalidate says otherwise
            return nn;
        });
        setTree(next);
        return next;
    }

    /* dnd */

    function handleDragStart(evt: DragStartEvent) {
        const path = parseDragId(String(evt.active.id));
        if (!path) return;
        const located = locateByPath<T>(tree, path, getNodeKey);
        if (!located || !canDrag(located.node)) return;
        setActivePath(path);
        setActiveNode(located.node);
    }

    function makePositionInfo(toParentPath: NodePath | null, toIndex: number): PositionInfo<T> {
        const parentLocated = toParentPath?.length ? locateByPath<T>(tree, toParentPath, getNodeKey) : null;
        const parent = parentLocated?.node ?? null;
        const depth = (toParentPath?.length ?? 0) + 1;
        return { parent, parentPath: toParentPath, index: toIndex, depth };
    }

    function resolveTarget(
        overLocated: { path: NodePath; index: number; parentPath: NodePath | null; node: TreeNode<T> },
        zone: DropZone
    ): { toParentPath: NodePath | null; toIndex: number } {
        if (zone === "before") return { toParentPath: overLocated.parentPath, toIndex: overLocated.index };
        if (zone === "after")  return { toParentPath: overLocated.parentPath, toIndex: overLocated.index + 1 };
        return { toParentPath: overLocated.path, toIndex: (overLocated.node.children as any)?.length ?? 0 };
    }

    function handleDragEnd(evt: DragEndEvent) {
        const overId = evt.over?.id ? String(evt.over.id) : lastOverId.current ?? null;
        const actPath = activePath;
        const actNode = activeNode;

        setActivePath(null);
        setActiveNode(null);
        lastOverId.current = null;

        if (!overId || !actPath || !actNode) return;

        const parsed = parseZoneId(overId);
        if (!parsed) return;

        const overLocated = locateByPath<T>(tree, parsed.path, getNodeKey);
        if (!overLocated) return;

        let zone: DropZone =
            parsed.zone === "on" && !allSupportSubnodes && !(overLocated.node.children as any)?.length
                ? "after"
                : parsed.zone;

        if (zone === "on" && isPrefix(actPath, overLocated.path)) return;

        // Dropping ON a lazy node → materialize an empty array and treat it as loaded
        let workingTree = tree;
        if (zone === "on" && !(overLocated.node.children as any)?.length) {
            workingTree = primeChildrenArrayIfNeeded(overLocated.path);
        }

        let { toParentPath, toIndex } = resolveTarget(overLocated, zone);

        const fromLocated0 = locateByPath<T>(workingTree, actPath, getNodeKey);
        if (!fromLocated0) return;

        const fromInfo: PositionInfo<T> = {
            parent: fromLocated0.parent,
            parentPath: fromLocated0.parentPath,
            index: fromLocated0.index,
            depth: fromLocated0.depth,
        };
        const toInfoPre = makePositionInfo(toParentPath, toIndex);

        const totalDepth = toInfoPre.depth + (subtreeDepth<T>(actNode) - 1);
        const willExceed = totalDepth > maxDepth;

        if (!canDrop?.({ dragged: actNode, from: fromInfo, to: toInfoPre, origin: "internal", hint: { willExceedMaxDepth: willExceed } })) {
            return;
        }
        if (willExceed) return;

        if (
            fromInfo.parentPath &&
            toParentPath &&
            fromInfo.parentPath.length === toParentPath.length &&
            fromInfo.parentPath.every((v, i) => v === toParentPath![i]) &&
            fromInfo.index < toIndex
        ) {
            toIndex -= 1;
        }
        const toInfo = makePositionInfo(toParentPath, toIndex);

        if (
            (fromInfo.parentPath?.join("/") ?? "") === (toInfo.parentPath?.join("/") ?? "") &&
            fromInfo.index === toInfo.index
        ) {
            return;
        }

        const { tree: moved, detail } = moveNode<T>({
            data: workingTree,
            getNodeKey,
            fromPath: actPath,
            toParentPath,
            toIndex,
            maxDepth,
        });

        setTree(moved);
        //@ts-expect-error
        onChange(moved, { ...detail, context: { via: `drop:${zone}`, origin: "internal" } });
    }

    function handleExternalDrop(e: React.DragEvent<HTMLDivElement>, dzId: string) {
        const parsed = parseZoneId(dzId);
        if (!parsed) return;

        const overLocated = locateByPath<T>(tree, parsed.path, getNodeKey);
        if (!overLocated) return;

        const zone: DropZone =
            parsed.zone === "on" && !allSupportSubnodes && !(overLocated.node.children as any)?.length
                ? "after"
                : parsed.zone;

        const { toParentPath, toIndex } = resolveTarget(overLocated, zone);
        const toInfo = makePositionInfo(toParentPath, toIndex);

        if (!canDrop?.({ dragged: null, from: null, to: toInfo, origin: "external" })) return;

        onExternalDrop?.({
            zone,
            over: overLocated.node,
            to: toInfo,
            dataTransfer: e.dataTransfer as DataTransfer,
        });
    }

    function toggle(path: NodePath) {
        const located = locateByPath<T>(tree, path, getNodeKey);
        if (!located) return;

        const expanding = !located.node.expanded;

        const next = changeNodeAtPath<T>(tree, path, (node) => {
            const nn: any = { ...node, expanded: !node.expanded };
            normalizeLoader(nn);
            return nn;
        });

        setTree(next);
        onChange(next, {
            type: "toggle",
            node: located.node,
            from: {
                parent: located.parent,
                parentPath: located.parentPath,
                index: located.index,
                depth: located.depth,
            },
            context: { expanded: expanding },
        });

        // Lazy-load only when user expands AND content not yet loaded or was invalidated
        if (expanding) {
            const reLoc = locateByPath<T>(next, path, getNodeKey);
            const anyN: any = reLoc?.node;
            if (anyN && (!anyN[LOADED] || anyN[INVALID])) loadChildren(path);
        }
    }

    /* refresh & invalidate */

    function refreshOne(target: NodePath) {
        const located = locateByPath<T>(tree, target, getNodeKey);
        if (!located) return;

        const hasLoader =
            typeof (located.node as any)[LOADER] === "function" ||
            typeof (located.node as any).children === "function";

        if (!hasLoader) return;

        const next = changeNodeAtPath<T>(tree, target, (n) => {
            const nn: any = { ...n };
            normalizeLoader(nn);
            nn.children = undefined; // drop cache
            nn[LOADING] = false;
            nn[LOADED] = false;
            nn[INVALID] = false;
            return nn;
        });
        setTree(next);

        // If expanded now, reload immediately
        const after = locateByPath<T>(next, target, getNodeKey);
        if (after?.node.expanded) loadChildren(target);
    }

    function invalidateOne(target: NodePath) {
        const located = locateByPath<T>(tree, target, getNodeKey);
        if (!located) return;

        const hasLoader =
            typeof (located.node as any)[LOADER] === "function" ||
            typeof (located.node as any).children === "function";

        if (!hasLoader) return;

        // Keep current children visible; mark as stale so next expand triggers load
        const next = changeNodeAtPath<T>(tree, target, (n) => {
            const nn: any = { ...n };
            normalizeLoader(nn);
            nn[INVALID] = true;
            return nn;
        });
        setTree(next);
    }

    function refreshAll(nodes: Array<TreeNode<T>>, prefix: NodePath = []) {
        nodes.forEach((n) => {
            const path = [...prefix, getNodeKey(n)];
            const anyN: any = n;
            if (typeof anyN[LOADER] === "function" || typeof anyN.children === "function") {
                refreshOne(path);
            }
            if (Array.isArray(n.children)) refreshAll(n.children, path);
        });
    }

    function invalidateAll(nodes: Array<TreeNode<T>>, prefix: NodePath = []) {
        nodes.forEach((n) => {
            const path = [...prefix, getNodeKey(n)];
            const anyN: any = n;
            if (typeof anyN[LOADER] === "function" || typeof anyN.children === "function") {
                invalidateOne(path);
            }
            if (Array.isArray(n.children)) invalidateAll(n.children, path);
        });
    }

    /* renderer */

    const renderRow = React.useCallback(
        (rIndex: number, itemStyle?: React.CSSProperties) => {
            const r = rows[rIndex];
            const draggableId = dragId(r.path);
            const disabledDrag = !canDrag(r.node);
            const disableZones = !!activePath && isPrefix(activePath, r.path);

            const sel = isSelected(getNodeKey(r.node));

            const baseInner =
                typeof nodeClassName === "function"
                    ? nodeClassName({
                        node: r.node,
                        depth: r.depth,
                        path: r.path,
                        matched: r.matched,
                        isDragging: !!activePath && r.path.join("/") === activePath.join("/"),
                    })
                    : nodeClassName || "";

            const baseWrapper =
                typeof rowClassName === "function"
                    ? rowClassName({
                        node: r.node,
                        depth: r.depth,
                        path: r.path,
                        matched: r.matched,
                        isDragging: !!activePath && r.path.join("/") === activePath.join("/"),
                    })
                    : rowClassName || "";

            // New: skin classes (visual selection surface starting at content edge)
            const baseSkin =
                typeof skinClassName === "function"
                    ? skinClassName({
                        node: r.node,
                        depth: r.depth,
                        path: r.path,
                        matched: r.matched,
                        isDragging: !!activePath && r.path.join("/") === activePath.join("/"),
                    })
                    : skinClassName || "";

            const selSkin =
                sel && selectedSkinClassName
                    ? (typeof selectedSkinClassName === "function"
                        ? selectedSkinClassName({ node: r.node, depth: r.depth, path: r.path, matched: r.matched })
                        : selectedSkinClassName)
                    // Back-compat: if no selectedSkinClassName supplied, fall back to selectedRowClassName
                    : sel && selectedRowClassName
                        ? (typeof selectedRowClassName === "function"
                            ? selectedRowClassName({ node: r.node, depth: r.depth, path: r.path, matched: r.matched })
                            : selectedRowClassName)
                        : "";

            // Selected styles applied to *skin*, not wrapper (so radius shows on the left)
            const wrapperClass = [baseWrapper].filter(Boolean).join(" ").trim();
            const skinClass = [baseSkin, selSkin].filter(Boolean).join(" ").trim();

            const innerSelected =
                sel && selectedNodeClassName
                    ? (typeof selectedNodeClassName === "function"
                        ? selectedNodeClassName({ node: r.node, depth: r.depth, path: r.path, matched: r.matched })
                        : selectedNodeClassName)
                    : "";

            const innerRowClass = [baseInner, innerSelected].filter(Boolean).join(" ").trim();

            // caret hint even before load
            const hasChildrenHint =
                !!(r.node as any)[LOADER] ||
                typeof (r.node as any).children === "function" ||
                (Array.isArray(r.node.children) && r.node.children.length > 0);

            // root (depth=1) => 0px; otherwise indent*(depth-1)
            const indentPx = indent * Math.max(0, r.depth - 1);

            return (
                <div style={itemStyle} key={`row-${r.path.join("/")}`}>
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
                        <div className={skinClass} style={{ borderRadius: "inherit" }}>
                            {/* BEFORE (inside wrapper/skin to behave like padding-y) */}
                            <Zone
                                id={zoneId(r.path, "before")}
                                height={ZONE_HEIGHT}
                                onNativeDrop={handleExternalDrop}
                                disabled={disableZones}
                            />

                            {/* ON (whole row) */}
                            <OnDroppableWrap id={zoneId(r.path, "on")} onNativeDrop={handleExternalDrop} disabled={disableZones}>
                                <DraggableRow id={draggableId} disabled={disabledDrag}>
                                    <NodeRow
                                        node={r.node}
                                        path={r.path}
                                        depth={r.depth}
                                        indent={0} // prevent spacer; indent comes from wrapper padding
                                        matched={r.matched}
                                        isDragging={!!activePath && r.path.join("/") === activePath.join("/")}
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
                                    />
                                </DraggableRow>
                            </OnDroppableWrap>

                            {/* AFTER (inside wrapper/skin to behave like padding-y) */}
                            <Zone
                                id={zoneId(r.path, "after")}
                                height={ZONE_HEIGHT}
                                onNativeDrop={handleExternalDrop}
                                disabled={disableZones}
                            />

                            {/* Inline create UI (under target row, inherits wrapper indent via block flow) */}
                            {samePath(createUIAt, r.path) && (
                                <div className="w-full py-1">
                                    <div className="w-full rounded border border-dashed px-2 py-1">
                                        <input
                                            ref={createInputRef}
                                            value={createUIValue}
                                            onChange={(e) => setCreateUIValue(e.target.value)}
                                            onBlur={commitCreateUI}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    commitCreateUI();
                                                } else if (e.key === "Escape") {
                                                    e.preventDefault();
                                                    cancelCreateUI();
                                                }
                                            }}
                                            placeholder="New node title…"
                                            className="w-full bg-transparent outline-none"
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
            indent,
            canDrag,
            activePath,
            renderNode,
            showBinding,
            nodeClassName,
            rowClassName,
            skinClassName,
            selectedSkinClassName,
            selectedRowClassName, // fallback path
            selectedNodeClassName,
            preventNativeContextMenu,
            onContextMenu,
            tree,
            getNodeKey,
            createUIAt,
            createUIValue,
            commitCreateUI,
            cancelCreateUI,
            setCreateUIValue,
            isSelected,
        ]
    );

    const RowVirtual = React.useCallback(
        ({ index, style }: RowComponentProps) => renderRow(index, style),
        [renderRow]
    );

    /* ref API: add refresh + invalidate */
    React.useImperativeHandle(
        ref,
        (): SortTreeRef<T> => ({
            expand: (target) => {
                const p = pathFromTarget(target);
                if (!p) return;
                const located = locateByPath<T>(tree, p, getNodeKey);
                if (!located || located.node.expanded) return;
                toggle(p);
            },
            collapse: (target) => {
                const p = pathFromTarget(target);
                if (!p) return;
                const located = locateByPath<T>(tree, p, getNodeKey);
                if (!located || !located.node.expanded) return;
                toggle(p);
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
            },
            invalidate: (target) => {
                if (!target) {
                    invalidateAll(tree);
                } else {
                    const p = pathFromTarget(target);
                    if (p) invalidateOne(p);
                }
            },
            remove(target:NodePath | NodeKey) {
                const p = pathFromTarget(target);
                if(!p) return;
                //--
                const {tree: next, detail} = removeNode<T>(tree, p, getNodeKey);
                setTree(next);
                //@ts-expect-error
                if(detail) onChange(next, { ...detail, context: { via: "remove", origin: "api" } });
            }
        }),
        [
            tree,
            getNodeKey,
            apiSelect,
            apiSelectMany,
            apiClear,
            showCreateUI,
            cancelCreateUI,
            apiCreate,
        ]
    );

    /* render */
    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={collisionDetection}
        >
            <div className={className} style={style} tabIndex={0} onKeyDown={onKeyDown}>
                {height ? (
                    <List
                        rowComponent={RowVirtual}
                        rowProps={{}}
                        rowCount={rows.length}
                        rowHeight={rowHeight}
                        overscanCount={overscanCount}
                        style={{ height, width: "100%" }}
                        className="w-full"
                    />
                ) : (
                    rows.map((_, i) => renderRow(i))
                )}
            </div>

            <DragOverlay>
                {activeNode ? (
                    <div className="px-2 py-1 rounded bg-black/80 text-white shadow">
                        {activeNode.title}
                    </div>
                ) : (
                    "dragged"
                )}
            </DragOverlay>
        </DndContext>
    );
}

/** forwardRef export */
export const SortTree = React.forwardRef(SortTreeInner) as unknown as <
    T = unknown
>(
    props: SortTreeProps<T> & { ref?: React.Ref<SortTreeRef<T>> }
) => React.ReactElement;
