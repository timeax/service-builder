import { act, renderHook } from '@testing-library/react';
import { useDropHandling, useNodeActions } from './hooks.ts';

const setFieldOptionsShown = vi.fn();
const isFieldOptionsShown = vi.fn(() => false);
const placeNode = vi.fn();
const placeOption = vi.fn();
const addFieldFromDescriptor = vi.fn((_: any, payload: any) => payload.id);
const connect = vi.fn();
const setService = vi.fn();
const patchProps = vi.fn();
const transact = vi.fn((_: string, work: () => void) => work());
const currentTag = vi.fn(() => 't:root');
const visibleGroup = vi.fn(() => ({ kind: 'single', group: { tagId: 't:root', fieldIds: ['f:first', 'f:second'] } }));
const visibleFields = vi.fn(() => ['f:first', 'f:second']);
const select = vi.fn();
const setActive = vi.fn();
const emit = vi.fn();

let mutableProps: any;
let nodeLookup: Record<string, any>;
let templatesData: any[];

vi.mock('@/panels/right/partials/properties/components/node-capabilities.ts', () => ({
    getNodePropertyCapabilities: vi.fn(() => ({
        service: { canEdit: true },
        triggerMappings: { canEdit: true },
    })),
}));

vi.mock('@/workspace/authorization.ts', () => ({
    deriveWorkspaceAuthorization: vi.fn(() => ({
        canEditBranchContent: true,
        canWriteTemplates: true,
    })),
    getAuthorizationDecision: vi.fn(() => ({ ok: true })),
}));

vi.mock('@timeax/digital-service-engine/react', () => ({
    resolveInputDescriptor: () => undefined,
    useInputs: () => ({
        registry: {
            _store: new Map(),
            get: () => undefined,
            register: vi.fn(),
            unregister: vi.fn(),
            registerMany: vi.fn(),
        },
    }),
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        api: {
            isFieldOptionsShown,
            setFieldOptionsShown,
            emit,
            editor: {
                addFieldFromDescriptor,
                connect,
                setService,
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
            select,
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
        setActive,
    }),
    useWorkspace: () => ({
        createTemplate: vi.fn(),
        refresh: { templates: vi.fn() },
        branches: { currentId: null },
        templates: { data: templatesData },
    }),
}));

