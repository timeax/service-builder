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
