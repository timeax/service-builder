// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { definition } from '../../backend/canonical/seed/definition';
import { services } from '../../backend/canonical/seed/services';
import { buildCanonicalServiceSummaries } from './bottom-panel-model';

describe('canonical bottom panel model', () => {
    it('maps canonical service capabilities and node attachments', () => {
        const result = buildCanonicalServiceSummaries(definition, services, ['option:instagram-followers']);
        const attached = result.activeServices.find((service) => String(service.id) === '10147');
        expect(attached).toMatchObject({ attachmentCount: 1, active: true, attachedNodeIds: ['option:instagram-followers'] });
        expect(attached?.enabledCapabilityIds).toEqual(expect.any(Array));
    });

    it('derives selected-filter compatibility through canonical Core capability resolution', () => {
        const constrained = structuredClone(definition);
        constrained.filters[0]!.capabilities = { refill: true };
        const candidates = services.filter((service) => ['10147', '3456'].includes(String(service.id)));
        const result = buildCanonicalServiceSummaries(constrained, candidates, ['filter:platform']);
        expect(result.allServices.find((service) => String(service.id) === '10147')?.matchesSelectedFilter).toBe(true);
        expect(result.allServices.find((service) => String(service.id) === '3456')?.matchesSelectedFilter).toBe(false);
        expect(result.compatibleServices.map((service) => String(service.id))).toEqual(['10147']);
    });
});
