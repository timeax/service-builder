import { Panel } from '@/components/ui/panel.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { cn } from '@/lib/utils.ts';
import Header from '@/panels/right/components/header.tsx';
import Comments from '@/panels/right/tabs/comments.tsx';

const RightPanel = () => {
    const tabClassName = cn(
        'm-0! py-2! shadow-none!',
        'bg-transparent! text-gray-400 hover:bg-transparent hover:text-gray-700! data-[state=active]:text-gray-700!',
        'rounded-none! border-t-0! border-r-0! border-b-2! border-l-0! border-transparent!',
        'data-[state=active]:-mb-px! data-[state=active]:border-blue-500!',
    );
    return (
        <Panel edges={['left']} maxWidth={400} minWidth={300} className={'w-[350px] rounded-none! border'}>
            <div className="flex flex-col">
                <Header />
                <Tabs className={'gap-0'} defaultValue="wireframe">
                    <TabsList className="grid h-fit w-full grid-cols-3 rounded-none! border-b bg-transparent p-0">
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
                    <TabsContent value="comments">
                        <Comments />
                    </TabsContent>
                    <TabsContent value="properties">Change your password here.</TabsContent>
                    <TabsContent value="wireframe">Change your wireframe.</TabsContent>
                </Tabs>
            </div>
        </Panel>
    );
};

export default RightPanel;
