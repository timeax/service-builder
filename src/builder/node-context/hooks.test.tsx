import { act, renderHook } from '@testing-library/react';
import { useNodeActions } from './hooks.ts';

const setFieldOptionsShown = vi.fn();
const isFieldOptionsShown = vi.fn(() => false);
const placeNode = vi.fn();
const placeOption = vi.fn();
const patchProps = vi.fn();
const transact = vi.fn((_: string, work: () => void) => work());
const currentTag = vi.fn(() => 't:root');
const visibleGroup = vi.fn(() => ({ kind: 'single', group: { tagId: 't:root', fieldIds: ['f:first', 'f:second'] } }));
const visibleFields = vi.fn(() => ['f:first', 'f:second']);

let mutableProps: any;
let nodeLookup: Record<string, any>;

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        api: {
            isFieldOptionsShown,
            setFieldOptionsShown,
            emit: vi.fn(),
            editor: {
                placeNode,
                placeOption,
                patchProps,
                transact,
            },
            builder: {
                getProps: () => mutableProps,
                visibleFields,
            },
            selection: {
                currentTag,
                visibleGroup,
            },
        },
        selector: {
            getNode: vi.fn((id: string) => nodeLookup[id] ?? ({
                id,
                kind: id.startsWith('o:') ? 'option' : id.startsWith('t:') ? 'tag' : 'field',
                raw: {
                    label: 'Amount',
                    type: 'text',
                },
            })),
        },
        selectionInfo: { optionIds: [], ids: [] },
        props: {},
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
        placeNode.mockReset();
        placeOption.mockReset();
        patchProps.mockReset();
        transact.mockClear();
        patchProps.mockImplementation((mutator: (props: any) => void) => mutator(mutableProps));
        mutableProps = {
            filters: [{ id: 't:root', label: 'Root' }],
            fields: [
                { id: 'f:first', label: 'First', type: 'text' },
                { id: 'f:second', label: 'Second', type: 'text' },
            ],
            order_for_tags: {},
        };
        nodeLookup = {};
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

    it('moves field globally by reordering fields array', () => {
        const setTarget = vi.fn();
        const { result } = renderHook(() =>
            useNodeActions(
                { nodeId: 'f:first', nodeKind: 'field', surface: 'wireframe' },
                setTarget,
                vi.fn(),
                vi.fn(),
                vi.fn(),
                vi.fn(),
            ),
        );

        act(() => {
            result.current.handleMoveDown();
        });

        expect(mutableProps.fields.map((field: any) => field.id)).toEqual(['f:second', 'f:first']);
        expect(setTarget).toHaveBeenCalledWith(null);
    });

    it('moves field in context by placing node inside current tag order', () => {
        mutableProps.order_for_tags = { 't:root': ['f:first', 'f:second'] };
        const setTarget = vi.fn();
        const { result } = renderHook(() =>
            useNodeActions(
                { nodeId: 'f:first', nodeKind: 'field', surface: 'wireframe' },
                setTarget,
                vi.fn(),
                vi.fn(),
                vi.fn(),
                vi.fn(),
            ),
        );

        act(() => {
            result.current.handleMoveDownInContext();
        });

        expect(placeNode).toHaveBeenCalledWith('f:first', {
            scopeTagId: 't:root',
            index: 1,
        });
        expect(setTarget).toHaveBeenCalledWith(null);
    });

    it('exposes quick add only for nodes with service_id', () => {
        nodeLookup['f:first'] = {
            id: 'f:first',
            kind: 'field',
            raw: {
                label: 'First',
                type: 'text',
                service_id: 101,
                bind_id: 't:root',
            },
        };

        const { result } = renderHook(() =>
            useNodeActions(
                { nodeId: 'f:first', nodeKind: 'field', surface: 'canvas' },
                vi.fn(),
                vi.fn(),
                vi.fn(),
                vi.fn(),
                vi.fn(),
            ),
        );

        expect(result.current.canQuickAddFallbacks).toBe(true);
    });

    it('hides quick add for nodes without service_id', () => {
        nodeLookup['f:first'] = {
            id: 'f:first',
            kind: 'field',
            raw: {
                label: 'First',
                type: 'text',
                bind_id: 't:root',
            },
        };

        const { result } = renderHook(() =>
            useNodeActions(
                { nodeId: 'f:first', nodeKind: 'field', surface: 'canvas' },
                vi.fn(),
                vi.fn(),
                vi.fn(),
                vi.fn(),
                vi.fn(),
            ),
        );

        expect(result.current.canQuickAddFallbacks).toBe(false);
    });
});
