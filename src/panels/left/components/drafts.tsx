import {RiDraftLine} from "react-icons/ri";
import Dropdown from "@/components/dropdown";


const Drafts = () => {
    return (
        <Dropdown menu={[]}>
            <div className="px-3">
                    <span className="flex items-center rounded-lg py-2.5 px-3 text-sm font-medium bg-selected gap-3">
                        <RiDraftLine/>
                        <span>Drafts</span>
                        <span
                            className={'ml-auto text-xs font-semibold bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-200 rounded-full px-2 py-0.5 border'}>5</span>
                    </span>
            </div>
        </Dropdown>
    )
}

export default Drafts;