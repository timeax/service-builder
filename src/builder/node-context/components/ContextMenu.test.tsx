import { fireEvent, render, screen } from '@testing-library/react';
import { ContextMenu } from './ContextMenu.tsx';

const mockHandleToggleFieldOptions = vi.fn();
const mockHandleSaveAsTemplate = vi.fn();

vi.mock('../hooks.ts', () => ({
    useNodeActions: () => ({
        handleDuplicate: vi.fn(),
        handleCopyId: vi.fn(),
        handleSaveAsTemplate: mockHandleSaveAsTemplate,
        isFieldOptionsShown: false,
        handleToggleFieldOptions: mockHandleToggleFieldOptions,
    }),
}));

function renderMenu(nodeKind: 'field' | 'tag') {
    render(
        <ContextMenu
            target={{ nodeId: nodeKind === 'field' ? 'f:amount' : 't:root', nodeKind, surface: 'canvas' }}
            setTarget={vi.fn()}
            setDialogTarget={vi.fn()}
            setRenameOpen={vi.fn()}
            setDeleteOpen={vi.fn()}
            openNoticeManager={vi.fn()}
            activeNode={null}
            anchorStyle={{ left: 8, top: 8 }}
            menuRef={{ current: null }}
            setRenameValue={vi.fn()}
        />,
    );
}

describe('node context menu option node visibility action', () => {
    beforeEach(() => {
        mockHandleToggleFieldOptions.mockReset();
        mockHandleSaveAsTemplate.mockReset();
    });

    it('shows "Show option nodes" for field nodes and triggers action', () => {
        renderMenu('field');

        const button = screen.getByText('Show option nodes');
        fireEvent.click(button);

        expect(mockHandleToggleFieldOptions).toHaveBeenCalledTimes(1);
    });

    it('does not show option visibility action for tag nodes', () => {
        renderMenu('tag');
        expect(screen.queryByText('Show option nodes')).not.toBeInTheDocument();
    });
});
