import { buildServiceSummaries, useBottomConsolePanel } from '@/builder/bottom-panel.ts';
import { NodeContextMenuProvider } from '@/builder/node-context-menu.tsx';
import CanvasPanel from '@/panels/canvas';
import Left from '@/panels/left';
import RightPanel from '@/panels/right';
import { WorkspaceBootStatusSurface } from '@/workspace/boot-status.tsx';
import { BottomConsolePanel } from '@/workspace/bottom-console-panel.tsx';
import { FallbackEditorModalProvider } from '@/workspace/fallback-editor-modal.tsx';
import { FallbackQuickAddProvider } from '@/workspace/fallback-quick-add.tsx';
import { createInputRegistry, Provider as InputsProvider, registerEntries } from '@timeax/digital-service-engine/react';
import type { DgpServiceMap, EditorSnapshot, ServiceProps } from '@timeax/digital-service-engine/schema';
import { useCanvas, useErrors, useWorkspace, Workspace, type WorkspaceProviderProps } from '@timeax/digital-service-engine/workspace';
import { useMemo, useState } from 'react';
import { workspaceActor, workspaceBackend } from '../backend';
import './index.css';

const inputRegistry = createInputRegistry();
registerEntries(inputRegistry);

export type ServiceBuilderPlayPayload = {
    serviceProps: ServiceProps;
    capabilitiesMap: DgpServiceMap;
    workspaceId: string;
    branchId?: string;
};

export type ServiceBuilderCallbacks = {
    onShare?: (snapshotData: EditorSnapshot | undefined) => void | Promise<void>;
    onPlay?: (payload: ServiceBuilderPlayPayload) => void | Promise<void>;
};

function WorkspaceLayout({ onShare, onPlay }: ServiceBuilderCallbacks) {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const errors = useErrors();
    const bottomPanel = useBottomConsolePanel();
    const [draggingServiceId, setDraggingServiceId] = useState<string | null>(null);

    const serviceSummary = useMemo(() => buildServiceSummaries(canvas, ws), [canvas.props, canvas.selectionInfo, canvas.activeId, ws.services.data]);

    return (
        <FallbackQuickAddProvider>
            <NodeContextMenuProvider>
                <FallbackEditorModalProvider>
                    <div className={'relative flex h-screen flex-col overflow-hidden *:font-display'}>
                        <div className="pointer-events-none absolute top-4 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-4">
                            <div className="pointer-events-auto">
                                <WorkspaceBootStatusSurface boot={ws.boot} />
                            </div>
                        </div>

                        <div className={'flex grow overflow-hidden'}>
                            <Left />
                            <CanvasPanel
                                errors={errors}
                                bottomPanel={bottomPanel}
                                draggingServiceId={draggingServiceId}
                                onServiceDragStateChange={(serviceId) => setDraggingServiceId(serviceId)}
                            />
                            <RightPanel onShare={onShare} onPlay={onPlay} />
                        </div>

                        <div className="pointer-events-none absolute inset-0 z-5">
                            <BottomConsolePanel
                                controller={bottomPanel}
                                errors={errors}
                                activeServices={serviceSummary.activeServices}
                                allServices={serviceSummary.allServices}
                                onServiceDragStateChange={(serviceId) => setDraggingServiceId(serviceId)}
                            />
                        </div>
                    </div>
                </FallbackEditorModalProvider>
            </NodeContextMenuProvider>
        </FallbackQuickAddProvider>
    );
}

export type ServiceBuilderProps = Pick<WorkspaceProviderProps, 'backend' | 'actor' | 'initial'> & ServiceBuilderCallbacks;

export function ServiceBuilder({ backend, actor, onShare, onPlay }: ServiceBuilderProps) {
    return (
        <InputsProvider initialRegistry={inputRegistry}>
            <Workspace backend={backend} actor={actor}>
                {() => <WorkspaceLayout onShare={onShare} onPlay={onPlay} />}
            </Workspace>
        </InputsProvider>
    );
}

export type ServiceBuilderWorkspaceProps = ServiceBuilderCallbacks;

export function ServiceBuilderWorkspace({ onShare, onPlay }: ServiceBuilderWorkspaceProps) {
    return <ServiceBuilder backend={workspaceBackend} actor={workspaceActor} onShare={onShare} onPlay={onPlay} />;
}
