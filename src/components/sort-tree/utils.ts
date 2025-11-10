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