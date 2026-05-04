import type { AnyNode } from '@timeax/digital-service-engine/core';
import { type UseCanvasReturn, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { Background, ConnectionMode, MiniMap, type Node, ReactFlow, useReactFlow, type Viewport as RFViewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type AdapterOptions, useReactFlowAdapter } from './adapter.ts';
import { edgeTypes, nodeTypes } from './reactflow/index.tsx';
import { Toolbar } from './toolbar/index.tsx';
import type { LabelPlacement, ToolbarOrientation, ToolsConfig } from './toolbar/types.ts';

export type CanvasSurfaceProps = {
    api: CanvasAPI;
    options?: AdapterOptions;
    commentPlacement?: {
        active: boolean;
        onPlaceOnNode: (args: { nodeId: string; pointerPosition: { x: number; y: number }; nodePosition: { x: number; y: number } }) => void | Promise<void>;
        onPlaceOnCanvas: (args: { pointerPosition: { x: number; y: number } }) => void | Promise<void>;
        onCancel?: () => void;
    };
    showToolbar?: boolean;
    tools?: ToolsConfig;
    labelPlacement?: LabelPlacement;
    canUndo?: boolean;
    canRedo?: boolean;
    renderTool?: Parameters<typeof Toolbar>[0]['renderButton'];
    initialShowGrid?: boolean;
    initialShowMiniMap?: boolean;
    toolbarOrientation?: ToolbarOrientation;
    persistToolbarOrientation?: boolean;
    toolbarPositionClassName?: string;
    onNodeContextMenu?: (payload: {
        nodeId: string;
        nodeKind: 'tag' | 'field' | 'option' | 'comment';
        clientX: number;
        clientY: number;
        event: React.MouseEvent;
    }) => void;
    onEdgeContextMenu?: (payload: {
        edgeId: string;
        clientX: number;
        clientY: number;
        event: React.MouseEvent;
    }) => void;
    showBindEdges: boolean;
    setShowBindEdges: (value: boolean) => void;
    showIncludeEdges: boolean;
    setShowIncludeEdges: (value: boolean) => void;
    showExcludeEdges: boolean;
    setShowExcludeEdges: (value: boolean) => void;
    focusCurrentContext: boolean;
    setFocusCurrentContext: (value: boolean) => void;
    children?: React.ReactNode;
};

type CanvasAPI = UseCanvasReturn['api'];

function hasPersistedViewport(viewport: RFViewport | null | undefined): boolean {
    if (!viewport) return false;
    return Math.abs(viewport.x) > 0.5 || Math.abs(viewport.y) > 0.5 || Math.abs(viewport.zoom - 1) > 1e-4;
}

function InitialFitController({ enabled, nodeCount }: { enabled: boolean; nodeCount: number }) {
    const rf = useReactFlow();
    const didFitRef = useRef(false);

    useEffect(() => {
        if (!enabled || didFitRef.current || nodeCount === 0) return;
        didFitRef.current = true;
        requestAnimationFrame(() => {
            rf.fitView?.();
        });
    }, [enabled, nodeCount, rf]);

    return null;
}

export function CanvasSurface({
    api,
    options,
    commentPlacement,
    showToolbar = true,
    tools,
    labelPlacement = 'tooltip',
    canUndo = false,
    canRedo = false,
    renderTool,
    initialShowGrid = true,
    initialShowMiniMap = false,
    toolbarOrientation = 'horizontal',
    persistToolbarOrientation = true,
    toolbarPositionClassName = 'left-4 top-4',
    onNodeContextMenu,
    onEdgeContextMenu,
    showBindEdges,
    setShowBindEdges,
    showIncludeEdges,
    setShowIncludeEdges,
    showExcludeEdges,
    setShowExcludeEdges,
    focusCurrentContext,
    setFocusCurrentContext,
    children,
}: CanvasSurfaceProps) {
    const ws = useWorkspace();
    const [showGrid, setShowGrid] = useState(initialShowGrid);
    const [showMiniMap, setShowMiniMap] = useState(initialShowMiniMap);
    const orientationStorageKey = `service-builder.canvas.flow-toolbar.${ws.info.id}.${ws.branches.currentId ?? 'none'}`;
    const [orientation, setOrientation] = useState<ToolbarOrientation>(() => {
        if (!persistToolbarOrientation || typeof window === 'undefined') return toolbarOrientation;
        const stored = window.localStorage.getItem(orientationStorageKey);
        return stored === 'vertical' || stored === 'horizontal' ? stored : toolbarOrientation;
    });

    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onConnectStart,
        onConnectEnd,
        onMoveStart,
        onMoveEnd,
        onSelectionChange,
        isValidConnection,
        snapVector,
    } = useReactFlowAdapter(api, options);
    const snapToGrid = useMemo(() => !!options?.snapToGrid, [options?.snapToGrid]);
    const snapGrid = useMemo<[number, number] | undefined>(() => snapVector, [snapVector]);
    const initialViewport = useMemo(() => api.snapshot().viewport ?? { x: 0, y: 0, zoom: 1 }, [api]);
    const shouldInitialFit = useMemo(() => nodes.length > 0 && !hasPersistedViewport(initialViewport), [initialViewport, nodes.length]);
    const toCanvasPosition = (event: React.MouseEvent): { x: number; y: number } => {
        const root = (event.currentTarget as HTMLElement | null)?.closest('.react-flow');
        const rect = root?.getBoundingClientRect();
        const viewport = api.snapshot().viewport ?? { x: 0, y: 0, zoom: 1 };
        const left = rect?.left ?? 0;
        const top = rect?.top ?? 0;
        const zoom = viewport.zoom || 1;

        return {
            x: (event.clientX - left - viewport.x) / zoom,
            y: (event.clientY - top - viewport.y) / zoom,
        };
    };

    useEffect(() => {
        if (!persistToolbarOrientation || typeof window === 'undefined') {
            setOrientation(toolbarOrientation);
            return;
        }
        const stored = window.localStorage.getItem(orientationStorageKey);
        if (stored === 'horizontal' || stored === 'vertical') setOrientation(stored);
        else setOrientation(toolbarOrientation);
    }, [orientationStorageKey, persistToolbarOrientation, toolbarOrientation]);

    useEffect(() => {
        if (!persistToolbarOrientation || typeof window === 'undefined') return;
        window.localStorage.setItem(orientationStorageKey, orientation);
    }, [orientation, orientationStorageKey, persistToolbarOrientation]);

    return (
        <div className="relative h-full w-full">
            <ReactFlow
                nodes={nodes as Node[]}
                edges={edges}
                defaultViewport={initialViewport}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onConnect={onConnect}
                onMoveStart={onMoveStart}
                onMoveEnd={onMoveEnd}
                onSelectionChange={onSelectionChange}
                isValidConnection={isValidConnection}
                snapToGrid={snapToGrid}
                snapGrid={snapGrid}
                className="bg-transparent!"
                onNodeContextMenu={(event, node) => {
                    const kind =
                        (node.data as { node: AnyNode })?.node?.kind ??
                        (node.type === 'tag' || node.type === 'field' || node.type === 'option' || node.type === 'comment' ? node.type : 'comment');
                    onNodeContextMenu?.({
                        nodeId: node.id,
                        nodeKind: kind as 'tag' | 'field' | 'option' | 'comment',
                        clientX: event.clientX,
                        clientY: event.clientY,
                        event,
                    });
                }}
                onEdgeContextMenu={(event, edge) => {
                    onEdgeContextMenu?.({
                        edgeId: String(edge.id),
                        clientX: event.clientX,
                        clientY: event.clientY,
                        event,
                    });
                }}
                onNodeClick={(event, node) => {
                    if (!commentPlacement?.active) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const pointer = toCanvasPosition(event);
                    const nodePosition = {
                        x: Number((node as any).positionAbsolute?.x ?? node.position.x ?? 0),
                        y: Number((node as any).positionAbsolute?.y ?? node.position.y ?? 0),
                    };
                    void commentPlacement.onPlaceOnNode({
                        nodeId: String(node.id),
                        pointerPosition: pointer,
                        nodePosition,
                    });
                }}
                onPaneClick={(event) => {
                    if (!commentPlacement?.active) return;
                    event.preventDefault();
                    const pointer = toCanvasPosition(event);
                    void commentPlacement.onPlaceOnCanvas({
                        pointerPosition: pointer,
                    });
                }}
            >
                <InitialFitController enabled={shouldInitialFit} nodeCount={nodes.length} />
                {showToolbar ? (
                    <div className={`pointer-events-none absolute z-10 ${toolbarPositionClassName}`}>
                        <Toolbar
                            api={api}
                            mode="dev"
                            showGrid={showGrid}
                            setShowGrid={setShowGrid}
                            showMiniMap={showMiniMap}
                            setShowMiniMap={setShowMiniMap}
                            showBindEdges={showBindEdges}
                            setShowBindEdges={setShowBindEdges}
                            showIncludeEdges={showIncludeEdges}
                            setShowIncludeEdges={setShowIncludeEdges}
                            showExcludeEdges={showExcludeEdges}
                            setShowExcludeEdges={setShowExcludeEdges}
                            focusCurrentContext={focusCurrentContext}
                            setFocusCurrentContext={setFocusCurrentContext}
                            tools={tools}
                            labelPlacement={labelPlacement}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            renderButton={renderTool}
                            orientation={orientation}
                            onToggleOrientation={() => setOrientation((current) => (current === 'horizontal' ? 'vertical' : 'horizontal'))}
                            className="pointer-events-none"
                        />
                    </div>
                ) : null}
                {showMiniMap ? <MiniMap /> : null}
                {showGrid ? <Background gap={32} size={1} color="rgba(148,163,184,0.25)" /> : null}
                {children}
            </ReactFlow>
        </div>
    );
}
