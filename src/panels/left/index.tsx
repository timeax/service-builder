import {Panel} from "@/components/ui/panel.tsx";
import Header from "@/panels/left/components/header.tsx";
import Drafts from "@/panels/left/components/drafts.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs"
import Layers from "@/panels/left/layers";
import {MdOutlineLayers} from "react-icons/md";
import {CiGrid32} from "react-icons/ci";

const Left = () => {
    return (
        <Panel className={'w-80 shadow-lg rounded-none!'} edges={['right']}>
            <div className="flex h-full flex-col">
                <Header/>
                <div className={'grow overflow-y-hidden pt-4 gap-4 flex flex-col'}>
                    <Drafts/>
                    <Tabs defaultValue="layers" className={'px-0 grow overflow-hidden'}>
                        <div className={'px-3'}>
                            <TabsList className={'w-full h-fit'}>
                                <TabsTrigger className={'py-1.5!'} value="layers">
                                <span className="flex items-center gap-2">
                                    <MdOutlineLayers/>
                                    <span>Layers</span>
                                </span>
                                </TabsTrigger>
                                <TabsTrigger className={'py-1.5!'} value="assets">
                                <span className="flex items-center gap-2">
                                    <CiGrid32/>
                                    <span>Assets</span>
                                </span>
                                </TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent className={'px-0 grow overflow-hidden'} value="layers">
                            <Layers/>
                        </TabsContent>
                        <TabsContent value="assets" className={'px-3'}>No assets available.</TabsContent>
                    </Tabs>
                </div>
            </div>
        </Panel>
    )
}


export default Left;
