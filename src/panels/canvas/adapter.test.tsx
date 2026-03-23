import { act, renderHook } from '@testing-library/react';
import { useReactFlowAdapter } from './adapter.ts';

type ListenerMap = Map<string, Array<() => void>>;

function createApiMock(relation: 'bind' | 'include' | 'exclude', overrides?: { state?: any; comments?: any }) {
    const listeners: ListenerMap = new Map();
    const state =
        overrides?.state ??
        ({
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
        } as any);

    const comments = {
        list: () => [],
        get: () => null,
        move: vi.fn(),
        ...(overrides?.comments ?? {}),
    };

    const api = {
        snapshot: vi.fn(() => state),
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
        comments,
        setPositions: vi.fn(),
        setViewport: vi.fn(),
        getSelection: () => Array.from(state.selection ?? []),
        select: vi.fn(),
        selectComments: vi.fn(),
        setHighlighted: vi.fn(),
        editor: {
            connect: vi.fn(),
            disconnect: vi.fn(),
            transact: vi.fn((_: string, fn: () => void) => fn()),
        },
        getEdgeRel: () => relation,
        startWire: vi.fn(),
        cancelWire: vi.fn(),
        commitWire: vi.fn(),
    };

    const emit = (event: string) => {
        for (const cb of listeners.get(event) ?? []) cb();
    };

    return { api: api as any, state, listeners, emit, comments };
}

