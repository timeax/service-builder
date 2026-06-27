import { describe, expect, it } from 'vitest';
import {
    countOptions,
    filterFieldOptionsById,
    findOptionLocation,
    mapOptionsById,
    moveOptionWithinSiblings,
    optionBreadcrumb,
    walkFieldOptions,
} from './option-helpers.ts';

const field = {
    id: 'f:package',
    label: 'Package',
    options: [
        {
            id: 'o:premium',
            label: 'Premium',
            children: [
                { id: 'o:premium-fast', label: 'Fast delivery', service_id: 101 },
                { id: 'o:premium-safe', label: 'Safer delivery' },
            ],
        },
        { id: 'o:basic', label: 'Basic' },
    ],
} as any;

describe('option helpers', () => {
    it('walks, counts, and labels nested options by raw option id', () => {
        expect(countOptions(field)).toBe(4);
        expect(walkFieldOptions(field).map((visit) => [visit.optionId, visit.depth, visit.parentId])).toEqual([
            ['o:premium', 0, undefined],
            ['o:premium-fast', 1, 'o:premium'],
            ['o:premium-safe', 1, 'o:premium'],
            ['o:basic', 0, undefined],
        ]);
        expect(optionBreadcrumb(field, 'o:premium-fast')).toBe('Premium / Fast delivery');
    });

    it('updates only the matched nested option', () => {
        const next = mapOptionsById(field.options, 'o:premium-fast', (option) => ({ ...option, label: 'Express' }));

        expect(next?.[0].children?.[0].label).toBe('Express');
        expect(next?.[0].children?.[1].label).toBe('Safer delivery');
        expect(next?.[1]).toBe(field.options[1]);
    });

    it('finds and moves nested options within their sibling children list', () => {
        const fields = [JSON.parse(JSON.stringify(field))];
        const location = findOptionLocation(fields, 'o:premium-safe');

        expect(location?.field.id).toBe('f:package');
        expect(location?.parentOption?.id).toBe('o:premium');
        expect(location?.index).toBe(1);

        expect(moveOptionWithinSiblings(fields, 'o:premium-safe', 0)).toBe(true);
        expect(fields[0].options[0].children.map((option: any) => option.id)).toEqual(['o:premium-safe', 'o:premium-fast']);
        expect(fields[0].options.map((option: any) => option.id)).toEqual(['o:premium', 'o:basic']);
    });

    it('filters nested options while keeping parent structure for allowed descendants', () => {
        const filtered = filterFieldOptionsById(field.options, new Set(['o:premium-fast']));

        expect(filtered).toEqual([
            {
                id: 'o:premium',
                label: 'Premium',
                children: [{ id: 'o:premium-fast', label: 'Fast delivery', service_id: 101 }],
            },
        ]);
    });
});
