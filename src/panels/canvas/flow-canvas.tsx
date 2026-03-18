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
    renderTool?: React.ComponentProps<typeof CanvasSurface>['renderTool'];
    initialShowGrid?: boolean;
    initialShowMiniMap?: boolean;
    toolbarOrientation?: ToolbarOrientation;
    persistToolbarOrientation?: boolean;
    options?: AdapterOptions;
    children?: React.ReactNode;
};

export function FlowCanvas({
    tools,
    showToolbar = true,
    toolbarPositionClassName,
    labelPlacement = 'tooltip',
    renderTool,
    initialShowGrid = true,
    initialShowMiniMap = false,
    toolbarOrientation = 'horizontal',
    persistToolbarOrientation = true,
    options,
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
            renderTool={renderTool}
            initialShowGrid={initialShowGrid}
            initialShowMiniMap={initialShowMiniMap}
            toolbarOrientation={toolbarOrientation}
            persistToolbarOrientation={persistToolbarOrientation}
            options={options}
        >
            {children}
        </CanvasSurface>
    );
}
