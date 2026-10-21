// noinspection GrazieInspection
import type { NodeKey, NodePath, TreeNode } from './types';

export function defaultGetKey<T>(n: TreeNode<T>): NodeKey {
    return n.id;
}

/** Deep clone that preserves function children and only clones arrays. */
export function cloneTree<T>(data: Array<TreeNode<T>>): Array<TreeNode<T>> {
    return data.map((n) => ({
        ...n,
        children: Array.isArray(n.children) ? cloneTree(n.children) : n.children, // keep function/undefined as-is
    }));
}

/**
 * PathString v1
 * - Encodes a NodePath (array of NodeKey) as base64url(JSON) with a "p1:" prefix.
 * - SSR-safe: falls back to Buffer if btoa/atob are unavailable.
 */
const PFX = 'p1:';

// Base64 helpers (no Buffer, no atob/btoa)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const trip = (b0 << 16) | (b1 << 8) | b2;

        const c0 = (trip >> 18) & 63;
        const c1 = (trip >> 12) & 63;
        const c2 = (trip >> 6) & 63;
        const c3 = trip & 63;

        out += B64[c0] + B64[c1] + (i + 1 < bytes.length ? B64[c2] : '=') + (i + 2 < bytes.length ? B64[c3] : '=');
    }
    return out;
}

function base64ToBytes(b64: string): Uint8Array {
    // strip whitespace, pad to multiple of 4
    b64 = b64.replace(/[\r\n\s]/g, '');
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    b64 += '='.repeat(pad);

    const inv = new Int16Array(256).fill(-1);
    for (let i = 0; i < B64.length; i++) inv[B64.charCodeAt(i)] = i;

    const bytes: number[] = [];
    for (let i = 0; i < b64.length; i += 4) {
        const c0 = inv[b64.charCodeAt(i)];
        const c1 = inv[b64.charCodeAt(i + 1)];
        const c2 = b64[i + 2] === '=' ? -1 : inv[b64.charCodeAt(i + 2)];
        const c3 = b64[i + 3] === '=' ? -1 : inv[b64.charCodeAt(i + 3)];
        if (c0 < 0 || c1 < 0 || (c2 < 0 && b64[i + 2] !== '=') || (c3 < 0 && b64[i + 3] !== '=')) {
            throw new Error('Invalid base64');
        }
        const trip = (c0 << 18) | (c1 << 12) | ((c2 & 63) << 6) | (c3 & 63);
        bytes.push((trip >> 16) & 255);
        if (c2 >= 0) bytes.push((trip >> 8) & 255);
        if (c3 >= 0) bytes.push(trip & 255);
    }
    return new Uint8Array(bytes);
}

// === replace your toB64Url / fromB64Url with these ===
function toB64Url(s: string): string {
    const bytes = new TextEncoder().encode(s);
    const b64 = bytesToBase64(bytes);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64Url(b: string): string {
    const base = b.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = base64ToBytes(base);
    return new TextDecoder().decode(bytes);
}

/** Encode a NodePath into a safe string. */
export function pathToString(path: NodePath): string {
    const json = JSON.stringify(path);
    return PFX + toB64Url(json);
}

/** Decode a safe string back into a NodePath. Throws if not a valid v1 string. */
export function stringToPath(s: string): NodePath {
    if (!s || !s.startsWith(PFX)) {
        throw new Error('Invalid path string (expected p1: prefix).');
    }
    const json = fromB64Url(s.slice(PFX.length));
    const value = JSON.parse(json);
    if (!Array.isArray(value)) throw new Error('Invalid path payload.');
    for (const v of value) {
        const t = typeof v;
        if (t !== 'string' && t !== 'number') throw new Error('Invalid NodeKey in path payload.');
    }
    return value as NodePath;
}

export interface LocatedNode<T> {
    node: TreeNode<T>;
    parent: TreeNode<T> | null;
    parentPath: NodePath | null;
    index: number;
    path: NodePath;
    depth: number;
}

/** Locate strictly through materialized arrays; functions are treated as "not loaded". */
export function locateByPath<T>(data: Array<TreeNode<T>>, path: NodePath, getKey: (n: TreeNode<T>) => NodeKey): LocatedNode<T> | null {
    if (path.length === 0) return null;

    let parent: TreeNode<T> | null = null;
    let parentPath: NodePath | null = null;
    let list: Array<TreeNode<T>> = data;
    let node: TreeNode<T> | undefined;
    let idx = -1;

    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        idx = list.findIndex((x) => getKey(x) === key);
        if (idx === -1) return null;
        node = list[idx];

        if (i < path.length - 1) {
            parent = node!;
            parentPath = path.slice(0, i + 1);
            const childSrc = parent!.children;
            if (!Array.isArray(childSrc)) return null; // child list not loaded
            list = childSrc;
        }
    }

    if (!node) return null;
    return { node, parent, parentPath, index: idx, path, depth: path.length };
}

