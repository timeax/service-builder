import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ChangeDetail, SortTreeRef, TreeNode } from './types';
import { SortTree } from './sort-tree';

vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    PointerSensor: class PointerSensor {},
    useSensor: () => ({}),
    useSensors: () => [],
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
    useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {} }),
}));

vi.mock('./internal/expanded-cache', () => ({
    pathKey: (path: Array<string | number>) => path.join('/'),
    useExpandedPathsCache: ({ tree }: { tree: Array<TreeNode<unknown>> }) => ({
        treeView: tree,
        expandedSet: new Set<string>(),
        expandedSig: '',
        setExpandedAtPath: () => ({ changed: false, nextExpanded: false }),
        isExpanded: () => false,
    }),
}));

const initial: Array<TreeNode> = [
    { id: 'first', title: 'First node' },
    { id: 'second', title: 'Second node' },
];

function Harness({ preventRemoval = false }: { preventRemoval?: boolean }) {
    const [data, setData] = React.useState(initial);
    const treeRef = React.useRef<SortTreeRef>(null);

    return (
        <>
            <button type="button" onClick={() => treeRef.current?.remove('first')}>
                Remove first
            </button>
            <SortTree
                ref={treeRef}
                data={data}
                onChange={(next, detail: ChangeDetail) => {
                    if (detail.type !== 'remove') return;
                    if (preventRemoval) detail.preventDefault();
                    else setData(next);
                }}
            />
        </>
    );
}

describe('SortTree imperative removal', () => {
    it('removes a resolved node through the public ref API', () => {
        render(<Harness />);

        expect(screen.getByText('First node')).toBeInTheDocument();
        act(() => screen.getByRole('button', { name: 'Remove first' }).click());

        expect(screen.queryByText('First node')).not.toBeInTheDocument();
        expect(screen.getByText('Second node')).toBeInTheDocument();
    });

    it('honors preventDefault from the removal change event', () => {
        render(<Harness preventRemoval />);

        act(() => screen.getByRole('button', { name: 'Remove first' }).click());

        expect(screen.getByText('First node')).toBeInTheDocument();
    });
});
