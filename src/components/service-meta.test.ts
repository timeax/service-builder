import { describe, expect, it } from 'vitest';
import { flattenServiceMeta } from './service-meta.ts';

describe('flattenServiceMeta', () => {
    it('flattens nested keys and strips meta prefix', () => {
        const rows = flattenServiceMeta({
            raw: {
                key: 'value',
            },
            mode: 'fast',
        });

        expect(rows).toEqual([
            { key: 'raw.key', value: 'value' },
            { key: 'mode', value: 'fast' },
        ]);
    });

    it('includes primitive leaves and skips object/array containers', () => {
        const rows = flattenServiceMeta({
            a: 1,
            b: true,
            c: { deep: 'ok' },
            d: ['x', 'y'],
            e: null,
        });

        expect(rows).toEqual([
            { key: 'a', value: '1' },
            { key: 'b', value: 'true' },
            { key: 'c.deep', value: 'ok' },
        ]);
    });

    it('handles empty and invalid values', () => {
        expect(flattenServiceMeta(undefined)).toEqual([]);
        expect(flattenServiceMeta(null)).toEqual([]);
        expect(flattenServiceMeta('meta')).toEqual([]);
        expect(flattenServiceMeta([])).toEqual([]);
    });
});

