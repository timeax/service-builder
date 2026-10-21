// SPDX-License-Identifier: GPL-3.0-only
import { ProductBuilder } from '@elqora/dgp-core';
import type { ProductDefinition } from '@elqora/dgp-spec';
import { CanvasAPI, type SynchronizedCommentThread } from '@elqora/dgp-workspace';
import { describe, expect, it } from 'vitest';
import {
    formatCanonicalCanvasCommentTarget,
    parseCanonicalCommentTarget,
    toCanonicalReactFlowModel,
} from './canvas-model';

const definition: ProductDefinition = {
    id: 'product:canvas',
    name: 'Canvas fixture',
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

const comment: SynchronizedCommentThread = {
    id: 'comment:one',
    branch_id: 'main',
    target_path: 'canvas@420,180',
    resolved: false,
    created_at: '2026-01-01T00:00:00.000Z',
    sync_state: 'synced',
    messages: [{
        id: 'message:one',
        author_id: 'author:one',
        body: 'Review this area',
        created_at: '2026-01-01T00:00:00.000Z',
        edited_at: null,
        meta: {},
    }],
    meta: {},
};

describe('canonical React Flow projection', () => {
    it('keeps established tag/field node renderers over canonical filter/field nodes', () => {
        const api = new CanvasAPI(new ProductBuilder(definition));
        api.set_position('filter:root', 10, 20);
        const model = toCanonicalReactFlowModel(api.snapshot(), [comment]);

        expect(model.nodes.find((node) => node.id === 'filter:root')).toMatchObject({
            type: 'tag',
            position: { x: 10, y: 20 },
            data: { node: { kind: 'tag', label: 'Root' } },
        });
        expect(model.nodes.find((node) => node.id === 'field:name')?.type).toBe('field');
        expect(model.nodes.find((node) => node.id === 'comment:comment:one')).toMatchObject({
            type: 'comment',
            position: { x: 420, y: 180 },
        });
        api.dispose();
    });

    it('uses canonical target paths for free and node-anchored comments', () => {
        expect(formatCanonicalCanvasCommentTarget({ x: 19.6, y: -4.4 })).toBe('canvas@20,-4');
        expect(parseCanonicalCommentTarget('field:name', { 'field:name': { x: 100, y: 200 } })).toEqual({
            x: 132,
            y: 184,
        });
    });
});
