// SPDX-License-Identifier: GPL-3.0-only
import { ProductBuilder } from '@elqora/dgp-core';
import type { ProductDefinition } from '@elqora/dgp-spec';
import { CanvasAPI } from '@elqora/dgp-workspace';
import { describe, expect, it } from 'vitest';
import {
    reorderCanonicalFieldForFilter,
    reorderCanonicalFilter,
    reorderCanonicalOption,
} from './layer-commands';

function fixture(): ProductDefinition {
    return {
        id: 'product:reorder',
        name: 'Reorder fixture',
        schema_version: '1',
        description: null,
        filters: [
            { id: 'filter:a', label: 'A', meta: {} },
            { id: 'filter:b', label: 'B', meta: {} },
            { id: 'filter:a:one', label: 'A one', bind_id: 'filter:a', meta: {} },
            { id: 'filter:a:two', label: 'A two', bind_id: 'filter:a', meta: {} },
        ],
        fields: [
            {
                id: 'field:a',
                type: 'select',
                label: 'A',
                bind_id: 'filter:a',
                meta: {},
                options: [
                    {
                        id: 'option:parent',
                        label: 'Parent',
                        meta: {},
                        children: [
                            { id: 'option:one', label: 'One', meta: {} },
                            { id: 'option:two', label: 'Two', meta: {} },
                        ],
                    },
                ],
            },
            { id: 'field:b', type: 'text', label: 'B', bind_id: 'filter:a', meta: {} },
        ],
        order_for_tags: { 'filter:a': ['field:a', 'field:b'] },
        includes_for_buttons: {},
        excludes_for_buttons: {},
        option_effects_for_buttons: {},
        value_effects_for_triggers: {},
        fallbacks: null,
        notices: [],
        meta: {},
    };
}

describe('canonical layer reorder commands', () => {
    it('reorders filters only among siblings', () => {
        const next = reorderCanonicalFilter(fixture(), 'filter:a:two', 0);
        expect(next.filters.map((filter) => filter.id)).toEqual([
            'filter:a',
            'filter:b',
            'filter:a:two',
            'filter:a:one',
        ]);
    });

    it('reorders nested options without flattening their tree', () => {
        const next = reorderCanonicalOption(fixture(), 'option:two', 0);
        expect(next.fields[0]?.options?.[0]?.children?.map((option) => option.id)).toEqual([
            'option:two',
            'option:one',
        ]);
        expect(next.fields[0]?.options?.map((option) => option.id)).toEqual(['option:parent']);
    });

    it('updates canonical contextual field order', () => {
        const next = reorderCanonicalFieldForFilter(
            fixture(),
            'filter:a',
            'field:b',
            ['field:a', 'field:b'],
            0,
        );
        expect(next.order_for_tags['filter:a']).toEqual(['field:b', 'field:a']);
    });

    it('can be committed through the canonical Editor as one graph refresh', () => {
        const api = new CanvasAPI(new ProductBuilder(fixture()));
        let graphUpdates = 0;
        const unsubscribe = api.on('graph:update', () => {
            graphUpdates += 1;
        });
        api.editor.replace(reorderCanonicalOption(api.editor.definition, 'option:two', 0), 'Reorder option');

        expect(api.editor.definition.fields[0]?.options?.[0]?.children?.[0]?.id).toBe('option:two');
        expect(graphUpdates).toBe(1);
        unsubscribe();
        api.dispose();
    });
});
