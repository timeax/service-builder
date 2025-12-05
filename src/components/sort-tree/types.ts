import * as React from "react";

/** Primitives */
export type NodeKey = string | number;
export type NodePath = NodeKey[];

/** Tree node */
export interface TreeNode<T = unknown> {
    id: NodeKey;
    title: string;
    icon?: React.ReactNode;
    /**
     * Children may be:
     *  - a materialized array
     *  - a lazy loader that returns children (sync or async)
     */
    children?:
        | Array<TreeNode<T>>
        | (() => Array<TreeNode<T>> | Promise<Array<TreeNode<T>>>);
    expanded?: boolean;
    data?: T;
}

/** Selection */
export type SelectionMode = "none" | "single" | "multiple";

/** Change event kinds */
export type ChangeType =
    | "reorder"   // among siblings
    | "move"      // to a different parent
    | "insert"    // programmatic insert
    | "remove"    // programmatic remove
    | "toggle"    // expand/collapse
    | "update"    // programmatic update (rename, etc.)
    | "selection"; // selection changed

export interface PositionInfo<T = unknown> {
    parent: TreeNode<T> | null;
    parentPath: NodePath | null;
    index: number;
    depth: number;
}

/** Fine-grained change payloads (better typing than a single catch-all) */
export interface ChangeDetailMove<T = unknown> {
    type: "move" | "reorder";
    node: TreeNode<T>;
    from: PositionInfo<T>;
    to: PositionInfo<T>;
    context?: Record<string, unknown>;
}
export interface ChangeDetailInsert<T = unknown> {
    type: "insert";
    node: TreeNode<T>;
    to: PositionInfo<T>;
    /** Optional convenience when you want both to & parent on insert events */
    parent?: TreeNode<T> | null;
    context?: Record<string, unknown>;
}
export interface ChangeDetailRemove<T = unknown> {
    type: "remove";
    node: TreeNode<T>;
    from: PositionInfo<T>;
    context?: Record<string, unknown>;
}
export interface ChangeDetailToggle<T = unknown> {
    type: "toggle";
    node: TreeNode<T>;
    from: PositionInfo<T>;
    context?: Record<string, unknown>; // e.g. { expanded: boolean }
}
export interface ChangeDetailUpdate<T = unknown> {
    type: "update";
    node: TreeNode<T>;
    context?: Record<string, unknown>;
}
export interface ChangeDetailSelection {
    type: "selection";
    selection: string[]; // selected node ids (as strings)
    context?: { via?: "click" | "keyboard" | "api" } & Record<string, unknown>;
}

export type ChangeDetail<T = unknown> =
    | ChangeDetailMove<T>
    | ChangeDetailInsert<T>
    | ChangeDetailRemove<T>
    | ChangeDetailToggle<T>
    | ChangeDetailUpdate<T>
    | ChangeDetailSelection;

/** Context menu payload */
export interface ContextMenuDetail<T = unknown> {
    node: TreeNode<T>;
    path: NodePath;
    depth: number; // 1 = root children
    index: number; // index within parent
    parent: TreeNode<T> | null;
    parentPath: NodePath | null;
    rowIndex: number; // index within flattened render list
    rect: DOMRect; // row bounding rect (for menu positioning)
    event: React.MouseEvent; // original event (clientX/clientY, modifiers, etc.)
}

/** Drop zones */
export type DropZone = "before" | "on" | "after";

/** Component props */
export interface SortTreeProps<T = unknown> {
    data: Array<TreeNode<T>>;

    onChange(next: Array<TreeNode<T>>, detail: ChangeDetail<T>): void;

    // Controls
    getNodeKey?(node: TreeNode<T>): NodeKey; // default: node.id
    maxDepth?: number; // default: Infinity
    indent?: number; // px per depth, default: 24
    canDrag?(node: TreeNode<T>): boolean; // default: true

    /**
     * Decide if a drop is allowed. Runs for internal (tree→tree) and external (native) drops.
     * All fields except `to` are optional for back-compat with simpler implementations.
     */
    canDrop?(args: {
        dragged?: TreeNode<T> | null;
        from?: PositionInfo<T> | null;
        to: PositionInfo<T>;
        origin?: "internal" | "external";
        hint?: { willExceedMaxDepth?: boolean };
    }): boolean; // default: true

