import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import {
    BOOT_SECTION_LABELS,
    getActiveBootSections,
    getBootProgressValue,
    getBootSectionTone,
    getWorkspaceBootDescription,
    getWorkspaceBootHeadline,
    isBlockingBootSection,
} from '@/workspace/boot.ts';
import type { WorkspaceBootSection, WorkspaceBootSectionState, WorkspaceBootState } from '@timeax/digital-service-engine/workspace';
import { useEffect, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiLoader, FiRefreshCw, FiX } from 'react-icons/fi';
import { LuBadgeCheck, LuClock3 } from 'react-icons/lu';

type WorkspaceBootStatusCardProps = {
    boot: WorkspaceBootState;
    className?: string;
    compact?: boolean;
    onDismiss?: () => void;
};

type WorkspaceBootInlineNoticeProps = {
    boot: WorkspaceBootState;
    sections?: WorkspaceBootSection[];
    className?: string;
};

type WorkspaceBootStatusSurfaceProps = {
    boot: WorkspaceBootState;
    className?: string;
};

export function WorkspaceBootInlineNotice({ boot, sections, className }: WorkspaceBootInlineNoticeProps) {
    const scopedSections = sections ?? getActiveBootSections(boot);
    const failedSections = scopedSections.filter((section) => boot.sections[section].status === 'error');
    const loadingSections = scopedSections.filter((section) => boot.sections[section].status === 'loading');

    if (!failedSections.length && !loadingSections.length && !boot.isSeededView) return null;

    const title = failedSections.length
        ? `${failedSections.map((section) => BOOT_SECTION_LABELS[section]).join(', ')} need attention`
        : boot.isSeededView
          ? 'Showing seeded data while live sync continues'
          : `${loadingSections.map((section) => BOOT_SECTION_LABELS[section]).join(', ')} still loading`;

    const description = failedSections.length
        ? failedSections
              .map((section) => boot.errorsBySection[section]?.message ?? `${BOOT_SECTION_LABELS[section]} failed to load.`)
              .join(' ')
        : boot.isSeededView
          ? 'Visible data is still being confirmed by the provider.'
          : 'This area is still syncing with the live workspace.';

    return (
        <div
            className={cn(
                'rounded-2xl border px-3 py-2 text-xs shadow-sm',
                failedSections.length
                    ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100'
                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
                className,
            )}
        >
            <div className="flex items-start gap-2">
                {failedSections.length ? <FiAlertCircle className="mt-0.5 shrink-0" /> : <LuClock3 className="mt-0.5 shrink-0" />}
                <div>
                    <div className="font-semibold">{title}</div>
                    <div className="mt-1 opacity-90">{description}</div>
                </div>
            </div>
        </div>
    );
}

export function WorkspaceBootStatusCard({ boot, className, compact = false, onDismiss }: WorkspaceBootStatusCardProps) {
    const [retryingAll, setRetryingAll] = useState(false);
    const [retryingSection, setRetryingSection] = useState<WorkspaceBootSection | null>(null);
    const headline = getWorkspaceBootHeadline(boot);
    const description = getWorkspaceBootDescription(boot);
    const progressValue = getBootProgressValue(boot);
    const canDismiss = boot.completedSections >= boot.totalSections;

    return (
        <div
            className={cn(
                'max-h-[min(70vh,36rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {boot.isReady ? (
                            boot.hasPartialFailure ? (
                                <FiAlertCircle className="text-amber-500" />
                            ) : (
                                <LuBadgeCheck className="text-emerald-500" />
                            )
                        ) : boot.hasErrors && !boot.isBooting ? (
                            <FiAlertCircle className="text-rose-500" />
                        ) : (
                            <FiLoader className="animate-spin text-blue-500" />
                        )}
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{headline}</h3>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        <span>{boot.completedSections}/{boot.totalSections} complete</span>
                        <span>{boot.succeededSections} ok</span>
                        {boot.failedSections ? <span>{boot.failedSections} failed</span> : null}
                        {boot.isSeededView ? <span>seeded view</span> : null}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={retryingAll}
                        onClick={async () => {
                            setRetryingAll(true);
                            try {
                                await boot.retryAll();
                            } finally {
                                setRetryingAll(false);
                            }
                        }}
                    >
                        {retryingAll ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                        Retry all
                    </Button>
                    {canDismiss && onDismiss ? (
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-xl" aria-label="Dismiss workspace boot status" onClick={onDismiss}>
                            <FiX />
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                        className={cn(
                            'h-full rounded-full transition-all',
                            boot.isReady && !boot.hasPartialFailure
                                ? 'bg-emerald-500'
                                : boot.hasErrors && !boot.isBooting
                                  ? 'bg-rose-500'
                                  : 'bg-blue-500',
                        )}
                        style={{ width: `${progressValue}%` }}
                    />
                </div>
            </div>

            {!compact ? (
                <div className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                    {Object.entries(boot.sections).map(([sectionKey, sectionState]) => {
                        const section = sectionKey as WorkspaceBootSection;
                        const isRetrying = retryingSection === section;
                        return (
                            <div
                                key={section}
                                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <StatusIcon status={sectionState.status} />
                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{BOOT_SECTION_LABELS[section]}</span>
                                        {!isBlockingBootSection(section) ? (
                                            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                Optional
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {sectionState.error?.message ?? getSectionCopy(sectionState.status)}
                                    </div>
                                </div>
                                {sectionState.status === 'error' ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 rounded-xl px-2"
                                        aria-label={`Retry ${BOOT_SECTION_LABELS[section]}`}
                                        disabled={isRetrying}
                                        onClick={async () => {
                                            setRetryingSection(section);
                                            try {
                                                await boot.retrySection(section);
                                            } finally {
                                                setRetryingSection(null);
                                            }
                                        }}
                                    >
                                        {isRetrying ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                                    </Button>
                                ) : (
                                    <span
                                        className={cn(
                                            'mt-0.5 rounded-full px-2 py-1 text-[11px] font-semibold capitalize',
                                            getStatusClassName(sectionState),
                                        )}
                                    >
                                        {sectionState.status}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

export function WorkspaceBootStatusSurface({ boot, className }: WorkspaceBootStatusSurfaceProps) {
    const [dismissed, setDismissed] = useState(false);
    const shouldShow = boot.isBooting || boot.hasErrors || boot.isSeededView || !dismissed;

    useEffect(() => {
        if (boot.isBooting || boot.isSeededView) setDismissed(false);
    }, [boot.isBooting, boot.isSeededView]);

    if (!shouldShow) return null;

    return <WorkspaceBootStatusCard boot={boot} className={className} compact={boot.isReady && !boot.hasErrors} onDismiss={() => setDismissed(true)} />;
}

function StatusIcon({ status }: { status: WorkspaceBootSectionState['status'] }) {
    if (status === 'success') return <FiCheckCircle className="text-emerald-500" />;
    if (status === 'error') return <FiAlertCircle className="text-rose-500" />;
    if (status === 'loading') return <FiLoader className="animate-spin text-blue-500" />;
    return <LuClock3 className="text-slate-400" />;
}

function getSectionCopy(status: WorkspaceBootSectionState['status']) {
    switch (status) {
        case 'success':
            return 'Loaded successfully.';
        case 'error':
            return 'Failed to load.';
        case 'loading':
            return 'Loading latest workspace data.';
        default:
            return 'Waiting to start.';
    }
}

function getStatusClassName(sectionState: WorkspaceBootSectionState) {
    const tone = getBootSectionTone(sectionState);
    if (tone === 'success') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';
    if (tone === 'danger') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200';
    if (tone === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}
