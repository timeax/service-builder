import { act, renderHook } from '@testing-library/react';
import { useReactFlowAdapter } from './adapter.ts';

function createApiMock(relation: 'bind' | 'include' | 'exclude') {
    const listeners = new Map<string, Array<() => void>>();
    const api = {
        snapshot: () => ({
            graph: {
                nodes: [
                    { id: 'a', kind: 'field', label: 'A' },
                    { id: 'b', kind: 'field', label: 'B' },
                ],
                edges: [],
            },
            positions: {},
            selection: new Set<string>(),
            viewport: { x: 0, y: 0, zoom: 1 },
            highlighted: new Set<string>(),
        }),
        on: (event: string, cb: () => void) => {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event)!.push(cb);
            return () => {
                const arr = listeners.get(event) ?? [];
                listeners.set(
                    event,
                    arr.filter((item) => item !== cb),
                );
            };
        },
        comments: {
            list: () => [],
            get: () => null,
            move: vi.fn(),
        },
        setPositions: vi.fn(),
        setViewport: vi.fn(),
        getSelection: () => [],
        select: vi.fn(),
        selectComments: vi.fn(),
        setHighlighted: vi.fn(),
        editor: {
            connect: vi.fn(),
            disconnect: vi.fn(),
        },
        getEdgeRel: () => relation,
        startWire: vi.fn(),
        cancelWire: vi.fn(),
        commitWire: vi.fn(),
    };
    return api as any;
}

describe('react flow adapter connection relation mode', () => {
    it('uses current toolbar relation mode for wire start and connect', () => {
        const api = createApiMock('exclude');
        const { result } = renderHook(() => useReactFlowAdapter(api));

        act(() => {
            result.current.onConnectStart({} as any, { nodeId: 'a' } as any);
        });
        expect(api.startWire).toHaveBeenCalledWith('a', 'exclude');

        act(() => {
            result.current.onConnect({ source: 'a', target: 'b' } as any);
        });

        expect(api.editor.connect).toHaveBeenCalledWith('exclude', 'a', 'b');
        expect(api.commitWire).toHaveBeenCalledWith('b');
    });

    it('applies latest decorator refs on selection sync without stale closure lag', () => {
        const listeners = new Map<string, Array<() => void>>();
        const api = {
            snapshot: () => ({
                graph: {
                    nodes: [{ id: 'a', kind: 'field', label: 'A' }],
                    edges: [],
                },
                positions: {},
                selection: new Set<string>(),
                viewport: { x: 0, y: 0, zoom: 1 },
                highlighted: new Set<string>(),
            }),
            on: (event: string, cb: () => void) => {
                if (!listeners.has(event)) listeners.set(event, []);
                listeners.get(event)!.push(cb);
                return () => {
                    const arr = listeners.get(event) ?? [];
                    listeners.set(
                        event,
                        arr.filter((item) => item !== cb),
                    );
                };
            },
            comments: {
                list: () => [],
                get: () => null,
                move: vi.fn(),
            },
            setPositions: vi.fn(),
            setViewport: vi.fn(),
            getSelection: () => [],
            select: vi.fn(),
            selectComments: vi.fn(),
            setHighlighted: vi.fn(),
            editor: {
                connect: vi.fn(),
                disconnect: vi.fn(),
            },
            getEdgeRel: () => 'bind',
            startWire: vi.fn(),
            cancelWire: vi.fn(),
            commitWire: vi.fn(),
        } as any;

        const firstDecorator = vi.fn(() => ({ data: { marker: 'v1' } }));
        const secondDecorator = vi.fn(() => ({ data: { marker: 'v2' } }));
        const { result, rerender } = renderHook(
            ({ nodeDecorators }) =>
                useReactFlowAdapter(api, {
                    nodeDecorators,
                }),
            {
                initialProps: { nodeDecorators: firstDecorator },
            },
        );

        expect((result.current.nodes[0].data as any).marker).toBe('v1');
        rerender({ nodeDecorators: secondDecorator });

        act(() => {
            for (const cb of listeners.get('selection:change') ?? []) cb();
        });

        expect((result.current.nodes[0].data as any).marker).toBe('v2');
    });

    it('rebuilds rf state immediately when decorators change, without waiting for canvas events', () => {
        const api = createApiMock('bind');
        const firstDecorator = vi.fn(() => ({ data: { marker: 'initial' } }));
        const secondDecorator = vi.fn(() => ({ data: { marker: 'updated' } }));

        const { result, rerender } = renderHook(
            ({ nodeDecorators }) =>
                useReactFlowAdapter(api, {
                    nodeDecorators,
                }),
            {
                initialProps: { nodeDecorators: firstDecorator },
            },
        );

        expect((result.current.nodes[0].data as any).marker).toBe('initial');

        rerender({ nodeDecorators: secondDecorator });

        expect((result.current.nodes[0].data as any).marker).toBe('updated');
    });
});
