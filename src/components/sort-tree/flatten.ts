// noinspection PointlessBooleanExpressionJS

import type { NodePath, TreeNode } from './types';
import { pathToString } from './utils';

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

type IconValue<T> = TreeNode<T>['icon'];
type IconSource<T> = IconValue<T> | ((node: TreeNode<T>) => IconValue<T>);

export function flatten<T>(
    list: Array<TreeNode<T>>,
    getKey: (n: TreeNode<T>) => string | number,
    opts?: {
        parentPath?: NodePath;
        out?: Array<FlatRow<T>>;
        forcedExpand?: Set<string>;
        matchedPaths?: Set<string>;
        ancestorGuides?: boolean[];
        /** If a node’s icon is undefined/null, use this value or resolver */
        defaultNodeIcon?: IconSource<T>;
    },
) {
    const {
        parentPath = [],
        out = [] as Array<FlatRow<T>>,
        forcedExpand = new Set<string>(),
        matchedPaths = new Set<string>(),
        ancestorGuides = [] as boolean[],
        defaultNodeIcon,
    } = opts ?? {};

    for (let i = 0; i < list.length; i++) {
        const n = list[i];
        const path = [...parentPath, getKey(n)];
        const pathStr = pathToString(path);

        const rawChildren = n.children;
        const childrenIsArray = Array.isArray(rawChildren);
        const childrenIsLazy = typeof rawChildren === 'function';

        const isExpanded = !!n.expanded || forcedExpand.has(pathStr);
        const count = list.length;
        const isFirst = i === 0;
        const isLast = i === count - 1;

        // hasChildren:
        // - true if array with length
        // - true if lazy function (we assume potential children exist)
        const hasChildren = childrenIsArray ? (rawChildren as Array<TreeNode<T>>).length > 0 : Boolean(childrenIsLazy);

        // Apply default icon *only* to the flattened row payload (no source mutation)
        let nodeForRow: TreeNode<T> = n;
        const missingIcon = n.icon == null; // treat undefined/null as missing
        if (missingIcon && defaultNodeIcon !== undefined) {
            const icon = typeof defaultNodeIcon === 'function' ? (defaultNodeIcon as (node: TreeNode<T>) => IconValue<T>)(n) : defaultNodeIcon;
            nodeForRow = { ...n, icon };
        }

        out.push({
            node: nodeForRow,
            path,
            depth: path.length,
            hasChildren,
            matched: matchedPaths.has(pathStr),
            sibling: { index: i, count, isFirst, isLast },
            guides: ancestorGuides.slice(),
        });

        // Only descend when:
        // - node is expanded (or forced via search), AND
        // - children are already materialized as an ARRAY
        if (isExpanded && childrenIsArray && (rawChildren as Array<TreeNode<T>>).length > 0) {
            // For children, extend guides: current level continues if NOT last sibling
            const nextGuides = [...ancestorGuides, !isLast];
            flatten(rawChildren as Array<TreeNode<T>>, getKey, {
                parentPath: path,
                out,
                forcedExpand,
                matchedPaths,
                ancestorGuides: nextGuides,
                defaultNodeIcon, // propagate
            });
        }
    }
    return out;
}
