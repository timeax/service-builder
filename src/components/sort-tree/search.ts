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