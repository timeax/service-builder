import * as React from 'react';

import { changeNodeAtPath } from '../helpers';
import type { NodeKey, NodePath, TreeNode } from '../types';
import { locateByPath } from '../utils';

/** private flags kept on node objects (typed as `any` when used) */
export const LOADER = '__childrenLoader'; // () => Promise<TreeNode[]>
export const LOADING = '__childrenLoading'; // boolean
export const LOADED = '__childrenLoaded'; // boolean
export const INVALID = '__childrenInvalid'; // boolean

export function useLazyChildren<T>(args: {
    tree: Array<TreeNode<T>>;
    setTree: React.Dispatch<React.SetStateAction<Array<TreeNode<T>>>>;
    getNodeKey: (n: TreeNode<T>) => NodeKey;
    onChange: (tree: Array<TreeNode<T>>, detail: any) => void;
}) {
    const { tree, setTree, getNodeKey, onChange } = args;

    /** Capture a function in LOADER; set LOADED depending on materialization. */
    const normalizeLoader = React.useCallback((node: any) => {
        if (typeof node.children === 'function') {
            const f = node.children as () => Array<TreeNode<T>> | Promise<Array<TreeNode<T>>>;
            node[LOADER] = () => Promise.resolve(f());
            node.children = undefined; // do not recurse into a function
            node[LOADED] = false;
        } else if (Array.isArray(node.children)) {
            node[LOADED] = true;
        } else if (typeof node[LOADER] === 'function') {
            // has loader but not yet materialized
            if (node[LOADED] == null) node[LOADED] = false;
        }
    }, []);

    const loadChildren = React.useCallback(
        (path: NodePath) => {
            const located = locateByPath<T>(tree, path, getNodeKey);
            if (!located) return;
            const nAny: any = located.node;
            normalizeLoader(nAny);
            const loader = nAny[LOADER] as undefined | (() => Promise<Array<TreeNode<T>>>);
            if (!loader || nAny[LOADING]) return;

            nAny[LOADING] = true;
            loader()
                .then((kids) => {
                    const next = changeNodeAtPath<T>(tree, path, (node) => {
                        const nn: any = { ...node };
                        normalizeLoader(nn);
                        nn.children = Array.isArray(kids) ? kids : [];
                        nn[LOADING] = false;
                        nn[LOADED] = true;
                        nn[INVALID] = false;
                        return nn;
                    });
                    setTree(next);
                    onChange(next, { type: 'update', node: located.node, preventDefault: () => {}, context: { lazyLoaded: true } });
                })
                .catch(() => {
                    const next = changeNodeAtPath<T>(tree, path, (node) => ({ ...(node as any), [LOADING]: false }));
                    setTree(next);
                });
        },
        [tree, setTree, getNodeKey, onChange, normalizeLoader],
    );

    /** Ensure a children array exists for DnD target; treat as "loaded now". */
    const primeChildrenArrayIfNeeded = React.useCallback(
        (path: NodePath) => {
            const located = locateByPath<T>(tree, path, getNodeKey);
            if (!located) return tree;
            const nAny: any = located.node;
            if (Array.isArray(nAny.children)) return tree;
            normalizeLoader(nAny);
            const next = changeNodeAtPath<T>(tree, path, (node) => {
                const nn: any = { ...node };
                normalizeLoader(nn);
                nn.children = []; // materialize empty
                nn[LOADED] = true; // mark as loaded until refresh/invalidate says otherwise
                return nn;
            });
            setTree(next);
            return next;
        },
        [tree, setTree, getNodeKey, normalizeLoader],
    );

    function refreshOne(target: NodePath) {
        const located = locateByPath<T>(tree, target, getNodeKey);
        if (!located) return;

        const hasLoader = typeof (located.node as any)[LOADER] === 'function' || typeof (located.node as any).children === 'function';

        if (!hasLoader) return;

        const next = changeNodeAtPath<T>(tree, target, (n) => {
            const nn: any = { ...n };
            normalizeLoader(nn);
            nn.children = undefined; // drop cache
            nn[LOADING] = false;
            nn[LOADED] = false;
            nn[INVALID] = false;
            return nn;
        });
        setTree(next);
    }

    function invalidateOne(target: NodePath) {
        const located = locateByPath<T>(tree, target, getNodeKey);
        if (!located) return;

        const hasLoader = typeof (located.node as any)[LOADER] === 'function' || typeof (located.node as any).children === 'function';

        if (!hasLoader) return;

        // Keep current children visible; mark as stale so next expand triggers load
        const next = changeNodeAtPath<T>(tree, target, (n) => {
            const nn: any = { ...n };
            normalizeLoader(nn);
            nn[INVALID] = true;
            return nn;
        });
        setTree(next);
    }

    function refreshAll(nodes: Array<TreeNode<T>>, prefix: NodePath = []) {
        nodes.forEach((n) => {
            const path = [...prefix, getNodeKey(n)];
            const anyN: any = n;
            if (typeof anyN[LOADER] === 'function' || typeof anyN.children === 'function') {
                refreshOne(path);
            }
            if (Array.isArray(n.children)) refreshAll(n.children, path);
        });
    }

    function invalidateAll(nodes: Array<TreeNode<T>>, prefix: NodePath = []) {
        nodes.forEach((n) => {
            const path = [...prefix, getNodeKey(n)];
            const anyN: any = n;
            if (typeof anyN[LOADER] === 'function' || typeof anyN.children === 'function') {
                invalidateOne(path);
            }
            if (Array.isArray(n.children)) invalidateAll(n.children, path);
        });
    }

    return {
        normalizeLoader,
        loadChildren,
        primeChildrenArrayIfNeeded,
        refreshOne,
        invalidateOne,
        refreshAll,
        invalidateAll,
    } as const;
}