/** Remove node by path; only traverses materialized arrays. */
export function removeNodeAtPath<T>(
    data: Array<TreeNode<T>>,
    path: NodePath,
    getKey: (n: TreeNode<T>) => NodeKey,
): { tree: Array<TreeNode<T>>; removed?: LocatedNode<T> } {
    const next = cloneTree(data);

    function helper(list: Array<TreeNode<T>>, pathIdx: number, carryPath: NodePath): LocatedNode<T> | undefined {
        const key = path[pathIdx];
        const i = list.findIndex((x) => getKey(x) === key);
        if (i === -1) return undefined;

        if (pathIdx === path.length - 1) {
            const [removedNode] = list.splice(i, 1);
            return {
                node: removedNode,
                parent: carryPath.length ? (locateByPath(next, carryPath, getKey)?.node ?? null) : null,
                parentPath: carryPath.length ? carryPath : null,
                index: i,
                path,
                depth: path.length,
            };
        }

        const childSrc = list[i].children;
        if (!Array.isArray(childSrc)) return undefined; // not loaded; cannot traverse
        const childList = [...childSrc];
        const found = helper(childList, pathIdx + 1, [...carryPath, key]);
        list[i].children = childList;
        return found;
    }

    const removed = helper(next, 0, []);
    return { tree: next, removed };
}

/** Insert under parentPath; materializes an empty array if parent has no array yet. */
export function insertNodeAtPath<T>(
    data: Array<TreeNode<T>>,
    parentPath: NodePath | null,
    index: number,
    node: TreeNode<T>,
    getKey: (n: TreeNode<T>) => NodeKey,
): {
    tree: Array<TreeNode<T>>;
    insertedPath: NodePath;
    toInfo: { parent: TreeNode<T> | null; parentPath: NodePath | null; index: number; depth: number };
} {
    const next = cloneTree(data);

    if (!parentPath || parentPath.length === 0) {
        const i = Math.max(0, Math.min(index, next.length));
        next.splice(i, 0, node);
        return {
            tree: next,
            insertedPath: [getKey(node)],
            toInfo: { parent: null, parentPath: null, index: i, depth: 1 },
        };
    }

    const located = locateByPath(next, parentPath, getKey);
    if (!located) throw new Error('insertNodeAtPath: parent not found');

    const parent = located.node;

    // Ensure an array is present (do not call loaders here).
    const current = Array.isArray(parent.children) ? parent.children : [];
    const children = [...current];
    const i = Math.max(0, Math.min(index, children.length));
    children.splice(i, 0, node);
    parent.children = children;

    const insertedPath = [...parentPath, getKey(node)];
    return {
        tree: next,
        insertedPath,
        toInfo: { parent, parentPath, index: i, depth: insertedPath.length },
    };
}

/** Depth counting only considers materialized children arrays. */
export function subtreeDepth<T>(node: TreeNode<T>): number {
    const kids = node.children;
    if (!Array.isArray(kids) || kids.length === 0) return 1;
    return 1 + Math.max(...kids.map(subtreeDepth));
}
