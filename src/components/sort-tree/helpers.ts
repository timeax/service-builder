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