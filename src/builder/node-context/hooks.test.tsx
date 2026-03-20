import { act, renderHook } from '@testing-library/react';
import { useNodeActions } from './hooks.ts';

const setFieldOptionsShown = vi.fn();
const isFieldOptionsShown = vi.fn(() => false);

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        api: {
            isFieldOptionsShown,
            setFieldOptionsShown,
            emit: vi.fn(),
            editor: {},
        },
        selector: {
            getNode: vi.fn(() => ({
                id: 'f:amount',
                kind: 'field',
                raw: {
                    label: 'Amount',
                    type: 'text',
                },
            })),
        },
        setActive: vi.fn(),
    }),
    useWorkspace: () => ({
        createTemplate: vi.fn(),
        refresh: { templates: vi.fn() },
        branches: { currentId: null },
        templates: { data: [] },
    }),
}));

describe('useNodeActions option node visibility', () => {
    beforeEach(() => {
        setFieldOptionsShown.mockReset();
        isFieldOptionsShown.mockReset();
        isFieldOptionsShown.mockReturnValue(false);
    });

    it('toggles field option node visibility through canvas api', () => {
        const setTarget = vi.fn();
        const { result } = renderHook(() =>
            useNodeActions(
                { nodeId: 'f:amount', nodeKind: 'field', surface: 'canvas' },
                setTarget,
                vi.fn(),
                vi.fn(),
                vi.fn(),
                vi.fn(),
            ),
        );

        act(() => {
            result.current.handleToggleFieldOptions();
        });

        expect(isFieldOptionsShown).toHaveBeenCalledWith('f:amount');
        expect(setFieldOptionsShown).toHaveBeenCalledWith('f:amount', true);
        expect(setTarget).toHaveBeenCalledWith(null);
    });
});
