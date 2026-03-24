import { BuilderIconButton } from '@/components/builder';
import Drafts from '@/panels/left/components/drafts.tsx';
import { getWorkspaceBootHeadline } from '@/workspace/boot.ts';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { BsChevronDown } from 'react-icons/bs';
import { MdMenuOpen, MdOutlineSpaceDashboard } from 'react-icons/md';

const Header = () => {
    const ws = useWorkspace();

    const currentBranch = ws.branches.data?.find((branch) => branch.id === ws.branches.currentId);
    const workspaceStatus = getWorkspaceBootHeadline(ws.boot);

    // console.log(currentBranch)

    return (
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        <MdOutlineSpaceDashboard className="text-base" />
                    </span>
                    <div className={'flex flex-col justify-center gap-0'}>
                        <h1 className="text-base leading-tight font-semibold text-slate-900 dark:text-slate-100">Service Builder</h1>
                        <Drafts
                            trigger={
                                <button
                                    type="button"
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-md text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                >
                                    <span>
                                        Active branch - <b>{currentBranch?.name ?? 'Main branch'}</b>
                                    </span>
                                    <BsChevronDown />
                                </button>
                            }
                        />
                    </div>
                </div>

                <BuilderIconButton title="Menu">
                    <MdMenuOpen />
                </BuilderIconButton>
            </div>
        </div>
    );
};

export default Header;
