import {MdMenuOpen, MdOutlineSpaceDashboard} from "react-icons/md";
import Dropdown from "@/components/dropdown";
import {BiCog} from "react-icons/bi";

const Header = () => {
    return (
        <div className={'p-4 border-b'}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={"flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white"}>
                        <Dropdown menu={[{label: "Settings", icon: BiCog}]}>
                            <MdOutlineSpaceDashboard className={'text-[16px]'}/>
                        </Dropdown>
                </span>
                    <h1 className={"text-base font-semibold"}>Workspace</h1>
                </div>
                <span className={'p-2 hover:bg-gray-100 rounded-md cursor-pointer'}>
                    <MdMenuOpen/>
                </span>
            </div>
        </div>
    )
}

export default Header