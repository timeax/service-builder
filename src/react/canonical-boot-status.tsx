// SPDX-License-Identifier: GPL-3.0-only
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import type { WorkspaceBootSection } from '@elqora/dgp-workspace';
import { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiLoader, FiRefreshCw, FiX } from 'react-icons/fi';
import { LuBadgeCheck, LuClock3 } from 'react-icons/lu';
import {
    BLOCKING_BOOT_SECTIONS,
    BOOT_SECTION_LABELS,
    createCanonicalBootModel,
    getCanonicalBootDescription,
    getCanonicalBootHeadline,
    getCanonicalBootProgress,
} from './boot';
import { useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

export interface CanonicalWorkspaceBootStatusSurfaceProps {
    className?: string;
}

export interface CanonicalWorkspaceBootInlineNoticeProps {
    sections?: WorkspaceBootSection[];
    className?: string;
}

export function CanonicalWorkspaceBootInlineNotice({
    sections,
    className,
}: CanonicalWorkspaceBootInlineNoticeProps) {
    const runtime = useWorkspaceRuntime();
    const state = useWorkspaceSelector((current) => current);
    const boot = useMemo(() => createCanonicalBootModel(state, runtime), [runtime, state]);
    const scopedSections = sections ?? (Object.keys(boot.sections) as WorkspaceBootSection[]);
    const failedSections = scopedSections.filter((section) => boot.sections[section].status === 'error');
    const loadingSections = scopedSections.filter((section) => boot.sections[section].status === 'loading');

    if (!failedSections.length && !loadingSections.length) return null;
    const title = failedSections.length
        ? `${failedSections.map((section) => BOOT_SECTION_LABELS[section]).join(', ')} need attention`
        : `${loadingSections.map((section) => BOOT_SECTION_LABELS[section]).join(', ')} still loading`;
    const description = failedSections.length
        ? failedSections
              .map((section) => boot.sections[section].error?.message ?? `${BOOT_SECTION_LABELS[section]} failed to load.`)
              .join(' ')
        : 'This area is still syncing with the live workspace.';

    return (
        <div className={cn('rounded-2xl border px-3 py-2 text-xs shadow-sm', failedSections.length ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100', className)}>
            <div className="flex items-start gap-2">
                {failedSections.length ? <FiAlertCircle className="mt-0.5 shrink-0" /> : <LuClock3 className="mt-0.5 shrink-0" />}
                <div><div className="font-semibold">{title}</div><div className="mt-1 opacity-90">{description}</div></div>
            </div>
        </div>
    );
}

export function CanonicalWorkspaceBootStatusSurface({
    className,
}: CanonicalWorkspaceBootStatusSurfaceProps) {
    const runtime = useWorkspaceRuntime();
    const state = useWorkspaceSelector((current) => current);
    const boot = useMemo(() => createCanonicalBootModel(state, runtime), [runtime, state]);
    const [dismissed, setDismissed] = useState(false);
    const [retryingAll, setRetryingAll] = useState(false);
    const [retryingSection, setRetryingSection] = useState<WorkspaceBootSection | null>(null);
    const shouldShow = boot.is_booting || boot.has_errors || !dismissed;

    useEffect(() => {
        if (boot.is_booting) setDismissed(false);
    }, [boot.is_booting]);

    if (!shouldShow) return null;
    const progress = getCanonicalBootProgress(boot);
    const compact = boot.is_ready && !boot.has_errors;

    return (
        <div className={cn('max-h-[min(70vh,36rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95', className)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {boot.is_ready ? boot.has_partial_failure ? <FiAlertCircle className="text-amber-500" /> : <LuBadgeCheck className="text-emerald-500" /> : boot.has_errors && !boot.is_booting ? <FiAlertCircle className="text-rose-500" /> : <FiLoader className="animate-spin text-blue-500" />}
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{getCanonicalBootHeadline(boot)}</h3>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{getCanonicalBootDescription(boot)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500">
                        <span>{boot.completed_sections}/{boot.total_sections} complete</span>
                        <span>{boot.succeeded_sections} ok</span>
                        {boot.failed_sections ? <span>{boot.failed_sections} failed</span> : null}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={retryingAll} onClick={async () => { setRetryingAll(true); try { await boot.retry_all(); } finally { setRetryingAll(false); } }}>
                        {retryingAll ? <FiLoader className="animate-spin" /> : <FiRefreshCw />} Retry all
                    </Button>
                    {boot.completed_sections >= boot.total_sections ? <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-xl" aria-label="Dismiss workspace boot status" onClick={() => setDismissed(true)}><FiX /></Button> : null}
                </div>
            </div>
            <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={cn('h-full rounded-full transition-all', boot.is_ready && !boot.has_partial_failure ? 'bg-emerald-500' : boot.has_errors && !boot.is_booting ? 'bg-rose-500' : 'bg-blue-500')} style={{ width: `${progress}%` }} />
                </div>
            </div>
            {!compact ? (
                <div className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                    {Object.entries(boot.sections).map(([sectionKey, sectionState]) => {
                        const section = sectionKey as WorkspaceBootSection;
                        const retrying = retryingSection === section;
                        return (
                            <div key={section} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        {sectionState.status === 'success' ? <FiCheckCircle className="text-emerald-500" /> : sectionState.status === 'error' ? <FiAlertCircle className="text-rose-500" /> : sectionState.status === 'loading' ? <FiLoader className="animate-spin text-blue-500" /> : <LuClock3 className="text-slate-400" />}
                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{BOOT_SECTION_LABELS[section]}</span>
                                        {!BLOCKING_BOOT_SECTIONS.has(section) ? <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:border-slate-700 dark:text-slate-400">Optional</span> : null}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sectionState.error?.message ?? (sectionState.status === 'success' ? 'Loaded successfully.' : sectionState.status === 'loading' ? 'Loading latest workspace data.' : 'Waiting to start.')}</div>
                                </div>
                                {sectionState.status === 'error' ? <Button type="button" size="sm" variant="ghost" className="h-8 rounded-xl px-2" aria-label={`Retry ${BOOT_SECTION_LABELS[section]}`} disabled={retrying} onClick={async () => { setRetryingSection(section); try { await boot.retry_section(section); } finally { setRetryingSection(null); } }}>{retrying ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}</Button> : <span className={cn('mt-0.5 rounded-full px-2 py-1 text-[11px] font-semibold capitalize', sectionState.status === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200' : sectionState.status === 'loading' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{sectionState.status}</span>}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
