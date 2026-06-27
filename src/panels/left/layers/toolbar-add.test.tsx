import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Layers from './index.tsx';

const { addFieldFromDescriptor, createUI, emit, select, setActive, currentTag, fieldSelection } = vi.hoisted(() => ({
    addFieldFromDescriptor: vi.fn(),
    createUI: vi.fn(),
    emit: vi.fn(),
    select: vi.fn(),
    setActive: vi.fn(),
    currentTag: vi.fn(() => 't:active'),
    fieldSelection: { current: [] as Array<{ id: string; path: Array<string | number>; node: unknown }> },
}));

vi.mock('@timeax/digital-service-engine/react', () => ({
    useInputs: () => ({
        registry: { _store: new Map() },
    }),
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        selection: [],
        setActive,
        activeId: null,
        selectionInfo: {
            tagIds: [],
            fieldIds: [],
            optionIds: [],
            ids: [],
        },
        layers: {
            tags: [{ id: 't:root', title: 'Root' }],
            fields: [
                {
                    id: 'f:package',
                    title: 'Package',
                    children: [{ id: 'o:premium', title: 'Premium' }],
                },
            ],
        },
        api: {
            emit,
            select,
            selection: {
                currentTag,
            },
            builder: {
                getProps: () => ({ fields: [] }),
            },
            editor: {
                addFieldFromDescriptor,
                addOption: vi.fn(),
                editLabel: vi.fn(),
                getNode: vi.fn(() => ({ data: { label: 'Active Tag' } })),
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

vi.mock('@/components/ui/panel.tsx', () => ({
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/scroll-area.tsx', () => ({
    ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/builder/index.tsx', () => ({
    EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
    PanelSearch: React.forwardRef<HTMLInputElement, any>((props, ref) => <input ref={ref} aria-label={props.placeholder} />),
}));

vi.mock('@/components/sort-tree', async () => {
    const ReactModule = await import('react');

    return {
        SortTree: ReactModule.forwardRef((props: any, ref: any) => {
            const isFieldTree = props.data?.some((node: any) => String(node.id).startsWith('f:'));

            ReactModule.useImperativeHandle(ref, () => ({
                createUI,
                getSelectionLocated: () => (isFieldTree ? fieldSelection.current : []),
                create: vi.fn(),
                cancelCreateUI: vi.fn(),
                clearSelection: vi.fn(),
                collapse: vi.fn(),
                expand: vi.fn(),
                getSelectionNodes: vi.fn(() => []),
                invalidate: vi.fn(),
                refresh: vi.fn(),
                remove: vi.fn(),
                select: vi.fn(),
                selectMany: vi.fn(),
                toggle: vi.fn(),
            }));

            return <div data-testid={isFieldTree ? 'fields-tree' : 'tags-tree'} />;
        }),
    };
});

describe('Layers fields toolbar add buttons', () => {
    beforeEach(() => {
        addFieldFromDescriptor.mockReset();
        createUI.mockReset();
        emit.mockReset();
        select.mockReset();
        setActive.mockReset();
        currentTag.mockReset();
        currentTag.mockReturnValue('t:active');
        fieldSelection.current = [];
    });

    it('plain add creates a field in the current visible group even when an option is selected', () => {
        fieldSelection.current = [{ id: 'o:premium', path: ['f:package', 'o:premium'], node: {} }];

        render(<Layers />);
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));

        expect(createUI).not.toHaveBeenCalled();
        expect(addFieldFromDescriptor).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                id: expect.stringMatching(/^f:asset:/),
                label: 'New Field',
                type: 'text',
                bind_id: 't:active',
            }),
        );
        const createdId = addFieldFromDescriptor.mock.calls[0][1].id;
        expect(setActive).toHaveBeenCalledWith(createdId);
        expect(select).toHaveBeenCalledWith([createdId], createdId);
    });

    it('folder-plus opens inline option creation on a selected field', () => {
        fieldSelection.current = [{ id: 'f:package', path: ['f:package'], node: {} }];

        render(<Layers />);
        fireEvent.click(screen.getByRole('button', { name: 'Add option' }));

        expect(createUI).toHaveBeenCalledWith(['f:package']);
        expect(addFieldFromDescriptor).not.toHaveBeenCalled();
    });

    it('folder-plus opens inline child-option creation on a selected option', () => {
        fieldSelection.current = [{ id: 'o:premium', path: ['f:package', 'o:premium'], node: {} }];

        render(<Layers />);
        fireEvent.click(screen.getByRole('button', { name: 'Add option' }));

        expect(createUI).toHaveBeenCalledWith(['f:package', 'o:premium']);
        expect(addFieldFromDescriptor).not.toHaveBeenCalled();
    });

    it('folder-plus emits an error when there is not one selected field or option', () => {
        fieldSelection.current = [
            { id: 'f:package', path: ['f:package'], node: {} },
            { id: 'o:premium', path: ['f:package', 'o:premium'], node: {} },
        ];

        render(<Layers />);
        fireEvent.click(screen.getByRole('button', { name: 'Add option' }));

        expect(createUI).not.toHaveBeenCalled();
        expect(emit).toHaveBeenCalledWith('error', {
            message: 'Select a field or option before adding an option.',
            meta: { action: 'open-option-create-ui' },
        });
    });
});
