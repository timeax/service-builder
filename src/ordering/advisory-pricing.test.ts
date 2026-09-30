// SPDX-License-Identifier: GPL-3.0-only
import type { HandlerService } from '@elqora/dgp-spec';
import { describe, expect, it } from 'vitest';
import { primaryServiceAdvisoryAmounts } from './advisory-pricing';

const services: HandlerService[] = [
    { id: 'primary', name: 'Primary', description: null, category: null, rate: 2, min: 1, max: 1000, capabilities: {}, meta: {}, state: 'enabled', state_reason: null },
    { id: 'secondary', name: 'Secondary', description: null, category: null, rate: 3, min: 1, max: 1000, capabilities: {}, meta: {}, state: 'enabled', state_reason: null },
];

describe('host advisory service pricing', () => {
    it('scales only the primary service and retains explicit zero amounts for alternatives', () => {
        expect(primaryServiceAdvisoryAmounts({ quantity: 100, service_ids: ['secondary', 'primary'], services }))
            .toEqual({ secondary: 300, primary: 0 });
        expect(primaryServiceAdvisoryAmounts({ quantity: 250, service_ids: ['secondary', 'primary'], services }))
            .toEqual({ secondary: 750, primary: 0 });
    });

    it('preserves the existing empty and missing-rate fallback', () => {
        expect(primaryServiceAdvisoryAmounts({ quantity: 100, service_ids: [], services })).toEqual({});
        expect(primaryServiceAdvisoryAmounts({ quantity: 100, service_ids: ['unknown'], services })).toEqual({ unknown: 0 });
    });
});