describe('react flow adapter', () => {
    it('uses current toolbar relation mode for wire start and connect', () => {
        const { api } = createApiMock('exclude');
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
        const { api, emit } = createApiMock('bind', {
            state: {
                graph: {
                    nodes: [{ id: 'a', kind: 'field', label: 'A' }],
                    edges: [],
                },
                positions: {},
                selection: new Set<string>(),
                viewport: { x: 0, y: 0, zoom: 1 },
                highlighted: new Set<string>(),
            },
        });

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
            emit('selection:change');
        });

        expect((result.current.nodes[0].data as any).marker).toBe('v2');
    });

    it('rebuilds rf state immediately when decorators change outside an active drag', () => {
        const { api } = createApiMock('bind');
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

    it('defers subscribed canvas sync while a node drag is active and flushes once on drag end', () => {
        const { api, state, emit } = createApiMock('bind');
        const { result } = renderHook(() => useReactFlowAdapter(api));
        const initialSnapshotCalls = api.snapshot.mock.calls.length;

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 50, y: 75 },
                    dragging: true,
                } as any,
            ]);
        });
        const snapshotCallsAfterDragStart = api.snapshot.mock.calls.length;

        expect(result.current.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 50, y: 75 });

        act(() => {
            state.positions.a = { x: 300, y: 400 };
            emit('state:change');
        });

        expect(api.snapshot.mock.calls.length).toBe(snapshotCallsAfterDragStart);
        expect(result.current.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 50, y: 75 });

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 300, y: 400 },
                    dragging: false,
                } as any,
            ]);
        });

        expect(api.editor.transact).toHaveBeenCalledWith('canvas:move-nodes', expect.any(Function));
        expect(api.setPositions).toHaveBeenLastCalledWith({ a: { x: 300, y: 400 } });
        expect(api.snapshot.mock.calls.length).toBeGreaterThanOrEqual(initialSnapshotCalls + 1);
        expect(result.current.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 300, y: 400 });
    });

    it('defers decorator-driven rebuilds during drag and applies the latest decorator after drag end', () => {
        const { api } = createApiMock('bind');
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

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 40, y: 60 },
                    dragging: true,
                } as any,
            ]);
        });

        const draggedNodeBefore = result.current.nodes[0];
        rerender({ nodeDecorators: secondDecorator });

        expect(result.current.nodes[0]).toBe(draggedNodeBefore);
        expect((result.current.nodes[0].data as any).marker).toBe('v1');

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 40, y: 60 },
                    dragging: false,
                } as any,
            ]);
        });

        expect((result.current.nodes[0].data as any).marker).toBe('v2');
    });

    it('records one layout history transaction for a completed drag gesture', () => {
        const { api } = createApiMock('bind');
        const { result } = renderHook(() => useReactFlowAdapter(api));

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 40, y: 60 },
                    dragging: true,
                } as any,
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 90, y: 120 },
                    dragging: true,
                } as any,
            ]);
        });

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 90, y: 120 },
                    dragging: false,
                } as any,
            ]);
        });

        expect(api.editor.transact).toHaveBeenCalledTimes(1);
        expect(api.editor.transact).toHaveBeenCalledWith('canvas:move-nodes', expect.any(Function));
        expect(api.setPositions).toHaveBeenLastCalledWith({ a: { x: 90, y: 120 } });
    });

    it('skips layout history when a drag ends without a net position change', () => {
        const { api, state } = createApiMock('bind', {
            state: {
                graph: {
                    nodes: [{ id: 'a', kind: 'field', label: 'A' }],
                    edges: [],
                },
                positions: { a: { x: 90, y: 120 } },
                selection: new Set<string>(),
                viewport: { x: 0, y: 0, zoom: 1 },
                highlighted: new Set<string>(),
            },
        });

        const { result } = renderHook(() => useReactFlowAdapter(api));
        api.editor.transact.mockClear();
        api.setPositions.mockClear();
        state.positions.a = { x: 90, y: 120 };

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 90, y: 120 },
                    dragging: true,
                } as any,
            ]);
        });

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 90, y: 120 },
                    dragging: false,
                } as any,
            ]);
        });

        expect(api.editor.transact).not.toHaveBeenCalled();
    });

    it('defers subscribed canvas sync while panning and flushes once on move end', () => {
        const { api, state, emit } = createApiMock('bind');
        const { result } = renderHook(() => useReactFlowAdapter(api));
        const initialSnapshotCalls = api.snapshot.mock.calls.length;

        act(() => {
            result.current.onMoveStart?.({} as any, { x: 0, y: 0, zoom: 1 } as any);
        });

        act(() => {
            state.positions.a = { x: 420, y: 315 };
            emit('state:change');
        });

        expect(api.snapshot.mock.calls.length).toBe(initialSnapshotCalls);

        act(() => {
            result.current.onMoveEnd({} as any, { x: 120, y: 40, zoom: 1.2 });
        });

        expect(api.setViewport).toHaveBeenCalledWith({ x: 120, y: 40, zoom: 1.2 });
        expect(api.snapshot.mock.calls.length).toBe(initialSnapshotCalls + 1);
        expect(result.current.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 420, y: 315 });
    });

    it('keeps selection sync local during drag and reconciles final snapshot selection after drag end', () => {
        const { api, state, emit } = createApiMock('bind');
        const { result } = renderHook(() => useReactFlowAdapter(api));

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 20, y: 25 },
                    dragging: true,
                } as any,
                {
                    id: 'a',
                    type: 'select',
                    selected: true,
                } as any,
            ]);
        });

        expect(result.current.nodes.find((node) => node.id === 'a')?.selected).toBe(true);

        act(() => {
            state.selection = new Set<string>(['b']);
            emit('selection:change');
        });

        expect(result.current.nodes.find((node) => node.id === 'a')?.selected).toBe(true);
        expect(result.current.nodes.find((node) => node.id === 'b')?.selected).toBe(false);

        act(() => {
            result.current.onNodesChange([
                {
                    id: 'a',
                    type: 'position',
                    position: { x: 20, y: 25 },
                    dragging: false,
                } as any,
            ]);
        });

        expect(result.current.nodes.find((node) => node.id === 'a')?.selected).toBe(false);
        expect(result.current.nodes.find((node) => node.id === 'b')?.selected).toBe(true);
    });

    it('moves comment nodes during drag and defers comment resync until drag end', async () => {
        const thread = {
            id: 'thread-1',
            anchor: {
                type: 'node',
                nodeId: 'a',
                offset: { dx: 10, dy: 10 },
            },
            messages: [{ body: 'Hello', isMain: true }],
        };

        const { api, state, emit, comments } = createApiMock('bind', {
            state: {
                graph: {
                    nodes: [{ id: 'a', kind: 'field', label: 'A' }],
                    edges: [],
                },
                positions: { a: { x: 100, y: 120 } },
                selection: new Set<string>(),
                viewport: { x: 0, y: 0, zoom: 1 },
                highlighted: new Set<string>(),
            },
            comments: {
                list: () => [thread],
                get: () => thread,
                move: vi.fn(async (_id: string, nextAnchor: any) => {
                    thread.anchor = nextAnchor;
                }),
            },
        });

        const { result } = renderHook(() => useReactFlowAdapter(api));
        const initialSnapshotCalls = api.snapshot.mock.calls.length;

        await act(async () => {
            await result.current.onNodesChange([
                {
                    id: 'c::thread-1',
                    type: 'position',
                    position: { x: 180, y: 230 },
                    dragging: true,
                } as any,
            ]);
        });

        expect(comments.move).toHaveBeenCalledWith('thread-1', {
            type: 'node',
            nodeId: 'a',
            offset: { dx: 80, dy: 110 },
        });

        act(() => {
            emit('comment:move');
        });

        expect(api.snapshot.mock.calls.length).toBe(initialSnapshotCalls + 1);

        await act(async () => {
            await result.current.onNodesChange([
                {
                    id: 'c::thread-1',
                    type: 'position',
                    position: { x: 180, y: 230 },
                    dragging: false,
                } as any,
            ]);
        });

        expect(api.editor.transact).not.toHaveBeenCalled();
        expect(api.snapshot.mock.calls.length).toBeGreaterThanOrEqual(initialSnapshotCalls + 2);
        expect(result.current.nodes.find((node) => node.id === 'c::thread-1')?.position).toEqual({ x: 180, y: 230 });
    });
});
