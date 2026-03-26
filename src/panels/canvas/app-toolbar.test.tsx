import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppToolbar } from './app-toolbar.tsx';

vi.mock('@/components/ui/dropdown-menu.tsx', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    ),
}));

describe('AppToolbar', () => {
    it('shows import actions from the toolbar menu', async () => {
        const onImportProps = vi.fn();
        const onImportCatalog = vi.fn();

        render(
            <AppToolbar
                errors={{ merged: { counts: { total: 0 } } } as any}
                bottomPanelOpen={false}
                onConsoleToggle={vi.fn()}
                canUndo={false}
                canRedo={false}
                canSave={true}
                canPublish={true}
                onUndo={vi.fn()}
                onRedo={vi.fn()}
                onSave={vi.fn()}
                onPublish={vi.fn()}
                onRelayout={vi.fn()}
                onImportProps={onImportProps}
                onImportCatalog={onImportCatalog}
                onToggleCommentPlacement={vi.fn()}
                noticesOpen={false}
                onNoticesToggle={vi.fn()}
                showErrorBadges={true}
                setShowErrorBadges={vi.fn()}
                pendingAction={null}
            />,
        );

        expect(screen.getByLabelText('Import JSON')).toBeInTheDocument();
        fireEvent.click(await screen.findByText('Import props'));
        expect(onImportProps).toHaveBeenCalledTimes(1);

        fireEvent.click(await screen.findByText('Import catalog'));
        expect(onImportCatalog).toHaveBeenCalledTimes(1);
    });
});
