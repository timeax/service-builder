import { BuilderIconButton } from '@/components/builder/index.tsx';
import Drafts from '@/panels/left/components/drafts.tsx';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { GoChevronDown } from 'react-icons/go';
import { MdMenuOpen, MdOutlineSpaceDashboard } from 'react-icons/md';

const Header = () => {
    const ws = useWorkspace();

    const currentBranch = ws.branches.data?.find((branch) => branch.id === ws.branches.currentId);

    return (
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        <MdOutlineSpaceDashboard className="text-base" />
                    </span>
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Workspace</div>
                        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Service Builder</h1>
                        <Drafts
                            trigger={
                                <button
                                    type="button"
                                    className="mt-0.5 inline-flex items-center gap-1 rounded-md px-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                                >
                                    <span>{currentBranch?.name ?? 'Main branch'} loaded</span>
                                    <GoChevronDown className="text-sm" />
                                </button>
                            }
                        />
                    </div>
                </div>

                <BuilderIconButton title="Collapse left panel">
                    <MdMenuOpen />
                </BuilderIconButton>
            </div>
        </div>
    );
};

export default Header;
