import { describe, expect, it } from 'vitest';
import { buildServiceContextSnapshot } from './service-context.ts';

describe('buildServiceContextSnapshot nested options', () => {
    it('lists nested option buttons with raw ids and applies resolved option visibility', async () => {
        const snapshot = await buildServiceContextSnapshot({
            services: {
                101: { id: 101, name: 'Premium service' },
                202: { id: 202, name: 'Fast service' },
                303: { id: 303, name: 'Slow service' },
            } as any,
            state: {
                selectedTagId: 't:root',
                selectedButtons: ['o:premium'],
                strictSafety: true,
                enforcePolicies: true,
            },
            props: {
                schema_version: '1.0',
                filters: [{ id: 't:root', label: 'Root' }],
                fields: [
                    {
                        id: 'f:package',
                        label: 'Package',
                        bind_id: 't:root',
                        options: [
                            {
                                id: 'o:premium',
                                label: 'Premium',
                                children: [{ id: 'o:premium-fast', label: 'Fast child', service_id: 101 }],
                            },
                        ],
                    },
                    {
                        id: 'f:speed',
                        label: 'Speed',
                        bind_id: 't:root',
                        options: [
                            { id: 'o:fast', label: 'Fast', service_id: 202 },
                            { id: 'o:slow', label: 'Slow', service_id: 303 },
                        ],
                    },
                ],
                option_effects_for_buttons: {
                    'o:premium': {
                        'f:speed': {
                            include: ['o:fast'],
                        },
                    },
                },
            } as any,
        });

        expect(snapshot.buttonGroups.find((group) => group.id === 'f:package')?.options).toEqual([
            expect.objectContaining({ id: 'o:premium', label: 'Premium' }),
            expect.objectContaining({ id: 'o:premium-fast', label: 'Premium / Fast child' }),
        ]);
        expect(snapshot.buttonGroups.find((group) => group.id === 'f:speed')?.options).toEqual([
            expect.objectContaining({ id: 'o:fast', label: 'Fast' }),
        ]);
        expect(snapshot.usedServiceIds.sort()).toEqual(['101', '202']);
    });
});
