import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import type { UseErrorsReturn } from '@timeax/digital-service-engine/workspace';
import { FiAlertCircle, FiEye, FiEyeOff, FiSave, FiTerminal } from 'react-icons/fi';
import { LuGitCommitHorizontal, LuHistory, LuRedo2, LuUndo2 } from 'react-icons/lu';

export function AppToolbar({
    bootActionReason,
    errors,
    bottomPanelOpen,
    onConsoleToggle,
    canUndo,
    canRedo,
    canSave,
    canPublish,
    onUndo,
    onRedo,
    onSave,
    onPublish,
    onRelayout,
    noticesOpen,
    onNoticesToggle,
    showErrorBadges,
    setShowErrorBadges,
    pendingAction,
}: {
    bootActionReason?: string;
    errors: UseErrorsReturn;
    bottomPanelOpen: boolean;
    onConsoleToggle: () => void;
    canUndo: boolean;
    canRedo: boolean;
    canSave: boolean;
    canPublish: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void | Promise<void>;
    onPublish: () => void | Promise<void>;
    onRelayout: () => void;
    noticesOpen: boolean;
    onNoticesToggle: () => void;
    showErrorBadges: boolean;
    setShowErrorBadges: (value: boolean) => void;
    pendingAction: 'save' | 'publish' | null;
}) {
    return (
        <div className="pointer-events-none absolute top-4 right-4 z-20 flex items-center gap-2">
            <div className="pointer-events-auto inline-flex items-center rounded-lg border border-slate-200 bg-white/95 shadow-md dark:border-slate-800 dark:bg-slate-950/95">
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-r-none"
                    aria-label="Save snapshot"
                    onClick={onSave}
                    disabled={pendingAction === 'save' || !canSave}
                    title={bootActionReason && !canSave ? bootActionReason : 'Save snapshot'}
                >
                    <FiSave />
                </Button>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-l-none"
                    aria-label="Publish commit"
                    onClick={onPublish}
                    disabled={pendingAction === 'publish' || !canPublish}
                    title={bootActionReason && !canPublish ? bootActionReason : 'Publish commit'}
                >
                    <LuGitCommitHorizontal />
                </Button>
            </div>

            <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-0.5 shadow-md dark:border-slate-800 dark:bg-slate-950/95">
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Undo" onClick={onUndo} disabled={!canUndo}>
                    <LuUndo2 />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Redo" onClick={onRedo} disabled={!canRedo}>
                    <LuRedo2 />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Relayout (coming soon)" onClick={onRelayout}>
                    <LuHistory />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn('h-8 w-8', showErrorBadges && 'text-blue-600')}
                    title="Toggle error markers"
                    onClick={() => setShowErrorBadges(!showErrorBadges)}
                >
                    {showErrorBadges ? <FiEye /> : <FiEyeOff />}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn('relative h-8 w-8', bottomPanelOpen && 'text-blue-600')}
                    title="Toggle console"
                    onClick={onConsoleToggle}
                >
                    <FiTerminal />
                    {errors.merged.counts.total > 0 ? (
                        <span className="absolute top-1.5 right-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                    ) : null}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn('h-8 w-8', noticesOpen && 'text-blue-600')}
                    title="Toggle notices manager"
                    onClick={onNoticesToggle}
                >
                    <FiAlertCircle />
                </Button>
            </div>
        </div>
    );
}
