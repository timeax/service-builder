import { fireEvent, render, screen } from '@testing-library/react';
import { ContextMenu } from './ContextMenu.tsx';

const mockHandleToggleFieldOptions = vi.fn();
const mockHandleSaveAsTemplate = vi.fn();
const mockHandleOpenFallbackQuickAdd = vi.fn();
const mockHandleMoveUp = vi.fn();
const mockHandleMoveDown = vi.fn();
const mockHandleMoveUpInContext = vi.fn();
const mockHandleMoveDownInContext = vi.fn();
const actionState = {
    canMoveUp: true,
    canMoveDown: true,
    canMoveContextUp: true,
    canMoveContextDown: true,
};

vi.mock('../hooks.ts', () => ({
    useNodeActions: () => ({
        handleDuplicate: vi.fn(),
        handleCopyId: vi.fn(),
        handleSaveAsTemplate: mockHandleSaveAsTemplate,
        canQuickAddFallbacks: true,
        handleOpenFallbackQuickAdd: mockHandleOpenFallbackQuickAdd,
        isFieldOptionsShown: false,
        handleToggleFieldOptions: mockHandleToggleFieldOptions,
        canMoveUp: actionState.canMoveUp,
        canMoveDown: actionState.canMoveDown,
        canMoveContextUp: actionState.canMoveContextUp,
        canMoveContextDown: actionState.canMoveContextDown,
        handleMoveUp: mockHandleMoveUp,
        handleMoveDown: mockHandleMoveDown,
        handleMoveUpInContext: mockHandleMoveUpInContext,
        handleMoveDownInContext: mockHandleMoveDownInContext,
    }),
}));

function renderMenu(nodeKind: 'field' | 'tag', surface: 'canvas' | 'wireframe' = 'canvas') {
    render(
        <ContextMenu
            target={{ nodeId: nodeKind === 'field' ? 'f:amount' : 't:root', nodeKind, surface }}
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
        mockHandleOpenFallbackQuickAdd.mockReset();
        mockHandleMoveUp.mockReset();
        mockHandleMoveDown.mockReset();
        mockHandleMoveUpInContext.mockReset();
        mockHandleMoveDownInContext.mockReset();
        actionState.canMoveUp = true;
        actionState.canMoveDown = true;
        actionState.canMoveContextUp = true;
        actionState.canMoveContextDown = true;
    });

    it('shows "Show option nodes" for field nodes and triggers action', () => {
        renderMenu('field');

        const button = screen.getByText('Show option nodes');
        fireEvent.click(button);

        expect(mockHandleToggleFieldOptions).toHaveBeenCalledTimes(1);
    });

    it('shows fallback action and routes clicks to the fallback editor opener', () => {
        renderMenu('field');

        fireEvent.click(screen.getByText('Add fallbacks'));

        expect(mockHandleOpenFallbackQuickAdd).toHaveBeenCalledTimes(1);
    });

    it('does not show option visibility action for tag nodes', () => {
        renderMenu('tag');
        expect(screen.queryByText('Show option nodes')).not.toBeInTheDocument();
    });

    it('shows wireframe move actions only on wireframe surface', () => {
        renderMenu('field', 'wireframe');
        expect(screen.getByText('Move up')).toBeInTheDocument();
        expect(screen.getByText('Move down')).toBeInTheDocument();
        expect(screen.getByText('Move up (in context)')).toBeInTheDocument();
        expect(screen.getByText('Move down (in context)')).toBeInTheDocument();
    });

    it('does not show wireframe move actions on non-wireframe surfaces', () => {
        renderMenu('field', 'canvas');
        expect(screen.queryByText('Move up')).not.toBeInTheDocument();
        expect(screen.queryByText('Move down')).not.toBeInTheDocument();
        expect(screen.queryByText('Move up (in context)')).not.toBeInTheDocument();
        expect(screen.queryByText('Move down (in context)')).not.toBeInTheDocument();
    });

    it('disables move buttons when movement is unavailable', () => {
        actionState.canMoveUp = false;
        actionState.canMoveDown = false;
        actionState.canMoveContextUp = false;
        actionState.canMoveContextDown = false;
        renderMenu('field', 'wireframe');

        expect(screen.getByText('Move up')).toBeDisabled();
        expect(screen.getByText('Move down')).toBeDisabled();
        expect(screen.getByText('Move up (in context)')).toBeDisabled();
        expect(screen.getByText('Move down (in context)')).toBeDisabled();
    });

    it('routes wireframe move button clicks to handlers', () => {
        renderMenu('field', 'wireframe');
        fireEvent.click(screen.getByText('Move up'));
        fireEvent.click(screen.getByText('Move down'));
        fireEvent.click(screen.getByText('Move up (in context)'));
        fireEvent.click(screen.getByText('Move down (in context)'));

        expect(mockHandleMoveUp).toHaveBeenCalledTimes(1);
        expect(mockHandleMoveDown).toHaveBeenCalledTimes(1);
        expect(mockHandleMoveUpInContext).toHaveBeenCalledTimes(1);
        expect(mockHandleMoveDownInContext).toHaveBeenCalledTimes(1);
    });

    it('supports wireframe keyboard shortcuts while menu is open', () => {
        renderMenu('field', 'wireframe');

        fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
        fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
        fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true, shiftKey: true });
        fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true, shiftKey: true });

        expect(mockHandleMoveUp).toHaveBeenCalledTimes(1);
        expect(mockHandleMoveDown).toHaveBeenCalledTimes(1);
        expect(mockHandleMoveUpInContext).toHaveBeenCalledTimes(1);
        expect(mockHandleMoveDownInContext).toHaveBeenCalledTimes(1);
    });

    it('ignores wireframe keyboard shortcuts from editable targets', () => {
        renderMenu('field', 'wireframe');
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });
        fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true, shiftKey: true });

        expect(mockHandleMoveUp).not.toHaveBeenCalled();
        expect(mockHandleMoveDownInContext).not.toHaveBeenCalled();
    });
});
