// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { createOrderingSession } from '@elqora/dgp-ordering';
import { FormPaletteOrderingProvider, OrderingInput } from '@elqora/dgp-ordering-form-palette';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { VirtuosoGridMockContext, VirtuosoMockContext } from 'react-virtuoso';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSeedPersistence, workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalWireframe } from './canonical-wireframe';
import { canonicalInputRegistry } from './canonical-input-registry';
import { ServiceBuilderProvider } from './workspace';

beforeAll(() => {
    class MockPointerEvent extends MouseEvent {
        pointerId = 1;
        pointerType = 'mouse';
    }
    vi.stubGlobal('PointerEvent', MockPointerEvent);
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    Object.defineProperties(HTMLElement.prototype, {
        scrollIntoView: { configurable: true, value: vi.fn() },
        releasePointerCapture: { configurable: true, value: vi.fn() },
        hasPointerCapture: { configurable: true, value: vi.fn(() => false) },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: vi.fn(() => ({ font: '', measureText: (text: string) => ({ width: text.length * 8 }) })),
    });
    Object.defineProperties(URL, {
        createObjectURL: { configurable: true, value: vi.fn(() => 'blob:canonical-preview') },
        revokeObjectURL: { configurable: true, value: vi.fn() },
    });
});

describe('canonical wireframe browser inputs', () => {
    it('persists a nested JSON edit through the published Form Palette and canonical Ordering adapter', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        const settings = {
            id: 'field:settings',
            type: 'json-editor',
            label: 'Settings',
            name: 'settings',
            bind_id: 'filter:platform',
            default_value: { user: { name: 'Ada' } },
            defaults: { mode: 'accordion', defaultRoute: 'user' },
            meta: {},
        } as const;
        definition.fields.push(settings);
        const session = createOrderingSession(definition, 'filter:platform', undefined, canonicalInputRegistry, { mode: 'dev' });

        render(
            <FormPaletteOrderingProvider session={session} definition={definition} registry={canonicalInputRegistry}>
                <OrderingInput field={settings} />
            </FormPaletteOrderingProvider>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Expand JSON editor' }));
        const name = await screen.findByDisplayValue('Ada');
        fireEvent.change(name, { target: { value: 'Grace' } });

        await waitFor(() => expect(session.store.get().values['field:settings']).toEqual({ user: { name: 'Grace' } }));
    }, 15_000);

    it('updates the Ordering session and preview metrics through real Form Palette inputs', async () => {
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: createSeedPersistence() });
        render(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 240, itemHeight: 36 }}>
                <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                    <CanonicalWireframe />
                </ServiceBuilderProvider>
            </VirtuosoMockContext.Provider>,
        );

        const serviceField = await screen.findByText('Service', { selector: 'label *' });
        const service = serviceField.closest('[data-variant="select"]')?.querySelector<HTMLElement>('[data-slot="select-trigger"]');
        expect(service).toBeDefined();
        fireEvent.pointerDown(service!, { button: 0, ctrlKey: false, pointerId: 1, pointerType: 'mouse' });
        fireEvent.click(await screen.findByRole('option', { name: 'Instagram followers - fast' }));
        await waitFor(() => expect(screen.getByText('Selected options:').parentElement).toHaveTextContent('Selected options:1'));

        expect(screen.getByText('Quantity:').parentElement).toHaveTextContent('Quantity:100');
        expect(screen.getByText('Services:').parentElement).toHaveTextContent('Services:1');
        expect(screen.getByText('Base:').parentElement).toHaveTextContent('Base:0.8375');
        expect(screen.getByText('1 customer input issue in this preview.')).toBeInTheDocument();

        const quantity = screen.getByLabelText(/Quantity/i);
        fireEvent.change(quantity, { target: { value: '250' } });
        await waitFor(() => expect(screen.getByText('Quantity:').parentElement).toHaveTextContent('Quantity:250'));

        const target = await screen.findByLabelText(/Target URL/i);
        fireEvent.change(target, { target: { value: 'https://example.test/post' } });
        expect(target).toHaveValue('https://example.test/post');
        await waitFor(() => expect(screen.queryByText('1 customer input issue in this preview.')).not.toBeInTheDocument());
    }, 15_000);

    it('keeps specialized textarea and single-checkbox inputs interactive through the real adapter', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.fields.push(
            { id: 'field:notes', type: 'textarea', label: 'Order notes', name: 'notes', bind_id: 'filter:platform', meta: {} },
            { id: 'field:terms', type: 'checkbox', label: 'Accept terms', name: 'terms', bind_id: 'filter:platform', meta: {} },
        );
        definition.order_for_tags['filter:platform'] = [...(definition.order_for_tags['filter:platform'] ?? []), 'field:notes', 'field:terms'];
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, persistence: undefined });
        render(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 360, itemHeight: 36 }}>
                <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                    <CanonicalWireframe />
                </ServiceBuilderProvider>
            </VirtuosoMockContext.Provider>,
        );

        const notes = await screen.findByLabelText(/Order notes/i);
        fireEvent.change(notes, { target: { value: 'Deliver after review' } });
        await waitFor(() => expect(notes).toHaveValue('Deliver after review'));

        const terms = await screen.findByRole('checkbox', { name: /Accept terms/i });
        fireEvent.click(terms);
        await waitFor(() => expect(terms).toBeChecked());
    }, 15_000);

    it('preserves option checkbox, multiselect, and recursive tree interactions through the canonical adapter', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.fields.push(
            {
                id: 'field:channels',
                type: 'checkbox',
                variant: 'options',
                label: 'Delivery channels',
                name: 'channels',
                bind_id: 'filter:platform',
                multiple: true,
                options: [
                    { id: 'option:email', label: 'Email', value: 'email' },
                    { id: 'option:sms', label: 'SMS', value: 'sms' },
                ],
                meta: {},
            },
            {
                id: 'field:audiences',
                type: 'multiselect',
                label: 'Audiences',
                name: 'audiences',
                bind_id: 'filter:platform',
                multiple: true,
                options: [
                    { id: 'option:retail', label: 'Retail', value: 'retail' },
                    { id: 'option:business', label: 'Business', value: 'business' },
                ],
                meta: {},
            },
            {
                id: 'field:regions',
                type: 'treeselect',
                label: 'Regions',
                name: 'regions',
                bind_id: 'filter:platform',
                multiple: true,
                options: [
                    { id: 'option:africa', label: 'Africa', value: 'africa', children: [{ id: 'option:nigeria', label: 'Nigeria', value: 'ng' }] },
                ],
                meta: {},
            },
        );
        definition.order_for_tags['filter:platform'] = [
            ...(definition.order_for_tags['filter:platform'] ?? []),
            'field:channels',
            'field:audiences',
            'field:regions',
        ];
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, persistence: undefined });
        render(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 520, itemHeight: 36 }}>
                <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                    <CanonicalWireframe />
                </ServiceBuilderProvider>
            </VirtuosoMockContext.Provider>,
        );

        const email = await screen.findByRole('checkbox', { name: /Email/i });
        fireEvent.click(email);
        await waitFor(() => expect(screen.getByText('Selected options:').parentElement).toHaveTextContent('Selected options:1'));

        const audiencesLabel = await screen.findByText('Audiences', { selector: 'label *' });
        const audiences = audiencesLabel.closest('[data-variant]')?.querySelector<HTMLElement>('button');
        expect(audiences).not.toBeNull();
        fireEvent.click(audiences!);
        fireEvent.click(await screen.findByRole('button', { name: 'Retail' }));
        await waitFor(() => expect(screen.getByText('Selected options:').parentElement).toHaveTextContent('Selected options:2'));

        const regionsLabel = await screen.findByText('Regions', { selector: 'label *' });
        const regions = regionsLabel.closest('[data-variant]')?.querySelector<HTMLElement>('button');
        expect(regions).not.toBeNull();
        fireEvent.click(regions!);
        fireEvent.click(await screen.findByRole('button', { name: 'Expand' }));
        fireEvent.click(await screen.findByText('Nigeria'));
        await waitFor(() => expect(screen.getByText('Selected options:').parentElement).toHaveTextContent('Selected options:3'));
    }, 20_000);

    it('accepts a native file through the real Form Palette file input', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.fields.push({
            id: 'field:attachment',
            type: 'file',
            label: 'Attachment',
            name: 'attachment',
            bind_id: 'filter:platform',
            defaults: { accept: '.txt' },
            meta: {},
        });
        definition.order_for_tags['filter:platform'] = [...(definition.order_for_tags['filter:platform'] ?? []), 'field:attachment'];
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, persistence: undefined });
        const { container } = render(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 360, itemHeight: 36 }}>
                <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                    <CanonicalWireframe />
                </ServiceBuilderProvider>
            </VirtuosoMockContext.Provider>,
        );

        await screen.findByText('Attachment', { selector: 'label *' });
        const input = container.querySelector<HTMLInputElement>('input[type="file"]');
        expect(input).not.toBeNull();
        fireEvent.change(input!, { target: { files: [new File(['customer brief'], 'brief.txt', { type: 'text/plain' })] } });
        expect(await screen.findByText('brief.txt')).toBeInTheDocument();
    }, 15_000);

    it('renders and edits rich text through the real Form Palette editor input', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.fields.push({
            id: 'field:message',
            type: 'editor',
            label: 'Customer message',
            name: 'message',
            bind_id: 'filter:platform',
            defaults: { height: '160px', toolbar: 'none' },
            meta: {},
        });
        definition.order_for_tags['filter:platform'] = [...(definition.order_for_tags['filter:platform'] ?? []), 'field:message'];
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, persistence: undefined });
        const { container } = render(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 420, itemHeight: 36 }}>
                <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                    <CanonicalWireframe />
                </ServiceBuilderProvider>
            </VirtuosoMockContext.Provider>,
        );

        await screen.findByText('Customer message', { selector: 'label *' });
        const editor = await waitFor(() => {
            const element = container.querySelector<HTMLElement>('.ProseMirror[contenteditable="true"]');
            expect(element).not.toBeNull();
            return element!;
        });
        await act(async () => {
            editor.textContent = 'Please deliver after review';
            fireEvent.input(editor);
            await Promise.resolve();
        });
        expect(editor).toHaveTextContent('Please deliver after review');
    }, 15_000);

    it('loads and selects a data-backed option through the real Form Palette lister input', async () => {
        const request = vi.fn(async () => ({
            data: {
                data: [
                    { id: 'customer:ada', name: 'Ada Lovelace' },
                    { id: 'customer:grace', name: 'Grace Hopper' },
                ],
            },
        }));
        const previousAxios = (globalThis as { axios?: unknown }).axios;
        (globalThis as { axios?: unknown }).axios = { request };
        try {
            const definition = structuredClone(workspaceSeed.definition);
            definition.fields.push({
                id: 'field:customer',
                type: 'lister',
                label: 'Customer',
                name: 'customer',
                bind_id: 'filter:platform',
                defaults: {
                    endpoint: '/test/customers',
                    optionValue: 'id',
                    optionLabel: 'name',
                    searchMode: 'local',
                    placeholder: 'Choose customer',
                },
                meta: {},
            });
            definition.order_for_tags['filter:platform'] = [...(definition.order_for_tags['filter:platform'] ?? []), 'field:customer'];
            const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, persistence: undefined });
            render(
                <VirtuosoMockContext.Provider value={{ viewportHeight: 420, itemHeight: 36 }}>
                    <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                        <CanonicalWireframe />
                    </ServiceBuilderProvider>
                </VirtuosoMockContext.Provider>,
            );

            const label = await screen.findByText('Customer', { selector: 'label *' });
            const trigger = label.closest('[data-variant="lister"]')?.querySelector<HTMLButtonElement>('button');
            expect(trigger).not.toBeNull();
            fireEvent.click(trigger!);
            fireEvent.click(await screen.findByText('Ada Lovelace'));
            await waitFor(() => expect(trigger).toHaveTextContent('Ada Lovelace'));
            expect(request).toHaveBeenCalled();
        } finally {
            if (previousAxios === undefined) delete (globalThis as { axios?: unknown }).axios;
            else (globalThis as { axios?: unknown }).axios = previousAxios;
        }
    }, 15_000);

    it('loads and selects an icon through the real Form Palette icon picker', async () => {
        const request = vi.fn(async () =>
            new Response(JSON.stringify({ uncategorized: ['sparkles', 'wand'] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
        const previousFetch = globalThis.fetch;
        vi.stubGlobal('fetch', request);
        try {
            const definition = structuredClone(workspaceSeed.definition);
            definition.fields.push({
                id: 'field:icon',
                type: 'icon',
                label: 'Campaign icon',
                name: 'campaign_icon',
                bind_id: 'filter:platform',
                defaults: {
                    url: 'https://icons.test',
                    groups: [{ id: 'test', label: 'Test icons', prefixes: ['test'] }],
                    allowedGroupIds: ['test'],
                    maxRender: 10,
                },
                meta: {},
            });
            definition.order_for_tags['filter:platform'] = [...(definition.order_for_tags['filter:platform'] ?? []), 'field:icon'];
            const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, persistence: undefined });
            render(
                <VirtuosoGridMockContext.Provider value={{ viewportHeight: 320, viewportWidth: 360, itemHeight: 80, itemWidth: 112 }}>
                    <VirtuosoMockContext.Provider value={{ viewportHeight: 420, itemHeight: 36 }}>
                        <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                            <CanonicalWireframe />
                        </ServiceBuilderProvider>
                    </VirtuosoMockContext.Provider>
                </VirtuosoGridMockContext.Provider>,
            );

            const label = await screen.findByText('Campaign icon', { selector: 'label *' });
            const field = label.closest<HTMLElement>('[data-variant="icon"]');
            const trigger = field?.querySelector<HTMLButtonElement>('button');
            expect(trigger).not.toBeNull();
            fireEvent.click(trigger!);
            await waitFor(() => expect(request).toHaveBeenCalled());
            fireEvent.click(await screen.findByText('sparkles'));
            await waitFor(() => expect(field).toHaveTextContent('sparkles'));
            expect(request).toHaveBeenCalledWith('https://icons.test/collection?prefix=test', expect.objectContaining({ signal: expect.any(AbortSignal) }));
        } finally {
            vi.stubGlobal('fetch', previousFetch);
        }
    }, 15_000);

    it('accepts an image through the real Form Palette image-icon picker', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.fields.push({
            id: 'field:artwork',
            type: 'image-icon',
            label: 'Campaign artwork',
            name: 'campaign_artwork',
            bind_id: 'filter:platform',
            defaults: { accept: 'image/png', iconGroups: [] },
            meta: {},
        });
        definition.order_for_tags['filter:platform'] = [...(definition.order_for_tags['filter:platform'] ?? []), 'field:artwork'];
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, persistence: undefined });
        render(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 420, itemHeight: 36 }}>
                <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                    <CanonicalWireframe />
                </ServiceBuilderProvider>
            </VirtuosoMockContext.Provider>,
        );

        const label = await screen.findByText('Campaign artwork', { selector: 'label *' });
        const field = label.closest<HTMLElement>('[data-variant="image-icon"]');
        const trigger = field?.querySelector<HTMLButtonElement>('button');
        expect(trigger).not.toBeNull();
        fireEvent.click(trigger!);
        fireEvent.click(await screen.findByRole('button', { name: 'Image' }));
        const input = document.querySelector<HTMLInputElement>('[data-radix-popper-content-wrapper] input[type="file"]');
        expect(input).not.toBeNull();
        fireEvent.change(input!, { target: { files: [new File(['png'], 'campaign.png', { type: 'image/png' })] } });
        await waitFor(() => expect(field).toHaveTextContent('campaign.png'));
    }, 15_000);
});
