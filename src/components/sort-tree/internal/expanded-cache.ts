import * as React from 'react';
import type { NodeKey, NodePath, TreeNode } from '../types';

import { type CacheStore, createCache, createIndexedDBDriver, createMemoryDriver, useCacheKey } from '@timeax/cache-store';

/* ───────────────────────────── Expanded cache (IDB) ─────────────────────────────
   We cache EXPANDED PATHS (not node.expanded). UI derives expanded state from cache.

   - Stored value: string[] of "path keys" (pathKey(path))
   - Scoping: optional `cacheKey` (recommended: workspaceId / treeId)
────────────────────────────────────────────────────────────────────────────── */

const EXP_DB_NAME = 'dgp-cache';
const EXP_STORE_NAME = 'kv';
const EXP_NS = 'sort-tree:expanded';

let _expCache: CacheStore | null = null;

export function getExpandCache(): CacheStore {
    if (_expCache) return _expCache;

    const isBrowser = typeof window !== 'undefined';
    _expCache = createCache({
        driver: isBrowser
            ? createIndexedDBDriver({
                  dbName: EXP_DB_NAME,
                  storeName: EXP_STORE_NAME,
                  ns: EXP_NS,
              })
            : createMemoryDriver(),
        hydrate: isBrowser,
        cleanupExpiredOnHydrate: true,
    });

    return _expCache;
}

export function pathKey(path: NodePath): string {
    return path.map((v) => String(v)).join('\u0001');
}

export function computeInitialExpandedPaths<T>(
    nodes: Array<TreeNode<T>>,
    getNodeKey: (n: TreeNode<T>) => NodeKey,
    prefix: NodePath = [],
    out: string[] = [],
): string[] {
    for (const n of nodes) {
        const p: NodePath = [...prefix, getNodeKey(n)];
        const exp = n.expanded;
        if (typeof exp === 'boolean' && exp === true) out.push(pathKey(p));
        if (Array.isArray(n.children)) computeInitialExpandedPaths(n.children, getNodeKey, p, out);
    }
    return out;
}

export function decorateExpandedByPath<T>(
    nodes: Array<TreeNode<T>>,
    expanded: Set<string>,
    getNodeKey: (n: TreeNode<T>) => NodeKey,
    prefix: NodePath = [],
): Array<TreeNode<T>> {
    return nodes.map((n) => {
        const p: NodePath = [...prefix, getNodeKey(n)];
        const wantExpanded = expanded.has(pathKey(p));

        const cur = n.expanded;
        const curIsBool = typeof cur === 'boolean';
        const sameExpanded = curIsBool ? cur === wantExpanded : false;

        const nextChildren = Array.isArray(n.children) ? decorateExpandedByPath(n.children, expanded, getNodeKey, p) : n.children;

        if (sameExpanded && nextChildren === n.children) return n;

        const nn: TreeNode<T> = { ...n, expanded: wantExpanded };
        if (nextChildren !== n.children) nn.children = nextChildren;

        return nn as TreeNode<T>;
    });
}

export function useExpandedPathsCache<T>(args: {
    data: Array<TreeNode<T>>;
    tree: Array<TreeNode<T>>;
    getNodeKey: (n: TreeNode<T>) => NodeKey;
    cacheKey?: string;
}) {
    const { data, tree, getNodeKey, cacheKey } = args;

    const expandCache = React.useMemo(() => getExpandCache(), []);

    const scope = React.useMemo(() => {
        const explicit = cacheKey ? String(cacheKey).trim() : '';
        if (explicit) return explicit;

        const roots = data
            .slice(0, 12)
            .map((n) => String(getNodeKey(n)))
            .join('|');

        return `roots:${roots}|len:${data.length}`;
    }, [cacheKey, data, getNodeKey]);

    const EXP_KEY = React.useMemo(() => `expanded:${scope}`, [scope]);

    const [expReady, setExpReady] = React.useState<boolean>(expandCache.isReady());

    React.useEffect(() => {
        if (expandCache.isReady()) {
            setExpReady(true);
            expandCache.emit(EXP_KEY);
            return;
        }
        return expandCache.subscribeReady(() => {
            setExpReady(true);
            expandCache.emit(EXP_KEY);
        });
    }, [expandCache, EXP_KEY]);

    const expandedArr = useCacheKey<string[]>(expandCache, EXP_KEY);

    React.useEffect(() => {
        if (!expReady) return;
        if (expandedArr !== undefined) return;

        const initial = computeInitialExpandedPaths<T>(data, getNodeKey);
        expandCache.set<string[]>(EXP_KEY, Array.from(new Set(initial)));
    }, [expReady, expandedArr, expandCache, EXP_KEY, data, getNodeKey]);

    const expandedSig = React.useMemo(() => (expandedArr ?? []).join('\u0000'), [expandedArr]);
    const expandedSet = React.useMemo(() => new Set(expandedArr ?? []), [expandedArr]);

    const treeView = React.useMemo(() => decorateExpandedByPath<T>(tree, expandedSet, getNodeKey), [tree, expandedSet, getNodeKey]);

    const setExpandedAtPath = React.useCallback(
        (path: NodePath, wantExpand?: boolean): { changed: boolean; nextExpanded: boolean } => {
            const k = pathKey(path);
            const current = expandedSet.has(k);
            const nextVal = wantExpand === undefined ? !current : wantExpand;

            if (nextVal === current) return { changed: false, nextExpanded: nextVal };

            const next = new Set(expandedSet);
            if (nextVal) next.add(k);
            else next.delete(k);

            expandCache.set<string[]>(EXP_KEY, Array.from(next));

            return { changed: true, nextExpanded: nextVal };
        },
        [expandedSet, expandCache, EXP_KEY],
    );

    const isExpanded = React.useCallback((path: NodePath) => expandedSet.has(pathKey(path)), [expandedSet]);

    return {
        treeView,
        expandedSet,
        expandedSig,
        expReady,
        EXP_KEY,
        setExpandedAtPath,
        isExpanded,
    } as const;
}
