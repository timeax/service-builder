import * as React from 'react';
import { changeNodeAtPath } from '../helpers';
import type { ChangeDetail, NodeKey, NodePath, PositionInfo, TreeNode } from '../types';
import { locateByPath } from '../utils';

export interface UseCreateUIArgs<T> {
    tree: Array<TreeNode<T>>;
    setTree(next: Array<TreeNode<T>>): void;
    getNodeKey(n: TreeNode<T>): NodeKey;
    onChange(next: Array<TreeNode<T>>, detail: ChangeDetail<T>): void;

    /** Resolve a (path | id) to a NodePath or null */
    resolvePath(target: NodePath | NodeKey): NodePath | null;

    /** Optional factory (title -> node). Default: `{ id: title, title }` */
    makeNodeFromTitle?(title: string): TreeNode<T>;
}

/**
 * Encapsulates inline-create UI and programmatic create.
 * - `showCreateUI(at)` focuses an input rendered by the caller
 * - `commitCreateUI()` inserts using `makeNodeFromTitle(inputValue)`
 * - `create(at, node, index?)` inserts a provided node programmatically
 */
export function useCreateUi<T>({ tree, setTree, getNodeKey, onChange, resolvePath, makeNodeFromTitle }: UseCreateUIArgs<T>) {
    const [createUIAt, setCreateUIAt] = React.useState<NodePath | null>(null);
    const [createUIValue, setCreateUIValue] = React.useState<string>('');
    const createInputRef = React.useRef<HTMLInputElement | null>(null);

    const makeNode: (title: string) => TreeNode<T> = makeNodeFromTitle || ((title: string) => ({ id: title, title }) as unknown as TreeNode<T>);

    function apiCreate(at: NodePath | NodeKey, newNode: TreeNode<T>, index?: number) {
        const targetPath = resolvePath(at);
        if (!targetPath) return;

        const located = locateByPath<T>(tree, targetPath, getNodeKey);
        if (!located) return;

        const parent = located.node;
        const children = Array.isArray(parent.children) ? [...parent.children] : [];
        const pos = index == null ? children.length : Math.max(0, Math.min(children.length, index));
        children.splice(pos, 0, newNode);

        const next = changeNodeAtPath<T>(tree, targetPath, (node) => ({
            ...node,
            expanded: true, // ensure visible
            children,
        }));

        let prevented = false;

        onChange(next, {
            type: 'insert',
            node: newNode,
            to: {
                parent,
                parentPath: targetPath,
                index: pos,
                depth: (targetPath?.length ?? 0) + 1,
            } as PositionInfo<T>,
            preventDefault: () => {
                prevented = true;
            },
            context: { via: 'api.create' },
        });

        if (!prevented) {
            setTree(next);
        }
    }

    function showCreateUI(at: NodePath | NodeKey) {
        const p = resolvePath(at);
        if (!p) return;

        setCreateUIAt(p);
        setCreateUIValue('');

        // Expand the parent so the inline input becomes visible
        const located = locateByPath<T>(tree, p, getNodeKey);
        if (located && !located.node.expanded) {
            const next = changeNodeAtPath<T>(tree, p, (node) => ({ ...node, expanded: true }));
            setTree(next);
        }

        // Focus on next paint
        setTimeout(() => createInputRef.current?.focus(), 0);
    }

    function cancelCreateUI() {
        setCreateUIAt(null);
        setCreateUIValue('');
    }

    function commitCreateUI() {
        if (!createUIAt) return;
        const title = createUIValue.trim();
        setCreateUIAt(null);
        setCreateUIValue('');
        if (!title) return;

        const newNode = makeNode(title);

        const targetPath = createUIAt;
        const located = locateByPath<T>(tree, targetPath, getNodeKey);
        if (!located) return;

        const parent = located.node;
        const children = Array.isArray(parent.children) ? [...parent.children] : [];
        const pos = children.length;
        children.push(newNode);

        const next = changeNodeAtPath<T>(tree, targetPath, (node) => ({
            ...node,
            expanded: true, // ensure visible
            children,
        }));

        let prevented = false;

        onChange(next, {
            type: 'insert',
            node: newNode,
            to: {
                parent,
                parentPath: targetPath,
                index: pos,
                depth: (targetPath?.length ?? 0) + 1,
            } as PositionInfo<T>,
            preventDefault: () => {
                prevented = true;
            },
            context: { via: 'ui.create' },
        });

        if (!prevented) {
            setTree(next);
        }
    }

    return {
        createUIAt,
        createUIValue,
        setCreateUIValue,
        createInputRef,
        showCreateUI,
        cancelCreateUI,
        commitCreateUI,
        apiCreate,
    };
}
