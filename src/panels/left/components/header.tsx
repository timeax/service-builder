import { BuilderIconButton, PresenceAvatar } from '@/components/builder/index.tsx';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useMemo } from 'react';
import { MdMenuOpen, MdOutlineSpaceDashboard } from 'react-icons/md';

const Header = () => {
    const ws = useWorkspace();

    const owner = useMemo(() => {
        const actorAuthor = ws.authors.data?.find((author) => author.id === ws.actor.id);
        return {
            name: actorAuthor?.name ?? ws.actor.name ?? 'Workspace owner',
            avatar: actorAuthor?.avatarUrl ?? '',
        };
    }, [ws.authors.data, ws.actor]);

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
                        <p className="text-xs text-slate-500 dark:text-slate-400">{currentBranch?.name ?? 'Main branch'} loaded</p>
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
