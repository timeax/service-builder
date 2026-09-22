// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalBottomConsolePanel, useCanonicalBottomPanel } from './canonical-bottom-panel';
import { CanonicalFallbackProvider } from './canonical-fallbacks';
import { DRAG_MIME_SERVICE } from './drag-contracts';
import { ServiceBuilderProvider, useCanvasAPI } from './workspace';

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ label, value, onChange }: any) => (
        <input aria-label={label ?? 'Fallback setting'} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })} />
    ),
}));

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

function Harness() {
    const controller = useCanonicalBottomPanel();
    const canvas = useCanvasAPI();
    const [catalog, setCatalog] = useState(() => canvas?.editor.get_catalog());
    const [selectedNode, setSelectedNode] = useState<string | undefined>(() => canvas?.selection.primary());
    useEffect(() => canvas?.on('catalog:change', ({ catalog: next }) => setCatalog(next)), [canvas]);
    useEffect(() => canvas?.on('selection:change', ({ primary }) => setSelectedNode(primary)), [canvas]);
    return (
        <>
            <output aria-label="Bottom panel state">
                {controller.isOpen ? 'open' : 'closed'}|{controller.activeTab}
            </output>
            <output aria-label="Catalog state">{JSON.stringify(catalog ?? null)}</output>
            <output aria-label="Selected canvas node">{selectedNode ?? 'none'}</output>
            <button type="button" onClick={() => canvas?.select(['filter:platform'], 'filter:platform')}>
                Select platform filter
            </button>
            <button type="button" onClick={() => canvas?.select(['filter:instagram'], 'filter:instagram')}>
                Select Instagram filter
            </button>
            <button type="button" onClick={() => canvas?.select(['field:url'], 'field:url')}>
                Select URL field
            </button>
            <button
                type="button"
                onClick={() => {
                    try {
                        canvas?.editor.add_option('missing-field', { label: 'Invalid' });
                    } catch {
                        /* The console records the real Editor failure. */
                    }
                }}
            >
                Trigger editor failure
            </button>
            <CanonicalBottomConsolePanel controller={controller} />
        </>
    );
}

