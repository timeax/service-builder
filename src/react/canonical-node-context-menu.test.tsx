// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalNodeContextMenuProvider, useCanonicalNodeContextMenu } from './canonical-node-context-menu';
import { ServiceBuilderProvider, useWorkspaceSelector } from './workspace';

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ label, value, onChange }: any) => (
        <input aria-label={label} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })} />
    ),
}));

function Harness() {
    const menu = useCanonicalNodeContextMenu();
    const count = useWorkspaceSelector((state) => state.definition?.fields.length ?? 0);
    const noticeCount = useWorkspaceSelector((state) => state.definition?.notices.length ?? 0);
    return (
        <>
            <output aria-label="Field count">{count}</output>
            <output aria-label="Notice count">{noticeCount}</output>
            <button
                type="button"
                onContextMenu={(event) => {
                    event.preventDefault();
                    menu.open_node_menu({ node_id: 'field:service', node_kind: 'field', client_x: 100, client_y: 100 });
                }}
            >
                Open node menu
            </button>
        </>
    );
}

function DropProbe() {
    const menu = useCanonicalNodeContextMenu();
    return (
        <output aria-label="Drop accepted">
            {String(
                menu.open_drop_dial({
                    node_id: 'field:service',
                    node_kind: 'field',
                    client_x: 100,
                    client_y: 100,
                    data_transfer: { getData: (type: string) => (type.includes('service') ? '10147' : '') } as DataTransfer,
                }),
            )}
        </output>
    );
}

describe('canonical node context menu', () => {
    it('opens the preserved Notice Manager with the node preselected without creating a notice early', async () => {
        render(<ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('3'));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        fireEvent.click(await screen.findByText('Add notice'));
        expect(await screen.findByRole('dialog', { name: 'Notice Manager' })).toBeInTheDocument();
        expect(screen.getByLabelText('Notice count')).toHaveTextContent('0');
        expect(screen.getByLabelText('Target Node')).toHaveValue('field:service');
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Service field note' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Notice' }));
        await waitFor(() => expect(screen.getByLabelText('Notice count')).toHaveTextContent('1'));
    });

    it('preserves duplicate action and writes through canonical Editor', async () => {
        render(
            <ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}>
                <CanonicalNodeContextMenuProvider>
                    <Harness />
                </CanonicalNodeContextMenuProvider>
            </ServiceBuilderProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('3'));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        fireEvent.click(await screen.findByText('Duplicate'));
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('4'));
    });

    it('keeps the context menu readable while blocking denied node and drop mutations', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            permissions: {
                ...workspaceSeed.permissions,
                'document.mutate': false,
                'template.write': false,
            },
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalNodeContextMenuProvider>
                    <Harness />
                    <DropProbe />
                </CanonicalNodeContextMenuProvider>
            </ServiceBuilderProvider>,
        );

        expect(await screen.findByLabelText('Drop accepted')).toHaveTextContent('false');
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        const duplicate = await screen.findByText('Duplicate');
        expect(duplicate).toHaveAttribute('data-disabled');
        expect(duplicate).toHaveAttribute('title', 'You do not have permission to edit this definition.');
        const saveTemplate = screen.getByText('Save as template');
        expect(saveTemplate).toHaveAttribute('data-disabled');
        expect(saveTemplate).toHaveAttribute('title', 'You do not have permission to manage templates.');
    });
});
