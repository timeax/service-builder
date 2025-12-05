import type {NodePath, TreeNode} from "./types";
import { pathToString } from "./utils";

export function defaultMatch<T>(node: TreeNode<T>, q: string): boolean {
    if (!q) return false;
    return String((node as any).title).toLowerCase().includes(q.toLowerCase());
}

export function buildSearchSets<T>(
    data: Array<TreeNode<T>>,
    getKey: (n: TreeNode<T>) => string | number,
    match: (n: TreeNode<T>, q: string) => boolean,
    q: string
) {
    const matchedPaths = new Set<string>();
    const expandPaths = new Set<string>();
    const searching = !!q;

    function expandAncestors(path: NodePath) {
        if (!path.length) return;
        // expand all prefixes of the path (ancestors only, not including leaf unless caller adds it)
        for (let i = 1; i <= path.length; i++) {
            const anc = path.slice(0, i);
            expandPaths.add(pathToString(anc));
        }
    }

    function walk(list: Array<TreeNode<T>>, parentPath: NodePath = []): boolean {
        let anyChildMatched = false;

        for (const n of list) {
            const path = [...parentPath, getKey(n)];
            const pathStr = pathToString(path);

            const self = match(n, q);

            const rawChildren = (n as any).children;
            const childrenIsArray = Array.isArray(rawChildren);
            const childrenArray = childrenIsArray ? (rawChildren as Array<TreeNode<T>>) : null;
            const childrenIsLazy = typeof rawChildren === "function";

            let childMatched = false;
            if (childrenArray && childrenArray.length) {
                childMatched = walk(childrenArray, path);
            }

            if (self) matchedPaths.add(pathStr);

            // Normal behavior: expand ancestors for self/child matches
            if (self || childMatched) {
                expandAncestors(parentPath);
            }

            // NEW: while searching, auto-expand nodes that have LAZY children,
            // so the UI can reveal the node and give the loader a chance to run.
            if (searching && childrenIsLazy) {
                // Expand THIS node (so it appears opened)…
                expandPaths.add(pathStr);
                // …and also expand its ancestors so it becomes visible in the tree.
                expandAncestors(parentPath);
            }

            anyChildMatched = anyChildMatched || self || childMatched;
        }

        return anyChildMatched;
    }

    if (q) walk(data);
    return { matchedPaths, expandPaths };
}
