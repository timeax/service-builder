import {CiSearch} from "react-icons/ci";
import {type ChangeDetail, SortTree} from "@/components/sort-tree";
import {useState} from "react";
import {fileTree} from "@/panels/left/layers/data.ts";
import {Panel} from "@/components/ui/panel.tsx";

const Layers = () => {
    const [data, setData] = useState(fileTree);

    const handleChange = (next: typeof data, detail: ChangeDetail<any>) => {
        setData(next);
        console.log(detail.type, detail);
    }
    return (
        <div className={"h-full flex flex-col"}>
            <div className="flex items-center justify-between px-6 pt-2 pb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider">
                    Tags
                </h2>
                <button className="">
                    <CiSearch/>
                </button>
            </div>

            <div className="flex flex-col h-full overflow-y-auto">
                <Panel edges={['bottom']} className={"overflow-auto border-b rounded-none! scrollbar-none px-3"}>
                    <SortTree canDrop={e => {
                        console.log("can drop", e);
                        return true;
                    }} data={data} onChange={handleChange} onContextMenu={({node, event}) => {
                        console.log("context menu on", node, event);
                    }}/>
                </Panel>

                <div className="grow">
                    Fields
                </div>
            </div>
        </div>
    )
}

export default Layers;
