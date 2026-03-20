import { useCanvasAPI } from '@timeax/digital-service-engine/workspace';
import React from 'react';
import { type AdapterOptions } from './adapter.ts';
import { CanvasSurface } from './canvas-surface.tsx';
import type { LabelPlacement, ToolbarOrientation, ToolsConfig } from './toolbar/types.ts';

export type FlowCanvasProps = {
    tools?: ToolsConfig;
    showToolbar?: boolean;
    toolbarPositionClassName?: string;
    labelPlacement?: LabelPlacement;
    canUndo?: boolean;
    canRedo?: boolean;
    renderTool?: React.ComponentProps<typeof CanvasSurface>['renderTool'];
    initialShowGrid?: boolean;
    initialShowMiniMap?: boolean;
    toolbarOrientation?: ToolbarOrientation;
    persistToolbarOrientation?: boolean;
    options?: AdapterOptions;
    onNodeContextMenu?: React.ComponentProps<typeof CanvasSurface>['onNodeContextMenu'];
    children?: React.ReactNode;
};

export function FlowCanvas({
    tools,
    showToolbar = true,
    toolbarPositionClassName,
    labelPlacement = 'tooltip',
    canUndo = false,
    canRedo = false,
    renderTool,
    initialShowGrid = true,
    initialShowMiniMap = false,
    toolbarOrientation = 'horizontal',
    persistToolbarOrientation = true,
    options,
    onNodeContextMenu,
    children,
}: FlowCanvasProps) {
    const api = useCanvasAPI();
    return (
        <CanvasSurface
            api={api}
            tools={tools}
            showToolbar={showToolbar}
            toolbarPositionClassName={toolbarPositionClassName}
            labelPlacement={labelPlacement}
            canUndo={canUndo}
            canRedo={canRedo}
            renderTool={renderTool}
            initialShowGrid={initialShowGrid}
            initialShowMiniMap={initialShowMiniMap}
            toolbarOrientation={toolbarOrientation}
            persistToolbarOrientation={persistToolbarOrientation}
            options={options}
            onNodeContextMenu={onNodeContextMenu}
        >
            {children}
        </CanvasSurface>
    );
}
