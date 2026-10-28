// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { createSeedPersistence, definition, workspaceSeed } from '../../backend/canonical/seed';
import { MAIN_BRANCH_ID, workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalCanvasSurface } from './canonical-canvas-surface';
import { CanonicalImportJsonModal } from './canonical-import-json-modal';
import { CanonicalNodeContextMenuProvider, useCanonicalNodeContextMenu } from './canonical-node-context-menu';
import { DRAG_MIME_ASSET_BUILTIN, DRAG_MIME_ASSET_TEMPLATE, DRAG_MIME_SERVICE } from './drag-contracts';
import { ServiceBuilderProvider, useCanvasAPI, useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

function createIsolatedBackend() {
    return new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: createSeedPersistence() });
}

function WorkspaceMutationProbe() {
    const runtime = useWorkspaceRuntime();
    const state = useWorkspaceSelector((current) => current);
    const label = state.definition?.filters.find((filter) => filter.id === 'filter:platform')?.label;
    return <><button type="button" onClick={() => runtime.editor?.relabel('filter:platform', 'Edited platform')}>Edit platform</button><output aria-label="Workspace mutation state">{label}|{state.snapshot_state}|{state.draft ? 'draft' : 'no-draft'}|{state.head?.message}</output></>;
}

function ValidationMutationProbe() {
    const runtime = useWorkspaceRuntime();
    const validation = useWorkspaceSelector((state) => state.validation);
    return <><button type="button" onClick={() => runtime.mutate((current) => ({ ...current, fields: current.fields.map((field) => field.id === 'field:quantity' ? { ...field, name: 'link' } : field) }))}>Create duplicate field name</button><output aria-label="Validation diagnostic count">{validation === null ? 'pending' : validation.protocol.diagnostics.length + validation.policyDiagnostics.length}</output></>;
}

function ImportIntegrationProbe() {
    const runtime = useWorkspaceRuntime();
    const api = useCanvasAPI();
    const currentDefinition = useWorkspaceSelector((state) => state.definition);
    const [open, setOpen] = useState(false);
    return <>
        <button type="button" onClick={() => setOpen(true)}>Edit product JSON</button>
        <button type="button" onClick={() => api?.editor.undo()}>Undo import</button>
        <output aria-label="Imported product name">{currentDefinition?.name}</output>
        <CanonicalImportJsonModal open={open} target="props" currentDefinition={currentDefinition} currentCatalog={api?.editor.get_catalog()} onClose={() => setOpen(false)} onImportProps={(next) => {
            const result = runtime.replace(next);
            if (result.ok === false) throw new Error(result.error.message);
        }} onImportCatalog={(next) => api?.editor.set_catalog(next)} />
    </>;
}

function ContextSelectionProbe() {
    const canvas = useCanvasAPI();
    return <button type="button" onClick={() => canvas?.select(['filter:instagram'], 'filter:instagram')}>Focus Instagram tag</button>;
}

function CommentResolutionProbe() {
    const canvas = useCanvasAPI();
    const [, refresh] = useState(0);
    useEffect(() => canvas?.on('comments:change', () => refresh((version) => version + 1)), [canvas]);
    const thread = canvas?.comments.get('thread:welcome');
    return <output aria-label="Welcome comment state">{thread === undefined ? 'missing' : thread.resolved ? 'resolved' : 'open'}|{thread?.sync_state ?? 'none'}</output>;
}

function OptionServiceProbe() {
    const service = useWorkspaceSelector((state) => state.definition?.fields.find((field) => field.id === 'field:service')?.options?.[0]?.service_id);
    return <output aria-label="Option service state">{service ?? 'unset'}</output>;
}

function FieldDropProbe() {
    const fields = useWorkspaceSelector((state) => state.definition?.fields ?? []);
    const includeCount = useWorkspaceSelector((state) => state.definition?.includes_for_buttons?.['option:instagram-followers']?.length ?? 0);
    const urlType = fields.find((field) => field.id === 'field:url')?.type;
    const platformFieldCount = fields.filter((field) => field.bind_id === 'filter:platform').length;
    return <output aria-label="Field drop state">{urlType ?? 'missing'}|{platformFieldCount}|{includeCount}</output>;
}

