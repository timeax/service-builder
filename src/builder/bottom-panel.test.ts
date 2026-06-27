import { describe, expect, it } from 'vitest';
import { buildServiceSummaries } from './bottom-panel.ts';

describe('buildServiceSummaries nested options', () => {
    it('includes services attached to nested options with breadcrumb labels', () => {
        const summaries = buildServiceSummaries(
            {
                activeId: 'o:premium-fast',
                selectionInfo: { ids: [] },
                api: {
                    getServiceProps: () => ({
                        filters: [],
                        fields: [
                            {
                                id: 'f:package',
                                label: 'Package',
                                options: [
                                    {
                                        id: 'o:premium',
                                        label: 'Premium',
                                        children: [{ id: 'o:premium-fast', label: 'Fast', service_id: 101 }],
                                    },
                                ],
                            },
                        ],
                    }),
                },
            } as any,
            {
                services: {
                    data: {
                        101: { id: 101, name: 'Premium Fast', flags: {} },
                    },
                },
            } as any,
        );

        expect(summaries.activeServices).toEqual([
            expect.objectContaining({
                id: 101,
                attachmentCount: 1,
                attachedNodeIds: ['o:premium-fast'],
                attachedNodeLabels: ['Premium / Fast'],
                active: true,
            }),
        ]);
    });
});
