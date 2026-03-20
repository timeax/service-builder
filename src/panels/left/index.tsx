import { cn } from '@/lib/utils.ts';
import Header from '@/panels/left/components/header.tsx';
import Drafts from '@/panels/left/components/drafts.tsx';
import AssetsPanel from '@/panels/left/assets';
import Layers from '@/panels/left/layers';
import { Panel } from '@/components/ui/panel.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { CiGrid32 } from 'react-icons/ci';
import { MdOutlineLayers } from 'react-icons/md';

const Left = () => {
    const tabClassName = cn(
        'rounded-xl! py-2! shadow-none!',
        'text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm',
        'dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-100',
    );

    return (
        <Panel
            className="w-[360px] rounded-none! border-r border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.98))]"
            edges={['right']}
            maxWidth={420}
            minWidth={320}
        >
            <div className="flex h-full flex-col">
                <Header />
                <div className="flex min-h-0 flex-1 flex-col gap-2 py-2">
                    <Drafts />

                    <Tabs defaultValue="layers" className="flex min-h-0 flex-1 flex-col px-3">
                        <TabsList className="grid h-auto grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
                            <TabsTrigger className={tabClassName} value="layers">
                                <span className="flex items-center gap-2">
                                    <MdOutlineLayers />
                                    <span>Layers</span>
                                </span>
                            </TabsTrigger>
                            <TabsTrigger className={tabClassName} value="assets">
                                <span className="flex items-center gap-2">
                                    <CiGrid32 />
                                    <span>Assets</span>
                                </span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent className="mt-2 min-h-0 flex-1 overflow-hidden" value="layers">
                            <Layers />
                        </TabsContent>
                        <TabsContent className="mt-2 min-h-0 flex-1 overflow-hidden" value="assets">
                            <AssetsPanel />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </Panel>
    );
};

export default Left;
