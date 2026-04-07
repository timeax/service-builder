import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEligibleFallbackCandidates, collectActiveServiceIds, getBoundFallbackIds, mergeFallbackSelections } from './fallback-quick-add-helpers.ts';

const getEligibleFallbacks = vi.fn(({ exclude = [] }: { exclude?: Array<number | string> }) => {
    const blocked = new Set(exclude.map((id) => String(id)));
    return [201, 202, 202, 203, 301].filter((id) => !blocked.has(String(id)));
});
const getAssignedServiceIds = vi.fn(({ props }: { props?: any }) => {
    const seen = new Set<string>();
    const ids: Array<number | string> = [];
    const append = (value: number | string | undefined | null) => {
        if (value == null) return;
        const key = String(value);
        if (seen.has(key)) return;
        seen.add(key);
        ids.push(value);
    };

    for (const tag of props?.filters ?? []) append(tag.service_id);
    for (const field of props?.fields ?? []) {
        append(field.service_id);
        for (const option of field.options ?? []) append(option.service_id);
    }

    return ids;
});

vi.mock('@timeax/digital-service-engine/core', () => ({
    getAssignedServiceIds: (params: any) => getAssignedServiceIds(params),
    getEligibleFallbacks: (params: any) => getEligibleFallbacks(params),
}));

describe('fallback quick add helpers', () => {
    beforeEach(() => {
        getEligibleFallbacks.mockClear();
        getAssignedServiceIds.mockClear();
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
                source: 'all_services',
                exclude: [201, 101, 301],
                unique: true,
            }),
        );
        expect(getAssignedServiceIds).toHaveBeenCalledWith(
            expect.objectContaining({
                props: expect.any(Object),
                snapshot: undefined,
            }),
        );
        expect(candidates).toEqual([202, 203]);
    });

    it('discovers service-scoped candidates even when no globals are registered yet', () => {
        const candidates = buildEligibleFallbackCandidates({
            launch: { source: 'active-service', primaryServiceId: 101 },
            services: {
                101: { id: 101, name: 'Primary' },
                202: { id: 202, name: 'Candidate A' },
                203: { id: 203, name: 'Candidate B' },
                301: { id: 301, name: 'Attached elsewhere' },
            } as any,
            fallbacks: {},
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
                source: 'all_services',
                exclude: [301, 101],
            }),
        );
        expect(candidates).toEqual([201, 202, 203]);
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
