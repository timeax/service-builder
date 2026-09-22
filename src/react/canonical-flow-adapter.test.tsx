// SPDX-License-Identifier: GPL-3.0-only
import { ProductBuilder } from '@elqora/dgp-core';
import type { ProductDefinition } from '@elqora/dgp-spec';
import { CanvasAPI } from '@elqora/dgp-workspace';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