describe('canonical bottom panel', () => {
    it('restores the service list/detail split and canonical catalog-row drag payload', async () => {
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, services: workspaceSeed.services.slice(0, 4), persistence: undefined });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        expect(await screen.findByText('Service detail')).toBeInTheDocument();
        expect(screen.getByText('Capabilities')).toBeInTheDocument();
        expect(screen.getByText('Bindings')).toBeInTheDocument();
        expect(screen.getAllByRole('separator').length).toBeGreaterThan(0);
        expect(screen.getByTestId('service-split-pane').closest('[data-slot="scroll-area"]')).toBeNull();
        const row = screen.getByRole('button', { name: /#2946/ });
        fireEvent.click(row);
        expect(screen.getAllByText('#2946').length).toBeGreaterThan(1);
        expect(screen.getByText('Context fit')).toBeInTheDocument();
        expect(screen.getByText('No capability or rate mismatch was found in the checked context.')).toBeInTheDocument();
        const transfer = { setData: vi.fn(), effectAllowed: 'none' } as unknown as DataTransfer;
        fireEvent.dragStart(row, { dataTransfer: transfer });
        expect(transfer.setData).toHaveBeenCalledWith(DRAG_MIME_SERVICE, '2946');
        expect(transfer.effectAllowed).toBe('copy');
        fireEvent.click(screen.getByRole('button', { name: /^Active Services/ }));
        fireEvent.click(screen.getByRole('button', { name: /Service \/ Instagram followers - fast/ }));
        await waitFor(() => expect(screen.getByLabelText('Selected canvas node')).toHaveTextContent('option:instagram-followers'));
    }, 15_000);

    it('moves and persists the preserved panel from its drag handle', async () => {
        window.localStorage.setItem('service-builder.bottom-panel.pos-x', 'invalid');
        window.localStorage.setItem('service-builder.bottom-panel.pos-y', 'invalid');
        const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            const panel = this.getAttribute('data-ui') === 'panel';
            return {
                width: panel ? 400 : 1000,
                height: panel ? 300 : 700,
                left: 0,
                top: 0,
                right: panel ? 400 : 1000,
                bottom: panel ? 300 : 700,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            } as DOMRect;
        });
        try {
            const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, services: workspaceSeed.services.slice(0, 1), persistence: undefined });
            render(
                <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                    <CanonicalFallbackProvider>
                        <Harness />
                    </CanonicalFallbackProvider>
                </ServiceBuilderProvider>,
            );
            await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
            fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
            const panel = document.querySelector<HTMLElement>('[data-ui="panel"]');
            await waitFor(() => expect(panel?.style.left).toBe('300px'));
            fireEvent(
                screen.getByRole('button', { name: 'Drag panel' }),
                new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }),
            );
            fireEvent(window, new MouseEvent('pointermove', { bubbles: true, clientX: 160, clientY: 60 }));
            await waitFor(() => expect(panel?.style.left).toBe('360px'));
            expect(panel?.style.bottom).toBe('48px');
            fireEvent(window, new MouseEvent('pointerup', { bubbles: true }));
            expect(window.localStorage.getItem('service-builder.bottom-panel.pos-x')).toBe('360');
            expect(window.localStorage.getItem('service-builder.bottom-panel.pos-y')).toBe('48');
        } finally {
            rect.mockRestore();
            window.localStorage.removeItem('service-builder.bottom-panel.pos-x');
            window.localStorage.removeItem('service-builder.bottom-panel.pos-y');
        }
    }, 15_000);

    it('filters canonical publication diagnostics by severity and the selected node', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.filters[1]!.label = definition.filters[0]!.label;
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            definition,
            services: workspaceSeed.services.slice(0, 1),
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        expect(await screen.findByText('Filter label Platform is duplicated.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Active node' }));
        expect(screen.queryByText('Filter label Platform is duplicated.')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Select Instagram filter' }));
        expect(await screen.findByText('Filter label Platform is duplicated.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'warning' }));
        expect(screen.queryByText('Filter label Platform is duplicated.')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'error' }));
        expect(screen.getByText('Filter label Platform is duplicated.')).toBeInTheDocument();
    }, 15_000);

    it('restores the legacy notice subtab, severity and active-node filters, and node focus', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.notices = [
            {
                id: 'notice:global',
                type: 'public',
                kind: 'warning',
                severity: 'warning',
                target: { scope: 'global' },
                title: 'Global warning',
                meta: {},
            },
            {
                id: 'notice:url',
                type: 'private',
                kind: 'label',
                severity: 'info',
                target: { scope: 'node', node_kind: 'field', node_id: 'field:url' },
                title: 'URL guidance',
                meta: { color: 'blue' },
            },
        ];
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            definition,
            services: workspaceSeed.services.slice(0, 1),
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        fireEvent.click(await screen.findByRole('button', { name: /^Notices/ }));
        expect(screen.getByText('Global warning')).toBeInTheDocument();
        expect(screen.getByText('URL guidance')).toBeInTheDocument();
        expect(screen.getByText('Color: blue')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Active node' }));
        expect(screen.getByText('No active node selected. Select a node to filter by active scope.')).toBeInTheDocument();
        expect(screen.queryByText('Global warning')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Select URL field' }));
        await waitFor(() => expect(screen.getByText('URL guidance')).toBeInTheDocument());
        expect(screen.queryByText('Global warning')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'warning' }));
        expect(screen.queryByText('URL guidance')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'info' }));
        expect(screen.getByText('URL guidance')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
        expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        expect(screen.queryByText('Schema Notices')).not.toBeInTheDocument();
    }, 15_000);

    it('records real Editor failures in the legacy Logs subtab and allows dismissing or clearing them', async () => {
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, services: workspaceSeed.services.slice(0, 1), persistence: undefined });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        fireEvent.click(await screen.findByRole('button', { name: /^Logs/ }));
        expect(screen.getByText('No logs for this filter')).toBeInTheDocument();
        await screen.findByText('Console idle');
        const consoleCount = Number(screen.getByRole('button', { name: /^Console/ }).textContent?.match(/\d+$/)?.[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Select URL field' }));
        fireEvent.click(screen.getByRole('button', { name: 'Trigger editor failure' }));
        expect(await screen.findByText('Unknown field missing-field.')).toBeInTheDocument();
        await waitFor(() => expect(Number(screen.getByRole('button', { name: /^Console/ }).textContent?.match(/\d+$/)?.[0])).toBe(consoleCount + 1));
        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        fireEvent.click(screen.getByRole('button', { name: /^Console/ }));
        expect(screen.getByRole('button', { name: /^Logs/ })).toBeInTheDocument();
        expect(screen.getByText('Unknown field missing-field.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Active node' }));
        expect(screen.getByText('Unknown field missing-field.')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' }).at(-1)!);
        expect(screen.getByText('No logs for this filter')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Trigger editor failure' }));
        expect(await screen.findByRole('button', { name: 'Clear logs' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear logs' }));
        expect(screen.getByText('No logs for this filter')).toBeInTheDocument();
    }, 15_000);

    it('opens by shortcut, searches services, and launches the preserved fallback editor', async () => {
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, services: workspaceSeed.services.slice(0, 4), persistence: undefined });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );

        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('open|console'));

        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('open|allServices'));
        expect(screen.queryByRole('textbox', { name: 'Search services' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Search services' }));
        const search = screen.getByRole('textbox', { name: 'Search services' });
        expect(search).toHaveFocus();
        fireEvent.change(search, { target: { value: '2946' } });
        expect((await screen.findAllByText('#2946')).length).toBeGreaterThan(0);
        fireEvent.change(search, { target: { value: 'no-such-service' } });
        expect(await screen.findByText('No services match this view')).toBeInTheDocument();

        fireEvent.blur(search);
        expect(search).toBeInTheDocument();
        fireEvent.keyDown(search, { key: 'Escape' });
        expect(screen.queryByRole('textbox', { name: 'Search services' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Search services' }));
        const reopenedSearch = screen.getByRole('textbox', { name: 'Search services' });
        fireEvent.change(reopenedSearch, { target: { value: '10147' } });
        fireEvent.click(screen.getByRole('button', { name: /^Active Services/ }));
        expect(screen.getByRole('textbox', { name: 'Search services' })).toHaveValue('');
        fireEvent.click((await screen.findAllByRole('button', { name: 'Open fallback editor' }))[0]!);
        expect(await screen.findByRole('heading', { name: /Fallback editor for/ })).toBeInTheDocument();
    }, 15_000);

    it('restores the established hide-services control with canonical selected-filter compatibility', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.filters[0]!.capabilities = { refill: true };
        const services = workspaceSeed.services.filter((service) => ['10147', '3456'].includes(String(service.id)));
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, services, persistence: undefined });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );

        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.click(screen.getByRole('button', { name: 'Select platform filter' }));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        expect((await screen.findAllByText('#10147')).length).toBeGreaterThan(0);
        expect(screen.getAllByText('#3456').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /#3456/ })).toHaveTextContent('Capability mismatch');

        fireEvent.click(screen.getByRole('button', { name: 'Hide services options' }));
        fireEvent.click(await screen.findByRole('checkbox', { name: /Hide non-eligible for context/ }));
        await waitFor(() => expect(screen.queryAllByText('#3456')).toHaveLength(0));
        expect(screen.getAllByText('#10147').length).toBeGreaterThan(0);
    }, 15_000);

    it('keeps catalogue browsing available while explaining denied fallback mutations', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            services: workspaceSeed.services.slice(0, 1),
            permissions: { ...workspaceSeed.permissions, 'document.mutate': false },
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );

        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        expect((await screen.findByRole('button', { name: /#10147/ })).getAttribute('draggable')).toBe('false');
        fireEvent.click(screen.getByRole('button', { name: /^Active Services/ }));
        const quickAdd = (await screen.findAllByRole('button', { name: 'Add fallbacks' }))[0]!;
        const editor = screen.getAllByRole('button', { name: 'Open fallback editor' })[0]!;
        expect(quickAdd).toBeDisabled();
        expect(editor).toBeDisabled();
        expect(quickAdd).toHaveAttribute('title', 'You do not have permission to edit this definition.');
        expect(editor).toHaveAttribute('title', 'You do not have permission to edit this definition.');
        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
        const createGroup = await screen.findByRole('button', { name: 'Create top-level group' });
        expect(createGroup).toBeDisabled();
        expect(createGroup).toHaveAttribute('title', 'You do not have permission to edit this definition.');
    }, 15_000);

    it('restores linked and manual catalog tags with visible trigger selection', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.filters[0]!.capabilities = { refill: true };
        definition.filters[1]!.capabilities = { refill: false };
        const services = workspaceSeed.services.filter((service) => ['10147', '3456'].includes(String(service.id)));
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, services, persistence: undefined });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );

        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        expect(await screen.findByText('Context tag: Platform')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /#3456/ })).toHaveTextContent('Capability mismatch');

        fireEvent.click(screen.getByRole('button', { name: 'Catalog context filter' }));
        const linked = screen.getByRole('checkbox', { name: /Link to current context/ });
        const strictSafety = screen.getByRole('checkbox', { name: 'Strict safety' });
        expect(linked).not.toBeChecked();
        expect(strictSafety).toBeChecked();
        expect(strictSafety).toBeEnabled();
        expect(screen.getByRole('radio', { name: 'Instagram' })).toBeEnabled();
        fireEvent.click(strictSafety);
        expect(strictSafety).not.toBeChecked();
        fireEvent.click(linked);
        expect(linked).toBeChecked();
        expect(strictSafety).toBeChecked();
        expect(strictSafety).toBeDisabled();
        expect(screen.getByRole('radio', { name: 'Instagram' })).toBeDisabled();
        fireEvent.click(linked);
        expect(strictSafety).toBeEnabled();
        expect(strictSafety).toBeChecked();
        fireEvent.click(screen.getByRole('radio', { name: 'Instagram' }));
        expect(screen.getByText('Context tag: Instagram')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Instagram' })).toBeChecked();

        fireEvent.click(screen.getByRole('radio', { name: 'Platform' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Instagram followers - fast' }));
        expect(screen.getByText('1 selected trigger')).toBeInTheDocument();
        expect(screen.getByText('1 active service in context')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: /Compatible only/ }));
        expect(screen.queryByRole('button', { name: /#3456/ })).not.toBeInTheDocument();
        fireEvent.click(strictSafety);
        expect(screen.getByRole('button', { name: /#3456/ })).toHaveTextContent('Usable');
        expect(screen.getByRole('button', { name: /#3456/ })).toHaveTextContent('Capability mismatch');
        fireEvent.click(strictSafety);
        expect(screen.queryByRole('button', { name: /#3456/ })).not.toBeInTheDocument();
        fireEvent.click(linked);
        expect(strictSafety).toBeChecked();
        expect(strictSafety).toBeDisabled();
        expect(screen.getByText('0 selected triggers')).toBeInTheDocument();
        fireEvent.click(linked);
        expect(strictSafety).toBeChecked();
        expect(strictSafety).toBeEnabled();
        fireEvent.click(linked);
        fireEvent.click(screen.getByRole('button', { name: 'Select Instagram filter' }));
        expect(screen.getByText('Context tag: Instagram')).toBeInTheDocument();
    }, 15_000);

    it('applies the restored custom primary-rate context through canonical Core filtering', async () => {
        const services = workspaceSeed.services.filter((service) => ['10147', '3456'].includes(String(service.id)));
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, services, persistence: undefined });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );

        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        expect((await screen.findAllByText('#10147')).length).toBeGreaterThan(0);
        expect(screen.getAllByText('#3456').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Catalog context filter' }));
        fireEvent.click(await screen.findByRole('checkbox', { name: /Compatible only/ }));
        fireEvent.change(screen.getByDisplayValue('context'), { target: { value: 'custom_primary_rate' } });
        fireEvent.change(screen.getByDisplayValue('service'), { target: { value: 'manual' } });
        expect(await screen.findByText('Provide a primary service or valid primary rate to apply compatibility filtering.')).toBeInTheDocument();
        fireEvent.change(await screen.findByLabelText('Primary rate'), { target: { value: '0.7' } });

        await waitFor(() => expect(screen.queryAllByText('#10147')).toHaveLength(0));
        expect(screen.getAllByText('#3456').length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole('checkbox', { name: /Compatible only/ }));
        const blockedRow = await screen.findByRole('button', { name: /#10147/ });
        expect(blockedRow).toHaveTextContent('Rate policy mismatch');
        fireEvent.click(blockedRow);
        expect(screen.getByText('Rate blocked')).toBeInTheDocument();
    }, 15_000);

    it('routes the preserved manual catalog group controls through canonical Workspace', async () => {
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, services: workspaceSeed.services.slice(0, 3), persistence: undefined });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider>
                    <Harness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );

        await waitFor(() => expect(screen.getByLabelText('Bottom panel state')).toHaveTextContent('closed|console'));
        fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
        fireEvent.click(screen.getByRole('button', { name: /^All Services/ }));
        fireEvent.click(await screen.findByRole('button', { name: 'Catalog' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Create top-level group' }));
        fireEvent.change(await screen.findByLabelText('Create root group'), { target: { value: 'Priority services' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() => expect(screen.getByLabelText('Catalog state')).toHaveTextContent('Priority services'));
        expect(screen.getByRole('button', { name: 'Rename selected group' })).not.toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Assign services to selected group' }));
        expect(await screen.findByRole('dialog', { name: 'Service picker' })).toBeInTheDocument();
    }, 15_000);
});
