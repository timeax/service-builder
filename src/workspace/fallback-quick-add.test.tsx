import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FallbackQuickAddProvider, useFallbackQuickAdd } from './fallback-quick-add.tsx';

const mockUseCanvas = vi.fn();
const mockUseWorkspace = vi.fn();

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => mockUseCanvas(),
    useWorkspace: () => mockUseWorkspace(),
}));

function Trigger() {
    const quickAdd = useFallbackQuickAdd();

    return (
        <button
            type="button"
            onClick={() =>
                quickAdd.openForNode({
                    nodeId: 'f:amount',
                    nodeKind: 'field',
                    nodeLabel: 'Amount',
                    serviceId: 101,
                    tagId: 't:root',
                })
            }
        >
            Open quick add
        </button>
    );
}

describe('FallbackQuickAddProvider', () => {
    beforeEach(() => {
        mockUseCanvas.mockReset();
        mockUseWorkspace.mockReset();
    });

    it('opens the quick-add overlay for a node launch', async () => {
        mockUseCanvas.mockReturnValue({
            props: {
                filters: [{ id: 't:root', label: 'Root' }],
                fields: [{ id: 'f:amount', label: 'Amount', type: 'text', bind_id: 't:root', service_id: 101 }],
                fallbacks: {},
                fallbackSettings: { mode: 'strict' },
            },
            api: {
                builder: {
                    getOptions: () => ({}),
                    getProps: () => ({
                        filters: [{ id: 't:root', label: 'Root' }],
                        fields: [{ id: 'f:amount', label: 'Amount', type: 'text', bind_id: 't:root', service_id: 101 }],
                        fallbacks: {},
                        fallbackSettings: { mode: 'strict' },
                    }),
                },
                editor: {
                    transact: vi.fn(),
                    replaceProps: vi.fn(),
                },
            },
        });
        mockUseWorkspace.mockReturnValue({
            services: {
                data: {
                    101: { id: 101, name: 'Primary service' },
                    202: { id: 202, name: 'Fallback service' },
                },
            },
        });

        render(
            <FallbackQuickAddProvider>
                <Trigger />
            </FallbackQuickAddProvider>,
        );

        fireEvent.click(screen.getByText('Open quick add'));

        expect(await screen.findByText('Add fallbacks for Amount')).toBeInTheDocument();
    });
});
