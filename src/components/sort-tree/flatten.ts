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