function DroppedFieldProbe({ label }: { label: string }) {
    const canvas = useCanvasAPI();
    const fields = useWorkspaceSelector((state) => state.definition?.fields ?? []);
    const matches = fields.filter((field) => field.label === label).map((field) => ({
        id: field.id,
        bind_id: field.bind_id,
        wired: canvas?.get_graph().edges.some((edge) => edge.kind === 'bind' && edge.from === 'filter:platform' && edge.to === field.id) ?? false,
    }));
    return <output aria-label={`Dropped ${label}`}>{JSON.stringify(matches)}</output>;
}

function DropAwareCanvas() {
    const menu = useCanonicalNodeContextMenu();
    return <CanonicalCanvasSurface on_node_drop={menu.open_drop_dial} />;
}

function PaneDropProbe() {
    const canvas = useCanvasAPI();
    const fields = useWorkspaceSelector((state) => state.definition?.fields ?? []);
    const dropped = fields.find((field) => field.label === 'Pane field');
    const position = dropped ? canvas?.snapshot().positions[dropped.id] : undefined;
    return <output aria-label="Pane drop state">{fields.length}|{position?.x ?? 'none'}|{position?.y ?? 'none'}</output>;
}

function TemplateDropProbe() {
    const fields = useWorkspaceSelector((state) => state.definition?.fields ?? []);
    const copies = fields.filter((field) => field.label === 'Reusable select');
    return <output aria-label="Template drop identities">{JSON.stringify(copies.map((field) => ({ field: field.id, option: field.options?.[0]?.id })))}</output>;
}

function serviceTransfer(serviceId: string) {
    return {
        types: [DRAG_MIME_SERVICE],
        getData(type: string) {
            return type === DRAG_MIME_SERVICE ? serviceId : '';
        },
    } as unknown as DataTransfer;
}

function builtinTransfer(fieldType: string, label: string) {
    return {
        types: [DRAG_MIME_ASSET_BUILTIN],
        getData(type: string) {
            return type === DRAG_MIME_ASSET_BUILTIN ? JSON.stringify({ kind: fieldType, label }) : '';
        },
    } as unknown as DataTransfer;
}

function templateTransfer(templateId: string) {
    return {
        types: [DRAG_MIME_ASSET_TEMPLATE],
        getData(type: string) {
            return type === DRAG_MIME_ASSET_TEMPLATE ? JSON.stringify({ id: templateId, name: 'Reusable select' }) : '';
        },
    } as unknown as DataTransfer;
}

beforeAll(() => {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () => new DOMRect();
    vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
    vi.stubGlobal(
        'ResizeObserver',
        class {
            private readonly callback: ResizeObserverCallback;
            constructor(callback: ResizeObserverCallback) {
                this.callback = callback;
            }
            observe(target: Element) {
                queueMicrotask(() =>
                    this.callback(
                        [{ target, contentRect: { width: 200, height: 80 } } as ResizeObserverEntry],
                        this as unknown as ResizeObserver,
                    ),
                );
            }
            unobserve() {}
            disconnect() {}
        },
    );
    Object.defineProperties(HTMLElement.prototype, {
        offsetWidth: { configurable: true, get: () => 200 },
        offsetHeight: { configurable: true, get: () => 80 },
    });
});

