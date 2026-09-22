import { type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import * as React from 'react';

import { buildCollisionDetection } from '../core/collision';
import { isPrefix } from '../core/paths';
import { parseDragId, parseZoneId } from '../dnd-ids';
import { moveNode } from '../helpers';
import type { DropZone, NodeKey, NodePath, PositionInfo, SortTreeProps, TreeNode } from '../types';
import { locateByPath, subtreeDepth } from '../utils';

export function useTreeDnd<T>(args: {
    tree: Array<TreeNode<T>>;
    setTree: React.Dispatch<React.SetStateAction<Array<TreeNode<T>>>>;
    getNodeKey: (n: TreeNode<T>) => NodeKey;
    maxDepth: number;
    canDrag: (n: TreeNode<T>) => boolean;
    canDrop: NonNullable<SortTreeProps<T>['canDrop']>;
    allSupportSubnodes: boolean;
    onChange: SortTreeProps<T>['onChange'];
    onExternalDrop?: SortTreeProps<T>['onExternalDrop'];
    primeChildrenArrayIfNeeded: (path: NodePath) => Array<TreeNode<T>>;
}) {
    const { tree, setTree, getNodeKey, maxDepth, canDrag, canDrop, allSupportSubnodes, onChange, onExternalDrop, primeChildrenArrayIfNeeded } = args;

    const [activePath, setActivePath] = React.useState<NodePath | null>(null);
    const [activeNode, setActiveNode] = React.useState<TreeNode<T> | null>(null);
    const lastOverId = React.useRef<string | null>(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const collisionBase = React.useMemo(buildCollisionDetection, []);
    const collisionDetection = React.useCallback<typeof collisionBase>(
        (cArgs) => {
            const res = collisionBase(cArgs);
            if (res.length) lastOverId.current = String(res[0].id);
            return res;
        },
        [collisionBase],
    );

    function handleDragStart(evt: DragStartEvent) {
        const path = parseDragId(String(evt.active.id));
        if (!path) return;
        const located = locateByPath<T>(tree, path, getNodeKey);
        if (!located || !canDrag(located.node)) return;
        setActivePath(path);
        setActiveNode(located.node);
    }

    function makePositionInfo(toParentPath: NodePath | null, toIndex: number): PositionInfo<T> {
        const parentLocated = toParentPath?.length ? locateByPath<T>(tree, toParentPath, getNodeKey) : null;
        const parent = parentLocated?.node ?? null;
        const depth = (toParentPath?.length ?? 0) + 1;
        return { parent, parentPath: toParentPath, index: toIndex, depth };
    }

    function resolveTarget(
        overLocated: { path: NodePath; index: number; parentPath: NodePath | null; node: TreeNode<T> },
        zone: DropZone,
    ): { toParentPath: NodePath | null; toIndex: number } {
        if (zone === 'before') return { toParentPath: overLocated.parentPath, toIndex: overLocated.index };
        if (zone === 'after') return { toParentPath: overLocated.parentPath, toIndex: overLocated.index + 1 };
        return { toParentPath: overLocated.path, toIndex: overLocated.node.children?.length ?? 0 };
    }

    function handleDragEnd(evt: DragEndEvent) {
        const overId = evt.over?.id ? String(evt.over.id) : (lastOverId.current ?? null);
        const actPath = activePath;
        const actNode = activeNode;

        setActivePath(null);
        setActiveNode(null);
        lastOverId.current = null;

        if (!overId || !actPath || !actNode) return;

        const parsed = parseZoneId(overId);
        if (!parsed) return;

        const overLocated = locateByPath<T>(tree, parsed.path, getNodeKey);
        if (!overLocated) return;

        const zone: DropZone = parsed.zone === 'on' && !allSupportSubnodes && !overLocated.node.children?.length ? 'after' : parsed.zone;

        if (zone === 'on' && isPrefix(actPath, overLocated.path)) return;

        // Dropping ON a lazy node → materialize an empty array and treat it as loaded
        let workingTree = tree;
        if (zone === 'on' && !overLocated.node.children?.length) {
            workingTree = primeChildrenArrayIfNeeded(overLocated.path);
        }

        const target = resolveTarget(overLocated, zone);
        const toParentPath = target.toParentPath;
        let { toIndex } = target;

        const fromLocated0 = locateByPath<T>(workingTree, actPath, getNodeKey);
        if (!fromLocated0) return;

        const fromInfo: PositionInfo<T> = {
            parent: fromLocated0.parent,
            parentPath: fromLocated0.parentPath,
            index: fromLocated0.index,
            depth: fromLocated0.depth,
        };
        const toInfoPre = makePositionInfo(toParentPath, toIndex);

        const totalDepth = toInfoPre.depth + (subtreeDepth<T>(actNode) - 1);
        const willExceed = totalDepth > maxDepth;

        if (
            !canDrop?.({
                dragged: actNode,
                from: fromInfo,
                to: toInfoPre,
                origin: 'internal',
                hint: { willExceedMaxDepth: willExceed },
            })
        ) {
            return;
        }
        if (willExceed) return;

        if (
            fromInfo.parentPath &&
            toParentPath &&
            fromInfo.parentPath.length === toParentPath.length &&
            fromInfo.parentPath.every((v, i) => v === toParentPath![i]) &&
            fromInfo.index < toIndex
        ) {
            toIndex -= 1;
        }

        const toInfo = makePositionInfo(toParentPath, toIndex);

        if ((fromInfo.parentPath?.join('/') ?? '') === (toInfo.parentPath?.join('/') ?? '') && fromInfo.index === toInfo.index) {
            return;
        }

        const { tree: moved, detail } = moveNode<T>({
            data: workingTree,
            getNodeKey,
            fromPath: actPath,
            toParentPath,
            toIndex,
            maxDepth,
        });

        let prevented = false;

        onChange(moved, {
            ...detail,
            preventDefault: () => {
                prevented = true;
            },
            context: { via: `drop:${zone}`, origin: 'internal' },
        });

        if (!prevented) {
            setTree(moved);
        }
    }

    function handleExternalDrop(e: React.DragEvent<HTMLDivElement>, dzId: string) {
        const parsed = parseZoneId(dzId);
        if (!parsed) return;

        const overLocated = locateByPath<T>(tree, parsed.path, getNodeKey);
        if (!overLocated) return;

        const zone: DropZone = parsed.zone === 'on' && !allSupportSubnodes && !overLocated.node.children?.length ? 'after' : parsed.zone;

        const { toParentPath, toIndex } = resolveTarget(overLocated, zone);
        const toInfo = makePositionInfo(toParentPath, toIndex);

        if (!canDrop?.({ dragged: null, from: null, to: toInfo, origin: 'external' })) return;

        onExternalDrop?.({
            zone,
            over: overLocated.node,
            to: toInfo,
            dataTransfer: e.dataTransfer as DataTransfer,
        });
    }

    return {
        sensors,
        collisionDetection,
        activePath,
        activeNode,
        handleDragStart,
        handleDragEnd,
        handleExternalDrop,
    } as const;
}