describe('useNodeActions option node visibility', () => {
    beforeEach(() => {
        setFieldOptionsShown.mockReset();
        isFieldOptionsShown.mockReset();
        isFieldOptionsShown.mockReturnValue(false);
        placeNode.mockReset();
        placeOption.mockReset();
        addFieldFromDescriptor.mockReset();
        connect.mockReset();
        setService.mockReset();
        patchProps.mockReset();
        select.mockReset();
        setActive.mockReset();
        emit.mockReset();
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
        templatesData = [];
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

describe('useDropHandling template option id regeneration', () => {
    beforeEach(() => {
        addFieldFromDescriptor.mockReset();
        connect.mockReset();
        patchProps.mockReset();
        mutableProps = {
            fields: [],
            includes_for_buttons: {},
            excludes_for_buttons: {},
        };
        patchProps.mockImplementation((mutator: (props: any) => void) => mutator(mutableProps));
        templatesData = [];
        nodeLookup = {
            't:root': { id: 't:root', kind: 'tag', raw: { label: 'Root' } },
            'f:receiver': { id: 'f:receiver', kind: 'field', raw: { label: 'Receiver', type: 'select', button: true } },
        };
    });

    function buildTemplateIntent(receiver: { nodeId: string; nodeKind: 'tag' | 'field' | 'option' }) {
        return {
            source: { kind: 'asset_template', asset: { id: 'tpl:1', name: 'Template A', kind: 'select' } },
            receiver: {
                nodeId: receiver.nodeId,
                nodeKind: receiver.nodeKind,
                surface: 'canvas',
                clientX: 100,
                clientY: 200,
            },
            pointer: { x: 100, y: 200 },
            surface: 'canvas',
        } as any;
    }

    it('regenerates option ids for template options and preserves option data', async () => {
        templatesData = [
            {
                id: 'tpl:1',
                definition: {
                    label: 'Billing plan',
                    type: 'select',
                    options: [
                        { id: 'o:legacy:1', label: 'Monthly', value: 'monthly', rank: 1 },
                        { id: 'o:legacy:2', label: 'Yearly', value: 'yearly', rank: 2 },
                    ],
                },
            },
        ];
        const focusNode = vi.fn();
        const { result } = renderHook(() => useDropHandling(vi.fn(), vi.fn(), focusNode));

        const actions = result.current.actionsForIntent(buildTemplateIntent({ nodeId: 't:root', nodeKind: 'tag' }));
        await actions.find((action) => action.id === 'bind')?.execute({} as any);

        expect(addFieldFromDescriptor).toHaveBeenCalledTimes(1);
        const payload = addFieldFromDescriptor.mock.calls[0][1];
        expect(payload.id).toMatch(/^f:asset:/);
        expect(payload.options).toHaveLength(2);
        expect(payload.options[0]).toEqual(expect.objectContaining({ label: 'Monthly', value: 'monthly', rank: 1 }));
        expect(payload.options[1]).toEqual(expect.objectContaining({ label: 'Yearly', value: 'yearly', rank: 2 }));
        expect(payload.options[0].id).toMatch(/^o:/);
        expect(payload.options[1].id).toMatch(/^o:/);
        expect(payload.options[0].id).not.toBe('o:legacy:1');
        expect(payload.options[1].id).not.toBe('o:legacy:2');
        expect(new Set(payload.options.map((option: any) => option.id)).size).toBe(2);
    });

    it('adds generated option ids when template options were saved without ids', async () => {
        templatesData = [
            {
                id: 'tpl:1',
                definition: {
                    label: 'Shipping',
                    type: 'select',
                    options: [
                        { label: 'Standard', value: 'std' },
                        { label: 'Express', value: 'exp' },
                    ],
                },
            },
        ];
        const { result } = renderHook(() => useDropHandling(vi.fn(), vi.fn(), vi.fn()));

        const actions = result.current.actionsForIntent(buildTemplateIntent({ nodeId: 't:root', nodeKind: 'tag' }));
        await actions.find((action) => action.id === 'bind')?.execute({} as any);

        const payload = addFieldFromDescriptor.mock.calls[0][1];
        expect(payload.options).toHaveLength(2);
        expect(payload.options.every((option: any) => typeof option.id === 'string' && option.id.startsWith('o:'))).toBe(true);
    });

    it('leaves options undefined when template has no options array', async () => {
        templatesData = [{ id: 'tpl:1', definition: { label: 'Plain text', type: 'text' } }];
        const { result } = renderHook(() => useDropHandling(vi.fn(), vi.fn(), vi.fn()));

        const actions = result.current.actionsForIntent(buildTemplateIntent({ nodeId: 't:root', nodeKind: 'tag' }));
        await actions.find((action) => action.id === 'bind')?.execute({} as any);

        const payload = addFieldFromDescriptor.mock.calls[0][1];
        expect(payload.options).toBeUndefined();
    });

    it('supports structured single templates when dropping', async () => {
        templatesData = [
            {
                id: 'tpl:1',
                definition: {
                    templateType: 'field',
                    mode: 'single',
                    version: 1,
                    field: {
                        label: 'Structured field',
                        type: 'select',
                        options: [{ label: 'A', value: 'a' }],
                    },
                },
            },
        ];
        const { result } = renderHook(() => useDropHandling(vi.fn(), vi.fn(), vi.fn()));
        const actions = result.current.actionsForIntent(buildTemplateIntent({ nodeId: 't:root', nodeKind: 'tag' }));
        await actions.find((action) => action.id === 'bind')?.execute({} as any);
        expect(addFieldFromDescriptor).toHaveBeenCalledTimes(1);
        expect(addFieldFromDescriptor.mock.calls[0][1].label).toBe('Structured field');
        expect(addFieldFromDescriptor.mock.calls[0][1].options[0].id).toMatch(/^o:/);
    });

    it('drops group templates with remapped ids and rewritten relations', async () => {
        templatesData = [
            {
                id: 'tpl:1',
                definition: {
                    templateType: 'field',
                    mode: 'group',
                    version: 1,
                    label: 'Dripfeed group',
                    rootOriginalId: 'f:dripfeed',
                    fields: [
                        { originalId: 'f:dripfeed', field: { label: 'Dripfeed', type: 'button' } },
                        { originalId: 'f:runs', field: { label: 'Runs', type: 'text' } },
                        { originalId: 'f:interval', field: { label: 'Interval', type: 'text' } },
                    ],
                    relations: {
                        includes_for_buttons: {
                            'f:dripfeed': ['f:runs', 'f:interval'],
                        },
                    },
                },
            },
        ];
        const { result } = renderHook(() => useDropHandling(vi.fn(), vi.fn(), vi.fn()));
        const actions = result.current.actionsForIntent(buildTemplateIntent({ nodeId: 't:root', nodeKind: 'tag' }));
        await actions.find((action) => action.id === 'bind')?.execute({} as any);
        expect(addFieldFromDescriptor).toHaveBeenCalledTimes(3);
        const createdIds = addFieldFromDescriptor.mock.calls.map((call) => call[1].id);
        expect(new Set(createdIds).size).toBe(3);
        expect(addFieldFromDescriptor.mock.calls[0][1].bind_id).toBe('t:root');
        expect(addFieldFromDescriptor.mock.calls[1][1].bind_id).toBeUndefined();
        expect(addFieldFromDescriptor.mock.calls[2][1].bind_id).toBeUndefined();
        const relation = mutableProps.includes_for_buttons;
        const keys = Object.keys(relation);
        expect(keys).toHaveLength(1);
        expect(createdIds).toContain(keys[0]);
        const targets = relation[keys[0]];
        expect(targets).toHaveLength(2);
        expect(createdIds).toContain(targets[0]);
        expect(createdIds).toContain(targets[1]);
    });

    it('keeps include and exclude drop flows functional for template assets', async () => {
        templatesData = [{ id: 'tpl:1', definition: { label: 'Choice', type: 'select', options: [{ label: 'A', value: 'a' }] } }];
        const focusNode = vi.fn();
        const { result } = renderHook(() => useDropHandling(vi.fn(), vi.fn(), focusNode));

        const actions = result.current.actionsForIntent(buildTemplateIntent({ nodeId: 'f:receiver', nodeKind: 'field' }));
        const includeAction = actions.find((action) => action.id === 'include');
        const excludeAction = actions.find((action) => action.id === 'exclude');

        await includeAction?.execute({} as any);
        await excludeAction?.execute({} as any);

        expect(addFieldFromDescriptor).toHaveBeenCalledTimes(2);
        expect(connect).toHaveBeenCalledTimes(2);
        expect(connect).toHaveBeenNthCalledWith(1, 'include', 'f:receiver', expect.stringMatching(/^f:asset:/));
        expect(connect).toHaveBeenNthCalledWith(2, 'exclude', 'f:receiver', expect.stringMatching(/^f:asset:/));
        expect(focusNode).toHaveBeenCalledTimes(2);
    });
});
