// SPDX-License-Identifier: GPL-3.0-only
import { ProductBuilder } from '@elqora/dgp-core';
import type { ProductDefinition } from '@elqora/dgp-spec';
import { CanvasAPI } from '@elqora/dgp-workspace';
import { describe, expect, it } from 'vitest';
import { buildFieldLayers, buildFilterLayers } from './presentation';

function largeDefinition(): ProductDefinition {
    return {
        id: 'product:performance',
        name: 'Performance fixture',
        schema_version: '1',
        description: null,
        filters: Array.from({ length: 1_000 }, (_, index) => ({
            id: `filter:${index}`,
            label: `Filter ${index}`,
            bind_id: index % 10 === 0 ? undefined : `filter:${index - (index % 10)}`,
            meta: {},
        })),
        fields: Array.from({ length: 2_000 }, (_, index) => ({
            id: `field:${index}`,
            type: 'select',
            label: `Field ${index}`,
            bind_id: `filter:${Math.floor(index / 2)}`,
            options: Array.from({ length: 4 }, (_, option) => ({
                id: `option:${index}:${option}`,
                label: `Option ${index}:${option}`,
                value: option,
                meta: {},
            })),
            meta: {},
        })),
        order_for_tags: {},
        includes_for_buttons: {},
        excludes_for_buttons: {},
        option_effects_for_buttons: {},
        value_effects_for_triggers: {},
        fallbacks: null,
        notices: [],
        meta: {},
    };
}

describe('canonical Service Builder performance budgets', () => {
    it('projects 1,000 filters and 10,000 field/option rows within one second', () => {
        const definition = largeDefinition();
        const started = performance.now();
        const filters = buildFilterLayers(definition);
        const fields = buildFieldLayers(definition);
        const elapsed = performance.now() - started;

        expect(filters).toHaveLength(100);
        expect(fields).toHaveLength(2_000);
        expect(fields.reduce((count, field) => count + field.children.length, 0)).toBe(8_000);
        expect(elapsed).toBeLessThan(1_000);
    });

    it('applies 1,000 canvas position and selection updates within ten seconds under parallel suite load', () => {
        const definition = largeDefinition();
        const api = new CanvasAPI(new ProductBuilder(definition));
        const started = performance.now();
        for (let index = 0; index < 500; index += 1) {
            api.set_position(`field:${index}`, index, index * 2);
            api.select([`field:${index}`], `field:${index}`);
        }
        const elapsed = performance.now() - started;

        expect(api.get_selection()).toEqual(['field:499']);
        expect(api.snapshot().positions['field:499']).toEqual({ x: 499, y: 998 });
        expect(elapsed).toBeLessThan(10_000);
        api.dispose();
    });
});
