import { EmptyState } from '@/components/builder/index.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { type ErrorLog, useCanvas, type UseErrorsReturn, type ValidationRow } from '@timeax/digital-service-engine/workspace';
import { FiInfo, FiTrash2, FiX } from 'react-icons/fi';
import {
    type ConsoleIntroState,
    type ConsoleScopeFilter,
    type ConsoleSeverityFilter,
    type ConsoleSubTab,
    describeValidationScope,
    getConsoleIntroCopy,
    iconForSeverity,
    matchesLogScope,
    matchesNoticeScope,
    matchesSeverity,
    matchesValidationScope,
    type ServiceNotice,
    severityBadgeClassName,
    toNodeChip,
} from './utils.tsx';

export function ConsoleTab({
    errors,
    notices,
    activeNodeIds,
    subTab,
    onSubTabChange,
    scopeFilter,
    onScopeFilterChange,
    severityFilter,
    onSeverityFilterChange,
    validating,
    shortcutLabel,
    introState,
    onToggleIntroMinimized,
    onCloseIntro,
    onNodeClick,
}: {
    errors: UseErrorsReturn;
    notices: ServiceNotice[];
    activeNodeIds: ReadonlySet<string>;
    subTab: ConsoleSubTab;
    onSubTabChange: (tab: ConsoleSubTab) => void;
    scopeFilter: ConsoleScopeFilter;
    onScopeFilterChange: (scope: ConsoleScopeFilter) => void;
    severityFilter: ConsoleSeverityFilter;
    onSeverityFilterChange: (severity: ConsoleSeverityFilter) => void;
    validating: boolean;
    shortcutLabel: string;
    introState: ConsoleIntroState;
    onToggleIntroMinimized: (tab: ConsoleSubTab) => void;
    onCloseIntro: (tab: ConsoleSubTab) => void;
    onNodeClick: (nodeId: string) => void;
}) {
    const hasActiveSelection = activeNodeIds.size > 0;
    const validationRows = errors.validation
        .filter((row) => matchesValidationScope(row, scopeFilter, activeNodeIds))
        .filter((row) => matchesSeverity(row.severity, severityFilter));
    const logRows = errors.logs.filter((row) => matchesLogScope(row, scopeFilter, activeNodeIds));
    const noticeRows = notices
        .filter((notice) => matchesNoticeScope(notice, scopeFilter, activeNodeIds))
        .filter((notice) => matchesSeverity(notice.severity, severityFilter));

    const subTabs: Array<{ id: ConsoleSubTab; label: string; count: number }> = [
        { id: 'validation', label: 'Validation', count: validationRows.length },
        { id: 'logs', label: 'Logs', count: logRows.length },
        { id: 'notices', label: 'Notices', count: noticeRows.length },
    ];
    const activeIntro = introState[subTab];
    const introCopy = getConsoleIntroCopy(subTab);

    return (
        <div className="space-y-4">
            {!activeIntro.closed ? (
                <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 p-3 dark:border-sky-500/20 dark:bg-sky-500/10">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{introCopy.title}</p>
                            {!activeIntro.minimized ? (
                                <>
                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{introCopy.description}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                        <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">
                                            {validating ? 'Validating...' : 'Console idle'}
                                        </span>
                                        <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">{shortcutLabel}</span>
                                        <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">Press Escape to close</span>
                                    </div>
                                </>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => onToggleIntroMinimized(subTab)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                            >
                                {activeIntro.minimized ? 'Expand' : 'Minimize'}
                            </button>
                            <button
                                type="button"
                                onClick={() => onCloseIntro(subTab)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {subTabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onSubTabChange(tab.id)}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase transition-colors',
                                    subTab === tab.id
                                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                                )}
                            >
                                <span>{tab.label}</span>
                                <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{tab.count}</span>
                            </button>
                        ))}
                    </div>

                    {subTab === 'logs' && logRows.length ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => errors.clear('logs')} className="h-8 rounded-xl px-3 text-xs">
                            <FiTrash2 />
                            Clear logs
                        </Button>
                    ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Scope</span>
                    <button
                        type="button"
                        onClick={() => onScopeFilterChange('all')}
                        className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium transition',
                            scopeFilter === 'all'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                        )}
                    >
                        All items
                    </button>
                    <button
                        type="button"
                        onClick={() => onScopeFilterChange('activeNode')}
                        className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium transition',
                            scopeFilter === 'activeNode'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                        )}
                    >
                        Active node
                    </button>

                    {subTab !== 'logs' ? (
                        <>
                            <span className="ml-2 text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                                Severity
                            </span>
                            {(['all', 'error', 'warning', 'info'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => onSeverityFilterChange(option)}
                                    className={cn(
                                        'rounded-full px-2.5 py-1 text-xs font-medium capitalize transition',
                                        severityFilter === option
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                                    )}
                                >
                                    {option}
                                </button>
                            ))}
                        </>
                    ) : null}
                </div>

                {scopeFilter === 'activeNode' && !hasActiveSelection ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                        No active node selected. Select a node to filter by active scope.
                    </p>
                ) : null}
            </div>

            {subTab === 'validation' ? (
                validationRows.length ? (
                    <div className="space-y-3">
                        {validationRows.map((row) => (
                            <ValidationCard onNodeClick={onNodeClick} key={row.id} row={row} />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No validation rows for this filter"
                        description={
                            scopeFilter === 'activeNode'
                                ? 'No validation rows match the current active node scope.'
                                : 'No validation rows match the current severity filter.'
                        }
                    />
                )
            ) : null}

            {subTab === 'logs' ? (
                logRows.length ? (
                    <div className="space-y-3">
                        {logRows.map((row) => (
                            <LogCard key={row.id} row={row} onRemove={() => errors.removeLog(row.id)} />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No logs for this filter"
                        description={
                            scopeFilter === 'activeNode' ? 'No logs are linked to the current active node scope.' : 'No logs have been captured yet.'
                        }
                    />
                )
            ) : null}

            {subTab === 'notices' ? (
                noticeRows.length ? (
                    <div className="space-y-3">
                        {noticeRows.map((row) => (
                            <NoticeCard key={row.id} notice={row} onNodeClick={onNodeClick} />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No notices for this filter"
                        description={
                            scopeFilter === 'activeNode'
                                ? 'No node-scoped notices match the current active node.'
                                : 'No notices match the current severity filter.'
                        }
                    />
                )
            ) : null}
        </div>
    );
}

function NoticeCard({ notice, onNodeClick }: { notice: ServiceNotice; onNodeClick: (nodeId: string) => void }) {
    const canvas = useCanvas();
    const targetNodeId = notice.target.scope === 'node' ? notice.target.node_id : null;

    const targetChip = notice.target.scope === 'node' ? toNodeChip(canvas, notice.target.node_id) : 'Global notice';

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{iconForSeverity(notice.severity)}</div>
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={severityBadgeClassName(notice.severity)}>{notice.kind}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-slate-600 uppercase dark:bg-slate-900 dark:text-slate-300">
                            {notice.type}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{notice.title}</span>
                    </div>
                    {notice.description ? <p className="text-sm text-slate-600 dark:text-slate-300">{notice.description}</p> : null}
                    {notice.reason ? <p className="text-xs text-slate-500 dark:text-slate-400">Reason: {notice.reason}</p> : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {notice.target.scope === 'node' ? (
                            <button
                                type="button"
                                onClick={() => targetNodeId && onNodeClick(targetNodeId)}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                {targetChip}
                            </button>
                        ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                {targetChip}
                            </span>
                        )}
                        {notice.marked_at ? <span>{new Date(notice.marked_at).toLocaleString()}</span> : null}
                        {notice.icon ? <span>Icon: {notice.icon}</span> : null}
                        {notice.color ? <span>Color: {notice.color}</span> : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ValidationCard({ row, onNodeClick }: { row: ValidationRow; onNodeClick: (nodeId: string) => void }) {
    const canvas = useCanvas();
    const scope = describeValidationScope(canvas, row);

    return (
        <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90"
            onClick={() => scope.length && canvas.api.setHighlighted(scope)}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{iconForSeverity(row.severity)}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={severityBadgeClassName(row.severity)}>{row.code.replaceAll('_', ' ')}</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.message}</span>
                    </div>
                    {scope.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {scope.map((item) => (
                                <span
                                    key={item}
                                    onClick={() => onNodeClick(row.nodeId)}
                                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function LogCard({ row, onRemove }: { row: ErrorLog; onRemove: () => void }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex items-start gap-3">
                <div className="mt-0.5">
                    <FiInfo className="text-lg text-sky-500" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-sky-700 uppercase dark:bg-sky-500/15 dark:text-sky-200">
                            {row.code ?? 'log'}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.message}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>{new Date(row.createdAt).toLocaleTimeString()}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 rounded-xl px-2 text-xs">
                            <FiX />
                            Dismiss
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
