import * as React from 'react';
import { changeNodeAtPath } from '../helpers';
import type { ChangeDetail, NodeKey, NodePath, TreeNode } from '../types';
import { locateByPath } from '../utils';

export interface UseEditUIArgs<T> {
    tree: Array<TreeNode<T>>;
    setTree(next: Array<TreeNode<T>>): void;
    getNodeKey(n: TreeNode<T>): NodeKey;
    onChange(next: Array<TreeNode<T>>, detail: ChangeDetail<T>): void;

    /** Resolve a (path | id) to a NodePath or null */
    resolvePath(target: NodePath | NodeKey): NodePath | null;
}

export function useEditUi<T>({ tree, setTree, getNodeKey, onChange, resolvePath }: UseEditUIArgs<T>) {
    const [editPath, setEditPath] = React.useState<NodePath | null>(null);

    function showEditUI(at: NodePath | NodeKey) {
        const p = resolvePath(at);
        if (!p) return;
        setEditPath(p);
    }

    function cancelEditUI() {
        setEditPath(null);
    }

    function commitEditUI(at: NodePath | NodeKey, newTitle: string) {
        const p = resolvePath(at);
        if (!p) return;

        const title = newTitle.trim();
        setEditPath(null);

        if (!title) return;

        const located = locateByPath<T>(tree, p, getNodeKey);
        if (!located) return;

        // Optimization: if title hasn't changed, do nothing
        if (located.node.title === title) return;

        const updatedNode = { ...located.node, title };
        const next = changeNodeAtPath<T>(tree, p, () => updatedNode, getNodeKey);

        let prevented = false;

        onChange(next, {
            type: 'update',
            node: updatedNode,
            preventDefault: () => {
                prevented = true;
            },
            context: { via: 'ui.edit', oldTitle: located.node.title },
        });

        if (!prevented) {
            setTree(next);
        }
    }

    return {
        editPath,
        showEditUI,
        cancelEditUI,
        commitEditUI,
    };
}
