import { buildServiceSummaries, useBottomConsolePanel } from '@/builder/bottom-panel.ts';
import Left from '@/panels/left';
import RightPanel from '@/panels/right';
import CanvasPanel from '@/panels/canvas';
import { BottomConsolePanel } from '@/workspace/bottom-console-panel.tsx';

import { Provider as InputsProvider, createInputRegistry, registerEntries } from '@timeax/digital-service-engine/react';
import { Workspace, useCanvas, useErrors, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useMemo, useState } from 'react';
import { workspaceActor, workspaceBackend, workspaceInitial } from '../backend';

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
    );
}

function App() {
    return (
        <InputsProvider initialRegistry={inputRegistry}>
            <Workspace backend={workspaceBackend} actor={workspaceActor} initial={workspaceInitial}>
                {() => <WorkspaceLayout />}
            </Workspace>
        </InputsProvider>
    );
}

export default App;
