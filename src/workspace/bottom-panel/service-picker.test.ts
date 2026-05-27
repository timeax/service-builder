import { describe, expect, it } from 'vitest';
import {
    createDefaultServicePickerFilters,
    filterServicePickerServices,
    resolveServicePickerSourceDefault,
} from './service-picker.ts';

const services = [
    {
        id: 101,
        name: 'Alpha Service',
        category: 'Payments',
        flags: ['safe'],
        attachmentCount: 0,
        attachedNodeIds: [],
        attachedNodeLabels: [],
        active: false,
    },
    {
        id: 202,
        name: 'Beta Service',
        category: 'Routing',
        flags: ['fast'],
        attachmentCount: 0,
        attachedNodeIds: [],
        attachedNodeLabels: [],
        active: false,
    },
] as any;

const serviceMap = {
    101: { id: 101, name: 'Alpha Service', meta: { team: 'a' } },
    202: { id: 202, name: 'Beta Service', meta: { team: 'b' } },
} as any;

describe('service-picker source defaults', () => {
    it('defaults to parent for child groups when parent has assigned services', () => {
        expect(
            resolveServicePickerSourceDefault({
                selectedGroupId: 'child',
                parentGroupId: 'parent',
                parentServiceIds: new Set(['101']),
            }),
        ).toBe('parent');
    });

    it('defaults to all for child groups when parent has no assigned services', () => {
        expect(
            resolveServicePickerSourceDefault({
                selectedGroupId: 'child',
                parentGroupId: 'parent',
                parentServiceIds: new Set(),
            }),
        ).toBe('all');
    });

    it('defaults to all for root groups', () => {
        expect(
            resolveServicePickerSourceDefault({
                selectedGroupId: 'root',
                parentGroupId: null,
                parentServiceIds: new Set(['101']),
            }),
        ).toBe('all');
    });
});

describe('service-picker source filtering', () => {
    it('filters to parent services when source is parent', () => {
        const filters = createDefaultServicePickerFilters();
        filters.source = 'parent';
        const result = filterServicePickerServices({
            services,
            serviceMap,
            filters,
            parentServiceIds: new Set(['101']),
        });
        expect(result.map((item) => String(item.id))).toEqual(['101']);
    });

    it('uses all services when source is all', () => {
        const filters = createDefaultServicePickerFilters();
        filters.source = 'all';
        const result = filterServicePickerServices({
            services,
            serviceMap,
            filters,
            parentServiceIds: new Set(['101']),
        });
        expect(result.map((item) => String(item.id))).toEqual(['101', '202']);
    });

    it('applies existing filters after source filtering', () => {
        const filters = createDefaultServicePickerFilters();
        filters.source = 'parent';
        filters.query = 'beta';
        const result = filterServicePickerServices({
            services,
            serviceMap,
            filters,
            parentServiceIds: new Set(['101']),
        });
        expect(result).toHaveLength(0);
    });
});
