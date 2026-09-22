import * as React from 'react';

import { changeNodeAtPath } from '../helpers';
import type { NodeKey, NodePath, SortTreeProps, TreeNode } from '../types';
import { locateByPath } from '../utils';

/** Private flags kept on node objects while lazy children are materialized. */
export const LOADER = '__childrenLoader'; // () => Promise<TreeNode[]>
export const LOADING = '__childrenLoading'; // boolean
export const LOADED = '__childrenLoaded'; // boolean
export const INVALID = '__childrenInvalid'; // boolean

type LazyTreeNode<T> = TreeNode<T> & {
    [LOADER]?: () => Promise<Array<TreeNode<T>>>;
    [LOADING]?: boolean;
    [LOADED]?: boolean;
    [INVALID]?: boolean;
};

export function useLazyChildren<T>(args: {
    tree: Array<TreeNode<T>>;
    setTree: React.Dispatch<React.SetStateAction<Array<TreeNode<T>>>>;
    getNodeKey: (n: TreeNode<T>) => NodeKey;
    onChange: SortTreeProps<T>['onChange'];
}) {
    const { tree, setTree, getNodeKey, onChange } = args;

    /** Capture a function in LOADER; set LOADED depending on materialization. */
    const normalizeLoader = React.useCallback((node: TreeNode<T>) => {
        const lazyNode = node as LazyTreeNode<T>;
        if (typeof lazyNode.children === 'function') {
            const f = lazyNode.children as () => Array<TreeNode<T>> | Promise<Array<TreeNode<T>>>;
            lazyNode[LOADER] = () => Promise.resolve(f());
            lazyNode.children = undefined; // do not recurse into a function
            lazyNode[LOADED] = false;
        } else if (Array.isArray(lazyNode.children)) {
            lazyNode[LOADED] = true;
        } else if (typeof lazyNode[LOADER] === 'function') {
            // has loader but not yet materialized
            if (lazyNode[LOADED] == null) lazyNode[LOADED] = false;
        }
    }, []);

    const loadChildren = React.useCallback(
        (path: NodePath) => {
            const located = locateByPath<T>(tree, path, getNodeKey);
            if (!located) return;
            const lazyNode = located.node as LazyTreeNode<T>;
            normalizeLoader(lazyNode);
            const loader = lazyNode[LOADER];
            if (!loader || lazyNode[LOADING]) return;

            lazyNode[LOADING] = true;
            loader()
                .then((kids) => {
                    const next = changeNodeAtPath<T>(tree, path, (node) => {
                        const nn: LazyTreeNode<T> = { ...node };
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
                    const next = changeNodeAtPath<T>(tree, path, (node) => ({ ...node, [LOADING]: false }));
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
            const lazyNode = located.node as LazyTreeNode<T>;
            if (Array.isArray(lazyNode.children)) return tree;
            normalizeLoader(lazyNode);
            const next = changeNodeAtPath<T>(tree, path, (node) => {
                const nn: LazyTreeNode<T> = { ...node };
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

        const lazyNode = located.node as LazyTreeNode<T>;
        const hasLoader = typeof lazyNode[LOADER] === 'function' || typeof lazyNode.children === 'function';

        if (!hasLoader) return;

        const next = changeNodeAtPath<T>(tree, target, (n) => {
            const nn: LazyTreeNode<T> = { ...n };
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

        const lazyNode = located.node as LazyTreeNode<T>;
        const hasLoader = typeof lazyNode[LOADER] === 'function' || typeof lazyNode.children === 'function';

        if (!hasLoader) return;

        // Keep current children visible; mark as stale so next expand triggers load
        const next = changeNodeAtPath<T>(tree, target, (n) => {
            const nn: LazyTreeNode<T> = { ...n };
            normalizeLoader(nn);
            nn[INVALID] = true;
            return nn;
        });
        setTree(next);
    }

    function refreshAll(nodes: Array<TreeNode<T>>, prefix: NodePath = []) {
        nodes.forEach((n) => {
            const path = [...prefix, getNodeKey(n)];
            const lazyNode = n as LazyTreeNode<T>;
            if (typeof lazyNode[LOADER] === 'function' || typeof lazyNode.children === 'function') {
                refreshOne(path);
            }
            if (Array.isArray(n.children)) refreshAll(n.children, path);
        });
    }

    function invalidateAll(nodes: Array<TreeNode<T>>, prefix: NodePath = []) {
        nodes.forEach((n) => {
            const path = [...prefix, getNodeKey(n)];
            const lazyNode = n as LazyTreeNode<T>;
            if (typeof lazyNode[LOADER] === 'function' || typeof lazyNode.children === 'function') {
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
