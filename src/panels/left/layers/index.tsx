import { CiSearch } from 'react-icons/ci';
import { type ChangeDetail, SortTree } from '@/components/sort-tree';
import { useState } from 'react';
import { fileTree, formTree } from '@/panels/left/layers/data.ts';
import { Panel } from '@/components/ui/panel.tsx';
import { MdOutlineAdd } from 'react-icons/md';
import { LuTags } from 'react-icons/lu';
import { VscNewFolder, VscRootFolderOpened } from 'react-icons/vsc';
import { RxInput } from 'react-icons/rx';

const Layers = () => {
    const [data, setData] = useState(fileTree);
    const [fieldData, setFieldData] = useState(formTree);

    const handleChange = (next: typeof data, detail: ChangeDetail<any>) => {
        setData(next);
        console.log(detail.type, detail);
    };

    const handleFieldChange = (next: typeof fieldData, detail: ChangeDetail<any>) => {
        setFieldData(next);
        console.log(detail.type, detail);
    };

    return (
        <div className={'h-full flex flex-col overflow-hidden'}>
            <div className="flex items-center justify-between px-6 pt-2 pb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider">
                    Tags
                </h2>
                <div className="flex items-center">
                    <button className="rounded-md hover:bg-accent p-1 5 cursor-pointer">
                        <VscNewFolder />
                    </button>
                    <button className="rounded-md hover:bg-accent p-1.5 cursor-pointer">
                        <VscRootFolderOpened />
                    </button>
                    <button className="rounded-md hover:bg-accent p-1.5 cursor-pointer">
                        <CiSearch />
                    </button>
                </div>
            </div>

            <div className="flex flex-col h-full overflow-hidden">
                <Panel edges={['bottom']} className={'overflow-auto h-[300px] border-b rounded-none! scrollbar-none px-5 pb-3'}>
                    <SortTree nodeClassName={'text-sm!'} defaultNodeIcon={<LuTags />} selectionMode={'multiple'} selectedRowClassName={'bg-accent'} allSupportSubnodes rowClassName={'hover:bg-accent/25 rounded-md pb-1'} canDrop={e => {
                        console.log('can drop', e);
                        return true;
                    }} data={data} onChange={handleChange} onContextMenu={({ node, event }) => {
                        console.log('context menu on', node, event);
                    }} />
                </Panel>

                <div className="grow p-3 flex min-h-0 overflow-auto flex-1 flex-col">
                    <div className="px-1 mb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <h2 className="text-sm font-semibold">Fields in View</h2>
                                <p className="text-xs italic">under Site Builder</p>
                            </div>
                            <div className="flex items-center">
                                <button className="rounded-md hover:bg-accent p-1.5 cursor-pointer">
                                    <CiSearch />
                                </button>
                                <span className="rounded-md hover:bg-accent p-1.5 cursor-pointer">
                                    <MdOutlineAdd />
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-auto grow scrollbar-none">
                        <div className="flex flex-col gap-2">
                            <SortTree
                                nodeClassName={'text-sm!'}
                                defaultNodeIcon={<RxInput />}
                                selectionMode={'multiple'}
                                selectedRowClassName={'bg-accent'}
                                allSupportSubnodes
                                rowClassName={'hover:bg-accent/25 rounded-md pb-1'} canDrop={e => {
                                console.log('can drop', e);
                                return true;
                            }} data={fieldData} onChange={handleFieldChange} onContextMenu={({ node, event }) => {
                                console.log('context menu on', node, event);
                            }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default Layers;
