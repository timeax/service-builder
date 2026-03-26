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
import { useCanvas, useErrors, useWorkspace, Workspace, type WorkspaceAPI, type WorkspaceProviderProps } from '@timeax/digital-service-engine/workspace';
import { useMemo, useState } from 'react';
import { workspaceActor, workspaceBackend } from '../backend';
import './index.css';
import './node-row.css';

const inputRegistry = createInputRegistry();
registerEntries(inputRegistry);

export type ServiceBuilderPlayPayload = {
    serviceProps: ServiceProps;
    capabilitiesMap: DgpServiceMap;
    workspaceId: string;
    branchId?: string;
};

export interface Menu {
    name: string;
    icon?: React.ReactNode;
    children?: Menu[];
    command?: (workspace?: WorkspaceAPI) => void | Promise<void>;
    render?: () => React.ReactNode;
}

export type ServiceBuilderCallbacks = {
    onShare?: (snapshotData: EditorSnapshot | undefined) => void | Promise<void>;
    onPlay?: (payload: ServiceBuilderPlayPayload) => void | Promise<void>;
};

export type ServiceBuilderLayoutProps = ServiceBuilderCallbacks & {
    menu?: Menu[];
};

function WorkspaceLayout({ onShare, onPlay, menu }: ServiceBuilderLayoutProps) {
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
                            <Left menu={menu} />
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

const Styles = `
/* line theming via CSS vars (can be overridden upstream) */
:root {
    --tree-line-color: #d1d5db; /* gray-300 */
    --tree-line-width: 1px;
    --tree-line-style: solid; /* solid | dashed | dotted */
    --elbow-v-h: 100%
}

/* container for each row */
.tree-row {
    display: flex;
    align-items: center;
    gap: 0.5rem; /* matches your gap-2 */
    /*padding: 0.25rem 0.5rem; !* py-1 px-2 *!*/
}

/* left rail: N ancestor columns (width given inline) */
.tree-rail {
    display: flex;
    position: relative;
}

/* a single ancestor column; width is set inline to \`indent\` */
.tree-col {
    position: relative;
}

/* draw vertical guideline IF data-show="1" */
.tree-col[data-show="1"]::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    border-left: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color);
}

/* the elbow cell for the current node (one per row) */
.tree-elbow {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* vertical segment (full for mid siblings, half for last) */
.tree-elbow::before {
    content: "";
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 0;
    height: var(--elbow-v-h, 100%); /* "50%" for last sibling, else "100%" */
    border-left: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color);
}

/* horizontal segment (elbow) from center to the content area */
.tree-elbow::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%);
    width: 50%;
    border-top: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color);
}

/* apply to the element that receives selectedRowClassName / rowClassName */
.tree-row-clip {
    background-clip: content-box; /* don’t paint under the left padding (indent) */
}

`;

export type ServiceBuilderProps = Pick<WorkspaceProviderProps, 'backend' | 'actor' | 'initial'> &
    ServiceBuilderCallbacks & {
        menu?: Menu[];
    };

export function ServiceBuilder({ backend, actor, onShare, onPlay, menu }: ServiceBuilderProps) {
    return (
        <>
            <style>{Styles}</style>
            <InputsProvider initialRegistry={inputRegistry}>
                <Workspace backend={backend} actor={actor}>
                    {() => <WorkspaceLayout onShare={onShare} onPlay={onPlay} menu={menu} />}
                </Workspace>
            </InputsProvider>
        </>
    );
}

export type ServiceBuilderWorkspaceProps = ServiceBuilderCallbacks & {
    menu?: Menu[];
};

export function ServiceBuilderWorkspace({ onShare, onPlay, menu }: ServiceBuilderWorkspaceProps) {
    return <ServiceBuilder backend={workspaceBackend} actor={workspaceActor} onShare={onShare} onPlay={onPlay} menu={menu} />;
}
