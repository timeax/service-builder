import { StatusDot } from '@/components/builder/index.tsx';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { RiDraftLine } from 'react-icons/ri';

const Drafts = () => {
    const ws = useWorkspace();
    const currentBranch = ws.branches.data?.find((branch) => branch.id === ws.branches.currentId);
    const threadCount = ws.comments.threads.data?.length ?? 0;
    const templateCount = ws.templates.data?.length ?? 0;

    return (
        <div className="mx-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <RiDraftLine className="text-base" />
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Drafts</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        {currentBranch?.name ?? 'Main'}
                    </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                        <StatusDot tone="warning" />
                        {threadCount} threads
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <StatusDot tone="success" />
                        {templateCount} templates
                    </span>
                </div>
            </div>

            <button className="rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10">
                Review
            </button>
        </div>
    );
};

export default Drafts;
