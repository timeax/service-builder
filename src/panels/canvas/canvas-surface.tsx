import { useWorkspace, type UseCanvasReturn } from '@timeax/digital-service-engine/workspace';
import React, { useEffect, useMemo, useState } from 'react';
import { Background, ConnectionMode, MiniMap, ReactFlow, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type AdapterOptions, useReactFlowAdapter } from './adapter.ts';
import { edgeTypes, nodeTypes } from './reactflow/index.tsx';
import { Toolbar } from './toolbar/index.tsx';
import type { LabelPlacement, ToolbarOrientation, ToolsConfig } from './toolbar/types.ts';

export type CanvasSurfaceProps = {
    api: CanvasAPI;
    options?: AdapterOptions;
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
    children?: React.ReactNode;
};

type CanvasAPI = UseCanvasReturn['api'];

export function CanvasSurface({
    api,
    options,
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

    const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onConnectStart, onConnectEnd, onMoveEnd, onSelectionChange, isValidConnection, snapVector } = useReactFlowAdapter(api, options);
    const snapToGrid = useMemo(() => !!options?.snapToGrid, [options?.snapToGrid]);
    const snapGrid = useMemo<[number, number] | undefined>(() => snapVector, [snapVector]);

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
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onConnect={onConnect}
                onMoveEnd={onMoveEnd}
                onSelectionChange={onSelectionChange}
                isValidConnection={isValidConnection}
                fitView
                snapToGrid={snapToGrid}
                snapGrid={snapGrid}
                className="bg-transparent!"
                onNodeContextMenu={(event, node) => {
                    const kind =
                        (node.data as any)?.node?.kind ??
                        (node.type === 'tag' || node.type === 'field' || node.type === 'option' || node.type === 'comment' ? node.type : 'comment');
                    onNodeContextMenu?.({
                        nodeId: node.id,
                        nodeKind: kind,
                        clientX: event.clientX,
                        clientY: event.clientY,
                        event,
                    });
                }}
            >
                {showToolbar ? (
                    <div className={`pointer-events-none absolute z-10 ${toolbarPositionClassName}`}>
                        <Toolbar
                            api={api}
                            mode="dev"
                            showGrid={showGrid}
                            setShowGrid={setShowGrid}
                            showMiniMap={showMiniMap}
                            setShowMiniMap={setShowMiniMap}
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
                {children as any}
            </ReactFlow>
        </div>
    );
}
