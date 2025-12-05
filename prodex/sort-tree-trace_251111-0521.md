# Index 

Included Source Files (14)
- [src/components/sort-tree/DefaultNode.tsx](#1)
- [src/components/sort-tree/dnd-ids.ts](#2)
- [src/components/sort-tree/DraggableRow.tsx](#3)
- [src/components/sort-tree/DropZone.tsx](#4)
- [src/components/sort-tree/flatten.ts](#5)
- [src/components/sort-tree/helpers.ts](#6)
- [src/components/sort-tree/index.ts](#7)
- [src/components/sort-tree/NodeRow.css](#8)
- [src/components/sort-tree/NodeRow.tsx](#9)
- [src/components/sort-tree/search.ts](#10)
- [src/components/sort-tree/SortTree.tsx](#11)
- [src/components/sort-tree/types.ts](#12)
- [src/components/sort-tree/utils.ts](#13)
- [src/index.css](#14)

---
---
#### 1


` File: src/components/sort-tree/DefaultNode.tsx`  [↑ Back to top](#index)

```tsx
import type {TreeNode} from "./types";

export interface DefaultNodeProps<T = unknown> {
    node: TreeNode<T>;
    matched: boolean;
}

export function DefaultNode<T = unknown>({node, matched}: DefaultNodeProps<T>) {
    return (
        <div className={"truncate " + (matched ? "bg-yellow-200/50 px-1 rounded" : "")}>
            {node.title}
        </div>
    );
}
```

---
#### 2


` File: src/components/sort-tree/dnd-ids.ts`  [↑ Back to top](#index)

```ts
import type { NodePath } from "./types";
import { pathToString, stringToPath } from "./utils";

export type Zone = "before" | "on" | "after";

export function zoneId(path: NodePath, zone: Zone): string {
    return `dz:${zone}:${pathToString(path)}`;
}
export function parseZoneId(id: string): { zone: Zone; path: NodePath } | null {
    if (!id.startsWith("dz:")) return null;
    const [, zone, raw] = id.split(":");
    if (zone !== "before" && zone !== "on" && zone !== "after") return null;
    return { zone: zone as Zone, path: stringToPath(raw ?? "") };
}
export function dragId(path: NodePath): string {
    return `node:${pathToString(path)}`;
}
export function parseDragId(id: string): NodePath | null {
    if (!id.startsWith("node:")) return null;
    return stringToPath(id.slice(5));
}
```

---
#### 3


` File: src/components/sort-tree/DraggableRow.tsx`  [↑ Back to top](#index)

```tsx
import * as React from "react";
import {useDraggable} from "@dnd-kit/core";

export interface DraggableRowProps {
    id: string;
    disabled?: boolean;
    children: React.ReactNode;
}

export const DraggableRow: React.FC<DraggableRowProps> = ({id, disabled, children}) => {
    const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({id, disabled});
    const style: React.CSSProperties = (transform
        ? {transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`}
        : undefined) as React.CSSProperties;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={isDragging ? "opacity-60" : ""}
        >
            {children}
        </div>
    );
};
```

---
#### 4


` File: src/components/sort-tree/DropZone.tsx`  [↑ Back to top](#index)

```tsx
import * as React from "react";
import {useDroppable} from "@dnd-kit/core";

export interface DropZoneProps {
    id: string;
    height: number;
    className?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({id, height, className}) => {
    const {setNodeRef, isOver} = useDroppable({id});
    return (
        <div
            ref={setNodeRef}
            style={{height}}
            className={[
                "w-full transition-colors",
                isOver ? "bg-blue-500/25" : "bg-transparent",
                className ?? "",
            ].join(" ")}
        />
    );
};
```

---
#### 5


` File: src/components/sort-tree/flatten.ts`  [↑ Back to top](#index)

```ts
import type {NodePath, TreeNode} from "./types";
import {pathToString} from "./utils";

export interface FlatRow<T> {
    node: TreeNode<T>;
    path: NodePath;
    depth: number;
    hasChildren: boolean;
    matched: boolean;
    /** Sibling info inside its parent */
    sibling: { index: number; count: number; isFirst: boolean; isLast: boolean };
    /**
     * For each ancestor depth (1..depth-1), whether a vertical line should continue.
     * guides[0] corresponds to depth=1 (root level ancestor), etc.
     */
    guides: boolean[];
}

export function flatten<T>(
    list: Array<TreeNode<T>>,
    getKey: (n: TreeNode<T>) => string | number,
    {
        parentPath = [],
        out = [] as Array<FlatRow<T>>,
        forcedExpand = new Set<string>(),
        matchedPaths = new Set<string>(),
        ancestorGuides = [] as boolean[],
    } = {}
) {
    for (let i = 0; i < list.length; i++) {
        const n = list[i];
        const path = [...parentPath, getKey(n)];
        const pathStr = pathToString(path);
        const isExpanded = !!n.expanded || forcedExpand.has(pathStr);
        const count = list.length;
        const isFirst = i === 0;
        const isLast = i === count - 1;
        const hasChildren = !!(n.children && n.children.length);

        out.push({
            node: n,
            path,
            depth: path.length,
            hasChildren,
            matched: matchedPaths.has(pathStr),
            sibling: { index: i, count, isFirst, isLast },
            guides: ancestorGuides.slice(),
        });

        if (isExpanded && hasChildren) {
            // For children, extend guides: current level continues if NOT last sibling
            const nextGuides = [...ancestorGuides, !isLast];
            flatten(n.children, getKey, {
                parentPath: path as any,
                out,
                forcedExpand,
                matchedPaths,
                ancestorGuides: nextGuides,
            });
        }
    }
    return out;
}
```

---
#### 6


` File: src/components/sort-tree/helpers.ts`  [↑ Back to top](#index)

```ts
import type {ChangeDetail, NodePath, TreeNode} from "./types";
import {
    defaultGetKey,
    insertNodeAtPath,
    removeNodeAtPath,
    subtreeDepth,
} from "./utils";

export function moveNode<T>(args: {
    data: Array<TreeNode<T>>;
    getNodeKey?: (n: TreeNode<T>) => string | number;
    fromPath: NodePath;
    toParentPath: NodePath | null;
    toIndex: number;
    maxDepth?: number;
}): { tree: Array<TreeNode<T>>; detail: ChangeDetail<T> } {
    const getKey = args.getNodeKey ?? defaultGetKey;
    const { tree: afterRemoval, removed } = removeNodeAtPath<T>(args.data, args.fromPath, getKey);
    if (!removed) throw new Error("moveNode: source not found");

    const baseDepth = (args.toParentPath?.length ?? 0) + 1;
    const totalDepth = baseDepth + (subtreeDepth(removed.node) - 1);
    const limit = args.maxDepth ?? Infinity;
    if (totalDepth > limit) throw new Error(`moveNode: exceeds maxDepth (${limit})`);

    const { tree: finalTree, toInfo } = insertNodeAtPath<T>(
        afterRemoval,
        args.toParentPath,
        args.toIndex,
        removed.node,
        getKey
    );

    const detail: ChangeDetail<T> = {
        type:
            removed.parentPath &&
            toInfo.parentPath &&
            removed.parentPath.join("/") === toInfo.parentPath.join("/")
                ? "reorder"
                : "move",
        node: removed.node,
        from: {
            parent: removed.parent,
            parentPath: removed.parentPath,
            index: removed.index,
            depth: removed.depth,
        },
        to: toInfo,
    };

    return { tree: finalTree, detail };
}

export function changeNodeAtPath<T>(
    data: Array<TreeNode<T>>,
    path: NodePath,
    updater: (node: TreeNode<T>) => TreeNode<T>,
    getKey: (n: TreeNode<T>) => string | number = defaultGetKey
): Array<TreeNode<T>> {
    const next = data.map(n => ({ ...n, children: n.children ? [...n.children] : undefined }));
    function helper(list: Array<TreeNode<T>>, pathIdx: number) {
        const key = path[pathIdx];
        const i = list.findIndex(x => getKey(x) === key);
        if (i === -1) return;
        if (pathIdx === path.length - 1) {
            list[i] = updater(list[i]);
        } else {
            const childList = list[i].children ?? [];
            helper(childList, pathIdx + 1);
            list[i].children = childList;
        }
    }
    helper(next, 0);
    return next;
}

export function addNode<T>(
    data: Array<TreeNode<T>>,
    parentPath: NodePath | null,
    index: number,
    node: TreeNode<T>,
    getKey: (n: TreeNode<T>) => string | number = defaultGetKey
): { tree: Array<TreeNode<T>>; detail: ChangeDetail<T> } {
    const { tree, toInfo } = insertNodeAtPath<T>(data, parentPath, index, node, getKey);
    const detail: ChangeDetail<T> = { type: "insert", node, to: toInfo };
    return { tree, detail };
}

export function removeNode<T>(
    data: Array<TreeNode<T>>,
    path: NodePath,
    getKey: (n: TreeNode<T>) => string | number = defaultGetKey
): { tree: Array<TreeNode<T>>; detail?: ChangeDetail<T> } {
    const { tree, removed } = removeNodeAtPath<T>(data, path, getKey);
    if (!removed) return { tree };
    const detail: ChangeDetail<T> = {
        type: "remove",
        node: removed.node,
        from: {
            parent: removed.parent,
            parentPath: removed.parentPath,
            index: removed.index,
            depth: removed.depth,
        },
    };
    return { tree, detail };
}
```

---
#### 7


` File: src/components/sort-tree/index.ts`  [↑ Back to top](#index)

```ts
// Types
export type {
    NodeKey,
    NodePath,
    TreeNode,
    ChangeType,
    PositionInfo,
    ChangeDetail,
    SortTreeProps,
} from "./types";

// Main component
export { SortTree } from "./SortTree";

// Public helpers for programmatic edits
export { moveNode, addNode, removeNode, changeNodeAtPath } from "./helpers";

// Optional UI building blocks (in case you want to swap/compose)
export { NodeRow } from "./NodeRow";
export { DefaultNode } from "./DefaultNode";
export { DropZone } from "./DropZone";
export { DraggableRow } from "./DraggableRow";

// Low-level utils if needed
export {
    defaultGetKey,
    locateByPath,
    pathToString,
    stringToPath,
} from "./utils";
```

---
#### 8


` File: src/components/sort-tree/NodeRow.css`  [↑ Back to top](#index)

```txt
/* line theming via CSS vars (can be overridden upstream) */
:root {
    --tree-line-color: #d1d5db; /* gray-300 */
    --tree-line-width: 1px;
    --tree-line-style: solid; /* solid | dashed | dotted */
    --elbow-v-h: 100%
}

/* container for each row */
.tree-row {
    display: flex;
    align-items: center;
    gap: 0.5rem; /* matches your gap-2 */
    /*padding: 0.25rem 0.5rem; !* py-1 px-2 *!*/
}

/* left rail: N ancestor columns (width given inline) */
.tree-rail {
    display: flex;
    position: relative;
}

/* a single ancestor column; width is set inline to `indent` */
.tree-col {
    position: relative;
}

/* draw vertical guideline IF data-show="1" */
.tree-col[data-show="1"]::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    border-left: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color);
}

/* the elbow cell for the current node (one per row) */
.tree-elbow {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* vertical segment (full for mid siblings, half for last) */
.tree-elbow::before {
    content: "";
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 0;
    height: var(--elbow-v-h, 100%); /* "50%" for last sibling, else "100%" */
    border-left: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color);
}

/* horizontal segment (elbow) from center to the content area */
.tree-elbow::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%);
    width: 50%;
    border-top: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color);
}
```

---
#### 9


` File: src/components/sort-tree/NodeRow.tsx`  [↑ Back to top](#index)

```tsx
import * as React from "react";
import "./NodeRow.css";
import { DefaultNode } from "./DefaultNode";
import type { NodePath, TreeNode } from "./types";
import { VscChevronRight } from "react-icons/vsc";
import { TbChevronDownRight } from "react-icons/tb";

export interface NodeRowProps<T = unknown> {
    node: TreeNode<T>;
    path: NodePath;
    depth: number;
    indent: number; // px per depth
    matched: boolean;
    isDragging: boolean;

    onToggle(): void;

    renderNode?: (args: {
        node: TreeNode<T>;
        depth: number;
        isDragging: boolean;
        path: NodePath;
        toggle(): void;
        matched: boolean;
    }) => React.ReactNode;

    onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;

    /** Optional binding lines config */
    binding?: {
        show: boolean;
        guides: boolean[]; // length = depth - 1 (true => draw vertical in that ancestor column)
        isLast: boolean;   // is last among siblings

        /** Optional styling */
        lineStyle?: "solid" | "dashed" | "dotted";
        lineWidth?: number; // px
        color?: string;     // CSS color
    };
}

export function NodeRow<T = unknown>({
    node,
    path,
    depth,
    indent,
    matched,
    isDragging,
    onToggle,
    renderNode,
    onContextMenu,
    binding,
}: NodeRowProps<T>) {
    const hasParent = depth > 1;
    const showBinding = !!binding?.show && hasParent;

    // CSS variables for theming the lines (safe cast for custom props)
    const lineVars = {
        ["--tree-line-color" as any]: binding?.color ?? "var(--tree-line, #d1d5db)",
        ["--tree-line-width" as any]: `${binding?.lineWidth ?? 1}px`,
        ["--tree-line-style" as any]: binding?.lineStyle ?? "solid",
        // elbow vertical height: 50% if last sibling, else full
        ["--elbow-v-h" as any]: binding?.isLast ? "50%" : "100%",
    } as React.CSSProperties;

    const pad = Math.max(0, depth - 1) * indent;

    return (
        <div className="tree-row" style={lineVars} onContextMenu={onContextMenu}>
            {/* === Binding columns (ancestors) via ::before === */}
            {showBinding ? (
                <div className="tree-rail" style={{ width: pad }}>
                    {binding!.guides.map((g, i) => (
                        <span
                            key={i}
                            className="tree-col"
                            data-show={g ? "1" : "0"}
                            style={{ width: indent }}
                        />
                    ))}
                </div>
            ) : (
                <div style={{ width: pad }} />
            )}
            {/* === Elbow for this node (vertical + horizontal via ::before/::after) === */}
            {showBinding && (
                <div className="tree-elbow" style={{ width: indent }}>
                    {/* pseudo-elements draw the elbow; nothing needed here */}
                </div>
            )}

            {/* === Content === */}
            <div className="flex-1 min-w-0">
                {renderNode ? (
                    renderNode({
                        node,
                        depth,
                        isDragging,
                        path,
                        toggle: onToggle,
                        matched,
                    })
                ) : (
                    <DefaultNode node={node} matched={matched} />
                )}
            </div>

            {/* Right-side toggle as in your screenshot */}
            <button
                type="button"
                onClick={onToggle}
                className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-black/5"
                aria-label={node.expanded ? "Collapse" : "Expand"}
                title={node.expanded ? "Collapse" : "Expand"}
                style={{ position: "relative", zIndex: 1 }}
            >
                {node.children?.length ? (!node.expanded ? <VscChevronRight /> : <TbChevronDownRight />) : ""}
            </button>
        </div>
    );
}
```

---
#### 10


` File: src/components/sort-tree/search.ts`  [↑ Back to top](#index)

```ts
import type {NodePath, TreeNode} from "./types";
import { pathToString } from "./utils";

export function defaultMatch<T>(node: TreeNode<T>, q: string): boolean {
    if (!q) return false;
    return String(node.title).toLowerCase().includes(q.toLowerCase());
}

export function buildSearchSets<T>(
    data: Array<TreeNode<T>>,
    getKey: (n: TreeNode<T>) => string | number,
    match: (n: TreeNode<T>, q: string) => boolean,
    q: string
) {
    const matchedPaths = new Set<string>();
    const expandPaths = new Set<string>();

    function walk(list: Array<TreeNode<T>>, parentPath: NodePath = []): boolean {
        let anyChildMatched = false;
        for (const n of list) {
            const path = [...parentPath, getKey(n)];
            const pathStr = pathToString(path);
            const self = match(n, q);
            let childMatched = false;
            if (n.children?.length) childMatched = walk(n.children, path);

            if (self) matchedPaths.add(pathStr);
            if (self || childMatched) {
                if (parentPath.length) {
                    for (let i = 1; i <= parentPath.length; i++) {
                        expandPaths.add(pathToString(parentPath.slice(0, i)));
                    }
                }
            }
            anyChildMatched = anyChildMatched || self || childMatched;
        }
        return anyChildMatched;
    }

    if (q) walk(data);
    return { matchedPaths, expandPaths };
}
```

---
#### 11


` File: src/components/sort-tree/SortTree.tsx`  [↑ Back to top](#index)

```tsx
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
```

---
#### 12


` File: src/components/sort-tree/types.ts`  [↑ Back to top](#index)

```ts
import * as React from "react";

/** Primitives */
export type NodeKey = string | number;
export type NodePath = NodeKey[];

/** Tree node */
export interface TreeNode<T = unknown> {
    id: NodeKey;
    title: string;
    icon?: React.ReactNode;
    children?: Array<TreeNode<T>>;
    expanded?: boolean;
    data?: T;
}

/** Change event shape */
export type ChangeType =
    | "reorder" // among siblings
    | "move"    // to a different parent
    | "insert"  // programmatic insert
    | "remove"  // programmatic remove
    | "toggle"  // expand/collapse
    | "update"; // programmatic update (rename, etc.)

export interface PositionInfo<T = unknown> {
    parent: TreeNode<T> | null;
    parentPath: NodePath | null;
    index: number;
    depth: number;
}

export interface ChangeDetail<T = unknown> {
    type: ChangeType;
    node: TreeNode<T>;
    from?: PositionInfo<T>;
    to?: PositionInfo<T>;
    context?: Record<string, unknown>;
}

/** Context menu payload */
export interface ContextMenuDetail<T = unknown> {
    node: TreeNode<T>;
    path: NodePath;
    depth: number;              // 1 = root children
    index: number;              // index within parent
    parent: TreeNode<T> | null;
    parentPath: NodePath | null;
    rowIndex: number;           // index within flattened render list
    rect: DOMRect;              // row bounding rect (for menu positioning)
    event: React.MouseEvent;    // original event (clientX/clientY, modifiers, etc.)
}

/** Component props */
export interface SortTreeProps<T = unknown> {
    data: Array<TreeNode<T>>;

    onChange(next: Array<TreeNode<T>>, detail: ChangeDetail<T>): void;

    // Controls
    getNodeKey?(node: TreeNode<T>): NodeKey; // default: node.id
    maxDepth?: number;                        // default: Infinity
    indent?: number;                          // px per depth, default: 24
    canDrag?(node: TreeNode<T>): boolean;     // default: true
    canDrop?(args: {
        dragged: TreeNode<T>;
        from: PositionInfo<T>;
        to: PositionInfo<T>;
    }): boolean;                              // default: true

    // Search
    searchQuery?: string; // default: ''
    searchMatch?(node: TreeNode<T>, query: string): boolean; // default: title includes
    autoExpandSearchResults?: boolean; // default: true

    // Virtualization
    height?: number;            // if set, uses react-window
    rowHeight?: number;         // default: 44
    overscanCount?: number;     // default: 8

    // Custom UI (row content)
    renderNode?(args: {
        node: TreeNode<T>;
        depth: number;
        isDragging: boolean;
        path: NodePath;
        toggle(): void;
        matched: boolean;
    }): React.ReactNode;

    className?: string;
    style?: React.CSSProperties;

    // Context menu
    onContextMenu?(detail: ContextMenuDetail<T>): void;

    /** Prevent native browser context menu on rows (default: true) */
    preventNativeContextMenu?: boolean;

    /** Show ASCII-style binding lines for ancestors/siblings (default: false) */
    showBinding?: boolean;
}
```

---
#### 13


` File: src/components/sort-tree/utils.ts`  [↑ Back to top](#index)

```ts
import type {NodeKey, NodePath, TreeNode} from "./types";

export function defaultGetKey<T>(n: TreeNode<T>): NodeKey {
    return n.id;
}

export function cloneTree<T>(data: Array<TreeNode<T>>): Array<TreeNode<T>> {
    return data.map(n => ({
        ...n,
        children: n.children ? cloneTree(n.children) : undefined,
    }));
}

export function pathToString(path: NodePath): string {
    return path.map(String).join("/");
}

export function stringToPath(s: string): NodePath {
    if (!s) return [];
    return s.split("/").map(seg => (Number.isFinite(+seg) && !Number.isNaN(+seg) ? +seg : seg));
}

export interface LocatedNode<T> {
    node: TreeNode<T>;
    parent: TreeNode<T> | null;
    parentPath: NodePath | null;
    index: number;
    path: NodePath;
    depth: number;
}

export function locateByPath<T>(
    data: Array<TreeNode<T>>,
    path: NodePath,
    getKey: (n: TreeNode<T>) => NodeKey
): LocatedNode<T> | null {
    if (path.length === 0) return null;

    let parent: TreeNode<T> | null = null;
    let parentPath: NodePath | null = null;
    let list = data;
    let node: TreeNode<T> | undefined;
    let idx = -1;

    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        idx = list.findIndex(x => getKey(x) === key);
        if (idx === -1) return null;
        node = list[idx];
        if (i < path.length - 1) {
            parent = node!;
            parentPath = path.slice(0, i + 1);
            list = node!.children ?? [];
        }
    }

    if (!node) return null;

    return {node, parent, parentPath, index: idx, path, depth: path.length};
}

export function removeNodeAtPath<T>(
    data: Array<TreeNode<T>>,
    path: NodePath,
    getKey: (n: TreeNode<T>) => NodeKey
): { tree: Array<TreeNode<T>>; removed?: LocatedNode<T> } {
    const next = cloneTree(data);

    function helper(
        list: Array<TreeNode<T>>,
        pathIdx: number,
        carryPath: NodePath
    ): LocatedNode<T> | undefined {
        const key = path[pathIdx];
        const i = list.findIndex(x => getKey(x) === key);
        if (i === -1) return undefined;
        if (pathIdx === path.length - 1) {
            const [removedNode] = list.splice(i, 1);
            return {
                node: removedNode,
                parent: carryPath.length ? locateByPath(next, carryPath, getKey)?.node ?? null : null,
                parentPath: carryPath.length ? carryPath : null,
                index: i,
                path,
                depth: path.length,
            };
        } else {
            const childList = list[i].children ?? [];
            const found = helper(childList, pathIdx + 1, [...carryPath, key]);
            list[i].children = childList;
            return found;
        }
    }

    const removed = helper(next, 0, []);
    return {tree: next, removed};
}

export function insertNodeAtPath<T>(
    data: Array<TreeNode<T>>,
    parentPath: NodePath | null,
    index: number,
    node: TreeNode<T>,
    getKey: (n: TreeNode<T>) => NodeKey
): {
    tree: Array<TreeNode<T>>;
    insertedPath: NodePath;
    toInfo: { parent: TreeNode<T> | null; parentPath: NodePath | null; index: number; depth: number }
} {
    const next = cloneTree(data);

    if (!parentPath || parentPath.length === 0) {
        const i = Math.max(0, Math.min(index, next.length));
        next.splice(i, 0, node);
        return {
            tree: next,
            insertedPath: [getKey(node)],
            toInfo: {parent: null, parentPath: null, index: i, depth: 1},
        };
    }

    const located = locateByPath(next, parentPath, getKey);
    if (!located) throw new Error("insertNodeAtPath: parent not found");

    const parent = located.node;
    const children = parent.children ? [...parent.children] : [];
    const i = Math.max(0, Math.min(index, children.length));
    children.splice(i, 0, node);
    parent.children = children;

    const insertedPath = [...parentPath, getKey(node)];
    return {
        tree: next,
        insertedPath,
        toInfo: {parent, parentPath, index: i, depth: insertedPath.length},
    };
}

export function subtreeDepth<T>(node: TreeNode<T>): number {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(subtreeDepth));
}
```

---
#### 14


` File: src/index.css`  [↑ Back to top](#index)

```txt
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-card: var(--card);
    --color-card-foreground: var(--card-foreground);
    --color-popover: var(--popover);
    --color-popover-foreground: var(--popover-foreground);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-secondary: var(--secondary);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-destructive: var(--destructive);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);
    --color-chart-1: var(--chart-1);
    --color-chart-2: var(--chart-2);
    --color-chart-3: var(--chart-3);
    --color-chart-4: var(--chart-4);
    --color-chart-5: var(--chart-5);
    --color-sidebar: var(--sidebar);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-ring: var(--sidebar-ring);

    --color-selected: var(--selected);
    --color-paper: var(--bg-paper);
    --color-paper-foreground: var(--fg-paper);
    --color-paper-border: var(--border-paper);
    --radius-paper: var(--radius-paper);
}


:root {
    --bg-paper: var(--background); /* fallback to your global background */
    --fg-paper: var(--foreground); /* fallback to your global foreground */
    --border-paper: var(--border); /* fallback to your global border color */
    --radius-paper: 0.5rem; /* tiny rounding */
    --selected: #EEF2FF;
    --radius: 0.625rem;
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --chart-1: oklch(0.646 0.222 41.116);
    --chart-2: oklch(0.6 0.118 184.704);
    --chart-3: oklch(0.398 0.07 227.392);
    --chart-4: oklch(0.828 0.189 84.429);
    --chart-5: oklch(0.769 0.188 70.08);
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);
}

.dark {
    --selected: #222144;
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.488 0.243 264.376);
    --chart-2: oklch(0.696 0.17 162.48);
    --chart-3: oklch(0.769 0.188 70.08);
    --chart-4: oklch(0.627 0.265 303.9);
    --chart-5: oklch(0.645 0.246 16.439);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
    * {
        @apply border-border outline-ring/50;
    }

    body {
        @apply bg-background text-foreground;
    }
}

@plugin 'tailwind-scrollbar';
```


---
*Generated with [Prodex](https://github.com/emxhive/prodex) — Codebase decoded.*
<!-- PRODEx v1.4.0 | 2025-11-11T04:21:30.870Z -->