// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { DRAG_MIME_ASSET_TEMPLATE } from './drag-contracts';
import { CanonicalNodeContextMenuProvider, useCanonicalNodeContextMenu } from './canonical-node-context-menu';
import { ServiceBuilderProvider, useCanvasAPI, useWorkspaceSelector } from './workspace';

vi.mock('@timeax/form-palette', async (importOriginal) => ({
    ...await importOriginal<typeof import('@timeax/form-palette')>(),
    InputField: ({ label, value, onChange }: any) => (
        <input aria-label={label} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })} />
    ),
}));

function Harness() {
    const menu = useCanonicalNodeContextMenu();
    const canvas = useCanvasAPI();
    const count = useWorkspaceSelector((state) => state.definition?.fields.length ?? 0);
    const serviceBinding = useWorkspaceSelector((state) => state.definition?.fields.find((field) => field.id === 'field:service')?.bind_id);
    const quantityBinding = useWorkspaceSelector((state) => state.definition?.fields.find((field) => field.id === 'field:quantity')?.bind_id);
    const noticeCount = useWorkspaceSelector((state) => state.definition?.notices.length ?? 0);
    const fieldOrder = useWorkspaceSelector((state) => state.definition?.fields.map((field) => field.id).join(',') ?? '');
    const contextOrder = useWorkspaceSelector((state) => state.definition?.order_for_tags['filter:platform']?.join(',') ?? '');
    return (
        <>
            <output aria-label="Field count">{count}</output>
            <output aria-label="Service binding">{String(serviceBinding ?? '')}</output>
            <output aria-label="Quantity binding">{String(quantityBinding ?? '')}</output>
            <output aria-label="Notice count">{noticeCount}</output>
            <output aria-label="Field order">{fieldOrder}</output>
            <output aria-label="Context order">{contextOrder}</output>
            <button
                type="button"
                onContextMenu={(event) => {
                    event.preventDefault();
                    menu.open_node_menu({ node_id: 'field:service', node_kind: 'field', client_x: 100, client_y: 100 });
                }}
            >
                Open node menu
            </button>
            <button
                type="button"
                onContextMenu={(event) => {
                    event.preventDefault();
                    menu.open_node_menu({ node_id: 'field:service', node_kind: 'field', client_x: 100, client_y: 100, surface: 'wireframe' });
                }}
            >
                Open wireframe menu
            </button>
            <button type="button" onClick={() => canvas?.select(['field:service', 'field:quantity'], 'field:service')}>Select two fields</button>
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

function TemplateDropHarness() {
    const menu = useCanonicalNodeContextMenu();
    const canvas = useCanvasAPI();
    const fields = useWorkspaceSelector((state) => state.definition?.fields ?? []);
    return <>
        <button type="button" disabled={!canvas} onClick={() => menu.open_drop_dial({
            node_id: 'filter:platform', node_kind: 'filter', client_x: 100, client_y: 100,
            data_transfer: { getData: (type: string) => type === DRAG_MIME_ASSET_TEMPLATE ? JSON.stringify({ id: 'template:select', name: 'Reusable select' }) : '' } as DataTransfer,
        })}>Drop template on tag</button>
        <output aria-label="Template option IDs">{fields.filter((field) => field.label === 'Reusable select').map((field) => field.options?.[0]?.id).join(',')}</output>
    </>;
}

async function isolatedBackend() {
    const snapshot = await workspaceSeed.persistence!.load(workspaceSeed.workspace_id);
    return new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: { load: async () => structuredClone(snapshot), save: async () => {} } });
}