describe('canonical canvas surface', () => {
    it('shows validation diagnostics in the toolbar before the bottom panel opens and refreshes after an edit', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><ValidationMutationProbe /><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Validation diagnostic count')).not.toHaveTextContent('pending'));
        const initialCount = Number(screen.getByLabelText('Validation diagnostic count').textContent);
        fireEvent.click(screen.getByRole('button', { name: 'Create duplicate field name' }));
        await waitFor(() => expect(Number(screen.getByLabelText('Validation diagnostic count').textContent)).toBeGreaterThan(initialCount));
        expect(screen.getByTestId('console-diagnostic-badge')).toBeInTheDocument();
    });
    it('opens the preserved Notice Manager from the canvas toolbar', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><CanonicalCanvasSurface /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider></div>);
        fireEvent.click(await screen.findByTitle('Toggle notices manager'));
        expect(await screen.findByRole('dialog', { name: 'Notice Manager' })).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notice Manager' })).not.toBeInTheDocument());
    });

    it('keeps an edit and shows a dismissible backend save failure', async () => {
        const backend = createIsolatedBackend();
        backend.save_draft = vi.fn().mockResolvedValue({ ok: false, error: { code: 'revision_conflict', message: 'The branch changed elsewhere.', retryable: true, meta: {} } });
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={backend} actor={workspaceActor}><WorkspaceMutationProbe /><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Platform|clean'));
        fireEvent.click(screen.getByRole('button', { name: 'Edit platform' }));
        await waitFor(() => expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Edited platform|dirty'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
        });
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Save failed'));
        expect(screen.getByRole('alert')).toHaveTextContent('The branch changed elsewhere.');
        expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Edited platform|dirty');
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('routes a publication failure to the preserved diagnostics console', async () => {
        const backend = createIsolatedBackend();
        backend.publish = vi.fn().mockResolvedValue({ ok: false, error: { code: 'publication_validation_failed', message: 'Review the definition diagnostics.', retryable: false, meta: {} } });
        const bottomPanel = { isOpen: false, toggle: vi.fn(), open: vi.fn() } as unknown as NonNullable<React.ComponentProps<typeof CanonicalCanvasSurface>['bottom_panel']>;
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalCanvasSurface bottom_panel={bottomPanel} /></ServiceBuilderProvider></div>);
        const publish = await screen.findByRole('button', { name: 'Publish commit' });
        fireEvent.click(publish);
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Publication failed'));
        fireEvent.click(screen.getByRole('button', { name: 'Review diagnostics' }));
        expect(bottomPanel.open).toHaveBeenCalledWith('console');
    });

    it('updates the retained service-context card when the active tag changes', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><ContextSelectionProbe /><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByText('Active tag: Platform')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Focus Instagram tag' }));
        await waitFor(() => expect(screen.getByText('Active tag: Instagram')).toBeInTheDocument());
    });

    it('toggles the Service context card from Canvas view without losing its saved position', async () => {
        const storageKey = `service-builder.canvas.system-node.service-context.${workspaceSeed.workspace_id}.${MAIN_BRANCH_ID}`;
        window.localStorage.setItem(storageKey, JSON.stringify({ x: 321, y: 123 }));
        try {
            render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
            const card = await screen.findByTestId('rf__node-sys::service-context');
            expect(card.style.transform).toBe('translate(321px,123px)');
            fireEvent.click(screen.getByRole('button', { name: 'Canvas view' }));
            const hide = await screen.findByRole('button', { name: 'Service context On' });
            expect(hide).toHaveAttribute('aria-pressed', 'true');
            hide.focus();
            expect(document.activeElement).toBe(hide);
            fireEvent.click(hide);
            await waitFor(() => expect(screen.queryByTestId('rf__node-sys::service-context')).not.toBeInTheDocument());
            expect(screen.getByTestId('rf__node-filter:platform')).toBeInTheDocument();
            const show = screen.getByRole('button', { name: 'Service context Off' });
            expect(show).toHaveAttribute('aria-pressed', 'false');
            fireEvent.click(show);
            expect((await screen.findByTestId('rf__node-sys::service-context')).style.transform).toBe('translate(321px,123px)');
            expect(window.localStorage.getItem(storageKey)).toBe(JSON.stringify({ x: 321, y: 123 }));
        } finally {
            window.localStorage.removeItem(storageKey);
        }
    });

    it('applies a canonical product from the JSON editor as an undoable change', async () => {
        render(<ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><ImportIntegrationProbe /></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Imported product name')).toHaveTextContent(definition.name));
        fireEvent.click(screen.getByRole('button', { name: 'Edit product JSON' }));
        expect(await screen.findByRole('dialog', { name: 'Product definition JSON' })).toBeInTheDocument();
        const file = new File([JSON.stringify({ ...definition, name: 'Imported product' })], 'product.json', { type: 'application/json' });
        fireEvent.change(screen.getByLabelText('Load JSON file'), { target: { files: [file] } });
        await screen.findByText('Source: File upload');
        fireEvent.click(await screen.findByRole('button', { name: 'Apply definition' }));
        await waitFor(() => expect(screen.getByLabelText('Imported product name')).toHaveTextContent('Imported product'));
        fireEvent.click(screen.getByRole('button', { name: 'Undo import' }));
        await waitFor(() => expect(screen.getByLabelText('Imported product name')).toHaveTextContent(definition.name));
    });

    it('renders the established relationship toolbar over canonical graph nodes', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Bind' })).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Include' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Exclude' })).toBeInTheDocument();
        const canvasView = screen.getByRole('button', { name: 'Canvas view' });
        expect(canvasView).toHaveClass('pointer-events-auto');
        expect(canvasView.parentElement).toHaveClass('rounded-lg', 'border-slate-200', 'bg-white/95', 'shadow-md');
        expect(canvasView.parentElement).not.toContainElement(screen.getByRole('button', { name: 'Bind' }));
        canvasView.focus();
        expect(canvasView).toHaveFocus();
        expect(screen.getByTitle('Toggle console')).toBeInTheDocument();
        expect(screen.getByTitle('Undo')).toBeInTheDocument();
        expect(screen.getByTitle('History')).toBeInTheDocument();
        expect(screen.getByText('Service context')).toBeInTheDocument();
        expect(screen.getByText('Active tag: Platform')).toBeInTheDocument();
        expect(screen.getByText(/Instagram Followers \[Refill: 30D\]/)).toBeInTheDocument();
        expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0);
        fireEvent.click(canvasView);
        expect(await screen.findByRole('button', { name: 'Grid On' })).toBeInTheDocument();
    });

    it('routes undo, redo, save, and publish toolbar actions through canonical Workspace', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><WorkspaceMutationProbe /><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Platform|clean|no-draft|Initial main seed'));

        fireEvent.click(screen.getByRole('button', { name: 'Edit platform' }));
        await waitFor(() => expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Edited platform|dirty'));
        fireEvent.click(screen.getByTitle('Undo'));
        await waitFor(() => expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Platform|dirty'));
        fireEvent.click(screen.getByTitle('Redo'));
        await waitFor(() => expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Edited platform|dirty'));

        fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
        await waitFor(() => expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Edited platform|uncommitted|draft'));
        fireEvent.click(screen.getByRole('button', { name: 'Publish commit' }));
        await waitFor(() => expect(screen.getByLabelText('Workspace mutation state')).toHaveTextContent('Edited platform|clean|no-draft|Published from Service Builder'));
    }, 10_000);

    it('resolves a canonical comment through the existing canvas status label', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CommentResolutionProbe /><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Welcome comment state')).toHaveTextContent('open|synced'));
        fireEvent.click(screen.getByRole('button', { name: 'Canvas view' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Comments Off' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Comments On' })).toBeInTheDocument());
        const resolveButtons = await screen.findAllByLabelText('Resolve comment');
        fireEvent.click(resolveButtons[0]!);
        await waitFor(() => expect(screen.getByLabelText('Welcome comment state')).toHaveTextContent('resolved|synced'));
    });

    it('routes a browser service drop on an option node through the canonical Editor', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><OptionServiceProbe /><DropAwareCanvas /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Option service state')).toHaveTextContent('10147'));
        const optionNode = document.querySelector('[data-testid="rf__node-option:instagram-followers"]');
        const dropTarget = optionNode?.querySelector('[data-node-state]');
        expect(dropTarget).not.toBeNull();
        fireEvent.drop(dropTarget!, { dataTransfer: serviceTransfer('2946') });
        fireEvent.click(await screen.findByRole('button', { name: 'Set Service' }));
        await waitFor(() => expect(screen.getByLabelText('Option service state')).toHaveTextContent('2946'));
    }, 10_000);

    it('preserves the Include/Exclude dial for an input dropped on an option and routes the choice through canonical Workspace', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><FieldDropProbe /><DroppedFieldProbe label="Number" /><DropAwareCanvas /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|3|0'));
        const optionNode = document.querySelector('[data-testid="rf__node-option:instagram-followers"]');
        const dropTarget = optionNode?.querySelector('[data-node-state]');
        expect(dropTarget).not.toBeNull();
        fireEvent.drop(dropTarget!, { dataTransfer: builtinTransfer('number', 'Number') });
        const includeAction = (await screen.findAllByRole('button', { name: 'Include' })).find((button) => button.textContent === 'Include');
        const excludeAction = screen.getAllByRole('button', { name: 'Exclude' }).find((button) => button.textContent === 'Exclude');
        expect(includeAction).toBeInTheDocument();
        expect(excludeAction).toBeInTheDocument();
        expect(screen.getByLabelText('Dropped Number')).toHaveTextContent('[]');
        fireEvent.click(includeAction!);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|4|1'));
        expect(JSON.parse(screen.getByLabelText('Dropped Number').textContent ?? '[]')).toHaveLength(1);
    }, 10_000);

    it('preserves the Bind dial for an input dropped on a filter and creates a canonical bound field', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><FieldDropProbe /><DroppedFieldProbe label="New text field" /><DropAwareCanvas /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|3|0'));
        const filterNode = document.querySelector('[data-testid="rf__node-filter:platform"]');
        const dropTarget = filterNode?.querySelector('[data-node-state]');
        expect(dropTarget).not.toBeNull();
        fireEvent.drop(dropTarget!, { dataTransfer: builtinTransfer('text', 'New text field') });
        const bindAction = (await screen.findAllByRole('button', { name: 'Bind' })).find((button) => button.textContent === 'Bind');
        expect(screen.getByLabelText('Dropped New text field')).toHaveTextContent('[]');
        fireEvent.click(bindAction!);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|4|0'));
        const dropped = JSON.parse(screen.getByLabelText('Dropped New text field').textContent ?? '[]') as Array<{ bind_id: string; wired: boolean }>;
        expect(dropped).toHaveLength(1);
        expect(dropped[0]).toMatchObject({ bind_id: 'filter:platform', wired: true });
    }, 10_000);

    it('creates just one bound template field when a template is dropped on a filter', async () => {
        const snapshot = await createSeedPersistence().load(workspaceSeed.workspace_id);
        if (!snapshot) throw new Error('Missing seeded workspace');
        snapshot.branches[0]!.templates.push({
            id: 'template:select', key: 'select', name: 'Reusable select', branch_id: null, published: true,
            updated_at: new Date(0).toISOString(), meta: {},
            field: { id: 'field:reusable', type: 'select', label: 'Reusable select', options: [{ id: 'option:reusable', label: 'Choice', value: 'choice' }] },
        });
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            persistence: { load: async () => structuredClone(snapshot), save: async () => {} },
        });
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalNodeContextMenuProvider><DroppedFieldProbe label="Reusable select" /><DropAwareCanvas /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Dropped Reusable select')).toHaveTextContent('[]'));
        const filterNode = document.querySelector('[data-testid="rf__node-filter:platform"]');
        const dropTarget = filterNode?.querySelector('[data-node-state]');
        expect(dropTarget).not.toBeNull();
        fireEvent.drop(dropTarget!, { dataTransfer: templateTransfer('template:select') });
        const bindAction = (await screen.findAllByRole('button', { name: 'Bind' })).find((button) => button.textContent === 'Bind');
        expect(screen.getByLabelText('Dropped Reusable select')).toHaveTextContent('[]');
        fireEvent.click(bindAction!);
        await waitFor(() => {
            const dropped = JSON.parse(screen.getByLabelText('Dropped Reusable select').textContent ?? '[]') as Array<{ bind_id: string; wired: boolean }>;
            expect(dropped).toHaveLength(1);
            expect(dropped[0]).toMatchObject({ bind_id: 'filter:platform', wired: true });
        });
    }, 10_000);

    it('creates and places a built-in input dropped on the canvas pane through canonical Workspace', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><PaneDropProbe /><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Pane drop state')).toHaveTextContent('3|none|none'));
        const canvas = await screen.findByTestId('rf__wrapper');
        const drop = new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 320, clientY: 240 });
        Object.defineProperty(drop, 'dataTransfer', { value: builtinTransfer('text', 'Pane field') });
        fireEvent(canvas, drop);
        await waitFor(() => {
            const [count, x, y] = screen.getByLabelText('Pane drop state').textContent?.split('|') ?? [];
            expect(count).toBe('4');
            expect(Number.isFinite(Number(x))).toBe(true);
            expect(Number.isFinite(Number(y))).toBe(true);
        });
    }, 10_000);

    it('instantiates option-bearing templates repeatedly with distinct canonical identities', async () => {
        const snapshot = await createSeedPersistence().load(workspaceSeed.workspace_id);
        if (!snapshot) throw new Error('Missing seeded workspace');
        snapshot.branches[0]!.templates.push({
            id: 'template:select', key: 'select', name: 'Reusable select', branch_id: null, published: true,
            updated_at: new Date(0).toISOString(), meta: {},
            field: { id: 'field:reusable', type: 'select', label: 'Reusable select', options: [{ id: 'option:reusable', label: 'Choice', value: 'choice' }] },
        });
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            persistence: { load: async () => structuredClone(snapshot), save: async () => {} },
        });
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={backend} actor={workspaceActor}><TemplateDropProbe /><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Template drop identities')).toHaveTextContent('[]'));
        const canvas = await screen.findByTestId('rf__wrapper');
        for (let index = 0; index < 2; index++) {
            const drop = new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 320, clientY: 240 });
            Object.defineProperty(drop, 'dataTransfer', { value: templateTransfer('template:select') });
            fireEvent(canvas, drop);
        }
        await waitFor(() => {
            const copies = JSON.parse(screen.getByLabelText('Template drop identities').textContent ?? '[]') as Array<{ field: string; option: string }>;
            expect(copies).toHaveLength(2);
            expect(new Set(copies.map((copy) => copy.field)).size).toBe(2);
            expect(new Set(copies.map((copy) => copy.option)).size).toBe(2);
        });
    });

    it('presents canonical permission denials through the preserved toolbar controls', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            persistence: undefined,
            permissions: {
                ...workspaceSeed.permissions,
                'document.mutate': false,
                'draft.save': false,
                publish: false,
                'comment.write': false,
            },
        });
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        const save = await screen.findByRole('button', { name: 'Save snapshot' });
        expect(save).toBeDisabled();
        expect(save).toHaveAttribute('title', 'Editing is disabled for this actor.');
        const publish = screen.getByRole('button', { name: 'Publish commit' });
        expect(publish).toBeDisabled();
        expect(publish).toHaveAttribute('title', 'Publishing is disabled for this actor.');
        expect(screen.getByTitle('Comment write access is disabled for this actor.')).toBeDisabled();
    });

    it('does not dispatch a node drop when definition editing is denied', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            persistence: undefined,
            permissions: { ...workspaceSeed.permissions, 'document.mutate': false },
        });
        const onNodeDrop = vi.fn(() => false);
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={backend} actor={workspaceActor}><FieldDropProbe /><CanonicalCanvasSurface on_node_drop={onNodeDrop} /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|3|0'));
        const fieldNode = await waitFor(() => {
            const node = document.querySelector('[data-testid="rf__node-field:url"]');
            expect(node).not.toBeNull();
            return node;
        });
        const dropTarget = fieldNode?.querySelector('[data-node-state]');
        expect(dropTarget).not.toBeNull();
        fireEvent.drop(dropTarget!, { dataTransfer: builtinTransfer('number', 'Number') });
        expect(onNodeDrop).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|3|0');
    });
});
