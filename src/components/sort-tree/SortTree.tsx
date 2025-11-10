import * as React from "react";
import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
// ⬇️ react-window: use List + RowComponentProps (per your typings)
import {List, type RowComponentProps} from "react-window";

import type {NodePath, PositionInfo, SortTreeProps, TreeNode,} from "./types";
import {buildSearchSets, defaultMatch} from "./search";
import {flatten} from "./flatten";
import {dragId, parseDragId, parseZoneId, zoneId} from "./dnd-ids";
import {DraggableRow} from "./DraggableRow";
import {DropZone} from "./DropZone";
import {NodeRow} from "./NodeRow";
import {defaultGetKey, locateByPath, subtreeDepth,} from "./utils";
import {changeNodeAtPath, moveNode,} from "./helpers";

export function SortTree<T = unknown>(props: SortTreeProps<T>) {
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
        className,
        style,
        onContextMenu,
        preventNativeContextMenu = true,
        showBinding = false,
    } = props;

    const [tree, setTree] = React.useState<Array<TreeNode<T>>>(data);
    React.useEffect(() => setTree(data), [data]);

    const [activePath, setActivePath] = React.useState<NodePath | null>(null);
    const [activeNode, setActiveNode] = React.useState<TreeNode<T> | null>(null);

    // Search sets
    const {matchedPaths, expandPaths} = React.useMemo(
        () => buildSearchSets(tree, getNodeKey, searchMatch, searchQuery || ""),
        [tree, getNodeKey, searchMatch, searchQuery]
    );

    // Flatten for render
    const rows = React.useMemo(
        () =>
            flatten<T>(tree, getNodeKey, {
                forcedExpand: autoExpandSearchResults ? expandPaths : new Set<string>(),
                matchedPaths,
            }),
        [tree, getNodeKey, autoExpandSearchResults, expandPaths, matchedPaths]
    );

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}})
    );

    function handleDragStart(evt: DragStartEvent) {
        const path = parseDragId(String(evt.active.id));
        if (!path) return;
        const located = locateByPath<T>(tree, path, getNodeKey);
        if (!located) return;
        if (!canDrag(located.node)) return;
        setActivePath(path);
        setActiveNode(located.node);
    }

    function makePositionInfo(toParentPath: NodePath | null, toIndex: number): PositionInfo<T> {
        const parentLocated = toParentPath?.length ? locateByPath<T>(tree, toParentPath, getNodeKey) : null;
        const parent = parentLocated?.node ?? null;
        const depth = (toParentPath?.length ?? 0) + 1;
        return {parent, parentPath: toParentPath, index: toIndex, depth};
    }

    function handleDragEnd(evt: DragEndEvent) {
        const overId = evt.over?.id ? String(evt.over.id) : null;
        const actPath = activePath;
        const actNode = activeNode;
        setActivePath(null);
        setActiveNode(null);
        if (!overId || !actPath || !actNode) return;

        const parsed = parseZoneId(overId);
        if (!parsed) return;

        const overLocated = locateByPath<T>(tree, parsed.path, getNodeKey);
        if (!overLocated) return;

        // Compute target parent/index from drop zone
        let toParentPath: NodePath | null;
        let toIndex: number;
        if (parsed.zone === "before") {
            toParentPath = overLocated.parentPath;
            toIndex = overLocated.index;
        } else if (parsed.zone === "after") {
            toParentPath = overLocated.parentPath;
            toIndex = overLocated.index + 1;
        } else {
            toParentPath = overLocated.path;
            toIndex = overLocated.node.children?.length ?? 0;
        }

        // Validate depth
        const baseDepth = (toParentPath?.length ?? 0) + 1;
        const totalDepth = baseDepth + (subtreeDepth<T>(actNode) - 1);
        if (totalDepth > maxDepth) return;

        const fromLocated = locateByPath<T>(tree, actPath, getNodeKey);
        if (!fromLocated) return;
        const fromInfo: PositionInfo<T> = {
            parent: fromLocated.parent,
            parentPath: fromLocated.parentPath,
            index: fromLocated.index,
            depth: fromLocated.depth,
        };
        const toInfo = makePositionInfo(toParentPath, toIndex);

        if (!canDrop({dragged: actNode, from: fromInfo, to: toInfo})) return;

        const {tree: moved, detail} = moveNode<T>({
            data: tree,
            getNodeKey,
            fromPath: actPath,
            toParentPath,
            toIndex,
            maxDepth,
        });

        setTree(moved);
        onChange(moved, {...detail, context: {via: `drop:${parsed.zone}`}});
    }

    function toggle(path: NodePath) {
        const located = locateByPath<T>(tree, path, getNodeKey);
        if (!located) return;
        const next = changeNodeAtPath<T>(
            tree,
            path,
            node => ({...node, expanded: !node.expanded})
        );
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
            context: {expanded: !located.node.expanded},
        });
    }

    // Our existing row renderer (unchanged)
    const renderRow = React.useCallback(
        (rIndex: number, itemStyle?: React.CSSProperties) => {
            const r = rows[rIndex];
            const draggableId = dragId(r.path);
            const disabled = !canDrag(r.node);

            return (
                <div style={itemStyle} key={`row-${r.path.join("/")}`}>
                    {/* BEFORE zone (thin strip) */}
                    <DropZone id={zoneId(r.path, "before")} height={4}/>

                    {/* Row */}
                    <DraggableRow id={draggableId} disabled={disabled}>
                        <NodeRow
                            node={r.node}
                            path={r.path}
                            depth={r.depth}
                            indent={indent}
                            matched={r.matched}
                            isDragging={activePath ? r.path.join("/") === activePath.join("/") : false}
                            onToggle={() => toggle(r.path)}
                            renderNode={renderNode}
                            binding={{
                                show: showBinding,
                                guides: (r as any).guides,
                                isLast: (r as any).sibling?.isLast ?? true,
                            }}
                            onContextMenu={(e) => {
                                // Optional: suppress native menu so you can show your own
                                if (preventNativeContextMenu) {
                                    e.preventDefault();
                                }
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

                    {/* ON (into) zone */}
                    <DropZone id={zoneId(r.path, "on")} height={6} className="ml-8"/>

                    {/* AFTER zone */}
                    <DropZone id={zoneId(r.path, "after")} height={4}/>
                </div>
            );
        },
        [rows, indent, canDrag, activePath, renderNode, showBinding]
    );

    // Adapter for your react-window List signature
    const RowVirtual = React.useCallback(
        ({index, style}: RowComponentProps) => renderRow(index, style),
        [renderRow]
    );

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={closestCenter}
        >
            <div className={className} style={style}>
                {height ? (
                    <List
                        // per your typings:
                        //   - rowComponent: function receiving { index, style, ariaAttributes, ...rowProps }
                        //   - rowProps: required object (must NOT include ariaAttributes/index/style)
                        rowComponent={RowVirtual}
                        rowProps={{}}                 // required by the generic; we don't need extra props
                        rowCount={rows.length}
                        rowHeight={rowHeight}
                        overscanCount={overscanCount}
                        // sizing: use style to provide height/width container
                        style={{height, width: "100%"}}
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
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
