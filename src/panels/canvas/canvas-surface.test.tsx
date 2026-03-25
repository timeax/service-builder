import { render, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { CanvasSurface } from './canvas-surface.tsx';
import { useReactFlowAdapter } from './adapter.ts';

const fitViewSpy = vi.fn();
const reactFlowProps: any[] = [];
const adapterHandlers = {
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onConnect: vi.fn(),
    onConnectStart: vi.fn(),
    onConnectEnd: vi.fn(),
    onMoveStart: vi.fn(),
    onMoveEnd: vi.fn(),
    onSelectionChange: vi.fn(),
    isValidConnection: vi.fn(),
};

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useWorkspace: () => ({
        info: { id: 'workspace-1' },
        branches: { currentId: null },
    }),
}));

vi.mock('@xyflow/react', async () => {
    const React = await import('react');
    return {
        ReactFlow: (props: any) => {
            reactFlowProps.push(props);
            return <div data-testid="react-flow">{props.children}</div>;
        },
        Background: () => <div data-testid="background" />,
        MiniMap: () => <div data-testid="minimap" />,
        ConnectionMode: { Loose: 'Loose' },
        useReactFlow: () => ({ fitView: fitViewSpy }),
        Handle: () => null,
        Position: { Left: 'left', Right: 'right' },
    };
});

vi.mock('./adapter.ts', () => ({
    useReactFlowAdapter: vi.fn(() => ({
        nodes: [{ id: 'a', position: { x: 100, y: 140 }, data: {}, type: 'field' }],
        edges: [],
        ...adapterHandlers,
        snapVector: undefined,
    })),
}));

function createApi(viewport = { x: 0, y: 0, zoom: 1 }) {
    return {
        snapshot: () => ({
            viewport,
            graph: { nodes: [{ id: 'a', kind: 'field', label: 'A' }], edges: [] },
            positions: { a: { x: 100, y: 140 } },
            selection: new Set<string>(),
            highlighted: new Set<string>(),
        }),
    } as any;
}

function renderSurface(api = createApi()) {
    return render(
        <CanvasSurface
            api={api}
            showToolbar={false}
            showBindEdges={true}
            setShowBindEdges={vi.fn()}
            showIncludeEdges={true}
            setShowIncludeEdges={vi.fn()}
            showExcludeEdges={false}
            setShowExcludeEdges={vi.fn()}
            focusCurrentContext={false}
            setFocusCurrentContext={vi.fn()}
        />,
    );
}

describe('CanvasSurface viewport behavior', () => {
    beforeEach(() => {
        reactFlowProps.length = 0;
        fitViewSpy.mockReset();
        Object.values(adapterHandlers).forEach((handler) => handler.mockReset());
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        });
        (useReactFlowAdapter as Mock).mockClear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('passes a default viewport without mounting ReactFlow with live fitView', () => {
        const viewport = { x: 24, y: -16, zoom: 1.25 };
        renderSurface(createApi(viewport));

        const props = reactFlowProps.at(-1);
        expect(props.defaultViewport).toEqual(viewport);
        expect(props.fitView).toBeUndefined();
    });

    it('runs a one-time fit only when there is no persisted viewport', async () => {
        renderSurface(createApi({ x: 0, y: 0, zoom: 1 }));

        await waitFor(() => {
            expect(fitViewSpy).toHaveBeenCalledTimes(1);
        });
    });

    it('skips the initial fit when a persisted viewport exists', async () => {
        renderSurface(createApi({ x: 90, y: 20, zoom: 1.1 }));

        await waitFor(() => {
            expect(fitViewSpy).not.toHaveBeenCalled();
        });
    });

    it('keeps controlled onNodesChange sequences bounded without callback cascades', () => {
        renderSurface(createApi({ x: 0, y: 0, zoom: 1 }));

        const props = reactFlowProps.at(-1);
        expect(props).toBeTruthy();

        props.onNodesChange?.([
            { id: 'a', type: 'select', selected: true },
            { id: 'a', type: 'position', position: { x: 160, y: 190 }, dragging: true },
        ]);
        props.onNodesChange?.([{ id: 'a', type: 'position', position: { x: 160, y: 190 }, dragging: false }]);

        expect(adapterHandlers.onNodesChange).toHaveBeenCalledTimes(2);
        expect(reactFlowProps.length).toBe(1);
    });
});
