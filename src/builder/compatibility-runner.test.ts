import { describe, expect, it, vi } from 'vitest';
import { areServiceContextStatesEqual, createCompatibilityCacheKey, runCompatibilityChecksIncremental } from './compatibility-runner.ts';

describe('compatibility-runner', () => {
    it('reuses cache entries and only computes missing ids', async () => {
        const filter = vi.fn((ids: Array<string | number>) => ids.map((id) => ({ id, ok: true })));
        const cache = new Map<string, { id: string | number; ok: boolean }>();
        cache.set('k|101', { id: 101, ok: true });

        const checks = await runCompatibilityChecksIncremental({
            editor: { filterServicesForVisibleGroup: filter as any },
            candidateIds: [101, 202, 303],
            args: {
                tagId: 't:1',
                selectedButtons: [],
                usedServiceIds: [],
                effectiveConstraints: {},
                policies: [],
                rateContext: { mode: 'context' },
            },
            cache,
            cacheKey: 'k',
            chunkSize: 100,
        });

        expect(filter).toHaveBeenCalledWith([202, 303], expect.any(Object));
        expect(checks.map((item) => String(item.id))).toEqual(['101', '202', '303']);
    });

    it('stops work when aborted', async () => {
        const filter = vi.fn((ids: Array<string | number>) => ids.map((id) => ({ id, ok: true })));
        let aborted = false;

        const promise = runCompatibilityChecksIncremental({
            editor: { filterServicesForVisibleGroup: filter as any },
            candidateIds: [1, 2, 3, 4],
            args: {
                tagId: 't:1',
                selectedButtons: [],
                usedServiceIds: [],
                effectiveConstraints: {},
                policies: [],
                rateContext: { mode: 'context' },
            },
            cache: new Map(),
            cacheKey: 'k',
            chunkSize: 1,
            shouldAbort: () => aborted,
        });

        aborted = true;
        const checks = await promise;
        expect(checks).toEqual([]);
    });

    it('builds stable keys regardless of button ordering', () => {
        const a = createCompatibilityCacheKey({
            tagId: 't:1',
            selectedButtons: ['b', 'a'],
            usedServiceIds: ['3', '1'],
            policiesKey: 'p',
            rateContextMode: 'context',
            rateContextSource: 'service',
            primaryRate: null,
            primaryServiceId: null,
        });
        const b = createCompatibilityCacheKey({
            tagId: 't:1',
            selectedButtons: ['a', 'b'],
            usedServiceIds: ['1', '3'],
            policiesKey: 'p',
            rateContextMode: 'context',
            rateContextSource: 'service',
            primaryRate: null,
            primaryServiceId: null,
        });
        expect(a).toBe(b);
    });

    it('compares service context states structurally', () => {
        expect(
            areServiceContextStatesEqual(
                { selectedTagId: 't', selectedButtons: ['1', '2'], strictSafety: true, enforcePolicies: true },
                { selectedTagId: 't', selectedButtons: ['2', '1'], strictSafety: true, enforcePolicies: true },
            ),
        ).toBe(true);
        expect(
            areServiceContextStatesEqual(
                { selectedTagId: 't', selectedButtons: ['1'], strictSafety: true, enforcePolicies: true },
                { selectedTagId: 'x', selectedButtons: ['1'], strictSafety: true, enforcePolicies: true },
            ),
        ).toBe(false);
    });
});
