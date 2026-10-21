// SPDX-License-Identifier: GPL-3.0-only
import { definition, services } from '../../backend/canonical/seed';
import { describe, expect, it } from 'vitest';
import { buildCanonicalCanvasServiceContext } from './canonical-service-context';

describe('canonical canvas service context', () => {
    it('shows only services bound to visible fields and options in the active tag', () => {
        const context = buildCanonicalCanvasServiceContext(definition, services, 'filter:platform', ['option:instagram-followers']);
        expect(context.selectedTagLabel).toBe('Platform');
        expect(context.selectedButtonsCount).toBe(1);
        expect(context.services.map((service) => service.id)).toEqual(['10147']);
        expect(context.services[0]?.rateLabel).toBe('Rate 0.8375');
    });

    it('retains the card empty state when no filter context is available', () => {
        expect(buildCanonicalCanvasServiceContext(definition, services, undefined, [])).toEqual({
            selectedTagLabel: 'No tag selected', selectedButtonsCount: 0, services: [],
        });
    });

    it('reports availability honestly without calculating final prices or charges', () => {
        const unavailable = { ...services.find((service) => String(service.id) === '10147')!, state: 'disabled' as const, state_reason: 'Temporarily unavailable' };
        const context = buildCanonicalCanvasServiceContext(definition, [unavailable], 'filter:platform', []);
        expect(context.services[0]).toMatchObject({
            statusLabel: 'Unavailable', reasonLabels: ['Temporarily unavailable'], rateLabel: 'Rate 0.8375',
        });
    });
});
