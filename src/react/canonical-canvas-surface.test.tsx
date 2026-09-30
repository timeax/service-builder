// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { createSeedPersistence, definition, workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalCanvasSurface } from './canonical-canvas-surface';
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

function ImportProbe() {
    const name = useWorkspaceSelector((state) => state.definition?.name);
    return <output aria-label="Imported product name">{name}</output>;
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

    it('opens the preserved import dialog and applies a canonical product as an undoable change', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><ImportProbe /><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Imported product name')).toHaveTextContent(definition.name));
        fireEvent.keyDown(screen.getByRole('button', { name: 'Import JSON' }), { key: 'ArrowDown' });
        fireEvent.click(await screen.findByText('Import props'));
        const dialog = await screen.findByRole('dialog', { name: 'Import props JSON' });
        expect(dialog).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('JSON payload'), { target: { value: JSON.stringify({ ...definition, name: 'Imported product' }) } });
        fireEvent.click(screen.getByRole('button', { name: 'Import props' }));
        await waitFor(() => expect(screen.getByLabelText('Imported product name')).toHaveTextContent('Imported product'));
        fireEvent.click(screen.getByTitle('Undo'));
        await waitFor(() => expect(screen.getByLabelText('Imported product name')).toHaveTextContent(definition.name));
    });

    it('renders the established relationship toolbar over canonical graph nodes', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalCanvasSurface /></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Bind' })).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Include' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Exclude' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Canvas view' })).toHaveClass('pointer-events-auto');
        expect(screen.getByTitle('Toggle console')).toBeInTheDocument();
        expect(screen.getByTitle('Undo')).toBeInTheDocument();
        expect(screen.getByTitle('History')).toBeInTheDocument();
        expect(screen.getByText('Service context')).toBeInTheDocument();
        expect(screen.getByText('Active tag: Platform')).toBeInTheDocument();
        expect(screen.getByText(/Instagram Followers \[Refill: 30D\]/)).toBeInTheDocument();
        expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0);
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
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><FieldDropProbe /><DropAwareCanvas /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|3|0'));
        const optionNode = document.querySelector('[data-testid="rf__node-option:instagram-followers"]');
        const dropTarget = optionNode?.querySelector('[data-node-state]');
        expect(dropTarget).not.toBeNull();
        fireEvent.drop(dropTarget!, { dataTransfer: builtinTransfer('number', 'Number') });
        const includeAction = (await screen.findAllByRole('button', { name: 'Include' })).find((button) => button.textContent === 'Include');
        const excludeAction = screen.getAllByRole('button', { name: 'Exclude' }).find((button) => button.textContent === 'Exclude');
        expect(includeAction).toBeInTheDocument();
        expect(excludeAction).toBeInTheDocument();
        fireEvent.click(includeAction!);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|4|1'));
    }, 10_000);

    it('preserves the Bind dial for an input dropped on a filter and creates a canonical bound field', async () => {
        render(<div style={{ width: 1000, height: 700 }}><ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalNodeContextMenuProvider><FieldDropProbe /><DropAwareCanvas /></CanonicalNodeContextMenuProvider></ServiceBuilderProvider></div>);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|3|0'));
        const filterNode = document.querySelector('[data-testid="rf__node-filter:platform"]');
        const dropTarget = filterNode?.querySelector('[data-node-state]');
        expect(dropTarget).not.toBeNull();
        fireEvent.drop(dropTarget!, { dataTransfer: builtinTransfer('text', 'New text field') });
        const bindAction = (await screen.findAllByRole('button', { name: 'Bind' })).find((button) => button.textContent === 'Bind');
        fireEvent.click(bindAction!);
        await waitFor(() => expect(screen.getByLabelText('Field drop state')).toHaveTextContent('text|4|0'));
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
