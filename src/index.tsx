import { buildServiceSummaries, useBottomConsolePanel } from '@/builder/bottom-panel.ts';
import { NodeContextMenuProvider } from '@/builder/node-context-menu.tsx';
import CanvasPanel from '@/panels/canvas';
import Left from '@/panels/left';
import RightPanel from '@/panels/right';
import { BottomConsolePanel } from '@/workspace/bottom-console-panel.tsx';
import { Provider as InputsProvider, createInputRegistry, registerEntries } from '@timeax/digital-service-engine/react';
import { Workspace, useCanvas, useErrors, useWorkspace, type WorkspaceProviderProps } from '@timeax/digital-service-engine/workspace';
import { useMemo, useState } from 'react';
import { workspaceActor, workspaceBackend, workspaceInitial } from '../backend';
import './index.css';

const inputRegistry = createInputRegistry();
registerEntries(inputRegistry);

function WorkspaceLayout() {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const errors = useErrors();
    const bottomPanel = useBottomConsolePanel();
    const [draggingServiceId, setDraggingServiceId] = useState<string | null>(null);

    const serviceSummary = useMemo(() => buildServiceSummaries(canvas, ws), [canvas.props, canvas.selectionInfo, canvas.activeId, ws.services.data]);

    return (
        <NodeContextMenuProvider>
            <div className={'relative flex h-screen flex-col overflow-hidden *:font-display'}>
                <div className={'flex grow overflow-hidden'}>
                    <Left />
                    <CanvasPanel
                        errors={errors}
                        bottomPanel={bottomPanel}
                        draggingServiceId={draggingServiceId}
                        onServiceDragStateChange={(serviceId) => setDraggingServiceId(serviceId)}
                    />
                    <RightPanel />
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
        </NodeContextMenuProvider>
    );
}

export type ServiceBuilderProps = Pick<WorkspaceProviderProps, 'backend' | 'actor' | 'initial'>;

export function ServiceBuilder({ backend, actor, initial }: ServiceBuilderProps) {
    return (
        <InputsProvider initialRegistry={inputRegistry}>
            <Workspace backend={backend} actor={actor} initial={initial}>
                {() => <WorkspaceLayout />}
            </Workspace>
        </InputsProvider>
    );
}

export function ServiceBuilderWorkspace() {
    return <ServiceBuilder backend={workspaceBackend} actor={workspaceActor} initial={workspaceInitial} />;
}

