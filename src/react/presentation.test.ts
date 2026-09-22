// SPDX-License-Identifier: GPL-3.0-only
import { ProductBuilder } from '@elqora/dgp-core';
import type { ProductDefinition } from '@elqora/dgp-spec';
import { CanvasAPI } from '@elqora/dgp-workspace';
import { describe, expect, it } from 'vitest';
import {
    buildFieldLayers,
    buildFilterLayers,
    createServiceBuilderCanvasModel,
    deriveCanonicalSelection,
    findCanonicalOption,
} from './presentation';

const definition: ProductDefinition = {
    id: 'product:layers',
    name: 'Layer fixture',
    schema_version: '1',
    description: null,
    filters: [
        { id: 'filter:root', label: 'Root', meta: {} },
        { id: 'filter:child', label: 'Child', bind_id: 'filter:root', meta: {} },
    ],
    fields: [
        {
            id: 'field:quality',
            type: 'select',
            label: 'Quality',
            bind_id: 'filter:child',
            meta: {},
            options: [
                {
                    id: 'option:premium',
                    label: 'Premium',
                    value: 'premium',
                    meta: {},
                    children: [{ id: 'option:verified', label: 'Verified', value: 'verified', meta: {} }],
                },
            ],
        },
    ],
    order_for_tags: {},
    includes_for_buttons: {},
    excludes_for_buttons: {},
    option_effects_for_buttons: {},
    value_effects_for_triggers: {},
    fallbacks: null,
    notices: [],
    meta: {},
};

describe('canonical service-builder presentation model', () => {
    it('projects nested canonical filters and options without changing their data', () => {
        const filters = buildFilterLayers(definition);
        const fields = buildFieldLayers(definition);

        expect(filters).toHaveLength(1);
        expect(filters[0]?.children[0]?.id).toBe('filter:child');
        expect(filters[0]?.children[0]?.data).toBe(definition.filters[1]);
        expect(fields[0]?.children[0]?.children[0]?.id).toBe('option:verified');
        expect(findCanonicalOption(definition, 'option:verified')?.label).toBe('Verified');
    });

    it('classifies selection from the canonical graph', () => {
        const api = new CanvasAPI(new ProductBuilder(definition));
        api.set_options_shown('field:quality', true);
        const graph = api.get_graph();
        const selection = deriveCanonicalSelection(graph, ['filter:child', 'option:premium'], 'filter:child');

        expect(selection).toMatchObject({
            filter_ids: ['filter:child'],
            field_ids: [],
            option_ids: ['option:premium'],
            service_ids: [],
            primary_id: 'filter:child',
        });
        api.dispose();
    });

    it('binds one canonical CanvasAPI as the only editor and selection authority', () => {
        const api = new CanvasAPI(new ProductBuilder(definition));
        api.select(['filter:child', 'field:quality'], 'field:quality');
        const model = createServiceBuilderCanvasModel(definition, api.snapshot(), api);

        expect(model.api).toBe(api);
        expect(model.editor).toBe(api.editor);
        expect(model.active_id).toBe('field:quality');
        expect(model.selection.field_ids).toEqual(['field:quality']);
        expect(model.context_filter_id).toBe('filter:child');
        expect(model.layers.fields.map((field) => field.id)).toEqual(['field:quality']);
        expect(model.definition).toBe(definition);
        api.dispose();
    });
});
