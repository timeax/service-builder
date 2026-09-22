import { render, screen } from '@testing-library/react';
import { nodeTypes } from './index.tsx';

vi.mock('@xyflow/react', async () => {
    const React = await import('react');
    return {
        Handle: (props: any) => <div data-testid="rf-handle" {...props} />,
        Position: { Left: 'left', Right: 'right' },
    };
});

describe('canvas reactflow node styling', () => {
    it('applies active outline classes for tag nodes', () => {
        const TagNode = nodeTypes.tag;
        render(
            <TagNode
                id="t:1"
                type="tag"
                selected={false}
                data={{
                    node: { id: 't:1', label: 'Tag 1', kind: 'tag' },
                    isActiveNode: true,
                }}
                dragging={false}
                draggable
                selectable
                deletable
                zIndex={0}
                isConnectable
                positionAbsoluteX={0}
                positionAbsoluteY={0}
            />,
        );

        const shell = screen.getByText('Tag 1').closest('div[data-node-state]');
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('outline-emerald-500');
        expect(shell?.className).toContain('dark:outline-emerald-400');
    });

    it('applies lighter highlighted outline classes for tag nodes', () => {
        const TagNode = nodeTypes.tag;
        render(
            <TagNode
                id="t:2"
                type="tag"
                selected={false}
                data={{
                    node: { id: 't:2', label: 'Tag 2', kind: 'tag' },
                    isManualHighlighted: true,
                }}
                dragging={false}
                draggable
                selectable
                deletable
                zIndex={0}
                isConnectable
                positionAbsoluteX={0}
                positionAbsoluteY={0}
            />,
        );

        const shell = screen.getByText('Tag 2').closest('div[data-node-state]');
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('outline-amber-300');
        expect(shell?.className).toContain('dark:outline-amber-200');
    });

    it('uses the same active/highlight classes for option nodes', () => {
        const OptionNode = nodeTypes.option;
        render(
            <OptionNode
                id="o:1"
                type="option"
                selected={false}
                data={{
                    node: { id: 'o:1', label: 'Option 1', kind: 'option' },
                    isActiveNode: true,
                    isManualHighlighted: true,
                }}
                dragging={false}
                draggable
                selectable
                deletable
                zIndex={0}
                isConnectable
                positionAbsoluteX={0}
                positionAbsoluteY={0}
            />,
        );

        const shell = screen.getByText('Option 1').closest('div[data-node-state]');
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('outline-emerald-500');
        expect(shell?.className).toContain('dark:outline-emerald-400');
        expect(shell?.className).toContain('outline-amber-300');
        expect(shell?.className).toContain('dark:outline-amber-200');
    });

    it('keeps selected-only nodes on blue ring styling', () => {
        const TagNode = nodeTypes.tag;
        render(
            <TagNode
                id="t:3"
                type="tag"
                selected
                data={{
                    node: { id: 't:3', label: 'Tag 3', kind: 'tag' },
                    isActiveNode: false,
                }}
                dragging={false}
                draggable
                selectable
                deletable
                zIndex={0}
                isConnectable
                positionAbsoluteX={0}
                positionAbsoluteY={0}
            />,
        );

        const shell = screen.getByText('Tag 3').closest('div[data-node-state]');
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('ring-sky-300');
        expect(shell?.className).toContain('dark:ring-sky-400');
        expect(shell?.className).not.toContain('outline-emerald-500');
    });

    it('marks system-inactive nodes as muted while keeping them visible', () => {
        const FieldNode = nodeTypes.field;
        render(
            <FieldNode
                id="f:inactive"
                type="field"
                selected={false}
                data={{
                    node: { id: 'f:inactive', label: 'Inactive field', kind: 'field' },
                    isSystemInactive: true,
                }}
                dragging={false}
                draggable
                selectable
                deletable
                zIndex={0}
                isConnectable
                positionAbsoluteX={0}
                positionAbsoluteY={0}
            />,
        );

        const shell = screen.getByText('Inactive field').closest('div[data-node-state]');
        expect(shell).toBeTruthy();
        expect(shell?.getAttribute('data-node-state')).toContain('system-inactive');
        expect(shell?.className).toContain('grayscale');
        expect(shell?.className).toContain('opacity-55');
    });

    it('applies active-node ring styling to comment nodes when selected', () => {
        const CommentNode = nodeTypes.comment;
        const { container } = render(
            <CommentNode
                id="c::1"
                type="comment"
                selected
                data={{
                    thread: {
                        id: 'c::1',
                        messages: [{ isMain: true, body: 'Comment body', authorName: 'Alex' }],
                    },
                }}
                dragging={false}
                draggable
                selectable
                deletable
                zIndex={0}
                isConnectable
                positionAbsoluteX={0}
                positionAbsoluteY={0}
            />,
        );

        const shell = container.firstElementChild as HTMLDivElement | null;
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('ring-sky-300');
        expect(shell?.className).toContain('dark:ring-sky-400');
    });
});
