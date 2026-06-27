import { describe, expect, it } from 'vitest';
import { sanitizeField, withFreshOptionIds } from './template-utils.ts';

describe('template option utilities', () => {
    it('sanitizes nested option ids and service ids', () => {
        const sanitized = sanitizeField({
            id: 'f:legacy',
            label: 'Package',
            options: [
                {
                    id: 'o:parent',
                    label: 'Premium',
                    service_id: 101,
                    children: [{ id: 'o:child', label: 'Fast', service_id: 202 }],
                },
            ],
        });

        expect(sanitized).toEqual({
            label: 'Package',
            options: [
                {
                    label: 'Premium',
                    children: [{ label: 'Fast' }],
                },
            ],
        });
    });

    it('regenerates ids for nested options', () => {
        const next = withFreshOptionIds({
            label: 'Package',
            options: [
                {
                    id: 'o:parent',
                    label: 'Premium',
                    children: [{ id: 'o:child', label: 'Fast' }],
                },
            ],
        }) as any;

        expect(next.options[0].id).toMatch(/^o:/);
        expect(next.options[0].id).not.toBe('o:parent');
        expect(next.options[0].children[0].id).toMatch(/^o:/);
        expect(next.options[0].children[0].id).not.toBe('o:child');
        expect(next.options[0].id).not.toBe(next.options[0].children[0].id);
    });
});
