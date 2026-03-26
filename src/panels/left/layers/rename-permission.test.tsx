import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Layers from './index.tsx';

const editLabel = vi.fn();

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        setActive: vi.fn(),
        selectionInfo: {
            tagIds: [],
            fieldIds: [],
            optionIds: [],
        },
        activeId: null,
        layers: {
            tags: [{ id: 't:root', title: 'Root', children: [{ id: 't:1', title: 'Tag One' }] }],
            fields: [],
        },
        api: {
            select: vi.fn(),
            addToSelection: vi.fn(),
            selection: {
                currentTag: vi.fn(() => 't:root'),
            },
            editor: {
                editLabel,
                getNode: vi.fn(() => ({ data: { label: 'Root' } })),
                addTag: vi.fn(),
                addField: vi.fn(),
                addOption: vi.fn(),
            },
        },
    }),
}));

vi.mock('@/builder/node-context-menu.tsx', () => ({
    useNodeContextMenu: () => ({
        openNodeContextMenu: vi.fn(),
        canAcceptDropPayload: vi.fn(() => false),
        handleNodeDrop: vi.fn(),
    }),
}));

describe('Layers rename permission smoke', () => {
    it('does not keep a ghost label in UI when rename is blocked upstream', async () => {
        render(<Layers />);

        const label = screen.getByText('Root');
        fireEvent.doubleClick(label);
        const editable = document.querySelector('span[contenteditable="true"]') as HTMLElement;
        editable.textContent = 'Blocked Rename';
        fireEvent.input(editable, { target: editable });
        fireEvent.keyDown(editable, { key: 'Enter' });
        fireEvent.blur(editable);

        await waitFor(() => {
            expect(screen.getByText('Root')).toBeInTheDocument();
        });
        expect(screen.queryByText('Blocked Rename')).not.toBeInTheDocument();
    });
});