describe('canonical node context menu', () => {
    it('uses canonical template instantiation for a node drop', async () => {
        const snapshot = await workspaceSeed.persistence!.load(workspaceSeed.workspace_id);
        if (!snapshot) throw new Error('Missing seeded workspace');
        snapshot.branches[0]!.templates.push({
            id: 'template:select', key: 'select', name: 'Reusable select', branch_id: null, published: true,
            updated_at: new Date(0).toISOString(), meta: {},
            field: { id: 'field:reusable', type: 'select', label: 'Reusable select', options: [{ id: 'option:reusable', label: 'Choice', value: 'choice' }] },
        });
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: { load: async () => structuredClone(snapshot), save: async () => {} } });
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalNodeContextMenuProvider><TemplateDropHarness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Drop template on tag' })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: 'Drop template on tag' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Bind' }));
        await waitFor(() => expect(screen.getByLabelText('Template option IDs')).toHaveTextContent('option:reusable-copy'));
    });
    it('moves a wireframe field in base and context order through Workspace history', async () => {
        render(<ServiceBuilderProvider backend={await isolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Field order')).toHaveTextContent('field:service,field:url,field:quantity'));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open wireframe menu' }));
        fireEvent.click(await screen.findByText('Move down'));
        await waitFor(() => expect(screen.getByLabelText('Field order')).toHaveTextContent('field:url,field:service,field:quantity'));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open wireframe menu' }));
        fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true, shiftKey: true });
        await waitFor(() => expect(screen.getByLabelText('Context order')).toHaveTextContent('field:url,field:service,field:quantity'));
    });
    it('rebinds selected fields through the canonical batch target dialog', async () => {
        render(<ServiceBuilderProvider backend={await isolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('3'));
        fireEvent.click(screen.getByRole('button', { name: 'Select two fields' }));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        fireEvent.click(await screen.findByText('Move / Rebind to tag'));
        fireEvent.change(screen.getByLabelText('Batch target'), { target: { value: 'filter:instagram' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await waitFor(() => expect(screen.getByLabelText('Service binding')).toHaveTextContent('filter:instagram'));
        expect(screen.getByLabelText('Quantity binding')).toHaveTextContent('filter:instagram');
    });

    it('routes selected-node duplication through the canonical batch command', async () => {
        render(<ServiceBuilderProvider backend={await isolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('3'));
        fireEvent.click(screen.getByRole('button', { name: 'Select two fields' }));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        fireEvent.click(await screen.findByText('Duplicate selected'));
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('5'));
    });

    it('names and scopes a field template before saving it', async () => {
        const backend = await isolatedBackend();
        const save = vi.spyOn(backend, 'save_template');
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('3'));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        fireEvent.click(await screen.findByText('Save as template'));
        const dialog = await screen.findByRole('alertdialog', { name: 'Save as template' });
        expect(dialog).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Custom field' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
        await waitFor(() => expect(save).toHaveBeenCalled());
        expect(save.mock.calls.at(-1)?.[0]).toMatchObject({ name: 'Custom field', branch_id: 'branch:main' });
        await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Save as template' })).not.toBeInTheDocument());
    });

    it('saves connected fields and relationships through the canonical capture API', async () => {
        const snapshot = await workspaceSeed.persistence!.load(workspaceSeed.workspace_id);
        if (!snapshot) throw new Error('Missing seeded workspace');
        snapshot.branches[0]!.definition.includes_for_buttons['option:instagram-followers'] = ['field:url', 'field:quantity'];
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: { load: async () => structuredClone(snapshot), save: async () => {} } });
        const save = vi.spyOn(backend, 'save_template');
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('3'));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        fireEvent.click(await screen.findByText('Save as template'));
        fireEvent.click(screen.getByLabelText('Include connected fields'));
        expect(screen.getByText('Fields in group')).toBeInTheDocument();
        expect(screen.getByText('Copied properties')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Template label'), { target: { value: 'Selected group' } });
        fireEvent.click(screen.getByText('Quantity').closest('label')!.querySelector('input')!);
        fireEvent.click(screen.getByRole('checkbox', { name: 'Copy name from Target URL' }));
        expect(screen.getByRole('checkbox', { name: 'Copy id from Target URL' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
        await waitFor(() => expect(save).toHaveBeenCalled());
        expect(save.mock.calls.at(-1)?.[0]).toMatchObject({ group_label: 'Selected group', connected_fields: [{ id: 'field:url' }] });
        expect(save.mock.calls.at(-1)?.[0].connected_fields?.[0]?.name).toBeUndefined();
        expect(save.mock.calls.at(-1)?.[0].relationships?.includes_for_buttons['option:instagram-followers']).toEqual(['field:url']);
    });

    it('saves a global template through the canonical development backend', async () => {
        const backend = await isolatedBackend();
        const save = vi.spyOn(backend, 'save_template');
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('3'));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        fireEvent.click(await screen.findByText('Save as template'));
        fireEvent.click(screen.getByLabelText('Save to current branch'));
        fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
        await waitFor(() => expect(save).toHaveBeenCalled());
        expect(save.mock.calls.at(-1)?.[0].branch_id).toBeNull();
        await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Save as template' })).not.toBeInTheDocument());
    });

    it('shows template save failures and retains the name for retry', async () => {
        const backend = await isolatedBackend();
        vi.spyOn(backend, 'save_template').mockResolvedValueOnce({ ok: false, error: { code: 'unavailable', message: 'Template service unavailable', retryable: true, meta: {} } });
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalNodeContextMenuProvider><Harness /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Field count')).toHaveTextContent('3'));
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open node menu' }));
        fireEvent.click(await screen.findByText('Save as template'));
        fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Retry field' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Copy options from Service' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Template service unavailable');
        expect(screen.getByLabelText('Template name')).toHaveValue('Retry field');
        expect(screen.getByRole('checkbox', { name: 'Copy options from Service' })).not.toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Save as template' })).not.toBeInTheDocument());
    });

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
