import type { NodeKey, NodePath, TreeNode } from '../types';

export function isPrefix(a: NodePath, b: NodePath) {
    if (!a || !b) return false;
    if (a.length > b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

export function samePath(a?: NodePath | null, b?: NodePath | null) {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/** Depth-first path finder by id (works even if the node isn’t visible in flattened rows). */
export function findPathById<T>(nodes: Array<TreeNode<T>>, getKey: (n: TreeNode<T>) => NodeKey, id: NodeKey, acc: NodePath = []): NodePath | null {
    const wanted = String(id);
    for (const n of nodes) {
        const here = [...acc, getKey(n)];
        if (String(getKey(n)) === wanted) return here;

        const rawChildren = (n as any).children;
        if (Array.isArray(rawChildren) && rawChildren.length) {
            const sub = findPathById(rawChildren as Array<TreeNode<T>>, getKey, id, here);
            if (sub) return sub;
        }
        // If children is a function (lazy), we DO NOT invoke it here.
        // Callers can decide to load and retry separately.
    }
    return null;
}