    // Search
    searchQuery?: string; // default: ''
    searchMatch?(node: TreeNode<T>, query: string): boolean; // default: title includes
    autoExpandSearchResults?: boolean; // default: true

    // Virtualization
    height?: number; // if set, uses react-window
    rowHeight?: number; // default: 44
    overscanCount?: number; // default: 8

    // Custom UI (row content)
    renderNode?(args: {
        node: TreeNode<T>;
        depth: number;
        isDragging: boolean;
        path: NodePath;
        toggle(): void;
        matched: boolean;
    }): React.ReactNode;

    /**
     * Optional row-level class. Accepts a fixed string or a function to compute per-node.
     * nodeClassName → applied to the inner NodeRow container
     * rowClassName  → applied to the outer row wrapper
     */
    nodeClassName?:
        | string
        | ((args: {
        node: TreeNode<T>;
        depth: number;
        path: NodePath;
        matched: boolean;
        isDragging: boolean;
    }) => string);

    rowClassName?:
        | string
        | ((args: {
        node: TreeNode<T>;
        depth: number;
        path: NodePath;
        matched: boolean;
        isDragging: boolean;
    }) => string);

    className?: string;
    style?: React.CSSProperties;

    // Context menu
    onContextMenu?(detail: ContextMenuDetail<T>): void;

    /** Prevent native browser context menu on rows (default: true) */
    preventNativeContextMenu?: boolean;

    /** Show ASCII-style binding lines for ancestors/siblings (default: false) */
    showBinding?: boolean;

    /**
     * Called when a native (external) item is dropped onto a zone (files, text, images, etc.).
     * Use this to insert nodes based on DataTransfer contents.
     */
    onExternalDrop?(detail: {
        zone: DropZone;
        over: TreeNode<T>;
        to: PositionInfo<T>;
        dataTransfer: DataTransfer;
    }): void;

    /** NEW — treat every node as a valid parent target even if it currently has no children */
    allSupportSubnodes?: boolean;

    /** NEW — selection API */
    selectionMode?: SelectionMode;                 // default: "none"
    value?: string | string[];                     // controlled selected ids
    defaultValue?: string | string[];              // uncontrolled initial selected ids
    onSelect?(ids: string[], meta?: { via: "click" | "keyboard" | "api" }): void;

    /** NEW — factory used by createUI(title) → node */
    makeNodeFromTitle?(title: string): TreeNode<T>;

    /** Selected-state classes */
    selectedRowClassName?:
        | string
        | ((args: { node: TreeNode<T>; depth: number; path: NodePath; matched: boolean }) => string);
    selectedNodeClassName?:
        | string
        | ((args: { node: TreeNode<T>; depth: number; path: NodePath; matched: boolean }) => string);
    skinClassName?: | string
        | ((args: {
        node: TreeNode<T>;
        depth: number;
        path: NodePath;
        matched: boolean;
        isDragging: boolean;
    }) => string);

    selectedSkinClassName?: | string
        | ((args: {
        node: TreeNode<T>;
        depth: number;
        path: NodePath;
        matched: boolean;
    }) => string);

    defaultNodeIcon?: React.ReactNode | ((node: TreeNode<T>) => React.ReactNode);
}

/** Imperative API (use with React.forwardRef) */
export interface SortTreeRef<T = unknown> {
    /** Expand/collapse/toggle a node (by path or by id) */
    expand(target: NodePath | NodeKey): void;
    collapse(target: NodePath | NodeKey): void;
    toggle(target: NodePath | NodeKey): void;

    /** Selection control */
    select(id: string): void;
    selectMany(ids: string[]): void;
    clearSelection(): void;

    /** Create a child under target at optional index */
    create(at: NodePath | NodeKey, newNode: TreeNode<T>, index?: number): void;

    /** Show an inline create input under target; Esc cancels, Enter/blur commits */
    createUI(at: NodePath | NodeKey): void;
    cancelCreateUI(): void;


    /** Clear lazy cache globally or for a specific node (by id/path). */
    refresh(target?: NodePath | NodeKey): void;
    invalidate(target?: NodePath | NodeKey): void;
    remove(target: NodePath | NodeKey): void;
}
