// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { definition } from '../../backend/canonical/seed';
import { buildCatalogContext } from './catalog-context-model';

describe('canonical catalog context', () => {
    it('projects visible trigger choices and used service bindings through Core', () => {
        const snapshot = buildCatalogContext(definition, { filterId: 'filter:platform', triggerIds: ['option:instagram-followers'] });
        expect(snapshot.filters.map((filter) => filter.label)).toEqual(['Platform', 'Instagram']);
        expect(snapshot.filterLabel).toBe('Platform');
        expect(snapshot.buttonGroups).toEqual([
            { id: 'field:service', label: 'Service', options: [{ id: 'option:instagram-followers', label: 'Instagram followers - fast' }] },
        ]);
        expect(snapshot.usedServiceIds).toEqual(['10147']);
    });

    it('does not invent context for an unknown filter', () => {
        expect(buildCatalogContext(definition, { filterId: 'missing', triggerIds: [] })).toMatchObject({
            filterLabel: null,
            buttonGroups: [],
            usedServiceIds: [],
        });
    });

});
