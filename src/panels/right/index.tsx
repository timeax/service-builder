import { Panel } from '@/components/ui/panel.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { cn } from '@/lib/utils.ts';
import Header from '@/panels/right/components/header.tsx';
import Comments from '@/panels/right/tabs/comments.tsx';
import { Properties } from '@/panels/right/tabs/properties.tsx';
import Wireframe from '@/panels/right/tabs/wireframe.tsx';
import { OrderFlowProvider, useInputs } from '@timeax/digital-service-engine/react';
import type { DgpServiceMap, EditorSnapshot, ServiceProps } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';

export type RightPanelProps = {
    onShare?: (snapshotData: EditorSnapshot | undefined) => void | Promise<void>;
    onPlay?: (payload: { serviceProps: ServiceProps; capabilitiesMap: DgpServiceMap; workspaceId: string; branchId?: string }) => void | Promise<void>;
    kinds?: string[];
    defaultKind?: string;
};

const RightPanel = ({ onShare, onPlay, kinds = [], defaultKind = '' }: RightPanelProps) => {
    const tabClassName = cn(
        'm-0! rounded-none! border-t-0! border-r-0! border-b-2! border-l-0! border-transparent! py-2.5! shadow-none!',
        'bg-transparent! text-slate-400 hover:bg-transparent hover:text-slate-700! data-[state=active]:text-slate-900!',
        'dark:data-[state=active]:text-slate-100!',
        'data-[state=active]:-mb-px! data-[state=active]:border-blue-500!',
    );

    const registry = useInputs().registry;

    const { props, api } = useCanvas();

    return (
        <Panel
            edges={['left']}
            maxWidth={420}
            minWidth={320}
            className={
                'flex h-dvh max-h-dvh w-100 flex-col rounded-none! border-l border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.98))]'
            }
        >
            <div className="flex h-full flex-col">
                <Header onShare={onShare} onPlay={onPlay} />
                <Tabs className={'grow gap-0 overflow-hidden'} defaultValue="wireframe">
                    <TabsList className="grid h-fit w-full grid-cols-3 rounded-none! border-b border-slate-200 bg-transparent p-0 dark:border-slate-800">
                        <TabsTrigger className={tabClassName} value="comments">
                            Comments
                        </TabsTrigger>
                        <TabsTrigger className={tabClassName} value="properties">
                            Properties
                        </TabsTrigger>
                        <TabsTrigger className={tabClassName} value="wireframe">
                            Wireframe
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent className={'grow overflow-hidden'} value="comments">
                        <Comments />
                    </TabsContent>
                    <TabsContent className={'min-h-0 grow overflow-hidden'} value="properties">
                        <Properties kinds={kinds} defaultKind={defaultKind} />
                    </TabsContent>
                    <TabsContent className={'min-h-0 grow overflow-hidden'} value="wireframe" forceMount>
                        {/*@ts-ignore*/}
                        <OrderFlowProvider serviceProps={props} builder={api.builder} selection={api.selection!} registry={registry}>
                            <Wireframe kinds={kinds} defaultKind={defaultKind} />
                        </OrderFlowProvider>
                    </TabsContent>
                </Tabs>
            </div>
        </Panel>
    );
};

export default RightPanel;
