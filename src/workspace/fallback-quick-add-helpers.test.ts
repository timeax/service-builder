import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEligibleFallbackCandidates, collectActiveServiceIds, getBoundFallbackIds, mergeFallbackSelections } from './fallback-quick-add-helpers.ts';

const getEligibleFallbacks = vi.fn(({ exclude = [] }: { exclude?: Array<number | string> }) => {
    const blocked = new Set(exclude.map((id) => String(id)));
    return [201, 202, 202, 203, 301].filter((id) => !blocked.has(String(id)));
});

vi.mock('@timeax/digital-service-engine/core', () => ({
    getEligibleFallbacks: (params: any) => getEligibleFallbacks(params),
}));

describe('fallback quick add helpers', () => {
    beforeEach(() => {
        getEligibleFallbacks.mockClear();
    });

    it('reads bound ids for a global service scope', () => {
        expect(
            getBoundFallbackIds(
                { source: 'active-service', primaryServiceId: 101 },
                {
                    global: { '101': [201, 202] },
                    nodes: { 'f:amount': [301] },
                },
            ),
        ).toEqual([201, 202]);
    });

    it('collects active service ids across tags, fields, and options', () => {
        expect(
            collectActiveServiceIds({
                filters: [{ id: 't:root', label: 'Root', service_id: 101 }],
                fields: [
                    { id: 'f:amount', label: 'Amount', type: 'text', service_id: 202, options: [{ id: 'o:fast', label: 'Fast', service_id: 303 }] },
                    { id: 'f:plain', label: 'Plain', type: 'text', service_id: 202 },
                ],
            } as any),
        ).toEqual([101, 202, 303]);
    });

    it('passes node scope and excludes primary, bound, active, and duplicate services when building candidates', () => {
        const candidates = buildEligibleFallbackCandidates({
            launch: { source: 'node', primaryServiceId: 101, nodeId: 'f:amount', tagId: 't:root' },
            services: {
                101: { id: 101, name: 'Primary' },
                201: { id: 201, name: 'Bound' },
                202: { id: 202, name: 'A' },
                203: { id: 203, name: 'B' },
                301: { id: 301, name: 'Attached elsewhere' },
            } as any,
            fallbacks: {
                nodes: { 'f:amount': [201] },
            },
            settings: { mode: 'strict' },
            props: {
                filters: [{ id: 't:root', label: 'Root' }],
                fields: [
                    { id: 'f:amount', label: 'Amount', type: 'text', bind_id: 't:root', service_id: 101 },
                    { id: 'f:other', label: 'Other', type: 'text', bind_id: 't:root', service_id: 301 },
                ],
            } as any,
        });

        expect(getEligibleFallbacks).toHaveBeenCalledWith(
            expect.objectContaining({
                primary: 101,
                nodeId: 'f:amount',
                tagId: 't:root',
                exclude: [101, 201, 301],
                unique: true,
            }),
        );
        expect(candidates).toEqual([202, 203]);
    });

    it('excludes active services for service-scoped quick add', () => {
        const candidates = buildEligibleFallbackCandidates({
            launch: { source: 'active-service', primaryServiceId: 101 },
            services: {
                101: { id: 101, name: 'Primary' },
                201: { id: 201, name: 'Bound' },
                202: { id: 202, name: 'Candidate A' },
                203: { id: 203, name: 'Candidate B' },
                301: { id: 301, name: 'Attached elsewhere' },
            } as any,
            fallbacks: {
                global: { '101': [201] },
            },
            settings: { mode: 'strict' },
            props: {
                filters: [{ id: 't:root', label: 'Root', service_id: 301 }],
                fields: [{ id: 'f:amount', label: 'Amount', type: 'text', bind_id: 't:root', service_id: 101 }],
            } as any,
        });

        expect(getEligibleFallbacks).toHaveBeenCalledWith(
            expect.objectContaining({
                primary: 101,
                nodeId: undefined,
                exclude: [101, 201, 301],
            }),
        );
        expect(candidates).toEqual([202, 203]);
    });

    it('merges selected ids into the correct fallback scope without duplicates', () => {
        const next = mergeFallbackSelections({
            launch: { source: 'active-service', primaryServiceId: 101 },
            fallbacks: {
                global: { '101': [201] },
                nodes: { 'f:amount': [301] },
            },
            selectedIds: [201, 202, 203],
        });

        expect(next).toEqual({
            global: { '101': [201, 202, 203] },
            nodes: { 'f:amount': [301] },
        });
    });
});
