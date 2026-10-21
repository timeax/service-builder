// SPDX-License-Identifier: GPL-3.0-only
import { ProductBuilder } from '@elqora/dgp-core';
import type { ProductDefinition } from '@elqora/dgp-spec';
import { CanvasAPI, MemoryWorkspaceBackend, WorkspaceRuntime } from '@elqora/dgp-workspace';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCanonicalReactFlowAdapter } from './canonical-flow-adapter';

const definition: ProductDefinition = {
    id: 'product:adapter',
    name: 'Adapter fixture',
    schema_version: '1',
    description: null,
    filters: [{ id: 'filter:root', label: 'Root', meta: {} }],
    fields: [{ id: 'field:name', type: 'text', label: 'Name', bind_id: 'filter:root', meta: {} }],
    order_for_tags: {},
    includes_for_buttons: {},
    excludes_for_buttons: {},
    option_effects_for_buttons: {},
    value_effects_for_triggers: {},
    fallbacks: null,
    notices: [],
    meta: {},
};

describe('canonical React Flow adapter', () => {
    it('writes selection, snapped positions, viewport and connections through CanvasAPI', () => {
        const api = new CanvasAPI(new ProductBuilder(definition));
        const { result } = renderHook(() => useCanonicalReactFlowAdapter(api, { snap_to_grid: { x: 10, y: 10 } }));
        act(() => result.current.onNodesChange([
            { id: 'field:name', type: 'position', position: { x: 16, y: 24 }, dragging: false },
            { id: 'field:name', type: 'select', selected: true },
        ]));
        expect(api.snapshot().positions['field:name']).toEqual({ x: 20, y: 20 });
        expect(api.get_selection()).toEqual(['field:name']);
        act(() => result.current.onMoveEnd(null, { x: 5, y: 6, zoom: 1.25 }));
        expect(api.get_viewport()).toEqual({ x: 5, y: 6, zoom: 1.25 });
        act(() => result.current.onConnect({ source: 'filter:root', target: 'field:name', sourceHandle: null, targetHandle: null }));
        expect(api.editor.definition.fields[0]?.bind_id).toBe('filter:root');
        const bindEdge = result.current.edges.find((edge) => (edge.data?.edge as { kind?: string } | undefined)?.kind === 'bind');
        expect(bindEdge).toBeDefined();
        act(() => result.current.onEdgesChange([{ id: bindEdge!.id, type: 'remove' }]));
        expect(api.editor.definition.fields[0]?.bind_id).toBeUndefined();
        api.dispose();
    });

    it('previews repeated multi-node movement locally and records one undoable move on release', () => {
        const api = new CanvasAPI(new ProductBuilder(definition));
        const onEditorChange = vi.fn();
        const onPositionChange = vi.fn();
        api.on('editor:change', onEditorChange);
        api.on('positions:change', onPositionChange);
        const { result } = renderHook(() => useCanonicalReactFlowAdapter(api));
        const first = result.current.nodes.find((node) => node.id === 'filter:root')!;
        const second = result.current.nodes.find((node) => node.id === 'field:name')!;

        for (let step = 1; step <= 20; step += 1) {
            act(() => result.current.onNodesChange([
                { id: first.id, type: 'position', position: { x: first.position.x + step, y: first.position.y + step }, dragging: true },
                { id: second.id, type: 'position', position: { x: second.position.x + step, y: second.position.y + step }, dragging: true },
            ]));
        }
        expect(result.current.nodes.find((node) => node.id === first.id)?.position).toEqual({ x: first.position.x + 20, y: first.position.y + 20 });
        expect(api.snapshot().positions).toEqual({});
        expect(api.editor.can_undo()).toBe(false);
        expect(onEditorChange).not.toHaveBeenCalled();
        expect(onPositionChange).not.toHaveBeenCalled();

        act(() => result.current.onNodeDragStop(null as never, result.current.nodes[0]!, result.current.nodes));
        expect(api.snapshot().positions).toMatchObject({
            [first.id]: { x: first.position.x + 20, y: first.position.y + 20 },
            [second.id]: { x: second.position.x + 20, y: second.position.y + 20 },
        });
        expect(onEditorChange).toHaveBeenCalledTimes(1);
        expect(onPositionChange).not.toHaveBeenCalled();
        act(() => { expect(api.editor.undo()).toBe(true); });
        expect(api.snapshot().positions).toEqual({});
        expect(api.editor.can_undo()).toBe(false);
        act(() => { expect(api.editor.redo()).toBe(true); });
        expect(api.snapshot().positions[first.id]).toEqual({ x: first.position.x + 20, y: first.position.y + 20 });
        api.dispose();
    });

    it('skips a no-op drag and abandons an unfinished preview when scope changes', () => {
        const api = new CanvasAPI(new ProductBuilder(definition));
        const { result, rerender } = renderHook(({ scope }) => useCanonicalReactFlowAdapter(api, { scope_key: scope }), { initialProps: { scope: 'one' } });
        const first = result.current.nodes.find((node) => node.id === 'field:name')!;
        act(() => result.current.onNodesChange([{ id: first.id, type: 'position', position: { x: first.position.x + 5, y: first.position.y }, dragging: true }]));
        act(() => result.current.onNodesChange([{ id: first.id, type: 'position', position: first.position, dragging: false }]));
        act(() => result.current.onNodeDragStop(null as never, result.current.nodes[0]!, result.current.nodes));
        expect(api.editor.can_undo()).toBe(false);
        expect(api.snapshot().positions).toEqual({});

        act(() => result.current.onNodesChange([{ id: first.id, type: 'position', position: { x: first.position.x + 10, y: first.position.y }, dragging: true }]));
        rerender({ scope: 'two' });
        expect(result.current.nodes.find((node) => node.id === first.id)?.position).toEqual(first.position);
        act(() => result.current.onNodeDragStop(null as never, result.current.nodes[0]!, result.current.nodes));
        expect(api.snapshot().positions).toEqual({});
        api.dispose();
    });

    it('persists a comment pin only when its drag stops', () => {
        const api = new CanvasAPI(new ProductBuilder(definition));
        api.comments.replace([{
            id: 'thread', branch_id: 'main', target_path: 'canvas@10,20', resolved: false,
            messages: [{ id: 'message', author_id: 'author', body: 'Review', created_at: '2026-08-09T00:00:00.000Z', edited_at: null, meta: {} }],
            created_at: '2026-08-09T00:00:00.000Z', meta: {},
        }]);
        const move = vi.spyOn(api.comments, 'move');
        const { result } = renderHook(() => useCanonicalReactFlowAdapter(api));
        act(() => result.current.onNodesChange([{ id: 'comment:thread', type: 'position', position: { x: 30, y: 40 }, dragging: true }]));
        expect(api.comments.get('thread')?.target_path).toBe('canvas@10,20');
        expect(move).not.toHaveBeenCalled();
        act(() => result.current.onNodeDragStop(null as never, result.current.nodes.find((node) => node.id === 'comment:thread')!, result.current.nodes));
        expect(move).toHaveBeenCalledTimes(1);
        expect(api.comments.get('thread')?.target_path).toBe('canvas@30,40');
        expect(api.editor.can_undo()).toBe(false);
        api.dispose();
    });

    it('does not mark the editorial workspace dirty until the drag is released', async () => {
        const runtime = new WorkspaceRuntime(new MemoryWorkspaceBackend({ definition }), {
            actor: { id: 'author', display_name: 'Author', meta: {} }, auto_autosave: false,
        });
        await runtime.boot();
        const api = runtime.canvas!;
        const revision = runtime.state.revision;
        const { result } = renderHook(() => useCanonicalReactFlowAdapter(api));
        const node = result.current.nodes.find((candidate) => candidate.id === 'field:name')!;
        act(() => result.current.onNodesChange([{ id: node.id, type: 'position', position: { x: node.position.x + 10, y: node.position.y + 10 }, dragging: true }]));
        expect(runtime.state.revision).toBe(revision);
        expect(runtime.state.snapshot_state).toBe('clean');
        act(() => result.current.onNodeDragStop(null as never, result.current.nodes.find((candidate) => candidate.id === node.id)!, result.current.nodes));
        expect(runtime.state.revision).toBe(revision + 1);
        expect(runtime.state.snapshot_state).toBe('dirty');
        runtime.dispose();
    });

    it('rejects a position preview when editing is not permitted while preserving selection', () => {
        const api = new CanvasAPI(new ProductBuilder(definition));
        const denied = vi.fn();
        const { result } = renderHook(() => useCanonicalReactFlowAdapter(api, { can_edit: false, on_permission_denied: denied }));
        const node = result.current.nodes.find((candidate) => candidate.id === 'field:name')!;
        act(() => result.current.onNodesChange([{ id: node.id, type: 'position', position: { x: 900, y: 900 }, dragging: true }]));
        expect(denied).toHaveBeenCalledOnce();
        expect(result.current.nodes.find((candidate) => candidate.id === node.id)?.position).toEqual(node.position);
        expect(api.snapshot().positions).toEqual({});
        act(() => result.current.onNodesChange([{ id: node.id, type: 'select', selected: true }]));
        expect(api.get_selection()).toEqual([node.id]);
        api.dispose();
    });
});
