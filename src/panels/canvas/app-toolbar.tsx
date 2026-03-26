import { Button } from '@/components/ui/button.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.tsx';
import type { UseErrorsReturn } from '@timeax/digital-service-engine/workspace';
import { FiAlertCircle, FiEye, FiEyeOff, FiSave, FiTerminal } from 'react-icons/fi';
import { LuGitCommitHorizontal, LuHistory, LuImport, LuRedo2, LuUndo2 } from 'react-icons/lu';
import { toolbarIconButtonClass, toolbarSplitSurfaceClass, toolbarSurfaceClass } from './toolbar/styles.ts';

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
    onImportProps,
    onImportCatalog,
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
    onImportProps: () => void;
    onImportCatalog: () => void;
    noticesOpen: boolean;
    onNoticesToggle: () => void;
    showErrorBadges: boolean;
    setShowErrorBadges: (value: boolean) => void;
    pendingAction: 'save' | 'publish' | null;
}) {
    return (
        <div className="pointer-events-none absolute top-4 right-4 z-20 flex items-center gap-2">
            <div className={toolbarSplitSurfaceClass()}>
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

            <div className={toolbarSurfaceClass()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className={toolbarIconButtonClass()} title="Import JSON" aria-label="Import JSON">
                            <LuImport />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={onImportProps}>Import props</DropdownMenuItem>
                        <DropdownMenuItem onClick={onImportCatalog}>Import catalog</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button size="icon" variant="ghost" className={toolbarIconButtonClass()} title="Undo" onClick={onUndo} disabled={!canUndo}>
                    <LuUndo2 />
                </Button>
                <Button size="icon" variant="ghost" className={toolbarIconButtonClass()} title="Redo" onClick={onRedo} disabled={!canRedo}>
                    <LuRedo2 />
                </Button>
                <Button size="icon" variant="ghost" className={toolbarIconButtonClass()} title="Relayout (coming soon)" onClick={onRelayout}>
                    <LuHistory />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className={toolbarIconButtonClass(showErrorBadges)}
                    title="Toggle error markers"
                    onClick={() => setShowErrorBadges(!showErrorBadges)}
                >
                    {showErrorBadges ? <FiEye /> : <FiEyeOff />}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className={toolbarIconButtonClass(bottomPanelOpen, 'relative')}
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
                    className={toolbarIconButtonClass(noticesOpen)}
                    title="Toggle notices manager"
                    onClick={onNoticesToggle}
                >
                    <FiAlertCircle />
                </Button>
            </div>
        </div>
    );
}
