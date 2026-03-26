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
    it('applies lighter active ring classes for tag nodes', () => {
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
                zIndex={0}
                isConnectable
                xPos={0}
                yPos={0}
            />,
        );

        const shell = screen.getByText('Tag 1').closest('div[data-node-state]');
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('ring-sky-300');
        expect(shell?.className).toContain('dark:ring-sky-400');
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
                zIndex={0}
                isConnectable
                xPos={0}
                yPos={0}
            />,
        );

        const shell = screen.getByText('Tag 2').closest('div[data-node-state]');
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('outline-amber-300');
        expect(shell?.className).toContain('dark:outline-amber-200');
    });

    it('uses the same lighter active/highlight classes for option nodes', () => {
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
                zIndex={0}
                isConnectable
                xPos={0}
                yPos={0}
            />,
        );

        const shell = screen.getByText('Option 1').closest('div[data-node-state]');
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('ring-sky-300');
        expect(shell?.className).toContain('dark:ring-sky-400');
        expect(shell?.className).toContain('outline-amber-300');
        expect(shell?.className).toContain('dark:outline-amber-200');
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
                zIndex={0}
                isConnectable
                xPos={0}
                yPos={0}
            />,
        );

        const shell = container.firstElementChild as HTMLDivElement | null;
        expect(shell).toBeTruthy();
        expect(shell?.className).toContain('ring-sky-300');
        expect(shell?.className).toContain('dark:ring-sky-400');
    });
});
