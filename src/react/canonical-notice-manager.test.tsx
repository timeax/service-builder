// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSeedPersistence, workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalNodeContextMenuProvider, useCanonicalNodeContextMenu } from './canonical-node-context-menu';
import { ServiceBuilderProvider, useCanvasAPI, useWorkspaceSelector } from './workspace';

function Harness() {
    const menu = useCanonicalNodeContextMenu();
    const canvas = useCanvasAPI();
    const notices = useWorkspaceSelector((state) => state.definition?.notices ?? []);
    return <>
        <button type="button" onClick={() => menu.open_notice_manager()}>Open notices</button>
        <button type="button" onClick={() => canvas?.select(['field:url'], 'field:url')}>Select URL field</button>
        <output aria-label="Notice state">{JSON.stringify(notices)}</output>
    </>;
}

function renderManager(permissions?: typeof workspaceSeed.permissions) {
    const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: permissions ? undefined : createSeedPersistence(), ...(permissions ? { permissions } : {}) });
    return render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
}

describe('canonical Notice Manager', () => {
    it('moves keyboard focus into the dialog, wraps Tab, and restores the opener on Escape', async () => {
        renderManager();
        const opener = await screen.findByRole('button', { name: 'Open notices' });
        opener.focus();
        fireEvent.click(opener);
        const dialog = await screen.findByRole('dialog', { name: 'Notice Manager' });
        const first = screen.getByRole('button', { name: 'New' });
        const last = screen.getByRole('button', { name: 'Save Notice' });
        await waitFor(() => expect(first).toHaveFocus());
        expect(dialog).toContainElement(first);
        last.focus();
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
        expect(last).toHaveFocus();
        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notice Manager' })).not.toBeInTheDocument());
        expect(opener).toHaveFocus();
    });

    it('preserves create, edit, search, delete and editable host appearance metadata', async () => {
        renderManager();
        await waitFor(() => expect(screen.getByLabelText('Notice state')).toHaveTextContent('[]'));
        fireEvent.click(screen.getByRole('button', { name: 'Open notices' }));
        expect(await screen.findByRole('dialog', { name: 'Notice Manager' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'New' }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Delivery warning' } });
        fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'amber' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Notice' }));
        await waitFor(() => expect(JSON.parse(screen.getByLabelText('Notice state').textContent ?? '[]')).toMatchObject([{ title: 'Delivery warning', meta: { color: 'amber' } }]));
        fireEvent.change(screen.getByPlaceholderText('Search notices...'), { target: { value: 'delivery' } });
        expect(screen.getByText('Delivery warning')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Updated delivery warning' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Notice' }));
        await waitFor(() => expect(JSON.parse(screen.getByLabelText('Notice state').textContent ?? '[]')).toMatchObject([{ title: 'Updated delivery warning' }]));
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(screen.getByLabelText('Notice state')).toHaveTextContent('[]'));
    });

    it('uses current selection as a node target and rejects invalid meta without losing the draft', async () => {
        renderManager();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Select URL field' })).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Select URL field' }));
        fireEvent.click(screen.getByRole('button', { name: 'Open notices' }));
        await screen.findByRole('dialog', { name: 'Notice Manager' });
        fireEvent.click(screen.getByRole('button', { name: 'New' }));
        fireEvent.click(screen.getByRole('button', { name: 'Use current selection' }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Field notice' } });
        fireEvent.change(screen.getByLabelText('Meta (JSON object)'), { target: { value: '{bad' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Notice' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByLabelText('Notice state')).toHaveTextContent('[]');
        fireEvent.change(screen.getByLabelText('Meta (JSON object)'), { target: { value: '{"audience":"editor"}' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Notice' }));
        await waitFor(() => expect(JSON.parse(screen.getByLabelText('Notice state').textContent ?? '[]')).toMatchObject([{ target: { scope: 'node', node_kind: 'field', node_id: 'field:url' }, meta: { audience: 'editor' } }]));
    });

    it('keeps the manager readable but disables mutations without edit permission', async () => {
        renderManager({ ...workspaceSeed.permissions, 'document.mutate': false });
        fireEvent.click(await screen.findByRole('button', { name: 'Open notices' }));
        expect(await screen.findByRole('dialog', { name: 'Notice Manager' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Save Notice' })).toBeDisabled();
        expect(screen.getByLabelText('Title')).toBeDisabled();
    });
});
